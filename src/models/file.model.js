const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true,
    },
    deviceId: {
      type: String,
      required: true,
      index: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    // Paths are stored relative to the PC2CLOUD shared folder, not as full
    // Windows paths. Example: /Projects/report.pdf
    filePath: {
      type: String,
      required: true,
    },
    parentPath: {
      type: String,
      default: "/",
      index: true,
    },
    itemType: {
      type: String,
      enum: ["file", "folder"],
      default: "file",
      index: true,
    },
    sizeBytes: {
      type: Number,
      default: 0,
      min: 0,
    },
    mimeType: {
      type: String,
      default: null,
    },
    modifiedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

fileSchema.index({ user: 1, deviceId: 1, filePath: 1 }, { unique: true });
fileSchema.index({ user: 1, deviceId: 1, parentPath: 1, itemType: 1 });

const fileModel = mongoose.model("files", fileSchema);

module.exports = fileModel;
