let _io = null;

// deviceId -> live socket instance
const deviceSockets = new Map();

// requestId -> { res, timeout, inline? }
const pendingDownloads = new Map();

// requestId -> { buffer, res, timeout }
const pendingUploads = new Map();

function init(io) {
  _io = io;
}

function emitToDevice(deviceId, event, data) {
  const socket = deviceSockets.get(deviceId);
  if (!socket) return false;
  socket.emit(event, data);
  return true;
}

module.exports = { init, emitToDevice, deviceSockets, pendingDownloads, pendingUploads };
