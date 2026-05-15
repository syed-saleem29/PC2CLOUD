function Storage({ devices, initialDevice, onShowToast }) {
  const { useState } = React;
  const [active, setActive] = useState(initialDevice || devices[0]);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState("");

  const files = FILES.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));

  function toggle(id) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Storage</h2>
          <p>Browse files across your linked devices.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary">
            <ReactIcon name="folderplus" size={14} /> New folder
          </button>
          <button className="btn btn-primary">
            <ReactIcon name="upload" size={14} /> Upload
          </button>
        </div>
      </div>

      <div className="tabs">
        {devices.map((d) => (
          <button key={d.deviceId}
            className={`tab${active.deviceId === d.deviceId ? " active" : ""}`}
            onClick={() => setActive(d)}>
            <ReactIcon name="computer" size={13} /> {d.deviceName}
            <span className="dot" style={{
              background: d.status === "online" ? "var(--success)" : "var(--fg-subtle)",
              width: 6, height: 6,
            }}></span>
          </button>
        ))}
        <button className="tab"><ReactIcon name="plus" size={13} /> Add</button>
      </div>

      <div className="fb-toolbar">
        <nav className="breadcrumb">
          <a href="#"><ReactIcon name="harddrive" size={14} /></a>
          <ReactIcon name="chevronright" size={14} />
          <a href="#">{active.sharedFolderName}</a>
          <ReactIcon name="chevronright" size={14} />
          <span className="current">Home</span>
        </nav>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
              <ReactIcon name="search" size={14} color="var(--fg-subtle)" />
            </div>
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search files…"
              style={{
                height: 36, width: 220, paddingLeft: 36, paddingRight: 12,
                background: "var(--bg-elevated)", border: "1px solid var(--line-strong)",
                borderRadius: "var(--r-md)", fontSize: 13, color: "var(--fg)",
              }} />
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 16px",
          background: "var(--brand-50)", border: "1px solid var(--brand-200)",
          borderRadius: "var(--r-md)", marginBottom: 12,
        }}>
          <span style={{ fontSize: 13, color: "var(--brand-700)", fontWeight: 500, flex: 1 }}>
            {selected.size} selected
          </span>
          <button className="btn btn-sm" style={{ background: "var(--brand-600)", color: "white" }}>
            <ReactIcon name="download" size={13} /> Download
          </button>
          <button className="btn btn-secondary btn-sm">
            <ReactIcon name="folder" size={13} /> Move
          </button>
          <button className="btn btn-danger btn-sm">
            <ReactIcon name="trash" size={13} /> Delete
          </button>
          <button onClick={() => setSelected(new Set())}
            style={{ width: 24, height: 24, color: "var(--brand-700)" }}>
            <ReactIcon name="x" size={13} />
          </button>
        </div>
      )}

      <div className="file-list">
        <div className="file-header">
          <input type="checkbox"
            checked={files.length > 0 && files.every((f) => selected.has(f.id))}
            onChange={(e) => setSelected(e.target.checked ? new Set(files.map((f) => f.id)) : new Set())} />
          <button>Name <ReactIcon name="arrowupdown" size={11} /></button>
          <button>Size</button>
          <button>Modified</button>
          <span></span>
        </div>
        {files.map((f) => {
          const ic = fileIconFor(f);
          const isSel = selected.has(f.id);
          return (
            <div key={f.id} className={`file-row${isSel ? " selected" : ""}${f.type === "folder" ? " folder" : ""}`}>
              <input type="checkbox" checked={isSel} onChange={() => toggle(f.id)} onClick={(e) => e.stopPropagation()} />
              <div className="file-name">
                <span className={`file-icon ${ic.cls}`}><ReactIcon name={ic.name} size={14} /></span>
                <span className="file-name-text">{f.name}</span>
              </div>
              <span className="file-meta file-meta-mono">{f.type === "folder" ? "—" : formatBytes(f.size)}</span>
              <span className="file-meta">{formatDate(f.modified)}</span>
              <div className="file-actions">
                {f.type === "file" && <button className="file-action-btn" title="Preview"><ReactIcon name="eye" size={14} /></button>}
                {f.type === "file" && <button className="file-action-btn" title="Download"><ReactIcon name="download" size={14} /></button>}
                <button className="file-action-btn" title="More"><ReactIcon name="morevertical" size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { Storage });
