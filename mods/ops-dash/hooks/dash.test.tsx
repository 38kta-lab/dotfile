import { test, expect } from 'claude-code/testing'

// The world beneath the plugin, answered here: environment, the shared store
// (a Map the test reads directly), the clock, commands, timers, and the
// session and turn events themselves.
function world(on: any, vars: Record<string, string | undefined>, store = new Map<string, unknown>(), refuseCommand = false) {
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

test('the pane shows the plan windows and every session, with bars, ops first', async ($, on) => {
  const store = world(on, OPS)
  store.set('ops-dash:session:claude-07', { name: 'claude-07', role: 'peer', pj: '07_G', busy: true, turnStartedAt: Date.parse('2026-10-08T02:28:00Z'), contextPercent: 71, lastTurnEndAt: Date.parse('2026-10-08T02:00:00Z'), updatedAt: 1 })
  store.set('ops-dash:session:ops', { name: 'ops', role: 'ops', busy: false, contextPercent: 38, updatedAt: 1 })
  store.set('ops-dash:dispatch:claude-07', { at: 1, line: 'note を整形' })
  store.set('ops-dash:limits', { at: 1, windows: [{ kind: 'five_hour', percentUsed: 34, resetsAt: '2026-10-08T07:10:00Z' }, { kind: 'seven_day', percentUsed: 61, resetsAt: '2026-10-09T00:00:00Z' }] })
  await $.session.start(START as any)
  for (const surface of ['terminal', 'desktop'] as const) {
    for (const placement of ['dock', 'inline'] as const) {
      const ui: any = await $.ui.mount({
        plugin: 'ops-dash', surface, component: 'Pane', requestId: 'peers',
        props: { title: 'ops-dash', isFocused: false, bodyColumns: 48, placement, scroll: { bodyRows: 30 }, view: 'expanded' } as any,
      })
      const texts: string[] = (await ui.findAll({ type: 'Text' })).map((t: any) => String(t.text ?? t.props?.children ?? ''))
      const all = texts.join('\n')
      expect(all).toContain('5時間枠')
      expect(all).toContain('週間枠')
      expect(all).toContain('16:10 リセット')
      expect(all).toContain('明日 09:00 リセット')
      expect(all).toContain(' 34%')
      expect(all).toContain('█')
      expect(all).toContain('claude-07')
      expect(all).toContain(' 71%')
      expect(all).toContain('作業中 2分')
      expect(all).toContain('依頼')
      expect(all.indexOf('ops')).toBeLessThan(all.indexOf('claude-07'))
      await ui.unmount()
    }
  }
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

test('every line fits the sidebar width, counting Japanese as two cells', async ($, on) => {
  const store = world(on, OPS)
  store.set('ops-dash:session:claude-03', { name: 'claude-03', role: 'peer', pj: '03_C', busy: false, contextPercent: 77, lastTurnEndAt: 1, lastReportAt: 1, updatedAt: 1 })
  store.set('ops-dash:dispatch:claude-03', { at: 1, line: '03_C の note を note.md に改名し、解析番号ごとの見出しを目次が機械的に作れる型に揃える' })
  await $.session.start(START as any)
  const ui: any = await $.ui.mount({
    plugin: 'ops-dash', surface: 'terminal', component: 'Pane', requestId: 'peers',
    props: { title: 'ops-dash', isFocused: false, bodyColumns: 44, placement: 'dock', scroll: { bodyRows: 20 }, view: 'expanded' } as any,
  })
  const texts: string[] = (await ui.findAll({ type: 'Text' })).map((t: any) => String(t.text ?? t.props?.children ?? ''))
  const meta = texts.find(t => t.startsWith('  ターン'))!
  let w = 0
  for (const ch of meta) w += /[\u2e80-\ua4cf\uff00-\uff60]/.test(ch) ? 2 : 1
  expect(w).toBeLessThanOrEqual(44)
  expect(meta.endsWith('…')).toBe(true)
})
