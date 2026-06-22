/**
 * Detects whether the browser can create a WebGL rendering context, the
 * minimum maplibre-gl v4 needs to render. v4 removed `maplibregl.supported()`,
 * so we probe directly: try WebGL2 (maplibre's preferred path) then fall back
 * to WebGL1, then `experimental-webgl`. SSR/jsdom-safe — any missing API or
 * thrown context call yields `false` rather than crashing.
 */
export function isWebglAvailable(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const attrs: WebGLContextAttributes = { failIfMajorPerformanceCaveat: false }
    const gl =
      canvas.getContext('webgl2', attrs) ??
      canvas.getContext('webgl', attrs) ??
      canvas.getContext('experimental-webgl', attrs)
    return gl != null
  } catch {
    return false
  }
}
