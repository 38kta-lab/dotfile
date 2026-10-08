// Reading project hubs (projects/active/<slug>.md) for the hubs pane.
// Pure functions: no engine calls, so the tests can feed them text.

export type Milestone = { date: string; label: string; daysLeft: number }

export type Hub = {
  slug: string
  title: string
  summary: string
  status: string
  updated: string
  daysSinceUpdate?: number
  next?: Milestone
  openNext: number
  related: string[]
  sections: { name: string; body: string }[]
  text: string
}

const DAY = 86400000

function dayOf(ms: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function parseDate(s: string): number | undefined {
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : undefined
}

function frontmatter(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  const m = text.match(/^---\n([\s\S]*?)\n---/)
  if (!m) return out
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/)
    if (kv) out[kv[1]] = kv[2].replace(/^"(.*)"$/, '$1').trim()
  }
  return out
}

// "## " sections, ignoring "## " lines inside code fences.
export function sections(text: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = []
  let fence = false
  let current: { name: string; lines: string[] } | undefined
  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence
    if (!fence && line.startsWith('## ')) {
      if (current) out.push({ name: current.name, body: current.lines.join('\n').trim() })
      current = { name: line.slice(3).trim(), lines: [] }
      continue
    }
    if (current) current.lines.push(line)
  }
  if (current) out.push({ name: current.name, body: current.lines.join('\n').trim() })
  return out
}

const plainCell = (s: string) => s.replace(/\*\*/g, '').replace(/[★⭐]/g, '').trim()

// The nearest milestone on or after today, from the Milestones table.
// Struck-through rows (~~...~~) do not count.
export function nextMilestone(body: string, now: number): Milestone | undefined {
  const today = dayOf(now)
  let best: Milestone | undefined
  for (const row of body.split('\n')) {
    if (!row.startsWith('|') || /^\|\s*-/.test(row) || row.includes('~~')) continue
    const cells = row.split('|').slice(1, -1)
    if (cells.length < 2) continue
    const t = parseDate(cells[0])
    if (t === undefined || t < today) continue
    const daysLeft = Math.round((t - today) / DAY)
    if (!best || daysLeft < best.daysLeft) {
      best = { date: cells[0].match(/\d{4}-(\d{2})-(\d{2})/)![0].slice(5).replace('-', '/').replace(/^0/, ''), label: plainCell(cells[1]), daysLeft }
    }
  }
  return best
}

export function openActions(body: string): number {
  return body.split('\n').filter(l => /^\s*(?:-|\d+\.)\s*(?:⬜|\[ \])/.test(l)).length
}

