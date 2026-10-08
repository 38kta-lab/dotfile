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

export function age(now: number, ms?: number): string {
  if (!ms) return ''
  const m = Math.round((now - ms) / 60000)
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}

export function limitsLine(l?: Limits): string {
  if (!l || l.windows.length === 0) return 'plan: —'
  const label = (k: string) => (k === 'five_hour' ? '5h' : k === 'seven_day' ? '7d' : k)
  return l.windows
    .map(w => `${label(w.kind)} ${Math.round(w.percentUsed)}%${w.resetsAt ? ` (→${hhmm(Date.parse(w.resetsAt))})` : ''}`)
    .join('  ')
}

// One row per session, ops first, then by name.
export function rows(records: SessionRecord[], dispatches: Record<string, Dispatch>, now: number): string[] {
  const sorted = [...records].sort((a, b) => (a.role === 'ops' ? -1 : b.role === 'ops' ? 1 : a.name.localeCompare(b.name)))
  return sorted.map(r => {
    const state = r.busy ? `busy ${age(now, r.turnStartedAt)}` : 'idle'
    const ctx = r.contextPercent === undefined ? '—' : `${Math.round(r.contextPercent)}%${r.contextPercent >= 70 ? '!' : ''}`
    const d = dispatches[r.name]
    const sent = d ? `${hhmm(d.at)} ${d.line}` : ''
    const report = r.role === 'ops' ? '' : `report ${hhmm(r.lastReportAt)}`
    return [
      r.name.padEnd(12),
      (r.pj ?? '').padEnd(6),
      state.padEnd(10),
      `ctx ${ctx}`.padEnd(9),
      `turn ${hhmm(r.lastTurnEndAt)}`.padEnd(11),
      report.padEnd(13),
      sent,
    ].join(' ').trimEnd()
  })
}

// The sidebar form: two short lines per session, for a pane docked beside
// the transcript (narrow) rather than above the prompt (wide).
export function cards(records: SessionRecord[], dispatches: Record<string, Dispatch>, now: number, width: number): string[][] {
  const sorted = [...records].sort((a, b) => (a.role === 'ops' ? -1 : b.role === 'ops' ? 1 : a.name.localeCompare(b.name)))
  return sorted.map(r => {
    const state = r.busy ? `busy ${age(now, r.turnStartedAt)}` : 'idle'
    const ctx = r.contextPercent === undefined ? '—' : `${Math.round(r.contextPercent)}%${r.contextPercent >= 70 ? '!' : ''}`
    const first = `${r.name}${r.pj ? ` ${r.pj}` : ''}  ${state}  ctx ${ctx}`
    const d = dispatches[r.name]
    const parts = [`turn ${hhmm(r.lastTurnEndAt)}`]
    if (r.role !== 'ops') parts.push(`report ${hhmm(r.lastReportAt)}`)
    if (d) parts.push(`sent ${hhmm(d.at)} ${d.line}`)
    const second = '  ' + parts.join('  ')
    return [first, second.length > width ? second.slice(0, Math.max(0, width - 1)) + '…' : second]
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
        $.ui.status(`ctx ${pct} · ${limitsLine((await $.store.get(LIMITS)) as Limits | undefined)}`)
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
    await $.ui.open({ id: PANE, title: 'peers', columns: 48 })
    return { text: 'ops-dash opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const { records, dispatches, limits } = await readAll($)
    const now = await $.clock.now()
    const empty = records.length === 0
    if (e.props.placement === 'dock') {
      const width = e.props.bodyColumns ?? 48
      return (
        <Box flexDirection="column">
          <Text dimColor>{limitsLine(limits)}</Text>
          {empty && <Text dimColor>No session with LIFE_ROLE has written a status yet.</Text>}
          {cards(records, dispatches, now, width).map(([first, second]) => (
            <Box flexDirection="column" marginTop={1}>
              <Text bold>{first}</Text>
              <Text dimColor>{second}</Text>
            </Box>
          ))}
        </Box>
      )
    }
    const lines = rows(records, dispatches, now)
    return (
      <Box flexDirection="column">
        <Text dimColor>{limitsLine(limits)}</Text>
        {empty && <Text dimColor>No session with LIFE_ROLE has written a status yet.</Text>}
        {lines.map(l => (
          <Text>{l}</Text>
        ))}
      </Box>
    )
  })
}
