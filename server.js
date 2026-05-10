require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const app = require("./src/app");
const connectToDb = require("./src/config/database");
const { clientOrigins } = require("./src/config/cors");
const registerSocketHandlers = require("./src/socket");
const realtime = require("./src/realtime");

const port = process.env.PORT || 7000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: clientOrigins,
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
