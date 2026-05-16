const AuditLog = require("../models/auditLog.model");

/**
 * Fire-and-forget audit log writer. Never throws — a logging failure must
 * never cause a request to fail.
 *
 * @param {string|null} userId  - MongoDB user _id, or null for pre-auth events
 * @param {string}      action  - One of the enum values in auditLog.model.js
 * @param {object}      ctx     - { deviceId?, filePath?, details?, req? }
 */
function logAction(userId, action, { deviceId, filePath, details, req } = {}) {
  AuditLog.create({
    user: userId || null,
    action,
    deviceId: deviceId || null,
    filePath: filePath || null,
    details: details || null,
    ipAddress: req?.ip || null,
    userAgent: req?.get("user-agent") || null,
  }).catch(() => {});
}

module.exports = { logAction };
