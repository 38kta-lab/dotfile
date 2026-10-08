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


// ---- calendar: one week, fixed height ----------------------------------

export type CalEvent = { title: string; start: string; end: string; calendarId: string }

export const HOUR_FIRST = 8
export const HOUR_LAST = 20 // the last row is 20:00–21:00
const WEEKDAY = ['日', '月', '火', '水', '木', '金', '土']

export function isAllDay(ev: CalEvent): boolean {
  return !ev.start.includes('T')
}

// "[07_G] note と hub の整理 [status:focus]" → "07_G"; untagged → the title's start
export function shortTitle(title: string): string {
  const tag = title.match(/^\[([^\]]+)\]/)
  if (tag && !tag[1].startsWith('status:')) return tag[1]
  return title.replace(/\[status:[^\]]+\]/g, '').replace(/【[^】]*】/g, '').trim()
}

export function eventColor(ev: CalEvent): string {
  const t = ev.title
  if (/\[status:focus\]/.test(t)) return 'green'
  if (/\[status:meeting\]/.test(t) || /【MTG】/.test(t)) return 'blue'
  if (/\[status:experiment\]/.test(t)) return 'magenta'
  if (/\[status:break\]/.test(t)) return 'gray'
  if (!ev.calendarId.startsWith('c_')) return 'blue'
  return 'cyan'
}

function dayStart(ms: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

// all-day events: "2026-10-14" … end exclusive
function allDayCovers(ev: CalEvent, day: number): boolean {
  const [ys, ms, ds] = ev.start.slice(0, 10).split('-').map(Number)
  const [ye, me, de] = ev.end.slice(0, 10).split('-').map(Number)
  const s = new Date(ys, ms - 1, ds).getTime()
  const e = new Date(ye, me - 1, de).getTime()
  return day >= s && day < e
}

export type Cell = { text: string; color?: string }
export type Week = { days: { label: string; isToday: boolean }[]; allDay: Cell[]; hours: { label: string; isNow: boolean; cells: Cell[] }[] }

// The grid is always 1 header + 1 all-day row + 12 hour rows, whatever the events.
export function weekGrid(events: CalEvent[], now: number, dayWidth: number): Week {
  const today = dayStart(now)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today + i * 86400000 + 3600000) // +1h guards DST-free JST anyway
    const start = dayStart(d.getTime())
    return { start, label: `${d.getDate()}${WEEKDAY[d.getDay()]}`, isToday: i === 0 }
  })
  const fit = (t: string) => {
    let out = ''
    for (const ch of t) {
      if (cells(out + ch) > dayWidth - 1) break
      out += ch
    }
    return pad(out, dayWidth - 1) + ' '
  }
  const blank = { text: ' '.repeat(dayWidth) }

  const allDay = days.map(d => {
    const ev = events.find(e => isAllDay(e) && allDayCovers(e, d.start))
    if (!ev) return blank
    const first = allDayCovers(ev, d.start - 86400000) && d.start !== today ? '' : shortTitle(ev.title)
    return { text: fit(first), color: eventColor(ev) }
  })

  const nowHour = new Date(now).getHours()
  const hours = []
  for (let h = HOUR_FIRST; h <= HOUR_LAST; h++) {
    const cellsRow = days.map(d => {
      const from = d.start + h * 3600000
      const to = from + 3600000
      const ev = events.find(e => !isAllDay(e) && Date.parse(e.start) < to && Date.parse(e.end) > from)
      if (!ev) return blank
      const startsHere = Date.parse(ev.start) >= from || h === HOUR_FIRST
      return { text: fit(startsHere ? shortTitle(ev.title) : ''), color: eventColor(ev) }
    })
    hours.push({ label: String(h).padStart(2, '0'), isNow: h === nowHour, cells: cellsRow })
  }
  return { days: days.map(d => ({ label: d.label, isToday: d.isToday })), allDay, hours }
}

