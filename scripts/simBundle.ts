// Reads a Studio bundle (a downloaded .zip or an extracted folder),
// verifies it against its manifest, and builds the committed sim-overlay
// artifacts. Side-effect free so tests can drive every path; the CLI wrapper in
// generate-sim-overlay.ts owns argv and exit codes.
//
// Only manifest.json and the two public tracker inputs are ever read. Private
// truth and authoring entries are never opened, copied, or described.

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { crc32, inflateRawSync } from 'node:zlib'

import { buildOverlay, serializeOverlay } from '../src/mock/simOverlay'

const MANIFEST = 'manifest.json'
const FEED = 'public/delivery-feed.json'
const CATALOG = 'public/station-catalog.json'
const REQUIRED = [MANIFEST, FEED, CATALOG] as const

/** Largest uncompressed entry the reader will inflate. */
export const MAX_ENTRY_BYTES = 64 * 1024 * 1024

export const OUTPUTS = {
  feed: 'data/sim-scenario/delivery-feed.json',
  catalog: 'data/sim-scenario/station-catalog.json',
  source: 'data/sim-scenario/source.json',
  overlay: 'src/mock/simOverlay.json',
} as const

const SUPPORTED = {
  manifestVersion: 'scenario-bundle-v3',
  schemaVersion: 'multi-sensor-v2',
  deliverySchemaVersion: 'delivery-feed-v4',
  deliveryLedgerSchemaVersion: 'delivery-ledger-v2',
  generatorName: '@apex-dynamics/data-generator',
  modelVersion: 'mean-reverting-surfaced-v1',
  pipelineVersion: 'three-stage-v2',
} as const

const PUBLIC_FILES = ['public/radar-readings.json', 'public/seismic-readings.json', CATALOG, FEED]
const MODE_FILES: Record<string, readonly string[]> = {
  observations: [...PUBLIC_FILES, 'README.txt'],
  full: [
    ...PUBLIC_FILES,
    'README.txt',
    'private/truth.json',
    'private/delivery-ledger.json',
    'authoring/scenario.json',
    'authoring/run.json',
    'authoring/candidates.json',
  ],
}

type Json = Record<string, unknown>
type FileEntry = { bytes: number; sha256: string }

export interface BundleInput {
  manifest: Buffer
  feed: Buffer
  catalog: Buffer
}

function fail(message: string): never {
  throw new Error(message)
}

