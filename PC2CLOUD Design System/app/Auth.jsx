/* ── Reusable Logo + atoms ── */
function Logo({ size = 1 }) {
  const px = 28 * size;
  return (
    <div className="logo" style={{ pointerEvents: "none" }}>
      <span className="logo-mark" style={{ width: px, height: px, borderRadius: 7 * size }}>
        <ReactIcon name="cloud" size={16 * size} color="white" />
      </span>
      <span className="logo-text" style={{ fontSize: 14 * size }}>PC2CLOUD</span>
    </div>
  );
}

function Auth({ onAuthed }) {
  const { useState, useRef } = React;
  const [screen, setScreen] = useState("credentials"); // credentials | verify | forgot | reset
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("syed@pc2cloud.io");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState(["","","","","",""]);
  const [pendingEmail, setPendingEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const otpRefs = useRef([]);

  function setOtpDigit(i, v) {
    if (v.length > 1) {
      const digits = v.replace(/\D/g, "").slice(0, 6).split("");
      const next = ["","","","","",""];
      digits.forEach((d, idx) => (next[idx] = d));
      setOtp(next);
      otpRefs.current[Math.min(digits.length, 5)]?.focus();
      return;
    }
    if (!/^[0-9]?$/.test(v)) return;
    const next = [...otp]; next[i] = v; setOtp(next);
    if (v && i < 5) otpRefs.current[i + 1]?.focus();
  }
  function onOtpKey(i, e) {
    if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  }

  function submitCreds(e) {
    e.preventDefault();
    if (mode === "register" && password !== confirmPassword) { setError("Passwords do not match"); return; }
    setBusy(true); setError("");
    setTimeout(() => { setBusy(false); onAuthed({ userName: "Syed Saleem", userEmail: email }); }, 400);
  }

  const otpBoxes = (
    <div className="otp">
      {otp.map((d, i) => (
        <input key={i} ref={(el) => (otpRefs.current[i] = el)}
          inputMode="numeric" maxLength={6} value={d}
          onChange={(e) => setOtpDigit(i, e.target.value)}
          onKeyDown={(e) => onOtpKey(i, e)} />
      ))}
    </div>
  );

  return (
    <div className="auth">
      <div className="auth-card anim-fade-in">
        <div className="auth-header">
          <div style={{ display: "inline-block" }}>
            <span className="logo-mark logo-lg" style={{ width: 48, height: 48, borderRadius: 12 }}>
              <ReactIcon name="cloud" size={24} color="white" />
            </span>
          </div>
          {screen === "credentials" && <>
            <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
            <p>{mode === "login" ? "Sign in to access your devices." : "Free, forever — no card required."}</p>
          </>}
          {screen === "verify" && <>
            <h1>Check your email</h1>
            <p>Enter the 6-digit code sent to <strong style={{ color: "var(--fg)" }}>{pendingEmail}</strong></p>
          </>}
          {screen === "forgot" && <>
            <h1>Forgot password</h1>
            <p>We'll send a reset code to your email.</p>
          </>}
          {screen === "reset" && <>
            <h1>Reset password</h1>
            <p>Code sent to <strong style={{ color: "var(--fg)" }}>{pendingEmail}</strong></p>
          </>}
        </div>

        {screen === "credentials" && (
          <form onSubmit={submitCreds}>
            <div className="auth-tabs">
              <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Login</button>
              <button type="button" className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Register</button>
            </div>

            <div className="field-row">
              {mode === "register" && (
                <div className="field">
                  <label>Name</label>
                  <input className="input input-lg" placeholder="Syed Saleem" />
                </div>
              )}
              <div className="field">
                <label>Email</label>
                <input className="input input-lg" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="field">
                <label>Password</label>
                <input className="input input-lg" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              {mode === "register" && (
                <div className="field">
                  <label>Confirm password</label>
                  <input className="input input-lg" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                </div>
              )}
            </div>

            {mode === "login" && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button type="button" onClick={() => { setPendingEmail(email); setScreen("forgot"); }}
                  style={{ fontSize: 12, color: "var(--fg-muted)" }}>Forgot password?</button>
              </div>
            )}

            {error && <p style={{ marginTop: 12, fontSize: 13, color: "var(--danger)" }}>{error}</p>}

            <button type="submit" disabled={busy} className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: 20 }}>
              <ReactIcon name={mode === "login" ? "login" : "rocket"} size={16} />
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </button>

            <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--line)", textAlign: "center", fontSize: 12, color: "var(--fg-muted)" }}>
              By continuing, you agree to our <a href="#" style={{ color: "var(--brand-600)" }}>Terms</a> &amp; <a href="#" style={{ color: "var(--brand-600)" }}>Privacy</a>.
            </div>
          </form>
        )}

        {screen === "verify" && (
          <form onSubmit={(e) => { e.preventDefault(); onAuthed({ userEmail: pendingEmail }); }}>
            {otpBoxes}
            <button type="submit" disabled={otp.join("").length < 6} className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: 20 }}>
              Verify email
            </button>
            <div className="auth-foot">
              <button type="button">Resend code</button>
              <button type="button" onClick={() => setScreen("credentials")}>Back to login</button>
            </div>
          </form>
        )}

        {screen === "forgot" && (
          <form onSubmit={(e) => { e.preventDefault(); setScreen("reset"); }}>
            <div className="field">
              <label>Email</label>
              <input className="input input-lg" type="email" value={pendingEmail} onChange={(e) => setPendingEmail(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: 20 }}>
              Send reset code
            </button>
            <div className="auth-foot" style={{ justifyContent: "center" }}>
              <button type="button" onClick={() => setScreen("credentials")}>Back to login</button>
            </div>
          </form>
        )}

        {screen === "reset" && (
          <form onSubmit={(e) => { e.preventDefault(); setScreen("credentials"); }}>
            {otpBoxes}
            <div className="field-row" style={{ marginTop: 16 }}>
              <div className="field"><label>New password</label><input className="input input-lg" type="password" required /></div>
              <div className="field"><label>Confirm password</label><input className="input input-lg" type="password" required /></div>
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: 20 }}>
              Reset password
            </button>
            <div className="auth-foot">
              <button type="button">Resend code</button>
              <button type="button" onClick={() => setScreen("credentials")}>Back to login</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { Auth, Logo });
