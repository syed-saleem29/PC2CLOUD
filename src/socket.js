const jwt = require("jsonwebtoken");
const deviceModel = require("./models/device.model");
const realtime = require("./realtime");

function getTokenFromSocket(socket) {
  const authToken = socket.handshake.auth && socket.handshake.auth.token;
  const header = socket.handshake.headers.authorization || "";
  const bearerToken = header.startsWith("Bearer ") ? header.slice(7) : null;

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
      console.log(`[socket] device:online — deviceId: ${deviceId}, socketId: ${socket.id}, userId: ${socket.user.id}`);

      if (!deviceId) {
        console.log("[socket] device:online — missing deviceId, ignoring");
        return;
      }

      try {
        // If another socket was already tracking this device, log it (zombie replacement)
        const prevSocket = realtime.deviceSockets.get(deviceId);
        if (prevSocket && prevSocket.id !== socket.id) {
          console.log(`[socket] device:online — replacing stale socket for deviceId: ${deviceId}, oldSocketId: ${prevSocket.id}, newSocketId: ${socket.id}`);
        }

        const device = await deviceModel.findOneAndUpdate(
          { user: socket.user.id, deviceId },
          { $set: { status: "online", lastSeen: new Date() } },
          { new: true },
        );

        if (!device) {
          console.log(`[socket] device:online — device NOT found in DB — deviceId: ${deviceId}, userId: ${socket.user.id}`);
          return;
        }

        socket.deviceId = deviceId;
        realtime.deviceSockets.set(deviceId, socket);

        console.log(`[socket] device online — deviceId: ${deviceId}, activeSocketId: ${socket.id}`);

        io.to(`user:${socket.user.id}`).emit("device:status", {
          deviceId,
          status: "online",
          lastSeen: device.lastSeen,
        });
      } catch (err) {
        console.error(`[socket] device:online error — deviceId: ${deviceId}, socketId: ${socket.id}, error: ${err.message}`, err);
      }
    });

    socket.on("disconnect", async (reason) => {
      console.log(`[socket] disconnected — id: ${socket.id}, reason: ${reason}, deviceId: ${socket.deviceId || "(none)"}, userId: ${socket.user.id}`);

      if (!socket.deviceId) {
        // Web dashboard or unauthenticated client — no device to update
        return;
      }

      // ZOMBIE SOCKET CHECK: if a newer socket has already registered for this
      // device, this disconnect is from a stale/old connection. Marking the device
      // offline here would override the active connection — skip it.
      const activeSocket = realtime.deviceSockets.get(socket.deviceId);
      if (activeSocket && activeSocket.id !== socket.id) {
        console.log(`[socket] zombie disconnect ignored — deviceId: ${socket.deviceId}, zombieId: ${socket.id}, activeId: ${activeSocket.id}`);
        return;
      }

      realtime.deviceSockets.delete(socket.deviceId);

      try {
        const device = await deviceModel.findOneAndUpdate(
          { user: socket.user.id, deviceId: socket.deviceId },
          { $set: { status: "offline", lastSeen: new Date() } },
          { new: true },
        );

        if (!device) {
          console.log(`[socket] disconnect — device NOT found in DB — deviceId: ${socket.deviceId}`);
          return;
        }

        console.log(`[socket] device offline — deviceId: ${socket.deviceId}, reason: ${reason}`);

        io.to(`user:${socket.user.id}`).emit("device:status", {
          deviceId: socket.deviceId,
          status: "offline",
          lastSeen: device.lastSeen,
        });
      } catch (err) {
        console.error(`[socket] disconnect error — deviceId: ${socket.deviceId}, socketId: ${socket.id}, error: ${err.message}`, err);
      }
    });
  });
}

module.exports = registerSocketHandlers;
