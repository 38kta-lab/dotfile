import { test, expect } from 'claude-code/testing'
import { latestTrendFile, parseTrend, shortSource, starText, topItems } from './trend'

const MD = `# Search Trend: 2026-10-07

## 実行条件

- 対象日: 2026-10-07

## 論文・プレプリント

### PubMed

| 原文タイトル | タイトル訳 | 興味度 | カテゴリ |
|---|---|---|---|
| [Light sensing in a model alga.](https://example.org/p/1) | モデル藻類の光感知 | ★★★★☆ | #photoreceptor |
| [A review of something else.](https://example.org/p/2) | 別の総説 | ☆☆☆☆☆ | #misc |
| [Pigments a \\| b.](https://example.org/p/3) | 色素 a \\| b | ★★☆☆☆ | #pigment |

### bioRxiv（Europe PMC 経由）

| 原文タイトル | タイトル訳 | 興味度 | カテゴリ |
|---|---|---|---|
| [A preprint on enzymes](https://example.org/b/1) | 酵素のプレプリント | ★★★★☆ | #enzyme |

## 科学ニュース

### Nature News

| 原文タイトル | タイトル訳 | 興味度 |
|---|---|---|
| [Lab meetings in silence](https://example.org/n/1) | 沈黙のラボミーティング | ★★★☆☆ |
| [Blend](https://example.org/n/2) | Blend | ☆☆☆☆☆ |
`

test('parseTrend reads every linked row under its source, with stars and category', () => {
  const t = parseTrend(MD)
  expect(t.date).toBe('2026-10-07')
  expect(t.items.length).toBe(6)
  expect(t.items[0]).toMatchObject({ source: 'PubMed', short: 'PM', title: 'Light sensing in a model alga.', url: 'https://example.org/p/1', ja: 'モデル藻類の光感知', stars: 4, category: '#photoreceptor' })
  expect(t.items[2].ja).toBe('色素 a | b')
  expect(t.items[3].short).toBe('bR')
  expect(t.items[4]).toMatchObject({ short: 'Nat', stars: 3, category: '' })
  expect(t.items.filter(x => x.stars === 0).length).toBe(2)
})

test('topItems: highest first, ties keep the file order; helpers', () => {
  const top = topItems(parseTrend(MD).items, 3).map(x => x.ja)
  expect(top).toEqual(['モデル藻類の光感知', '酵素のプレプリント', '沈黙のラボミーティング'])
  expect(starText(2)).toBe('★★☆☆☆')
  expect(shortSource('ナゾロジー（自然科学）')).toBe('ナゾ')
  expect(latestTrendFile(['2026-10-06-trend.md', '2026-10-07-trend.md', '2026-10-07-digest.md', 'index.md'])).toBe('2026-10-07-trend.md')
})

