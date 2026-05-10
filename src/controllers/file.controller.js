const fileModel = require("../models/file.model");
const deviceModel = require("../models/device.model");

function normalizePath(value) {
  if (!value || value === ".") {
    return "/";
  }

  const normalized = String(value).replace(/\\/g, "/").replace(/\/+/g, "/");
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function getParentPath(filePath) {
  const normalizedPath = normalizePath(filePath);
  const lastSlashIndex = normalizedPath.lastIndexOf("/");

  if (lastSlashIndex <= 0) {
    return "/";
  }

  return normalizedPath.slice(0, lastSlashIndex);
}

function formatFile(file) {
  return {
    id: file._id,
    fileName: file.fileName,
    filePath: file.filePath,
    parentPath: file.parentPath,
    itemType: file.itemType,
    sizeBytes: file.sizeBytes,
    mimeType: file.mimeType,
    modifiedAt: file.modifiedAt,
  };
}

async function findOwnedDevice(userId, deviceId) {
  return deviceModel.findOne({
    user: userId,
    deviceId,
  });
}

async function listDeviceFilesController(req, res) {
  const { deviceId } = req.params;
  const parentPath = normalizePath(req.query.path);
  const device = await findOwnedDevice(req.user._id, deviceId);

  if (!device) {
    return res.status(404).json({
      message: "Device not found",
    });
  }

  const files = await fileModel
    .find({
      user: req.user._id,
      deviceId,
      parentPath,
    })
    .sort({ itemType: 1, fileName: 1 });

  res.status(200).json({
    device: {
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      sharedFolderName: device.sharedFolderName,
    },
    path: parentPath,
    files: files.map(formatFile),
  });
}

async function syncDeviceFilesController(req, res) {
  const { deviceId } = req.params;
  const { files } = req.body;
  const device = await findOwnedDevice(req.user._id, deviceId);

  if (!device) {
    return res.status(404).json({ message: "Device not found" });
  }

  if (!Array.isArray(files)) {
    return res.status(400).json({ message: "Files must be an array" });
  }

  const incomingPaths = files.map((f) =>
    normalizePath(f.filePath || f.path || f.fileName),
  );

  // Remove files that no longer exist in the folder
  await fileModel.deleteMany({
    user: req.user._id,
    deviceId,
    ...(incomingPaths.length > 0 ? { filePath: { $nin: incomingPaths } } : {}),
  });

  if (files.length > 0) {
    const operations = files.map((file) => {
      const filePath = normalizePath(file.filePath || file.path || file.fileName);
      return {
        updateOne: {
          filter: { user: req.user._id, deviceId, filePath },
          update: {
            $set: {
              fileName: file.fileName || file.name,
              filePath,
              parentPath: normalizePath(file.parentPath || getParentPath(filePath)),
              itemType: file.itemType === "folder" ? "folder" : "file",
              sizeBytes: Number(file.sizeBytes || 0),
              mimeType: file.mimeType || null,
              modifiedAt: file.modifiedAt ? new Date(file.modifiedAt) : new Date(),
            },
          },
          upsert: true,
        },
      };
    });
    await fileModel.bulkWrite(operations, { ordered: false });
  }

  res.status(200).json({
    message: "File metadata synced successfully",
    syncedCount: files.length,
  });
}

async function createPreviewFilesController(req, res) {
  const { deviceId } = req.params;
  const device = await findOwnedDevice(req.user._id, deviceId);

  if (!device) {
    return res.status(404).json({
      message: "Device not found",
    });
  }

  // Temporary seed data for the website while the Windows scanner is not built.
  // The desktop app will replace this by calling the sync endpoint with real files.
  const previewFiles = [
    {
      fileName: "Documents",
      filePath: "/Documents",
      itemType: "folder",
      sizeBytes: 0,
    },
    {
      fileName: "Project Plan.pdf",
      filePath: "/Project Plan.pdf",
      itemType: "file",
      sizeBytes: 2_400_000,
      mimeType: "application/pdf",
    },
    {
      fileName: "Budget.xlsx",
      filePath: "/Budget.xlsx",
      itemType: "file",
      sizeBytes: 860_000,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  ];

  await fileModel.bulkWrite(
    previewFiles.map((file) => ({
      updateOne: {
        filter: {
          user: req.user._id,
          deviceId,
          filePath: file.filePath,
        },
        update: {
          $set: {
            ...file,
            parentPath: getParentPath(file.filePath),
            modifiedAt: new Date(),
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );

  res.status(201).json({
    message: "File index created",
    syncedCount: previewFiles.length,
  });
}

module.exports = {
  listDeviceFilesController,
  syncDeviceFilesController,
  createPreviewFilesController,
};
