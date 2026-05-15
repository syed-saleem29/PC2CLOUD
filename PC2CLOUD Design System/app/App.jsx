function App() {
  const { useState, useEffect } = React;
  const [user, setUser] = useState({ userName: "Syed Saleem", userEmail: "syed@pc2cloud.io" }); // skip auth in demo
  const [section, setSection] = useState("devices");
  const [activeDevice, setActiveDevice] = useState(null);
  const [toast, setToast] = useState("");
  // Default to system preference, persist user override in localStorage.
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("pc2cloud_theme") || "system"; } catch { return "system"; }
  });

  // Apply theme + react to system changes when on "system" mode
  useEffect(() => {
    try { localStorage.setItem("pc2cloud_theme", theme); } catch {}
    const apply = () => {
      const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const isDark = theme === "dark" || (theme === "system" && sysDark);
      document.documentElement.classList.toggle("dark", isDark);
    };
    apply();
    if (theme === "system") {
      const m = window.matchMedia("(prefers-color-scheme: dark)");
      m.addEventListener("change", apply);
      return () => m.removeEventListener("change", apply);
    }
  }, [theme]);

  // Cycle: system → light → dark → system
  function cycleTheme() {
    setTheme((t) => t === "system" ? "light" : t === "light" ? "dark" : "system");
    showToast(`Theme: ${theme === "system" ? "Light" : theme === "light" ? "Dark" : "System"}`);
  }
  const themeIcon = theme === "system" ? "monitor" : theme === "dark" ? "moon" : "sun";
  const themeTitle = theme === "system" ? "Theme: System (click for Light)" : theme === "light" ? "Theme: Light (click for Dark)" : "Theme: Dark (click for System)";

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 2400); }
  function openStorage(d) { setActiveDevice(d); setSection("storage"); }

  if (!user) return <Auth onAuthed={setUser} />;

  const online = DEVICES.filter((d) => d.status === "online").length;
  const titleByEdge = {
    devices:  { title: "Devices",  sub: "Your PC fleet" },
    storage:  { title: "Storage",  sub: "File browser" },
    activity: { title: "Activity", sub: "Recent transfers" },
    security: { title: "Security", sub: "Sessions & 2FA" },
    settings: { title: "Settings", sub: "Account & preferences" },
    help:     { title: "Help",     sub: "Docs & support" },
  };
  const headInfo = titleByEdge[section] || titleByEdge.devices;

  return (
    <div className="shell">
      <Sidebar
        section={section}
        onChange={setSection}
        user={user}
        onLogout={() => setUser(null)}
        onlineCount={online}
        totalDevices={DEVICES.length}
      />

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">
            <h1>{headInfo.title}</h1>
          </div>
          <div className="topbar-search">
            <ReactIcon name="search" size={14} />
            <input type="search" placeholder={`Search ${headInfo.title.toLowerCase()}…`} />
          </div>
          <div className="topbar-actions">
            <button className="btn btn-ghost btn-icon btn-sm" title="Notifications">
              <ReactIcon name="bell" size={15} />
            </button>
            <button className="btn btn-ghost btn-icon btn-sm" title={themeTitle} onClick={cycleTheme}>
              <ReactIcon name={themeIcon} size={15} />
            </button>
            <div style={{ width: 1, height: 20, background: "var(--line)" }}></div>
            <button className="btn btn-secondary btn-sm">
              <ReactIcon name="download" size={13} /> Get desktop app
            </button>
          </div>
        </header>

        <div style={{ flex: 1, overflow: "auto" }}>
          {section === "devices" && (
            <Devices
              devices={DEVICES}
              onOpenStorage={openStorage}
              onEdit={() => showToast("Edit modal would open")}
              onUnlink={() => showToast("Device unlinked.")}
            />
          )}
          {section === "storage" && (
            <Storage devices={DEVICES} initialDevice={activeDevice} onShowToast={showToast} />
          )}
          {section === "activity" && (
            <Activity />
          )}
          {section === "security" && (
            <Security devices={DEVICES} />
          )}
          {section === "settings" && (
            <Settings user={user} theme={theme} onThemeChange={setTheme} />
          )}
          {section === "help" && (
            <div className="page page-narrow">
              <div className="page-head"><div><h2>Help &amp; support</h2><p>Docs, status, and contact.</p></div></div>
              <div className="settings-section">
                <h3>Resources</h3>
                <div className="settings-row">
                  <div className="settings-row-info"><div className="settings-row-name">Documentation</div><div className="settings-row-desc">Setup guides and API reference.</div></div>
                  <button className="btn btn-secondary btn-sm"><ReactIcon name="arrowupright" size={13}/> Open</button>
                </div>
                <div className="settings-row">
                  <div className="settings-row-info"><div className="settings-row-name">GitHub repository</div><div className="settings-row-desc">Source code and issues.</div></div>
                  <button className="btn btn-secondary btn-sm"><ReactIcon name="github" size={13}/> View</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="toast">
          <ReactIcon name="check" size={14} color="var(--success)" /> {toast}
        </div>
      )}
    </div>
  );
}

function Activity() {
  const events = [
    { id: 1, type: "upload",   icon: "upload",   color: "var(--brand-600)",  name: "photos-october.zip",  device: "Studio Desktop",      ago: "2 min ago",   size: "1.4 GB",  status: "Completed" },
    { id: 2, type: "download", icon: "download", color: "var(--success)",    name: "tax-return-2024.pdf", device: "Old Office Tower",    ago: "12 min ago",  size: "824 KB",  status: "Completed" },
    { id: 3, type: "delete",   icon: "trash",    color: "var(--warning)",    name: "old-drafts/",         device: "Studio Desktop",      ago: "1 hr ago",    size: "—",       status: "Removed" },
    { id: 4, type: "device",   icon: "wifi",     color: "var(--success)",    name: "Old Office Tower came online", device: "—",          ago: "2 hr ago",    size: "—",       status: "Connected" },
    { id: 5, type: "upload",   icon: "upload",   color: "var(--brand-600)",  name: "demo.mp4",            device: "Studio Desktop",      ago: "5 hr ago",    size: "138 MB",  status: "Completed" },
    { id: 6, type: "share",    icon: "link",     color: "var(--accent-cyan-deep)", name: "Shared link created · IMG_0421.jpg", device: "Studio Desktop", ago: "Yesterday", size: "—", status: "Active" },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div><h2>Activity</h2><p>Recent transfers and device events.</p></div>
        <button className="btn btn-secondary"><ReactIcon name="download" size={13}/> Export log</button>
      </div>

      <div className="file-list">
        <div className="file-header">
          <span></span>
          <button>Event</button>
          <button>Device</button>
          <button>When</button>
          <span>Status</span>
        </div>
        {events.map((e) => (
          <div key={e.id} className="file-row">
            <div className="file-icon" style={{ background: "var(--bg-subtle)", color: e.color }}>
              <ReactIcon name={e.icon} size={14} />
            </div>
            <div className="file-name">
              <div>
                <div className="file-name-text">{e.name}</div>
                <div className="caption mono" style={{ fontSize: 11 }}>{e.size}</div>
              </div>
            </div>
            <span className="file-meta">{e.device}</span>
            <span className="file-meta">{e.ago}</span>
            <span><span className="chip">{e.status}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { App, Activity });
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
