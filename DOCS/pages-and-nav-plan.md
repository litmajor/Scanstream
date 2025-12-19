**Pages & Navigation Plan**

- **Purpose:** Provide a concise, actionable plan for consolidating pages, reorganizing sidebar navigation, and migrating Scanner/Alerts into a unified flow (Scan → Dashboard Alerts → One-click Entry). This doc lists which pages to keep, merge, archive, implementation steps, testing steps, and a proposed timeline.

**Current Situation (inventory, high level)**
- Core pages present under `client/src/pages`: `dashboard`, `scanner`, `trading-terminal`, `positions`, `portfolio`, `paper-trading`, `signals`, `gateway-scanner`, `gateway-alerts`, `agent-*` pages, `analytics`, `strategies`, `ml-*`, `flow-field`, and various utility pages (`settings`, `profile`, `login`, `register`, etc.).
- Scanner now has a `Run Analysis` button and server endpoints: `POST /api/scanner/run-scan`, `GET /api/scanner/recent`, `GET /api/scanner/top`, `GET /api/scanner/results/:scanId` (DB-backed `ScanRun` records).
- Alerts pipeline: gateway alert system + `signalWebSocketService` broadcasts enriched scan signals. Dashboard now fetches `/api/scanner/top` instead of `localStorage`.

**Primary Goals**
- Make critical trading flows 1–2 clicks from the top nav: Scan → Alert → One-click Entry.
- Remove or hide duplicate/obsolete pages to reduce user confusion.
- Group advanced/ML/agent pages into a secondary hub ("Agents" / "Strategy" / "Advanced") with feature flags or permissions.
- Preserve historical pages (archive) and add deprecation banners + redirects before removal.

**Recommended Nav Structure (top-level + grouped)**
- Top-level (first click):
  - **Dashboard**: central Alerts center + actionable alerts (keep `dashboard.tsx`)
  - **Scanner**: Scan controls, Run Analysis, Agents drawer, quick Trade action (`scanner.tsx`)
  - **Trading Terminal**: full trade UI & market view (`trading-terminal.tsx`)
  - **Positions**: open/closed positions (`positions.tsx`)
  - **Portfolio**: holdings & performance (`portfolio.tsx`)
  - **Paper Trading** (or tab under Trading Terminal) (`paper-trading.tsx`)

- Secondary menu (grouped under icons/sections):
  - **Signals** (explorer): `signals.tsx`, historical signals, classification
  - **Strategy**: `strategies.tsx`, `strategy-synthesis.tsx`, `optimize.tsx`
  - **Agents / Research**: `agent-signal-insights.tsx`, `agent-interactions.tsx`, `agent-arena-hub.tsx`, `rl-position-agent.tsx`
  - **Analytics / Advanced**: `analytics-dashboard.tsx`, `advanced-analytics.tsx`, `flow-field.tsx`, `backtest.tsx`, `signal-performance.tsx` (lazy-load, feature-flagged)
  - **Settings & Account**: `settings.tsx`, `profile.tsx` (not in main nav)

**Pages to Merge / Consolidate**
- `market-intelligence.tsx`, `gateway-scanner.tsx` → Merge into `scanner.tsx` (canonical Scanner). Keep gateway-specific tools in a `Gateway` sub-route or an admin area.
- `signals.tsx` → Integrate as a tab or sub-page under Dashboard/Scanner ("Signal Explorer").
- `gateway-alerts.tsx` → Move into Dashboard Alerts Center or keep as an admin view accessible from Alerts section.

**Pages to Archive or Hide (Advanced / optional)**
- `flow-engine.tsx`, `card-showcase.tsx`, `dashboard-grid.tsx` — archive or move to `DOCS/demos` if they are demos.
- Keep ML/analytics pages behind an "Advanced" toggle or user role.

**Deprecation Strategy**
1. Add a short inline deprecation banner to pages to be merged/removed pointing to the canonical replacement (e.g., top of `market-intelligence.tsx` shows "This page is deprecated — use Scanner → Market Intelligence").
2. Add route redirects for a transitional period (server-side or client-side). Example: route `/market-intelligence` redirects to `/scanner` with a query param `?deprecated_from=market-intelligence`.
3. Monitor usage telemetry (2–4 weeks). If negligible, remove/archive files and routes.

