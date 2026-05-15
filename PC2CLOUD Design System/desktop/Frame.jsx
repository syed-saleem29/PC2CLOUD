/* Frame — the chrome around every screen (title bar + body) */
function Frame({ theme, isDark, onCycleTheme, children }) {
  const icon = theme === "system" ? "monitor" : isDark ? "moon" : "sun";
  const title =
    theme === "system" ? "Theme: System (click for Light)" :
    theme === "light"  ? "Theme: Light (click for Dark)" :
                         "Theme: Dark (click for System)";
  return (
    <div className="window">
      <div className="titlebar">
        <div className="titlebar-brand">
          <span className="logo-mark" style={{ width: 22, height: 22, borderRadius: 6 }}>
            <ReactIcon name="cloud" size={12} color="white" />
          </span>
          PC2CLOUD
        </div>
        <div className="titlebar-actions">
          <button className="win-btn" onClick={onCycleTheme} title={title}>
            <ReactIcon name={icon} size={13} />
          </button>
          <button className="win-btn" title="Minimize">
            <ReactIcon name="minus" size={13} />
          </button>
          <button className="win-btn win-btn-close" title="Close">
            <ReactIcon name="x" size={13} />
          </button>
        </div>
      </div>
      <div className="body-area">{children}</div>
    </div>
  );
}

Object.assign(window, { Frame });
