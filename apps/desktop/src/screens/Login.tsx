import React, { useRef, useState } from "react";
import { Cloud, LogIn } from "lucide-react";
import { API_URL, setToken } from "../lib/api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ipc = () => (window as any).require("electron").ipcRenderer;

type Screen = "login" | "verify-email" | "forgot-email" | "reset-password";

export default function Login({ onDone }: { onDone: () => void }) {
  const [screen, setScreen] = useState<Screen>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  function getOtp() { return otpDigits.join(""); }

  function handleOtpInput(i: number, value: string) {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      const next = ["", "", "", "", "", ""];
      digits.forEach((d, idx) => { next[idx] = d; });
      setOtpDigits(next);
      otpRefs.current[Math.min(digits.length, 5)]?.focus();
      return;
    }
    if (!/^[0-9]?$/.test(value)) return;
    const next = [...otpDigits];
    next[i] = value;
    setOtpDigits(next);
    if (value && i < 5) otpRefs.current[i + 1]?.focus();
  }

  function handleOtpKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otpDigits[i] && i > 0) otpRefs.current[i - 1]?.focus();
  }

  function resetOtp() { setOtpDigits(["", "", "", "", "", ""]); setTimeout(() => otpRefs.current[0]?.focus(), 50); }

  async function apiPost(path: string, body: object) {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Request failed");
    return data;
  }

  async function handleLogin(e: React.BaseSyntheticEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await apiPost("/api/auth/login", { email, password });
      if (data.token) {
        setToken(data.token);
        await ipc().invoke("config:write", { authToken: data.token });
      }
      onDone();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      if (msg.toLowerCase().includes("verify")) {
        setPendingEmail(email);
        resetOtp();
        setScreen("verify-email");
        return;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyEmail(e: React.BaseSyntheticEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await apiPost("/api/auth/verify-email", { email: pendingEmail, otp: getOtp() });
      if (data.token) {
        setToken(data.token);
        await ipc().invoke("config:write", { authToken: data.token });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      resetOtp();
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp(type: "verify" | "reset") {
    setLoading(true);
    setError("");
    try {
      await apiPost("/api/auth/send-otp", { email: pendingEmail, type });
      resetOtp();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend code");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotEmail(e: React.BaseSyntheticEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiPost("/api/auth/send-otp", { email: pendingEmail, type: "reset" });
      resetOtp();
      setNewPassword("");
      setConfirmPassword("");
      setScreen("reset-password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.BaseSyntheticEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }
    setLoading(true);
    setError("");
    try {
      await apiPost("/api/auth/reset-password", { email: pendingEmail, otp: getOtp(), newPassword });
      setScreen("login");
      setPassword("");
      resetOtp();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
      resetOtp();
    } finally {
      setLoading(false);
    }
  }

  const otpBoxes = (
    <div className="flex justify-between gap-2">
      {otpDigits.map((d, i) => (
        <input key={i} ref={(el) => { otpRefs.current[i] = el; }}
          type="text" inputMode="numeric" maxLength={6} value={d}
          onChange={(e) => handleOtpInput(i, e.target.value)}
          onKeyDown={(e) => handleOtpKeyDown(i, e)}
          className="h-12 w-full rounded-lg border border-border text-center text-lg font-semibold outline-none focus:border-primary" />
      ))}
    </div>
  );

  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Cloud size={24} aria-hidden="true" />
      </div>

      {/* Login */}
      {screen === "login" && (
        <>
          <h1 className="mt-3 text-xl font-semibold">Sign in to PC2CLOUD</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use the same account as the website.</p>
          <form onSubmit={handleLogin} className="mt-6 w-full max-w-xs grid gap-3">
            <input value={email} onChange={(e) => setEmail(e.target.value)}
              type="email" placeholder="Email" required
              className="h-11 rounded-lg border border-border px-4 outline-none focus:border-primary" />
            <input value={password} onChange={(e) => setPassword(e.target.value)}
              type="password" placeholder="Password" required
              className="h-11 rounded-lg border border-border px-4 outline-none focus:border-primary" />
            <button type="button"
              onClick={() => { setPendingEmail(email); setError(""); setScreen("forgot-email"); }}
              className="text-left text-xs text-muted-foreground hover:text-foreground">
              Forgot password?
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={loading}
              className="flex h-11 items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground disabled:opacity-60">
              <LogIn size={17} aria-hidden="true" />
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </>
      )}

      {/* Verify email */}
      {screen === "verify-email" && (
        <>
          <h1 className="mt-3 text-xl font-semibold">Verify your email</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Enter the 6-digit code sent to<br /><span className="font-medium text-foreground">{pendingEmail}</span>
          </p>
          <form onSubmit={handleVerifyEmail} className="mt-6 w-full max-w-xs grid gap-3">
            {otpBoxes}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={loading || getOtp().length < 6}
              className="flex h-11 items-center justify-center rounded-lg bg-primary font-semibold text-primary-foreground disabled:opacity-60">
              {loading ? "Verifying…" : "Verify"}
            </button>
            <div className="flex justify-between text-xs text-muted-foreground">
              <button type="button" onClick={() => handleResendOtp("verify")} disabled={loading}
                className="hover:text-foreground disabled:opacity-50">Resend code</button>
              <button type="button" onClick={() => { setScreen("login"); setError(""); }}
                className="hover:text-foreground">Back to login</button>
            </div>
          </form>
        </>
      )}

      {/* Forgot password — email */}
      {screen === "forgot-email" && (
        <>
          <h1 className="mt-3 text-xl font-semibold">Forgot password</h1>
          <p className="mt-1 text-sm text-muted-foreground">We&apos;ll send a reset code to your email.</p>
          <form onSubmit={handleForgotEmail} className="mt-6 w-full max-w-xs grid gap-3">
            <input value={pendingEmail} onChange={(e) => setPendingEmail(e.target.value)}
              type="email" placeholder="Email" required
              className="h-11 rounded-lg border border-border px-4 outline-none focus:border-primary" />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={loading}
              className="flex h-11 items-center justify-center rounded-lg bg-primary font-semibold text-primary-foreground disabled:opacity-60">
              {loading ? "Sending…" : "Send code"}
            </button>
            <button type="button" onClick={() => { setScreen("login"); setError(""); }}
              className="text-center text-xs text-muted-foreground hover:text-foreground">Back to login</button>
          </form>
        </>
      )}

      {/* Reset password */}
      {screen === "reset-password" && (
        <>
          <h1 className="mt-3 text-xl font-semibold">Reset password</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Code sent to <span className="font-medium text-foreground">{pendingEmail}</span>
          </p>
          <form onSubmit={handleResetPassword} className="mt-6 w-full max-w-xs grid gap-3">
            {otpBoxes}
            <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              type="password" placeholder="New password" required minLength={6}
              className="h-11 rounded-lg border border-border px-4 outline-none focus:border-primary" />
            <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              type="password" placeholder="Confirm new password" required
              className="h-11 rounded-lg border border-border px-4 outline-none focus:border-primary" />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={loading || getOtp().length < 6}
              className="flex h-11 items-center justify-center rounded-lg bg-primary font-semibold text-primary-foreground disabled:opacity-60">
              {loading ? "Resetting…" : "Reset password"}
            </button>
            <div className="flex justify-between text-xs text-muted-foreground">
              <button type="button" onClick={() => handleResendOtp("reset")} disabled={loading}
                className="hover:text-foreground disabled:opacity-50">Resend code</button>
              <button type="button" onClick={() => { setScreen("forgot-email"); setError(""); resetOtp(); }}
                className="hover:text-foreground">Back</button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
