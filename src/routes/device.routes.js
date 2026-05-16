const express = require("express");
const deviceRouter = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const deviceController = require("../controllers/device.controller");
const fileController = require("../controllers/file.controller");
const asyncHandler = require("../utils/asyncHandler");
const { apiLimiter, downloadLimiter, uploadLimiter } = require("../middlewares/rateLimit.middleware");

deviceRouter.use(authMiddleware);
deviceRouter.use(apiLimiter);

deviceRouter.post("/register", asyncHandler(deviceController.registerDeviceController));
deviceRouter.get("/", asyncHandler(deviceController.listDevicesController));
deviceRouter.patch("/:deviceId/storage", asyncHandler(deviceController.updateDeviceStorageController));
deviceRouter.get("/:deviceId/files/search", asyncHandler(fileController.searchDeviceFilesController));
deviceRouter.get("/:deviceId/files", asyncHandler(fileController.listDeviceFilesController));
deviceRouter.post("/:deviceId/files/sync", asyncHandler(fileController.syncDeviceFilesController));
deviceRouter.post("/:deviceId/files/preview", asyncHandler(fileController.createPreviewFilesController));
deviceRouter.patch("/:deviceId/heartbeat", asyncHandler(deviceController.heartbeatDeviceController));
deviceRouter.delete("/:deviceId", asyncHandler(deviceController.unlinkDeviceController));
deviceRouter.get("/:deviceId/download", downloadLimiter, asyncHandler(deviceController.downloadFileController));
deviceRouter.post("/:deviceId/upload", uploadLimiter, express.raw({ type: "*/*", limit: "500mb" }), asyncHandler(deviceController.uploadFileController));
deviceRouter.delete("/:deviceId/files", asyncHandler(fileController.deleteFileController));
deviceRouter.patch("/:deviceId/files", asyncHandler(fileController.renameItemController));
deviceRouter.patch("/:deviceId/files/move", asyncHandler(fileController.moveItemController));
deviceRouter.post("/:deviceId/mkdir", asyncHandler(fileController.mkdirController));

module.exports = deviceRouter;
