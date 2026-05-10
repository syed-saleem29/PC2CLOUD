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
    try {
      const token = getTokenFromSocket(socket);

      if (!token) {
        return next(new Error("Authentication required"));
      }

      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch (error) {
      next(new Error("Invalid authentication token"));
    }
  });

  io.on("connection", (socket) => {
    // Every authenticated socket (website or desktop) joins the user's room
    // so device:status events are delivered without a separate subscribe step.
    socket.join(`user:${socket.user.id}`);

    socket.on("device:online", async ({ deviceId }) => {
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
        io.to(`user:${socket.user.id}`).emit("device:status", {
          deviceId,
          status: "online",
          lastSeen: device.lastSeen,
        });
      }
    });

    socket.on("disconnect", async () => {
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