/** Drops each CR that precedes an LF, undoing Windows checkout conversion. */
export function normalizeEol(bytes: Buffer): Buffer {
  if (!bytes.includes(0x0d)) return bytes
  const out = Buffer.allocUnsafe(bytes.length)
  let length = 0
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0x0d && bytes[i + 1] === 0x0a) continue
    out[length++] = bytes[i]
  }
  return out.subarray(0, length)
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function parseJson(bytes: Buffer, what: string): Json {
  let value: unknown
  try {
    value = JSON.parse(bytes.toString('utf8'))
  } catch {
    fail(`${what} is not valid JSON`)
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(`${what} must be a JSON object`)
  return value as Json
}

/** Extracts the named entries from a ZIP archive without touching any others. */
export function readZipEntries(zip: Buffer, names: readonly string[]): Map<string, Buffer> {
  const need = (end: number): void => {
    if (end > zip.length) fail('ZIP archive is truncated')
  }
  let eocd = -1
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) fail('Input is not a ZIP archive')
  const disk = zip.readUInt16LE(eocd + 4)
  const directoryDisk = zip.readUInt16LE(eocd + 6)
  const diskEntries = zip.readUInt16LE(eocd + 8)
  const totalEntries = zip.readUInt16LE(eocd + 10)
  const directorySize = zip.readUInt32LE(eocd + 12)
  const directoryOffset = zip.readUInt32LE(eocd + 16)
  if (disk !== 0 || directoryDisk !== 0 || diskEntries !== totalEntries) fail('Multi-disk ZIP archives are not supported')
  if (totalEntries === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) {
    fail('ZIP64 archives are not supported')
  }
  need(directoryOffset + directorySize)

  const wanted = new Set(names)
  const found = new Map<string, { method: number; size: number; compressed: number; crc: number; offset: number }>()
  let cursor = directoryOffset
  for (let n = 0; n < totalEntries; n++) {
    need(cursor + 46)
    if (zip.readUInt32LE(cursor) !== 0x02014b50) fail('ZIP central directory is corrupt')
    const flags = zip.readUInt16LE(cursor + 8)
    const method = zip.readUInt16LE(cursor + 10)
    const crc = zip.readUInt32LE(cursor + 16)
    const compressed = zip.readUInt32LE(cursor + 20)
    const size = zip.readUInt32LE(cursor + 24)
    const nameLength = zip.readUInt16LE(cursor + 28)
    const extraLength = zip.readUInt16LE(cursor + 30)
    const commentLength = zip.readUInt16LE(cursor + 32)
    const offset = zip.readUInt32LE(cursor + 42)
    need(cursor + 46 + nameLength)
    const name = zip.toString('utf8', cursor + 46, cursor + 46 + nameLength)
    cursor += 46 + nameLength + extraLength + commentLength
    if (flags & 0x1) fail('Encrypted ZIP archives are not supported')
    if (compressed === 0xffffffff || size === 0xffffffff || offset === 0xffffffff) fail('ZIP64 archives are not supported')
    if (!wanted.has(name)) continue
    if (found.has(name)) fail(`ZIP archive contains ${name} more than once`)
    found.set(name, { method, size, compressed, crc, offset })
  }

  const entries = new Map<string, Buffer>()
  for (const name of names) {
    const entry = found.get(name) ?? fail(`Bundle is missing ${name}`)
    if (entry.size > MAX_ENTRY_BYTES) fail(`${name} exceeds the ${MAX_ENTRY_BYTES / 1024 / 1024} MiB entry limit`)
    need(entry.offset + 30)
    if (zip.readUInt32LE(entry.offset) !== 0x04034b50) fail(`ZIP local header for ${name} is corrupt`)
    const start = entry.offset + 30 + zip.readUInt16LE(entry.offset + 26) + zip.readUInt16LE(entry.offset + 28)
    need(start + entry.compressed)
    const raw = zip.subarray(start, start + entry.compressed)
    let data: Buffer
    if (entry.method === 0) {
      data = raw
    } else if (entry.method === 8) {
      try {
        data = inflateRawSync(raw, { maxOutputLength: Math.max(1, entry.size) })
      } catch {
        fail(`${name} does not inflate to its declared size`)
      }
    } else {
      fail(`${name} uses unsupported ZIP compression method ${entry.method}`)
    }
    if (data.length !== entry.size) fail(`${name} does not inflate to its declared size`)
    if (crc32(data) !== entry.crc) fail(`${name} failed its ZIP checksum`)
    entries.set(name, data)
  }
  return entries
}

function readInside(root: string, name: string): Buffer {
  let file: string
  try {
    file = realpathSync(resolve(root, name))
  } catch {
    fail(`Bundle is missing ${name}`)
  }
  if (!file.startsWith(root + sep)) fail(`${name} resolves outside the bundle folder`)
  return readFileSync(file)
}

/** Reads the three required entries from a bundle .zip file or extracted folder. */
export function readBundle(inputPath: string): BundleInput {
  let entries: Map<string, Buffer>
  if (statSync(inputPath).isDirectory()) {
    const root = realpathSync(inputPath)
    entries = new Map(REQUIRED.map((name) => [name, readInside(root, name)]))
  } else {
    const zip = readFileSync(inputPath)
    entries = readZipEntries(zip, REQUIRED)
  }
  return {
    manifest: normalizeEol(entries.get(MANIFEST)!),
    feed: normalizeEol(entries.get(FEED)!),
    catalog: normalizeEol(entries.get(CATALOG)!),
  }
}

