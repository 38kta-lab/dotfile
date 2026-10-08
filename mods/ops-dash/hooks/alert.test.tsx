import { test, expect } from 'claude-code/testing'
import { calendarArgv, calendarTitle, detailPrompt, doneArgv, mailLine, newIds, parseFeed, parseWhen, splitMail } from './alert'
import type { MailItem } from './alert'

// Made-up mail only: this file is in a public repo.
const m = (id: string, x: Partial<MailItem> = {}): MailItem => ({
  id, from: `Sender ${id} <s${id}@example.org>`, from_name: `Sender ${id}`, subject: `Subject ${id}`,
  date: '2026-10-08T14:32:00+09:00', labels: ['INBOX'], unread: true, bulk: false, ...x,
})

test('parseFeed reads items and errors, and says so when the output is not JSON', () => {
  expect(parseFeed(JSON.stringify({ fetched_at: 't', items: [m('1')] })).items.length).toBe(1)
  expect(parseFeed(JSON.stringify({ fetched_at: 't', error: 'token が切れて', items: [] })).error).toContain('token')
  expect(parseFeed('not json').error).toBeDefined()
})

test('newIds: nothing on the first look, then only the ids not seen', () => {
  expect(newIds(undefined, [m('1')])).toEqual([])
  expect(newIds(new Set(['1']), [m('1'), m('2')])).toEqual(['2'])
})

test('splitMail: personal first, newest first; bulk apart; Done ones gone', () => {
  const items = [m('a', { date: '2026-10-08T09:00:00+09:00' }), m('b', { date: '2026-10-08T10:00:00+09:00' }), m('c', { bulk: true }), m('d')]
  const { personal, bulk } = splitMail(items, new Set(['d']))
  expect(personal.map(x => x.id)).toEqual(['b', 'a'])
  expect(bulk.map(x => x.id)).toEqual(['c'])
})

test('mailLine marks selection, unread and a sensitive class', () => {
  expect(mailLine(m('1'), false)).toMatch(/^☐ ● 10\/08 14:32  Sender 1  Subject 1$/)
  expect(mailLine(m('1', { unread: false, sensitive: '人事' }), true)).toMatch(/^☑   10\/08 14:32  Sender 1  ［人事］Subject 1$/)
})

test('doneArgv adds the Done label to the chosen ids', () => {
  expect(doneArgv('/py', '/repo', ['x1', 'x2'])).toEqual(['/py', '/repo/scripts/gmail_label.py', '--message-id', 'x1', '--message-id', 'x2', '--add-label', '9. Done/Triage'])
})

test('parseWhen: a date and time, a date alone (9:00), and wrong ones', () => {
  expect(parseWhen('2026-10-15 17:00')).toEqual({ start: '2026-10-15T17:00:00', end: '2026-10-15T17:30:00' })
  expect(parseWhen('2026-10-15')).toEqual({ start: '2026-10-15T09:00:00', end: '2026-10-15T09:30:00' })
  expect('error' in parseWhen('10/15')).toBe(true)
  expect('error' in parseWhen('2026-02-30')).toBe(true)
})

test('calendar: the title of sensitive mail names only its class; the argv writes TimeBlock', () => {
  expect(calendarTitle(m('1'))).toBe('〆 Subject 1')
  expect(calendarTitle(m('1', { sensitive: '査読', subject: 'Review of MS-123 by Dr. X' }))).toBe('［査読］締切')
  expect(calendarArgv('/py', '/repo', 'T', { start: 's', end: 'e' })).toEqual(['/py', '/repo/scripts/google_calendar_create.py', '--title', 'T', '--start', 's', '--end', 'e', '--execute'])
})

test('detailPrompt: lists the chosen mail and the ask; refuses when any is sensitive', () => {
  const t = detailPrompt([m('1'), m('2')], '締切を教えて')!
  expect(t).toContain('id 1')
  expect(t).toContain('id 2')
  expect(t).toContain('alert_feed.py --show')
  expect(t).toContain('頼むこと: 締切を教えて')
  expect(detailPrompt([m('1'), m('2', { sensitive: '成績' })], 'x')).toBeUndefined()
  expect(detailPrompt([], 'x')).toBeUndefined()
})

// ---- the pane, with a made-up feed ----

const FEED = { fetched_at: '2026-10-08T05:40:00Z', items: [m('1'), m('2', { sensitive: '人事' }), m('3', { bulk: true })] }

