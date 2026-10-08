// The alert pane's pure parts: the Gmail feed's items, how a row reads, and the
// commands a selection turns into. No engine calls, so tests can feed them.
//
// What reaches the model: nothing, until the person presses 詳しく and sends
// the draft it puts in the prompt. A message in a sensitive class (人事・成績・
// 査読 …, decided on the machine in ~/.config/life/alert.json) never gets 詳しく:
// it can be marked Done or put on the calendar, both run here without the model.

export type MailItem = {
  id: string
  thread_id?: string
  from: string
  from_name: string
  subject: string
  date: string
  labels: string[]
  unread: boolean
  bulk: boolean
  sensitive?: string
}

export type MailFeed = { fetched_at: string; items: MailItem[]; error?: string; fetched_new?: number }

export const DONE_LABEL = '9. Done/Triage'

export function parseFeed(stdout: string): MailFeed {
  try {
    const d = JSON.parse(stdout)
    return { fetched_at: String(d.fetched_at ?? ''), items: Array.isArray(d.items) ? d.items : [], error: d.error, fetched_new: d.fetched_new }
  } catch {
    return { fetched_at: '', items: [], error: '取得の結果を読めなかった' }
  }
}

// Ids in `items` not in `seen`: what came since the last look.
export function newIds(seen: ReadonlySet<string> | undefined, items: readonly MailItem[]): string[] {
  if (!seen) return []
  return items.filter(x => !seen.has(x.id)).map(x => x.id)
}

// "10/08 14:32" in the machine's zone.
export function shortDate(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '     '
  const d = new Date(t)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`
}

// Personal mail first, newest first; bulk mail (a list-unsubscribe header) after.
export function splitMail(items: readonly MailItem[], done: ReadonlySet<string>): { personal: MailItem[]; bulk: MailItem[] } {
  const live = items.filter(x => !done.has(x.id)).sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  return { personal: live.filter(x => !x.bulk), bulk: live.filter(x => x.bulk) }
}

// A row's text; the ☐ / ☑ that selects it is a button of its own before it
// (pressing the row opens the mail).
export function mailLine(item: MailItem): string {
  const dot = item.unread ? '●' : ' '
  const tag = item.sensitive ? `［${item.sensitive}］` : ''
  return `${dot} ${shortDate(item.date)}  ${item.from_name}  ${tag}${item.subject}`
}

// One mail with its body, from `alert_feed.py --body` (the pane's own call; the
// model is kept from it by ops-rules). Shown on the terminal, never stored.
export type MailBody = { id: string; from?: string; date?: string; subject?: string; sensitive?: string | null; body?: string; error?: string }

export function bodyArgv(python: string, repo: string, id: string): string[] {
  return [python, `${repo}/scripts/gmail/alert_feed.py`, '--body', id]
}

export function parseBody(stdout: string, id: string): MailBody {
  try {
    const d = JSON.parse(stdout)
    return { id, ...d }
  } catch {
    return { id, error: '本文を読めなかった' }
  }
}

export function doneArgv(python: string, repo: string, ids: readonly string[]): string[] {
  return [python, `${repo}/scripts/gmail_label.py`, ...ids.flatMap(id => ['--message-id', id]), '--add-label', DONE_LABEL]
}

// "2026-10-15 17:00" or "2026-10-15" (then 09:00); a 30-minute block that
// ends at the deadline's time would hide it, so the block starts there.
export function parseWhen(text: string): { start: string; end: string } | { error: string } {
  const m = text.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/)
  if (!m) return { error: '日時は 2026-10-15 17:00 か 2026-10-15 の形で' }
  const [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4] ?? '9', m[5] ?? '00'].map(Number)
  const start = new Date(y, mo - 1, d, h, mi)
  if (start.getMonth() !== mo - 1 || start.getDate() !== d || h > 23 || mi > 59) return { error: 'その日時はありません' }
  const end = new Date(start.getTime() + 30 * 60000)
  const iso = (t: Date) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}T${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:00`
  return { start: iso(start), end: iso(end) }
}

export function calendarArgv(python: string, repo: string, title: string, when: { start: string; end: string }): string[] {
  return [python, `${repo}/scripts/google_calendar_create.py`, '--title', title, '--start', when.start, '--end', when.end, '--execute']
}

// A sensitive message's default title says only its class, never its subject
// (a subject can carry the matter itself).
export function calendarTitle(item: MailItem): string {
  return item.sensitive ? `［${item.sensitive}］締切` : `〆 ${item.subject}`
}

// The draft 詳しく puts in the prompt: the ids to read, and what to do. Only
// the person's send hands it to the model; sensitive mail is refused here too.
export function detailPrompt(items: readonly MailItem[], ask: string): string | undefined {
  if (items.length === 0 || items.some(x => x.sensitive)) return undefined
  const lines = items.map(x => `- id ${x.id} — ${shortDate(x.date)} ${x.from_name}「${x.subject}」`)
  return [
    'Gmail の次のメールを読んで、頼んだことをしてください。本文は life repo で `python scripts/gmail/alert_feed.py --show <id>` で 1 通ずつ取る（読むだけ。返信・削除はしない）。',
    ...lines,
    '',
    `頼むこと: ${ask.trim() || '要点と、私がすべきことを短く'}`,
  ].join('\n')
}
