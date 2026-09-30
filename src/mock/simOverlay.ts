// Converts a Scenario Studio public delivery feed and station catalog into the
// compact `sim-overlay-v1` shape the command map replays. Pure and free of
// `node:*` imports so both the app and the import script can use it.

export const OVERLAY_VERSION = 'sim-overlay-v1'
export const FEED_SCHEMA = 'delivery-feed-v4'
export const CATALOG_SCHEMA = 'multi-sensor-v2'

export interface SimFrame {
  originLongitude: number
  originLatitude: number
  radiusMeters: number
}

export interface SimStation {
  stationId: string
  lat: number
  lng: number
}

export interface SimRadar {
  /** Measured time (ms after `epochMs`). */
  t: number
  lat: number
  lng: number
}

export interface SimSeismic {
  /** Measured station arrival time (ms after `epochMs`). */
  t: number
  stationId: string
  /** Absent when the sensor did not report an amplitude. */
  amplitude?: number
}

export interface SimOverlay {
  overlayVersion: typeof OVERLAY_VERSION
  scenarioId: string
  epochMs: number
  durationMs: number
  stations: SimStation[]
  radar: SimRadar[]
  seismic: SimSeismic[]
}

type Json = Record<string, unknown>

const FEED_FIELDS = ['schemaVersion', 'scenarioId', 'epochMs', 'durationMs', 'frame', 'profile', 'stationAliases', 'records']
const CATALOG_FIELDS = ['schemaVersion', 'scenarioId', 'sensorSeed', 'epochMs', 'durationMs', 'frame', 'records']
const FRAME_FIELDS = ['originLongitude', 'originLatitude', 'radiusMeters']
const ALTERNATE_NAMES: Record<string, string> = {
  reading_id: 'readingId',
  timestamp_ms: 'timestampMs',
  station_id: 'stationId',
  amplitude: 'amplitude',
  freq_hz: 'dominantFrequencyHz',
}

function fail(message: string): never {
  throw new Error(`Invalid simulated sensor data: ${message}`)
}

function record(value: unknown, what: string): Json {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(`${what} must be an object`)
  return value as Json
}

function fields(value: Json, expected: readonly string[], what: string): void {
  const keys = Object.keys(value).sort()
  const want = [...expected].sort()
  if (keys.length !== want.length || keys.some((key, i) => key !== want[i])) {
    fail(`${what} has fields [${keys.join(', ')}], expected [${want.join(', ')}]`)
  }
}

