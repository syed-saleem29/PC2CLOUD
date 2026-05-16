const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null, // null for failed login attempts where user may not exist
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "login",
        "login_failed",
        "logout",
        "register",
        "download",
        "upload",
        "delete",
        "rename",
        "move",
        "mkdir",
        "device_register",
        "device_unlink",
      ],
      index: true,
    },
    deviceId: { type: String, default: null },
    filePath: { type: String, default: null },
    details: { type: mongoose.Schema.Types.Mixed, default: null },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: true },
);

// Queries by user sorted by most recent (the dashboard Activity tab)
auditLogSchema.index({ user: 1, createdAt: -1 });

// Auto-delete logs older than 90 days
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const AuditLog = mongoose.model("auditlogs", auditLogSchema);

module.exports = AuditLog;
