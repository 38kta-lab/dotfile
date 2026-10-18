import { test, expect } from 'claude-code/testing'
import { label, nextNumber, numbered, parsePeer, parseRows, peerOf, replyPrompt, rowsText, shortName, splitAnswer, threadOrder, unread, wrapCells } from './threads'

// Made-up peers and text only: this file is in a public repo.

const frame = (name: string, body: string, pid = '4242') =>
  `<cross-session-message from="uds:/tmp/cc-socks/${pid}.sock" from-name="${name}" from-mode="prompting">\n${body}\n</cross-session-message>`

const HOME = '/home/u'
const DIR = `${HOME}/.local/share/life/threads`

function world(on: any, vars: Record<string, string | undefined>, files = new Map<string, string>(), opts: { failWrite?: boolean } = {}) {
  const got: any[] = []
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
  on('session.send', () => ({ isDelivered: true }))
  on('turn.start', (_$: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.panes', () => ({ value: [] }))
  return { files, got }
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
  await $.turn.complete(done('二通届きました。\n\n### 【worker-b-1】\nb はこのまま。\n\n**【peer-c-1】** c は待つ。\n続き'))
  expect(rowsOf(files, 'claude-worker-b')[1].text).toBe('二通届きました。\n\nb はこのまま。')
  expect(rowsOf(files, 'peer-c')[1].text).toBe('二通届きました。\n\nc は待つ。\n続き')
})

test('several replies and no headings: every one gets the whole answer', async ($, on) => {
  const { files } = world(on, OPS)
  await $.session.start(START)
  await receive($, frame('peer-a', 'x'))
  await receive($, frame('peer-c', 'y'))
  await $.turn.complete(done('まとめて答えます'))
  expect(rowsOf(files, 'peer-a')[1].text).toBe('まとめて答えます')
  expect(rowsOf(files, 'peer-c')[1].text).toBe('まとめて答えます')
})

test('a turn that ends without an answer keeps the replies for the next answer', async ($, on) => {
  const { files } = world(on, OPS)
  await $.session.start(START)
  await receive($, frame('peer-a', 'x'))
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
