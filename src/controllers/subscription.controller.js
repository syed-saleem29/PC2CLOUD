const crypto = require("crypto");
const Razorpay = require("razorpay");
const userModel = require("../models/user.model");
const MonthlyUsage = require("../models/monthlyUsage.model");
const deviceModel = require("../models/device.model");
const { getDeviceLimit, getBandwidthLimit } = require("../utils/planLimits");

const PLAN_AMOUNTS_PAISE = {
  pro:  parseInt(process.env.RAZORPAY_PRO_AMOUNT_PAISE  || "39900",  10),
  team: parseInt(process.env.RAZORPAY_TEAM_AMOUNT_PAISE || "99900", 10),
};

// Lazily initialise so missing keys give a clear error at call time
let _razorpay = null;
function getRazorpay() {
  if (!_razorpay) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not configured");
    }
    _razorpay = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return _razorpay;
}

function currentMonthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// ── GET /api/subscription ─────────────────────────────────────────────────────

async function getSubscriptionController(req, res) {
  let user = await userModel.findById(req.user._id);
  let plan   = user.subscription?.plan   || "free";
  let status = user.subscription?.status || "active";

  // Auto-expire trial: if trial period is over, downgrade back to free
  if (status === "trial" && user.subscription?.renewalDate && new Date() > user.subscription.renewalDate) {
    await userModel.findByIdAndUpdate(req.user._id, {
      $set: {
        "subscription.plan":        "free",
        "subscription.status":      "active",
        "subscription.renewalDate": null,
      },
    });
    plan   = "free";
    status = "active";
  }

  const [deviceCount, usageRecord] = await Promise.all([
    deviceModel.countDocuments({ user: req.user._id }),
    MonthlyUsage.findOne({ user: req.user._id, month: currentMonthStart() }),
  ]);

  const bandwidthLimit = getBandwidthLimit(plan);

  res.status(200).json({
    plan,
    status,
    trialUsed:    user.subscription?.trialUsed    ?? false,
    renewalDate:  user.subscription?.renewalDate  ?? null,
    cancelledAt:  user.subscription?.cancelledAt  ?? null,
    devices: {
      used:  deviceCount,
      limit: getDeviceLimit(plan),
    },
    bandwidth: {
      usedBytes:  usageRecord?.bytesTransferred ?? 0,
      limitBytes: isFinite(bandwidthLimit) ? bandwidthLimit : null,
    },
  });
}

// ── POST /api/subscription/start-trial ───────────────────────────────────────

async function startTrialController(req, res) {
  const user = await userModel.findById(req.user._id);

  if (user.subscription?.trialUsed) {
    return res.status(409).json({ message: "You have already used your free trial." });
  }

  if (user.subscription?.plan !== "free") {
    return res.status(409).json({ message: "Free trial is only available on the Free plan." });
  }

  const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await userModel.findByIdAndUpdate(req.user._id, {
    $set: {
      "subscription.plan":        "pro",
      "subscription.status":      "trial",
      "subscription.trialUsed":   true,
      "subscription.renewalDate": trialEndsAt,
    },
  });

  console.log(`[trial] started — userId:${req.user._id} trialEndsAt:${trialEndsAt.toISOString()}`);

  res.status(200).json({
    message:     "Free trial activated. Enjoy Pro for 30 days!",
    plan:        "pro",
    status:      "trial",
    trialEndsAt,
  });
}

// ── POST /api/subscription/create-order ──────────────────────────────────────

async function createOrderController(req, res) {
  const { plan } = req.body;

  if (!["pro", "team"].includes(plan)) {
    return res.status(400).json({ message: "Invalid plan. Must be 'pro' or 'team'." });
  }

  const amountPaise = PLAN_AMOUNTS_PAISE[plan];
  if (!amountPaise || amountPaise < 100) {
    return res.status(500).json({ message: "Plan amount is not configured correctly." });
  }

  const razorpay = getRazorpay();

  // Receipt must be ≤ 40 chars per Razorpay spec
  const receipt = `r_${String(req.user._id).slice(-8)}_${Date.now().toString(36).slice(-6)}`;

  const order = await razorpay.orders.create({
    amount:   amountPaise,
    currency: "INR",
    receipt,
    notes: {
      userId: req.user._id.toString(),
      plan,
    },
  });

  res.status(200).json({
    orderId:  order.id,
    amount:   order.amount,
    currency: order.currency,
    keyId:    process.env.RAZORPAY_KEY_ID,
    plan,
  });
}

// ── POST /api/subscription/verify-payment ────────────────────────────────────

async function verifyPaymentController(req, res) {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, plan } = req.body;

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !plan) {
    return res.status(400).json({ message: "Missing required payment fields." });
  }

  if (!["pro", "team"].includes(plan)) {
    return res.status(400).json({ message: "Invalid plan." });
  }

  // Verify HMAC-SHA256 signature
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({ message: "Payment signature verification failed." });
  }

  // Signature is valid — upgrade the user's plan
  // Grant access for 30 days; user pays again on next cycle
  const renewalDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await userModel.findByIdAndUpdate(req.user._id, {
    $set: {
      "subscription.plan":              plan,
      "subscription.status":            "active",
      "subscription.razorpayPaymentId": razorpay_payment_id,
      "subscription.razorpayOrderId":   razorpay_order_id,
      "subscription.renewalDate":       renewalDate,
      "subscription.cancelledAt":       null,
    },
  });

  console.log(`[razorpay] payment verified — userId:${req.user._id} → plan:${plan}`);

  res.status(200).json({
    message:     "Payment verified. Plan upgraded.",
    plan,
    renewalDate,
  });
}

module.exports = {
  getSubscriptionController,
  startTrialController,
  createOrderController,
  verifyPaymentController,
};
