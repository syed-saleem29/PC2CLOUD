require("dotenv").config();
// Force all DNS lookups to prefer IPv4 — required on Render free tier (no IPv6 outbound)
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");
const http = require("http");
const { Server } = require("socket.io");
const app = require("./src/app");
const connectToDb = require("./src/config/database");
const { corsOptions } = require("./src/config/cors");
const registerSocketHandlers = require("./src/socket");
const realtime = require("./src/realtime");

const port = process.env.PORT || 7000;
const server = http.createServer(app);
const io = new Server(server, {
  // Detect stale connections faster: default pingInterval=25s + pingTimeout=20s = ~45s.
  // With these values a force-killed client is detected in ~18s instead.
  pingInterval: 10000,
  pingTimeout: 8000,
  cors: {
    // Accept any origin — connections are secured by JWT middleware in socket.js.
    // The Electron desktop app connects from a file:// context where Chromium sends
    // an opaque origin that varies by platform; allowing all origins here is safe
    // because unauthenticated sockets are rejected in the io.use() middleware.
    origin: (origin, cb) => {
      console.log(`[socket.io cors] origin: ${origin || "(none)"}`);
      cb(null, true);
    },
    credentials: true,
  },
});

realtime.init(io);
registerSocketHandlers(io);

async function startServer() {
  await connectToDb();

  server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
