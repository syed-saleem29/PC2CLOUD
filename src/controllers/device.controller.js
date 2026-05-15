const crypto = require("crypto");
const deviceModel = require("../models/device.model");
const realtime = require("../realtime");

function parseStorageBytes(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return null;
  }

  return Math.floor(parsedValue);
}

function formatDevice(device) {
  // Do not return sharedFolderPath here. It can reveal private local paths like
  // C:\Users\Name\Documents, and the website only needs display-safe metadata.
  return {
    deviceId: device.deviceId,
    deviceName: device.deviceName,
    platform: device.platform,
    publicKey: device.publicKey,
    sharedFolderName: device.sharedFolderName,
    storageLimitBytes: device.storageLimitBytes,
    usedStorageBytes: device.usedStorageBytes,
    pairingStatus: device.pairingStatus,
    status: device.status,
    lastSeen: device.lastSeen,
    createdAt: device.createdAt,
    updatedAt: device.updatedAt,
  };
}

async function registerDeviceController(req, res) {
  const {
    deviceId,
    deviceName,
    platform,
    publicKey,
    sharedFolderName,
    sharedFolderPath,
    storageLimitBytes,
    usedStorageBytes,
  } = req.body;

  if (!deviceName || typeof deviceName !== "string") {
    return res.status(400).json({
      message: "Device name is required",
    });
  }

  const parsedStorageLimitBytes = parseStorageBytes(storageLimitBytes);
  const parsedUsedStorageBytes = parseStorageBytes(usedStorageBytes);

  if (parsedStorageLimitBytes === null || parsedUsedStorageBytes === null) {
    return res.status(400).json({
      message: "Storage values must be non-negative numbers",
    });
  }

  // First install can omit deviceId. In that case the backend creates one, and
  // the desktop app should save it locally for future heartbeats/reconnects.
  const currentDeviceId = deviceId || crypto.randomUUID();

  const deviceUpdates = {
    deviceName: deviceName.trim(),
    platform: platform || "windows",
    publicKey: publicKey || null,
    status: "online",
    pairingStatus: "linked",
    lastSeen: new Date(),
    ipAddress: req.ip,
    userAgent: req.get("user-agent") || null,
  };

  if (sharedFolderName) {
    deviceUpdates.sharedFolderName = sharedFolderName.trim();
  }

  if (sharedFolderPath) {
    deviceUpdates.sharedFolderPath = sharedFolderPath;
  }

  if (parsedStorageLimitBytes !== undefined) {
    deviceUpdates.storageLimitBytes = parsedStorageLimitBytes;
  }

  if (parsedUsedStorageBytes !== undefined) {
    deviceUpdates.usedStorageBytes = parsedUsedStorageBytes;
  }

  const device = await deviceModel.findOneAndUpdate(
    {
      user: req.user._id,
      deviceId: currentDeviceId,
    },
    {
      $set: deviceUpdates,
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );

  res.status(200).json({
    message: "Device registered successfully",
    device: formatDevice(device),
  });
}

async function updateDeviceStorageController(req, res) {
  const { deviceId } = req.params;
  const {
    deviceName,
    sharedFolderName,
    sharedFolderPath,
    storageLimitBytes,
    usedStorageBytes,
  } = req.body;

  const parsedStorageLimitBytes = parseStorageBytes(storageLimitBytes);
  const parsedUsedStorageBytes = parseStorageBytes(usedStorageBytes);

  if (parsedStorageLimitBytes === null || parsedUsedStorageBytes === null) {
    return res.status(400).json({
      message: "Storage values must be non-negative numbers",
    });
  }

  const storageUpdates = {
    lastSeen: new Date(),
  };

  if (deviceName) {
    storageUpdates.deviceName = deviceName.trim();
  }

  if (sharedFolderName) {
    storageUpdates.sharedFolderName = sharedFolderName.trim();
  }

  if (sharedFolderPath) {
    storageUpdates.sharedFolderPath = sharedFolderPath;
  }

  if (parsedStorageLimitBytes !== undefined) {
    storageUpdates.storageLimitBytes = parsedStorageLimitBytes;
  }

  if (parsedUsedStorageBytes !== undefined) {
    storageUpdates.usedStorageBytes = parsedUsedStorageBytes;
  }

  const device = await deviceModel.findOneAndUpdate(
    {
      user: req.user._id,
      deviceId,
    },
    {
      $set: storageUpdates,
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!device) {
    return res.status(404).json({
      message: "Device not found",
    });
  }

  res.status(200).json({
    message: "Device storage updated successfully",
    device: formatDevice(device),
  });
}

async function listDevicesController(req, res) {
  const devices = await deviceModel
    .find({ user: req.user._id })
    .sort({ lastSeen: -1 });

  res.status(200).json({
    devices: devices.map(formatDevice),
  });
}

async function heartbeatDeviceController(req, res) {
  const { deviceId } = req.params;

  const device = await deviceModel.findOneAndUpdate(
    {
      user: req.user._id,
      deviceId,
    },
    {
      $set: {
        lastSeen: new Date(),
        ipAddress: req.ip,
        userAgent: req.get("user-agent") || null,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!device) {
    return res.status(404).json({
      message: "Device not found",
    });
  }

  res.status(200).json({
    message: "Device heartbeat received",
    device: formatDevice(device),
    sharedFolderPath: device.sharedFolderPath || null,
  });
}

async function unlinkDeviceController(req, res) {
  const { deviceId } = req.params;

  // Unlink removes the device from this account. The future desktop app can
  // register again if the user signs in or pairs the PC later.
  const device = await deviceModel.findOneAndDelete({
    user: req.user._id,
    deviceId,
  });

  if (!device) {
    return res.status(404).json({
      message: "Device not found",
    });
  }

  res.status(200).json({
    message: "Device unlinked successfully",
    deviceId,
  });
}

async function downloadFileController(req, res) {
  const { deviceId } = req.params;
  const filePath = req.query.path;
  const inline = req.query.inline === "true";

  if (!filePath) {
    return res.status(400).json({ message: "path query parameter is required" });
  }

  const device = await deviceModel.findOne({ user: req.user._id, deviceId });
  if (!device) {
    return res.status(404).json({ message: "Device not found" });
  }
  if (device.status !== "online") {
    return res.status(503).json({ message: "Device is offline" });
  }

  const requestId = crypto.randomUUID();

  const timeout = setTimeout(() => {
    realtime.pendingDownloads.delete(requestId);
    if (!res.headersSent) {
      res.status(504).json({ message: "Device did not respond in time" });
    }
  }, 30_000);

  realtime.pendingDownloads.set(requestId, { res, timeout, inline });

  const delivered = realtime.emitToDevice(deviceId, "file:request", { requestId, filePath });
  if (!delivered) {
    clearTimeout(timeout);
    realtime.pendingDownloads.delete(requestId);
    return res.status(503).json({ message: "Device socket not connected" });
  }
}

async function uploadFileController(req, res) {
  const { deviceId } = req.params;
  const filePath = req.query.path;

  if (!filePath) {
    return res.status(400).json({ message: "path query parameter is required" });
  }

  const device = await deviceModel.findOne({ user: req.user._id, deviceId });
  if (!device) return res.status(404).json({ message: "Device not found" });
  if (device.status !== "online") return res.status(503).json({ message: "Device is offline" });

  const requestId = crypto.randomUUID();
  const buffer = req.body;

  const timeout = setTimeout(() => {
    realtime.pendingUploads.delete(requestId);
    if (!res.headersSent) {
      res.status(504).json({ message: "Device did not respond in time" });
    }
  }, 60_000);

  realtime.pendingUploads.set(requestId, { buffer, res, timeout });

  const delivered = realtime.emitToDevice(deviceId, "file:upload", { requestId, filePath });
  if (!delivered) {
    clearTimeout(timeout);
    realtime.pendingUploads.delete(requestId);
    return res.status(503).json({ message: "Device socket not connected" });
  }
}

module.exports = {
  registerDeviceController,
  updateDeviceStorageController,
  listDevicesController,
  heartbeatDeviceController,
  unlinkDeviceController,
  downloadFileController,
  uploadFileController,
};
