const express = require("express");
const deviceRouter = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const deviceController = require("../controllers/device.controller");
const fileController = require("../controllers/file.controller");

deviceRouter.use(authMiddleware);

// Desktop app calls this after login/install to link the PC with the account.
deviceRouter.post("/register", deviceController.registerDeviceController);

// Website calls this to show the user's connected PCs and storage status.
deviceRouter.get("/", deviceController.listDevicesController);

// Desktop app calls this when folder size/limit changes after initial setup.
deviceRouter.patch("/:deviceId/storage", deviceController.updateDeviceStorageController);

// Website calls this to search files by name across a device.
deviceRouter.get("/:deviceId/files/search", fileController.searchDeviceFilesController);

// Website calls this to browse indexed files for a connected PC.
deviceRouter.get("/:deviceId/files", fileController.listDeviceFilesController);

// Desktop app calls this after scanning the shared folder.
deviceRouter.post("/:deviceId/files/sync", fileController.syncDeviceFilesController);

// Temporary website action until the desktop scanner exists.
deviceRouter.post("/:deviceId/files/preview", fileController.createPreviewFilesController);

// Desktop app calls this regularly so the website knows the PC is reachable.
deviceRouter.patch("/:deviceId/heartbeat", deviceController.heartbeatDeviceController);

// Website calls this when the user removes a linked PC from the dashboard.
deviceRouter.delete("/:deviceId", deviceController.unlinkDeviceController);

// Website calls this to download a file from the device via relay.
deviceRouter.get("/:deviceId/download", deviceController.downloadFileController);

// Website calls this to upload a file to the device via relay.
deviceRouter.post("/:deviceId/upload", express.raw({ type: "*/*", limit: "500mb" }), deviceController.uploadFileController);

// Website calls this to delete a file or folder from the device.
deviceRouter.delete("/:deviceId/files", fileController.deleteFileController);

// Website calls this to rename a file or folder on the device.
deviceRouter.patch("/:deviceId/files", fileController.renameItemController);

// Website calls this to move a file or folder to a different folder on the device.
deviceRouter.patch("/:deviceId/files/move", fileController.moveItemController);

// Website calls this to create a folder on the device.
deviceRouter.post("/:deviceId/mkdir", fileController.mkdirController);

module.exports = deviceRouter;
