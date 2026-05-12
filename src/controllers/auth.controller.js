const userModel = require("../models/user.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendOtpEmail } = require("../services/email.service");

const isProd = process.env.NODE_ENV === "production";
const authCookieOptions = {
  httpOnly: true,
  sameSite: isProd ? "none" : "lax",
  secure: isProd,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function createToken(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function saveAndSendOtp(user, type) {
  const otp = generateOtp();
  user.otp = otp;
  user.otpType = type;
  user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  await user.save();
  await sendOtpEmail(user.userEmail, otp, type);
}

async function registerController(req, res) {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: "Username, email, and password are required" });
  }

  const normalizedEmail = email.toLowerCase();
  const existing = await userModel.findOne({ userEmail: normalizedEmail });
  if (existing) {
    return res.status(409).json({ message: "User already exists" });
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await userModel.create({
    userName: username,
    userEmail: normalizedEmail,
    password: hash,
    isEmailVerified: false,
  });

  await saveAndSendOtp(user, "verify");

  res.status(201).json({
    message: "Account created. Check your email for a verification code.",
    requiresVerification: true,
    email: normalizedEmail,
  });
}

async function loginController(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const normalizedEmail = email.toLowerCase();
  const user = await userModel.findOne({ userEmail: normalizedEmail });
  if (!user) {
    return res.status(404).json({ message: "User doesn't exist" });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({ message: "Invalid password" });
  }

  // Block login for accounts explicitly marked unverified (new accounts only)
  if (user.isEmailVerified === false) {
    await saveAndSendOtp(user, "verify");
    return res.status(403).json({
      message: "Please verify your email. A new code has been sent.",
      requiresVerification: true,
      email: normalizedEmail,
    });
  }

  const token = createToken(user);
  res.cookie("PTC_Token", token, authCookieOptions);
  res.status(200).json({
    message: "Logged in successfully",
    token,
    user: { userName: user.userName, userEmail: normalizedEmail },
  });
}

async function logoutController(req, res) {
  res.clearCookie("PTC_Token", authCookieOptions);
  res.status(200).json({ message: "Logged out successfully" });
}

async function meController(req, res) {
  res.status(200).json({
    user: { userName: req.user.userName, userEmail: req.user.userEmail },
  });
}

async function sendOtpController(req, res) {
  const { email, type } = req.body;
  if (!email || !["verify", "reset"].includes(type)) {
    return res.status(400).json({ message: "Email and valid type are required" });
  }

  const user = await userModel.findOne({ userEmail: email.toLowerCase() });
  if (!user) {
    // Generic message to avoid user enumeration
    return res.status(200).json({ message: "If that email exists, a code has been sent." });
  }

  if (type === "verify" && user.isEmailVerified === true) {
    return res.status(400).json({ message: "Email is already verified" });
  }

  await saveAndSendOtp(user, type);
  res.status(200).json({ message: "Code sent to your email" });
}

async function verifyEmailController(req, res) {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ message: "Email and code are required" });
  }

  const user = await userModel.findOne({ userEmail: email.toLowerCase() });
  if (!user) return res.status(404).json({ message: "User not found" });

  if (user.otp !== otp || user.otpType !== "verify") {
    return res.status(400).json({ message: "Invalid code" });
  }
  if (!user.otpExpiry || user.otpExpiry < new Date()) {
    return res.status(400).json({ message: "Code has expired. Request a new one." });
  }

  user.isEmailVerified = true;
  user.otp = null;
  user.otpExpiry = null;
  user.otpType = null;
  await user.save();

  const token = createToken(user);
  res.cookie("PTC_Token", token, authCookieOptions);
  res.status(200).json({
    message: "Email verified successfully",
    token,
    user: { userName: user.userName, userEmail: user.userEmail },
  });
}

async function resetPasswordController(req, res) {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ message: "Email, code, and new password are required" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  const user = await userModel.findOne({ userEmail: email.toLowerCase() });
  if (!user) return res.status(404).json({ message: "User not found" });

  if (user.otp !== otp || user.otpType !== "reset") {
    return res.status(400).json({ message: "Invalid code" });
  }
  if (!user.otpExpiry || user.otpExpiry < new Date()) {
    return res.status(400).json({ message: "Code has expired. Request a new one." });
  }

  user.password = await bcrypt.hash(newPassword, 10);
  user.otp = null;
  user.otpExpiry = null;
  user.otpType = null;
  await user.save();

  res.status(200).json({ message: "Password reset successfully" });
}

module.exports = {
  registerController,
  loginController,
  logoutController,
  meController,
  sendOtpController,
  verifyEmailController,
  resetPasswordController,
};
