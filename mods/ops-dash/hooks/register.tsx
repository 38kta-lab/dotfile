import type { Register } from 'claude-code'

// Each session started with LIFE_ROLE writes one record about itself to the
// store every session on this machine shares. The ops session reads them all.
// Sessions without a role (cron runs, ad-hoc sessions) write nothing.

export type SessionRecord = {
  name: string
  role: string
  pj?: string
  busy: boolean
  turnStartedAt?: number
  lastTurnEndAt?: number
  contextPercent?: number
  costUsd?: number
  lastReportAt?: number
  updatedAt: number
}

export type Dispatch = { at: number; line: string }
export type Limits = { at: number; windows: { kind: string; percentUsed: number; resetsAt?: string }[] }

const PREFIX = 'ops-dash:session:'
const DISPATCH = 'ops-dash:dispatch:'
const LIMITS = 'ops-dash:limits'
const PANE = 'peers'
// `/peers` is the built-in alias of /list-agents, so the command is /dash.
const COMMAND = 'dash'

type Me = { name: string; role: string; pj?: string }

async function whoAmI($: any): Promise<Me | undefined> {
  const role = await $.env.get('LIFE_ROLE')
  if (!role) return undefined
  const pj = await $.env.get('LIFE_PJ')
  const name = (await $.env.get('LIFE_NAME')) ?? (role === 'ops' ? 'ops' : pj ? `pj-${pj}` : role)
  return { name, role, pj: pj || undefined }
}

// Recording status must never break the session: a failed write is dropped.
async function write($: any, me: Me, change: Partial<SessionRecord>): Promise<void> {
  try {
    await writeOnce($, me, change)
  } catch {
    // the next event writes again
  }
}

async function writeOnce($: any, me: Me, change: Partial<SessionRecord>): Promise<void> {
  const key = PREFIX + me.name
  const old = ((await $.store.get(key)) as SessionRecord | undefined) ?? { name: me.name, role: me.role, busy: false, updatedAt: 0 }
  const now = await $.clock.now()
  await $.store.set(key, { ...old, name: me.name, role: me.role, pj: me.pj, ...change, updatedAt: now })
}

