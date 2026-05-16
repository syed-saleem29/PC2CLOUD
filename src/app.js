const express = require('express')
const path = require('path')
const app = express()

const cors = require('cors')
const cookieParser = require('cookie-parser')
const { corsOptions } = require("./config/cors")
const authRouter = require("./routes/auth.routes")
const deviceRouter = require("./routes/device.routes")
const transferRouter = require("./routes/transfer.routes")
const auditRouter = require("./routes/audit.routes")
const subscriptionRouter = require("./routes/subscription.routes")

// Trust the first proxy hop so req.ip reflects the real client IP behind nginx/Cloudflare
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())

// Security headers applied to every response
app.use((req, res, next) => {
  // Force HTTPS in production
  if (process.env.NODE_ENV === "production" && !req.secure) {
    return res.redirect(301, `https://${req.get("host")}${req.url}`);
  }
  // Tell browsers to never connect over plain HTTP
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  // Block MIME sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

app.get("/", (req, res) => res.json({ status: "ok" }))

app.use("/api/auth",authRouter)
app.use("/api/devices", deviceRouter)
app.use("/api/transfer", transferRouter)
app.use("/api/audit", auditRouter)
app.use("/api/subscription", subscriptionRouter)

// Serve installer files for download + auto-updater
app.use("/releases", express.static(path.join(__dirname, "../releases"), {
  setHeaders(res, filePath) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    if (filePath.endsWith(".exe")) {
      res.setHeader("Content-Disposition", `attachment; filename="${path.basename(filePath)}"`);
    }
  },
}))

// Latest version info used by the desktop app's update check
app.get("/api/releases/latest", (req, res) => {
  const fs = require('fs')
  const yamlPath = path.join(__dirname, "../releases/latest.yml")
  try {
    const raw = fs.readFileSync(yamlPath, "utf-8")
    const versionMatch = raw.match(/^version:\s*(.+)$/m)
    const fileMatch = raw.match(/^path:\s*(.+)$/m)
    const version = versionMatch?.[1]?.trim()
    const fileName = fileMatch?.[1]?.trim()
    res.json({ version, downloadUrl: fileName ? `/releases/${encodeURIComponent(fileName)}` : null })
  } catch {
    res.status(404).json({ message: "No release found" })
  }
})

// Global JSON error handler — must be last, after all routes
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal server error";
  res.status(status).json({ message });
});

module.exports = app
