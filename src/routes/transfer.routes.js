const express = require("express");
const transferRouter = express.Router();
const realtime = require("../realtime");

// Desktop POSTs raw file bytes here after receiving a file:request socket event.
// The requestId acts as a one-time bearer token — only the desktop knows it.
transferRouter.post("/:requestId", express.raw({ type: "*/*", limit: "500mb" }), (req, res) => {
  const pending = realtime.pendingDownloads.get(req.params.requestId);
  if (!pending) {
    return res.status(404).json({ message: "Request expired or not found" });
  }

  clearTimeout(pending.timeout);
  realtime.pendingDownloads.delete(req.params.requestId);

  const rawName = req.headers["x-file-name"] || "download";
  const mimeType = req.headers["x-mime-type"] || "application/octet-stream";
  const disposition = pending.inline ? "inline" : "attachment";

  if (!pending.res.headersSent) {
    pending.res.setHeader("Content-Disposition", `${disposition}; filename="${encodeURIComponent(rawName)}"`);
    pending.res.setHeader("Content-Type", mimeType);
    pending.res.setHeader("Content-Length", req.body.length);
    pending.res.end(req.body);
  }

  res.status(200).json({ ok: true });
});

// Desktop reports it could not read the file.
transferRouter.post("/:requestId/error", express.json(), (req, res) => {
  const pending = realtime.pendingDownloads.get(req.params.requestId);
  if (!pending) return res.status(404).json({ message: "Request not found" });

  clearTimeout(pending.timeout);
  realtime.pendingDownloads.delete(req.params.requestId);

  if (!pending.res.headersSent) {
    pending.res.status(502).json({ message: req.body?.message || "Device could not read file" });
  }

  res.status(200).json({ ok: true });
});

// Desktop fetches the buffered upload bytes.
transferRouter.get("/:requestId/content", (req, res) => {
  const pending = realtime.pendingUploads.get(req.params.requestId);
  if (!pending) return res.status(404).json({ message: "Upload not found" });

  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Length", pending.buffer.length);
  res.end(pending.buffer);
});

// Desktop confirms it wrote the file successfully.
transferRouter.post("/:requestId/write-done", express.json(), (req, res) => {
  const pending = realtime.pendingUploads.get(req.params.requestId);
  if (!pending) return res.status(404).json({ message: "Upload not found" });

  clearTimeout(pending.timeout);
  realtime.pendingUploads.delete(req.params.requestId);

  if (!pending.res.headersSent) {
    pending.res.status(200).json({ message: "File uploaded successfully" });
  }

  res.status(200).json({ ok: true });
});

// Desktop reports it could not write the file.
transferRouter.post("/:requestId/write-error", express.json(), (req, res) => {
  const pending = realtime.pendingUploads.get(req.params.requestId);
  if (!pending) return res.status(404).json({ message: "Upload not found" });

  clearTimeout(pending.timeout);
  realtime.pendingUploads.delete(req.params.requestId);

  if (!pending.res.headersSent) {
    pending.res.status(502).json({ message: req.body?.message || "Device could not write file" });
  }

  res.status(200).json({ ok: true });
});

module.exports = transferRouter;