function world(on: any, runs: string[][]) {
  on('process.run', (_$: any, e: any) => {
    runs.push(e.argv)
    const out = String(e.argv[1] ?? '').endsWith('alert_feed.py') ? JSON.stringify(FEED) : '[]'
    return { value: { exitCode: 0, stdout: out, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('fs.read', () => ({ value: '' }))
  on('fs.list', () => ({ value: [] }))
  on('env.get', (_$: any, e: any) => ({ value: e.name === 'LIFE_ROLE' ? 'ops' : undefined }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('store.keys', () => ({ value: [] }))
  on('clock.now', () => ({ value: Date.parse('2026-10-08T05:45:00Z') }))
  on('clock.every', () => ({ value: undefined }))
  on('command.register', (_$: any, e: any) => ({ value: { command: e.name } }))
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
}
const OPTIONS = { options: { python: '/py', life_repo: '/repo' } }
const PROPS = { title: 'alert', isFocused: true, bodyColumns: 84, placement: 'dock', scroll: { bodyRows: 60 }, view: 'expanded' } as any
const settle = () => new Promise(r => setTimeout(r, 30))
const labels = async (ui: any) => (await ui.findAll({ type: 'Button' })).map((b: any) => String(b.props?.label ?? ''))
const texts = async (ui: any) => (await ui.findAll({ type: 'Text' })).map((t: any) => String(t.text ?? t.props?.children ?? '')).join('\n')

test('the pane lists personal mail, folds bulk; selecting shows Done / 詳しく / calendar; Done runs gmail_label.py for the chosen ids', OPTIONS as any, async ($, on) => {
  const runs: string[][] = []
  world(on, runs)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true } as any)
  await settle()
  const ui: any = await $.ui.mount({ plugin: 'ops-dash', surface: 'terminal', component: 'Pane', requestId: 'alert', props: PROPS })
  let ls = await labels(ui)
  expect(ls.some((l: string) => l.includes('Subject 1'))).toBe(true)
  expect(ls.some((l: string) => l.includes('Subject 3'))).toBe(false)
  expect(ls).toContain('▸ 一斉配信 1 件')
  await ui.press({ key: 'mail-1' })
  await settle()
  ls = await labels(ui)
  expect(ls.some((l: string) => l.startsWith('☑') && l.includes('Subject 1'))).toBe(true)
  expect(ls).toContain('Done にする')
  expect(ls).toContain('詳しく（モデルに頼む）')
  expect(ls).toContain('カレンダーに入れる')
  await ui.press({ key: 'mail-done' })
  await settle()
  const done = runs.find(a => String(a[1]).endsWith('gmail_label.py'))
  expect(done).toEqual(['/py', '/repo/scripts/gmail_label.py', '--message-id', '1', '--add-label', '9. Done/Triage'])
  ls = await labels(ui)
  expect(ls.some((l: string) => l.includes('Subject 1'))).toBe(false)
  expect(await texts(ui)).toContain('Done にした: 1 件')
  await ui.unmount()
})

test('a sensitive message selected: no 詳しく, and the reason is shown', OPTIONS as any, async ($, on) => {
  const runs: string[][] = []
  world(on, runs)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true } as any)
  await settle()
  const ui: any = await $.ui.mount({ plugin: 'ops-dash', surface: 'terminal', component: 'Pane', requestId: 'alert', props: PROPS })
  await ui.press({ key: 'mail-2' })
  await settle()
  const ls = await labels(ui)
  expect(ls).toContain('Done にする')
  expect(ls).not.toContain('詳しく（モデルに頼む）')
  expect(ls).toContain('カレンダーに入れる')
  expect(await texts(ui)).toContain('人事などの区分を含むので')
  await ui.unmount()
})

test('詳しく puts a draft with the chosen ids and the ask into the prompt (not sent)', OPTIONS as any, async ($, on) => {
  const runs: string[][] = []
  world(on, runs)
  const fills: string[] = []
  on('prompt.fill', (_$: any, e: any) => { fills.push(e.text); return { isFilled: true } })
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true } as any)
  await settle()
  const ui: any = await $.ui.mount({ plugin: 'ops-dash', surface: 'terminal', component: 'Pane', requestId: 'alert', props: PROPS })
  await ui.press({ key: 'mail-1' })
  await ui.press({ key: 'mail-ask' })
  await settle()
  await ui.input({ key: 'mail-ask-input', text: '締切を教えて' })
  await settle()
  expect(fills.length).toBe(1)
  expect(fills[0]).toContain('id 1')
  expect(fills[0]).toContain('頼むこと: 締切を教えて')
  expect(fills[0]).not.toContain('id 2')
  expect(await texts(ui)).toContain('プロンプトに下書きを入れた')
  await ui.unmount()
})

test('カレンダー: title (a sensitive one names only its class), then the time; runs google_calendar_create.py', OPTIONS as any, async ($, on) => {
  const runs: string[][] = []
  world(on, runs)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true } as any)
  await settle()
  const ui: any = await $.ui.mount({ plugin: 'ops-dash', surface: 'terminal', component: 'Pane', requestId: 'alert', props: PROPS })
  await ui.press({ key: 'mail-2' })
  await ui.press({ key: 'mail-cal' })
  await settle()
  const title: any = await ui.find({ type: 'Input', key: 'mail-cal-title' })
  expect(String(title?.props?.value)).toBe('［人事］締切')
  await ui.input({ key: 'mail-cal-title', text: '［人事］締切' })
  await settle()
  await ui.input({ key: 'mail-cal-when', text: '10/15' })
  await settle()
  expect(await texts(ui)).toContain('日時は 2026-10-15 17:00')
  expect(runs.some(a => String(a[1]).endsWith('google_calendar_create.py'))).toBe(false)
  await ui.input({ key: 'mail-cal-when', text: '2026-10-15 17:00' })
  await settle()
  const cal = runs.find(a => String(a[1]).endsWith('google_calendar_create.py'))
  expect(cal).toEqual(['/py', '/repo/scripts/google_calendar_create.py', '--title', '［人事］締切', '--start', '2026-10-15T17:00:00', '--end', '2026-10-15T17:30:00', '--execute'])
  expect(await texts(ui)).toContain('カレンダーに入れた: 2026-10-15 17:00')
  await ui.unmount()
})
