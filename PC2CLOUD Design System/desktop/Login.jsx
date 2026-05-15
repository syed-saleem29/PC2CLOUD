function DesktopLogin({ onDone }) {
  const { useState, useRef } = React;
  const [screen, setScreen] = useState("login"); // login | verify | forgot | reset
  const [email, setEmail] = useState("syed@pc2cloud.io");
  const [password, setPassword] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [otp, setOtp] = useState(["","","","","",""]);
  const [busy, setBusy] = useState(false);
  const otpRefs = useRef([]);

  function setOtpDigit(i, v) {
    if (!/^[0-9]?$/.test(v)) return;
    const next = [...otp]; next[i] = v; setOtp(next);
    if (v && i < 5) otpRefs.current[i + 1]?.focus();
  }
  function onOtpKey(i, e) {
    if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  }

  function submit(e) {
    e.preventDefault();
    setBusy(true);
    setTimeout(() => { setBusy(false); onDone(); }, 400);
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div className="orb" style={{ marginBottom: 24 }}>
        <span className="orb-inner">
          <ReactIcon name="cloud" size={28} color="white" />
        </span>
      </div>

      {screen === "login" && <>
        <h1 style={{ textAlign: "center", fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>Sign in to PC2CLOUD</h1>
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--fg-muted)", margin: "6px 0 24px" }}>
          Use the same account as the website.
        </p>
        <form onSubmit={submit} style={{ display: "grid", gap: 10, maxWidth: 280, margin: "0 auto", width: "100%" }}>
          <input className="input input-lg" style={{ borderRadius: 12 }} type="email"
            placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="input input-lg" style={{ borderRadius: 12 }} type="password"
            placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => { setPendingEmail(email); setScreen("forgot"); }}
              style={{ fontSize: 12, color: "var(--fg-muted)" }}>Forgot password?</button>
          </div>
          <button type="submit" disabled={busy} className="btn btn-primary btn-lg"
            style={{ width: "100%", borderRadius: 12, marginTop: 4, boxShadow: "0 6px 20px -4px rgba(37, 99, 235, 0.40)" }}>
            <ReactIcon name="login" size={15} />
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </>}

      {screen === "verify" && <>
        <h1 style={{ textAlign: "center", fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>Check your email</h1>
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--fg-muted)", margin: "6px 0 24px" }}>
          Enter the code sent to<br />
          <strong style={{ color: "var(--fg)" }}>{pendingEmail}</strong>
        </p>
        <form onSubmit={(e) => { e.preventDefault(); onDone(); }} style={{ display: "grid", gap: 14, maxWidth: 280, margin: "0 auto", width: "100%" }}>
          <div className="d-otp">
            {otp.map((d, i) => (
              <input key={i} ref={(el) => (otpRefs.current[i] = el)}
                inputMode="numeric" maxLength={1} value={d}
                onChange={(e) => setOtpDigit(i, e.target.value)}
                onKeyDown={(e) => onOtpKey(i, e)} />
            ))}
          </div>
          <button type="submit" className="btn btn-primary btn-lg"
            style={{ width: "100%", borderRadius: 12 }}>
            <ReactIcon name="mail" size={15} /> Verify email
          </button>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--fg-muted)" }}>
            <button type="button">Resend code</button>
            <button type="button" onClick={() => setScreen("login")}>Back to login</button>
          </div>
        </form>
      </>}

      {screen === "forgot" && <>
        <h1 style={{ textAlign: "center", fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>Forgot password</h1>
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--fg-muted)", margin: "6px 0 24px" }}>
          We'll send a reset code to your email.
        </p>
        <form onSubmit={(e) => { e.preventDefault(); setScreen("reset"); }} style={{ display: "grid", gap: 10, maxWidth: 280, margin: "0 auto", width: "100%" }}>
          <input className="input input-lg" style={{ borderRadius: 12 }} type="email"
            value={pendingEmail} onChange={(e) => setPendingEmail(e.target.value)} required />
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: "100%", borderRadius: 12 }}>
            <ReactIcon name="mail" size={15} /> Send reset code
          </button>
          <button type="button" onClick={() => setScreen("login")} style={{ textAlign: "center", fontSize: 12, color: "var(--fg-muted)" }}>
            Back to login
          </button>
        </form>
      </>}

      {screen === "reset" && <>
        <h1 style={{ textAlign: "center", fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>Reset password</h1>
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--fg-muted)", margin: "6px 0 24px" }}>
          Code sent to <strong style={{ color: "var(--fg)" }}>{pendingEmail}</strong>
        </p>
        <form onSubmit={(e) => { e.preventDefault(); setScreen("login"); }} style={{ display: "grid", gap: 10, maxWidth: 280, margin: "0 auto", width: "100%" }}>
          <div className="d-otp">
            {otp.map((d, i) => (
              <input key={i} ref={(el) => (otpRefs.current[i] = el)}
                inputMode="numeric" maxLength={1} value={d}
                onChange={(e) => setOtpDigit(i, e.target.value)}
                onKeyDown={(e) => onOtpKey(i, e)} />
            ))}
          </div>
          <input className="input input-lg" style={{ borderRadius: 12 }} type="password" placeholder="New password" required />
          <input className="input input-lg" style={{ borderRadius: 12 }} type="password" placeholder="Confirm new password" required />
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: "100%", borderRadius: 12 }}>
            <ReactIcon name="check" size={15} /> Reset password
          </button>
        </form>
      </>}
    </div>
  );
}

Object.assign(window, { DesktopLogin });
