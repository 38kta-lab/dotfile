import type { Register } from 'claude-code'

// note.md's table of contents is generated from its headings by
// scripts/note_toc.py. After every write to a note.md, check that the
// contents still match and that every analysis heading has its three lines,
// and tell the model when not. The mod never rewrites the file itself: the
// model may still be editing it, and a write from outside would make its
// next Edit fail.
const NOTE = /(^|\/)note\/note\.md$/

export type Verdict = { stale: boolean; problems: string[] }

export function verdict(exitCode: number, stderr: string): Verdict {
  const problems = stderr
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('note_toc: ') && !l.includes('書き込まない'))
    .map(l => l.slice('note_toc: '.length))
  return { stale: exitCode === 1, problems }
}

export function message(path: string, command: string, v: Verdict): string | undefined {
  if (!v.stale && v.problems.length === 0) return undefined
  const parts: string[] = []
  if (v.problems.length > 0) {
    parts.push(`note-toc: ${path} の見出しが型に合っていません（目次を作れません）: ${v.problems.join(' / ')}。` +
      '型は「## <解析番号> — 題（YYYY-MM-DD｜日付未記載）」と直下の「- 問い: / - 結論: / - 状態:」の 3 行、1 つの番号に ## は 1 つ。')
  }
  if (v.stale) {
    parts.push(`note-toc: ${path} の冒頭の目次が古くなっています。note の編集が終わったら \`${command}\` を実行して作り直してください（目次は手で書かない）。`)
  }
  return parts.join(' ')
}

// Rules.md「研究 PJ の解析番号の作法」5: the 結論 field holds the user's words
// only, marked （user YYYY-MM-DD）; anything else stays 未記載. Only the text this
// call wrote is looked at, so conclusions written before the rule stay quiet.
export function unmarkedConclusions(text: string): string[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => /^- 結論:/.test(l))
    .map(l => l.replace(/^- 結論:\s*/, ''))
    .filter(c => c !== '' && !c.startsWith('未記載') && !/（user[\s　]/.test(c) && !/\(user\s/.test(c))
}

export function conclusionMessage(path: string, found: string[]): string | undefined {
  if (found.length === 0) return undefined
  const shown = found.slice(0, 3).map(c => `「${c.slice(0, 60)}」`).join(' ')
  return `note-toc: ${path} の「結論」に user の印の無い文があります: ${shown}${found.length > 3 ? ` ほか ${found.length - 3} 件` : ''}。` +
    '結果の解釈は user が持つ（Rules.md「研究 PJ の解析番号の作法」5）。user が言った結論なら末尾に「（user YYYY-MM-DD）」を付け、そうでなければ「未記載」に戻して、観察（数値・差・件数）は本文の「結果」に書く。'
}

async function check($: any, python: string, repo: string, path: string): Promise<string | undefined> {
  const script = `${repo}/scripts/note_toc.py`
  const r = await $.process.run([python, script, path, '--check'], { timeoutMs: 30000 })
  return message(path, `${python} ${script} ${path} --write`, verdict(r.exitCode, r.stderr))
}

// One hook for both tools; each is registered with a literal matcher, because
// a session reads the matcher from the source (a matcher built from a loop
// variable passed the tests but never ran in a session).
async function afterWrite($: any, path: string, written: string, ran: any, python: string, repo: string): Promise<any> {
  if (!NOTE.test(path) || ran.deny !== undefined || ran.isError) return ran
  const unmarked = conclusionMessage(path, unmarkedConclusions(written))
  if (unmarked) ran = { ...ran, context: [...(ran.context ?? []), unmarked] }
  // Say so instead of staying silent: an unset path means the check never runs.
  if (!repo) return { ...ran, context: [...(ran.context ?? []), 'note-toc: life_repo が未設定のため、note.md の目次と見出しの型を確かめられませんでした（settings.json の pluginConfigs）。'] }
  try {
    const note = await check($, python, repo, path)
    return note ? { ...ran, context: [...(ran.context ?? []), note] } : ran
  } catch (err) {
    return { ...ran, context: [...(ran.context ?? []), `note-toc: note.md の確認に失敗しました（${String(err).slice(0, 300)}）。`] }
  }
}

export const register: Register = (on, options) => {
  const python = String(options.python || 'python3')
  const repo = String(options.life_repo ?? '')

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => afterWrite($, e.file_path, String(e.new_string ?? ''), await next(e), python, repo))
  on('tool.call', { tool: 'Write' }, async ($, e, next) => afterWrite($, e.file_path, String(e.content ?? ''), await next(e), python, repo))
}
