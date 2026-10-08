import { test, expect } from 'claude-code/testing'
import { parseHub, nextMilestone, openActions, sectionMarkdown } from './hubs'

const NOW = Date.parse('2026-10-08T03:00:00Z')

const ALPHA = `---
summary: "Alpha project"
created: 2026-09-01
updated: 2026-10-08
status: active
related: [projects/active/12_B_beta.md]
---

# Alpha (11_A)

## Milestones

| Date | Milestone | Required State |
|---|---|---|
| 2026-10-02 | kickoff | ✅ |
| ~~2026-10-09~~ | ~~old deadline~~ | moved |
| **2026-10-21 (水)** | **abstract** | draft done |
| 2026-12-11 | submit | — |

## Current State (2026-09-20)

old state

## Current State (2026-10-08)

new state

## Next Actions

- ⬜ first
- ✅ done one
- ⬜ second

\`\`\`
## not a section
\`\`\`
`

const BETA = `---
updated: 2026-09-28
status: pending
---

# Beta

## Notes

nothing else
`

test('parse: nearest future milestone, struck rows ignored, open actions, related, last Current State', () => {
  const h = parseHub('11_A_alpha', ALPHA, NOW)
  expect(h.status).toBe('active')
  expect(h.daysSinceUpdate).toBe(0)
  expect(h.next).toEqual({ date: '10/21', label: 'abstract', daysLeft: 13 })
  expect(h.openNext).toBe(2)
  expect(h.related).toEqual(['12_B_beta'])
  expect(h.sections.map(s => s.name)).not.toContain('not a section')
  expect(sectionMarkdown(h, 0)).toContain('new state')
  expect(sectionMarkdown(h, 0)).not.toContain('old state')
  expect(sectionMarkdown(h, 4)).toContain('節がありません')
})

test('parse: a hub without milestones or actions', () => {
  const h = parseHub('12_B_beta', BETA, NOW)
  expect(h.next).toBeUndefined()
  expect(h.openNext).toBe(0)
  expect(h.daysSinceUpdate).toBe(10)
})

test('a very long section is cut with a note', () => {
  const long = parseHub('x', `---\nstatus: active\n---\n# X\n\n## Current State\n\n${'あ'.repeat(120000)}\n`, NOW)
  const md = sectionMarkdown(long, 0)
  expect(md.length).toBeLessThan(91000)
  expect(md).toContain('先頭 90,000 字まで')
})

test('milestone helpers on their own', () => {
  expect(nextMilestone('| 2026-10-07 | past |\n| 2026-10-08 | today |', NOW)?.daysLeft).toBe(0)
  expect(openActions('1. ⬜ a\n2. ✅ b\n- [ ] c')).toBe(2)
})

function world(on: any) {
  on('env.get', (_$: any, e: any) => ({ value: e.name === 'LIFE_ROLE' ? 'ops' : undefined }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('store.keys', () => ({ value: [] }))
  on('clock.now', () => ({ value: NOW }))
  on('clock.every', () => ({ value: undefined }))
  on('command.register', (_$: any, e: any) => ({ value: { command: e.name } }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: '[]', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('fs.list', () => ({ value: [{ name: '11_A_alpha.md', kind: 'file', size: 1 }, { name: '12_B_beta.md', kind: 'file', size: 1 }, { name: 'README.md', kind: 'file', size: 1 }] }))
  on('fs.read', (_$: any, e: any) => ({ value: e.path.endsWith('11_A_alpha.md') ? ALPHA : e.path.endsWith('12_B_beta.md') ? BETA : '' }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
}

const OPTIONS = { options: { python: '/usr/bin/python3', life_repo: '/home/u/life' } }
const PROPS = { title: 'hubs', isFocused: true, bodyColumns: 84, placement: 'dock', scroll: { bodyRows: 60 }, view: 'expanded' } as any
const texts = async (ui: any) => (await ui.findAll({ type: 'Text' })).map((t: any) => String(t.text ?? t.props?.children ?? '')).join('\n')
const labels = async (ui: any) => (await ui.findAll({ type: 'Button' })).map((b: any) => String(b.props?.label ?? b.label ?? ''))

test('list → open a hub → switch tab → follow related → back → back to list', OPTIONS as any, async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true } as any)
  await $.command.run({ command: 'hubs', args: '' } as any)
  const ui: any = await $.ui.mount({ plugin: 'ops-dash', surface: 'terminal', component: 'Pane', requestId: 'hubs', props: PROPS })

  const list = (await labels(ui)).join('\n')
  expect(list).toContain('11_A')
  expect(list).toContain('★10/21 13日')
  expect(list).toContain('次2')
  expect(list.indexOf('11_A')).toBeLessThan(list.indexOf('12_B'))
  expect(list).not.toContain('README')

  await $.ui.press({ plugin: 'ops-dash', key: 'hub-11_A_alpha' })
  expect(await texts(ui)).toContain('Alpha (11_A)')
  expect(JSON.stringify(await ui.findAll({ type: 'Markdown' }))).toContain('new state')

  await $.ui.press({ plugin: 'ops-dash', key: 'tab-3' })
  expect(JSON.stringify(await ui.findAll({ type: 'Markdown' }))).toContain('second')

  await $.ui.press({ plugin: 'ops-dash', key: 'rel-12_B_beta' })
  expect(await texts(ui)).toContain('Beta')
  expect(await labels(ui)).toContain('← 戻る')

  await $.ui.press({ plugin: 'ops-dash', key: 'back' })
  expect(await texts(ui)).toContain('Alpha (11_A)')
  await $.ui.press({ plugin: 'ops-dash', key: 'back' })
  expect((await labels(ui)).join('\n')).toContain('12_B')
})
