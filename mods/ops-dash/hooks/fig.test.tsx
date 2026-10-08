import { test, expect } from 'claude-code/testing'

const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0))
const DIR = '/home/u/.local/share/life/preview'

function world(on: any, read: string[], newest: string[]) {
  on('env.get', (_$: any, e: any) => ({ value: e.name === 'LIFE_ROLE' ? 'ops' : e.name === 'HOME' ? '/home/u' : undefined }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('store.keys', () => ({ value: [] }))
  on('clock.now', () => ({ value: Date.parse('2026-10-08T03:00:00Z') }))
  on('clock.every', () => ({ value: undefined }))
  on('command.register', (_$: any, e: any) => ({ value: { command: e.name } }))
  on('process.run', (_$: any, e: any) => {
    const argv: string[] = e.argv ?? e
    if (argv[0] === '/bin/sh' && argv.includes(DIR)) return { value: { exitCode: 0, stdout: newest.map(n => `${DIR}/${n}`).join('\n') + '\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    if (argv[0] === 'sips') return { value: { exitCode: 0, stdout: 'pixelWidth: 600\n  pixelHeight: 300\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    return { value: { exitCode: 0, stdout: '[]', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('fs.list', () => ({ value: [] }))
  on('fs.read', (_$: any, e: any) => {
    if (e.path.endsWith('.png')) { read.push(e.path); return { value: PNG } }
    return { value: '' }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
}

const OPTIONS = { options: { python: '/usr/bin/python3', life_repo: '/home/u/life' } }
const PROPS = { title: 'fig', isFocused: true, bodyColumns: 84, placement: 'dock', scroll: { bodyRows: 60 }, view: 'expanded' } as any
const settle = () => new Promise(r => setTimeout(r, 30))
const labels = async (ui: any) => (await ui.findAll({ type: 'Button' })).map((b: any) => String(b.props?.label ?? ''))

test('/fig opens the newest draft at once; back lists the palette first, then drafts newest first', OPTIONS as any, async ($, on) => {
  const read: string[] = []
  world(on, read, ['b_new.png', 'a_old.png'])
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true } as any)
  await $.command.run({ command: 'fig', args: '' } as any)
  await settle()
  const ui: any = await $.ui.mount({ plugin: 'ops-dash', surface: 'terminal', component: 'Pane', requestId: 'fig', props: PROPS })
  await settle()
  expect(read).toContain(`${DIR}/b_new.png`)
  expect((await ui.findAll({ type: 'Image' })).length).toBe(1)
  await ui.press({ key: 'back' })
  await settle()
  const list = await labels(ui)
  const i0 = list.findIndex((l: string) => l.startsWith('共通 12 色'))
  expect(i0).toBeGreaterThan(-1)
  expect(i0).toBeLessThan(list.indexOf('b_new.png'))
  expect(list.indexOf('b_new.png')).toBeLessThan(list.indexOf('a_old.png'))
  await ui.press({ key: 'fig-/home/u/life/assets/figstyle/palette.png' })
  await settle()
  expect(read).toContain('/home/u/life/assets/figstyle/palette.png')
  await ui.unmount()
})

test('/fig with no drafts shows the list with the palette and where to put drafts', OPTIONS as any, async ($, on) => {
  world(on, [], [])
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true } as any)
  await $.command.run({ command: 'fig', args: '' } as any)
  await settle()
  const ui: any = await $.ui.mount({ plugin: 'ops-dash', surface: 'terminal', component: 'Pane', requestId: 'fig', props: PROPS })
  const t = (await ui.findAll({ type: 'Text' })).map((x: any) => String(x.text ?? x.props?.children ?? '')).join('\n')
  expect(t).toContain('figstyle.preview')
  expect((await labels(ui)).some((l: string) => l.startsWith('共通 12 色'))).toBe(true)
  await ui.unmount()
})
