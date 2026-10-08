// Reading a research repo's note/note.md table of contents (written by the
// life repo's scripts/note_toc.py) and choosing pictures under a number's
// data folder, for the notes pane. Pure functions: the tests feed them text.

export type TocRow = { id: string; date: string; title: string; conclusion: string; state: string }

const cellsOf = (row: string) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'))

// The rows of the table between <!-- TOC:START --> and <!-- TOC:END -->.
export function tocRows(md: string): TocRow[] {
  const start = md.indexOf('<!-- TOC:START -->')
  const end = md.indexOf('<!-- TOC:END -->')
  if (start < 0 || end < start) return []
  const out: TocRow[] = []
  for (const line of md.slice(start, end).split('\n')) {
    if (!/^\|\s*KM_[A-Z]\d{4}\s*\|/.test(line)) continue
    const c = cellsOf(line)
    if (c.length < 5) continue
    out.push({ id: c[0], date: c[1], title: c[2], conclusion: c[3], state: c[4] })
  }
  return out
}

// A hub's frontmatter value, the inline comment after "  #" dropped.
export function frontValue(md: string, key: string): string | undefined {
  const fm = md.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ''
  const line = fm.split('\n').find(l => l.startsWith(`${key}:`))
  if (!line) return undefined
  return line.slice(key.length + 1).replace(/\s+#.*$/, '').trim() || undefined
}

// `find` output → picture paths relative to the number's folder, sorted, at most `max`.
export function pngList(findOut: string, base: string, max = 200): string[] {
  const root = base.replace(/\/+$/, '') + '/'
  return findOut
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.toLowerCase().endsWith('.png') && l.startsWith(root))
    .map(l => l.slice(root.length))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, max)
}

// Terminal rows for a picture `columns` wide: a cell is about twice as tall as wide.
export function imageRows(width: number, height: number, columns: number, maxRows = 40): number {
  if (!width || !height) return Math.min(maxRows, Math.round(columns / 2))
  return Math.max(4, Math.min(maxRows, Math.round((columns * height) / width / 2)))
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

// Standard padded base64: what Image's `png` must be.
export function base64(u8: Uint8Array): string {
  let out = ''
  for (let i = 0; i < u8.length; i += 3) {
    const a = u8[i], b = i + 1 < u8.length ? u8[i + 1] : 0, c = i + 2 < u8.length ? u8[i + 2] : 0
    const n = (a << 16) | (b << 8) | c
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63]
    out += i + 1 < u8.length ? B64[(n >> 6) & 63] : '='
    out += i + 2 < u8.length ? B64[n & 63] : '='
  }
  return out
}

// What $.fs.read(path, { as: 'bytes' }) gave, as base64: a session hands
// { base64 }, a test hands bytes (or an object of them).
export function bytesToBase64(r: any): string {
  if (typeof r?.base64 === 'string') return r.base64
  const raw = r?.bytes ?? r
  const u8 = raw instanceof Uint8Array ? raw : Array.isArray(raw) ? Uint8Array.from(raw) : raw && typeof raw === 'object' ? Uint8Array.from(Object.values(raw) as number[]) : new Uint8Array(0)
  return base64(u8)
}

export const isBase64 = (s: string) => s.length > 0 && s.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(s)