function fileEntry(files: Json, name: string): FileEntry {
  const entry = files[name] as Json | undefined
  if (!entry || typeof entry.bytes !== 'number' || typeof entry.sha256 !== 'string') fail(`manifest has no size and hash for ${name}`)
  return { bytes: entry.bytes, sha256: entry.sha256 }
}

function verify(bytes: Buffer, expected: FileEntry, name: string): void {
  if (bytes.length !== expected.bytes || sha256(bytes) !== expected.sha256) fail(`${name} does not match its manifest size and hash`)
}

function sameFrame(a: unknown, b: unknown): boolean {
  const left = (a ?? {}) as Json
  const right = (b ?? {}) as Json
  return ['originLongitude', 'originLatitude', 'radiusMeters'].every((key) => left[key] === right[key])
}

function matchEnvelope(data: Json, reference: Json, name: string): void {
  for (const key of ['scenarioId', 'epochMs', 'durationMs'] as const) {
    if (data[key] !== reference[key]) fail(`${name} ${key} does not match the bundle metadata`)
  }
  if (!sameFrame(data.frame, reference.frame)) fail(`${name} frame does not match the bundle metadata`)
}

/** Validates the manifest and builds every committed artifact in memory. */
export function buildArtifacts(input: BundleInput): Map<string, Buffer> {
  const manifest = parseJson(input.manifest, MANIFEST)
  const generator = (manifest.generator ?? {}) as Json
  const checks: [unknown, string, string][] = [
    [manifest.manifestVersion, SUPPORTED.manifestVersion, 'manifestVersion'],
    [manifest.schemaVersion, SUPPORTED.schemaVersion, 'schemaVersion'],
    [manifest.deliverySchemaVersion, SUPPORTED.deliverySchemaVersion, 'deliverySchemaVersion'],
    [manifest.deliveryLedgerSchemaVersion, SUPPORTED.deliveryLedgerSchemaVersion, 'deliveryLedgerSchemaVersion'],
    [generator.name, SUPPORTED.generatorName, 'generator.name'],
    [generator.modelVersion, SUPPORTED.modelVersion, 'generator.modelVersion'],
    [generator.pipelineVersion, SUPPORTED.pipelineVersion, 'generator.pipelineVersion'],
  ]
  for (const [actual, expected, label] of checks) {
    if (actual !== expected) fail(`Unsupported bundle ${label} ${String(actual)} (expected ${expected})`)
  }
  const version = generator.version
  if (typeof version !== 'string' || version.trim() === '') fail('Bundle generator.version must be a non-empty string')
  const mode = manifest.mode
  const allowed = typeof mode === 'string' && Object.hasOwn(MODE_FILES, mode) ? MODE_FILES[mode] : undefined
  if (!allowed) fail(`Unsupported bundle mode ${String(mode)}`)
  const files = (manifest.files ?? {}) as Json
  const listed = Object.keys(files).sort()
  if (listed.join('\n') !== [...allowed].sort().join('\n')) fail(`Manifest file list does not match bundle mode ${mode}`)

  const feedEntry = fileEntry(files, FEED)
  const catalogEntry = fileEntry(files, CATALOG)
  verify(input.feed, feedEntry, FEED)
  verify(input.catalog, catalogEntry, CATALOG)
  const feed = parseJson(input.feed, FEED)
  const catalog = parseJson(input.catalog, CATALOG)
  matchEnvelope(feed, manifest, FEED)
  matchEnvelope(catalog, manifest, CATALOG)
  const overlay = buildOverlay(feed, catalog)
  // buildOverlay validated the catalog frame, and matchEnvelope tied these keys to it.
  const manifestFrame = manifest.frame as Json
  const frame = {
    originLatitude: manifestFrame.originLatitude,
    originLongitude: manifestFrame.originLongitude,
    radiusMeters: manifestFrame.radiusMeters,
  }

  const source = {
    manifestVersion: manifest.manifestVersion,
    mode,
    schemaVersion: manifest.schemaVersion,
    deliverySchemaVersion: manifest.deliverySchemaVersion,
    scenarioId: manifest.scenarioId,
    epochMs: manifest.epochMs,
    durationMs: manifest.durationMs,
    frame,
    generator: {
      name: generator.name,
      version,
      modelVersion: generator.modelVersion,
      pipelineVersion: generator.pipelineVersion,
    },
    files: {
      'delivery-feed.json': feedEntry,
      'station-catalog.json': catalogEntry,
    },
  }
  return new Map<string, Buffer>([
    [OUTPUTS.feed, input.feed],
    [OUTPUTS.catalog, input.catalog],
    [OUTPUTS.source, Buffer.from(`${JSON.stringify(source, null, 2)}\n`, 'utf8')],
    [OUTPUTS.overlay, Buffer.from(serializeOverlay(overlay), 'utf8')],
  ])
}

