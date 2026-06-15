// Full-bleed MapLibre command map for the Kaiju Defense Network.
//
// Uses the key-free CARTO dark-matter vector style (no API token required) via
// react-map-gl's MapLibre entry point. Each tracked leviathan advances inbound
// from its open-water spawn toward a named landfall target along a scripted
// track, looping forever — the seam where live HVE Core tracks would plug in.
// Every leviathan renders as a severity-colored, pulsing marker carrying its
// codename initial so identity is never conveyed by color alone
// (accessibility: DR-04), trailing a faint full track, a dashed remaining leg,
// and a small landfall target reticle. On arrival a LANDFALL label flashes and
// the feed logs the repel + reacquire. prefers-reduced-motion freezes the
// advance, placing each leviathan at a meaningful static position instead.

import { useEffect, useRef, useState } from 'react'

import { Layer, Map, Marker, Source, type MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Feature, FeatureCollection, LineString, Point } from 'geojson'

import {
  cycleAt,
  etaToLandfall,
  formatEta,
  fracAt,
  posFromFrac,
  rangeFromFrac,
  staticFracFor,
  statusFromRange,
} from '../mock/leviathans'
import { threatColor, threatLabel } from '../mock/severity'
import type { Leviathan, LeviathanStatus } from '../mock/types'

/** Key-free CARTO dark-matter vector style (verified, no API token). */
const MAP_STYLE_URL =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

/** Opening camera framing the SF-Bay tracks (spawns out west, targets inland). */
const INITIAL_VIEW_STATE = {
  longitude: -122.39,
  latitude: 37.72,
  zoom: 10.3,
} as const

/** Zoom level the camera eases to when a leviathan is selected. */
const FOCUS_ZOOM = 12

/** Per-feature properties carried on the track GeoJSON. */
interface TrackProps {
  /** full intended track · remaining leg to landfall · landfall target tick. */
  kind: 'full' | 'leg' | 'target'
  /** Threat hex color shared across a leviathan's track features. */
  color: string
}

/** Stable per-leviathan geometry + pace, captured once so display-stat drift on
    the live roster never disturbs the scripted advance. */
interface Track {
  from: { lng: number; lat: number }
  to: { lng: number; lat: number }
  startRange: number
  speed: number
}

/** Detects the user's reduced-motion preference (SSR/test-safe). */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export interface CommandMapProps {
  /** Live leviathan roster to plot as markers. */
  leviathans: Leviathan[]
  /** Currently selected leviathan id, or null. */
  selectedId: string | null
  /** Selects (or clears) the focused leviathan. */
  select: (id: string | null) => void
  /** Whether a citywide alert is active (renders a scrim overlay). */
  alertActive: boolean
  /** Logs a leviathan reaching landfall (repelled + track reacquired). */
  reportLandfall: (codename: string, target: string, startRangeKm: number) => void
  /** Reports a leviathan's live inbound status band as the advance crosses it. */
  reportStatus: (id: string, status: LeviathanStatus) => void
  /** Reports a leviathan's live remaining range (km) as the advance closes. */
  reportRange: (id: string, rangeKm: number) => void
}

/**
 * Renders the command-center map hero. Pass live state in via props so the
 * parent (App) can compose it alongside the other panels.
 */
