# PC2CLOUD — Known Issues Log

A reference for recurring bugs, their root causes, and how they were fixed.
Check here first whenever a bug feels familiar.

---

## 1. Device Always Shows "Online" — Never Goes Offline

**Symptom:** Dashboard shows device as online even after the desktop app is closed, reinstalled, or disconnected. Persists indefinitely.

**This happened ~10–15 times. Multiple causes layered together:**

### Cause A: Heartbeat was setting `status: "online"` in DB

The `/api/devices/:deviceId/heartbeat` route was updating `{ status: "online", lastSeen }` on every heartbeat ping. If the socket then failed to connect for any reason, the heartbeat had already written `online` to the DB — but `device:online` was never emitted over the socket, so `socket.deviceId` was never set, and the disconnect handler would return early without marking offline.

**Fix:** Removed `status: "online"` from `heartbeatDeviceController`. Only the socket `device:online` event may set the device online.
File: `src/controllers/device.controller.js`

---

### Cause B: Socket `disconnect` handler gated on `socket.deviceId`

The server's disconnect handler has an early return: `if (!socket.deviceId) return`. `socket.deviceId` is only set when `device:online` is received from the client. If the socket is rejected at auth (no token, bad token), `device:online` is never received → `socket.deviceId` is never set → disconnect returns early → device stays in whatever state the DB had it.

**Fix:** This is working as designed once token auth works correctly. The real fix was ensuring the socket always connects with a valid token (see Issue #3 below).

---

### Cause C: Zombie socket marks device offline while new socket is active

When the desktop app restarts quickly (e.g., reinstall), the old socket connection lingers on the server for ~45 seconds until the ping timeout fires. When that zombie socket finally fires `disconnect`, it marks the device offline — even though a new socket already took over and the device is actually online.

**Fix:** Zombie socket check in the disconnect handler:
```javascript
const activeSocket = realtime.deviceSockets.get(socket.deviceId);
if (activeSocket && activeSocket.id !== socket.id) {
  // This is a stale socket — a newer socket took over. Skip offline marking.
  return;
}
```
Also reduced ping interval from 25s→10s and ping timeout from 20s→8s so stale connections are detected in ~18s instead of ~45s.
Files: `src/socket.js`, `server.js`

---

### Cause D: Desktop app exits before disconnect packet flushes

The `before-quit` handler was calling `socket.disconnect()` then immediately letting the process exit. The OS could kill the process before the TCP packet actually sent. Server never receives the disconnect → never marks offline.

**Fix:** `event.preventDefault()` in `before-quit` + wait for the socket's own `disconnect` event (which fires after the packet is sent) before calling `app.quit()`. 2-second fallback in case server is unreachable.
File: `apps/desktop/src/main/index.ts`

---

### Cause E: Folder missing — socket not disconnected

When the PC2CLOUD folder is deleted, the app detects `folder:missing` and switches to the re-pick screen — but did NOT disconnect the socket. Device stayed online until app was manually closed.

**Fix:** Added `ipc().invoke("socket:disconnect")` in the `missingHandler` inside `App.tsx`.
File: `apps/desktop/src/App.tsx`

---

## 2. Desktop Socket Rejected — "No Token" / `hasToken: false`

**Symptom:** Server logs show `[socket] auth attempt — origin: (none), hasToken: false` then `[socket] rejected — no token`. Device never goes online. No errors shown in UI.

**Cause:** A `before-quit` fix attempted to clear `authToken` from the config file on app exit (intended to force re-login on reinstall). On next launch, `config.authToken` was gone → `setToken()` was not called → `getToken()` returned `""` → socket connected with `auth: { token: "" }` → server rejected.

**Fix:** Removed `authToken` clearing from `before-quit`. The token should persist in config for the next launch so the socket can authenticate.
File: `apps/desktop/src/main/index.ts`

**How to diagnose:** Add `console.log` to server's socket middleware — log `origin` and `hasToken`. If `hasToken: false`, the problem is on the client side (token not stored or not passed).

---

## 3. Auto-Login on Fresh Reinstall

**Symptom:** After reinstalling the desktop app, the user is automatically logged in without entering a password.

**Cause:** Windows installers do NOT clear `AppData/Roaming/<AppName>` by default. The config file (`pc2cloud.json`) with `authToken` and `deviceId` persists through reinstalls.

**Current status:** This is a known limitation — not yet fixed. To properly fix, the installer would need to wipe AppData on install, or the app would need to detect a "fresh install" via a version stamp.

---

## 4. CSS Color Variables Used Without `hsl()` Wrapper

**Symptom:** `.dot`, `.chip-success`, `.btn-danger`, etc. show as transparent or wrong color. Status dots appear black/transparent instead of green/red.

**Cause:** The design system in `globals.css` defines tokens like:
```css
--success: 142 72% 29%;
--danger: 0 72% 51%;
```
These are raw HSL channel values (Tailwind-style), **not valid CSS color values**. Using them directly as `color: var(--success)` renders as an invalid color (transparent/black). They must be wrapped: `color: hsl(var(--success))`.

**Fix:** Audited all 9 usages in `app.css` and wrapped every `var(--success/danger/warning)` used as a color with `hsl()`.
```css
/* Wrong */
background: var(--success);
/* Right */
background: hsl(var(--success));
```
Files: `apps/web/src/app/app.css`

---

## 5. Async Express Route Errors Swallowed Silently

**Symptom:** A backend error causes a request to hang indefinitely with no response, or causes an unhandled promise rejection warning in logs — no error sent to client.

**Cause:** Express 4 does not automatically catch errors thrown from `async` route handlers. If an async handler throws, Express never calls `next(err)`, so the global error handler is never reached.

**Fix:** Created `asyncHandler` wrapper and applied it to all routes:
```javascript
function asyncHandler(fn) {
  return (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch((err) => {
      console.error(`[route error] ${req.method} ${req.path} — ${err.message}`, err);
      next(err);
    });
}
```
Files: `src/utils/asyncHandler.js`, `src/routes/auth.routes.js`, `src/routes/device.routes.js`

---

## 6. Sidebar Footer Buttons Overlapping User Email

**Symptom:** Theme toggle and logout button overlap with the logged-in user's email text in the sidebar footer.

**Cause:** `.sidebar-user-info` was an inline `<span>`. Its children `.sidebar-user-name` and `.sidebar-user-mail` needed block-level layout for `text-overflow: ellipsis` to work, but the inline container collapsed.

**Fix:** Added `display: flex; flex-direction: column` to `.sidebar-user-info`.
File: `apps/web/src/app/app.css`

---

## Debugging Checklist for "Device Always Online"

When the device won't go offline, check in this order:

1. **Server logs**: Does `[socket] device:online` appear when the app connects? If not → socket auth failed (check `hasToken`).
2. **Server logs on quit**: Does `[socket] device offline` appear? If not → disconnect packet not reaching server (before-quit issue or network).
3. **Zombie check**: Does `[socket] zombie disconnect ignored` appear? If so → zombie race condition (the fix should handle this).
4. **DB state**: Is `device.status` already `"online"` in DB before socket connects? → heartbeat bug (check if status:online was re-added to heartbeat).
5. **Token**: Check `pc2cloud.json` in `%AppData%\Roaming\PC2CLOUD\` — does it have `authToken`?
