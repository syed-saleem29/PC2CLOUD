const crypto = require("crypto");
const userModel = require("../models/user.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendOtpEmail } = require("../services/email.service");
const { logAction } = require("../utils/audit");

const isProd = process.env.NODE_ENV === "production";
const authCookieOptions = {
  httpOnly: true,
  sameSite: isProd ? "none" : "lax",
  secure: isProd,
  maxAge: 15 * 60 * 1000, // matches access token lifetime
};

function createToken(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "15m" });
}

async function generateRefreshToken(user) {
  const token = crypto.randomBytes(40).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  // Prune expired sessions and cap at 9 before pushing the new one
  user.sessions = (user.sessions || [])
    .filter((s) => s.expiresAt > new Date())
    .slice(-9);
  user.sessions.push({ token, expiresAt });
  await user.save();
  return token;
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

  logAction(user._id, "register", { req, details: { email: normalizedEmail } });

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
    logAction(user._id, "login_failed", { req, details: { email: normalizedEmail, reason: "wrong_password" } });
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
  const refreshToken = await generateRefreshToken(user);
  res.cookie("PTC_Token", token, authCookieOptions);
  logAction(user._id, "login", { req });
  res.status(200).json({
    message: "Logged in successfully",
    token,
    refreshToken,
    user: { userName: user.userName, userEmail: normalizedEmail },
  });
}

async function logoutController(req, res) {
  if (req.user) {
    logAction(req.user._id, "logout", { req });
    const { refreshToken } = req.body;
    if (refreshToken) {
      await userModel.updateOne(
        { _id: req.user._id },
        { $pull: { sessions: { token: refreshToken } } },
      ).catch(() => {});
    }
  }
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
  const refreshToken = await generateRefreshToken(user);
  res.cookie("PTC_Token", token, authCookieOptions);
  res.status(200).json({
    message: "Email verified successfully",
    token,
    refreshToken,
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

async function refreshController(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ message: "Refresh token required" });
  }

  const user = await userModel.findOne({ "sessions.token": refreshToken });
  if (!user) {
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  const session = user.sessions.find((s) => s.token === refreshToken);
  if (!session || session.expiresAt < new Date()) {
    await userModel.updateOne(
      { _id: user._id },
      { $pull: { sessions: { token: refreshToken } } },
    ).catch(() => {});
    return res.status(401).json({ message: "Refresh token expired" });
  }

  // Rotate: remove old session, issue new one
  user.sessions = user.sessions.filter((s) => s.token !== refreshToken);
  const newRefreshToken = await generateRefreshToken(user);
  const newAccessToken = createToken(user);
  res.cookie("PTC_Token", newAccessToken, authCookieOptions);
  res.status(200).json({ token: newAccessToken, refreshToken: newRefreshToken });
}

module.exports = {
  registerController,
  loginController,
  logoutController,
  meController,
  sendOtpController,
  verifyEmailController,
  resetPasswordController,
  refreshController,
};
