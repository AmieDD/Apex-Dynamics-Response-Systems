// Full-bleed MapLibre command map for the Kaiju Defense Network.
//
// Uses the key-free CARTO dark-matter vector style (no API token required) via
// react-map-gl's MapLibre entry point. Each tracked leviathan renders as a
// severity-colored, pulsing marker carrying its codename initial so identity is
// never conveyed by color alone (accessibility: DR-04). Selecting a leviathan —
// from a roster card or by clicking its marker — eases the camera to it.

import { useEffect, useMemo, useRef } from 'react'

import { Map, Marker, type MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

import { threatColor, threatLabel } from '../mock/severity'
import type { Leviathan } from '../mock/types'

/** Key-free CARTO dark-matter vector style (verified, no API token). */
const MAP_STYLE_URL =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

/** Coastal anchor the roster spawns around; the map opens here. */
const INITIAL_VIEW_STATE = {
  longitude: -122.486,
  latitude: 37.769,
  zoom: 10,
} as const

/** Zoom level the camera eases to when a leviathan is selected. */
const FOCUS_ZOOM = 12

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
}: CommandMapProps): React.JSX.Element {
  const mapRef = useRef<MapRef | null>(null)

  // Keep the freshest roster snapshot available to the fly-to effect without
  // re-triggering it on every per-tick stat/coordinate drift.
  const leviathansRef = useRef<Leviathan[]>(leviathans)
  useEffect(() => {
    leviathansRef.current = leviathans
  }, [leviathans])

  // Ease the camera to the selected leviathan whenever the selection changes.
  useEffect(() => {
    if (selectedId == null) {
      return
    }
    const target = leviathansRef.current.find((lev) => lev.id === selectedId)
    if (target == null) {
      return
    }
    mapRef.current?.easeTo({
      center: [target.lng, target.lat],
      zoom: FOCUS_ZOOM,
      duration: prefersReducedMotion() ? 0 : 1200,
    })
  }, [selectedId])

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
        {leviathans.map((lev) => (
          <LeviathanMarker
            key={lev.id}
            leviathan={lev}
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
    </div>
  )
}

interface LeviathanMarkerProps {
  leviathan: Leviathan
  selected: boolean
  onSelect: (id: string | null) => void
}

/** A single severity-colored, pulsing marker for one leviathan. */
function LeviathanMarker({
  leviathan,
  selected,
  onSelect,
}: LeviathanMarkerProps): React.JSX.Element {
  const color = threatColor(leviathan.threat)
  const initial = useMemo(
    () => leviathan.codename.charAt(0).toUpperCase(),
    [leviathan.codename],
  )
  const label = `${leviathan.codename} — Class ${leviathan.classNumeral}, ${threatLabel(
    leviathan.threat,
  )}`

  return (
    <Marker
      longitude={leviathan.lng}
      latitude={leviathan.lat}
      anchor="center"
      onClick={(event) => {
        event.originalEvent.stopPropagation()
        onSelect(leviathan.id)
      }}
    >
      <button
        type="button"
        className={`kdn-marker${selected ? ' kdn-marker--selected' : ''}`}
        aria-pressed={selected}
        aria-label={label}
        title={label}
      >
        <span className="kdn-pulse-ring" style={{ borderColor: color }} />
        <span
          className="kdn-marker-dot"
          style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}` }}
        >
          {initial}
        </span>
      </button>
    </Marker>
  )
}
