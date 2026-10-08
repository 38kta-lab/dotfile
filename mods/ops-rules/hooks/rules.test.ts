import { test, expect } from 'claude-code/testing'

type Seen = { asked: string[]; ran: string[] }

function setup(on: any, role: string | undefined, answer: string | undefined, seen: Seen) {
  on('env.get', (_$: any, e: any, next: any) => (e.name === 'LIFE_ROLE' ? { value: role } : next(e)))
  on('tool.call', { tool: 'AskUserQuestion' }, (_$: any, e: any) => {
    const q = e.questions[0].question
    seen.asked.push(q)
    if (answer === undefined) return { deny: 'no one to ask' }
    return { result: { questions: e.questions, answers: { [q]: answer } } }
  })
  on('tool.call', { tool: 'Bash' }, (_$: any, e: any) => {
    seen.ran.push(e.command)
    return { result: { stdout: '', stderr: '', interrupted: false } }
  })
}

// Analyses: each must be held in the ops session.
const ANALYSES = [
  'nucmer --maxmatch -p out ref.fa qry.fa',
  "ssh hpc 'cd /data/x/JOB_0041 && minimap2 -ax map-hifi ref.fa reads.fq > out.sam'",
  'singularity exec -B /data /opt/sif/kofamscan.sif exec_annotation -p prof -k ko_list -o out.tsv in.faa',
  '~/miniconda3/envs/py39_genome/bin/samtools depth x.bam | awk \'{s+=$3} END {print s/NR}\'',
  'sbatch script/sbatch/JOB_0042.sh',
  'env OMP_NUM_THREADS=4 blastn -query q.fa -db db',
  'x=$(mmseqs easy-rbh a.faa b.faa out tmp)',
  'conda run -n genome tblastn -query q.faa -subject s.fa',
]

// Commands ops ran on 2026-10-08 to read and check peers' files: never held.
const CHECKS = [
  'grep -n "note1" /data/x/projA/CLAUDE.md',
  'cd /data/x/projB && git log --oneline -3 && git diff-tree -r -M --name-status 1a2b3c4 | head -3',
  "python3 - <<'EOF'\nfrom collections import Counter\nprint(1)\nEOF",
  'ls /data/x/projB_data/ | grep -cE "^JOB_"',
  'head -1 /data/x/JOB_0034/out/version_map.tsv | tr "\\t" "\\n"',
  'grep minimap2 /data/x/JOB_0018/run.log',
  'cat /data/x/JOB_0001/flye/flye.log | tail -5',
  'ls /data/x/JOB_0001/flye/',
  'nucmer --version',
  'which samtools minimap2',
]

test('the ops session is asked before every analysis, and Deny stops it', async ($, on) => {
  const seen: Seen = { asked: [], ran: [] }
  setup(on, 'ops', 'Deny', seen)
  for (const command of ANALYSES) {
    const r = await $.tool.call({ tool: 'Bash', command })
    expect(r.deny).toBeDefined()
  }
  expect(seen.asked.length).toBe(ANALYSES.length)
  expect(seen.ran).toEqual([])
})

test('the deny tells the model not to hand the analysis to another session', async ($, on) => {
  const seen: Seen = { asked: [], ran: [] }
  setup(on, 'ops', 'Deny', seen)
  const r = await $.tool.call({ tool: 'Bash', command: ANALYSES[0] })
  expect(r.deny).toContain('do not hand it to another session')
})

test('the ops session runs the analysis when the person allows it', async ($, on) => {
  const seen: Seen = { asked: [], ran: [] }
  setup(on, 'ops', 'Allow once', seen)
  const r = await $.tool.call({ tool: 'Bash', command: ANALYSES[1] })
  expect(r.deny).toBeUndefined()
  expect(seen.ran.length).toBe(1)
})

test("ops' file checks are never held", async ($, on) => {
  const seen: Seen = { asked: [], ran: [] }
  setup(on, 'ops', 'Deny', seen)
  for (const command of CHECKS) {
    const r = await $.tool.call({ tool: 'Bash', command })
    expect(r.deny).toBeUndefined()
  }
  expect(seen.asked).toEqual([])
  expect(seen.ran.length).toBe(CHECKS.length)
})

test('a project session measures freely', async ($, on) => {
  const seen: Seen = { asked: [], ran: [] }
  setup(on, 'peer', 'Deny', seen)
  for (const command of ANALYSES) await $.tool.call({ tool: 'Bash', command })
  expect(seen.asked).toEqual([])
  expect(seen.ran.length).toBe(ANALYSES.length)
})

