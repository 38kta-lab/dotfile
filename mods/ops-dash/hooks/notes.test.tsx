import { test, expect } from 'claude-code/testing'
import { base64, entryLines, frontValue, imageRows, pngList, tocRows } from './notes'

const NOTE = `# Sample note

<!-- TOC:START -->
## 目次（自動生成）

| 番号 | 日付 | 題 | 結論 | 状態 |
|---|---|---|---|---|
| KM_Z0001 | 日付未記載 | 最初の解析 | 未記載 | 要確認 |
| KM_Z0002 | 2026-10-05 | 二つ目 a \\| b | 一致した | 確定 |
<!-- TOC:END -->

## KM_Z0001 — 最初の解析（日付未記載）
- 問い: 一つ目の問い

## KM_Z0002 — 二つ目 a \\| b（2026-10-05）
- 問い: 二つは一致するか
- 結論: 一致した
- 状態: 確定

### 実行
- script/sample.py

### 結果
- 一致率 100 %

## 別の節
- ここは含めない
`

const HUB = `---
summary: "sample"
updated: 2026-10-08
status: active
nas_code: /data/x/_repos/21_Q_sample
nas_data: /data/x/q_sample  # 図の正本は別
---

# Sample (21_Q)
`

test('tocRows reads the table between the markers, an escaped bar kept in its cell', () => {
  const rows = tocRows(NOTE)
  expect(rows.map(r => r.id)).toEqual(['KM_Z0001', 'KM_Z0002'])
  expect(rows[1]).toEqual({ id: 'KM_Z0002', date: '2026-10-05', title: '二つ目 a | b', conclusion: '一致した', state: '確定' })
  expect(tocRows('# no toc')).toEqual([])
})

test('entryLines: the lines under one number, without its heading or the next section', () => {
  const body = entryLines(NOTE, 'KM_Z0002')
  expect(body[0]).toBe('- 問い: 二つは一致するか')
  expect(body).toContain('### 結果')
  expect(body.join('\n')).not.toContain('ここは含めない')
  expect(body.join('\n')).not.toContain('一つ目の問い')
  expect(entryLines(NOTE, 'KM_Z0009')).toEqual([])
})

test('frontValue drops the inline comment', () => {
  expect(frontValue(HUB, 'nas_data')).toBe('/data/x/q_sample')
  expect(frontValue(HUB, 'nas_code')).toBe('/data/x/_repos/21_Q_sample')
  expect(frontValue(HUB, 'missing')).toBeUndefined()
})

test('pngList keeps pictures under the folder, relative and sorted', () => {
  const out = '/d/KM_Z0002/out/b.png\n/d/KM_Z0002/a.PNG\n/d/KM_Z0002/log.txt\n/elsewhere/c.png\n'
  expect(pngList(out, '/d/KM_Z0002')).toEqual(['a.PNG', 'out/b.png'])
})

test('imageRows keeps the aspect, cells being about twice as tall as wide', () => {
  expect(imageRows(800, 400, 80)).toBe(20)
  expect(imageRows(400, 4000, 80)).toBe(40)
  expect(imageRows(0, 0, 80)).toBe(40)
})

test('base64 is the standard padded form', () => {
  expect(base64(new Uint8Array([104, 105]))).toBe('aGk=')
  expect(base64(new Uint8Array([104, 105, 33]))).toBe('aGkh')
})

// a tiny real PNG (1×1), as bytes
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0))

