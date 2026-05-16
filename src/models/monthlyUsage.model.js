const mongoose = require("mongoose");

const monthlyUsageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  // Stored as the first day of the month (UTC) for consistent bucketing
  month: {
    type: Date,
    required: true,
  },
  bytesTransferred: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

monthlyUsageSchema.index({ user: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("monthlyusages", monthlyUsageSchema);