test('a session without a role measures freely', async ($, on) => {
  const seen: Seen = { asked: [], ran: [] }
  setup(on, undefined, 'Deny', seen)
  await $.tool.call({ tool: 'Bash', command: ANALYSES[0] })
  expect(seen.asked).toEqual([])
  expect(seen.ran.length).toBe(1)
})

test('with no one to ask, the ops session does not run the analysis', async ($, on) => {
  const seen: Seen = { asked: [], ran: [] }
  setup(on, 'ops', undefined, seen)
  const r = await $.tool.call({ tool: 'Bash', command: ANALYSES[0] })
  expect(r.deny).toBeDefined()
  expect(seen.ran).toEqual([])
})

function editTool(on: any, failing = false) {
  on('tool.call', { tool: 'Edit' }, (_$: any, e: any) =>
    failing ? { result: 'File has been modified since read', isError: true } : { result: { filePath: e.file_path } })
}
const TASKS = '/home/u/life/ideas/task-review/tasks.md'

test('turning a project line ✅ reminds the model to fix that hub', async ($, on) => {
  editTool(on)
  const r = await $.tool.call({
    tool: 'Edit', file_path: TASKS,
    old_string: '- ⬜ [21_Q] 解析 8 — @claude-21 — 10/07', new_string: '- ✅ [21_Q] 解析 8 — @claude-21 — 10/07',
  })
  expect(r.context?.join(' ')).toContain('projects/active/21_Q*.md')
  expect(r.context?.join(' ')).toContain('Next Actions')
})

test('a line tagged with two projects names both hubs', async ($, on) => {
  editTool(on)
  const r = await $.tool.call({
    tool: 'Edit', file_path: TASKS,
    old_string: '- ⬜ [21_Q/22_R] hub と note の整理', new_string: '- ✅ [21_Q/22_R] hub と note の整理',
  })
  const c = r.context?.join(' ') ?? ''
  expect(c).toContain('21_Q*.md')
  expect(c).toContain('22_R*.md')
})

test('an admin line has no hub, so no reminder', async ($, on) => {
  editTool(on)
  const r = await $.tool.call({ tool: 'Edit', file_path: TASKS, old_string: '- ⬜ [事務] 経理返信', new_string: '- ✅ [事務] 経理返信' })
  expect(r.context ?? []).toEqual([])
})

test('an edit that turns nothing ✅ adds nothing', async ($, on) => {
  editTool(on)
  const r = await $.tool.call({ tool: 'Edit', file_path: TASKS, old_string: '- ⬜ [Z90] 現状確認', new_string: '- ⬜ [Z90] 現状確認＋実作業' })
  expect(r.context ?? []).toEqual([])
})

test('a line that was already ✅ is not counted again', async ($, on) => {
  editTool(on)
  const r = await $.tool.call({
    tool: 'Edit', file_path: TASKS,
    old_string: '- ✅ [22_R] 表の整形\n- ⬜ [Z90] 確認', new_string: '- ✅ [22_R] 表の整形\n- ⬜ [Z90] 確認（13:00）',
  })
  expect(r.context ?? []).toEqual([])
})

test('a failed edit adds no reminder', async ($, on) => {
  editTool(on, true)
  const r = await $.tool.call({ tool: 'Edit', file_path: TASKS, old_string: '- ⬜ [21_Q] x', new_string: '- ✅ [21_Q] x' })
  expect(r.context ?? []).toEqual([])
})

test('the same ✅ in another file adds nothing', async ($, on) => {
  editTool(on)
  const r = await $.tool.call({ tool: 'Edit', file_path: '/home/u/life/projects/active/21_Q.md', old_string: '- ⬜ [21_Q] x', new_string: '- ✅ [21_Q] x' })
  expect(r.context ?? []).toEqual([])
})

function files(on: any, now = Date.parse('2026-10-08T03:41:00Z')) {
  const fs = new Map<string, string>()
  on('fs.read', (_$: any, e: any) => {
    if (!fs.has(e.path)) throw new Error('ENOENT')
    return { value: fs.get(e.path) }
  })
  on('fs.write', (_$: any, e: any) => { fs.set(e.path, e.text); return { value: undefined } })
  on('clock.now', () => ({ value: now }))
  return fs
}

test('a line turned ✅ is logged with the minute in done/YYYY-MM.md next to tasks.md', async ($, on) => {
  editTool(on)
  const fs = files(on)
  await $.tool.call({ tool: 'Edit', file_path: TASKS, old_string: '- ⬜ [事務] 経理返信 — @user — 10/08', new_string: '- ✅ [事務] 経理返信 — @user — 10/08' })
  const log = fs.get('/home/u/life/ideas/task-review/done/2026-10.md')!
  expect(log).toContain('# done 2026-10')
  expect(log).toContain('- 2026-10-08 12:41 ✅ [事務] 経理返信 — @user — 10/08')
})

