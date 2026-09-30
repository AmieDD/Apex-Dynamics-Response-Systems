// Tests for the Studio bundle reader and the committed-artifact drift
// check. Archives are synthesized in memory (deflateRawSync + a hand-built
// central directory) so every rejection path runs without extra dependencies.

import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { crc32, deflateRawSync } from 'node:zlib'

import { afterEach, describe, expect, it } from 'vitest'

import { buildArtifacts, check, MAX_ENTRY_BYTES, OUTPUTS, readBundle, readZipEntries, writeArtifacts } from './simBundle'

const SENTINEL = 'SENTINEL-PRIVATE-TRUTH'
const FRAME = { originLatitude: 47.606, originLongitude: -122.333, radiusMeters: 6371008.8 }
const META = { scenarioId: 'test-scenario', epochMs: 1784538000000, durationMs: 60000, frame: FRAME }

const CATALOG = {
  ...META,
  schemaVersion: 'multi-sensor-v2',
  sensorSeed: 'sensor-v1',
  records: [
    { stationId: 'station-1', xMeters: 9646.997372793865, yMeters: 13123.253395633796 },
    { stationId: 'station-2', xMeters: -5571.126376957014, yMeters: 4663.876711794017 },
  ],
}
const FEED = {
  ...META,
  schemaVersion: 'delivery-feed-v4',
  profile: { version: 'delivery-v3', alternateStations: [] },
  stationAliases: [],
  records: [
    { deliveryId: 'd-r1-0', receivedAtMs: 1100, stream: 'radar', reading: { readingId: 'r1', timestampMs: 1000, latitude: 47.68, longitude: -122.42 } },
    { deliveryId: 'd-s1-0', receivedAtMs: 2100, stream: 'seismic', reading: { readingId: 's1', timestampMs: 2000, stationId: 'station-1', amplitude: 0.5 } },
  ],
}

const PUBLIC = ['public/radar-readings.json', 'public/seismic-readings.json', 'public/station-catalog.json', 'public/delivery-feed.json']
const MODE_FILES = {
  observations: [...PUBLIC, 'README.txt'],
  full: [...PUBLIC, 'README.txt', 'private/truth.json', 'private/delivery-ledger.json', 'authoring/scenario.json', 'authoring/run.json', 'authoring/candidates.json'],
}

type Mode = keyof typeof MODE_FILES

function text(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function sha(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** Every file of a synthetic bundle; private entries carry the sentinel. */
function bundleFiles(mode: Mode, manifestPatch: Record<string, unknown> = {}): Map<string, Buffer> {
  const contents = new Map<string, Buffer>()
  for (const name of MODE_FILES[mode]) contents.set(name, Buffer.from(`${SENTINEL} ${name}\n`, 'utf8'))
  contents.set('public/delivery-feed.json', text(FEED))
  contents.set('public/station-catalog.json', text(CATALOG))
  const files = Object.fromEntries([...contents].map(([name, bytes]) => [name, { bytes: bytes.length, sha256: sha(bytes) }]))
  const manifest = {
    ...META,
    manifestVersion: 'scenario-bundle-v3',
    mode,
    schemaVersion: 'multi-sensor-v2',
    deliverySchemaVersion: 'delivery-feed-v4',
    deliveryLedgerSchemaVersion: 'delivery-ledger-v2',
    generator: {
      name: '@apex-dynamics/data-generator',
      version: '0.0.0',
      modelVersion: 'mean-reverting-surfaced-v1',
      pipelineVersion: 'three-stage-v2',
      nodeVersion: '24.0.0',
    },
    files,
    ...manifestPatch,
  }
  contents.set('manifest.json', text(manifest))
  return contents
}

interface ZipItem {
  name: string
  data: Buffer
  method?: number
  declaredSize?: number
}

function makeZip(items: ZipItem[]): Buffer {
  const parts: Buffer[] = []
  const directory: Buffer[] = []
  let offset = 0
  for (const item of items) {
    const method = item.method ?? 8
    const payload = method === 8 ? deflateRawSync(item.data) : item.data
    const name = Buffer.from(item.name, 'utf8')
    const crc = crc32(item.data)
    const size = item.declaredSize ?? item.data.length
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(method, 8)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(payload.length, 18)
    local.writeUInt32LE(size, 22)
    local.writeUInt16LE(name.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(method, 10)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(payload.length, 20)
    central.writeUInt32LE(size, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(offset, 42)
    parts.push(local, name, payload)
    directory.push(central, name)
    offset += 30 + name.length + payload.length
  }
  const centralBytes = Buffer.concat(directory)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(items.length, 8)
  end.writeUInt16LE(items.length, 10)
  end.writeUInt32LE(centralBytes.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, centralBytes, end])
}

function zipOf(files: Map<string, Buffer>): Buffer {
  return makeZip([...files].map(([name, data]) => ({ name, data })))
}

const temps: string[] = []
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'sim-overlay-test-'))
  temps.push(dir)
  return dir
}

