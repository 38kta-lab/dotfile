---
name: screenshot
description: "Find and read the screenshots the user just took on another Mac (they reach this Mac through iCloud Drive's Desktop folder), instead of asking the user to attach them in an app. Use when the user says スクショ見て, さっきのスクショ, 画面を見て, この画面, スクリーンショットを読んで, look at my screenshot, or refers to something that is on their screen but not in the conversation."
metadata:
  short-description: "Read the user's latest screenshots from the synced Desktop"
---

# Screenshot

The user takes screenshots on another Mac. With iCloud Drive's Desktop sync they arrive here, in
`~/Library/Mobile Documents/com~apple~CloudDocs/Desktop` (a second Mac may appear as `Desktop - <name>`), usually
within a minute. Read them from there; do not ask the user to upload or attach anything.

## Steps

1. List the newest ones: `shot` (the last 24 hours, 5 files). Options: `shot -n 10`, `shot --since 30m`, `shot --all`.
   (`shot` is a small read-only script linked into `~/.local/bin`; if it is not found, say so rather than listing the folder by hand with a broader pattern.)
2. Each output line is: number, time taken, size, pixels, place, path. Pick by what the user said:
   - 「さっきの」「今の」→ the newest one. 「3 枚前」→ number 3. 「17 時台の」→ the one with that time.
   - Several files wanted ("これとこれ") → read each of them.
3. Read the chosen path(s) with the Read tool (it shows the image). **Say which file you read** (time and name) so the
   user can tell if it was the wrong one.
4. If nothing is found, say so and give the reason you can see: the user may not have taken it yet, the other Mac may be
   asleep or offline, or iCloud has not delivered it (a line saying "まだ iCloud から届いていない" means wait a little
   and run `shot` again). Do not guess the content.

## Rules

- Read a screenshot only when the user asked. Do not browse the folder on your own.
- Screenshots can show unpublished data, mail, chats, or other people's names. Keep what you read in the conversation:
  do not copy the image into a repository, a hub, or any public place, and do not commit it, unless the user says to.
- Never delete, move, or rename the files (the folder is the user's Desktop). `shot` only lists.
- A very large image (several MB) can be shrunk for reading with `sips -Z 2000 <file> --out <a scratch path>`; the
  original stays as it is.