test('later ✅ lines are appended, not overwritten', async ($, on) => {
  editTool(on)
  const fs = files(on)
  await $.tool.call({ tool: 'Edit', file_path: TASKS, old_string: '- ⬜ [21_Q] a', new_string: '- ✅ [21_Q] a' })
  await $.tool.call({ tool: 'Edit', file_path: TASKS, old_string: '- ⬜ [Z90] b', new_string: '- ✅ [Z90] b' })
  const log = fs.get('/home/u/life/ideas/task-review/done/2026-10.md')!
  expect(log.indexOf('✅ [21_Q] a')).toBeLessThan(log.indexOf('✅ [Z90] b'))
  expect(log.match(/^# done/gm)?.length).toBe(1)
})

test('an edit with nothing turned ✅ logs nothing, and a failed edit logs nothing', async ($, on) => {
  editTool(on, true)
  const fs = files(on)
  await $.tool.call({ tool: 'Edit', file_path: TASKS, old_string: '- ⬜ [21_Q] x', new_string: '- ✅ [21_Q] x' })
  expect(fs.size).toBe(0)
})

// An Edit that really changes the file in `fs`, as the tool does.
function editFile(on: any, fs: Map<string, string>) {
  on('tool.call', { tool: 'Edit' }, (_$: any, e: any) => {
    const text = fs.get(e.file_path) ?? ''
    if (!text.includes(e.old_string)) return { result: 'old_string not found', isError: true }
    fs.set(e.file_path, text.replace(e.old_string, e.new_string))
    return { result: { filePath: e.file_path } }
  })
}
const TASKS_MD = '# tasks\n\n## 今日\n\n- ⬜ [21_Q] 資料の整理（14:30–16:30）— @user・@ops — 10/08\n- ⬜ [事務] 学会 B 総会の委任状 — @user — 10/08（10/09 13:00）\n'

test('an edit of only the start of a line logs the whole line from the file', async ($, on) => {
  const fs = files(on)
  fs.set(TASKS, TASKS_MD)
  editFile(on, fs)
  const r = await $.tool.call({ tool: 'Edit', file_path: TASKS, old_string: '- ⬜ [21_Q] 資料の整理', new_string: '- ✅ [21_Q] 資料の整理' })
  const log = fs.get('/home/u/life/ideas/task-review/done/2026-10.md')!
  expect(log).toContain('- 2026-10-08 12:41 ✅ [21_Q] 資料の整理（14:30–16:30）— @user・@ops — 10/08\n')
  expect(r.context?.join(' ')).toContain('資料の整理（14:30–16:30）— @user・@ops — 10/08')
  expect(r.context?.join(' ')).toContain('21_Q*.md')
})

test('two lines turned ✅ by one edit of their starts are both logged whole', async ($, on) => {
  const fs = files(on)
  fs.set(TASKS, TASKS_MD)
  editFile(on, fs)
  await $.tool.call({
    tool: 'Edit', file_path: TASKS,
    old_string: '- ⬜ [21_Q] 資料の整理（14:30–16:30）— @user・@ops — 10/08\n- ⬜ [事務] 学会 B',
    new_string: '- ✅ [21_Q] 資料の整理（14:30–16:30）— @user・@ops — 10/08\n- ✅ [事務] 学会 B',
  })
  const log = fs.get('/home/u/life/ideas/task-review/done/2026-10.md')!
  expect(log).toContain('✅ [21_Q] 資料の整理（14:30–16:30）— @user・@ops — 10/08\n')
  expect(log).toContain('✅ [事務] 学会 B 総会の委任状 — @user — 10/08（10/09 13:00）\n')
})

test('a second identical line turned ✅ is still logged', async ($, on) => {
  const fs = files(on)
  fs.set(TASKS, '- ✅ [21_Q] 同じ行\n- ⬜ [21_Q] 同じ行\n')
  editFile(on, fs)
  await $.tool.call({ tool: 'Edit', file_path: TASKS, old_string: '- ⬜ [21_Q] 同じ', new_string: '- ✅ [21_Q] 同じ' })
  const log = fs.get('/home/u/life/ideas/task-review/done/2026-10.md')!
  expect(log.match(/✅ \[21_Q\] 同じ行/g)?.length).toBe(1)
})
