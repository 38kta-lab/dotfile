// Reading the daily search-trend digest (ideas/daily/md/YYYY-MM-DD-trend.md):
// tables of papers and news, each row a linked original title, its Japanese
// rendering and an interest rating in stars. Pure functions: the tests feed
// them text.

export type TrendItem = {
  source: string // the "### " heading the table sits under
  short: string // a few letters for the one-line view
  title: string
  url: string
  ja: string
  stars: number
  category: string
  order: number // position in the file, for stable sorting
}

export type Trend = { date: string; items: TrendItem[] }

const SHORT: [RegExp, string][] = [
  [/pubmed/i, 'PM'],
  [/biorxiv|europe\s*pmc/i, 'bR'],
  [/nature/i, 'Nat'],
  [/science|aaas/i, 'Sci'],
  [/ナゾロジー/, 'ナゾ'],
]

export function shortSource(source: string): string {
  return SHORT.find(([r]) => r.test(source))?.[1] ?? source.slice(0, 4)
}

const cellsOf = (row: string) =>
  row.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'))

export function parseTrend(md: string): Trend {
  const date = md.match(/^# .*?(\d{4}-\d{2}-\d{2})/m)?.[1] ?? ''
  const items: TrendItem[] = []
  let source = ''
  for (const line of md.split('\n')) {
    const h = line.match(/^###\s+(.+)$/)
    if (h) {
      source = h[1].trim()
      continue
    }
    if (!source || !line.trim().startsWith('|') || /^\|\s*-/.test(line.trim())) continue
    const c = cellsOf(line)
    const link = c[0]?.match(/^\[(.+)\]\((\S+)\)$/)
    if (!link) continue // the header row and anything else without a linked title
    items.push({
      source,
      short: shortSource(source),
      title: link[1],
      url: link[2],
      ja: c[1] ?? '',
      stars: (c[2]?.match(/★/g) ?? []).length,
      category: c[3] ?? '',
      order: items.length,
    })
  }
  return { date, items }
}

// Highest rated first; equal ratings keep the file's order.
export function topItems(items: readonly TrendItem[], n: number): TrendItem[] {
  return [...items].sort((a, b) => b.stars - a.stars || a.order - b.order).slice(0, n)
}

export function starText(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n))
}

// The newest "YYYY-MM-DD-trend.md" among file names.
export function latestTrendFile(names: readonly string[]): string | undefined {
  return names.filter(n => /^\d{4}-\d{2}-\d{2}-trend\.md$/.test(n)).sort().pop()
}