function writeZip(files: Map<string, Buffer>): string {
  const path = join(tempDir(), 'bundle.zip')
  writeFileSync(path, zipOf(files))
  return path
}

function crlf(bytes: Buffer): Buffer {
  return Buffer.from(bytes.toString('utf8').replace(/\n/g, '\r\n'), 'utf8')
}

function snapshot(root: string): Record<string, string> {
  const out: Record<string, string> = {}
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else out[path] = readFileSync(path, 'utf8')
    }
  }
  walk(root)
  return out
}

afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('readBundle + buildArtifacts', () => {
  it('builds the four committed artifacts from an observations-only ZIP', () => {
    const artifacts = buildArtifacts(readBundle(writeZip(bundleFiles('observations'))))
    expect([...artifacts.keys()].sort()).toEqual(Object.values(OUTPUTS).sort())
    const overlay = JSON.parse(artifacts.get(OUTPUTS.overlay)!.toString('utf8'))
    expect(overlay.radar).toEqual([{ t: 1000, lat: 47.68, lng: -122.42 }])
    expect(overlay.seismic).toEqual([{ t: 2000, stationId: 'station-1', amplitude: 0.5 }])
  })

  it('never reads or emits private or authoring content from a full bundle', () => {
    const artifacts = buildArtifacts(readBundle(writeZip(bundleFiles('full'))))
    for (const bytes of artifacts.values()) {
      const content = bytes.toString('utf8')
      expect(content).not.toContain(SENTINEL)
      expect(content).not.toContain('private/')
      expect(content).not.toContain('authoring/')
    }
    const source = JSON.parse(artifacts.get(OUTPUTS.source)!.toString('utf8'))
    expect(Object.keys(source).sort()).toEqual(
      ['deliverySchemaVersion', 'durationMs', 'epochMs', 'files', 'frame', 'generator', 'manifestVersion', 'mode', 'scenarioId', 'schemaVersion'],
    )
    expect(Object.keys(source.files).sort()).toEqual(['delivery-feed.json', 'station-catalog.json'])
  })

  it('accepts an extracted folder whose files were converted to CRLF', () => {
    const files = bundleFiles('observations')
    const dir = tempDir()
    for (const [name, bytes] of files) {
      mkdirSync(dirname(join(dir, name)), { recursive: true })
      writeFileSync(join(dir, name), crlf(bytes))
    }
    const fromFolder = buildArtifacts(readBundle(dir))
    const fromZip = buildArtifacts(readBundle(writeZip(files)))
    for (const [path, bytes] of fromZip) expect(fromFolder.get(path)!.equals(bytes)).toBe(true)
  })

  it('rejects a public file whose hash does not match the manifest', () => {
    const files = bundleFiles('observations')
    files.set('public/station-catalog.json', text({ ...CATALOG, sensorSeed: 'tampered' }))
    expect(() => buildArtifacts(readBundle(writeZip(files)))).toThrow(/does not match its manifest size and hash/)
  })

  it('rejects an unsupported generator model', () => {
    const files = bundleFiles('observations', {
      generator: { name: '@apex-dynamics/data-generator', modelVersion: 'other-model', pipelineVersion: 'three-stage-v2' },
    })
    expect(() => buildArtifacts(readBundle(writeZip(files)))).toThrow(/generator.modelVersion other-model/)
  })

  it('rejects a missing or non-string generator version', () => {
    for (const version of [undefined, '', 42, { nested: true }]) {
      const files = bundleFiles('observations', {
        generator: { name: '@apex-dynamics/data-generator', version, modelVersion: 'mean-reverting-surfaced-v1', pipelineVersion: 'three-stage-v2' },
      })
      expect(() => buildArtifacts(readBundle(writeZip(files)))).toThrow(/generator.version must be a non-empty string/)
    }
  })

  it('writes only the three frame fields to source.json', () => {
    const files = bundleFiles('observations', { frame: { ...FRAME, extra: { injected: true } } })
    const source = JSON.parse(buildArtifacts(readBundle(writeZip(files))).get(OUTPUTS.source)!.toString('utf8'))
    expect(source.frame).toEqual(FRAME)
  })

  it('rejects a manifest file list that does not match its mode', () => {
    const files = bundleFiles('full', { mode: 'observations' })
    expect(() => buildArtifacts(readBundle(writeZip(files)))).toThrow(/does not match bundle mode observations/)
  })

  it('rejects an extracted folder whose files resolve outside it through a link', () => {
    const files = bundleFiles('observations')
    const dir = tempDir()
    const outside = tempDir()
    for (const [name, bytes] of files) {
      const root = name.startsWith('public/') ? outside : dir
      mkdirSync(dirname(join(root, name)), { recursive: true })
      writeFileSync(join(root, name), bytes)
    }
    // 'junction' needs no admin rights on Windows and is ignored elsewhere.
    symlinkSync(join(outside, 'public'), join(dir, 'public'), 'junction')
    expect(() => readBundle(dir)).toThrow(/resolves outside the bundle folder/)
  })
})

