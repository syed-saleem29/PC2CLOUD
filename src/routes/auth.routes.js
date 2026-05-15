const express = require("express");
const authRouter = express.Router();
const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const asyncHandler = require("../utils/asyncHandler");

authRouter.post("/register", asyncHandler(authController.registerController));
authRouter.post("/login", asyncHandler(authController.loginController));
authRouter.post("/logout", asyncHandler(authController.logoutController));
authRouter.get("/me", authMiddleware, asyncHandler(authController.meController));
authRouter.post("/send-otp", asyncHandler(authController.sendOtpController));
authRouter.post("/verify-email", asyncHandler(authController.verifyEmailController));
authRouter.post("/reset-password", asyncHandler(authController.resetPasswordController));

module.exports = authRouter;
