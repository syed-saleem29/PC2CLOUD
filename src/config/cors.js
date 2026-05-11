const defaultClientOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8000",
];

function getClientOrigins() {
  if (!process.env.CLIENT_ORIGIN) {
    return defaultClientOrigins;
  }

  return process.env.CLIENT_ORIGIN.split(",").map((origin) => origin.trim());
}

const clientOrigins = getClientOrigins();

const corsOptions = {
  origin(origin, callback) {
    // Allow: no origin (server-to-server / curl), the string "null" (Chromium/Electron
    // file:// renderer sends this literal string), or an explicitly allowed origin.
    if (!origin || origin === "null" || clientOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

module.exports = {
  clientOrigins,
  corsOptions,
};
