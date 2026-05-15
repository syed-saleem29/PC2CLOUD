"use client";
import { useState, useEffect } from "react";
import { Cloud, Monitor, Download, ArrowRight, Check, ChevronDown, Wifi, Shield, Zap, Folder, RefreshCw, Globe } from "lucide-react";

type Theme = "system" | "light" | "dark";

function useTheme() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored) setTheme(stored);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (theme === "dark" || (theme === "system" && prefersDark)) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  return { theme, setTheme };
}

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === "dark") return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
  if (theme === "light") return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

const features = [
  { icon: <Wifi size={20} />, title: "Instant Remote Access", desc: "Connect to your PC from anywhere — browser, phone, or our desktop app. Low-latency, no port-forwarding required." },
  { icon: <Folder size={20} />, title: "File Management", desc: "Browse, upload, download, and delete files on your remote machine. Full folder support with real-time progress." },
  { icon: <Shield size={20} />, title: "Secure by Default", desc: "End-to-end encrypted transfers, JWT auth, and OTP email verification protect every session." },
  { icon: <RefreshCw size={20} />, title: "Always in Sync", desc: "Live device status, online/offline detection, and auto-reconnect keep you in touch even on flaky networks." },
  { icon: <Zap size={20} />, title: "Blazing Fast", desc: "Built on a high-performance relay server with persistent WebSocket connections. Upload and stream without lag." },
  { icon: <Globe size={20} />, title: "Works Everywhere", desc: "Web dashboard + native Electron desktop app for Windows. Access your files from any device, anywhere." },
];

const steps = [
  { n: "01", title: "Create your account", desc: "Sign up free in 30 seconds — no credit card required. Verify your email and you're in." },
  { n: "02", title: "Install the desktop agent", desc: "Download the lightweight PC2CLOUD agent for Windows. It runs silently in the background and connects to the relay server." },
  { n: "03", title: "Access from anywhere", desc: "Open the web dashboard or the companion app from any device. Your PC appears online and ready." },
];

const pricing = [
  {
    name: "Free", price: "$0", period: "/mo", desc: "Get started, no strings attached.",
    cta: "Get started free", ctaHref: "/dashboard", featured: false,
    features: ["1 PC", "5 GB file transfer / mo", "Web dashboard", "Basic file manager", "Community support"],
  },
  {
    name: "Pro", price: "$4", period: "/mo", desc: "Everything you need for personal use.",
    cta: "Start free trial", ctaHref: "/dashboard", featured: true,
    features: ["3 PCs", "Unlimited file transfer", "Web + desktop access", "Advanced file manager", "Priority support", "Usage analytics"],
  },
  {
    name: "Team", price: "$12", period: "/mo", desc: "For teams sharing PC resources.",
    cta: "Contact sales", ctaHref: "mailto:hello@pc2cloud.com", featured: false,
    features: ["10 PCs", "Unlimited everything", "Team workspace", "Admin controls", "SSO / SAML", "SLA + dedicated support"],
  },
];

const faqs = [
  { q: "Is PC2CLOUD safe to use?", a: "Yes. All connections are authenticated with JWT tokens, all file transfers are authorized server-side, and email OTP is required for new accounts. Your PC agent only accepts commands from authenticated sessions." },
  { q: "Does it work if my PC is behind a router or firewall?", a: "Yes. The desktop agent initiates an outbound connection to our relay server, so no inbound ports need to be opened on your router." },
  { q: "What operating systems are supported?", a: "The web dashboard works in any modern browser. The desktop agent currently supports Windows 10/11. macOS and Linux agents are on the roadmap." },
  { q: "How is this different from TeamViewer or AnyDesk?", a: "PC2CLOUD focuses on file management and background access rather than screen sharing. It's lighter, faster for file tasks, and designed for developers and power users who need remote storage access, not remote desktop." },
  { q: "Can I try it for free?", a: "Absolutely. The Free plan is free forever with 1 PC and 5 GB/mo of transfers. No credit card needed." },
];

