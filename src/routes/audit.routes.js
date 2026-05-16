const express = require("express");
const auditRouter = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const { apiLimiter } = require("../middlewares/rateLimit.middleware");
const AuditLog = require("../models/auditLog.model");
const asyncHandler = require("../utils/asyncHandler");

auditRouter.use(authMiddleware);
auditRouter.use(apiLimiter);

auditRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const logs = await AuditLog.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.status(200).json({ logs, page, limit });
  }),
);

module.exports = auditRouter;
