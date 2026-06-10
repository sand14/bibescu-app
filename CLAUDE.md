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

Requires `GOOGLE_MAPS_API_KEY` environment variable. The key is exposed to the client via `GET /api/config` rather than directly in the client bundle.

## Architecture

Single-page Next.js 16 (App Router) app with one primary client component and two API routes.

**`app/components/GoogleMaps.tsx`** — the entire application UI lives here (~700 lines). It is a `"use client"` component that:
- Loads the Google Maps JS API dynamically via `@googlemaps/js-api-loader`
- Manages all state with React `useState`/`useRef` (no external state library)
- Allows placing up to 6 markers (SP/FP + T1–T5); on the 6th marker the route closes back to start
- Calculates distances using `google.maps.geometry.spherical.computeDistanceBetween`
- Exports PDF reports via `jspdf` + `jspdf-autotable`, fetching satellite images from Google Static Maps API and OSM tiles from the local tile proxy

**`app/api/config/route.ts`** — returns `{ googleMapsApiKey }` from `process.env.GOOGLE_MAPS_API_KEY`.

**`app/api/tile/route.ts`** — proxies OpenStreetMap tile requests (`/api/tile?z=&x=&y=`) to avoid CORS issues, with 1-hour server-side cache headers.

## PDF Export

Two export modes:
- **Standard Report (A4)**: 6 satellite thumbnails (one per marker) + data table + OSM overview map
- **A3 Map**: Single full-page OSM route map for printing

OSM map generation (`generateOSMMapImage`) builds a canvas by fetching tiles through `/api/tile`, then draws the polyline, marker labels, and a scale bar on top.

## Deployment

Docker image published to `sand14/bibescu-app` (Linux ARM64) via GitHub Actions on release. `next.config.js` sets `output: "standalone"` for the container build.
