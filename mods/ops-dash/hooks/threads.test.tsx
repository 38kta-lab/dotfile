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
