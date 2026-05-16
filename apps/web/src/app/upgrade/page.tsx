"use client";

import { useEffect, useState } from "react";
import { Check, Sparkles, ArrowLeft, Zap } from "lucide-react";
import {
  getSubscription,
  createSubscriptionOrder,
  verifySubscriptionPayment,
  Subscription,
} from "@/lib/api";

const PLANS = [
  {
    id: "free" as const,
    name: "Free",
    price: "Free",
    highlight: false,
    features: [
      "1 PC",
      "5 GB monthly transfers",
      "File browser & preview",
      "Real-time online status",
    ],
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "₹399 / month",
    highlight: true,
    features: [
      "3 PCs",
      "Unlimited file transfers",
      "File browser & preview",
      "Real-time online status",
      "Priority email support",
    ],
  },
  {
    id: "team" as const,
    name: "Team",
    price: "₹999 / month",
    highlight: false,
    features: [
      "10 PCs",
      "Unlimited everything",
      "File browser & preview",
      "Real-time online status",
      "Admin controls",
      "Dedicated support",
    ],
  },
];

// Dynamically loads checkout.razorpay.com/v1/checkout.js — returns true when ready
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") { resolve(false); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).Razorpay) { resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload  = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function UpgradePage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [user, setUser] = useState<{ userEmail?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    getSubscription()
      .then((sub) => {
        setSubscription(sub);
        // Pull email from localStorage (set during dashboard login)
        try {
          const raw = localStorage.getItem("pc2cloud_user");
          if (raw) setUser(JSON.parse(raw));
        } catch {}
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  }

  async function handleUpgrade(plan: "pro" | "team") {
    setPaying(plan);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        showToast("Could not load payment library. Check your connection.", false);
        setPaying(null);
        return;
      }

      // Step 1 — create order on backend
      const order = await createSubscriptionOrder(plan);

      // Step 2 — open Razorpay modal
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rzp = new (window as any).Razorpay({
        key:         order.keyId,
        amount:      order.amount,
        currency:    order.currency,
        name:        "PC2CLOUD",
        description: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan — Monthly`,
        order_id:    order.orderId,
        prefill: {
          email: user?.userEmail ?? "",
        },
        theme: { color: "#6366f1" },

        // Step 3 — on successful payment, verify on backend
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await verifySubscriptionPayment({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_signature:  response.razorpay_signature,
              plan,
            });
            showToast(`You're now on the ${plan} plan!`);
            // Refresh subscription data then go back to dashboard
            const updated = await getSubscription().catch(() => null);
            if (updated) setSubscription(updated);
            setTimeout(() => { window.location.href = "/dashboard?upgraded=1"; }, 1500);
          } catch {
            showToast("Payment received but verification failed. Contact support.", false);
          } finally {
            setPaying(null);
          }
        },
      });

      rzp.on("payment.failed", (response: { error: { description: string } }) => {
        showToast(`Payment failed: ${response.error.description}`, false);
        setPaying(null);
      });

      // Fires when user closes the modal without paying
      rzp.on("payment.cancelled", () => {
        setPaying(null);
      });

      rzp.open();
    } catch {
      showToast("Could not start checkout. Please try again.", false);
      setPaying(null);
    }
  }

  const currentPlan = subscription?.plan ?? "free";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg, #f9fafb)", color: "var(--fg, #111)", fontFamily: "inherit" }}>

      {/* Nav */}
      <div style={{ borderBottom: "1px solid var(--border, #e5e7eb)", background: "var(--surface, #fff)", padding: "0 24px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", height: 56, display: "flex", alignItems: "center" }}>
          <button
            onClick={() => { window.location.href = "/dashboard"; }}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "var(--fg-muted, #6b7280)", fontSize: 14 }}
          >
            <ArrowLeft size={14} /> Back to dashboard
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "60px 24px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(99,102,241,0.1)", color: "var(--primary, #6366f1)", borderRadius: 999, padding: "4px 12px", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
            <Sparkles size={13} /> Plans &amp; Pricing
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 12px" }}>
            Choose your plan
          </h1>
          <p style={{ fontSize: 16, color: "var(--fg-muted, #6b7280)", margin: 0 }}>
            Connect more PCs and remove transfer limits.
          </p>
        </div>

        {/* Current plan info */}
        {currentPlan !== "free" && subscription && (
          <div style={{ maxWidth: 480, margin: "0 auto 40px", padding: "14px 20px", borderRadius: 12, border: "1px solid var(--border, #e5e7eb)", background: "var(--surface, #fff)", fontSize: 14 }}>
            <strong>{currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} plan</strong>
            {" — "}{subscription.status}
            {subscription.renewalDate && (
              <span style={{ color: "var(--fg-muted, #6b7280)" }}>
                {" · "}Renews {new Date(subscription.renewalDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            )}
          </div>
        )}

        {/* Plan cards */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--fg-muted, #6b7280)" }}>Loading…</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            {PLANS.map((plan) => {
              const isCurrent    = currentPlan === plan.id;
              const isHighlighted = plan.highlight;

              return (
                <div
                  key={plan.id}
                  style={{
                    borderRadius: 16,
                    border: isHighlighted
                      ? "2px solid var(--primary, #6366f1)"
                      : "1px solid var(--border, #e5e7eb)",
                    background: "var(--surface, #fff)",
                    padding: 28,
                    position: "relative",
                    boxShadow: isHighlighted ? "0 4px 24px rgba(99,102,241,0.12)" : undefined,
                  }}
                >
                  {isHighlighted && (
                    <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "var(--primary, #6366f1)", color: "#fff", borderRadius: 999, padding: "3px 14px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                      <Zap size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
                      Most popular
                    </div>
                  )}

                  {isCurrent && (
                    <div style={{ position: "absolute", top: 14, right: 14, background: "rgba(34,197,94,0.12)", color: "#16a34a", borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
                      Current
                    </div>
                  )}

                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{plan.name}</div>
                    <div style={{ fontSize: plan.price === "Free" ? 36 : 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
                      {plan.price}
                    </div>
                  </div>

                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", display: "grid", gap: 10 }}>
                    {plan.features.map((f) => (
                      <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                        <span style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(99,102,241,0.12)", color: "var(--primary, #6366f1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Check size={11} />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <button disabled style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "1px solid var(--border, #e5e7eb)", background: "var(--surface-raised, #f3f4f6)", color: "var(--fg-muted, #6b7280)", fontWeight: 600, fontSize: 14, cursor: "default" }}>
                      Current plan
                    </button>
                  ) : plan.id === "free" ? (
                    <button disabled style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "1px solid var(--border, #e5e7eb)", background: "transparent", color: "var(--fg-muted, #6b7280)", fontWeight: 600, fontSize: 14, cursor: "default" }}>
                      Downgrade
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUpgrade(plan.id as "pro" | "team")}
                      disabled={!!paying}
                      style={{
                        width: "100%", padding: "11px 0", borderRadius: 10, border: "none",
                        background: isHighlighted ? "var(--primary, #6366f1)" : "var(--fg, #111)",
                        color: "#fff", fontWeight: 700, fontSize: 14,
                        cursor: paying ? "wait" : "pointer",
                        opacity: paying && paying !== plan.id ? 0.5 : 1,
                        transition: "opacity 0.15s",
                      }}
                    >
                      {paying === plan.id ? "Opening payment…" : `Upgrade to ${plan.name}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p style={{ textAlign: "center", marginTop: 40, fontSize: 13, color: "var(--fg-muted, #6b7280)" }}>
          Secure payments via Razorpay. Prices in INR.{" "}
          <a href="mailto:support@pc2cloud.com" style={{ color: "var(--primary, #6366f1)", textDecoration: "none" }}>
            Need help?
          </a>
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: toast.ok ? "var(--fg, #111)" : "#dc2626",
          color: "#fff", borderRadius: 10, padding: "12px 20px",
          fontSize: 14, fontWeight: 500, boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          zIndex: 9999, whiteSpace: "nowrap",
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
