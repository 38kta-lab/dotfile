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

const PEER = { LIFE_ROLE: 'peer', LIFE_PJ: '03_C', LIFE_NAME: 'claude-03' }
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
  let r: any = store.get('ops-dash:session:claude-03')
  expect(r.busy).toBe(true)
  expect(r.pj).toBe('03_C')
  await $.turn.complete(complete as any)
  await $.session.measure(measure(52, 34) as any)
  r = store.get('ops-dash:session:claude-03')
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
  const r: any = store.get('ops-dash:session:claude-03')
  expect(r.lastReportAt).toBeGreaterThan(0)
})

test('ops records whom it sent what, by name without the ref', async ($, on) => {
  const store = world(on, OPS)
  await $.session.start(START as any)
  await $.session.send({ to: 'claude-07 [b43449]', text: '\n07_G の note を note.md に改名し…\n詳細' } as any)
  const d: any = store.get('ops-dash:dispatch:claude-07')
  expect(d.line).toBe('07_G の note を note.md に改名し…')
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
  const r: any = store.get('ops-dash:session:claude-03')
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

const EVENTS = [
  { title: '[07_G] note と hub の整理 [status:focus]', start: '2026-10-08T14:30:00+09:00', end: '2026-10-08T16:30:00+09:00', calendar_id: 'c_tb' },
  { title: '来客の打ち合わせ', start: '2026-10-13T10:00:00+09:00', end: '2026-10-13T12:00:00+09:00', calendar_id: 'me@example.com' },
  { title: '共同実験', start: '2026-10-14', end: '2026-10-17', calendar_id: 'me@example.com' },
]
const MANY = Array.from({ length: 12 }, (_, i) => ({
  title: `[X${i}] block`, start: `2026-10-${String(8 + (i % 7)).padStart(2, '0')}T${String(8 + i).padStart(2, '0')}:00:00+09:00`,
  end: `2026-10-${String(8 + (i % 7)).padStart(2, '0')}T${String(9 + i).padStart(2, '0')}:00:00+09:00`, calendar_id: 'c_tb',
}))
const TASKS_MD = '# tasks\n\n## 今日 2026-10-08\n\n- ⬜ [M20] 現状確認＋実作業 — @user — 10/07（実働締切 10/28）\n- ✅ [07_G] note 整形 — @claude-07 — 10/08\n\n## 待ち\n\n- ⬜ [03_C] 共同研究者への連絡 6 件 — @user — 10/04\n'

test('the calendar block has the same height with no events and with many', OPTIONS as any, async ($, on) => {
  const events: unknown[] = []
  world(on, OPS, new Map(), false, events, TASKS_MD)
  await $.session.start(START as any)
  await settle()
  const span = (xs: string[]) => xs.findIndex(x => x.startsWith('─ tasks')) - xs.findIndex(x => x.startsWith('─ calendar'))
  const empty = await texts($, 'dock')
  events.push(...MANY, ...EVENTS)
  await $.command.run({ command: 'dash', args: '' } as any).catch(() => undefined)
  await $.session.start(START as any)
  await settle()
  const full = await texts($, 'dock')
  expect(span(empty)).toBeGreaterThan(0)
  expect(span(full)).toBe(span(empty))
})

test('with many events the calendar is still 1 header + 1 all-day + 12 hour rows', OPTIONS as any, async ($, on) => {
  world(on, OPS, new Map(), false, MANY, TASKS_MD)
  await $.session.start(START as any)
  await settle()
  const many = await texts($, 'dock')
  const rowsOf = (xs: string[]) => xs.filter(x => /^\d\d $/.test(x)).length
  expect(rowsOf(many)).toBe(12)
  expect(many.filter(x => x === '終 ').length).toBe(1)
})

test('the week shows today first, the all-day run, the tagged block and the meeting', OPTIONS as any, async ($, on) => {
  world(on, OPS, new Map(), false, EVENTS, TASKS_MD)
  await $.session.start(START as any)
  await settle()
  const all = (await texts($, 'dock')).join('\n')
  expect(all).toContain('8木')
  expect(all).toContain('14水')
  expect(all).toContain('07_G')
  expect(all).toContain('来客の')
  expect(all).toContain('共同実')
  expect(all).toContain('更新 ')
})

test('tasks are listed by section, done lines included, under the calendar', OPTIONS as any, async ($, on) => {
  world(on, OPS, new Map(), false, EVENTS, TASKS_MD)
  await $.session.start(START as any)
  await settle()
  const xs = await texts($, 'dock')
  const t = xs.findIndex(x => x.startsWith('─ tasks'))
  const after = xs.slice(t).join('\n')
  expect(after).toContain('今日 2026-10-08')
  expect(after).toContain('⬜ [M20] 現状確認＋実作業 — @user（実働締切 10/28）')
  expect(after).toContain('✅ [07_G] note 整形 — @claude-07')
  expect(after).toContain('待ち')
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
      expect(all).toContain('─ sessions')
      expect(all).toContain('─ calendar')
      expect(all).toContain('─ tasks')
    }
})
