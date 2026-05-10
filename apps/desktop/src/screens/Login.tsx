import React, { useState } from "react";
import { Cloud, LogIn } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:7000";

export default function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.BaseSyntheticEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Login failed");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Cloud size={24} aria-hidden="true" />
      </div>
      <h1 className="mt-3 text-xl font-semibold">Sign in to PC2CLOUD</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Use the same account as the website.
      </p>

      <form onSubmit={handleLogin} className="mt-6 w-full max-w-xs grid gap-3">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Email"
          required
          className="h-11 rounded-lg border border-border px-4 outline-none focus:border-primary"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Password"
          required
          className="h-11 rounded-lg border border-border px-4 outline-none focus:border-primary"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          disabled={loading}
          className="flex h-11 items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground disabled:opacity-60"
        >
          <LogIn size={17} aria-hidden="true" />
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