function finite(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${what} must be a finite number`)
  return value
}

function text(value: unknown, what: string): string {
  if (typeof value !== 'string' || value.length === 0) fail(`${what} must be a non-empty string`)
  return value
}

function list(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) fail(`${what} must be an array`)
  return value
}

function parseFrame(value: unknown, what: string): SimFrame {
  const frame = record(value, what)
  fields(frame, FRAME_FIELDS, what)
  const originLongitude = finite(frame.originLongitude, `${what}.originLongitude`)
  const originLatitude = finite(frame.originLatitude, `${what}.originLatitude`)
  const radiusMeters = finite(frame.radiusMeters, `${what}.radiusMeters`)
  if (Math.abs(originLongitude) > 180 || Math.abs(originLatitude) > 89 || radiusMeters <= 0) fail(`${what} is out of range`)
  return { originLongitude, originLatitude, radiusMeters }
}

/** Local east/north metres to WGS84, using the generator's spherical local frame. */
export function toLatLng(xMeters: number, yMeters: number, frame: SimFrame): { lat: number; lng: number } {
  const lat = frame.originLatitude + (yMeters / frame.radiusMeters) * (180 / Math.PI)
  const lng =
    frame.originLongitude +
    (xMeters / (frame.radiusMeters * Math.cos((frame.originLatitude * Math.PI) / 180))) * (180 / Math.PI)
  return { lat, lng }
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

function compare(a: number | string, b: number | string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Builds the overlay from a parsed `delivery-feed-v4` feed and `multi-sensor-v2`
 * station catalog. Throws on any shape, version, alias, or duplicate conflict.
 */
export function buildOverlay(feedInput: unknown, catalogInput: unknown): SimOverlay {
  const catalog = record(catalogInput, 'station catalog')
  fields(catalog, CATALOG_FIELDS, 'station catalog')
  if (catalog.schemaVersion !== CATALOG_SCHEMA) fail(`unsupported station catalog schema ${String(catalog.schemaVersion)}`)
  const feed = record(feedInput, 'delivery feed')
  fields(feed, FEED_FIELDS, 'delivery feed')
  if (feed.schemaVersion !== FEED_SCHEMA) fail(`unsupported delivery feed schema ${String(feed.schemaVersion)}`)

  const scenarioId = text(catalog.scenarioId, 'station catalog scenarioId')
  const epochMs = finite(catalog.epochMs, 'station catalog epochMs')
  const durationMs = finite(catalog.durationMs, 'station catalog durationMs')
  if (durationMs <= 0) fail('durationMs must be positive')
  const frame = parseFrame(catalog.frame, 'station catalog frame')
  const feedFrame = parseFrame(feed.frame, 'delivery feed frame')
  if (
    feed.scenarioId !== scenarioId ||
    feed.epochMs !== epochMs ||
    feed.durationMs !== durationMs ||
    FRAME_FIELDS.some((key) => feedFrame[key as keyof SimFrame] !== frame[key as keyof SimFrame])
  ) {
    fail('delivery feed and station catalog describe different scenarios')
  }

  const stations: SimStation[] = []
  const stationIds = new Set<string>()
  for (const [index, value] of list(catalog.records, 'station catalog records').entries()) {
    const station = record(value, `station ${index}`)
    fields(station, ['stationId', 'xMeters', 'yMeters'], `station ${index}`)
    const stationId = text(station.stationId, `station ${index} stationId`)
    if (stationIds.has(stationId)) fail(`duplicate station ${stationId}`)
    stationIds.add(stationId)
    const { lat, lng } = toLatLng(finite(station.xMeters, `${stationId} xMeters`), finite(station.yMeters, `${stationId} yMeters`), frame)
    stations.push({ stationId, lat: round6(lat), lng: round6(lng) })
  }

  const profile = record(feed.profile, 'delivery profile')
  if (profile.version !== 'delivery-v3') fail(`unsupported delivery profile ${String(profile.version)}`)
  const alternates = new Set(list(profile.alternateStations, 'alternateStations').map((id) => text(id, 'alternate station')))
  for (const id of alternates) if (!stationIds.has(id)) fail(`unknown alternate station ${id}`)

  const aliases = new Map<string, string>()
  for (const [index, value] of list(feed.stationAliases, 'stationAliases').entries()) {
    const entry = record(value, `station alias ${index}`)
    fields(entry, ['stationId', 'alias'], `station alias ${index}`)
    const stationId = text(entry.stationId, 'alias stationId')
    const alias = text(entry.alias, 'alias')
    if (!alternates.has(stationId) || aliases.has(alias) || stationIds.has(alias) || [...aliases.values()].includes(stationId)) {
      fail(`invalid station alias ${alias}`)
    }
    aliases.set(alias, stationId)
  }
  if (aliases.size !== alternates.size) fail('incomplete station alias catalog')

  const radar: SimRadar[] = []
  const seismic: SimSeismic[] = []
  const seen = new Map<string, string>()
  const time = (value: unknown, what: string): number => {
    const t = finite(value, what)
    if (t < 0 || t > durationMs) fail(`${what} is outside the recording`)
    return t
  }

  for (const [index, value] of list(feed.records, 'delivery records').entries()) {
    const delivery = record(value, `delivery ${index}`)
    fields(delivery, ['deliveryId', 'receivedAtMs', 'stream', 'reading'], `delivery ${index}`)
    let reading = record(delivery.reading, `delivery ${index} reading`)

    if (delivery.stream === 'seismic') {
      const alternate = Object.hasOwn(reading, 'station_id')
      if (alternate) {
        const renamed: Json = {}
        for (const [key, field] of Object.entries(reading)) {
          const name = ALTERNATE_NAMES[key]
          if (name === undefined) fail(`delivery ${index} has unknown alternate field ${key}`)
          renamed[name] = field
        }
        const stationId = aliases.get(text(renamed.stationId, `delivery ${index} station_id`))
        if (stationId === undefined) fail(`delivery ${index} uses unknown station alias ${String(renamed.stationId)}`)
        reading = { ...renamed, stationId }
      }
      const optional = ['amplitude', 'dominantFrequencyHz'].filter((key) => Object.hasOwn(reading, key))
      fields(reading, ['readingId', 'timestampMs', 'stationId', ...optional], `delivery ${index} seismic reading`)
      const stationId = text(reading.stationId, `delivery ${index} stationId`)
      if (!stationIds.has(stationId)) fail(`delivery ${index} references unknown station ${stationId}`)
      if (alternate !== alternates.has(stationId)) fail(`delivery ${index} uses the wrong format for ${stationId}`)
      for (const key of optional) if (finite(reading[key], `delivery ${index} ${key}`) <= 0) fail(`delivery ${index} ${key} must be positive`)
    } else if (delivery.stream === 'radar') {
      fields(reading, ['readingId', 'timestampMs', 'latitude', 'longitude'], `delivery ${index} radar reading`)
      const lat = finite(reading.latitude, `delivery ${index} latitude`)
      const lng = finite(reading.longitude, `delivery ${index} longitude`)
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) fail(`delivery ${index} position is out of range`)
    } else {
      fail(`delivery ${index} has unknown stream ${String(delivery.stream)}`)
    }

    const readingId = text(reading.readingId, `delivery ${index} readingId`)
    const t = time(reading.timestampMs, `delivery ${index} timestampMs`)
    const signature = JSON.stringify([delivery.stream, Object.entries(reading).sort(([a], [b]) => compare(a, b))])
    const previous = seen.get(readingId)
    if (previous !== undefined) {
      if (previous !== signature) fail(`conflicting duplicate deliveries for reading ${readingId}`)
      continue
    }
    seen.set(readingId, signature)

    if (delivery.stream === 'radar') {
      radar.push({ t: Math.round(t), lat: round6(reading.latitude as number), lng: round6(reading.longitude as number) })
    } else {
      const item: SimSeismic = { t: Math.round(t), stationId: reading.stationId as string }
      if (Object.hasOwn(reading, 'amplitude')) item.amplitude = Number((reading.amplitude as number).toPrecision(4))
      seismic.push(item)
    }
  }

  radar.sort((a, b) => a.t - b.t || a.lat - b.lat || a.lng - b.lng)
  seismic.sort(
    (a, b) =>
      a.t - b.t ||
      compare(a.stationId, b.stationId) ||
      (a.amplitude === undefined ? (b.amplitude === undefined ? 0 : -1) : b.amplitude === undefined ? 1 : a.amplitude - b.amplitude),
  )

  return { overlayVersion: OVERLAY_VERSION, scenarioId, epochMs, durationMs, stations, radar, seismic }
}

/** Canonical overlay text: one record per line, LF endings, final newline. */
export function serializeOverlay(overlay: SimOverlay): string {
  const rows = (items: readonly object[]): string =>
    items.length === 0 ? '[]' : `[\n${items.map((item) => `    ${JSON.stringify(item)}`).join(',\n')}\n  ]`
  const { stations, radar, seismic, ...header } = overlay
  const head = Object.entries(header).map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`)
  return `{\n${[...head, `  "stations": ${rows(stations)}`, `  "radar": ${rows(radar)}`, `  "seismic": ${rows(seismic)}`].join(',\n')}\n}\n`
}
