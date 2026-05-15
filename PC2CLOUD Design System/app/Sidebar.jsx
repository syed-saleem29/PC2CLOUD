function Sidebar({ section, onChange, user, onLogout, onlineCount, totalDevices }) {
  const items = [
    { id: "devices",  label: "Devices",  icon: "computer",    badge: totalDevices },
    { id: "storage",  label: "Storage",  icon: "harddrive" },
    { id: "activity", label: "Activity", icon: "activity" },
    { id: "security", label: "Security", icon: "shieldcheck" },
  ];
  const settings = [
    { id: "settings", label: "Settings", icon: "settings" },
    { id: "help",     label: "Help",     icon: "globe" },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Logo />
      </div>

      <div className="sidebar-section">
        {items.map((it) => (
          <button key={it.id}
            className={`nav-item${section === it.id ? " active" : ""}`}
            onClick={() => onChange(it.id)}>
            <ReactIcon name={it.icon} size={15} />
            {it.label}
            {it.badge != null && <span className="nav-item-end mono">{it.badge}</span>}
          </button>
        ))}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Settings</div>
        {settings.map((it) => (
          <button key={it.id}
            className={`nav-item${section === it.id ? " active" : ""}`}
            onClick={() => onChange(it.id)}>
            <ReactIcon name={it.icon} size={15} />
            {it.label}
          </button>
        ))}
      </div>

      <div className="sidebar-foot">
        <div style={{
          padding: "12px",
          background: "linear-gradient(135deg, var(--brand-50), var(--bg-elevated))",
          border: "1px solid var(--brand-100)",
          borderRadius: "var(--r-md)",
          marginBottom: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: "var(--brand-700)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
            <ReactIcon name="sparkles" size={11} /> Upgrade
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>Try Pro for free</div>
          <div style={{ fontSize: 11, color: "var(--fg-muted)", marginBottom: 8 }}>
            Multi-device, relay acceleration, snapshots.
          </div>
          <button className="btn btn-primary btn-sm" style={{ width: "100%" }}>
            Start trial
          </button>
        </div>

        <button className="sidebar-user" onClick={onLogout} title="Sign out">
          <span className="avatar">{(user?.userName || "?").slice(0, 1).toUpperCase()}</span>
          <span className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.userName || "User"}</span>
            <span className="sidebar-user-mail">{user?.userEmail}</span>
          </span>
          <ReactIcon name="logout" size={14} color="var(--fg-subtle)" />
        </button>
      </div>
    </aside>
  );
}

Object.assign(window, { Sidebar });
