// Render-time safety net for the code-split command map. If the lazily loaded
// MapLibre chunk fails to resolve (e.g. a stale chunk URL after a redeploy) or
// the map throws while rendering, React unwinds to the nearest error boundary.
// Suspense only handles the *pending* promise — a *rejected* dynamic import or a
// render throw still bubbles — so App wraps the map's <Suspense> with this
// boundary to keep the rest of the command center alive and offer a recovery
// hint instead of blanking the whole dashboard.

import { Component, type ErrorInfo, type ReactNode } from 'react'

export interface MapErrorBoundaryProps {
  /** The subtree to guard (the lazy map + its Suspense fallback). */
  children: ReactNode
  /** Optional replacement UI. Defaults to an accessible map-down panel. */
  fallback?: ReactNode
}

interface MapErrorBoundaryState {
  hasError: boolean
}

/** Default map-down panel. Mirrors `MapLoadingPlaceholder` in App.tsx (fills the
 *  hero, calm dark field) but reads as an alert: the tactical map module could
 *  not load and a hard refresh is the recovery path. */
function MapErrorFallback(): React.JSX.Element {
  return (
    <div
      className="absolute inset-0 grid place-items-center bg-surface p-6 text-center"
      role="alert"
    >
      <div className="flex max-w-xs flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-text">
          Tactical map offline
        </span>
        <span className="font-mono text-[11px] leading-relaxed text-text-muted">
          The map module failed to load. Hard-refresh the console
          (Ctrl/Cmd + Shift + R) to re-acquire the tactical feed.
        </span>
      </div>
    </div>
  )
}

/** Class error boundary — there is no hook equivalent for `componentDidCatch` /
 *  `getDerivedStateFromError`, so this stays a class even in a hooks codebase. */
export class MapErrorBoundary extends Component<
  MapErrorBoundaryProps,
  MapErrorBoundaryState
> {
  state: MapErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): MapErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface the failure for diagnostics; the UI already degrades gracefully.
    console.error('Command map failed to render:', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? <MapErrorFallback />
    }
    return this.props.children
  }
}

export default MapErrorBoundary
