const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true,
    },
    deviceName: {
      type: String,
      required: [true, "Device name is required"],
      trim: true,
    },
    platform: {
      type: String,
      default: "windows",
      trim: true,
    },
    publicKey: {
      type: String,
      default: null,
    },
    // The desktop app creates/selects this folder. The website can show the
    // friendly name, while the raw local path stays mostly for device-side use.
    sharedFolderName: {
      type: String,
      default: "PC2CLOUD",
      trim: true,
    },
    sharedFolderPath: {
      type: String,
      default: null,
    },
    // Storage is stored in bytes so every client can display it however it wants.
    // This value represents PC2CLOUD capacity on that drive: folder used + drive free.
    storageLimitBytes: {
      type: Number,
      default: 0,
      min: 0,
    },
    usedStorageBytes: {
      type: Number,
      default: 0,
      min: 0,
    },
    pairingStatus: {
      type: String,
      enum: ["pending", "linked"],
      default: "linked",
      index: true,
    },
    status: {
      type: String,
      enum: ["online", "offline"],
      default: "offline",
      index: true,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

deviceSchema.index({ user: 1, deviceId: 1 }, { unique: true });

const deviceModel = mongoose.model("devices", deviceSchema);

module.exports = deviceModel;
