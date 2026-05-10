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

module.exports = deviceRouter;
