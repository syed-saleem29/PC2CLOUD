const express = require("express");
const subscriptionRouter = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const { apiLimiter } = require("../middlewares/rateLimit.middleware");
const asyncHandler = require("../utils/asyncHandler");
const {
  getSubscriptionController,
  startTrialController,
  createOrderController,
  verifyPaymentController,
} = require("../controllers/subscription.controller");

subscriptionRouter.use(authMiddleware);
subscriptionRouter.use(apiLimiter);

subscriptionRouter.get("/",                asyncHandler(getSubscriptionController));
subscriptionRouter.post("/start-trial",    asyncHandler(startTrialController));
subscriptionRouter.post("/create-order",   asyncHandler(createOrderController));
subscriptionRouter.post("/verify-payment", asyncHandler(verifyPaymentController));

module.exports = subscriptionRouter;
