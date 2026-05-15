function DesktopReady({ onDisconnect }) {
  const { useState } = React;
  const [syncStatus, setSyncStatus] = useState("done");
  const transfers = [
    { id: "t1", name: "photos-october.zip",  type: "upload",   percent: 64, status: "active" },
    { id: "t2", name: "old-drafts/",         type: "delete",   percent: null, status: "active" },
  ];

  function syncNow() {
    setSyncStatus("syncing");
    setTimeout(() => setSyncStatus("done"), 1200);
  }

  function syncLabel() {
    if (syncStatus === "syncing") return "Syncing…";
    if (syncStatus === "error") return "Sync failed · retry";
    return `Synced ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
      <div className="status-orb">
        <span className="status-orb-inner">
          <ReactIcon name="monitor" size={36} strokeWidth={1.5} />
        </span>
        <span className="status-pulse">
          <span className="status-pulse-ring"></span>
          <span className="status-pulse-dot"></span>
        </span>
      </div>

      <div style={{ textAlign: "center" }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>PC is connected</h2>
        <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: "6px 0 0", lineHeight: 1.5 }}>
          PC2CLOUD is running in the background.<br />Access your files from any device.
        </p>
      </div>

      <button className={`sync-pill ${syncStatus === "error" ? "error" : ""}`} onClick={syncNow}>
        <ReactIcon name="refresh" size={11} className={syncStatus === "syncing" ? "anim-spin" : ""} />
        {syncLabel()}
      </button>

      {transfers.length > 0 && (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8, maxWidth: 320 }}>
          {transfers.map((t) => (
            <div key={t.id} className="d-transfer"
              style={t.type === "delete" ? {
                borderColor: "var(--warning-border)",
                background: "var(--warning-bg)",
              } : {}}>
              <div className="d-transfer-head">
                <ReactIcon name={t.type === "delete" ? "trash" : "upload"} size={12}
                  color={t.type === "delete" ? "var(--warning)" : "var(--brand-600)"} />
                <span className="d-transfer-name mono" style={{ fontSize: 11 }}>{t.name}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: t.type === "delete" ? "var(--warning)" : "var(--brand-600)" }}>
                  {t.percent != null ? `${t.percent}%` : "Deleting…"}
                </span>
              </div>
              <div className="bar" style={{ height: 3, background: t.type === "delete" ? "rgba(217, 119, 6, 0.15)" : "rgba(37, 99, 235, 0.15)" }}>
                <div style={{
                  width: t.percent != null ? `${t.percent}%` : "100%",
                  background: t.type === "delete" ? "var(--warning)" : "var(--brand-600)",
                  animation: t.type === "delete" ? "pulse 1.4s ease-in-out infinite" : undefined,
                }}></div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        <button className="btn btn-primary"
          style={{ borderRadius: 12, boxShadow: "0 6px 20px -4px rgba(37, 99, 235, 0.40)" }}>
          <ReactIcon name="arrowupright" size={14} /> Open Dashboard
        </button>
        <button className="btn btn-secondary" style={{ borderRadius: 12 }}>
          <ReactIcon name="minus" size={14} /> Minimize to tray
        </button>
        <button className="btn btn-ghost" onClick={onDisconnect} style={{ borderRadius: 12 }}>
          <ReactIcon name="unplug" size={14} /> Disconnect this PC
        </button>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
}

Object.assign(window, { DesktopReady });
