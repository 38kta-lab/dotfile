import type { Register } from 'claude-code'

// The ops session decides what to measure; the project sessions measure.
// When ops runs an analysis itself, it has no control beside it and its
// numbers leak into decisions unchecked. So in the ops session an analysis
// command is held until the person allows it.
const ANALYSIS_TOOLS = new Set([
  // alignment and similarity search
  'nucmer', 'promer', 'show-coords', 'delta-filter', 'dnadiff', 'mummer',
  'blastn', 'blastp', 'blastx', 'tblastn', 'tblastx', 'makeblastdb', 'diamond', 'mmseqs',
  'minimap2', 'bwa', 'bowtie2', 'hisat2',
  // reads and variants
  'samtools', 'bcftools', 'bedtools', 'mosdepth',
  // assembly
  'hifiasm', 'flye', 'canu', 'spades.py', 'metaMDBG', 'unicycler',
  // annotation and profiles
  'prodigal', 'prokka', 'bakta', 'dfast', 'exec_annotation', 'hmmsearch', 'hmmscan',
  // phylogeny and alignment
  'gtdbtk', 'iqtree', 'iqtree2', 'raxml-ng', 'FastTree', 'mafft', 'muscle', 'trimal',
  // job submission
  'sbatch', 'srun', 'vsub',
])

// Words that only wrap the command that follows them.
const WRAPPERS = new Set(['sudo', 'time', 'nohup', 'exec', 'xargs', 'env', 'command', 'nice'])
const ASKS_ONLY = /^(--?version|-v|--?help|-h)$/

