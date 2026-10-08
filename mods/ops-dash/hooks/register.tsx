import type { Register } from 'claude-code'

import { consultText, parseHub, sectionMarkdown, sortHubs, TABS } from './hubs'
import type { Hub } from './hubs'
import { bytesToBase64, frontValue, imageRows, isBase64, pngList, tocRows } from './notes'
import type { TocRow } from './notes'

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
  // A question waiting for the person (a guard's dialog, the model's
  // AskUserQuestion): its first words and since when. Cleared when answered.
  waiting?: string
  waitingSince?: number
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

export type CalEvent = {
  title: string
  start: string
  end: string
  calendarId: string
  location?: string
  description?: string
  meetingUrl?: string
  htmlLink?: string
}

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

export type Task = {
  done: boolean
  tag: string
  title: string // short: the first part up to its first "（" or ":"
  full: string // the whole line after the tag, as written
  owner: string
  who: string // the owner part as written ("@user・@ops")
  created?: string
  note?: string // the parenthetical that ends the line
  deadline?: { month: number; day: number }
}
export type TaskSection = { title: string; tasks: Task[] }

// ---- the next events, and one event's detail ----------------------------

// Timed events not yet over, soonest first; all-day events covering today
// come first. At most `n`.
export function upcoming(events: CalEvent[], now: number, n: number): CalEvent[] {
  const today = dayStart(now)
  const allDay = events.filter(e => isAllDay(e) && allDayCovers(e, today))
  const timed = events
    .filter(e => !isAllDay(e) && Date.parse(e.end) > now)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
  return [...allDay, ...timed].slice(0, n)
}

// "今日 14:30–16:30" / "明日 10:00–12:00" / "10/14(水) 終日"
export function whenLabel(ev: CalEvent, now: number): string {
  const today = dayStart(now)
  const dayOf = (iso: string) => (isAllDay({ ...ev, start: iso }) ? (() => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d).getTime() })() : dayStart(Date.parse(iso)))
  const start = dayOf(ev.start)
  const diff = Math.round((start - today) / 86400000)
  const d = new Date(start)
  const day = diff === 0 ? '今日' : diff === 1 ? '明日' : `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY[d.getDay()]})`
  if (isAllDay(ev)) return `${day} 終日`
  return `${day} ${hhmm(Date.parse(ev.start))}–${hhmm(Date.parse(ev.end))}`
}

// The hub an event belongs to, by the "[PJ]" tag at the start of its title.
// A hub's code is "22_R" in "22_R_sample-genome", "Z90" in "Z90-slides"; a tag
// naming two ("21_Q/22_R") goes to the first.
export function hubOfTag(tag: string, slugs: readonly string[]): string | undefined {
  const first = tag.split('/')[0].trim()
  if (!first || first.startsWith('status:')) return undefined
  return slugs.find(s => s.match(/^(\d{2}_[A-Z]|[A-Z]\d{2})/)?.[1] === first)
}

export function hubOfEvent(ev: CalEvent, slugs: readonly string[]): string | undefined {
  const tag = ev.title.match(/^\[([^\]]+)\]/)?.[1]
  return tag ? hubOfTag(tag, slugs) : undefined
}

