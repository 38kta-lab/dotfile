import { test, expect } from 'claude-code/testing'

// note_toc.py --check as it really answers (captured from the real script):
// up to date / contents stale / a heading missing its three lines.
const FRESH = { exitCode: 0, stderr: '' }
const STALE = { exitCode: 1, stderr: '' }
const BROKEN = { exitCode: 1, stderr: 'note_toc: 7509: JOB_0043 に 問い/結論/状態 の行が無い\n' }

const OPTIONS = { options: { python: 'python3', life_repo: '/home/u/life' } }
const NOTE = '/data/x/projA/note/note.md'

function world(on: any, answer: { exitCode: number; stderr: string }, ran: string[][], failing = false) {
  on('process.run', (_$: any, e: any) => {
    ran.push([...e.argv])
    return { value: { exitCode: answer.exitCode, stdout: '', stderr: answer.stderr, isStdoutTruncated: false, isStderrTruncated: false } }
  })
  for (const tool of ['Edit', 'Write']) {
    on('tool.call', { tool }, (_$: any, e: any) =>
      failing ? { result: 'File has been modified since read', isError: true } : { result: { filePath: e.file_path } })
  }
}

const edit = { tool: 'Edit', file_path: NOTE, old_string: 'a', new_string: 'b' } as any

test('a fresh note says nothing', OPTIONS as any, async ($, on) => {
  const ran: string[][] = []
  world(on, FRESH, ran)
  const r = await $.tool.call(edit)
  expect(ran.length).toBe(1)
  expect(ran[0]).toEqual(['python3', '/home/u/life/scripts/note_toc.py', NOTE, '--check'])
  expect(r.context ?? []).toEqual([])
})

test('stale contents: tells the model to rebuild them with the exact command', OPTIONS as any, async ($, on) => {
  world(on, STALE, [])
  const r = await $.tool.call(edit)
  const c = (r.context ?? []).join(' ')
  expect(c).toContain('目次が古くなっています')
  expect(c).toContain(`python3 /home/u/life/scripts/note_toc.py ${NOTE} --write`)
  expect(c).toContain('手で書かない')
})

test('a broken heading: names the place and the shape', OPTIONS as any, async ($, on) => {
  world(on, BROKEN, [])
  const r = await $.tool.call({ tool: 'Write', file_path: NOTE, content: 'x' } as any)
  const c = (r.context ?? []).join(' ')
  expect(c).toContain('7509: JOB_0043 に 問い/結論/状態 の行が無い')
  expect(c).toContain('- 問い: / - 結論: / - 状態:')
})

test('other files are not checked', OPTIONS as any, async ($, on) => {
  const ran: string[][] = []
  world(on, STALE, ran)
  await $.tool.call({ ...edit, file_path: '/data/x/projA/note/progress.md' })
  await $.tool.call({ ...edit, file_path: '/data/x/projA/README.md' })
  expect(ran).toEqual([])
})

test('a failed edit is not checked', OPTIONS as any, async ($, on) => {
  const ran: string[][] = []
  world(on, STALE, ran, true)
  const r = await $.tool.call(edit)
  expect(ran).toEqual([])
  expect(r.context ?? []).toEqual([])
})

test('without life_repo the check does not run, and says so', async ($, on) => {
  const ran: string[][] = []
  world(on, STALE, ran)
  const r = await $.tool.call(edit)
  expect(ran).toEqual([])
  expect((r.context ?? []).join(' ')).toContain('life_repo が未設定')
})
