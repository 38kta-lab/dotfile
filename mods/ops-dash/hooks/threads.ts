// threads: the replies peers send to ops, kept by sender, numbered, with what
// ops sent them and what ops made of each reply. One file per peer under
// ~/.local/share/life/threads/ (outside this repo), one JSON row a line.

// in: a peer's reply to ops. out: what ops sent the peer. ops: what ops told the
// person in the turn that read reply `ref`.
export type ThreadRow = {
  dir: 'in' | 'out' | 'ops'
  at: number
  text: string
  n?: number // in: the peer's own count, from 1, never reset
  read?: boolean // in
  ref?: number // ops: the reply it is about
}

export type Peer = { name: string; sock?: string; body: string }

// `<cross-session-message from="uds:…sock" from-name="peer-a" …>\nbody\n</cross-session-message>`
const ENVELOPE = /^\s*<cross-session-message\b([^>]*)>\n?([\s\S]*?)\n?<\/cross-session-message>\s*$/

function attr(attrs: string, name: string): string | undefined {
  const m = attrs.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))
  return m ? m[1] : undefined
}

export function parsePeer(text: string): Peer | undefined {
  const m = text.match(ENVELOPE)
  if (!m) return undefined
  const sock = attr(m[1], 'from')
  const name = attr(m[1], 'from-name') || (sock ? sock.replace(/^.*\//, '').replace(/\.sock$/, '') : '')
  if (!name) return undefined
  return { name, sock, body: m[2] }
}

// "claude-worker-b [b43449]" → "claude-worker-b": the name ListAgents prints, with its ref dropped.
export function peerOf(to: string): string {
  return to.replace(/ \[[0-9a-f]+\]$/, '').trim()
}

// The short form a number carries: "claude-worker-b" → "worker-b", "claude-peer-a" → "peer-a".
export function shortName(name: string): string {
  return name.replace(/^claude-/, '')
}

export function label(name: string, n: number): string {
  return `${shortName(name)}-${n}`
}

// The number goes at the head of the body, inside the envelope, so the message
// still reads as the peer's (its sender and address stay as they came).
export function numbered(text: string, tag: string): string {
  return text.replace(/^(\s*<cross-session-message\b[^>]*>\n?)/, `$1【${tag}】`)
}

export function fileOf(dir: string, name: string): string {
  return `${dir.replace(/\/+$/, '')}/${name.replace(/[^A-Za-z0-9._-]/g, '_')}.jsonl`
}

export function parseRows(text: string): ThreadRow[] {
  const out: ThreadRow[] = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      const r = JSON.parse(line)
      if (r && (r.dir === 'in' || r.dir === 'out' || r.dir === 'ops') && typeof r.text === 'string') out.push(r)
    } catch {
      // a torn line is skipped, the rest still read
    }
  }
  return out
}

export function rowsText(rows: readonly ThreadRow[]): string {
  return rows.map(r => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '')
}

export function nextNumber(rows: readonly ThreadRow[]): number {
  return rows.reduce((m, r) => (r.dir === 'in' && typeof r.n === 'number' && r.n > m ? r.n : m), 0) + 1
}

function escape(text: string): string {
  return text.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&')
}

// What ops wrote in a turn, cut for each reply it read: with one reply, the
// whole answer; with several, the part under each reply's heading (a line that
// begins with 【b-3】, after any #, * or -). Text above the first heading goes
// with every part. A reply with no heading gets the whole answer: nothing is lost.
export function splitAnswer(answer: string, tags: readonly string[]): Map<string, string> {
  const out = new Map<string, string>()
  const whole = answer.trim()
  if (tags.length <= 1) {
    for (const t of tags) out.set(t, whole)
    return out
  }
  const lines = answer.split('\n')
  const heads: { tag: string; line: number; rest: string }[] = []
  lines.forEach((l, i) => {
    for (const t of tags) {
      const m = l.match(new RegExp(`^[\\s#*>-]*【${escape(t)}】[\\s*:：]*(.*)$`))
      if (m) heads.push({ tag: t, line: i, rest: m[1].replace(/\*+\s*$/, '').trim() })
    }
  })
  if (heads.length === 0) {
    for (const t of tags) out.set(t, whole)
    return out
  }
  const pre = lines.slice(0, heads[0].line).join('\n').trim()
  heads.forEach((h, k) => {
    const end = k + 1 < heads.length ? heads[k + 1].line : lines.length
    const body = [h.rest, ...lines.slice(h.line + 1, end)].join('\n').trim()
    const part = [pre, body].filter(Boolean).join('\n\n')
    out.set(h.tag, out.has(h.tag) ? `${out.get(h.tag)}\n\n${body}` : part)
  })
  for (const t of tags) if (!out.has(t)) out.set(t, whole)
  return out
}

// The order a thread reads in: by time, with what ops made of a reply right
// under that reply (its own sends in that turn come after).
export function threadOrder(rows: readonly ThreadRow[]): ThreadRow[] {
  const main = rows.filter(r => r.dir !== 'ops').sort((a, b) => a.at - b.at)
  const ops = rows.filter(r => r.dir === 'ops')
  const placed = new Set<ThreadRow>()
  const out: ThreadRow[] = []
  for (const r of main) {
    out.push(r)
    if (r.dir === 'in') for (const o of ops.filter(o => o.ref === r.n)) { out.push(o); placed.add(o) }
  }
  for (const o of ops) if (!placed.has(o)) out.push(o)
  return out
}

export function unread(rows: readonly ThreadRow[]): number {
  return rows.filter(r => r.dir === 'in' && !r.read).length
}

// The text ops gets from the tab's input: the reply, then the first line of
// what it answers.
export function replyPrompt(peer: string, row: ThreadRow | undefined, reply: string): string {
  if (!row || row.dir !== 'in' || row.n === undefined) return `【threads ${peer} への返事】${reply.trim()}`
  const first = row.text.split('\n').find(l => l.trim())?.trim() ?? ''
  return `【threads ${label(peer, row.n)} への返事】${reply.trim()}\n> ${label(peer, row.n)}: ${first}`
}

// Terminal cells a character takes: CJK and full-width forms take two.
function wide(ch: string): boolean {
  return /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/.test(ch)
}

// The text as the lines it takes at `width` cells, each line cut where it fills.
export function wrapCells(text: string, width: number): string[] {
  const out: string[] = []
  for (const raw of text.replace(/\s+$/, '').split('\n')) {
    let line = ''
    let n = 0
    for (const ch of raw) {
      const w = wide(ch) ? 2 : 1
      if (n + w > width) { out.push(line); line = ''; n = 0 }
      line += ch
      n += w
    }
    out.push(line)
  }
  return out
}
