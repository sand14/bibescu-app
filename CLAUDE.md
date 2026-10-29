# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build (standalone output)
npm start        # Start production server
npm run lint     # Run ESLint (next/core-web-vitals)
```

No test suite exists in this project.

## Environment

- `GOOGLE_MAPS_API_KEY`: Required for Google Maps JS API and Static Maps satellite thumbnails. Exposed to the client via `GET /api/config`.
- `DATA_DIR`: Optional path to data storage directory (defaults to `./data` in dev, `/app/data` in Docker). Stores SQLite database (`bibescu.db`) and user PDF reports (`reports/<userId>/`).

## Architecture

Next.js 16 (App Router) with client components and backend route handlers.

### Frontend
- **`app/components/GoogleMaps.tsx`** — primary flight planning UI:
  - Dynamically loads Google Maps JS API via `@googlemaps/js-api-loader`
  - Marker placement (SP/FP + T1–T5) and polygon area restriction
  - Spherical geometry calculations (distances, headings, cumulative flight times)
  - Exports PDF reports (`jspdf` + `jspdf-autotable`) and auto-archives them to the user's account when logged in
  - Exports `.crs` route files
- **`app/context/AuthContext.tsx`** — React context for authentication state (`user`, `login`, `register`, `logout`) and modal visibility (`AuthModal`, `ReportsModal`, `Toast`).
- **`app/components/NavbarAuth.tsx`** — Top bar navigation controls (Login/Register or User chip + "My Reports" + Logout).
- **`app/components/AuthModal.tsx`** — Modal dialog for signing in or registering a local account.
- **`app/components/ReportsModal.tsx`** — Modal dialog for browsing, previewing, downloading, or deleting saved PDF reports.
- **`app/components/Toast.tsx`** — Notification feedback banner for downloads, saves, and logins.

### Backend & Storage
- **`lib/db.ts`** — Local SQLite database initialized using Node.js built-in `node:sqlite` (`DatabaseSync`). WAL mode enabled.
  - Tables: `users`, `sessions`, `reports`.
- **`lib/auth.ts`** — Password hashing with `crypto.scryptSync` + random salt, session generation, timing-safe verification, and HTTP-only cookie management (`bibescu_auth_token`).
- **`lib/reports.ts`** — Helpers for managing the user reports directory on disk.
- **`app/api/auth/*`** — Authentication routes (`/register`, `/login`, `/logout`, `/me`).
- **`app/api/reports/*`** — User-isolated report upload, listing, downloading, and deletion.
- **`app/api/config/route.ts`** — Returns `{ googleMapsApiKey }` from `process.env.GOOGLE_MAPS_API_KEY`.
- **`app/api/tile/route.ts`** — Proxies OpenStreetMap tile requests (`/api/tile?z=&x=&y=`) to avoid CORS issues.

## Deployment

Docker image published to `sand14/bibescu-app` (Linux ARM64) via GitHub Actions on release.
`next.config.js` sets `output: "standalone"`. Mount `/app/data` to persist user accounts and PDF reports across container updates.
