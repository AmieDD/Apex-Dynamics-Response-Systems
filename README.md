# Apex Dynamics Response Systems

[![Deploy to GitHub Pages](https://github.com/AmieDD/Apex-Dynamics-Response-Systems/actions/workflows/deploy.yml/badge.svg)](https://github.com/AmieDD/Apex-Dynamics-Response-Systems/actions/workflows/deploy.yml)

> Live demo: https://amiedd.github.io/Apex-Dynamics-Response-Systems/

## Project Titan Watch: A mocked emergency-response command-center prototype

<img src="public/Clipzilla.png" alt="Clipzilla, the Apex Dynamics Response Systems mascot, holding a tablet displaying the command-center dashboard" width="320">

## What this repo is
Apex Dynamics Response Systems is a command-center prototype for an emergency disaster response scenario. A Apex Dynamics Response Systems — fuses imagery, sensor networks, incident reports, and public social signals into a single situational picture for first responders: damage assessment, response prioritization, evacuation planning, and shared situational awareness.
The prototype is a command-center view — situational dashboard, multi-source feed, severity telemetry. Mocked feeds. No live connections.

This repo is an Vite + React frontend and only that. Everything is mocked end to end: no backend, no live data, nothing production-grade. That's the point. 

Renders ≠ verified. A demo that looks done and code that's production-ready are different artifacts.

## Getting Started

### Prerequisites

* Node.js 20.19+ or 22.12+ (Vite 8 requires it; Node 22 LTS recommended).
* npm (this repo ships a `package-lock.json`).
* Internet access for `npm install` and, at runtime, for the map basemap tiles.

No `.env` file, API keys, or backend are required. The app is mocked end to end.

### Install and run

```bash
# Install dependencies (use npm ci for a clean, lockfile-exact install)
npm install

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
```

### Notes

* `npm run dev` does not type-check, while `npm run build` runs a strict `tsc -b` first, so a build can fail even when the dev server runs cleanly.
* The map basemap loads tiles over HTTPS from `tiles.openfreemap.org` (OpenFreeMap: MIT style, OpenStreetMap/ODbL data). Offline, the map renders blank but the rest of the app still loads.

### Telemetry

To opt-in to hve telemetry, create a `.hve-telemetry` file in the project root. More information on what is gathered [here](https://github.com/microsoft/hve-core/blob/main/docs/customization/local-telemetry.md):

#### Linux/macOS:

##### Prerequisites

- bash 3.5+
- Python 3.8+ (shipped with macOS 12+ and most Linux distros)

```bash
# create .hve-telemetry in the project root
touch .hve-telemetry
```

Generate the report which will be saved to `telemetry-report.html` in `.copilot-tracking/telemetry`:

```bash
# generate the telemetry report for today
.github/hooks/shared/telemetry/generate-telemetry-report.sh

# generate the telemetry report for all days
.github/hooks/shared/telemetry/generate-telemetry-report.sh -d all

# you can open the generated html in a browser after generation or generate and view the telemetry report
.github/hooks/shared/telemetry/generate-telemetry-report.sh --open
```

#### Windows (PowerShell):

##### Prerequisites

- PowerShell 7.4+
- Python 3.8+ (shipped with Windows 10+ and most Windows Server versions)

```powershell
# create .hve-telemetry in the project root
New-Item -Path . -Name ".hve-telemetry" -ItemType "file"
```

Generate the report which will be saved to `telemetry-report.html` in `.copilot-tracking/telemetry`:

```powershell
# generate the telemetry report for today
pwsh .github/hooks/shared/telemetry/Invoke-TelemetryReport.ps1

# generate the telemetry report for all days
pwsh .github/hooks/shared/telemetry/Invoke-TelemetryReport.ps1 -Date all

# you can open the generated html in a browser after generation or generate and view the telemetry report
pwsh .github/hooks/shared/telemetry/Invoke-TelemetryReport.ps1 -Open
```
