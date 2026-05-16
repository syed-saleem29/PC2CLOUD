const express = require("express");
const authRouter = express.Router();
const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const asyncHandler = require("../utils/asyncHandler");
const { loginLimiter, authLimiter } = require("../middlewares/rateLimit.middleware");

authRouter.post("/register", authLimiter, asyncHandler(authController.registerController));
authRouter.post("/login", loginLimiter, asyncHandler(authController.loginController));
authRouter.post("/logout", asyncHandler(authController.logoutController));
authRouter.post("/refresh", authLimiter, asyncHandler(authController.refreshController));
authRouter.get("/me", authMiddleware, asyncHandler(authController.meController));
authRouter.post("/send-otp", authLimiter, asyncHandler(authController.sendOtpController));
authRouter.post("/verify-email", authLimiter, asyncHandler(authController.verifyEmailController));
authRouter.post("/reset-password", authLimiter, asyncHandler(authController.resetPasswordController));

module.exports = authRouter;