function world(on: any, runs: string[][]) {
  on('env.get', (_$: any, e: any) => ({ value: e.name === 'LIFE_ROLE' ? 'ops' : undefined }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('store.keys', () => ({ value: [] }))
  on('clock.now', () => ({ value: Date.parse('2026-10-08T03:00:00Z') }))
  on('clock.every', () => ({ value: undefined }))
  on('command.register', (_$: any, e: any) => ({ value: { command: e.name } }))
  on('process.run', (_$: any, e: any) => {
    runs.push(e.argv ?? e)
    const argv: string[] = e.argv ?? e
    if (argv[0] === 'awk' && argv[1] === '-v') return { value: { exitCode: 0, stdout: NOTE.slice(NOTE.indexOf('## ' + argv[2].slice(3) + ' — ')), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    if (argv[0] === 'awk') return { value: { exitCode: 0, stdout: argv[2] === '/data/x/_repos/21_Q_sample/note/note.md' ? NOTE : '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    if (argv[0] === '/bin/sh' || argv[0] === 'find') return { value: { exitCode: 0, stdout: '/data/x/q_sample/KM_Z0002/out/fig1.png\n/data/x/q_sample/KM_Z0002/out/fig2.png\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    if (argv[0] === 'sips') return { value: { exitCode: 0, stdout: 'pixelWidth: 800\n  pixelHeight: 400\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    return { value: { exitCode: 0, stdout: '[]', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('fs.list', () => ({ value: [{ name: '21_Q_sample.md', kind: 'file', size: 1 }, { name: '22_R_other.md', kind: 'file', size: 1 }] }))
  on('fs.read', (_$: any, e: any) => {
    if (e.path.endsWith('21_Q_sample.md')) return { value: HUB }
    if (e.path.endsWith('22_R_other.md')) return { value: '---\nstatus: active\n---\n# Other\n' }
    if (e.path === '/data/x/_repos/21_Q_sample/note/note.md') return { value: NOTE }
    if (e.path.endsWith('.png')) return { value: PNG }
    throw new Error('ENOENT')
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
}

const OPTIONS = { options: { python: '/usr/bin/python3', life_repo: '/home/u/life' } }
const PROPS = { title: 'notes', isFocused: true, bodyColumns: 84, placement: 'dock', scroll: { bodyRows: 60 }, view: 'expanded' } as any
const labels = async (ui: any) => (await ui.findAll({ type: 'Button' })).map((b: any) => String(b.props?.label ?? ''))
const texts = async (ui: any) => (await ui.findAll({ type: 'Text' })).map((t: any) => String(t.text ?? t.props?.children ?? '')).join('\n')
const settle = () => new Promise(r => setTimeout(r, 20))

test('notes: project → contents → pictures of a number → one picture, and back', OPTIONS as any, async ($, on) => {
  const runs: string[][] = []
  world(on, runs)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true } as any)
  await $.command.run({ command: 'notes', args: '' } as any)
  const ui: any = await $.ui.mount({ plugin: 'ops-dash', surface: 'terminal', component: 'Pane', requestId: 'notes', props: PROPS })

  await settle()
  const list = await labels(ui)
  expect(list.some((l: string) => l.startsWith('21_Q'))).toBe(true)
  expect(list.some((l: string) => l.startsWith('22_R'))).toBe(false)
  expect(runs.some(r => r[0] === 'awk')).toBe(false)

  await $.ui.press({ plugin: 'ops-dash', key: 'pj-21_Q_sample' })
  await settle()
  expect(runs.some(r => r[0] === 'awk')).toBe(true)
  const toc = await labels(ui)
  expect(toc.some((l: string) => l.includes('Z0001') && l.includes('最初の解析'))).toBe(true)
  expect(toc.some((l: string) => l.includes('Z0002') && l.includes('10/05'))).toBe(true)

  await $.ui.press({ plugin: 'ops-dash', key: 'toc-KM_Z0002' })
  await settle()
  expect(runs.some(r => r[0] === '/bin/sh' && r.includes('/data/x/q_sample/KM_Z0002'))).toBe(true)
  expect(runs.some(r => r[0] === 'find')).toBe(false)
  expect(await labels(ui)).toContain('下の階層も探す（遅い）')
  expect(await labels(ui)).toContain('out/fig1.png')
  expect(await texts(ui)).toContain('結論: 一致した')
  const md = (await ui.findAll({ type: 'Markdown' })).map((m: any) => String(m.props?.text ?? '')).join('\n')
  expect(md).toContain('二つは一致するか')
  expect(md).toContain('一致率 100 %')
  expect(md).not.toContain('ここは含めない')

  await $.ui.press({ plugin: 'ops-dash', key: 'png-out/fig1.png' })
  await settle()
  const images = await ui.findAll({ type: 'Image' })
  expect(images.length).toBe(1)
  expect(images[0].props.rows).toBe(Math.round((82 * 400) / 800 / 2))
  expect(await texts(ui)).toContain('800 × 400 px')

  await $.ui.press({ plugin: 'ops-dash', key: 'back' })
  expect(await labels(ui)).toContain('out/fig2.png')
  await $.ui.press({ plugin: 'ops-dash', key: 'back' })
  expect((await labels(ui)).some((l: string) => l.includes('Z0001'))).toBe(true)
  await $.ui.press({ plugin: 'ops-dash', key: 'back' })
  expect((await labels(ui)).some((l: string) => l.startsWith('21_Q'))).toBe(true)
  await ui.unmount()
})