export default function Marketing() {
  const { theme, setTheme } = useTheme();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  function cycleTheme() {
    const order: Theme[] = ["system", "light", "dark"];
    setTheme(order[(order.indexOf(theme) + 1) % order.length]);
  }

  return (
    <>
      {/* Nav */}
      <nav className="nav">
        <div className="nav-inner container">
          <a href="/" className="logo" aria-label="PC2CLOUD home">
            <div className="logo-mark">
              <Cloud size={16} color="white" aria-hidden />
            </div>
            <span className="logo-text">PC2CLOUD</span>
          </a>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="nav-actions">
            <button onClick={cycleTheme} className="theme-btn" aria-label="Toggle theme" title={`Theme: ${theme}`}>
              <ThemeIcon theme={theme} />
            </button>
            <a href="/dashboard" className="btn btn-ghost">Sign in</a>
            <a href="/dashboard" className="btn btn-primary">
              <Download size={14} aria-hidden /> Download
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-blob hero-blob-1" aria-hidden />
        <div className="hero-blob hero-blob-2" aria-hidden />
        <div className="hero-blob hero-blob-3" aria-hidden />
        <div className="hero-inner container">
          <div className="chip hero-eyebrow">
            <span className="dot" style={{ color: "var(--brand-600)" }} />
            Now in beta — free for early adopters
          </div>
          <h1 className="hero-title h1">
            Your PC,<br />
            <span className="gradient-text">anywhere you go.</span>
          </h1>
          <p className="hero-sub body">
            PC2CLOUD streams your files and connects to your desktop PC from any device — browser, phone, or app.
            No port-forwarding. No VPN. Just works.
          </p>
          <div className="hero-cta">
            <a href="/dashboard" className="btn btn-primary btn-lg">
              Get started free <ArrowRight size={16} aria-hidden />
            </a>
            <a href="#how-it-works" className="btn btn-secondary btn-lg">
              <Monitor size={16} aria-hidden /> See how it works
            </a>
          </div>
          <div className="hero-meta">
            <div>No credit card required</div>
            <div>Free plan available</div>
            <div>Setup in 2 minutes</div>
          </div>

          {/* Product mock */}
          <div className="hero-mock-wrap">
            <div className="hero-mock">
              <div className="hero-mock-chrome">
                <div className="dots"><span /><span /><span /></div>
                <div className="hero-mock-tab">pc2cloud.app/dashboard</div>
                <div />
              </div>
              <div className="hero-mock-body">
                <div className="mock-sidebar">
                  <div className="mock-sidebar-logo">
                    <div className="mock-sidebar-icon"><Cloud size={12} /></div>
                    PC2CLOUD
                  </div>
                  {["Dashboard", "Files", "Devices", "Settings"].map((item, i) => (
                    <div key={item} className={`mock-nav-item${i === 0 ? " active" : ""}`}>{item}</div>
                  ))}
                </div>
                <div className="mock-main">
                  <div className="mock-stats">
                    {[{ label: "PCs Online", value: "2/3" }, { label: "Files Synced", value: "1,284" }, { label: "Transferred", value: "4.2 GB" }].map(s => (
                      <div key={s.label} className="mock-stat">
                        <div className="mock-stat-val">{s.value}</div>
                        <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mock-file-list">
                    {["Documents", "Projects", "Downloads", "Desktop"].map((name, i) => (
                      <div key={name} className="mock-file-row">
                        <div className="mock-file-icon" style={{ background: ["#dbeafe","#dcfce7","#fef9c3","#f3e8ff"][i] }}>
                          <Folder size={12} style={{ color: ["#2563eb","#16a34a","#ca8a04","#9333ea"][i] }} />
                        </div>
                        <span className="mock-file-name">{name}</span>
                        <span className="mock-file-size">{["2.4 GB","1.1 GB","890 MB","340 MB"][i]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* Floating cards */}
            <div className="float-card float-card-1">
              <div className="float-card-icon float-card-icon-success"><Check size={12} /></div>
              <div>
                <div className="float-card-title">PC Online</div>
                <div className="float-card-sub">DESKTOP-A4K9 connected</div>
              </div>
            </div>
            <div className="float-card float-card-2">
              <div className="float-card-mini"><Zap size={10} /></div>
              <div>
                <div className="float-card-title">Upload complete</div>
                <div className="float-card-sub">report_final.pdf · 1.2 MB</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature strip */}
      <section className="strip">
        <div className="container">
          <div className="strip-row">
            {[
              { icon: <Shield size={15} />, text: "End-to-end encrypted" },
              { icon: <Zap size={15} />, text: "Sub-100ms latency" },
              { icon: <Globe size={15} />, text: "Works in any browser" },
              { icon: <RefreshCw size={15} />, text: "Always-on relay server" },
              { icon: <Folder size={15} />, text: "Full file management" },
              { icon: <Monitor size={15} />, text: "Native desktop agent" },
            ].map(item => (
              <div key={item.text} className="strip-item">
                <span className="strip-icon">{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section id="features" className="section">
        <div className="container">
          <div className="section-header section-header-center">
            <div className="eyebrow" style={{ marginBottom: 12 }}>Features</div>
            <h2 className="section-title">Everything you need to work remotely</h2>
            <p className="section-desc">Built for developers, power users, and anyone who needs their files accessible wherever they are.</p>
          </div>
          <div className="features-grid">
            {features.map(f => (
              <div key={f.title} className="feature-card">
                <div className="feature-icon">{f.icon}</div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="section section-alt">
        <div className="container">
          <div className="section-header section-header-center">
            <div className="eyebrow" style={{ marginBottom: 12 }}>How it works</div>
            <h2 className="section-title">Up and running in minutes</h2>
            <p className="section-desc">No complex setup. No IT department. Just install, connect, and go.</p>
          </div>
          <div className="steps">
            {steps.map(s => (
              <div key={s.n} className="step">
                <div className="step-number">{s.n}</div>
                <h3 className="step-title">{s.title}</h3>
                <p className="step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="section">
        <div className="container">
          <div className="section-header section-header-center">
            <div className="eyebrow" style={{ marginBottom: 12 }}>Pricing</div>
            <h2 className="section-title">Simple, transparent pricing</h2>
            <p className="section-desc">Start free. Upgrade when you need more. No surprise fees.</p>
          </div>
          <div className="pricing-grid">
            {pricing.map(plan => (
              <div key={plan.name} className={`price-card${plan.featured ? " price-card-featured" : ""}`}>
                {plan.featured && <div className="price-badge">Most popular</div>}
                <div className="price-name">{plan.name}</div>
                <div className="price-card-amount">
                  <span className="price-amount">{plan.price}</span>
                  <span className="price-period">{plan.period}</span>
                </div>
                <p style={{ fontSize: 14, color: "var(--fg-muted)", margin: "0 0 20px" }}>{plan.desc}</p>
                <ul className="price-list">
                  {plan.features.map(f => (
                    <li key={f}>
                      <Check size={14} className="pricing-check" />
                      {f}
                    </li>
                  ))}
                </ul>
                <a href={plan.ctaHref} className={`btn btn-lg${plan.featured ? " btn-primary" : " btn-outline"}`} style={{ justifyContent: "center" }}>
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="section section-alt">
        <div className="container section-narrow" style={{ margin: "0 auto" }}>
          <div className="section-header section-header-center">
            <div className="eyebrow" style={{ marginBottom: 12 }}>FAQ</div>
            <h2 className="section-title">Common questions</h2>
          </div>
          <div className="faq">
            {faqs.map((faq, i) => (
              <div key={i} className={`faq-item${openFaq === i ? " open" : ""}`}>
                <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}>
                  <span>{faq.q}</span>
                  <ChevronDown size={16} className="faq-chevron" aria-hidden />
                </button>
                {openFaq === i && <div className="faq-a">{faq.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta">
        <div className="container">
          <div className="cta-card">
            <div className="cta-glow" aria-hidden />
            <h2 className="h2" style={{ color: "white", marginBottom: 16 }}>Start accessing your PC from anywhere.</h2>
            <p className="body" style={{ color: "rgba(255,255,255,0.65)", marginBottom: 32 }}>Join thousands of users who never lose access to their files again.</p>
            <div className="hero-cta">
              <a href="/dashboard" className="btn btn-lg cta-btn-primary">
                Get started free <ArrowRight size={16} aria-hidden />
              </a>
              <a href="/dashboard" className="btn btn-lg cta-btn-ghost">
                Sign in to dashboard
              </a>
            </div>
            <p className="cta-sub">Free forever on the Free plan. No credit card required.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <a href="/" className="logo" aria-label="PC2CLOUD home">
                <div className="logo-mark" style={{ width: 24, height: 24, borderRadius: 6 }}>
                  <Cloud size={13} color="white" aria-hidden />
                </div>
                <span className="logo-text">PC2CLOUD</span>
              </a>
              <p className="footer-tagline">Your PC, anywhere you go.</p>
            </div>
            <div className="footer-col">
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <a href="#how-it-works">How it works</a>
              <a href="/dashboard">Download</a>
            </div>
            <div className="footer-col">
              <h4>Account</h4>
              <a href="/dashboard">Sign in</a>
              <a href="/dashboard">Create account</a>
              <a href="/dashboard">Dashboard</a>
            </div>
            <div className="footer-col">
              <h4>Company</h4>
              <a href="#">About</a>
              <a href="#">Blog</a>
              <a href="#">Contact</a>
              <a href="#">Privacy policy</a>
            </div>
          </div>
          <div className="footer-bottom">
            <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>
              &copy; {new Date().getFullYear()} PC2CLOUD. All rights reserved.
            </span>
            <span style={{ fontSize: 13, color: "var(--fg-subtle)" }}>
              Built with care for remote workers everywhere.
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
