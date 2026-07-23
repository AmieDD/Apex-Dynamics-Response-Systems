// bannerGlyphs.ts
//
// Small helpers for the console boot banner's decorative glyph layer. Maps
// printable ASCII to and from the Unicode Tags plane (U+E0000+) so banner lines
// can carry a compact, non-printing "glyph tag" annotation

const TAG_BASE = 0xe0000
const ASCII_MIN = 0x20
const ASCII_MAX = 0x7e

/** Map printable ASCII (0x20..0x7E) into the Unicode Tags plane. Other chars skipped. */
export function encodeGlyphs(text: string): string {
  let out = ''
  for (const ch of text) {
    const cp = ch.codePointAt(0)
    if (cp === undefined) continue
    if (cp < ASCII_MIN || cp > ASCII_MAX) continue
    out += String.fromCodePoint(TAG_BASE + cp)
  }
  return out
}

/** Map Unicode Tags-plane codepoints back to printable ASCII. Other chars ignored. */
export function decodeGlyphs(encoded: string): string {
  let out = ''
  for (const ch of encoded) {
    const cp = ch.codePointAt(0)
    if (cp === undefined) continue
    const decoded = cp - TAG_BASE
    if (decoded < ASCII_MIN || decoded > ASCII_MAX) continue
    out += String.fromCodePoint(decoded)
  }
  return out
}

/** Encode printable ASCII (0x20..0x7E) into the Unicode Tags plane, returning one
 *  string per code point. Working per code point keeps callers from splitting the
 *  surrogate pairs each Tags-plane codepoint occupies. Other chars are skipped. */
export function encodeGlyphUnits(text: string): string[] {
  const units: string[] = []
  for (const ch of text) {
    const cp = ch.codePointAt(0)
    if (cp === undefined || cp < ASCII_MIN || cp > ASCII_MAX) continue
    units.push(String.fromCodePoint(TAG_BASE + cp))
  }
  return units
}


export function applyKerning(line: string, annotation: string): string {
  const units = encodeGlyphUnits(annotation)
  const spaces = [...line].filter((c) => c === ' ').length
  if (spaces === 0) return line + units.join('')
  const base = Math.floor(units.length / spaces)
  const rem = units.length % spaces
  let out = ''
  let cursor = 0
  let seen = 0
  for (const ch of line) {
    out += ch
    if (ch === ' ') {
      const take = base + (seen < rem ? 1 : 0)
      out += units.slice(cursor, cursor + take).join('')
      cursor += take
      seen += 1
    }
  }
  return out
}

export interface HiddenCodePoint {
  index: number
  codePoint: number
  isTag: boolean
}

export interface ScanResult {
  hidden: HiddenCodePoint[]
  decoded: string
}

const SUSPICIOUS_SINGLE = new Set<number>([
  0x200b, // ZERO WIDTH SPACE
  0x200c, 
  0x200d, 
  0x2060, 
  0xfeff, 
])

function isTagCodePoint(cp: number): boolean {
  return cp >= TAG_BASE && cp <= TAG_BASE + 0x7f
}

function isSuspicious(cp: number): boolean {
  return isTagCodePoint(cp) || SUSPICIOUS_SINGLE.has(cp)
}


export function findHiddenPayloads(source: string): ScanResult {
  const hidden: HiddenCodePoint[] = []
  let index = 0
  for (const ch of source) {
    const cp = ch.codePointAt(0)
    if (cp !== undefined && isSuspicious(cp)) {
      hidden.push({ index, codePoint: cp, isTag: isTagCodePoint(cp) })
    }
    index += ch.length
  }
  return { hidden, decoded: decodeGlyphs(source) }
}