function world(on: any, copied: string[], files?: Map<string, string>) {
  on('env.get', (_$: any, e: any) => ({ value: e.name === 'LIFE_ROLE' ? 'ops' : undefined }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('store.keys', () => ({ value: [] }))
  on('clock.now', () => ({ value: Date.parse('2026-10-08T03:00:00Z') }))
  on('clock.every', () => ({ value: undefined }))
  on('command.register', (_$: any, e: any) => ({ value: { command: e.name } }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: '[]', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('fs.list', (_$: any, e: any) => ({ value: e.path.endsWith('ideas/daily/md') ? [{ name: '2026-10-06-trend.md', kind: 'file', size: 1 }, { name: '2026-10-07-trend.md', kind: 'file', size: 1 }] : [] }))
  on('fs.read', (_$: any, e: any) => {
    if (files?.has(e.path)) return { value: files.get(e.path) }
    if (e.path.endsWith('2026-10-07-trend.md')) return { value: MD }
    if (e.path.endsWith('2026-10-06-trend.md')) return { value: OLD }
    if (files) throw new Error('ENOENT')
    return { value: '' }
  })
  on('fs.write', (_$: any, e: any) => { files?.set(e.path, e.text); return { value: undefined } })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.copy', (_$: any, e: any) => { copied.push(e.text); return { value: { isCopied: true } } })
  on('ui.status', () => ({ value: undefined }))
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
}

const OPTIONS = { options: { python: '/usr/bin/python3', life_repo: '/home/u/life' } }
const PROPS = { title: 'ops-dash', isFocused: true, bodyColumns: 58, placement: 'dock', scroll: { bodyRows: 80 }, view: 'expanded' } as any
const settle = () => new Promise(r => setTimeout(r, 20))
const texts = async (ui: any) => (await ui.findAll({ type: 'Text' })).map((t: any) => String(t.text ?? t.props?.children ?? '')).join('\n')
const labels = async (ui: any) => (await ui.findAll({ type: 'Button' })).map((b: any) => String(b.props?.label ?? ''))

test('the dash shows the top 5 of the newest trend as buttons; a press shows the detail and copies the link', OPTIONS as any, async ($, on) => {
  const copied: string[] = []
  world(on, copied)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true } as any)
  await settle()
  const ui: any = await $.ui.mount({ plugin: 'ops-dash', surface: 'terminal', component: 'Pane', requestId: 'peers', props: PROPS })
  await settle()
  expect(await texts(ui)).toContain('trend 10/07（6 件・★3 以上 3 件）')
  const rows = (await ui.findAll({ type: 'Button' })).filter((b: any) => String(b.key ?? '').startsWith('trend-') && b.key !== 'trend-all')
  expect(rows.length).toBe(5)
  expect(String(rows[0].props.label)).toContain('モデル藻類の光感知')
  expect(String(rows[0].props.label)).toContain('PM')

  await ui.press({ key: rows[0].key })
  await settle()
  const detail = await texts(ui)
  expect(detail).toContain('Light sensing in a model alga.')
  expect(detail).toContain('https://example.org/p/1')
  expect(detail).toContain('★★★★☆')
  await ui.press({ key: 'copy-url' })
  await settle()
  expect(copied).toEqual(['https://example.org/p/1'])
  await ui.press({ key: 'back' })
  await settle()

  await ui.press({ key: 'trend-all' })
  await settle()
  const all = await labels(ui)
  expect(all.filter((l: string) => l.includes('☆☆☆☆☆')).length).toBe(2)
  await ui.press({ key: 'filter' })
  await settle()
  expect((await labels(ui)).filter((l: string) => /^★/.test(l)).length).toBe(3)
  await ui.unmount()
})


const OLD = MD.replace('2026-10-07', '2026-10-06').replace('モデル藻類の光感知', '前の日の論文')
const LIST = '/home/u/life/ideas/to-read.md'

test('読みたい appends the paper to ideas/to-read.md once; a paper already there says so', OPTIONS as any, async ($, on) => {
  const files = new Map<string, string>()
  world(on, [], files)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true } as any)
  await settle()
  const ui: any = await $.ui.mount({ plugin: 'ops-dash', surface: 'terminal', component: 'Pane', requestId: 'peers', props: PROPS })
  await settle()
  const rows = () => ui.findAll({ type: 'Button' }).then((bs: any[]) => bs.filter((b: any) => String(b.key ?? '').startsWith('trend-') && b.key !== 'trend-all'))
  await ui.press({ key: (await rows())[0].key })
  await settle()
  await ui.press({ key: 'want' })
  await settle()
  const md = files.get(LIST) ?? ''
  expect(md.startsWith('# 読みたい')).toBe(true)
  expect(md).toContain('- ⬜ 2026-10-08 ★★★★ [モデル藻類の光感知](https://example.org/p/1) — Light sensing in a model alga.（PubMed・trend 2026-10-07）')
  expect(await texts(ui)).toContain('読みたいリスト（ideas/to-read.md）に入れました')
  await ui.press({ key: 'back' })
  await settle()
  await ui.press({ key: (await rows())[0].key })
  await settle()
  expect(await texts(ui)).toContain('読みたいリストに入っています')
  expect(await labels(ui)).not.toContain('読みたい')
  expect((files.get(LIST) ?? '').split('\n').filter(l => l.startsWith('- ⬜')).length).toBe(1)
  await ui.unmount()
})

test('from the full list, p lists past days and a day opens its own list', OPTIONS as any, async ($, on) => {
  world(on, [], new Map())
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true } as any)
  await settle()
  const ui: any = await $.ui.mount({ plugin: 'ops-dash', surface: 'terminal', component: 'Pane', requestId: 'peers', props: PROPS })
  await settle()
  await ui.press({ key: 'trend-all' })
  await settle()
  await ui.press({ key: 'past' })
  await settle()
  const days = await labels(ui)
  expect(days.indexOf('2026-10-07')).toBeGreaterThan(-1)
  expect(days.indexOf('2026-10-07')).toBeLessThan(days.indexOf('2026-10-06'))
  await ui.press({ key: 'day-2026-10-06-trend.md' })
  await settle()
  expect(await texts(ui)).toContain('trend 2026-10-06')
  expect((await labels(ui)).some((l: string) => l.includes('前の日の論文'))).toBe(true)
  await ui.unmount()
})
