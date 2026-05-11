const jwt = require("jsonwebtoken");
const deviceModel = require("./models/device.model");
const realtime = require("./realtime");

function getTokenFromSocket(socket) {
  const authToken = socket.handshake.auth && socket.handshake.auth.token;
  const header = socket.handshake.headers.authorization || "";
  const bearerToken = header.startsWith("Bearer ") ? header.slice(7) : null;

  // Parse PTC_Token cookie — sent automatically by the Electron desktop client
  // via socket.io-client's withCredentials: true option.
  let cookieToken = null;
  const cookieHeader = socket.handshake.headers.cookie || "";
  for (const pair of cookieHeader.split(";")) {
    const eqIndex = pair.indexOf("=");
    if (eqIndex === -1) continue;
    const key = pair.slice(0, eqIndex).trim();
    if (key === "PTC_Token") {
      cookieToken = pair.slice(eqIndex + 1).trim();
      break;
    }
  }

  return authToken || bearerToken || cookieToken;
}

function registerSocketHandlers(io) {
  io.use((socket, next) => {
    const origin = socket.handshake.headers.origin || "(none)";
    try {
      const token = getTokenFromSocket(socket);
      console.log(`[socket] auth attempt — origin: ${origin}, hasToken: ${!!token}`);

      if (!token) {
        console.log("[socket] rejected — no token");
        return next(new Error("Authentication required"));
      }

      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      console.log(`[socket] auth OK — userId: ${socket.user.id}`);
      next();
    } catch (error) {
      console.log(`[socket] auth error — ${error.message}`);
      next(new Error("Invalid authentication token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`[socket] connected — id: ${socket.id}, userId: ${socket.user.id}`);
    socket.join(`user:${socket.user.id}`);

    socket.on("device:online", async ({ deviceId }) => {
      console.log(`[socket] device:online — deviceId: ${deviceId}, userId: ${socket.user.id}`);
      if (!deviceId) {
        return;
      }

      const device = await deviceModel.findOneAndUpdate(
        {
          user: socket.user.id,
          deviceId,
        },
        {
          $set: {
            status: "online",
            lastSeen: new Date(),
          },
        },
        { new: true },
      );

      if (device) {
        socket.deviceId = deviceId;
        realtime.deviceSockets.set(deviceId, socket);
        console.log(`[socket] device registered — deviceId: ${deviceId}`);
        io.to(`user:${socket.user.id}`).emit("device:status", {
          deviceId,
          status: "online",
          lastSeen: device.lastSeen,
        });
      } else {
        console.log(`[socket] device:online — device NOT found in DB for deviceId: ${deviceId}`);
      }
    });

    socket.on("disconnect", async () => {
      console.log(`[socket] disconnected — id: ${socket.id}, deviceId: ${socket.deviceId || "(none)"}`);
      if (!socket.deviceId) {
        return;
      }

      realtime.deviceSockets.delete(socket.deviceId);

      const device = await deviceModel.findOneAndUpdate(
        {
          user: socket.user.id,
          deviceId: socket.deviceId,
        },
        {
          $set: {
            status: "offline",
            lastSeen: new Date(),
          },
        },
        { new: true },
      );

      if (device) {
        console.log(`[socket] device marked offline — deviceId: ${socket.deviceId}`);
        io.to(`user:${socket.user.id}`).emit("device:status", {
          deviceId: socket.deviceId,
          status: "offline",
          lastSeen: device.lastSeen,
        });
      }
    });
  });
}

module.exports = registerSocketHandlers;
