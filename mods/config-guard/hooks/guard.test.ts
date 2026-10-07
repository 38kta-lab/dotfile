import { test, expect } from 'claude-code/testing'

// Fake secrets are assembled at run time so this public file holds no literal
// token for secret scanners to match.
const FAKE_ANTHROPIC = 'sk-' + 'ant-' + 'api03-' + 'x'.repeat(40)
// A database md5 as research notes record it: long hex, not a secret.
const DB_MD5 = '0123456789abcdef0123456789abcdef'

type Asked = { questions: string[] }

// Stands in for the person: answers every guard dialog with `label`, or, with
// `label` undefined, refuses the dialog as a `-p` run does.
function person(on: any, label: string | undefined, asked: Asked) {
  on('tool.call', { tool: 'AskUserQuestion' }, (_$: any, e: any) => {
    const q = e.questions[0].question
    asked.questions.push(q)
    if (label === undefined) return { deny: 'no one to ask' }
    return { result: { questions: e.questions, answers: { [q]: label } } }
  })
}

// Stands in for the tools themselves: each call that gets this far "ran".
function tools(on: any, ran: string[]) {
  on('tool.call', { tool: 'Bash' }, (_$: any, e: any) => { ran.push(e.command); return { result: { stdout: '', stderr: '', interrupted: false } } })
  on('tool.call', { tool: 'Write' }, (_$: any, e: any) => { ran.push(e.file_path); return { result: { type: 'create', filePath: e.file_path, content: e.content, structuredPatch: [], originalFile: null } } })
  on('tool.call', { tool: 'Edit' }, (_$: any, e: any) => { ran.push(e.file_path); return { result: { filePath: e.file_path } } })
}

test('a kofamscan run is not asked about', async ($, on) => {
  const asked: Asked = { questions: [] }, ran: string[] = []
  person(on, 'Deny', asked); tools(on, ran)
  const r = await $.tool.call({
    tool: 'Bash',
    command: 'singularity exec /opt/sif/kofamscan.sif exec_annotation -p /db/kegg/prokaryote.hal -k /db/kegg/ko_list -f detail-tsv -o /work/out.tsv in.faa > run.log 2>&1',
  })
  expect(r.deny).toBeUndefined()
  expect(asked.questions).toEqual([])
  expect(ran.length).toBe(1)
})

test('a note holding a database md5 is not asked about', async ($, on) => {
  const asked: Asked = { questions: [] }, ran: string[] = []
  person(on, 'Deny', asked); tools(on, ran)
  const r = await $.tool.call({ tool: 'Write', file_path: '/repo/note/note1.md', content: `ko_list md5 ${DB_MD5}\n` })
  expect(r.deny).toBeUndefined()
  expect(asked.questions).toEqual([])
})

test('reading CLAUDE.md from the shell is not asked about', async ($, on) => {
  const asked: Asked = { questions: [] }, ran: string[] = []
  person(on, 'Deny', asked); tools(on, ran)
  const r = await $.tool.call({ tool: 'Bash', command: 'grep -n topology CLAUDE.md 2>/dev/null | head' })
  expect(r.deny).toBeUndefined()
  expect(asked.questions).toEqual([])
})

test('sed -i on settings.json is asked, and Deny refuses it', async ($, on) => {
  const asked: Asked = { questions: [] }, ran: string[] = []
  person(on, 'Deny', asked); tools(on, ran)
  const r = await $.tool.call({ tool: 'Bash', command: "sed -i '' 's/a/b/' ~/.claude/settings.json" })
  expect(asked.questions.length).toBe(1)
  expect(r.deny).toBeDefined()
  expect(ran).toEqual([])
})

test('sed -i on settings.json runs when the person allows it', async ($, on) => {
  const asked: Asked = { questions: [] }, ran: string[] = []
  person(on, 'Allow once', asked); tools(on, ran)
  const r = await $.tool.call({ tool: 'Bash', command: "sed -i '' 's/a/b/' ~/.claude/settings.json" })
  expect(asked.questions.length).toBe(1)
  expect(r.deny).toBeUndefined()
  expect(ran.length).toBe(1)
})

test('cd into ~/.claude and then editing settings.json is still asked', async ($, on) => {
  const asked: Asked = { questions: [] }, ran: string[] = []
  person(on, 'Deny', asked); tools(on, ran)
  await $.tool.call({ tool: 'Bash', command: "cd ~/.claude && sed -i '' 's/x/y/' settings.json" })
  expect(asked.questions.length).toBe(1)
})

test('Edit on a CLAUDE.md is asked', async ($, on) => {
  const asked: Asked = { questions: [] }, ran: string[] = []
  person(on, 'Deny', asked); tools(on, ran)
  const r = await $.tool.call({ tool: 'Edit', file_path: '/repo/CLAUDE.md', old_string: 'a', new_string: 'b' })
  expect(asked.questions.length).toBe(1)
  expect(r.deny).toBeDefined()
})

test("Edit on the guard's own source is asked", async ($, on) => {
  const asked: Asked = { questions: [] }, ran: string[] = []
  person(on, 'Deny', asked); tools(on, ran)
  await $.tool.call({ tool: 'Edit', file_path: '/home/u/dotfile/mods/config-guard/hooks/register.ts', old_string: 'a', new_string: 'b' })
  expect(asked.questions.length).toBe(1)
})

test('a write holding an API key is asked, and the question does not repeat the key', async ($, on) => {
  const asked: Asked = { questions: [] }, ran: string[] = []
  person(on, 'Deny', asked); tools(on, ran)
  const r = await $.tool.call({ tool: 'Write', file_path: '/repo/notes.md', content: `key=${FAKE_ANTHROPIC}\n` })
  expect(asked.questions.length).toBe(1)
  expect(asked.questions[0]).not.toContain(FAKE_ANTHROPIC)
  expect(r.deny).toBeDefined()
})

test('with no one to ask (a -p run) a protected write is refused', async ($, on) => {
  const asked: Asked = { questions: [] }, ran: string[] = []
  person(on, undefined, asked); tools(on, ran)
  const r = await $.tool.call({ tool: 'Write', file_path: '/home/u/.claude/settings.json', content: '{}' })
  expect(r.deny).toBeDefined()
  expect(ran).toEqual([])
})

test('a path from the machine-local setting is protected', { options: { extra_paths: '/srv/private-repo/' } }, async ($, on) => {
  const asked: Asked = { questions: [] }, ran: string[] = []
  person(on, 'Deny', asked); tools(on, ran)
  const r = await $.tool.call({ tool: 'Write', file_path: '/srv/private-repo/plan.md', content: 'x' })
  expect(asked.questions.length).toBe(1)
  expect(r.deny).toBeDefined()
})