**Developer Implementation Plan (phased)**
Phase 1 — Nav + Discovery (small, high-impact) — 1–2 days
- Create `client/src/config/nav.ts` containing canonical nav entries with metadata (label, route, icon, section, featureFlag, permission).
- Replace sidebar rendering to read from `nav.ts` and render grouped sections (Top, Secondary, Advanced). Use lazy-loading for route components.
- Add a UI toggle (dev-mode or feature flags) to show/hide advanced pages.

Phase 2 — Consolidation (scanner & alerts) — 1–3 days
- Merge `market-intelligence` and `gateway-scanner` into `scanner.tsx` (move unique components into `client/src/components/scanner/*`).
- Ensure `scanner.tsx` exposes `Run Analysis`, `Agent Analysis`, and `Trade` actions (already implemented).
- Wire Dashboard Alerts Center to `GET /api/scanner/top` (already done) and show scan-derived alerts.

Phase 3 — Agents & Strategy grouping — 2–4 days
- Create an "Agents" hub page listing agent tools and linking to `agent-signal-insights`, `agent-interactions`, `agent-arena-hub`.
- Group strategy pages under a Strategy section, add basic crosslinks (Strategy ↔ Backtesting ↔ Optimization).

Phase 4 — Cleanup, deprecations and telemetry — 1–2 weeks
- Add deprecation banners & redirects, collect telemetry, remove archived pages after low usage confirmed.
- Run end-to-end QA (scan → alert → open EntryDialog → paper trade) and fix any regressions.

**Testing & QA Checklist**
- [ ] Server: `POST /api/scanner/run-scan` returns `scanId` and `results` and DB `ScanRun` record created.
- [ ] Server: `GET /api/scanner/top?limit=5` returns top signals sorted by confidence.
- [ ] Client: Scanner `Run Analysis` updates UI and Dashboard alerts appear within 5 seconds.
- [ ] Client: Opening Agent Analysis subscribes to WS symbol updates and receives `symbol_signal` events.
- [ ] UI: Sidebar reflects new grouped nav and feature-flagged pages are hidden by default.
- [ ] Deprecated pages show the deprecation banner and route redirects work.

**Commands & Local Dev Notes**
- Prisma migration (after schema change for `ScanRun`):
```powershell
npx prisma generate
npx prisma migrate dev --name add_scanrun
```
- Start backend (example):
```powershell
pnpm install
pnpm build
pnpm start
```
- Frontend dev (if separate): run your normal frontend dev server (e.g., `pnpm dev` or `pnpm start:client`).

**Telemetry / Metrics**
- Add a small client-side event emitter (or use existing analytics) to log page visits for 2–4 weeks. Flag pages with < 5% of dashboard visits as archive candidates.
- Suggested metric events: `page_view:{route}`, `action:run_scan`, `action:open_agent_analysis`, `action:trade_from_scan`.

**Risk & Mitigations**
- Risk: Users rely on old pages — mitigation: add deprecation banners and redirects for at least one release cycle.
- Risk: Breaking changes across pages — mitigation: incremental consolidation, run CI and manual QA for trade-critical flows.

**Deliverables I can implement next (pick one)**
- A) Create `client/src/config/nav.ts` and wire the sidebar to use it (centralized navigation). [Recommended first step]
- B) Consolidate `market-intelligence.tsx` into `scanner.tsx` and add redirects/banners on the old route.
- C) Add telemetry events and a simple usage dashboard (counts per page) to inform removal decisions.
- D) Add deprecation banners to a selected list of pages.

**Who should review**
- Product/PM: confirm which top-level items must remain one-click.
- Power users / analysts: confirm which Agent pages must be kept visible.
- Developers: review the nav config and migration steps for integration work.

**Next Steps**
- Tell me which deliverable (A/B/C/D) you'd like me to do first. I will implement it and push changes, including tests and a brief demo script for verification.

---
File created at: `DOCS/pages-and-nav-plan.md`