// "学会 A の参加登録（ポスターのみ）" → "学会 A の参加登録". Only at "（": a colon
// often leaves just a label ("解析 8"). A cut leaving under 4 characters keeps the whole.
export function shortTaskTitle(title: string): string {
  const m = title.match(/^(.+?)（/)
  return m && cells(m[1].trim()) >= 4 ? m[1].trim() : title
}

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
  const full = parts[0].trim()
  let owner = ''
  let ownerText = ''
  let created: string | undefined
  for (const part of parts.slice(1)) {
    const c = part.trim().match(/^(\d{1,2}\/\d{1,2})/)
    if (c && created === undefined) created = c[1]
    const at = part.match(/@([A-Za-z0-9_\-・@]+)/)
    if (at) {
      ownerText = part.trim()
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
  return { done, tag, title: shortTaskTitle(full), full, owner, who: ownerText, created, note: tail && parts.length > 1 ? tail[1] : undefined, deadline }
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
      [python, `${repo}/scripts/google_calendar_read.py`, '--start', iso(d0), '--end', iso(d7), '--format', 'json', '--details', '--max-results', '200'],
      { cwd: repo, timeoutMs: 60000 },
    )
    if (r.exitCode !== 0) {
      calendarNote = `カレンダー取得に失敗（exit ${r.exitCode}）`
      return
    }
    const list = JSON.parse(r.stdout) as {
      title: string; start: string; end: string; calendar_id: string
      location?: string; description?: string; meeting_url?: string; html_link?: string
    }[]
    calendar = list.map(e => ({
      title: e.title, start: e.start, end: e.end, calendarId: e.calendar_id,
      location: e.location || undefined, description: e.description || undefined,
      meetingUrl: e.meeting_url || undefined, htmlLink: e.html_link || undefined,
    }))
    calendarNote = `更新 ${hhmm(now)}`
  } catch (err) {
    calendarNote = `カレンダー取得に失敗（${String(err).slice(0, 40)}）`
  }
}

// ---- hubs pane: read project hubs, a list then one hub by section ----------

const HUBS = 'hubs'
let hubs: Hub[] = []
let hubsLoadedAt = 0
let hubsNote = ''
let view: { kind: 'list' } | { kind: 'hub'; slug: string; tab: number } = { kind: 'list' }
let back: { slug: string; tab: number }[] = []
let consultNote = ''

// One event's detail, drawn in place of the dash (b goes back). Not a pane of
// its own: a pane opened from a press in another pane never gets the keys.
let detail: CalEvent | undefined
let taskDetail: { task: Task; section: string } | undefined
let copied = ''
const NEXT_EVENTS = 5

async function loadHubs($: any, repo: string): Promise<void> {
  if (!repo) {
    hubsNote = 'hub の場所が未設定（pluginConfigs の life_repo）'
    return
  }
  const dir = `${repo}/projects/active`
  try {
    const now = await $.clock.now()
    const entries = await $.fs.list(dir)
    const files = entries.filter((f: any) => f.kind === 'file' && f.name.endsWith('.md') && f.name !== 'README.md')
    const out: Hub[] = []
    for (const f of files) {
      out.push(parseHub(f.name.replace(/\.md$/, ''), String(await $.fs.read(`${dir}/${f.name}`)), now))
    }
    hubs = sortHubs(out)
    hubsLoadedAt = now
    hubsNote = ''
  } catch (err) {
    hubsNote = `hub を読めない（${String(err).slice(0, 60)}）`
  }
}

function openHub(slug: string, tab = 0): void {
  consultNote = ''
  if (view.kind === 'hub') back.push({ slug: view.slug, tab: view.tab })
  view = { kind: 'hub', slug, tab }
}

function goBack(): void {
  const prev = back.pop()
  view = prev ? { kind: 'hub', slug: prev.slug, tab: prev.tab } : { kind: 'list' }
}

function openTask($: any, task: Task, section: string): void {
  taskDetail = { task, section }
  detail = undefined
  $.ui.invalidate('ui.render')
}

function closeTask($: any): void {
  taskDetail = undefined
  $.ui.invalidate('ui.render')
}

function openEvent($: any, ev: CalEvent): void {
  taskDetail = undefined
  detail = ev
  copied = ''
  $.ui.invalidate('ui.render')
}

function closeEvent($: any): void {
  detail = undefined
  copied = ''
  $.ui.invalidate('ui.render')
}

async function copyText($: any, label: string, text: string, press: any): Promise<void> {
  const r = await $.ui.copy({ text, surface: press?.surface })
  copied = r.isCopied ? `${label}をコピーしました` : `コピーできませんでした（${r.reason ?? '理由不明'}）`
  $.ui.invalidate('ui.render')
}

