function Devices({ devices, onOpenStorage, onUnlink, onEdit }) {
  const online = devices.filter((d) => d.status === "online").length;
  const totalCapacity = devices.reduce((s, d) => s + d.usedStorageBytes + d.storageLimitBytes, 0);
  const totalUsed = devices.reduce((s, d) => s + d.usedStorageBytes, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Devices</h2>
          <p>Connected PCs sharing storage with your account.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary">
            <ReactIcon name="refresh" size={14} /> Refresh
          </button>
          <button className="btn btn-primary">
            <ReactIcon name="plus" size={14} /> Link new PC
          </button>
        </div>
      </div>

      <div className="stats">
        <div className="stat-card">
          <div className="stat-card-head">
            <span className="stat-card-label">Connected PCs</span>
            <span className="stat-icon stat-icon-brand"><ReactIcon name="computer" size={16} /></span>
          </div>
          <div className="stat-card-val">{devices.length}</div>
          <div className="stat-card-delta stat-card-delta-up">
            <ReactIcon name="arrowupright" size={11} /> +1 this month
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-head">
            <span className="stat-card-label">Online now</span>
            <span className="stat-icon stat-icon-success"><ReactIcon name="wifi" size={16} /></span>
          </div>
          <div className="stat-card-val">{online}<small>/ {devices.length}</small></div>
          <div className="stat-card-delta">
            <span className="dot" style={{ background: "var(--success)" }}></span> All good
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-head">
            <span className="stat-card-label">Storage used</span>
            <span className="stat-icon"><ReactIcon name="database" size={16} /></span>
          </div>
          <div className="stat-card-val">{formatBytes(totalUsed)}</div>
          <div className="bar" style={{ marginTop: 10 }}>
            <div style={{ width: `${(totalUsed / totalCapacity) * 100}%` }}></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-head">
            <span className="stat-card-label">Total capacity</span>
            <span className="stat-icon"><ReactIcon name="harddrive" size={16} /></span>
          </div>
          <div className="stat-card-val">{formatBytes(totalCapacity)}</div>
          <div className="stat-card-delta">
            <ReactIcon name="zap" size={11} color="var(--warning)" /> Growing
          </div>
        </div>
      </div>

      <div className="device-list">
        {devices.map((d) => {
          const total = d.usedStorageBytes + d.storageLimitBytes;
          const pct = total ? (d.usedStorageBytes / total) * 100 : 0;
          return (
            <div key={d.deviceId} className="device-row anim-fade-in">
              <div className="device-icon"><ReactIcon name="computer" size={20} /></div>

              <div>
                <div className="device-name">{d.deviceName}</div>
                <div className="device-meta">{d.sharedFolderPath}</div>
              </div>

              <div>
                <span className={`chip ${d.status === "online" ? "chip-success" : ""}`}>
                  <span className="dot"></span>
                  {d.status}
                </span>
                <div className="caption" style={{ marginTop: 6 }}>{d.platform}</div>
              </div>

              <div className="device-storage">
                <div className="device-storage-label">
                  <span><strong className="mono">{formatBytes(d.usedStorageBytes)}</strong> used</span>
                  <span className="mono">{formatBytes(total)}</span>
                </div>
                <div className={`bar${pct > 80 ? " bar-warn" : ""}`}>
                  <div style={{ width: `${pct}%` }}></div>
                </div>
              </div>

              <div className="device-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => onOpenStorage(d)}>
                  <ReactIcon name="folder" size={13} /> Open
                </button>
                <button className="btn btn-ghost btn-icon btn-sm" title="Edit" onClick={() => onEdit(d)}>
                  <ReactIcon name="pencil" size={13} />
                </button>
                <button className="btn btn-ghost btn-icon btn-sm" title="More">
                  <ReactIcon name="morevertical" size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { Devices });
