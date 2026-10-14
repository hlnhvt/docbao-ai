/**
 * Checks every issue in public/data/issues and rebuilds public/data/index.json (newest first).
 * Runs before every build, so a malformed issue stops the deploy instead of breaking the site.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'

const DIR = 'public/data/issues'
const GROUPS = new Set(['research', 'lab', 'newsletter', 'press', 'community'])
const errors = []
const issues = []

for (const file of (await readdir(DIR)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse()) {
  const date = file.slice(0, 10)
  let issue
  try {
    issue = JSON.parse(await readFile(`${DIR}/${file}`, 'utf8'))
  } catch (e) {
    errors.push(`${file}: invalid JSON (${e.message})`)
    continue
  }
  const err = (m) => errors.push(`${file}: ${m}`)
  if (issue.date !== date) err(`date "${issue.date}" does not match the file name`)
  if (!issue.title) err('missing title')
  if (!Array.isArray(issue.articles) || !issue.articles.length) err('no articles')
  const ids = new Set()
  for (const [i, a] of (issue.articles ?? []).entries()) {
    const at = `article ${i} (${a.id ?? '?'})`
    if (!/^[a-z0-9-]+$/.test(a.id ?? '')) err(`${at}: id must be lower-case letters, digits and dashes`)
    if (ids.has(a.id)) err(`${at}: duplicate id`)
    ids.add(a.id)
    if (!GROUPS.has(a.group)) err(`${at}: unknown group "${a.group}"`)
    for (const f of ['source', 'url', 'titleVi', 'titleEn', 'summary', 'publishedAt']) if (!a[f]) err(`${at}: missing ${f}`)
    if (a.url && !/^https?:\/\//.test(a.url)) err(`${at}: url must be http(s)`)
    if (!Array.isArray(a.body) || !a.body.length) err(`${at}: body must be a non-empty list of paragraphs`)
    if (a.keyPoints && !Array.isArray(a.keyPoints)) err(`${at}: keyPoints must be a list`)
    if (a.glossary && !a.glossary.every((g) => g.term && g.explain)) err(`${at}: glossary items need term and explain`)
  }
  issues.push({ date, title: issue.title, intro: issue.intro ?? '', count: issue.articles?.length ?? 0 })
}

if (errors.length) {
  console.error('Issue check failed:\n  ' + errors.join('\n  '))
  process.exit(1)
}
await writeFile('public/data/index.json', JSON.stringify({ updated: new Date().toISOString(), issues }, null, 1) + '\n')
console.log(`OK: ${issues.length} issue(s), ${issues.reduce((n, i) => n + i.count, 0)} articles. index.json rebuilt.`)