async function goToHub($: any, slug: string): Promise<void> {
  openHub(slug)
  taskDetail = undefined
  closeEvent($)
  await $.ui.open({ id: HUBS, title: 'hubs', columns: 84, focus: true })
}

// ---- notes pane: a project's note → its contents → a number's pictures ----

const NOTES = 'notes'
type NotePj = { slug: string; title: string; code: string; data: string }
let notePjs: NotePj[] = []
let notesView:
  | { kind: 'list' }
  | { kind: 'toc'; pj: NotePj; rows: TocRow[] }
  | { kind: 'pngs'; pj: NotePj; rows: TocRow[]; row: TocRow; files: string[]; deep?: boolean }
  | { kind: 'image'; pj: NotePj; rows: TocRow[]; row: TocRow; files: string[]; file: string; src?: string; w?: number; h?: number } = { kind: 'list' }
let notesNote = ''
const THUMB = '/tmp/ops-dash-notes-view.png'
const MAX_B64 = 2700000 // Image takes at most 2 MiB of picture

// The list comes from the hubs alone (nas_code and nas_data): nothing is read
// from the NAS until a project is chosen.
async function notesLoad($: any, repo: string): Promise<void> {
  if (hubs.length === 0) await loadHubs($, repo)
  const out: NotePj[] = []
  for (const h of hubs) {
    const code = frontValue(h.text, 'nas_code')
    const data = frontValue(h.text, 'nas_data')
    if (code && data) out.push({ slug: h.slug, title: h.title, code, data })
  }
  notePjs = out
}

// Only the head of note.md, up to the end of its contents (a note can be
// 10,000+ lines on a slow NAS): awk stops reading there.
async function notesOpenToc($: any, pj: NotePj): Promise<void> {
  notesView = { kind: 'toc', pj, rows: [] }
  notesNote = `${pj.code}/note/note.md の目次を読んでいます…`
  $.ui.invalidate('ui.render')
  try {
    const r = await $.process.run(['awk', '{ print } /<!-- TOC:END -->/ { exit }', `${pj.code}/note/note.md`], { timeoutMs: 20000 })
    const rows = tocRows(String(r.stdout ?? ''))
    notesView = { kind: 'toc', pj, rows }
    notesNote = rows.length > 0 ? '' : r.exitCode === 0 ? 'この note には目次がありません（scripts/note_toc.py で作る）' : `note を読めない（exit ${r.exitCode}）`
  } catch (err) {
    notesNote = `note を読めない（${String(err).slice(0, 60)}）`
  }
  $.ui.invalidate('ui.render')
}

// First the quick look: <number>/out/*.png and <number>/*.png, no walking
// down the tree (the NAS is slow to walk). `deep` walks it, on request.
async function notesOpenPngs($: any, pj: NotePj, rows: TocRow[], row: TocRow, deep = false): Promise<void> {
  const dir = `${pj.data}/${row.id}`
  notesView = { kind: 'pngs', pj, rows, row, files: [], deep }
  notesNote = deep ? `${dir} の下の階層も探しています…` : `${dir}/out を見ています…`
  $.ui.invalidate('ui.render')
  try {
    const argv = deep
      ? ['find', dir, '-maxdepth', '6', '-type', 'f', '-iname', '*.png']
      : ['/bin/sh', '-c', 'for f in "$1"/out/*.png "$1"/out/*.PNG "$1"/*.png "$1"/*.PNG; do [ -f "$f" ] && echo "$f"; done; exit 0', 'sh', dir]
    const r = await $.process.run(argv, { timeoutMs: deep ? 60000 : 15000 })
    const files = pngList(String(r.stdout ?? ''), dir)
    notesView = { kind: 'pngs', pj, rows, row, files, deep }
    const where = deep ? '下の階層まで探して' : 'out/ と直下に'
    notesNote = files.length === 0 ? (r.exitCode === 0 ? `${where} png はありません` : `探せなかった（exit ${r.exitCode}）`) : `${where} ${files.length} 件${files.length >= 200 ? '（先頭 200 件）' : ''}`
  } catch (err) {
    notesNote = `探せなかった（${String(err).slice(0, 60)}）`
  }
  $.ui.invalidate('ui.render')
}

