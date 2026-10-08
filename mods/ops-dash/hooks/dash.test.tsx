import { test, expect } from 'claude-code/testing'

// The world beneath the plugin, answered here: environment, the shared store
// (a Map the test reads directly), the clock, commands, timers, and the
// session and turn events themselves.
function world(on: any, vars: Record<string, string | undefined>, store = new Map<string, unknown>(), refuseCommand = false, events: unknown[] = [], tasksMd = '') {
  on('process.run', () => ({ value: { exitCode: 0, stdout: JSON.stringify(events), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('fs.read', () => ({ value: tasksMd }))
  on('env.get', (_$: any, e: any, next: any) => (e.name in vars ? { value: vars[e.name] } : next(e)))
  on('store.get', (_$: any, e: any) => ({ value: store.get(e.key) }))
  on('store.set', (_$: any, e: any) => { store.set(e.key, e.value); return { value: undefined } })
  on('store.keys', () => ({ value: [...store.keys()] }))
  on('clock.now', () => ({ value: Date.parse('2026-10-08T02:30:00Z') }))
  on('clock.every', () => ({ value: undefined }))
  on('command.register', (_$: any, e: any) => {
    if (refuseCommand) throw new Error(`"/${e.name}" refused: it is a built-in`)
    return { value: { command: e.name } }
  })
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  on('turn.start', (_$: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('session.measure', (_$: any, e: any) => ({ changed: e.changed }))
  on('session.send', () => ({ isDelivered: true }))
  on('ui.status', () => ({ value: undefined }))
  return store
}

const START = { cwd: '/tmp', surface: 'terminal', isInteractive: true }
const complete = { reason: 'answer', answer: '', durationMs: 1, isAborted: false, turnId: 't1' }

const PEER = { LIFE_ROLE: 'peer', LIFE_PJ: '21_Q', LIFE_NAME: 'claude-21' }
const OPS = { LIFE_ROLE: 'ops', LIFE_PJ: undefined, LIFE_NAME: undefined }

const measure = (percent: number, five: number) => ({
  context: { tokens: percent * 10000, window: 1000000, percent },
  rateLimits: [{ kind: 'five_hour', percentUsed: five, resetsAt: '2026-10-08T05:00:00Z' }],
  cost: { usd: 1.5 },
  changed: ['context', 'rateLimits', 'cost'],
})

test('a peer session writes its status: busy during a turn, idle after, with context', async ($, on) => {
  const store = world(on, PEER)
  await $.session.start(START as any)
  await $.turn.start({ text: 'go', turnId: 't1' })
  let r: any = store.get('ops-dash:session:claude-21')
  expect(r.busy).toBe(true)
  expect(r.pj).toBe('21_Q')
  await $.turn.complete(complete as any)
  await $.session.measure(measure(52, 34) as any)
  r = store.get('ops-dash:session:claude-21')
  expect(r.busy).toBe(false)
  expect(r.lastTurnEndAt).toBeGreaterThan(0)
  expect(r.contextPercent).toBe(52)
  expect((store.get('ops-dash:limits') as any).windows[0].percentUsed).toBe(34)
})

test('a session without a role writes nothing', async ($, on) => {
  const store = world(on, { LIFE_ROLE: undefined, LIFE_PJ: undefined, LIFE_NAME: undefined })
  await $.session.start(START as any)
  await $.turn.start({ text: 'go', turnId: 't1' })
  const keys = [...store.keys()].filter((k: string) => k.startsWith('ops-dash:'))
  expect(keys).toEqual([])
})

test('a peer that sends to ops records when it last reported', async ($, on) => {
  const store = world(on, PEER)
  await $.session.start(START as any)
  await $.session.send({ to: 'ops', text: 'done' } as any)
  const r: any = store.get('ops-dash:session:claude-21')
  expect(r.lastReportAt).toBeGreaterThan(0)
})

test('ops records whom it sent what, by name without the ref', async ($, on) => {
  const store = world(on, OPS)
  await $.session.start(START as any)
  await $.session.send({ to: 'claude-22 [b43449]', text: '\n22_R の表を新しい形式に直し…\n詳細' } as any)
  const d: any = store.get('ops-dash:dispatch:claude-22')
  expect(d.line).toBe('22_R の表を新しい形式に直し…')
})

test('a refused command does not stop the session from writing its status', async ($, on) => {
  const store = world(on, OPS, new Map(), true)
  await $.session.start(START as any)
  await $.turn.start({ text: 'go', turnId: 't1' })
  const r: any = store.get('ops-dash:session:ops')
  expect(r.busy).toBe(true)
})

test('a session whose session.start never ran still writes on its first turn', async ($, on) => {
  const store = world(on, PEER)
  await $.turn.start({ text: 'go', turnId: 't1' })
  const r: any = store.get('ops-dash:session:claude-21')
  expect(r.busy).toBe(true)
})


const OPTIONS = { options: { python: '/usr/bin/python3', life_repo: '/home/u/life' } }
const PANE_PROPS = (placement: 'dock' | 'inline', bodyColumns = 58) =>
  ({ title: 'ops-dash', isFocused: false, bodyColumns, placement, scroll: { bodyRows: 40 }, view: 'expanded' }) as any
const settle = () => new Promise(r => setTimeout(r, 20))

async function texts($: any, placement: 'dock' | 'inline', surface: 'terminal' | 'desktop' = 'terminal', cols = 58): Promise<string[]> {
  const ui: any = await $.ui.mount({ plugin: 'ops-dash', surface, component: 'Pane', requestId: 'peers', props: PANE_PROPS(placement, cols) })
  const out = (await ui.findAll({ type: 'Text' })).map((t: any) => String(t.text ?? t.props?.children ?? ''))
  await ui.unmount()
  return out
}

// Rows of the next-events list drawn as buttons (one row each).
async function eventButtons($: any): Promise<number> {
  const ui: any = await $.ui.mount({ plugin: 'ops-dash', surface: 'terminal', component: 'Pane', requestId: 'peers', props: PANE_PROPS('dock') })
  const n = (await ui.findAll({ type: 'Button' })).filter((b: any) => /^(今日|明日|\d+\/\d+\()/.test(String(b.props?.label ?? ''))).length
  await ui.unmount()
  return n
}

const EVENTS = [
  { title: '[22_R] 資料の整理 [status:focus]', start: '2026-10-08T14:30:00+09:00', end: '2026-10-08T16:30:00+09:00', calendar_id: 'c_tb' },
  { title: '来客の打ち合わせ', start: '2026-10-13T10:00:00+09:00', end: '2026-10-13T12:00:00+09:00', calendar_id: 'me@example.com' },
  { title: '共同実験', start: '2026-10-14', end: '2026-10-17', calendar_id: 'me@example.com' },
]
const MANY = Array.from({ length: 12 }, (_, i) => ({
  title: `[X${i}] block`, start: `2026-10-${String(8 + (i % 7)).padStart(2, '0')}T${String(8 + i).padStart(2, '0')}:00:00+09:00`,
  end: `2026-10-${String(8 + (i % 7)).padStart(2, '0')}T${String(9 + i).padStart(2, '0')}:00:00+09:00`, calendar_id: 'c_tb',
}))
const TASKS_MD = '# tasks\n\n- ✅ の行は翌朝に消す（説明文）\n\n## 今日 2026-10-08\n\n- ✅ [22_R] 表の整形 — @claude-22 — 10/08\n- ⬜ [Z90] 現状確認＋実作業 — @user — 10/07（実働締切 10/28）\n- ⬜ [事務] 学会 B 総会 — @user — 10/08（10/09 13:00）\n\n## 今週・近日\n\n- ⬜ [22_R] 学会 A の**参加登録**（ポスターのみ）— @user — 10/08（要旨〆 10/21）\n- ⬜ [21_Q] 解析 8: 対象遺伝子の位置 — @claude-21（未依頼）— 10/07\n- ⬜ [22_R] 資料の整理（14:30–16:30）— @user・@ops — 10/08\n\n## 待ち\n\n- ⬜ [21_Q] 共同研究者への連絡 6 件 — @user — 10/04\n'

test('the calendar block has the same height with no events and with many', OPTIONS as any, async ($, on) => {
  const events: unknown[] = []
  world(on, OPS, new Map(), false, events, TASKS_MD)
  await $.session.start(START as any)
  await settle()
  const span = (xs: string[]) => xs.findIndex(x => x.startsWith('─ tasks')) - xs.findIndex(x => x.startsWith('─ calendar'))
  const empty = await texts($, 'dock')
  const emptyButtons = await eventButtons($)
  events.push(...MANY, ...EVENTS)
  await $.command.run({ command: 'dash', args: '' } as any).catch(() => undefined)
  await $.session.start(START as any)
  await settle()
  const full = await texts($, 'dock')
  const fullButtons = await eventButtons($)
  expect(span(empty)).toBeGreaterThan(0)
  expect(fullButtons).toBeGreaterThan(0)
  expect(span(full) + fullButtons).toBe(span(empty) + emptyButtons)
})

test('with many events the calendar is still 1 header + 1 all-day + 13 hour rows (08–20)', OPTIONS as any, async ($, on) => {
  world(on, OPS, new Map(), false, MANY, TASKS_MD)
  await $.session.start(START as any)
  await settle()
  const many = await texts($, 'dock')
  const rowsOf = (xs: string[]) => xs.filter(x => /^\d\d $/.test(x)).length
  expect(rowsOf(many)).toBe(13)
  expect(many.filter(x => x === '終 ').length).toBe(1)
})

test('the week shows today first, the all-day run, the tagged block and the meeting', OPTIONS as any, async ($, on) => {
  world(on, OPS, new Map(), false, EVENTS, TASKS_MD)
  await $.session.start(START as any)
  await settle()
  const all = (await texts($, 'dock')).join('\n')
  expect(all).toContain('8木')
  expect(all).toContain('14水')
  expect(all).toContain('22_R')
  expect(all).toContain('来客の')
  expect(all).toContain('共同実')
  expect(all).toContain('更新 ')
})

test('tasks: open first then done, tag column, deadline and owner at the right, no preamble', OPTIONS as any, async ($, on) => {
  world(on, OPS, new Map(), false, EVENTS, TASKS_MD)
  await $.session.start(START as any)
  await settle()
  const xs = await texts($, 'dock')
  const after = xs.slice(xs.findIndex(x => x.startsWith('─ tasks')))
  const all = after.join('\n')
  expect(all).not.toContain('説明文')
  expect(all).toContain('今日 2026-10-08')
  expect(all).toContain('残り 2')
  expect(all).toContain('〆10/28')
  expect(all).toContain('〆10/9')
  expect(all).toContain('〆10/21')
  expect(all).toContain('→ 22')
  expect(all).toContain('→ 21 未依頼')
  expect(all).toContain('→ ops')
  expect(all).not.toContain('— @')
  expect(all).not.toContain('**')
  expect(all).not.toContain('@user')
  const ui: any = await $.ui.mount({ plugin: 'ops-dash', surface: 'terminal', component: 'Pane', requestId: 'peers', props: PANE_PROPS('dock') })
  const titles = (await ui.findAll({ type: 'Button' })).map((x: any) => String(x.props?.label ?? '')).filter((l: string) => l.trim() && !/^(今日|明日|\d+\/)/.test(l))
  await ui.unmount()
  expect(titles.findIndex((l: string) => l.includes('現状確認'))).toBeGreaterThan(-1)
  expect(titles.findIndex((l: string) => l.includes('現状確認'))).toBeLessThan(titles.findIndex((l: string) => l.includes('表の整形')))
  expect(after.some(x => x.startsWith('Z90'))).toBe(true)
})

test('without the settings the pane says what is missing instead of failing', async ($, on) => {
  world(on, OPS, new Map(), false, EVENTS, TASKS_MD)
  await $.session.start(START as any)
  await settle()
  const all = (await texts($, 'dock')).join('\n')
  expect(all).toContain('カレンダー未設定')
  expect(all).toContain('タスク未設定')
})

test('on both surfaces and placements the pane draws', OPTIONS as any, async ($, on) => {
  world(on, OPS, new Map(), false, EVENTS, TASKS_MD)
  await $.session.start(START as any)
  await settle()
  for (const surface of ['terminal', 'desktop'] as const)
    for (const placement of ['dock', 'inline'] as const) {
      const all = (await texts($, placement, surface)).join('\n')
      expect(all).toContain('─ system usage')
      expect(all.indexOf('─ system usage')).toBeLessThan(all.indexOf('─ sessions'))
      expect(all).toContain('─ sessions')
      expect(all).toContain('─ calendar')
      expect(all).toContain('─ tasks')
    }
})

// ---- the next events and one event's detail ----

import { upcoming, whenLabel, hubOfEvent } from './register'
import type { CalEvent } from './register'

const NOW = Date.parse('2026-10-08T02:30:00Z') // 11:30 JST
const ev = (title: string, start: string, end: string, extra: Partial<CalEvent> = {}): CalEvent => ({ title, start, end, calendarId: 'c_tb', ...extra })

test('upcoming: all-day today first, then timed events not yet over, soonest first', () => {
  const list = [
    ev('later', '2026-10-09T10:00:00+09:00', '2026-10-09T11:00:00+09:00'),
    ev('over', '2026-10-08T09:00:00+09:00', '2026-10-08T10:00:00+09:00'),
    ev('now', '2026-10-08T11:00:00+09:00', '2026-10-08T12:00:00+09:00'),
    ev('all day', '2026-10-08', '2026-10-09'),
    ev('all day tomorrow', '2026-10-09', '2026-10-10'),
  ]
  expect(upcoming(list, NOW, 5).map(e => e.title)).toEqual(['all day', 'now', 'later'])
  expect(upcoming(list, NOW, 2).map(e => e.title)).toEqual(['all day', 'now'])
})

test('whenLabel: today, tomorrow, a later weekday, all day', () => {
  expect(whenLabel(ev('a', '2026-10-08T14:30:00+09:00', '2026-10-08T16:30:00+09:00'), NOW)).toBe('今日 14:30–16:30')
  expect(whenLabel(ev('b', '2026-10-09T10:00:00+09:00', '2026-10-09T12:00:00+09:00'), NOW)).toBe('明日 10:00–12:00')
  expect(whenLabel(ev('c', '2026-10-14', '2026-10-17'), NOW)).toBe('10/14(水) 終日')
})

test('hubOfEvent: the [PJ] tag finds its hub; a status tag or no tag finds none', () => {
  const slugs = ['22_R_sample-genome', 'Z90-slides', 'X91-ops']
  expect(hubOfEvent(ev('[22_R] 資料の整理 [status:focus]', '', ''), slugs)).toBe('22_R_sample-genome')
  expect(hubOfEvent(ev('[Z90] 作業', '', ''), slugs)).toBe('Z90-slides')
  expect(hubOfEvent(ev('[status:focus] 作業', '', ''), slugs)).toBeUndefined()
  expect(hubOfEvent(ev('来客の打ち合わせ', '', ''), slugs)).toBeUndefined()
  expect(hubOfEvent(ev('[22] 似た番号', '', ''), slugs)).toBeUndefined()
})

const DETAILED = [
  { title: '[22_R] 資料の整理 [status:focus]', start: '2026-10-08T14:30:00+09:00', end: '2026-10-08T16:30:00+09:00', calendar_id: 'c_tb', location: '', description: '', meeting_url: '', html_link: 'https://calendar.example/e1' },
  { title: '来客の打ち合わせ', start: '2026-10-09T10:00:00+09:00', end: '2026-10-09T11:00:00+09:00', calendar_id: 'me@example.com', location: '会議室 1', description: '議題\n- 一つ目\n- 二つ目', meeting_url: 'https://zoom.example/j/123', html_link: 'https://calendar.example/e2' },
]

test('the dash lists the next events under the grid, marking the one with a meeting link', OPTIONS as any, async ($, on) => {
  world(on, OPS, new Map(), false, DETAILED, TASKS_MD)
  await $.session.start(START as any)
  await settle()
  const ui: any = await $.ui.mount({ plugin: 'ops-dash', surface: 'terminal', component: 'Pane', requestId: 'peers', props: PANE_PROPS('dock') })
  const labels = (await ui.findAll({ type: 'Button' })).map((b: any) => String(b.props?.label ?? ''))
  await ui.unmount()
  const evs = labels.filter((l: string) => l.startsWith('今日') || l.startsWith('明日'))
  expect(evs.length).toBe(2)
  expect(evs[0]).toContain('今日 14:30–16:30')
  expect(evs[0]).not.toContain('status:')
  expect(evs[0]).not.toContain('🔗')
  expect(evs[1]).toContain('明日 10:00–11:00')
  expect(evs[1]).toContain('🔗')
})

test('pressing an event shows its detail inside the dash, with copy buttons, and b goes back', OPTIONS as any, async ($, on) => {
  world(on, OPS, new Map(), false, DETAILED, TASKS_MD)
  const opened: any[] = []
  on('ui.open', (_$: any, e: any) => { opened.push(e); return { value: { isPlaced: true } } })
  await $.session.start(START as any)
  await settle()
  const dash: any = await $.ui.mount({ plugin: 'ops-dash', surface: 'terminal', component: 'Pane', requestId: 'peers', props: PANE_PROPS('dock') })
  const target = (await dash.findAll({ type: 'Button' })).find((b: any) => String(b.props?.label ?? '').startsWith('明日'))
  const openedBefore = opened.length
  await dash.press({ key: target.key })
  await settle()
  const texts = (await dash.findAll({ type: 'Text' })).map((t: any) => String(t.text ?? t.props?.children ?? '')).join('\n')
  const buttons = (await dash.findAll({ type: 'Button' })).map((b: any) => String(b.props?.label ?? ''))
  expect(opened.length).toBe(openedBefore)
  expect(texts).toContain('来客の打ち合わせ')
  expect(texts).toContain('明日 10:00–11:00')
  expect(texts).toContain('会議室 1')
  expect(texts).toContain('https://zoom.example/j/123')
  expect(texts).toContain('二つ目')
  expect(texts).not.toContain('─ calendar')
  expect(buttons).toContain('会議 URL をコピー')
  expect(buttons).toContain('場所をコピー')
  expect(buttons).toContain('予定のページをコピー')
  await dash.press({ key: 'back' })
  await settle()
  const after = (await dash.findAll({ type: 'Text' })).map((t: any) => String(t.text ?? t.props?.children ?? '')).join('\n')
  await dash.unmount()
  expect(after).toContain('─ calendar')
  expect(after).not.toContain('会議室 1')
})

// ---- tasks: a short title in the list, the whole line in the detail ----

import { parseTask, shortTaskTitle } from './register'

test('shortTaskTitle cuts at the first （ only, unless that leaves too little', () => {
  expect(shortTaskTitle('学会 A の参加登録（ポスターのみ）')).toBe('学会 A の参加登録')
  expect(shortTaskTitle('解析 8: 対象遺伝子の位置（原稿の穴）')).toBe('解析 8: 対象遺伝子の位置')
  expect(shortTaskTitle('表の整形')).toBe('表の整形')
  expect(shortTaskTitle('a（b）')).toBe('a（b）')
})

test('parseTask keeps the whole line, the owner as written, the day it was raised and the note', () => {
  const t = parseTask(false, '[22_R] 資料の整理（14:30–16:30）— @user・@ops — 10/08（10/21）')
  expect(t.title).toBe('資料の整理')
  expect(t.full).toBe('資料の整理（14:30–16:30）')
  expect(t.who).toBe('@user・@ops')
  expect(t.created).toBe('10/08')
  expect(t.note).toBe('10/21')
  expect(t.deadline).toEqual({ month: 10, day: 21 })
})

test('pressing a task shows its whole line, owner, raised day and deadline; b goes back', OPTIONS as any, async ($, on) => {
  const md = '## 今日 2026-10-08\n\n- ⬜ [22_R] 資料の整理（14:30–16:30、旧い形と新しい形の両方を残す）— @user・@ops — 10/08（10/21）\n'
  world(on, OPS, new Map(), false, [], md)
  await $.session.start(START as any)
  await settle()
  const dash: any = await $.ui.mount({ plugin: 'ops-dash', surface: 'terminal', component: 'Pane', requestId: 'peers', props: PANE_PROPS('dock') })
  const target = (await dash.findAll({ type: 'Button' })).find((b: any) => String(b.props?.label ?? '').startsWith('資料の整理'))
  expect(String(target.props.label)).not.toContain('旧い形')
  await dash.press({ key: target.key })
  await settle()
  const texts = (await dash.findAll({ type: 'Text' })).map((t: any) => String(t.text ?? t.props?.children ?? '')).join('\n')
  expect(texts).toContain('資料の整理（14:30–16:30、旧い形と新しい形の両方を残す）')
  expect(texts).toContain('@user・@ops')
  expect(texts).toContain('10/08')
  expect(texts).toContain('10/21（あと 13 日）')
  expect(texts).toContain('今日 2026-10-08')
  expect(texts).not.toContain('─ tasks')
  await dash.press({ key: 'back' })
  await settle()
  const after = (await dash.findAll({ type: 'Text' })).map((t: any) => String(t.text ?? t.props?.children ?? '')).join('\n')
  await dash.unmount()
  expect(after).toContain('─ tasks')
})
