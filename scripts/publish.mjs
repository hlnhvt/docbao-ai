/**
 * Prunes old issues, checks every issue in public/data/issues and rebuilds public/data/index.json
 * (newest first). Runs before every build, so a malformed issue stops the deploy instead of
 * breaking the site.
 *
 * - Issues older than KEEP_DAYS are deleted; their articles go to data/seen.json.
 * - The same story (same url, discussion or PDF) may appear only once across all issues and
 *   data/seen.json. Very similar English titles are reported as warnings for the editor.
 *
 *   npm run check                 # prune + check + index
 *   npm run check -- --strict     # similar titles are errors too
 */
import { readFile, rm, writeFile } from 'node:fs/promises'
import {
  ISSUES_DIR, KEEP_DAYS, SEEN_DAYS, articleKeys, daysBefore, loadIssues, loadSeen, saveSeen, titleSimilarity, todayVn,
} from './dedup.mjs'

const GROUPS = new Set(['research', 'lab', 'newsletter', 'press', 'community'])
const STRICT = process.argv.includes('--strict')
const SIMILAR = 0.6
const errors = []
const warnings = []
const issues = []

/* ---------- prune ---------- */

const today = todayVn()
const cutoff = daysBefore(today, KEEP_DAYS)
const seen = await loadSeen()
const pruned = []
for (const { file, date, raw } of await loadIssues()) {
  if (date >= cutoff) continue
  try {
    for (const a of JSON.parse(raw).articles ?? []) seen.articles.push({ date, id: a.id, titleEn: a.titleEn, keys: articleKeys(a) })
  } catch {
    // unreadable old issue: nothing to remember, delete it anyway
  }
  await rm(`${ISSUES_DIR}/${file}`)
  pruned.push(date)
}
const seenBefore = seen.articles.length
seen.articles = seen.articles.filter((s) => s.date >= daysBefore(today, SEEN_DAYS))
if (pruned.length || seen.articles.length !== seenBefore) await saveSeen(seen)

/* ---------- check ---------- */

const byKey = new Map()
for (const s of seen.articles) for (const k of s.keys) byKey.set(k, `${s.date}/${s.id} (đã xoá)`)
const titles = seen.articles.map((s) => ({ ref: `${s.date}/${s.id} (đã xoá)`, titleEn: s.titleEn }))

for (const { file, date } of await loadIssues()) {
  let issue
  try {
    issue = JSON.parse(await readFile(`${ISSUES_DIR}/${file}`, 'utf8'))
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
    const ref = `${date}/${a.id}`
    if (!/^[a-z0-9-]+$/.test(a.id ?? '')) err(`${at}: id must be lower-case letters, digits and dashes`)
    if (ids.has(a.id)) err(`${at}: duplicate id`)
    ids.add(a.id)
    if (!GROUPS.has(a.group)) err(`${at}: unknown group "${a.group}"`)
    for (const f of ['source', 'url', 'titleVi', 'titleEn', 'summary', 'publishedAt']) if (!a[f]) err(`${at}: missing ${f}`)
    if (a.url && !/^https?:\/\//.test(a.url)) err(`${at}: url must be http(s)`)
    if (!Array.isArray(a.body) || !a.body.length) err(`${at}: body must be a non-empty list of paragraphs`)
    if (a.keyPoints && !Array.isArray(a.keyPoints)) err(`${at}: keyPoints must be a list`)
    if (a.glossary && !a.glossary.every((g) => g.term && g.explain)) err(`${at}: glossary items need term and explain`)

    for (const k of articleKeys(a)) {
      if (byKey.has(k)) err(`${at}: trùng bài ${byKey.get(k)} (${k})`)
      else byKey.set(k, ref)
    }
    for (const t of titles) {
      const s = titleSimilarity(a.titleEn, t.titleEn)
      if (s >= SIMILAR) (STRICT ? errors : warnings).push(`${file}: ${at}: tiêu đề gần giống ${t.ref} (${s.toFixed(2)}): "${a.titleEn}" ~ "${t.titleEn}"`)
    }
    titles.push({ ref, titleEn: a.titleEn })
  }
  issues.push({ date, title: issue.title, intro: issue.intro ?? '', count: issue.articles?.length ?? 0 })
}

if (pruned.length) console.log(`Pruned ${pruned.length} issue(s) older than ${cutoff}: ${pruned.join(', ')}`)
if (warnings.length) console.warn('Warnings:\n  ' + warnings.join('\n  '))
if (errors.length) {
  console.error('Issue check failed:\n  ' + errors.join('\n  '))
  process.exit(1)
}
await writeFile('public/data/index.json', JSON.stringify({ updated: new Date().toISOString(), issues }, null, 1) + '\n')
console.log(`OK: ${issues.length} issue(s), ${issues.reduce((n, i) => n + i.count, 0)} articles. index.json rebuilt.`)