/** Writes artifacts beneath the repository root, replacing earlier versions. */
export function writeArtifacts(root: string, artifacts: Map<string, Buffer>): void {
  for (const [relativePath, bytes] of artifacts) {
    const target = join(root, relativePath)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, bytes)
  }
}

function readCommitted(root: string, relativePath: string): Buffer | undefined {
  try {
    return normalizeEol(readFileSync(join(root, relativePath)))
  } catch {
    return undefined
  }
}

/**
 * Verifies the committed sources and overlay without writing anything. Returns
 * one message per missing, stale, or inconsistent file; empty means current.
 */
export function check(root: string): string[] {
  const problems: string[] = []
  const missing = (path: string) => problems.push(`${path} is missing`)
  const stale = (path: string, why: string) => problems.push(`${path} is out of date (${why})`)

  const sourceBytes = readCommitted(root, OUTPUTS.source)
  const feedBytes = readCommitted(root, OUTPUTS.feed)
  const catalogBytes = readCommitted(root, OUTPUTS.catalog)
  const overlayBytes = readCommitted(root, OUTPUTS.overlay)
  if (!sourceBytes) missing(OUTPUTS.source)
  if (!feedBytes) missing(OUTPUTS.feed)
  if (!catalogBytes) missing(OUTPUTS.catalog)
  if (!overlayBytes) missing(OUTPUTS.overlay)
  if (!sourceBytes || !feedBytes || !catalogBytes) return problems

  let source: Json, feed: Json, catalog: Json
  try {
    source = parseJson(sourceBytes, OUTPUTS.source)
    feed = parseJson(feedBytes, OUTPUTS.feed)
    catalog = parseJson(catalogBytes, OUTPUTS.catalog)
  } catch (error) {
    problems.push((error as Error).message)
    return problems
  }

  const files = (source.files ?? {}) as Json
  for (const [path, name, bytes] of [
    [OUTPUTS.feed, 'delivery-feed.json', feedBytes],
    [OUTPUTS.catalog, 'station-catalog.json', catalogBytes],
  ] as const) {
    const entry = files[name] as Json | undefined
    if (!entry || entry.bytes !== bytes.length || entry.sha256 !== sha256(bytes)) stale(path, 'size or hash differs from source.json')
  }
  for (const [path, data, schema] of [
    [OUTPUTS.feed, feed, source.deliverySchemaVersion],
    [OUTPUTS.catalog, catalog, source.schemaVersion],
  ] as const) {
    const consistent =
      data.schemaVersion === schema &&
      data.scenarioId === source.scenarioId &&
      data.epochMs === source.epochMs &&
      data.durationMs === source.durationMs &&
      sameFrame(data.frame, source.frame)
    if (!consistent) stale(path, 'metadata differs from source.json')
  }

  if (overlayBytes) {
    try {
      const expected = serializeOverlay(buildOverlay(feed, catalog))
      if (overlayBytes.toString('utf8') !== expected) stale(OUTPUTS.overlay, 'does not match its committed sources')
    } catch (error) {
      problems.push(`${OUTPUTS.overlay} cannot be rebuilt: ${(error as Error).message}`)
    }
  }
  return problems
}
