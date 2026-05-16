const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    userName:{
        type:String,
        trim: true,
        required: [true, "Username is required"]
    },
    userEmail: {
        type:String,
        unique: [true,"Email Already Exists"],
        lowercase: true,
        trim: true,
        required: [true, "Email is required"]
    },
    password:{
        type:String,
        required: [true, "Password is required"]
    },
    isEmailVerified: {
        type: Boolean,
        // no default — existing users without this field are treated as verified
    },
    otp: { type: String, default: null },
    otpExpiry: { type: Date, default: null },
    otpType: { type: String, enum: ["verify", "reset"], default: null },
    sessions: [
      {
        token: { type: String, required: true },
        expiresAt: { type: Date, required: true },
      },
    ],
    subscription: {
      plan: { type: String, enum: ["free", "pro", "team"], default: "free" },
      status: { type: String, enum: ["active", "trial", "cancelled", "expired"], default: "active" },
      trialUsed: { type: Boolean, default: false },
      razorpayPaymentId: { type: String, default: null },
      razorpayOrderId: { type: String, default: null },
      renewalDate: { type: Date, default: null },
      cancelledAt: { type: Date, default: null },
    },
})

const userModel = mongoose.model("users",userSchema)

module.exports = userModel