export default function CommandMap({
  leviathans,
  selectedId,
  select,
  alertActive,
  reportLandfall,
  reportStatus,
  reportRange,
}: CommandMapProps): React.JSX.Element {
  const mapRef = useRef<MapRef | null>(null)
  const reducedMotion = prefersReducedMotion()

  // Smooth sim clock driving the inbound advance. Held in state for rendering
  // and mirrored to a ref so the selection fly-to can read it without
  // re-subscribing every frame. Frozen entirely under reduced motion.
  const [simTime, setSimTime] = useState<number>(0)
  const simTimeRef = useRef<number>(0)
  useEffect(() => {
    simTimeRef.current = simTime
  }, [simTime])

  useEffect(() => {
    if (reducedMotion) {
      return
    }
    let raf = 0
    let last = performance.now()
    const tick = (now: number): void => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      setSimTime((t) => t + dt)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reducedMotion])

  // Snapshot each leviathan's track geometry + pace once on mount. The live
  // roster drifts `speed` per tick; freezing the motion inputs keeps the
  // advance smooth and deterministic. The roster set is fixed at mount, so a
  // lazy initializer captures every leviathan at its spawn pace.
  const [frozen] = useState<Record<string, Track>>(() => {
    const out: Record<string, Track> = {}
    for (const lev of leviathans) {
      out[lev.id] = {
        from: lev.from,
        to: lev.to,
        startRange: lev.startRange,
        speed: lev.speed,
      }
    }
    return out
  })

  // Freshest roster snapshot for the fly-to + landfall effects (read via refs
  // so neither re-subscribes on every per-frame advance).
  const leviathansRef = useRef<Leviathan[]>(leviathans)
  useEffect(() => {
    leviathansRef.current = leviathans
  }, [leviathans])

  // Per-leviathan live render state, recomputed each frame from the frozen
  // track + the sim clock (or a static snapshot under reduced motion).
  const derived = leviathans.map((lev) => {
    const track =
      frozen[lev.id] ??
      { from: lev.from, to: lev.to, startRange: lev.startRange, speed: lev.speed }
    // Dispatching a response asset shoves the targeted leviathan back toward
    // open water: subtract its current knockback (a track fraction that decays
    // each heartbeat) from the natural advance, clamped at spawn. Reduced
    // motion ignores the shove and holds the static snapshot.
    const frac = reducedMotion
      ? staticFracFor(lev.threat)
      : Math.max(0, fracAt(track, simTime) - lev.repel)
    const pos = posFromFrac(track.from, track.to, frac)
    const rangeKm = rangeFromFrac(track.startRange, frac)
    const status = statusFromRange(rangeKm)
    const eta = formatEta(etaToLandfall(rangeKm, lev.speed))
    return { lev, track, pos, status, eta, color: threatColor(lev.threat) }
  })

  // Ease the camera to the selected leviathan's current position on selection.
  useEffect(() => {
    if (selectedId == null) {
      return
    }
    const target = leviathansRef.current.find((lev) => lev.id === selectedId)
    if (target == null) {
      return
    }
    const track = frozen[selectedId] ?? {
      from: target.from,
      to: target.to,
      startRange: target.startRange,
      speed: target.speed,
    }
    const frac = reducedMotion
      ? staticFracFor(target.threat)
      : Math.max(0, fracAt(track, simTimeRef.current) - target.repel)
    const pos = posFromFrac(track.from, track.to, frac)
    mapRef.current?.easeTo({
      center: [pos.lng, pos.lat],
      zoom: FOCUS_ZOOM,
      duration: reducedMotion ? 0 : 1200,
    })
  }, [selectedId, reducedMotion, frozen])

  // Loop events: each completed track cycle = a leviathan reached landfall, was
  // repelled, and its track was reacquired. Guarded so each wrap logs once.
  const cyclesRef = useRef<Record<string, number>>({})
  useEffect(() => {
    if (reducedMotion) {
      return
    }
    for (const lev of leviathansRef.current) {
      const track = frozen[lev.id] ?? {
        from: lev.from,
        to: lev.to,
        startRange: lev.startRange,
        speed: lev.speed,
      }
      const cycle = cycleAt(track, simTime)
      const prev = cyclesRef.current[lev.id] ?? 0
      if (cycle > prev) {
        cyclesRef.current[lev.id] = cycle
        // Skip the natural landfall log while the leviathan is actively being
        // repelled by a dispatch — it has been shoved back to open water, not
        // arrived. The dispatch logs its own repel; the counter stays synced.
        if (lev.repel <= 0.001) {
          reportLandfall(lev.codename, lev.target, lev.startRange)
        }
      }
    }
  }, [simTime, reducedMotion, reportLandfall, frozen])

  // Surface each leviathan's live telemetry up to the roster: its inbound band
  // (SUBMERGED/SURFACED/INBOUND/LANDFALL) and its remaining range to landfall.
  // Each fires only when it changes — the band on boundary crossings, the range
  // on whole-kilometer changes — and once on mount, including under reduced
  // motion, to seed the static snapshot. This keeps the side panels off the
  // per-frame render path.
  const lastStatusRef = useRef<Record<string, LeviathanStatus>>({})
  const lastRangeRef = useRef<Record<string, number>>({})
  useEffect(() => {
    for (const lev of leviathansRef.current) {
      const track = frozen[lev.id] ?? {
        from: lev.from,
        to: lev.to,
        startRange: lev.startRange,
        speed: lev.speed,
      }
      const frac = reducedMotion
        ? staticFracFor(lev.threat)
        : Math.max(0, fracAt(track, simTime) - lev.repel)
      const rangeKm = rangeFromFrac(track.startRange, frac)
      const status = statusFromRange(rangeKm)
      if (lastStatusRef.current[lev.id] !== status) {
        lastStatusRef.current[lev.id] = status
        reportStatus(lev.id, status)
      }
      const roundedKm = Math.round(rangeKm)
      if (lastRangeRef.current[lev.id] !== roundedKm) {
        lastRangeRef.current[lev.id] = roundedKm
        reportRange(lev.id, roundedKm)
      }
    }
  }, [simTime, reducedMotion, reportStatus, reportRange, frozen])

  // Track overlay GeoJSON: a faint full track, a dashed remaining leg, and a
  // landfall target tick per leviathan. Rebuilt each frame from the advance.
  const features: Feature<LineString | Point, TrackProps>[] = derived.flatMap(
    ({ track, pos, color }) => [
      {
        type: 'Feature',
        properties: { kind: 'full', color },
        geometry: {
          type: 'LineString',
          coordinates: [
            [track.from.lng, track.from.lat],
            [track.to.lng, track.to.lat],
          ],
        },
      },
      {
        type: 'Feature',
        properties: { kind: 'leg', color },
        geometry: {
          type: 'LineString',
          coordinates: [
            [pos.lng, pos.lat],
            [track.to.lng, track.to.lat],
          ],
        },
      },
      {
        type: 'Feature',
        properties: { kind: 'target', color },
        geometry: { type: 'Point', coordinates: [track.to.lng, track.to.lat] },
      },
    ],
  )
  const trackData: FeatureCollection<LineString | Point, TrackProps> = {
    type: 'FeatureCollection',
    features,
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Map
        ref={mapRef}
        initialViewState={INITIAL_VIEW_STATE}
        mapStyle={MAP_STYLE_URL}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        onClick={() => select(null)}
      >
        <Source id="kdn-trackers" type="geojson" data={trackData}>
          <Layer
            id="kdn-track-full"
            type="line"
            filter={['==', ['get', 'kind'], 'full']}
            layout={{ 'line-cap': 'round' }}
            paint={{
              'line-color': ['get', 'color'],
              'line-width': 1,
              'line-opacity': 0.2,
              'line-dasharray': [2, 7],
            }}
          />
          <Layer
            id="kdn-track-leg"
            type="line"
            filter={['==', ['get', 'kind'], 'leg']}
            layout={{ 'line-cap': 'round' }}
            paint={{
              'line-color': ['get', 'color'],
              'line-width': 1.4,
              'line-opacity': 0.55,
              'line-dasharray': [3, 3],
            }}
          />
          <Layer
            id="kdn-track-target"
            type="circle"
            filter={['==', ['get', 'kind'], 'target']}
            paint={{
              'circle-radius': 4,
              'circle-color': ['get', 'color'],
              'circle-opacity': 0,
              'circle-stroke-color': ['get', 'color'],
              'circle-stroke-width': 1.4,
              'circle-stroke-opacity': 0.7,
            }}
          />
        </Source>

        {derived.map(({ lev, pos, status, eta, color }) => (
          <LeviathanMarker
            key={lev.id}
            leviathan={lev}
            lng={pos.lng}
            lat={pos.lat}
            status={status}
            eta={eta}
            color={color}
            selected={lev.id === selectedId}
            onSelect={select}
          />
        ))}
      </Map>

      {alertActive && (
        <div
          className="kdn-alert-scrim pointer-events-none absolute inset-0"
          role="presentation"
          aria-hidden="true"
        />
      )}

      {/* Self-documenting key for the coded flags flown on the markers. */}
      <div className="kdn-map-legend" aria-label="Marker flag legend">
        <span className="kdn-legend-row">
          <span className="kdn-legend-key kdn-legend-key--target">▸ TARGET</span>
          <span className="kdn-legend-text">dispatch focus</span>
        </span>
        <span className="kdn-legend-row">
          <span className="kdn-legend-key kdn-legend-key--repelled">REPELLED</span>
          <span className="kdn-legend-text">shoved back</span>
        </span>
        <span className="kdn-legend-row">
          <span className="kdn-legend-key kdn-legend-key--landfall">LANDFALL</span>
          <span className="kdn-legend-text">reached target</span>
        </span>
      </div>
    </div>
  )
}