function strip(token: string): string {
  return token.replace(/^[('"`$]+|[)'"`;]+$/g, '')
}

// The tools a shell command runs as commands (not names it only mentions).
// Splits on the shell's own separators, quoted or not, so the command inside
// `ssh host '...'` is split the same way.
export function analysisTools(command: string): string[] {
  const found: string[] = []
  for (const segment of command.split(/\|\||&&|[;|\n]|\$\(|`/)) {
    const tokens = segment.trim().split(/\s+/).map(strip).filter(Boolean)
    let i = 0
    while (i < tokens.length) {
      const t = tokens[i]
      if (WRAPPERS.has(t) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(t)) { i++; continue }
      if (t === 'ssh') { i++; while (i < tokens.length && tokens[i].startsWith('-')) i += 2; i++; continue }
      if (t === 'conda' && tokens[i + 1] === 'run') { i += 2; while (i < tokens.length && tokens[i].startsWith('-')) i += 2; continue }
      if (t === 'singularity' || t === 'apptainer') {
        while (i < tokens.length && !tokens[i].endsWith('.sif')) i++
        i++
        continue
      }
      break
    }
    if (i >= tokens.length) continue
    const name = tokens[i].split('/').pop() ?? ''
    if (!ANALYSIS_TOOLS.has(name)) continue
    const args = tokens.slice(i + 1)
    if (args.length > 0 && args.every(a => ASKS_ONLY.test(a))) continue
    found.push(name)
  }
  return [...new Set(found)]
}

// tasks.md: a line turned ✅ means a hub's Next Actions are now stale.
// Rules.md says to fix the hub in the same turn; this tells the model so
// right after the edit lands, which is when it can still act on it.
const TASKS_PATH = /(^|\/)ideas\/task-review\/tasks\.md$/
const NO_HUB = new Set(['事務'])

// ✅ lines in `newText` beyond those already in `oldText`, counted as a
// multiset so a second identical line still counts.
export function newlyDone(oldText: string, newText: string): string[] {
  const before = new Map<string, number>()
  for (const l of oldText.split('\n').map(x => x.trim())) before.set(l, (before.get(l) ?? 0) + 1)
  const out: string[] = []
  for (const l of newText.split('\n').map(x => x.trim())) {
    if (!l.startsWith('- ✅')) continue
    const n = before.get(l) ?? 0
    if (n > 0) before.set(l, n - 1)
    else out.push(l)
  }
  return out
}

async function readText($: any, path: string): Promise<string | undefined> {
  try {
    return String(await $.fs.read(path))
  } catch {
    return undefined
  }
}

function projects(lines: readonly string[]): string[] {
  const tags = lines.flatMap(l => {
    const m = l.match(/^- ✅ \[([^\]]+)\]/)
    return m ? m[1].split('/') : []
  })
  return [...new Set(tags)].filter(t => !NO_HUB.has(t))
}

// Every line turned ✅ is also logged, with the minute, to a month file next
// to tasks.md (done/YYYY-MM.md), so what was done when survives the morning
// clean-up that deletes ✅ lines from tasks.md.
function two(n: number): string {
  return String(n).padStart(2, '0')
}

export function logLines(now: number, done: readonly string[]): { month: string; lines: string[] } {
  const d = new Date(now)
  const month = `${d.getFullYear()}-${two(d.getMonth() + 1)}`
  const stamp = `${month}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`
  return { month, lines: done.map(l => `- ${stamp} ${l.replace(/^- /, '')}`) }
}

async function logDone($: any, tasksPath: string, done: readonly string[]): Promise<void> {
  const { month, lines } = logLines(await $.clock.now(), done)
  const dir = tasksPath.replace(/[^/]*$/, '')
  const path = `${dir}done/${month}.md`
  let old = ''
  try {
    old = String(await $.fs.read(path))
  } catch {
    old = `# done ${month}\n\ntasks.md で ✅ にした行（ops-rules mod が ✅ の瞬間に書く）。\n\n`
  }
  await $.fs.write(path, old.replace(/\n*$/, '\n') + lines.join('\n') + '\n')
}

// ---- replies in Japanese ----------------------------------------------------
// The person reads in Japanese. A rule in the system prompt asks for it every
// turn; a turn whose answer still came out in English is followed, once, by an
// automatic request to say the same thing again in Japanese.
const JAPANESE: { id: string; text: string; scope: 'session' } = {
  id: 'ops-rules:japanese',
  text:
    'user への返答は、作業の途中の一言も最終報告も、すべて日本語で書く。英語にするのは user が頼んだときだけ。' +
    'コマンドの出力・コード・ファイル名が英語でも、説明の地の文は日本語で書く。長い作業の後の最終報告ほど英語になりやすいので、書き始める前に言語を確かめる。',
  scope: 'session',
}
const RESTATE =
  '（ops-rules 自動）直前の返答が英語でした。同じ内容を日本語で言い直してください。作業はやり直さず、ツールも使わないでください。'

// Prose only: code blocks, inline code, URLs and paths say nothing about the
// language of the reply. English when its words clearly outnumber the
// Japanese characters; a short reply is never judged.
export function looksEnglish(answer: string): boolean {
  const prose = answer
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[\w.~-]*\/[\w.~/-]+/g, ' ')
  const ja = (prose.match(/[\u3040-\u30ff\u3400-\u9fff]/g) ?? []).length
  const words = (prose.match(/[A-Za-z]{2,}/g) ?? []).length
  return words >= 25 && ja < words * 0.5
}

let restating = false

const ALLOW = 'Allow once'
const DENY = 'Deny'

export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const tools = analysisTools(e.command)
    if (tools.length === 0) return next(e)
    if ((await $.env.get('LIFE_ROLE')) !== 'ops') return next(e)
    const what = tools.join(', ')
    let answer: string
    try {
      answer = await $.ui.ask(
        `ops-rules: the ops session is about to run an analysis (${what}). ops decides and does not measure. Allow it?`,
        { header: 'ops', options: [DENY, ALLOW] },
      )
    } catch {
      answer = DENY
    }
    if (answer === ALLOW) return next(e)
    return {
      deny:
        `ops-rules: the person declined this analysis in the ops session (${what}). ` +
        'Do not run it another way and do not hand it to another session on your own. ' +
        'Tell the person what you wanted to measure and wait for their instruction.',
    }
  }).catch(($, e, next) => (next.called ? next(e) : { deny: 'ops-rules: its check failed, so the call was refused.' }))

  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    return { ...r, sections: [...r.sections.filter(x => x.id !== JAPANESE.id), JAPANESE] }
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId !== undefined || e.reason !== 'answer') return r
    if (restating) {
      restating = false
      return r
    }
    if (!looksEnglish(e.answer)) return r
    restating = true
    $.prompt.submit({ text: RESTATE }).catch(() => {
      restating = false
    })
    return r
  })

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    if (!TASKS_PATH.test(e.file_path)) return next(e)
    // The edit's own strings say whether a ✅ was added, but an edit of part
    // of a line carries only that part. The whole lines come from the file,
    // read before and after; the strings stand in when it cannot be read.
    const hint = newlyDone(e.old_string, e.new_string)
    if (hint.length === 0) return next(e)
    const before = await readText($, e.file_path)
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError) return ran
    const after = before === undefined ? undefined : await readText($, e.file_path)
    const whole = before !== undefined && after !== undefined ? newlyDone(before, after) : []
    const done = whole.length > 0 ? whole : hint
    try {
      await logDone($, e.file_path, done)
    } catch (err) {
      $.ui.log(`ops-rules: could not log done lines: ${String(err)}`)
    }
    const pjs = projects(done)
    if (pjs.length === 0) return ran
    const hubs = pjs.map(p => `projects/active/${p}*.md`).join(', ')
    const note =
      `ops-rules: tasks.md で ✅ にした行があります（${done.join(' / ')}）。` +
      `Rules.md「記録の 3 層と tasks.md」により、このターンのうちに該当 hub（${hubs}）の Next Actions から済んだ項目を外し、必要なら Current State を上書きしてください。`
    return { ...ran, context: [...(ran.context ?? []), note] }
  })
}