describe('readZipEntries', () => {
  const names = ['manifest.json', 'public/delivery-feed.json', 'public/station-catalog.json']
  const items = (): ZipItem[] => [...bundleFiles('observations')].map(([name, data]) => ({ name, data }))

  it('reads stored and deflated entries', () => {
    const stored = items().map((item) => ({ ...item, method: 0 }))
    expect(readZipEntries(makeZip(stored), names).size).toBe(3)
    expect(readZipEntries(makeZip(items()), names).size).toBe(3)
  })

  it('rejects an entry that inflates beyond its declared size', () => {
    const lying = items().map((item) => (item.name === 'public/delivery-feed.json' ? { ...item, declaredSize: 10 } : item))
    expect(() => readZipEntries(makeZip(lying), names)).toThrow(/does not inflate to its declared size/)
  })

  it('rejects an entry declared larger than the entry limit', () => {
    const huge = items().map((item) => (item.name === 'manifest.json' ? { ...item, declaredSize: MAX_ENTRY_BYTES + 1 } : item))
    expect(() => readZipEntries(makeZip(huge), names)).toThrow(/entry limit/)
  })

  it('rejects a duplicated required entry', () => {
    const doubled = [...items(), items().find((item) => item.name === 'manifest.json')!]
    expect(() => readZipEntries(makeZip(doubled), names)).toThrow(/more than once/)
  })

  it('rejects unsupported compression methods', () => {
    const bzip = items().map((item) => ({ ...item, method: 12 }))
    expect(() => readZipEntries(makeZip(bzip), names)).toThrow(/compression method 12/)
  })

  it('rejects input that is not a ZIP archive', () => {
    expect(() => readZipEntries(Buffer.from('not a zip archive at all, just text'), names)).toThrow(/not a ZIP archive/)
  })
})

describe('check', () => {
  function committedRoot(): string {
    const root = tempDir()
    writeArtifacts(root, buildArtifacts(readBundle(writeZip(bundleFiles('observations')))))
    return root
  }

  it('passes on CRLF copies of freshly generated outputs', () => {
    const root = committedRoot()
    for (const path of Object.values(OUTPUTS)) writeFileSync(join(root, path), crlf(readFileSync(join(root, path))))
    expect(check(root)).toEqual([])
  })

  it('names a stale overlay and a missing source file', () => {
    const root = committedRoot()
    const overlayPath = join(root, OUTPUTS.overlay)
    writeFileSync(overlayPath, readFileSync(overlayPath, 'utf8').replace('"t": 1000', '"t": 999').replace('{"t":1000', '{"t":999'))
    let problems = check(root)
    expect(problems.some((p) => p.startsWith(OUTPUTS.overlay))).toBe(true)
    unlinkSync(join(root, OUTPUTS.catalog))
    problems = check(root)
    expect(problems).toContain(`${OUTPUTS.catalog} is missing`)
  })

  it('names a source file whose hash no longer matches source.json', () => {
    const root = committedRoot()
    writeFileSync(join(root, OUTPUTS.feed), text({ ...FEED, records: [] }))
    expect(check(root).some((p) => p.startsWith(`${OUTPUTS.feed} is out of date`))).toBe(true)
  })

  it('writes nothing', () => {
    const root = committedRoot()
    writeFileSync(join(root, OUTPUTS.overlay), '{}\n')
    const before = snapshot(root)
    check(root)
    expect(snapshot(root)).toEqual(before)
  })
})