export function parseHub(slug: string, text: string, now: number): Hub {
  const fm = frontmatter(text)
  const secs = sections(text)
  const find = (pred: (n: string) => boolean) => secs.find(s => pred(s.name))
  const milestones = find(n => n.startsWith('Milestones'))
  const nextActions = find(n => n.startsWith('Next Actions'))
  const updatedAt = parseDate(fm.updated ?? '')
  const related = (fm.related ?? '')
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map(s => s.trim().split('/').pop()!.replace(/\.md$/, ''))
    .filter(Boolean)
  return {
    slug,
    title: (text.match(/^# (.+)$/m)?.[1] ?? slug).trim(),
    summary: fm.summary ?? '',
    status: fm.status ?? '',
    updated: fm.updated ?? '',
    daysSinceUpdate: updatedAt === undefined ? undefined : Math.round((dayOf(now) - updatedAt) / DAY),
    next: milestones ? nextMilestone(milestones.body, now) : undefined,
    openNext: nextActions ? openActions(nextActions.body) : 0,
    related,
    sections: secs,
    text,
  }
}

const STATUS_ORDER = ['active', 'pending', 'blocked', 'standing', 'done', 'archived']

export function sortHubs(hubs: Hub[]): Hub[] {
  const rank = (s: string) => (STATUS_ORDER.indexOf(s) === -1 ? 99 : STATUS_ORDER.indexOf(s))
  return [...hubs].sort((a, b) => rank(a.status) - rank(b.status) || (a.daysSinceUpdate ?? 9999) - (b.daysSinceUpdate ?? 9999) || a.slug.localeCompare(b.slug))
}

// The tabs of the detail view, and how each finds its section.
export const TABS: { key: string; label: string; pick: (h: Hub) => { name: string; body: string } | undefined }[] = [
  {
    key: '1',
    label: 'Current State',
    // older hubs append dated "Current State" sections; the last one is the newest
    pick: h => [...h.sections].reverse().find(s => s.name.includes('Current State')),
  },
  { key: '2', label: 'Milestones', pick: h => h.sections.find(s => s.name.startsWith('Milestones')) },
  { key: '3', label: 'Next Actions', pick: h => h.sections.find(s => s.name.startsWith('Next Actions')) },
  { key: '4', label: '会議', pick: h => h.sections.find(s => s.name.startsWith('Meetings')) },
  { key: '5', label: '置き場', pick: h => h.sections.find(s => s.name.startsWith('Repositories')) },
  { key: '6', label: '全文', pick: h => ({ name: '全文', body: h.text }) },
]

// Tables wrap badly in a pane, so every table is drawn as a list: the first
// cell bold, the second beside it, the rest as "column: value" lines below.
// Code fences are left as they are.
const cellsOf = (row: string) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
const isRule = (row: string) => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(row.trim())

export function tablesToLists(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let fence = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*(```|~~~)/.test(line)) fence = !fence
    const startsTable = !fence && line.trim().startsWith('|') && i + 1 < lines.length && isRule(lines[i + 1])
    if (!startsTable) {
      out.push(line)
      continue
    }
    const head = cellsOf(line)
    i += 2
    while (i < lines.length && lines[i].trim().startsWith('|')) {
      const c = cellsOf(lines[i])
      const first = c[0] ? `**${c[0].replace(/\*\*/g, '')}**` : ''
      out.push(`- ${[first, c[1]].filter(Boolean).join(' — ')}`)
      for (let k = 2; k < c.length; k++) {
        if (c[k] && c[k] !== '—' && c[k] !== '-') out.push(`  - ${head[k] ? `${head[k]}: ` : ''}${c[k]}`)
      }
      i++
    }
    i--
    out.push('')
  }
  return out.join('\n')
}

export const MAX_CHARS = 90000

export function sectionMarkdown(h: Hub, tab: number): string {
  const t = TABS[tab]
  const s = t.pick(h)
  if (!s) return `_この hub には「${t.label}」の節がありません。_`
  const body = tablesToLists(s.name === '全文' ? s.body : `## ${s.name}\n\n${s.body}`)
  if (body.length <= MAX_CHARS) return body
  return body.slice(0, MAX_CHARS) + `\n\n_（${body.length.toLocaleString()} 字のうち先頭 ${MAX_CHARS.toLocaleString()} 字まで。続きは節ごとに見てください）_`
}

// The draft put in the ops prompt by "次の一手を相談": where the hub is, its
// current state and its first open next actions, then the ask. The person
// reads it, edits it if they like, and sends it; nothing is sent from here.
export function consultText(h: Hub, path: string, maxState = 1500): string {
  const state = TABS[0].pick(h)
  let body = (state?.body ?? '').trim()
  if (body.length > maxState) body = body.slice(0, maxState) + '\n…（続きは hub）'
  const next = h.sections.find(s => s.name.startsWith('Next Actions'))
  const open = (next?.body ?? '')
    .split('\n')
    .filter(l => /^\s*(?:-|\d+\.)\s*(?:⬜|\[ \])/.test(l))
    .slice(0, 3)
    .map(l => l.trim())
  return [
    `hub「${h.slug}」（${h.title}）の次の一手を一緒に考えたい。全文は ${path}`,
    '',
    `## ${state?.name ?? 'Current State'}`,
    body || '（書かれていない）',
    '',
    '## Next Actions（まだ済んでいない上から 3 つ）',
    ...(open.length ? open : ['（無い）']),
    '',
    'これを踏まえて、次にやるべきことを 1〜3 個、理由つきで提案して。締切と、誰がやるか（user / ops / peer）も添えて。',
  ].join('\n')
}
