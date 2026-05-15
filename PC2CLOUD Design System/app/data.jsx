/* Fake data + helpers for the dashboard demo */
const DEVICES = [
  {
    deviceId: "d1", deviceName: "Studio Desktop", platform: "Windows 11",
    sharedFolderName: "PC2CLOUD", sharedFolderPath: "D:\\Storage\\PC2CLOUD",
    status: "online",
    usedStorageBytes:  184 * 1024 ** 3,
    storageLimitBytes: 500 * 1024 ** 3,
    lastSeen: "2026-05-13T14:22:00Z",
  },
  {
    deviceId: "d2", deviceName: "Old Office Tower", platform: "Windows 10",
    sharedFolderName: "PC2CLOUD", sharedFolderPath: "C:\\Users\\Syed\\PC2CLOUD",
    status: "online",
    usedStorageBytes:  42 * 1024 ** 3,
    storageLimitBytes: 500 * 1024 ** 3,
    lastSeen: "2026-05-13T13:14:00Z",
  },
  {
    deviceId: "d3", deviceName: "Living-Room HTPC", platform: "Windows 11",
    sharedFolderName: "Media", sharedFolderPath: "E:\\Media\\PC2CLOUD",
    status: "offline",
    usedStorageBytes:  1.2 * 1024 ** 4,
    storageLimitBytes: 0.4 * 1024 ** 4,
    lastSeen: "2026-05-12T22:08:00Z",
  },
];

const FILES = [
  { id: "fo1", name: "Documents",   path: "/Documents",   type: "folder", size: 0, mime: null, modified: "2026-04-22T09:10:00Z" },
  { id: "fo2", name: "Photos",      path: "/Photos",      type: "folder", size: 0, mime: null, modified: "2026-05-02T17:31:00Z" },
  { id: "fo3", name: "Music",       path: "/Music",       type: "folder", size: 0, mime: null, modified: "2026-03-30T11:08:00Z" },
  { id: "fo4", name: "Projects",    path: "/Projects",    type: "folder", size: 0, mime: null, modified: "2026-05-10T12:00:00Z" },
  { id: "f1",  name: "notes.md",                 path: "/notes.md",                 type: "file", size: 3 * 1024,            mime: "text/markdown",       modified: "2026-05-11T08:08:00Z" },
  { id: "f2",  name: "tax-return-2024.pdf",      path: "/tax-return-2024.pdf",      type: "file", size: 824 * 1024,          mime: "application/pdf",     modified: "2026-04-12T14:42:00Z" },
  { id: "f3",  name: "IMG_0421.jpg",             path: "/IMG_0421.jpg",             type: "file", size: 2.3 * 1024 ** 2,     mime: "image/jpeg",          modified: "2026-05-09T19:30:00Z" },
  { id: "f4",  name: "shoot-raw.zip",            path: "/shoot-raw.zip",            type: "file", size: 14.3 * 1024 ** 3,    mime: "application/zip",     modified: "2026-05-13T11:00:00Z" },
  { id: "f5",  name: "demo.mp4",                 path: "/demo.mp4",                 type: "file", size: 138 * 1024 ** 2,     mime: "video/mp4",           modified: "2026-05-10T15:21:00Z" },
  { id: "f6",  name: "presentation-final.pptx",  path: "/presentation-final.pptx",  type: "file", size: 4.2 * 1024 ** 2,     mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", modified: "2026-05-08T16:15:00Z" },
];

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes >= 1024 ** 4) return `${(bytes / 1024 ** 4).toFixed(2)} TB`;
  if (bytes >= 1024 ** 3) { const g = bytes / 1024 ** 3; return `${g.toFixed(g >= 10 ? 0 : 1)} GB`; }
  if (bytes >= 1024 ** 2) { const m = bytes / 1024 ** 2; return `${m.toFixed(m >= 10 ? 0 : 1)} MB`; }
  if (bytes >= 1024)       return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
function formatBytesPair(used, free) { return [formatBytes(used), formatBytes(used + free)]; }
function formatDate(iso) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
function formatRelative(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const s = ms / 1000;
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s/60)} min ago`;
  if (s < 86400) return `${Math.floor(s/3600)} hr ago`;
  return `${Math.floor(s/86400)} d ago`;
}
function fileIconFor(file) {
  if (file.type === "folder") return { name: "folder", cls: "file-icon-folder" };
  const m = file.mime || "";
  if (m.startsWith("image/")) return { name: "fileimage", cls: "file-icon-image" };
  if (m.startsWith("video/")) return { name: "file", cls: "file-icon-video" };
  if (m === "application/zip") return { name: "file", cls: "file-icon-archive" };
  return { name: "filetext", cls: "file-icon-doc" };
}

Object.assign(window, { DEVICES, FILES, formatBytes, formatBytesPair, formatDate, formatRelative, fileIconFor });
