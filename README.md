# Apex Dynamics Response Systems

[![Deploy to GitHub Pages](https://github.com/AmieDD/Apex-Dynamics-Response-Systems/actions/workflows/deploy.yml/badge.svg)](https://github.com/AmieDD/Apex-Dynamics-Response-Systems/actions/workflows/deploy.yml)

> Live demo: https://amiedd.github.io/Apex-Dynamics-Response-Systems/

## Project Titan Watch: A mocked emergency-response command-center prototype

<img src="public/Clipzilla.png" alt="Clipzilla, the Apex Dynamics Response Systems mascot, holding a tablet displaying the command-center dashboard" width="320">

## What this repo is
Apex Dynamics Response Systems is a command-center prototype for an emergency disaster response scenario. Apex Dynamics Response Systems — fuses imagery, sensor networks, incident reports, and public social signals into a single situational picture for first responders: damage assessment, response prioritization, evacuation planning, and shared situational awareness.
The prototype is a command-center view — situational dashboard, multi-source feed, severity telemetry. Mocked feeds. No live connections.

This repo is an Vite + React frontend and only that. Everything is mocked end to end: no backend, no live data, nothing production-grade. That's the point. 

Renders ≠ verified. A demo that looks done and code that's production-ready are different artifacts.

## Getting Started

### Prerequisites

* Node.js 22.18 or newer (enforced by the `engines` field in `package.json`; CI runs Node 22).
* npm (bundled with Node; this repo ships a `package-lock.json`).
* Git, to clone the repository.
* Internet access for `npm ci` and, at runtime, for the map basemap tiles.

No `.env` file, API keys, or backend are required. The app is mocked end to end.

### Install and run

```bash
# Clone the repository
git clone https://github.com/AmieDD/Apex-Dynamics-Response-Systems.git

# Change into the repository directory
cd Apex-Dynamics-Response-Systems

# Install dependencies exactly as pinned in package-lock.json
npm ci

# Start the dev server with hot reload at http://localhost:5173/
npm run dev

# Expose the dev server on your local network
npm run dev -- --host
```

### Other scripts

```bash
# Type-check (tsc -b) then build to dist/
npm run build

# Serve the production build at http://localhost:4173/ (run build first)
npm run preview

# Lint the project
npm run lint

# Run the Vitest suite once
npm test
```

### Notes

* `npm ci` requires the lockfile and wipes `node_modules` first. Use `npm install` only when you intend to change dependency versions.
* `npm run dev` does not type-check, while `npm run build` runs a strict `tsc -b` first, so a build can fail even when the dev server runs cleanly.
* The map basemap loads tiles over HTTPS from `tiles.openfreemap.org` (OpenFreeMap: MIT style, OpenStreetMap/ODbL data). Offline, the map renders blank but the rest of the app still loads.