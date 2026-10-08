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

async function check($: any, python: string, repo: string, path: string): Promise<string | undefined> {
  const script = `${repo}/scripts/note_toc.py`
  const r = await $.process.run([python, script, path, '--check'], { timeoutMs: 30000 })
  return message(path, `${python} ${script} ${path} --write`, verdict(r.exitCode, r.stderr))
}

export const register: Register = (on, options) => {
  const python = String(options.python || 'python3')
  const repo = String(options.life_repo ?? '')

  for (const tool of ['Edit', 'Write'] as const) {
    on('tool.call', { tool }, async ($, e, next) => {
      const ran = await next(e)
      if (!repo || !NOTE.test(e.file_path) || ran.deny !== undefined || ran.isError) return ran
      try {
        const note = await check($, python, repo, e.file_path)
        return note ? { ...ran, context: [...(ran.context ?? []), note] } : ran
      } catch (err) {
        $.ui.log(`note-toc: check failed: ${String(err)}`, { to: 'debug' })
        return ran
      }
    })
  }
}
