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
  'cd /data/x/projB && git log --oneline -3 && git diff-tree -r -M --name-status ca12f91 | head -3',
  "python3 - <<'EOF'\nfrom collections import Counter\nprint(1)\nEOF",
  'ls /data/x/projB_data/ | grep -cE "^KM_G"',
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
    old_string: '- ⬜ [03_C] 第4波 8 — @claude-03 — 10/07', new_string: '- ✅ [03_C] 第4波 8 — @claude-03 — 10/07',
  })
  expect(r.context?.join(' ')).toContain('projects/active/03_C*.md')
  expect(r.context?.join(' ')).toContain('Next Actions')
})

test('a line tagged with two projects names both hubs', async ($, on) => {
  editTool(on)
  const r = await $.tool.call({
    tool: 'Edit', file_path: TASKS,
    old_string: '- ⬜ [03_C/07_G] hub と note の整理', new_string: '- ✅ [03_C/07_G] hub と note の整理',
  })
  const c = r.context?.join(' ') ?? ''
  expect(c).toContain('03_C*.md')
  expect(c).toContain('07_G*.md')
})

test('an admin line has no hub, so no reminder', async ($, on) => {
  editTool(on)
  const r = await $.tool.call({ tool: 'Edit', file_path: TASKS, old_string: '- ⬜ [事務] 経理返信', new_string: '- ✅ [事務] 経理返信' })
  expect(r.context ?? []).toEqual([])
})

test('an edit that turns nothing ✅ adds nothing', async ($, on) => {
  editTool(on)
  const r = await $.tool.call({ tool: 'Edit', file_path: TASKS, old_string: '- ⬜ [M20] 現状確認', new_string: '- ⬜ [M20] 現状確認＋実作業' })
  expect(r.context ?? []).toEqual([])
})

test('a line that was already ✅ is not counted again', async ($, on) => {
  editTool(on)
  const r = await $.tool.call({
    tool: 'Edit', file_path: TASKS,
    old_string: '- ✅ [07_G] note 整形\n- ⬜ [M20] 確認', new_string: '- ✅ [07_G] note 整形\n- ⬜ [M20] 確認（13:00）',
  })
  expect(r.context ?? []).toEqual([])
})

test('a failed edit adds no reminder', async ($, on) => {
  editTool(on, true)
  const r = await $.tool.call({ tool: 'Edit', file_path: TASKS, old_string: '- ⬜ [03_C] x', new_string: '- ✅ [03_C] x' })
  expect(r.context ?? []).toEqual([])
})

test('the same ✅ in another file adds nothing', async ($, on) => {
  editTool(on)
  const r = await $.tool.call({ tool: 'Edit', file_path: '/home/u/life/projects/active/03_C.md', old_string: '- ⬜ [03_C] x', new_string: '- ✅ [03_C] x' })
  expect(r.context ?? []).toEqual([])
})
