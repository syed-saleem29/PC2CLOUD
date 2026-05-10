const express = require('express')
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

module.exports = app