interface LeviathanMarkerProps {
  leviathan: Leviathan
  /** Current interpolated longitude along the inbound track. */
  lng: number
  /** Current interpolated latitude along the inbound track. */
  lat: number
  /** Current inbound status band (drives the LANDFALL flash). */
  status: LeviathanStatus
  /** Formatted landfall ETA (e.g. "1m 23s" / "HOLD"). */
  eta: string
  /** Severity hex color. */
  color: string
  selected: boolean
  onSelect: (id: string | null) => void
}

/** A single severity-colored, pulsing marker advancing along its track. */
function LeviathanMarker({
  leviathan,
  lng,
  lat,
  status,
  eta,
  color,
  selected,
  onSelect,
}: LeviathanMarkerProps): React.JSX.Element {
  const initial = leviathan.codename.charAt(0).toUpperCase()
  // A dispatch shoves the targeted leviathan back along its track; `repel`
  // decays each heartbeat, so this stays true for the few seconds it is
  // actively recoiling, then clears itself.
  const repelled = leviathan.repel > 0.001
  const label = `${leviathan.codename} — Class ${leviathan.classNumeral}, ${threatLabel(
    leviathan.threat,
  )}, ${repelled ? 'REPELLED' : status}${selected ? ` · dispatch target · ETA ${eta}` : ''}`

  return (
    <Marker
      longitude={lng}
      latitude={lat}
      anchor="center"
      onClick={(event) => {
        event.originalEvent.stopPropagation()
        onSelect(leviathan.id)
      }}
    >
      <button
        type="button"
        className={`kdn-marker${selected ? ' kdn-marker--selected' : ''}${
          repelled ? ' kdn-marker--repelled' : ''
        }`}
        aria-pressed={selected}
        aria-label={label}
        title={label}
      >
        {repelled ? (
          <span className="kdn-marker-repelled">REPELLED</span>
        ) : (
          status === 'LANDFALL' && (
            <span className="kdn-marker-landfall" style={{ color }}>
              LANDFALL
            </span>
          )
        )}
        <span className="kdn-pulse-ring" style={{ borderColor: color }} />
        <span
          className="kdn-marker-dot"
          style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}` }}
        >
          {initial}
        </span>
        {selected && <span className="kdn-marker-target">▸ TARGET · {eta}</span>}
      </button>
    </Marker>
  )
}
