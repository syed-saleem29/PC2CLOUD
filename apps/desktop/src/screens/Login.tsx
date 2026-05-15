import React, { useRef, useState } from "react";
import { Cloud, KeyRound, LogIn, Mail, RotateCcw } from "lucide-react";
import { API_URL, setToken } from "../lib/api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ipc = () => (window as any).require("electron").ipcRenderer;

type Screen = "login" | "verify-email" | "forgot-email" | "reset-password";

const inputCls =
  "h-11 w-full rounded-xl border border-border bg-surface px-4 outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15";

const btnPrimary =
  "flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed";

export default function Login({ onDone, hasConfig }: { onDone: () => void; hasConfig?: boolean }) {
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

  function resetOtp() {
    setOtpDigits(["", "", "", "", "", ""]);
    setTimeout(() => otpRefs.current[0]?.focus(), 50);
  }

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
    <div className="d-otp">
      {otpDigits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { otpRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={d}
          onChange={(e) => handleOtpInput(i, e.target.value)}
          onKeyDown={(e) => handleOtpKeyDown(i, e)}
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      {/* Logo orb */}
      <div className="orb mb-1">
        <div className="orb-inner">
          <Cloud size={28} color="white" aria-hidden="true" />
        </div>
      </div>

      {screen === "login" && (
        <>
          <h1 className="mt-4 text-xl font-bold tracking-tight">
            {hasConfig ? "Welcome back" : "Sign in to PC2CLOUD"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasConfig ? "Sign in to reconnect your PC." : "Use the same account as the website."}
          </p>
          <form onSubmit={handleLogin} className="mt-6 w-full max-w-xs grid gap-3">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="Email address"
              required
              className={inputCls}
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Password"
              required
              className={inputCls}
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => { setPendingEmail(email); setError(""); setScreen("forgot-email"); }}
                className="text-xs text-muted-foreground transition-colors hover:text-primary"
              >
                Forgot password?
              </button>
            </div>
            {error && (
              <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500 border border-red-500/20">
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} className={btnPrimary}>
              <LogIn size={16} aria-hidden="true" />
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </>
      )}

      {screen === "verify-email" && (
        <>
          <h1 className="mt-4 text-xl font-bold tracking-tight">Check your email</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Enter the 6-digit code sent to
            <br />
            <span className="font-semibold text-foreground">{pendingEmail}</span>
          </p>
          <form onSubmit={handleVerifyEmail} className="mt-6 w-full max-w-xs grid gap-3">
            {otpBoxes}
            {error && (
              <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500 border border-red-500/20">
                {error}
              </div>
            )}
            <button type="submit" disabled={loading || getOtp().length < 6} className={btnPrimary}>
              <Mail size={16} aria-hidden="true" />
              {loading ? "Verifying…" : "Verify email"}
            </button>
            <div className="flex justify-between text-xs text-muted-foreground">
              <button
                type="button"
                onClick={() => handleResendOtp("verify")}
                disabled={loading}
                className="transition-colors hover:text-foreground disabled:opacity-50"
              >
                Resend code
              </button>
              <button
                type="button"
                onClick={() => { setScreen("login"); setError(""); }}
                className="transition-colors hover:text-foreground"
              >
                Back to login
              </button>
            </div>
          </form>
        </>
      )}

      {screen === "forgot-email" && (
        <>
          <h1 className="mt-4 text-xl font-bold tracking-tight">Forgot password</h1>
          <p className="mt-1 text-sm text-muted-foreground">We&apos;ll send a reset code to your email.</p>
          <form onSubmit={handleForgotEmail} className="mt-6 w-full max-w-xs grid gap-3">
            <input
              value={pendingEmail}
              onChange={(e) => setPendingEmail(e.target.value)}
              type="email"
              placeholder="Email address"
              required
              className={inputCls}
            />
            {error && (
              <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500 border border-red-500/20">
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} className={btnPrimary}>
              <Mail size={16} aria-hidden="true" />
              {loading ? "Sending…" : "Send reset code"}
            </button>
            <button
              type="button"
              onClick={() => { setScreen("login"); setError(""); }}
              className="text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Back to login
            </button>
          </form>
        </>
      )}

      {screen === "reset-password" && (
        <>
          <h1 className="mt-4 text-xl font-bold tracking-tight">Reset password</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Code sent to{" "}
            <span className="font-semibold text-foreground">{pendingEmail}</span>
          </p>
          <form onSubmit={handleResetPassword} className="mt-6 w-full max-w-xs grid gap-3">
            {otpBoxes}
            <input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              type="password"
              placeholder="New password"
              required
              minLength={6}
              className={inputCls}
            />
            <input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type="password"
              placeholder="Confirm new password"
              required
              className={inputCls}
            />
            {error && (
              <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500 border border-red-500/20">
                {error}
              </div>
            )}
            <button type="submit" disabled={loading || getOtp().length < 6} className={btnPrimary}>
              <KeyRound size={16} aria-hidden="true" />
              {loading ? "Resetting…" : "Reset password"}
            </button>
            <div className="flex justify-between text-xs text-muted-foreground">
              <button
                type="button"
                onClick={() => handleResendOtp("reset")}
                disabled={loading}
                className="transition-colors hover:text-foreground disabled:opacity-50"
              >
                Resend code
              </button>
              <button
                type="button"
                onClick={() => { setScreen("forgot-email"); setError(""); resetOtp(); }}
                className="transition-colors hover:text-foreground"
              >
                <RotateCcw size={11} className="inline mr-1" aria-hidden="true" />
                Back
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
