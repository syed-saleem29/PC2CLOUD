const express = require('express')
const path = require('path')
const app = express()

const cors = require('cors')
const cookieParser = require('cookie-parser')
const { corsOptions } = require("./config/cors")
const authRouter = require("./routes/auth.routes")
const deviceRouter = require("./routes/device.routes")
const transferRouter = require("./routes/transfer.routes")

app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())

app.use("/api/auth",authRouter)
app.use("/api/devices", deviceRouter)
app.use("/api/transfer", transferRouter)

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

module.exports = app
