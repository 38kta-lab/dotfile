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

export function newlyDone(oldText: string, newText: string): string[] {
  const before = new Set(oldText.split('\n').map(l => l.trim()))
  return newText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('- ✅') && !before.has(l))
}

function projects(lines: readonly string[]): string[] {
  const tags = lines.flatMap(l => {
    const m = l.match(/^- ✅ \[([^\]]+)\]/)
    return m ? m[1].split('/') : []
  })
  return [...new Set(tags)].filter(t => !NO_HUB.has(t))
}

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

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    if (!TASKS_PATH.test(e.file_path)) return next(e)
    const done = newlyDone(e.old_string, e.new_string)
    const ran = await next(e)
    if (done.length === 0 || ran.deny !== undefined || ran.isError) return ran
    const pjs = projects(done)
    if (pjs.length === 0) return ran
    const hubs = pjs.map(p => `projects/active/${p}*.md`).join(', ')
    const note =
      `ops-rules: tasks.md で ✅ にした行があります（${done.join(' / ')}）。` +
      `Rules.md「記録の 3 層と tasks.md」により、このターンのうちに該当 hub（${hubs}）の Next Actions から済んだ項目を外し、必要なら Current State を上書きしてください。`
    return { ...ran, context: [...(ran.context ?? []), note] }
  })
}
