const rateLimit = require("express-rate-limit");

const rateLimitResponse = (message) => ({
  handler(req, res) {
    res.status(429).json({ message });
  },
  standardHeaders: true,  // Return RateLimit-* headers so clients can back off
  legacyHeaders: false,
});

// Login — strictest: 5 wrong passwords per IP per 15 min blocks brute force
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true, // Only count failures (2xx responses don't count)
  ...rateLimitResponse("Too many login attempts. Please wait 15 minutes before trying again."),
});

// Other auth endpoints (register, OTP, verify, reset) — 10 per IP per 15 min
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  ...rateLimitResponse("Too many requests. Please wait 15 minutes before trying again."),
});

// General API (device list, file browse, rename, delete, etc.) — 120 per IP per minute
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  ...rateLimitResponse("Too many requests. Please slow down."),
});

// File download — 30 per IP per minute (fetching files is expensive relay work)
const downloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  ...rateLimitResponse("Download rate limit reached. Please wait a moment."),
});

// File upload — 20 per IP per minute
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  ...rateLimitResponse("Upload rate limit reached. Please wait a moment."),
});

module.exports = { loginLimiter, authLimiter, apiLimiter, downloadLimiter, uploadLimiter };
