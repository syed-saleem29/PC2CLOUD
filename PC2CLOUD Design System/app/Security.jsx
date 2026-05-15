function Security({ devices }) {
  const sessions = [
    { id: "s1", label: "Chrome on macOS",  city: "Bangalore, India", ip: "203.0.113.42",  current: true,  ago: "Now" },
    { id: "s2", label: "Safari on iPhone", city: "Bangalore, India", ip: "203.0.113.42",  current: false, ago: "2 hours ago" },
    { id: "s3", label: "PC2CLOUD Desktop", city: "Bangalore, India", ip: "192.168.1.18",  current: false, ago: "3 days ago" },
  ];

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <div>
          <h2>Security</h2>
          <p>Manage devices, active sessions, and authentication.</p>
        </div>
      </div>

      <div className="settings-section">
        <h3>Two-factor authentication</h3>
        <p className="caption">An extra layer of security for your account.</p>
        <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-name">Email codes</div>
            <div className="settings-row-desc">A 6-digit code is sent to <span className="mono">syed@pc2cloud.io</span> for sensitive actions.</div>
          </div>
          <span className="chip chip-success"><span className="dot"></span>Enabled</span>
        </div>
        <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-name">Authenticator app</div>
            <div className="settings-row-desc">TOTP via Google Authenticator, 1Password, etc.</div>
          </div>
          <button className="btn btn-secondary btn-sm">Set up</button>
        </div>
      </div>

      <div className="settings-section">
        <h3>Active sessions</h3>
        <p className="caption">Browsers and apps currently signed into your account.</p>
        {sessions.map((s) => (
          <div key={s.id} className="settings-row">
            <div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1 }}>
              <span className="stat-icon"><ReactIcon name="globe" size={15} /></span>
              <div className="settings-row-info">
                <div className="settings-row-name">{s.label} {s.current && <span className="chip chip-brand" style={{ marginLeft: 6 }}>This device</span>}</div>
                <div className="settings-row-desc">{s.city} · <span className="mono">{s.ip}</span> · {s.ago}</div>
              </div>
            </div>
            {!s.current && <button className="btn btn-ghost btn-sm">Revoke</button>}
          </div>
        ))}
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
          <button className="btn btn-danger btn-sm">
            <ReactIcon name="logout" size={13} /> Sign out all other sessions
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3>Linked devices</h3>
        <p className="caption">PCs running the PC2CLOUD desktop client.</p>
        {devices.map((d) => (
          <div key={d.deviceId} className="settings-row">
            <div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1 }}>
              <span className="stat-icon"><ReactIcon name="computer" size={15} /></span>
              <div className="settings-row-info">
                <div className="settings-row-name">{d.deviceName}</div>
                <div className="settings-row-desc">{d.platform} · last seen {formatRelative(d.lastSeen)}</div>
              </div>
            </div>
            <span className={`chip ${d.status === "online" ? "chip-success" : ""}`}>
              <span className="dot"></span>{d.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { Security });