export function hhmm(ms?: number): string {
  if (!ms) return '—'
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// "47分前" / "2時間05分前"
export function ago(now: number, ms?: number): string {
  if (!ms) return ''
  const m = Math.max(0, Math.round((now - ms) / 60000))
  return m < 60 ? `${m}分前` : `${Math.floor(m / 60)}時間${String(m % 60).padStart(2, '0')}分前`
}

export function elapsed(now: number, ms?: number): string {
  if (!ms) return ''
  const m = Math.max(0, Math.round((now - ms) / 60000))
  return m < 60 ? `${m}分` : `${Math.floor(m / 60)}時間${m % 60}分`
}

// Terminal cells a string takes: CJK and full-width forms take two.
export function cells(text: string): number {
  let n = 0
  for (const ch of text) n += /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/.test(ch) ? 2 : 1
  return n
}

export function pad(text: string, width: number): string {
  return text + ' '.repeat(Math.max(0, width - cells(text)))
}

export function bar(percent: number, width = 16): string {
  const filled = Math.max(0, Math.min(width, Math.round((percent / 100) * width)))
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

export function tone(percent: number): string {
  return percent >= 80 ? 'red' : percent >= 50 ? 'yellow' : 'green'
}

// "16:10 リセット" today, "明日 09:00 リセット" tomorrow, else "10/14 09:00 リセット".
export function resetLabel(now: number, iso?: string): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const a = new Date(now), b = new Date(t)
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diff = Math.round((day(b) - day(a)) / 86400000)
  const when = diff === 0 ? hhmm(t) : diff === 1 ? `明日 ${hhmm(t)}` : `${b.getMonth() + 1}/${b.getDate()} ${hhmm(t)}`
  return `${when} リセット`
}

const WINDOW_LABEL: Record<string, string> = { five_hour: '5時間枠', seven_day: '週間枠' }

export type LimitRow = { label: string; percent: number; reset: string }
export function limitRows(l: Limits | undefined, now: number): LimitRow[] {
  return (l?.windows ?? []).map(w => ({ label: WINDOW_LABEL[w.kind] ?? w.kind, percent: w.percentUsed, reset: resetLabel(now, w.resetsAt) }))
}

// One sentence for the status line: "ctx 51% · 5時間枠 1% · 週間枠 17%"
export function limitsLine(l?: Limits): string {
  if (!l || l.windows.length === 0) return 'プラン —'
  return l.windows.map(w => `${WINDOW_LABEL[w.kind] ?? w.kind} ${Math.round(w.percentUsed)}%`).join(' · ')
}

export type Card = {
  name: string
  pj?: string
  busy: boolean
  state: string
  context?: number
  meta: string
}

export function cardsOf(records: SessionRecord[], dispatches: Record<string, Dispatch>, now: number, width: number): Card[] {
  const sorted = [...records].sort((a, b) => (a.role === 'ops' ? -1 : b.role === 'ops' ? 1 : a.name.localeCompare(b.name)))
  return sorted.map(r => {
    const parts: string[] = []
    if (r.lastTurnEndAt) parts.push(`ターン ${hhmm(r.lastTurnEndAt)}（${ago(now, r.lastTurnEndAt)}）`)
    if (r.role !== 'ops' && r.lastReportAt) parts.push(`報告 ${hhmm(r.lastReportAt)}`)
    const d = dispatches[r.name]
    if (d) parts.push(`依頼 ${hhmm(d.at)} ${d.line}`)
    let meta = parts.length ? parts.join(' · ') : 'まだターンなし'
    const room = width - 3
    if (cells(meta) > room) {
      let cut = ''
      for (const ch of meta) {
        if (cells(cut + ch) > room - 1) break
        cut += ch
      }
      meta = cut + '…'
    }
    return {
      name: r.name,
      pj: r.pj,
      busy: r.busy,
      state: r.busy ? `作業中 ${elapsed(now, r.turnStartedAt)}` : '待機',
      context: r.contextPercent,
      meta,
    }
  })
}

async function readAll($: any): Promise<{ records: SessionRecord[]; dispatches: Record<string, Dispatch>; limits?: Limits }> {
  const keys: string[] = await $.store.keys()
  const records: SessionRecord[] = []
  const dispatches: Record<string, Dispatch> = {}
  for (const k of keys) {
    if (k.startsWith(PREFIX)) records.push((await $.store.get(k)) as SessionRecord)
    else if (k.startsWith(DISPATCH)) dispatches[k.slice(DISPATCH.length)] = (await $.store.get(k)) as Dispatch
  }
  return { records, dispatches, limits: (await $.store.get(LIMITS)) as Limits | undefined }
}

// Who this session is, read once per load. Every hook asks, so a skipped
// session.start (or a reload) never leaves the session silent.
let self: Me | undefined
let resolved = false

async function who($: any): Promise<Me | undefined> {
  if (!resolved) {
    self = await whoAmI($)
    resolved = true
  }
  return self
}

export const register: Register = on => {
  resolved = false

  on('session.start', async ($, e, next) => {
    const me = await who($)
    if (me) {
      await write($, me, { busy: false })
      if (me.role === 'ops') {
        try {
          await $.command.register({ name: COMMAND, description: 'Open the ops dashboard: every session with a role (busy or idle, context, last turn, last report, last dispatch) and the plan usage' })
          $.clock.every(30000, () => $.ui.invalidate('ui.render'))
        } catch (err) {
          $.ui.log(`ops-dash: could not register /${COMMAND}: ${String(err)}`)
        }
      }
    }
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    const me = await who($)
    if (me) await write($, me, { busy: true, turnStartedAt: await $.clock.now() })
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    const me = await who($)
    if (me) await write($, me, { busy: false, lastTurnEndAt: await $.clock.now() })
    return ran
  })

  on('session.measure', async ($, e, next) => {
    const me = await who($)
    if (me) {
      await write($, me, { contextPercent: e.context.percent, costUsd: e.cost?.usd })
      if (e.rateLimits.length > 0) {
        await $.store.set(LIMITS, {
          at: await $.clock.now(),
          windows: e.rateLimits.map(w => ({ kind: w.kind, percentUsed: w.percentUsed, resetsAt: w.resetsAt })),
        })
      }
      if (me.role === 'ops') {
        const pct = e.context.percent === undefined ? '—' : `${Math.round(e.context.percent)}%`
        $.ui.status(`context ${pct} · ${limitsLine((await $.store.get(LIMITS)) as Limits | undefined)}`)
      }
      $.ui.invalidate('ui.render')
    }
    return next(e)
  })

  // ops: remember who was sent what. Others: remember when they last reported to ops.
  on('session.send', async ($, e, next) => {
    const ran = await next(e)
    const me = await who($)
    if (me && ran.isDelivered !== false) {
      const now = await $.clock.now()
      if (me.role === 'ops') {
        const line = e.text.split('\n').find(l => l.trim())?.trim().slice(0, 40) ?? ''
        try {
          await $.store.set(DISPATCH + e.to.replace(/ \[[0-9a-f]+\]$/, ''), { at: now, line })
        } catch {
          // a lost dispatch record only blanks one cell
        }
      } else if (/^ops\b/.test(e.to)) {
        await write($, me, { lastReportAt: now })
      }
    }
    return ran
  })

  on('command.run', { command: COMMAND }, async $ => {
    await $.ui.open({ id: PANE, title: 'ops-dash', columns: 48 })
    return { text: 'ops-dash opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const { records, dispatches, limits } = await readAll($)
    const now = await $.clock.now()
    const width = Math.max(36, e.props.bodyColumns ?? 48)
    const barWidth = Math.max(8, Math.min(20, width - 26))
    const rule = '─'.repeat(width)

    const limitLines = limitRows(limits, now)
    const sessions = cardsOf(records, dispatches, now, width)

    return (
      <Box flexDirection="column">
        <Text bold>プランの利用枠</Text>
        {limitLines.length === 0 && <Text dimColor>まだ計測なし</Text>}
        {limitLines.map(l => (
          <Box flexDirection="row">
            <Text>{pad(l.label, 9)}</Text>
            <Text color={tone(l.percent)}>{bar(l.percent, barWidth)}</Text>
            <Text bold>{` ${String(Math.round(l.percent)).padStart(3)}%`}</Text>
            <Text dimColor>{`  ${l.reset}`}</Text>
          </Box>
        ))}
        <Text dimColor>{rule}</Text>
        {sessions.length === 0 && <Text dimColor>LIFE_ROLE のあるセッションがまだ状態を書いていません</Text>}
        {sessions.map(c => (
          <Box flexDirection="column" marginBottom={1}>
            <Box flexDirection="row">
              <Text color={c.busy ? 'yellow' : 'green'}>{c.busy ? '● ' : '○ '}</Text>
              <Text bold>{pad(c.name, 11)}</Text>
              <Text dimColor>{pad(c.pj ?? '', 6)}</Text>
              <Text color={c.busy ? 'yellow' : undefined} dimColor={!c.busy}>{c.state}</Text>
            </Box>
            <Box flexDirection="row">
              <Text dimColor>{'  context '}</Text>
              {c.context === undefined ? (
                <Text dimColor>まだ計測なし</Text>
              ) : (
                <Box flexDirection="row">
                  <Text color={tone(c.context)}>{bar(c.context, barWidth)}</Text>
                  <Text bold>{` ${String(Math.round(c.context)).padStart(3)}%`}</Text>
                </Box>
              )}
            </Box>
            <Text dimColor>{`  ${c.meta}`}</Text>
          </Box>
        ))}
      </Box>
    )
  })
}
