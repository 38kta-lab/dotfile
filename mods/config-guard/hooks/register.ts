import type { Register } from 'claude-code'

// Claude Code's own configuration and instruction files, and this guard.
// A change to any of them changes what every later session is allowed to do.
const PROTECTED_PATHS: readonly RegExp[] = [
  /\.claude\/settings(\.local)?\.json$/,
  /(^|\/)\.claude\.json$/,
  /(^|\/)\.mcp\.json$/,
  /(^|\/)CLAUDE\.md$/,
  /(^|\/)AGENTS\.md$/,
  /\.claude\/hooks\//,
  /\.claude\/statusline[^/]*$/,
  /\.claude\/plugins\//,
  /\/mods\/config-guard\//,
]

// The same files as they appear inside a shell command (not anchored, and
// `cd ~/.claude && ... settings.json` still counts).
const PROTECTED_IN_COMMAND: readonly RegExp[] = [
  /\.claude\b[\s\S]*settings(\.local)?\.json/,
  /\.claude\.json/,
  /\.mcp\.json/,
  /CLAUDE\.md/,
  /AGENTS\.md/,
  /\.claude\/hooks\b/,
  /\.claude\/statusline/,
  /\.claude\/plugins\b/,
  /mods\/config-guard\b/,
]

// Shell forms that can change a file. Best effort: a command built from
// variables or an interpreter script gets past it.
const WRITES =
  /(^|[^<>&0-9])>>?(?!&)|\btee\b|\bsed\b[^|;&]*\s-[a-zA-Z]*i|\bperl\b[^|;&]*\s-[a-zA-Z]*i|\b(cp|mv|rm|ln|install|rsync|truncate|chmod|chown|touch|dd)\b|\bgit\s+(checkout|restore|apply|mv|rm)\b|\bopen\([^)]*['"][wa]/

// Secrets by their published prefixes only. Never by entropy: research notes
// carry long hex digests (database md5s) that are not secrets.
const SECRETS: readonly (readonly [string, RegExp])[] = [
  ['Anthropic API key', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['OpenAI API key', /\bsk-(proj-)?[A-Za-z0-9_-]{32,}/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}|\bgithub_pat_[A-Za-z0-9_]{40,}/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}/],
  ['Google OAuth token', /\bya29\.[0-9A-Za-z_-]{20,}/],
  ['Tailscale auth key', /\btskey-[A-Za-z0-9-]{20,}/],
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
]

// The shared task list: only the session started with LIFE_ROLE=ops writes it.
// Every other session reads it. Refused without a dialog: no other session
// has a reason to write it.
const OPS_ONLY_PATH = /(^|\/)ideas\/task-review\/tasks\.md$/
const OPS_ONLY_IN_COMMAND = /task-review\b[\s\S]*\btasks\.md/
const OPS_ONLY_DENY =
  'config-guard: ideas/task-review/tasks.md is written by the ops session only. ' +
  'Do not write it another way; put the change you wanted in your report instead.'

const ALLOW = 'Allow once'
const DENY = 'Deny'

function extraPaths(value: unknown): string[] {
  return String(value ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

function pathReasons(path: string, extra: readonly string[]): string[] {
  const hit = PROTECTED_PATHS.some(r => r.test(path)) || extra.some(s => path.includes(s))
  return hit ? [`writes to a protected file: ${path}`] : []
}

// Names the kind of secret, never the matched text, so the question itself
// does not carry the secret into the transcript.
function secretReasons(text: string): string[] {
  const hit = SECRETS.find(([, r]) => r.test(text))
  return hit ? [`the content looks like it holds a ${hit[0]}`] : []
}

function opsOnlyCommand(command: string): boolean {
  const c = command.replace(/\d*&?>>?\s*\/dev\/null/g, '')
  return OPS_ONLY_IN_COMMAND.test(c) && WRITES.test(c)
}

function bashReasons(command: string, extra: readonly string[]): string[] {
  const c = command.replace(/\d*&?>>?\s*\/dev\/null/g, '')
  const touches = PROTECTED_IN_COMMAND.some(r => r.test(c)) || extra.some(s => c.includes(s))
  return [
    ...(touches && WRITES.test(c) ? [`a shell command that may change a protected file: ${command.slice(0, 120)}`] : []),
    ...secretReasons(command),
  ]
}

// Puts the call to the person in a dialog. `tool.check`'s `ask` is not used:
// under auto mode it goes to the auto-mode classifier, not to the person.
// No dialog (a `-p` run) or a dismissed one refuses the call. Deny is listed
// first and only the exact Allow label allows, so a dialog that resolves on
// its own while the person is away does not let the call through.
async function confirm(ask: (q: string) => Promise<string>, tool: string, reasons: readonly string[]): Promise<string | undefined> {
  const why = reasons.join(' / ')
  let answer: string
  try {
    answer = await ask(`config-guard: ${tool} ${why}. Allow it?`)
  } catch {
    return `config-guard refused this ${tool} call (${why}): nobody could be asked to confirm it.`
  }
  return answer === ALLOW ? undefined : `config-guard: the person declined this ${tool} call (${why}).`
}

const FAIL_CLOSED = 'config-guard: its check failed, so the call was refused.'

export const register: Register = (on, options) => {
  const extra = extraPaths(options.extra_paths)

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    if (OPS_ONLY_PATH.test(e.file_path) && (await $.env.get('LIFE_ROLE')) !== 'ops') return { deny: OPS_ONLY_DENY }
    const reasons = [...pathReasons(e.file_path, extra), ...secretReasons(e.content)]
    if (reasons.length === 0) return next(e)
    const deny = await confirm(q => $.ui.ask(q, { header: 'Guard', options: [DENY, ALLOW] }), 'Write', reasons)
    return deny ? { deny } : next(e)
  }).catch(($, e, next) => (next.called ? next(e) : { deny: FAIL_CLOSED }))

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    if (OPS_ONLY_PATH.test(e.file_path) && (await $.env.get('LIFE_ROLE')) !== 'ops') return { deny: OPS_ONLY_DENY }
    const reasons = [...pathReasons(e.file_path, extra), ...secretReasons(e.new_string)]
    if (reasons.length === 0) return next(e)
    const deny = await confirm(q => $.ui.ask(q, { header: 'Guard', options: [DENY, ALLOW] }), 'Edit', reasons)
    return deny ? { deny } : next(e)
  }).catch(($, e, next) => (next.called ? next(e) : { deny: FAIL_CLOSED }))

  on('tool.call', { tool: 'NotebookEdit' }, async ($, e, next) => {
    const reasons = [...pathReasons(e.notebook_path, extra), ...secretReasons(e.new_source)]
    if (reasons.length === 0) return next(e)
    const deny = await confirm(q => $.ui.ask(q, { header: 'Guard', options: [DENY, ALLOW] }), 'NotebookEdit', reasons)
    return deny ? { deny } : next(e)
  }).catch(($, e, next) => (next.called ? next(e) : { deny: FAIL_CLOSED }))

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (opsOnlyCommand(e.command) && (await $.env.get('LIFE_ROLE')) !== 'ops') return { deny: OPS_ONLY_DENY }
    const reasons = bashReasons(e.command, extra)
    if (reasons.length === 0) return next(e)
    const deny = await confirm(q => $.ui.ask(q, { header: 'Guard', options: [DENY, ALLOW] }), 'Bash', reasons)
    return deny ? { deny } : next(e)
  }).catch(($, e, next) => (next.called ? next(e) : { deny: FAIL_CLOSED }))
}
