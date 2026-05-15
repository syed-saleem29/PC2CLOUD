# PC2CLOUD Design System

> Production-ready design system for **PC2CLOUD** — a "turn your old PC into a private cloud" platform. Includes a marketing landing page, a polished web dashboard, and a refined desktop client. Built for shipping.

---

## Quick start

| Open | What it is |
| --- | --- |
| [`marketing.html`](./marketing.html) | Public landing page — hero, features, how-it-works, pricing, FAQ |
| [`app.html`](./app.html) | Authenticated web dashboard — devices, storage, activity, security, settings |
| [`desktop.html`](./desktop.html) | Electron client — login, setup, "PC is connected" |

All three share one design system: `tokens.css` (raw vars) + `ui.css` (component primitives) + `icons.js` (Lucide). Open any file in a browser; everything works offline.

---

## What's in this folder

```
.
├── README.md                  ← you are here
├── SKILL.md                   ← Claude Skill manifest

├── tokens.css                 ← raw design tokens (color, type, radii, shadow, motion)
├── ui.css                     ← shared component CSS (buttons, inputs, cards, chips, logo)
├── icons.js                   ← Lucide icon helper (HTML + React bindings)

├── marketing.html             ← landing page
├── marketing.css              ← landing-only styles

├── app.html                   ← web dashboard shell
├── app.css                    ← dashboard styles
└── app/                       ← React (JSX) components for the dashboard
    ├── App.jsx                ← root + theme manager
    ├── data.jsx               ← fake devices/files + format helpers
    ├── Auth.jsx               ← login / register / OTP / forgot / reset
    ├── Sidebar.jsx            ← left nav + user row + upgrade card
    ├── Devices.jsx            ← devices list with stat cards
    ├── Storage.jsx            ← file browser
    ├── Security.jsx           ← 2FA, sessions, linked devices
    └── Settings.jsx           ← profile, appearance, sync, danger zone

├── desktop.html               ← Electron client shell
├── desktop.css                ← desktop-only styles (title bar, mica window)
└── desktop/                   ← React components for the desktop client
    ├── App.jsx                ← screen state machine
    ├── Frame.jsx              ← title bar + window chrome
    ├── Login.jsx              ← sign in + OTP + forgot/reset
    ├── Setup.jsx              ← folder picker → confirm → done
    └── Ready.jsx              ← "PC is connected" + transfers + actions

└── assets/                    ← logos, icons, screenshots (from the source repo)
    ├── icon.svg               ← canonical brand mark (cloud over monitor, gradient)
    ├── icon-{32,180,192,512}.png · favicon.ico
    ├── desktop-icon.svg · tray.png
    ├── pc2cloud-logo-{1,2,2-enhanced}.png   ← marketing PNGs
    └── screenshot-preview-{1,2}.png
```

---

## Design language

### Voice
Practical, helpful, slightly understated. Second person ("your hardware, your cloud"). **Brand name is always all-caps `PC2CLOUD`.** Headings are sentence case. Progressive states use the ellipsis character (`Signing in…`, `Syncing…`). Success toasts past-tense, no period. Destructive confirms always include "This cannot be undone."

### Type
**Geist** for sans (display + body), **Geist Mono** for paths, IDs, file sizes. Both from Google Fonts. Scale: `11 / 12 / 13 / 15 / 17 / 21 / 28 / 36 / 48 / 84` px depending on context.

### Color
**Primary: `--brand-600` (`#2563eb`)** — Tailwind `blue-600`. One color does all the work. The only place secondary color appears is the **brand gradient** (`#3b82f6 → #1e40af → #22d3ee`) on the logo mark, hero "Your cloud." headline, and a few floating accents. Cyan is *never* used as a flat fill.

Neutrals: slate-tinted greys (`#0a0f1a → #f7f8fa`). Semantic: `success #16a34a`, `warning #d97706`, `danger #dc2626`, always rendered as `bg / 10% + border / 25% + saturated text`.

### Theme
**System-adaptive by default.** A single button (top bar on web, title bar on desktop) cycles `System → Light → Dark → System`. Icon reflects current state. User override persists in `localStorage`. When set to System, the page reacts live to OS theme toggles.

### Iconography
**Lucide everywhere**, served via inline SVG (no font, no sprite). `1.75` stroke weight. `aria-hidden="true"` on every icon — buttons/labels provide the accessible name. Common sizes: `11 / 13 / 14 / 15 / 16 / 20`.

### Motion
Restrained. The system uses one easing (`cubic-bezier(0.16, 1, 0.3, 1)`) and three durations (`120ms / 180ms / 280ms`). Animated touches: gradient blobs in the hero, a gradient-text shimmer on "Your cloud", a 1.8s ping on the green "connected" dot, hover-lift on feature cards, and a shimmer on active upload bars. `prefers-reduced-motion` disables all of it.

### Radii / shadows
Radii: `4 / 6 / 8 / 10 / 14 / 20 / 9999`. Shadows live in `tokens.css` (`--shadow-xs/sm/md/lg/xl` plus a brand-tinted `--shadow-glow` and `--shadow-ring` for focus rings). Borders carry most separation work; shadows are used sparingly for elevation moments (auth card, hero mock, transfer notifications).

---

## Source

Built by reverse-engineering and then elevating the codebase at:

- **GitHub:** [`syed-saleem29/PC2CLOUD`](https://github.com/syed-saleem29/PC2CLOUD) — public source. Browse it to see how the production code maps to these designs. The current Windows installer is at [releases/v0.1.0](https://github.com/syed-saleem29/PC2CLOUD/releases).
- **Codebase:** mounted as `PC2CLOOUD/` (read-only). Key files:
  - `apps/web/src/components/dashboard.tsx` — current Next.js dashboard
  - `apps/desktop/src/screens/*.tsx` — current Electron screens
  - `PC2CLOUD_Project_Details.txt` — product spec, architecture, roadmap

When iterating on this design system, treat the GitHub repo as the source of truth for product behaviour, and this design system as the source of truth for visual / interaction language.

---

## What to use this for

- **Producing new screens** — copy a component out of `app/` or `desktop/`, change the props, drop it into a new file. Tokens carry over automatically via `ui.css`.
- **Marketing material** — pull the hero / feature card / pricing card patterns from `marketing.html` and `marketing.css`.
- **Slide decks** — use `tokens.css` to inherit color and type; pull the logo mark from `assets/icon.svg`.
- **Production handoff** — port `tokens.css` into Tailwind theme variables; the values translate 1:1. Geist is on Google Fonts (free, no key).

---

## Caveats / next steps

- **Geist substitution** — if you're exporting to PPTX/PDF and the renderer can't load Google Fonts, Inter is the closest free substitute. Document the swap.
- **Mobile responsive** — the dashboard chrome assumes >= 980px. Below that, the sidebar would need to collapse to a drawer; not built yet.
- **Real data** — `app/data.jsx` is fake. Wire it to the existing `apps/web/src/lib/api.ts` endpoints to ship.
- **Activity feed** — currently shows a representative sample. Hook it into the backend's `activity_log` collection (not yet implemented in the repo, but is part of the roadmap).