async function notesOpenImage($: any, v: { pj: NotePj; rows: TocRow[]; row: TocRow; files: string[] }, file: string): Promise<void> {
  const path = `${v.pj.data}/${v.row.id}/${file}`
  notesView = { ...v, kind: 'image', file }
  notesNote = '読み込んでいます…'
  $.ui.invalidate('ui.render')
  try {
    const dims = await $.process.run(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', path], { timeoutMs: 20000 })
    const w = Number(String(dims.stdout).match(/pixelWidth:\s*(\d+)/)?.[1] ?? 0)
    const h = Number(String(dims.stdout).match(/pixelHeight:\s*(\d+)/)?.[1] ?? 0)
    let src = bytesToBase64(await $.fs.read(path, { as: 'bytes' }))
    if (src.length > MAX_B64) {
      await $.process.run(['sips', '-Z', '1600', path, '--out', THUMB], { timeoutMs: 30000 })
      src = bytesToBase64(await $.fs.read(THUMB, { as: 'bytes' }))
    }
    if (!isBase64(src) || src.length > MAX_B64) {
      notesNote = '画像を読めなかった（大きすぎるか、png でない）'
      notesView = { ...v, kind: 'image', file }
    } else {
      notesView = { ...v, kind: 'image', file, src, w, h }
      notesNote = w && h ? `${w} × ${h} px` : ''
    }
  } catch (err) {
    notesNote = `画像を読めなかった（${String(err).slice(0, 60)}）`
  }
  $.ui.invalidate('ui.render')
}

function notesBack($: any): void {
  const v = notesView
  if (v.kind === 'image') notesView = { kind: 'pngs', pj: v.pj, rows: v.rows, row: v.row, files: v.files, deep: true }
  else if (v.kind === 'pngs') notesView = { kind: 'toc', pj: v.pj, rows: v.rows }
  else notesView = { kind: 'list' }
  notesNote = ''
  $.ui.invalidate('ui.render')
}

export function hubLine(h: Hub, width: number): string {
  const age = h.daysSinceUpdate === undefined ? '—' : h.daysSinceUpdate === 0 ? '今日' : `${h.daysSinceUpdate}日前`
  const ms = h.next ? `★${h.next.date} ${h.next.daysLeft}日` : '—'
  const next = h.openNext > 0 ? `次${h.openNext}` : ''
  const head = `${pad(h.slug.split('_').slice(0, 2).join('_').replace(/-.*/, ''), 6)} ${pad(h.status, 8)} ${pad(age, 7)} ${pad(ms, 13)} ${pad(next, 4)} `
  return clip(head + h.title.replace(/\s*\([^)]*\)\s*$/, ''), width)
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
          await $.command.register({ name: 'notes', description: 'Open the research notes: a project, its note contents by number, the pictures under that number, one picture' })
          await $.command.register({ name: 'hubs', description: 'Open the project hubs: a list, then one hub by section, with links to related hubs' })
          await $.command.register({ name: COMMAND, description: 'Open the ops dashboard: every session with a role (busy or idle, context, last turn, last report, last dispatch) and the plan usage' })
          $.clock.every(30000, () => $.ui.invalidate('ui.render'))
          void fetchCalendar($, python, repo).then(() => $.ui.invalidate('ui.render'))
          // Open both panes at start, without taking the keyboard. Opened unasked,
          // a pane is drawn from 144 columns (110 once the person has opened it);
          // narrower, it waits until the terminal widens or /dash or /hubs is run.
          // hubs first so that dash is the tab in front.
          void loadHubs($, repo)
            .then(() => $.ui.open({ id: HUBS, title: 'hubs', columns: 84 }))
            .then(() => $.ui.open({ id: PANE, title: 'ops-dash', columns: 58 }))
            .catch((err: unknown) => $.ui.log(`ops-dash: could not open the panes at start: ${String(err)}`, { to: 'debug' }))
          $.clock.every(600000, () => fetchCalendar($, python, repo).then(() => $.ui.invalidate('ui.render')))
        } catch (err) {
          $.ui.log(`ops-dash: could not register /${COMMAND}: ${String(err)}`)
        }
      }
    }
    return next(e)
  })

  // Every question put to the person in this session passes here as a
  // tool.call of AskUserQuestion, a guard's $.ui.ask included. While it is
  // open the session is waiting for the person, not working.
  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    const me = await who($)
    if (!me) return next(e)
    const q = String(e.questions?.[0]?.question ?? '').replace(/\s+/g, ' ').trim()
    await write($, me, { waiting: q.slice(0, 120) || '確認', waitingSince: await $.clock.now() })
    try {
      return await next(e)
    } finally {
      await write($, me, { waiting: undefined, waitingSince: undefined })
    }
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

  on('command.run', { command: 'notes' }, async $ => {
    notesView = { kind: 'list' }
    notesNote = ''
    void notesLoad($, repo).then(() => $.ui.invalidate('ui.render'))
    const opened = await $.ui.open({ id: NOTES, title: 'notes', columns: 84, focus: true })
    if (opened.isPlaced) return { text: 'notes opened.' }
    return { text: `notes: the pane is waiting and not drawn yet (${opened.reason ?? 'no reason given'}).` }
  })

  on('ui.render', { component: 'Pane', requestId: NOTES }, async ($, e) => {
    const { Box, Text, Button, Image } = $.ui.resolve(e)
    const width = Math.max(40, e.props.bodyColumns ?? 84)
    const v = notesView
    const back = <Button key="back" label="← 戻る" hotkey="b" plain onPress={() => notesBack($)} />
    const note = notesNote !== '' ? <Text dimColor>{notesNote}</Text> : null

    if (v.kind === 'list') {
      return (
        <Box flexDirection="column">
          <Text bold>notes</Text>
          <Text dimColor>hub に nas_code / nas_data がある PJ（目次は選んでから読む）</Text>
          {notePjs.length === 0 && <Text dimColor>見つかりません</Text>}
          {notePjs.map(pj => (
            <Button key={`pj-${pj.slug}`} label={clip(`${pj.slug.split('_').slice(0, 2).join('_')}  ${pj.title}`, width - 2)} plain onPress={() => notesOpenToc($, pj)} />
          ))}
          {note}
        </Box>
      )
    }

    if (v.kind === 'toc') {
      return (
        <Box flexDirection="column">
          <Box flexDirection="row" columnGap={2}>{back}<Text bold>{clip(`${v.pj.slug}  目次 ${v.rows.length} 件`, width - 12)}</Text></Box>
          {note}
          <Box flexDirection="column" marginTop={1}>
            {v.rows.map(r => (
              <Button key={`toc-${r.id}`} label={clip(`${r.id.replace(/^KM_/, '')}  ${r.date === '日付未記載' ? '     ' : r.date.slice(5).replace('-', '/')}  ${r.title}`, width - 2)} plain onPress={() => notesOpenPngs($, v.pj, v.rows, r)} />
            ))}
          </Box>
        </Box>
      )
    }

    if (v.kind === 'pngs') {
      return (
        <Box flexDirection="column">
          <Box flexDirection="row" columnGap={2}>{back}<Text bold>{clip(`${v.row.id}  ${v.row.title}`, width - 12)}</Text></Box>
          <Text dimColor wrap="wrap">{`結論: ${v.row.conclusion}  ／  状態: ${v.row.state}`}</Text>
          {note}
          {!v.deep && <Button key="deep" label="下の階層も探す（遅い）" hotkey="d" plain onPress={() => notesOpenPngs($, v.pj, v.rows, v.row, true)} />}
          <Box flexDirection="column" marginTop={1}>
            {v.files.map(f => (
              <Button key={`png-${f}`} label={clip(f, width - 2)} plain onPress={() => notesOpenImage($, v, f)} />
            ))}
          </Box>
        </Box>
      )
    }

    const cols = Math.min(255, Math.max(20, width - 2))
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={2}>{back}<Text bold>{clip(`${v.row.id}  ${v.file}`, width - 12)}</Text></Box>
        {note}
        {v.src && <Image key="note-image" source={{ png: v.src }} columns={cols} rows={imageRows(v.w ?? 0, v.h ?? 0, cols)} alt="（この端末では画像を描けない。CLAUDE_CODE_FORCE_TERMINAL_IMAGES=1 で起動する）" />}
      </Box>
    )
  })

  on('command.run', { command: 'hubs' }, async $ => {
    await loadHubs($, repo)
    view = { kind: 'list' }
    back = []
    const opened = await $.ui.open({ id: HUBS, title: 'hubs', columns: 84, focus: true })
    if (opened.isPlaced) return { text: 'hubs opened.' }
    return { text: `hubs: the pane is waiting and not drawn yet (${opened.reason ?? 'no reason given'}).` }
  })

  on('ui.render', { component: 'Pane', requestId: HUBS }, async ($, e) => {
    const { Box, Text, Button, Markdown } = $.ui.resolve(e)
    const width = Math.max(40, e.props.bodyColumns ?? 84)
    const redraw = () => $.ui.invalidate('ui.render')
    const reload = async () => {
      await loadHubs($, repo)
      redraw()
    }

    if (view.kind === 'list') {
      return (
        <Box flexDirection="column">
          <Box flexDirection="row" columnGap={2}>
            <Text bold>{`hubs  ${hubs.length} 件`}</Text>
            <Button key="reload" label="更新" hotkey="r" plain onPress={reload} />
          </Box>
          {hubsNote !== '' && <Text dimColor>{hubsNote}</Text>}
          <Text dimColor>{clip('slug   status   更新    次の Milestone 次の手順', width)}</Text>
          {hubs.map(one => (
            <Button key={`hub-${one.slug}`} label={hubLine(one, width - 2)} plain onPress={() => { openHub(one.slug); redraw() }} />
          ))}
        </Box>
      )
    }

    const hub = hubs.find(x => x.slug === view.slug)
    if (!hub) {
      view = { kind: 'list' }
      return <Text dimColor>その hub が見つかりません。</Text>
    }
    const current = view.tab
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={2}>
          <Button key="back" label={back.length > 0 ? '← 戻る' : '← 一覧'} hotkey="b" plain onPress={() => { goBack(); redraw() }} />
          <Text bold>{clip(`${hub.slug}  ${hub.title}`, width - 24)}</Text>
          <Button key="reload" label="更新" hotkey="r" plain onPress={reload} />
          <Button key="consult" label="次の一手を相談" hotkey="n" plain onPress={async () => {
            const r = await $.prompt.fill({ text: consultText(hub, `${repo}/projects/active/${hub.slug}.md`) })
            consultNote = r.isFilled ? 'プロンプトに下書きを入れた（直して送る）' : `プロンプトに入れられなかった（${r.reason ?? '理由不明'}）`
            redraw()
          }} />
        </Box>
        {consultNote !== '' && <Text color="green">{consultNote}</Text>}
        <Text dimColor>{clip(`${hub.status} · 更新 ${hub.updated}${hub.next ? ` · ★${hub.next.date} ${hub.next.label} まで ${hub.next.daysLeft}日` : ''}`, width)}</Text>
        <Box flexDirection="row" columnGap={2} marginTop={1}>
          {TABS.map((t, i) => (
            <Button key={`tab-${t.key}`} label={t.label} hotkey={t.key} plain dimColor={i !== current} onPress={() => { view = { kind: 'hub', slug: hub.slug, tab: i }; redraw() }} />
          ))}
        </Box>
        {hub.related.length > 0 && (
          <Box flexDirection="row" columnGap={2}>
            <Text dimColor>関連</Text>
            {hub.related.map(r => {
              const target = hubs.find(x => x.slug === r)
              return target
                ? <Button key={`rel-${r}`} label={`${r.split('_').slice(0, 2).join('_').replace(/-.*/, '')} ↗`} plain onPress={() => { openHub(r); redraw() }} />
                : <Text dimColor>{r}</Text>
            })}
          </Box>
        )}
        <Box marginTop={1}>
          <Markdown key="body" text={sectionMarkdown(hub, current)} />
        </Box>
      </Box>
    )
  })

  on('command.run', { command: COMMAND }, async $ => {
    const opened = await $.ui.open({ id: PANE, title: 'ops-dash', columns: 58, focus: true })
    if (opened.isPlaced) return { text: 'ops-dash opened.' }
    return { text: `ops-dash: the pane is waiting and not drawn yet (${opened.reason ?? 'no reason given'}).` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const { records, limits } = await readAll($)
    const now = await $.clock.now()
    const width = Math.max(40, e.props.bodyColumns ?? 58)

    if (taskDetail) {
      const { task: t, section } = taskDetail
      if (hubs.length === 0) await loadHubs($, repo)
      const hubSlug = hubOfTag(t.tag, hubs.map(x => x.slug))
      const left = t.deadline ? daysLeft(now, t.deadline) : undefined
      const leftLabel = left === undefined ? '' : left < 0 ? `（${-left} 日過ぎ）` : left === 0 ? '（今日）' : `（あと ${left} 日）`
      const dueColor = t.done || left === undefined ? undefined : left < 0 ? 'red' : left <= 3 ? 'yellow' : undefined
      const row = (label: string, value: string, color?: string) => (
        <Box flexDirection="row">
          <Text dimColor>{pad(label, 6)}</Text>
          <Text color={color} wrap="wrap">{value}</Text>
        </Box>
      )
      return (
        <Box flexDirection="column">
          <Box flexDirection="row" columnGap={2}>
            <Button key="back" label="← タスクの一覧" hotkey="b" plain onPress={() => closeTask($)} />
          </Box>
          <Box flexDirection="row" marginTop={1}>
            <Text>{t.done ? '✅ ' : '⬜ '}</Text>
            <Text color={tagColor(t.tag)}>{t.tag ? `${t.tag}  ` : ''}</Text>
            <Text dimColor>{section}</Text>
          </Box>
          <Box marginTop={1}><Text bold wrap="wrap">{t.full}</Text></Box>
          <Box flexDirection="column" marginTop={1}>
            {row('担当', t.who || '—')}
            {t.created && row('起票', t.created)}
            {row('締切', t.deadline ? `${t.deadline.month}/${t.deadline.day}${leftLabel}` : '—', dueColor)}
            {t.note && !t.deadline && row('補足', t.note)}
            {t.note && t.deadline && t.note !== `${t.deadline.month}/${t.deadline.day}` && row('補足', t.note)}
          </Box>
          {hubSlug && (
            <Box flexDirection="row" marginTop={1}>
              <Button key="hub" label={`${hubSlug.split('_').slice(0, 2).join('_').replace(/-.*/, '')} の hub ↗`} hotkey="h" plain onPress={() => goToHub($, hubSlug)} />
            </Box>
          )}
        </Box>
      )
    }

    if (detail) {
      const ev = detail
      if (hubs.length === 0) await loadHubs($, repo)
      const hubSlug = hubOfEvent(ev, hubs.map(x => x.slug))
      const desc = (ev.description ?? '').split('\n').map(l => l.trimEnd())
      const DESC_LINES = 12
      return (
        <Box flexDirection="column">
          <Box flexDirection="row" columnGap={2}>
            <Button key="back" label="← 予定の一覧" hotkey="b" plain onPress={() => closeEvent($)} />
          </Box>
          <Box marginTop={1}><Text bold wrap="wrap">{ev.title}</Text></Box>
          <Text>{whenLabel(ev, now)}</Text>
          {ev.location && <Text wrap="wrap">{`場所  ${ev.location}`}</Text>}
          {ev.meetingUrl && <Text color="cyan" wrap="wrap">{ev.meetingUrl}</Text>}
          <Box flexDirection="row" columnGap={2} marginTop={1} flexWrap="wrap">
            {ev.meetingUrl && <Button key="copy-url" label="会議 URL をコピー" hotkey="c" onPress={(press: any) => copyText($, '会議 URL ', ev.meetingUrl!, press)} />}
            {ev.location && <Button key="copy-loc" label="場所をコピー" hotkey="l" plain onPress={(press: any) => copyText($, '場所', ev.location!, press)} />}
            {ev.htmlLink && <Button key="copy-page" label="予定のページをコピー" hotkey="p" plain onPress={(press: any) => copyText($, '予定のページ', ev.htmlLink!, press)} />}
            {hubSlug && <Button key="hub" label={`${hubSlug.split('_').slice(0, 2).join('_').replace(/-.*/, '')} の hub ↗`} hotkey="h" plain onPress={() => goToHub($, hubSlug)} />}
          </Box>
          {copied !== '' && <Text color="green">{copied}</Text>}
          {desc.some(l => l) && (
            <Box flexDirection="column" marginTop={1}>
              {desc.slice(0, DESC_LINES).map(l => <Text dimColor wrap="wrap">{clip(l, width * 3)}</Text>)}
              {desc.length > DESC_LINES && <Text dimColor>{`…ほか ${desc.length - DESC_LINES} 行`}</Text>}
            </Box>
          )}
        </Box>
      )
    }
    const rule = (label: string) => `─ ${label} ` + '─'.repeat(Math.max(0, width - cells(label) - 3))

    // plan usage: two short lines
    const limitLines = limitRows(limits, now)
    const smallBar = Math.max(6, Math.min(14, width - 34))

    // sessions: one line each
    const sorted = [...records].sort((a, b) => (a.role === 'ops' ? -1 : b.role === 'ops' ? 1 : a.name.localeCompare(b.name)))
    const peerBar = Math.max(6, Math.min(12, width - 40))

    // calendar: fixed height, then the next few events as buttons
    const next = upcoming(calendar, now, NEXT_EVENTS)
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
            <Text color={r.waiting ? 'red' : r.busy ? 'yellow' : 'green'}>{r.waiting ? '◆ ' : r.busy ? '● ' : '○ '}</Text>
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
            {r.waiting ? (
              <Text color="red" bold>{`  確認待ち ${elapsed(now, r.waitingSince)}`}</Text>
            ) : (
              <Text color={r.busy ? 'yellow' : undefined} dimColor={!r.busy}>
                {r.busy ? `  作業中 ${elapsed(now, r.turnStartedAt)}` : r.lastTurnEndAt ? `  ${ago(now, r.lastTurnEndAt)}` : '  —'}
              </Text>
            )}
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
        <Box flexDirection="column" marginTop={1}>
          {next.length === 0 && <Text dimColor>この先の予定なし</Text>}
          {next.map((ev, i) => (
            <Button
              key={`ev-${i}-${ev.start}`}
              label={clip(`${pad(whenLabel(ev, now), 18)} ${ev.title.replace(/\[status:[^\]]+\]/g, '').trim()}${ev.meetingUrl ? '  🔗' : ''}`, width - 2)}
              plain
              onPress={() => openEvent($, ev)}
            />
          ))}
          {Array.from({ length: NEXT_EVENTS - Math.max(1, next.length) }, () => <Text> </Text>)}
        </Box>

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
                    <Button key={`task-${section.title}-${t.full}`} label={pad(clip(t.title, titleWidth), titleWidth)} plain dimColor={t.done} onPress={() => openTask($, t, section.title)} />
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
