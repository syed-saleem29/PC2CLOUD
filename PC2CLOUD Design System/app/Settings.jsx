function Settings({ user, theme, onThemeChange }) {
  const { useState } = React;
  const [emailNotif, setEmailNotif] = useState(true);
  const [transferNotif, setTransferNotif] = useState(false);
  const [autoSync, setAutoSync] = useState(true);

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <div>
          <h2>Settings</h2>
          <p>Customize your account and preferences.</p>
        </div>
      </div>

      <div className="settings-section">
        <h3>Profile</h3>
        <p className="caption">Your account details.</p>
        <div style={{ display: "flex", gap: 20, alignItems: "center", marginBottom: 20 }}>
          <span className="avatar" style={{ width: 64, height: 64, fontSize: 24, borderRadius: "var(--r-lg)" }}>
            {(user?.userName || "?").slice(0, 1).toUpperCase()}
          </span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{user?.userName || "User"}</div>
            <div className="caption">{user?.userEmail}</div>
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 10 }}>Change avatar</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="field">
            <label>Display name</label>
            <input className="input" defaultValue={user?.userName} />
          </div>
          <div className="field">
            <label>Email</label>
            <input className="input" defaultValue={user?.userEmail} />
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>Appearance</h3>
        <p className="caption">PC2CLOUD follows your system theme by default. Click the icon in the top bar to override.</p>
        <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-name">Theme</div>
            <div className="settings-row-desc">
              {theme === "system" && "Following your system preference."}
              {theme === "light" && "Manually set to light mode."}
              {theme === "dark" && "Manually set to dark mode."}
            </div>
          </div>
          <button className="btn btn-secondary btn-sm"
            onClick={() => onThemeChange(theme === "system" ? "light" : theme === "light" ? "dark" : "system")}>
            <ReactIcon name={theme === "system" ? "monitor" : theme === "dark" ? "moon" : "sun"} size={13} />
            {theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light"}
            <ReactIcon name="chevrondown" size={11} color="var(--fg-subtle)" />
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3>Notifications</h3>
        <p className="caption">When PC2CLOUD should ping you.</p>
        <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-name">Email summaries</div>
            <div className="settings-row-desc">Weekly storage and activity recap.</div>
          </div>
          <button className={`toggle${emailNotif ? " on" : ""}`} onClick={() => setEmailNotif((v) => !v)}></button>
        </div>
        <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-name">Transfer notifications</div>
            <div className="settings-row-desc">Desktop alerts when large transfers finish.</div>
          </div>
          <button className={`toggle${transferNotif ? " on" : ""}`} onClick={() => setTransferNotif((v) => !v)}></button>
        </div>
      </div>

      <div className="settings-section">
        <h3>Sync</h3>
        <p className="caption">How files move between devices.</p>
        <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-name">Auto-sync on change</div>
            <div className="settings-row-desc">Push changes the moment your folder updates.</div>
          </div>
          <button className={`toggle${autoSync ? " on" : ""}`} onClick={() => setAutoSync((v) => !v)}></button>
        </div>
        <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-name">Sync frequency</div>
            <div className="settings-row-desc">When auto-sync is off.</div>
          </div>
          <div className="seg">
            <button className="active">5 min</button>
            <button>15 min</button>
            <button>1 hr</button>
          </div>
        </div>
      </div>

      <div className="settings-section" style={{ borderColor: "var(--danger-border)" }}>
        <h3 style={{ color: "var(--danger)" }}>Danger zone</h3>
        <p className="caption">Irreversible account actions.</p>
        <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-name">Export account data</div>
            <div className="settings-row-desc">Download all device metadata and file listings as JSON.</div>
          </div>
          <button className="btn btn-secondary btn-sm">Export</button>
        </div>
        <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-name">Delete account</div>
            <div className="settings-row-desc">All linked devices will be unlinked. Files on your PCs are untouched.</div>
          </div>
          <button className="btn btn-danger btn-sm">Delete account</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Settings });