// ---- tasks: ideas/task-review/tasks.md ---------------------------------
// A line is "- ⬜ [PJ] what — @owner — MM/DD（deadline note）". Only lines
// under a "## " heading count, so the file's own preamble is never a task.

export type Task = { done: boolean; tag: string; title: string; owner: string; deadline?: { month: number; day: number } }
export type TaskSection = { title: string; tasks: Task[] }

function plain(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').trim()
}

export function parseTask(done: boolean, body: string): Task {
  let rest = plain(body)
  let tag = ''
  const t = rest.match(/^\[([^\]]+)\]\s*/)
  if (t) {
    tag = t[1]
    rest = rest.slice(t[0].length)
  }
  // the deadline note is the parenthetical that ends the line, after the parts
  let deadline: Task['deadline']
  const tail = rest.match(/（([^（）]*)）$/)
  // " — " separates the parts; tasks.md also writes "）— " with no space before it
  const parts = rest.split(/\s?— /)
  const title = parts[0].trim()
  let owner = ''
  for (const part of parts.slice(1)) {
    const at = part.match(/@([A-Za-z0-9_\-・@]+)/)
    if (at) {
      const names = part.match(/@[A-Za-z0-9_\-]+/g) ?? []
      const others = names.map(n => n.slice(1)).filter(n => n !== 'user')
      owner = others.map(n => n.replace(/^claude-/, '')).join('・')
      if (/未依頼/.test(part)) owner += owner ? ' 未依頼' : ''
    }
  }
  if (tail && parts.length > 1) {
    const d = tail[1].match(/(\d{1,2})\/(\d{1,2})/)
    if (d) deadline = { month: Number(d[1]), day: Number(d[2]) }
  }
  return { done, tag, title, owner, deadline }
}

