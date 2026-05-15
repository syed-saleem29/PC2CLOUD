---
name: pc2cloud-design
description: Use this skill to generate well-branded interfaces, marketing material, and assets for PC2CLOUD — either for production or for throwaway prototypes/mocks. Contains the full design system, three production-ready HTML surfaces, all brand assets, and the React component library.
user-invocable: true
---

Read `README.md` for the full overview. The short version:

**PC2CLOUD** is a "turn your old PC into a private cloud" platform. This skill ships three production-ready HTML artifacts plus a complete design system.

## The three surfaces

| File | When to use |
| --- | --- |
| `marketing.html` | Landing page · hero, features, pricing, FAQ |
| `app.html` | Authenticated web dashboard · devices, storage, activity, security, settings |
| `desktop.html` | Electron client · login, setup, "PC is connected" |

All three import `ui.css` (which imports `tokens.css`) and `icons.js`. Components in `app/` and `desktop/` are React/JSX, loaded via Babel standalone.

## Building new things

If you need a **new marketing page**, copy `marketing.html` as a skeleton and pull the patterns you need (`.hero`, `.feature-card`, `.price-card`, `.cta-card`). Update `marketing.css` only if you need a new section type.

If you need a **new dashboard screen**, add a new JSX file under `app/`, follow the `Devices.jsx` / `Settings.jsx` structure, and wire it into `App.jsx`'s section switch. Reuse `.page`, `.page-head`, `.stat-card`, `.settings-section`, `.btn-*`, `.chip-*`.

If you need a **new desktop screen**, drop it in `desktop/`, add it to the screen state machine in `desktop/App.jsx`, and follow the existing screens' pattern of centered content with a single primary action button at the bottom.

If you're producing **a throwaway slide deck or asset**, lift `tokens.css` into a new file and reference `assets/icon.svg` directly. Don't reinvent the wheel.

## Hard rules to enforce

- **`PC2CLOUD` is always all-caps.** Never `PC2Cloud`, never lowercase. The wordmark in the logo lockup has `letter-spacing: 0.10em`.
- **Headings are sentence case** — "Set up storage", never "Set Up Storage".
- **Lucide icons only.** `1.75` stroke, `aria-hidden="true"`. Sizes come from a fixed set: `11 / 13 / 14 / 15 / 16 / 20`. Pull glyphs via `icons.js` — both the HTML `icon()` helper and the React `<ReactIcon>` component are exposed.
- **One brand color (`--brand-600`).** Cyan is reserved for gradient pops (logo mark, "Your cloud." hero, a couple of accent cards). Never use cyan as a flat fill.
- **Theme is system-adaptive.** Default to `prefers-color-scheme`. One toggle button cycles `System → Light → Dark`. Override persists in `localStorage` under `pc2cloud_theme`.
- **No emoji** in product UI. (One historical exception 📁 — don't extend it.)
- **Progressive states use the ellipsis character** (`Syncing…`, not `Syncing...`).

## If the user invokes this skill cold

Ask what they want to build. Likely directions:
1. A new marketing-site page or section
2. A new screen for the web dashboard
3. A new screen for the desktop client
4. A throwaway mock or slide deck
5. Production handoff (Tailwind config, Figma export)

Then ask 3–5 scoping questions, then build.
