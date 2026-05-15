function DesktopSetup({ onDone, onLogout }) {
  const { useState } = React;
  const [step, setStep] = useState("pick"); // pick | confirm | setting-up | done
  const [selectedDir, setSelectedDir] = useState("");
  const [deviceName, setDeviceName] = useState("Studio Desktop");

  const free = 316 * 1024 ** 3;
  const total = 500 * 1024 ** 3;
  const usedPct = Math.round(((total - free) / total) * 100);

  function pickFolder() { setSelectedDir("D:\\Storage"); setStep("confirm"); }
  function confirm(e) {
    e.preventDefault();
    setStep("setting-up");
    setTimeout(() => setStep("done"), 900);
    setTimeout(onDone, 2400);
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>Set up storage</h2>
          <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: "4px 0 0" }}>
            {step === "pick" && "Choose where to store your PC2CLOUD files."}
            {(step === "confirm" || step === "setting-up") && "Confirm location and name this PC."}
            {step === "done" && "All set!"}
          </p>
        </div>
        {step !== "done" && (
          <button onClick={onLogout} style={{ fontSize: 11, color: "var(--fg-muted)" }}>Sign out</button>
        )}
      </div>

      {step !== "done" && (
        <div className="steps-pills">
          <div className={`step-pill ${(step === "confirm" || step === "setting-up") ? "done" : "active"}`}>
            {(step === "confirm" || step === "setting-up") ? <ReactIcon name="check" size={11} /> : "1"}
          </div>
          <div className={`step-line ${(step === "confirm" || step === "setting-up") ? "done" : ""}`}></div>
          <div className={`step-pill ${(step === "confirm" || step === "setting-up") ? "active" : ""}`}>2</div>
        </div>
      )}

      {step === "pick" && (
        <button className="folder-picker" onClick={pickFolder}>
          <div className="folder-picker-icon"><ReactIcon name="folder" size={22} /></div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Choose folder location</div>
            <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 2 }} className="mono">e.g. D:\ or C:\Users\Name</div>
          </div>
        </button>
      )}

      {(step === "confirm" || step === "setting-up") && (
        <form onSubmit={confirm} style={{ display: "grid", gap: 12 }}>
          <div className="drive-card">
            <div className="drive-card-head">
              <div className="drive-card-icon"><ReactIcon name="harddrive" size={16} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--fg-subtle)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Selected drive</div>
                <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{selectedDir}</div>
                <div style={{ fontSize: 11, color: "var(--fg-muted)" }} className="mono">
                  {(free / 1024 ** 3).toFixed(0)} GB free · {(total / 1024 ** 3).toFixed(0)} GB total
                </div>
              </div>
            </div>
            <div className="bar"><div style={{ width: `${usedPct}%` }}></div></div>
          </div>

          <div style={{
            display: "flex", alignItems: "flex-start", gap: 8,
            padding: "10px 12px",
            background: "var(--bg-subtle)",
            border: "1px solid var(--line)",
            borderRadius: 10,
          }}>
            <ReactIcon name="checkcircle" size={13} color="var(--brand-600)" />
            <div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>Folder will be created at</div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--fg-muted)", marginTop: 2, wordBreak: "break-all" }}>
                {selectedDir.replace(/\\/g, "/")} / PC2CLOUD
              </div>
            </div>
          </div>

          <div className="field">
            <label style={{ fontSize: 10, fontWeight: 600, color: "var(--fg-subtle)", textTransform: "uppercase", letterSpacing: "0.08em" }}>PC name</label>
            <input className="input" style={{ borderRadius: 10 }} value={deviceName} onChange={(e) => setDeviceName(e.target.value)} />
            <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>Shown on your dashboard.</span>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button type="button" onClick={() => setStep("pick")} disabled={step === "setting-up"}
              className="btn btn-secondary" style={{ borderRadius: 12 }}>
              <ReactIcon name="chevronleft" size={13} /> Back
            </button>
            <button type="submit" disabled={step === "setting-up"}
              className="btn btn-primary" style={{ flex: 1, borderRadius: 12, boxShadow: "0 6px 20px -4px rgba(37, 99, 235, 0.40)" }}>
              {step === "setting-up" ? (
                <>
                  <ReactIcon name="refresh" size={14} className="anim-spin" /> Setting up…
                </>
              ) : (
                <>
                  <ReactIcon name="check" size={14} /> Confirm &amp; start
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {step === "done" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", inset: -16, borderRadius: "50%", background: "var(--success)", filter: "blur(24px)", opacity: 0.30 }}></div>
            <div style={{
              position: "relative", width: 72, height: 72, borderRadius: "50%",
              background: "var(--success-bg)", border: "1px solid var(--success-border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--success)",
            }}>
              <ReactIcon name="check" size={32} strokeWidth={2.5} />
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>You're all set!</div>
            <div style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 6 }}>
              Your PC is now connected to PC2CLOUD.<br />Opening your dashboard…
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { DesktopSetup });