export function parseTasks(md: string): TaskSection[] {
  const out: TaskSection[] = []
  for (const raw of md.split('\n')) {
    const h = raw.match(/^## (.+)$/)
    if (h) {
      out.push({ title: h[1].trim(), tasks: [] })
      continue
    }
    const t = raw.match(/^- (⬜|✅) (.+)$/)
    if (t && out.length > 0) out[out.length - 1].tasks.push(parseTask(t[1] === '✅', t[2]))
  }
  return out
}

// days from today to the deadline (this year, or next year if it is long past)
export function daysLeft(now: number, d: { month: number; day: number }): number {
  const today = new Date(dayStart(now))
  let target = new Date(today.getFullYear(), d.month - 1, d.day)
  if (target.getTime() < today.getTime() - 180 * 86400000) target = new Date(today.getFullYear() + 1, d.month - 1, d.day)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

export function tagColor(tag: string): string {
  if (/^\d\d_[A-Z]/.test(tag)) return 'cyan'
  if (/^[A-Z]\d\d/.test(tag)) return 'magenta'
  return 'gray'
}

export function shortTag(tag: string, width: number): string {
  const first = tag.split('/')[0]
  const t = tag.includes('/') ? `${first}+` : first
  return pad(cells(t) > width ? clip(t, width) : t, width)
}

export function clip(text: string, width: number): string {
  if (cells(text) <= width) return text
  let out = ''
  for (const ch of text) {
    if (cells(out + ch) > width - 1) break
    out += ch
  }
  return out + '…'
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

// The ops session's calendar, fetched every 10 minutes.
let calendar: CalEvent[] = []
let calendarNote = ''

async function fetchCalendar($: any, python: string, repo: string): Promise<void> {
  if (!python || !repo) {
    calendarNote = 'カレンダー未設定（pluginConfigs の python / life_repo）'
    return
  }
  const now = await $.clock.now()
  const d0 = new Date(dayStart(now))
  const d7 = new Date(dayStart(now) + 7 * 86400000 + 3600000)
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  try {
    const r = await $.process.run(
      [python, `${repo}/scripts/google_calendar_read.py`, '--start', iso(d0), '--end', iso(d7), '--format', 'json'],
      { cwd: repo, timeoutMs: 60000 },
    )
    if (r.exitCode !== 0) {
      calendarNote = `カレンダー取得に失敗（exit ${r.exitCode}）`
      return
    }
    const list = JSON.parse(r.stdout) as { title: string; start: string; end: string; calendar_id: string }[]
    calendar = list.map(e => ({ title: e.title, start: e.start, end: e.end, calendarId: e.calendar_id }))
    calendarNote = `更新 ${hhmm(now)}`
  } catch (err) {
    calendarNote = `カレンダー取得に失敗（${String(err).slice(0, 40)}）`
  }
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

export const register: Register = (on, options) => {
  resolved = false
  const python = String(options.python ?? '')
  const repo = String(options.life_repo ?? '')

  on('session.start', async ($, e, next) => {
    const me = await who($)
    if (me) {
      await write($, me, { busy: false })
      if (me.role === 'ops') {
        // The pane shows context and plan usage; no status line (and clear one
        // an earlier version of this mod left).
        $.ui.status(undefined)
        try {
          await $.command.register({ name: COMMAND, description: 'Open the ops dashboard: every session with a role (busy or idle, context, last turn, last report, last dispatch) and the plan usage' })
          $.clock.every(30000, () => $.ui.invalidate('ui.render'))
          void fetchCalendar($, python, repo).then(() => $.ui.invalidate('ui.render'))
          $.clock.every(600000, () => fetchCalendar($, python, repo).then(() => $.ui.invalidate('ui.render')))
        } catch (err) {
          $.ui.log(`ops-dash: could not register /${COMMAND}: ${String(err)}`)
        }
      }
    }
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    const me = await who($)
    // No status line: clear any an earlier version of this mod left.
    if (me?.role === 'ops') $.ui.status(undefined)
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
    const opened = await $.ui.open({ id: PANE, title: 'ops-dash', columns: 58, focus: true })
    if (opened.isPlaced) return { text: 'ops-dash opened.' }
    return { text: `ops-dash: the pane is waiting and not drawn yet (${opened.reason ?? 'no reason given'}).` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const { records, limits } = await readAll($)
    const now = await $.clock.now()
    const width = Math.max(40, e.props.bodyColumns ?? 58)
    const rule = (label: string) => `─ ${label} ` + '─'.repeat(Math.max(0, width - cells(label) - 3))

    // plan usage: two short lines
    const limitLines = limitRows(limits, now)
    const smallBar = Math.max(6, Math.min(14, width - 34))

    // sessions: one line each
    const sorted = [...records].sort((a, b) => (a.role === 'ops' ? -1 : b.role === 'ops' ? 1 : a.name.localeCompare(b.name)))
    const peerBar = Math.max(6, Math.min(12, width - 40))

    // calendar: fixed height
    const dayWidth = Math.max(5, Math.floor((width - 3) / 7))
    const week = weekGrid(calendar, now, dayWidth)

    // tasks: grows; the pane scrolls
    let tasks: TaskSection[] = []
    let taskNote = ''
    if (repo) {
      try {
        tasks = parseTasks(String(await $.fs.read(`${repo}/ideas/task-review/tasks.md`)))
      } catch {
        taskNote = 'tasks.md を読めない'
      }
    } else taskNote = 'タスク未設定（pluginConfigs の life_repo）'

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}><Text dimColor>{rule('system usage')}</Text></Box>
        {limitLines.length === 0 && <Text dimColor>まだ計測なし</Text>}
        {limitLines.map(l => (
          <Box flexDirection="row">
            <Text>{pad(l.label, 8)}</Text>
            <Text color={tone(l.percent)}>{bar(l.percent, smallBar)}</Text>
            <Text bold>{` ${String(Math.round(l.percent)).padStart(3)}%`}</Text>
            <Text dimColor>{`  ${l.reset}`}</Text>
          </Box>
        ))}

        <Box marginTop={1} marginBottom={1}><Text dimColor>{rule('sessions')}</Text></Box>
        {sorted.length === 0 && <Text dimColor>まだ状態を書いたセッションなし</Text>}
        {sorted.map(r => (
          <Box flexDirection="row">
            <Text color={r.busy ? 'yellow' : 'green'}>{r.busy ? '● ' : '○ '}</Text>
            <Text bold>{pad(r.name, 10)}</Text>
            <Text dimColor>{pad(r.pj ?? '', 5)}</Text>
            {r.contextPercent === undefined ? (
              <Text dimColor>{pad('ctx —', peerBar + 5)}</Text>
            ) : (
              <Box flexDirection="row">
                <Text color={tone(r.contextPercent)}>{bar(r.contextPercent, peerBar)}</Text>
                <Text>{` ${String(Math.round(r.contextPercent)).padStart(3)}%`}</Text>
              </Box>
            )}
            <Text color={r.busy ? 'yellow' : undefined} dimColor={!r.busy}>
              {r.busy ? `  作業中 ${elapsed(now, r.turnStartedAt)}` : r.lastTurnEndAt ? `  ${ago(now, r.lastTurnEndAt)}` : '  —'}
            </Text>
          </Box>
        ))}

        <Box marginTop={1} marginBottom={1}><Text dimColor>{rule(`calendar  ${calendarNote}`)}</Text></Box>
        <Box flexDirection="row">
          <Text>{'   '}</Text>
          {week.days.map(d => (
            <Text bold={d.isToday} inverse={d.isToday}>{pad(d.label, dayWidth)}</Text>
          ))}
        </Box>
        <Box flexDirection="row">
          <Text dimColor>{'終 '}</Text>
          {week.allDay.map(c => (c.color ? <Text backgroundColor={c.color} color="black">{c.text}</Text> : <Text dimColor>{c.text}</Text>))}
        </Box>
        {week.hours.map(row => (
          <Box flexDirection="row">
            <Text color={row.isNow ? 'yellow' : undefined} dimColor={!row.isNow} bold={row.isNow}>{`${row.label} `}</Text>
            {row.cells.map(c => (c.color ? <Text backgroundColor={c.color} color="black">{c.text}</Text> : <Text dimColor>{c.text.replace(/ (?=$)/, '·').replace(/^ /, ' ')}</Text>))}
          </Box>
        ))}

        <Box marginTop={1} marginBottom={1}><Text dimColor>{rule('tasks')}</Text></Box>
        {taskNote !== '' && <Text dimColor>{taskNote}</Text>}
        {tasks.map(section => {
          const open = section.tasks.filter(t => !t.done)
          const done = section.tasks.filter(t => t.done)
          const head = `残り ${open.length}`
          return (
            <Box flexDirection="column" marginBottom={1}>
              <Box flexDirection="row">
                <Text bold>{pad(section.title, width - cells(head))}</Text>
                <Text dimColor>{head}</Text>
              </Box>
              {[...open, ...done].map(t => {
                const left = t.deadline ? daysLeft(now, t.deadline) : undefined
                const due = t.deadline ? `〆${t.deadline.month}/${t.deadline.day}` : ''
                const who = t.owner ? `→ ${t.owner}` : ''
                const meta = [who, due].filter(Boolean).join('  ')
                const titleWidth = Math.max(8, width - 3 - 6 - (meta ? cells(meta) + 2 : 0))
                const dueColor = t.done || left === undefined ? undefined : left < 0 ? 'red' : left <= 3 ? 'yellow' : undefined
                return (
                  <Box flexDirection="row">
                    <Text dimColor={t.done}>{t.done ? '✅ ' : '⬜ '}</Text>
                    <Text color={t.done ? undefined : tagColor(t.tag)} dimColor={t.done}>{shortTag(t.tag, 5) + ' '}</Text>
                    <Text dimColor={t.done}>{pad(clip(t.title, titleWidth), titleWidth)}</Text>
                    {who !== '' && <Text dimColor>{'  ' + who}</Text>}
                    {due !== '' && <Text color={dueColor} dimColor={dueColor === undefined}>{'  ' + due}</Text>}
                  </Box>
                )
              })}
            </Box>
          )
        })}
      </Box>
    )
  })
}
