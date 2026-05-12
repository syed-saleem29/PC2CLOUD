const express = require('express')
const authRouter = express.Router()
const authController = require('../controllers/auth.controller')
const authMiddleware = require('../middlewares/auth.middleware')

authRouter.post("/register", authController.registerController)
authRouter.post("/login", authController.loginController)
authRouter.post("/logout", authController.logoutController)
authRouter.get("/me", authMiddleware, authController.meController)

authRouter.post("/send-otp", authController.sendOtpController)
authRouter.post("/verify-email", authController.verifyEmailController)
authRouter.post("/reset-password", authController.resetPasswordController)

module.exports = authRouter
