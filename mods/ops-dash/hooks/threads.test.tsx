import { test, expect } from 'claude-code/testing'
import { label, readBefore, nextNumber, numbered, parsePeer, parseRows, peerOf, replyPrompt, rowsText, shortName, splitAnswer, threadOrder, unread, wrapCells } from './threads'

// Made-up peers and text only: this file is in a public repo.

const frame = (name: string, body: string, pid = '4242') =>
  `<cross-session-message from="uds:/tmp/cc-socks/${pid}.sock" from-name="${name}" from-mode="prompting">\n${body}\n</cross-session-message>`

const HOME = '/home/u'
const DIR = `${HOME}/.local/share/life/threads`

function world(on: any, vars: Record<string, string | undefined>, files = new Map<string, string>(), opts: { failWrite?: boolean } = {}) {
  const got: any[] = []
  const opened: any[] = []
  const sent: any[] = []
  const submitted: any[] = []
  on('env.get', (_$: any, e: any) => ({ value: vars[e.name] }))
  on('fs.read', (_$: any, e: any) => {
    if (!files.has(e.path)) throw new Error('ENOENT')
    return { value: files.get(e.path) }
  })
  on('fs.write', (_$: any, e: any) => {
    if (opts.failWrite) throw new Error('EACCES')
    files.set(e.path, e.text)
    return { value: undefined }
  })
  on('fs.list', (_$: any, e: any) => ({ value: [...files.keys()].filter(k => k.startsWith(e.path + '/')).map(k => ({ name: k.slice(e.path.length + 1), kind: 'file', size: files.get(k)!.length, mtimeMs: 1, isLink: false })) }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('store.keys', () => ({ value: [] }))
  on('clock.now', () => ({ value: Date.parse('2026-10-08T05:30:00Z') }))
  on('clock.every', () => ({ value: undefined }))
  on('command.register', (_$: any, e: any) => ({ value: { command: e.name } }))
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  on('session.receive', (_$: any, e: any) => { got.push(e); return { text: e.text } })
  on('session.send', (_$: any, e: any) => { sent.push(e); return { isDelivered: true } })
  on('prompt.submit', (_$: any, e: any) => { submitted.push(e); return { text: e.text } })
  on('turn.start', (_$: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.open', (_$: any, e: any) => { opened.push(e); return { value: { isPlaced: true } } })
  on('ui.panes', () => ({ value: [] }))
  return { files, got, opened, sent, submitted }
}

const OPS = { LIFE_ROLE: 'ops', HOME }
const PEER = { LIFE_ROLE: 'peer', LIFE_NAME: 'claude-worker-b', HOME }
const START = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as any
const receive = ($: any, text: string) => $.session.receive({ origin: { kind: 'peer' }, text })

test('parsePeer reads the sender and the body of the frame a peer reply comes in', () => {
  const p = parsePeer(frame('claude-worker-b', '一行目\n二行目'))!
  expect(p.name).toBe('claude-worker-b')
  expect(p.sock).toBe('uds:/tmp/cc-socks/4242.sock')
  expect(p.body).toBe('一行目\n二行目')
  expect(parsePeer('ただの文')).toBeUndefined()
  expect(parsePeer('<cross-session-message from="uds:/tmp/cc-socks/9.sock">\nx\n</cross-session-message>')!.name).toBe('9')
})

test('names: the ref is dropped, claude- is dropped from the number', () => {
  expect(peerOf('claude-worker-b [b43449]')).toBe('claude-worker-b')
  expect(shortName('claude-worker-b')).toBe('worker-b')
  expect(shortName('peer-a')).toBe('peer-a')
  expect(label('claude-peer-x', 12)).toBe('peer-x-12')
})

test('numbered puts the number at the head of the body, inside the frame', () => {
  const t = numbered(frame('peer-a', '本文'), 'peer-a-3')
  expect(t).toBe(frame('peer-a', '【peer-a-3】本文'))
})

test('positive control: a reply in the real frame adds one row to its thread, and ops reads it whole with its number', async ($, on) => {
  const { files, got } = world(on, OPS)
  await $.session.start(START)
  const r: any = await receive($, frame('claude-worker-b', '済みました。\n詳しくは note に'))
  const rows = parseRows(files.get(`${DIR}/claude-worker-b.jsonl`) ?? '')
  expect(rows.length).toBe(1)
  expect(rows[0]).toMatchObject({ dir: 'in', n: 1, read: false, text: '済みました。\n詳しくは note に' })
  expect(got.length).toBe(1)
  expect(got[0].text).toBe(frame('claude-worker-b', '【worker-b-1】済みました。\n詳しくは note に'))
  expect(r.consumed).toBeUndefined()
  expect(r.text).toContain('詳しくは note に')
})

test('numbers run on per peer and are not shared between peers', async ($, on) => {
  const { files } = world(on, OPS)
  await $.session.start(START)
  await receive($, frame('peer-a', 'one'))
  await receive($, frame('peer-a', 'two'))
  const last: any = await receive($, frame('peer-c', 'other', '77'))
  expect(parseRows(files.get(`${DIR}/peer-a.jsonl`)!).map(r => r.n)).toEqual([1, 2])
  expect(parseRows(files.get(`${DIR}/peer-c.jsonl`)!).map(r => r.n)).toEqual([1])
  expect(last.text).toContain('【peer-c-1】other')
})

test('two replies landing at once still take two numbers', async ($, on) => {
  const { files } = world(on, OPS)
  await $.session.start(START)
  await Promise.all([receive($, frame('peer-a', 'x')), receive($, frame('peer-a', 'y'))])
  expect(parseRows(files.get(`${DIR}/peer-a.jsonl`)!).map(r => r.n).sort()).toEqual([1, 2])
})

test('a session other than ops writes nothing and passes the reply as it came', async ($, on) => {
  const { files, got } = world(on, PEER)
  await $.session.start(START)
  await receive($, frame('ops', 'お願いします'))
  expect([...files.keys()]).toEqual([])
  expect(got[0].text).toBe(frame('ops', 'お願いします'))
})

test('a failed record never takes the reply: it goes on unnumbered', async ($, on) => {
  const { got } = world(on, OPS, new Map(), { failWrite: true })
  await $.session.start(START)
  const r: any = await receive($, frame('peer-a', '本文'))
  expect(got.length).toBe(1)
  expect(got[0].text).toBe(frame('peer-a', '本文'))
  expect(r.consumed).toBeUndefined()
})

test('a delivery that is not a peer frame is left alone', async ($, on) => {
  const { files, got } = world(on, OPS)
  await $.session.start(START)
  await receive($, 'plain words')
  expect([...files.keys()]).toEqual([])
  expect(got[0].text).toBe('plain words')
})

test('LIFE_THREADS_DIR moves the files (trial runs)', async ($, on) => {
  const { files } = world(on, { ...OPS, LIFE_THREADS_DIR: '/tmp/trial/threads' })
  await $.session.start(START)
  await receive($, frame('peer-a', 'x'))
  expect([...files.keys()]).toEqual(['/tmp/trial/threads/peer-a.jsonl'])
})

test('rows: a torn line is skipped; nextNumber and unread count the replies', () => {
  const text = rowsText([{ dir: 'in', at: 1, n: 1, text: 'a', read: true }, { dir: 'out', at: 2, text: 'b' }, { dir: 'in', at: 3, n: 2, text: 'c', read: false }]) + '{"dir":"in",'
  const rows = parseRows(text)
  expect(rows.length).toBe(3)
  expect(nextNumber(rows)).toBe(3)
  expect(unread(rows)).toBe(1)
})

// ---- what ops sent, and what ops made of the replies ----

// the reply's row entering the conversation, as a session appends it before ops answers
const enters = ($: any, name: string, n: number, body = 'x') =>
  $.session.append({ message: { type: 'user', content: [{ type: 'text', text: frame(name, `【${label(name, n)}】${body}`) }] } } as any)
const done = (answer: string, reason = 'answer') => ({ reason, answer, durationMs: 1, isAborted: reason === 'aborted', turnId: 't1' }) as any
const rowsOf = (files: Map<string, string>, name: string) => parseRows(files.get(`${DIR}/${name}.jsonl`) ?? '')

test('ops: a send goes into the peer\'s thread, by name without the ref', async ($, on) => {
  const { files } = world(on, OPS)
  await $.session.start(START)
  await $.session.send({ to: 'claude-worker-b [b43449]', text: '表を直してください' } as any)
  expect(rowsOf(files, 'claude-worker-b')).toMatchObject([{ dir: 'out', text: '表を直してください' }])
})

test('ops: a send to the address a reply came from is filed under that reply\'s name', async ($, on) => {
  const { files } = world(on, OPS)
  await $.session.start(START)
  await receive($, frame('peer-a', '済み', '555'))
  await $.session.send({ to: 'uds:/tmp/cc-socks/555.sock', text: 'ありがとう' } as any)
  expect(rowsOf(files, 'peer-a').map(r => r.dir)).toEqual(['in', 'out'])
})

test('a peer\'s own sends are not threads', async ($, on) => {
  const { files } = world(on, PEER)
  await $.session.start(START)
  await $.session.send({ to: 'ops', text: '報告' } as any)
  expect([...files.keys()]).toEqual([])
})

test('one reply in a turn: the whole answer goes under it', async ($, on) => {
  const { files } = world(on, OPS)
  await $.session.start(START)
  await receive($, frame('peer-a', 'v2 で完成'))
  await enters($, 'peer-a', 1)
  await $.turn.complete(done('要点: v2 で完成。\nおすすめ: このまま進める'))
  const rows = rowsOf(files, 'peer-a')
  expect(rows[1]).toMatchObject({ dir: 'ops', ref: 1, text: '要点: v2 で完成。\nおすすめ: このまま進める' })
  // the next turn reads no reply: nothing more is added
  await $.turn.complete(done('別の話'))
  expect(rowsOf(files, 'peer-a').length).toBe(2)
})

test('several replies in a turn: each gets the part under its heading', async ($, on) => {
  const { files } = world(on, OPS)
  await $.session.start(START)
  await receive($, frame('claude-worker-b', 'x'))
  await receive($, frame('peer-c', 'y'))
  await enters($, 'claude-worker-b', 1)
  await enters($, 'peer-c', 1)
  await $.turn.complete(done('二通届きました。\n\n### 【worker-b-1】\nb はこのまま。\n\n**【peer-c-1】** c は待つ。\n続き'))
  expect(rowsOf(files, 'claude-worker-b')[1].text).toBe('二通届きました。\n\nb はこのまま。')
  expect(rowsOf(files, 'peer-c')[1].text).toBe('二通届きました。\n\nc は待つ。\n続き')
})

test('several replies and no headings: every one gets the whole answer', async ($, on) => {
  const { files } = world(on, OPS)
  await $.session.start(START)
  await receive($, frame('peer-a', 'x'))
  await receive($, frame('peer-c', 'y'))
  await enters($, 'peer-a', 1)
  await enters($, 'peer-c', 1)
  await $.turn.complete(done('まとめて答えます'))
  expect(rowsOf(files, 'peer-a')[1].text).toBe('まとめて答えます')
  expect(rowsOf(files, 'peer-c')[1].text).toBe('まとめて答えます')
})

test('a turn that ends without an answer keeps the replies for the next answer', async ($, on) => {
  const { files } = world(on, OPS)
  await $.session.start(START)
  await receive($, frame('peer-a', 'x'))
  await enters($, 'peer-a', 1)
  await $.turn.complete(done('', 'aborted'))
  expect(rowsOf(files, 'peer-a').length).toBe(1)
  await $.turn.complete(done('読みました'))
  expect(rowsOf(files, 'peer-a')[1]).toMatchObject({ dir: 'ops', ref: 1, text: '読みました' })
})

test('splitAnswer: a heading only counts at the head of a line; a missing one gets the whole', () => {
  const parts = splitAnswer('【a-1】 一つ目。a-2 のことは 【a-2】 として後で\n【a-3】：三つ目', ['a-1', 'a-2', 'a-3'])
  expect(parts.get('a-1')).toBe('一つ目。a-2 のことは 【a-2】 として後で')
  expect(parts.get('a-3')).toBe('三つ目')
  expect(parts.get('a-2')).toBe('【a-1】 一つ目。a-2 のことは 【a-2】 として後で\n【a-3】：三つ目')
  expect(splitAnswer(' 全部 ', ['a-1']).get('a-1')).toBe('全部')
})

// ---- the tab ----

const PROPS = { title: 'threads', isFocused: true, bodyColumns: 84, placement: 'dock', scroll: { bodyRows: 60 }, view: 'expanded' } as any
const labels = async (ui: any) => (await ui.findAll({ type: 'Button' })).map((b: any) => String(b.props?.label ?? ''))
const texts = async (ui: any) => (await ui.findAll({ type: 'Text' })).map((t: any) => String(t.text ?? t.props?.children ?? '')).join('\n')
const AT = Date.parse('2026-10-08T05:00:00Z')

function seeded(): Map<string, string> {
  const files = new Map<string, string>()
  const long = ['一行目', '二行目', '三行目', '四行目', '五行目', '六行目'].join('\n')
  files.set(`${DIR}/claude-worker-b.jsonl`, rowsText([
    { dir: 'out', at: AT, text: '表を直してください' },
    { dir: 'in', at: AT + 60000, n: 1, text: '直しました', read: true },
    { dir: 'in', at: AT + 120000, n: 2, text: long, read: false },
    { dir: 'ops', at: AT + 180000, ref: 2, text: 'おすすめ: このまま進める' },
  ]))
  files.set(`${DIR}/peer-a.jsonl`, rowsText([{ dir: 'in', at: AT - 86400000, n: 1, text: '昨日の報告', read: false }]))
  return files
}

const mountTab = ($: any) => $.ui.mount({ plugin: 'ops-dash', surface: 'terminal', component: 'Pane', requestId: 'threads', props: PROPS })

test('/threads is registered for ops and opens the tab', async ($, on) => {
  const { opened } = world(on, OPS, seeded())
  await $.session.start(START)
  const r: any = await $.command.run({ command: 'threads', args: '' } as any)
  expect(r.text).toBe('threads opened.')
  expect(opened.some(o => o.id === 'threads' && o.focus === true && o.columns === 84)).toBe(true)
})

test('the tab lists peers newest first with unread counts, and the newest peer\'s thread in order: request, replies, ops under its reply', async ($, on) => {
  world(on, OPS, seeded())
  await $.session.start(START)
  const ui: any = await mountTab($)
  const l = await labels(ui)
  const t = await texts(ui)
  expect(t).toContain('未読 2')
  const peerRows = l.filter((x: string) => x.includes('claude-worker-b') || x.includes('peer-a'))
  // the newest reply's first line, not what ops said under it
  expect(peerRows[0]).toMatch(/^● claude-worker-b .*1 未読 .*14:03 一行目$/)
  expect(peerRows[1]).toMatch(/^  peer-a .*1 未読 .*10\/7/)
  const heads = l.filter((x: string) => /→ ops|worker-b-\d|^\s+ops /.test(x)).map((x: string) => x.trim())
  expect(heads.map((x: string) => x.split(' ').slice(0, 2).join(' '))).toEqual(['→ ops', 'worker-b-1 14:01', 'worker-b-2 14:02', 'ops 14:03'])
  // the long reply is folded to four lines
  expect(t).toContain('四行目')
  expect(t).not.toContain('五行目')
  expect(t).toContain('…あと 2 行（Enter で全文）')
  expect(t).toContain('おすすめ: このまま進める')
  await ui.unmount()
})

test('Enter on a reply shows it whole; j moves to the next peer', async ($, on) => {
  world(on, OPS, seeded())
  await $.session.start(START)
  const ui: any = await mountTab($)
  await $.ui.press({ plugin: 'ops-dash', key: 'thr-in-claude-worker-b-2' })
  expect(await texts(ui)).toContain('六行目')
  await $.ui.press({ plugin: 'ops-dash', key: 'thr-next-peer' })
  const t = await texts(ui)
  expect(t).toContain('昨日の報告')
  expect(t).not.toContain('直しました')
  await ui.unmount()
})

test('a marks the shown peer\'s replies read in its file', async ($, on) => {
  const { files } = world(on, OPS, seeded())
  await $.session.start(START)
  const ui: any = await mountTab($)
  await $.ui.press({ plugin: 'ops-dash', key: 'thr-read' })
  expect(unread(parseRows(files.get(`${DIR}/claude-worker-b.jsonl`)!))).toBe(0)
  expect(unread(parseRows(files.get(`${DIR}/peer-a.jsonl`)!))).toBe(1)
  expect(await texts(ui)).toContain('未読 1')
  await ui.unmount()
})

test('r, then Enter in the field: the reply goes to ops as one prompt naming the reply it answers; nothing goes to the peer', async ($, on) => {
  const { submitted, sent } = world(on, OPS, seeded())
  await $.session.start(START)
  const ui: any = await mountTab($)
  await $.ui.press({ plugin: 'ops-dash', key: 'thr-prev' }) // to the newest reply, then one older
  await $.ui.press({ plugin: 'ops-dash', key: 'thr-prev' })
  await $.ui.press({ plugin: 'ops-dash', key: 'thr-reply-open' })
  expect(await texts(ui)).toContain('worker-b-1 への返事')
  await $.ui.input({ plugin: 'ops-dash', key: 'thr-reply', text: '次は図もお願いします' })
  expect(submitted.length).toBe(1)
  expect(submitted[0].text).toBe('【threads worker-b-1 への返事】次は図もお願いします\n> worker-b-1: 直しました')
  // the person's own words, read bare by ops (not framed as a plugin's message)
  expect(submitted[0].origin).toMatchObject({ kind: 'plugin', asUser: true })
  expect(sent).toEqual([])
  expect(await texts(ui)).toContain('ops に送りました')
  await ui.unmount()
})

test('with no threads yet the tab says where they come from', async ($, on) => {
  world(on, OPS)
  await $.session.start(START)
  const ui: any = await mountTab($)
  expect(await texts(ui)).toContain('まだ返事は届いていません')
  await ui.unmount()
})

test('replyPrompt quotes the first line of the reply; with none chosen it names the peer', () => {
  expect(replyPrompt('claude-worker-b', { dir: 'in', at: 1, n: 3, text: '\n  一行目\n二行目' }, ' はい ')).toBe('【threads worker-b-3 への返事】はい\n> worker-b-3: 一行目')
  expect(replyPrompt('peer-a', undefined, 'はい')).toBe('【threads peer-a への返事】はい')
})

test('threadOrder puts what ops said right under its reply; wrapCells counts wide characters as two', () => {
  const order = threadOrder([
    { dir: 'in', at: 1, n: 1, text: 'a' },
    { dir: 'out', at: 3, text: 'c' },
    { dir: 'ops', at: 4, ref: 1, text: 'o' },
    { dir: 'in', at: 2, n: 2, text: 'b' },
  ])
  expect(order.map(r => r.text)).toEqual(['a', 'o', 'b', 'c'])
  expect(wrapCells('ああああ', 4)).toEqual(['ああ', 'ああ'])
  expect(wrapCells('ab\ncd', 10)).toEqual(['ab', 'cd'])
})

test('a reply that lands while a turn runs, and is read only in the next turn, goes under the next answer', async ($, on) => {
  const { files } = world(on, OPS)
  await $.session.start(START)
  await receive($, frame('peer-a', '数字は 3'))
  // the sending turn ends before the reply reaches the model
  await $.turn.complete(done('送りました。返事はまだです'))
  expect(rowsOf(files, 'peer-a').length).toBe(1)
  // the next turn: the reply's row enters the conversation, then ops answers
  await $.session.append({ message: { type: 'user', content: [{ type: 'text', text: frame('peer-a', '【peer-a-1】数字は 3') }] } } as any)
  await $.turn.complete(done('3 でした'))
  expect(rowsOf(files, 'peer-a')[1]).toMatchObject({ dir: 'ops', ref: 1, text: '3 でした' })
})

test('readBefore: the reply must come before the last answer, and only a user row counts', () => {
  const tag = 'peer-a-1'
  expect(readBefore([{ role: 'user', text: '【peer-a-1】x' }, { role: 'assistant', text: 'y' }], tag)).toBe(true)
  expect(readBefore([{ role: 'assistant', text: 'y' }, { role: 'user', text: '【peer-a-1】x' }], tag)).toBe(false)
  expect(readBefore([{ role: 'assistant', text: '【peer-a-1】 について' }], tag)).toBe(false)
})
