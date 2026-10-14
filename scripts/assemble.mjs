/**
 * Appends drafted articles (JSON arrays written by the editor, e.g. work/drafts/*.json) to an issue,
 * creating the issue if needed. Articles whose id is already in the issue are skipped. Title, intro
 * and `hot` are left for the editor to set afterwards.
 *
 *   npm run assemble -- 2026-10-14 work/drafts/a.json work/drafts/b.json
 */
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { ISSUES_DIR } from './dedup.mjs'

const [date, ...files] = process.argv.slice(2)
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !files.length) {
  console.error('Usage: npm run assemble -- <YYYY-MM-DD> <draft.json> [draft.json...]')
  process.exit(1)
}
const path = `${ISSUES_DIR}/${date}.json`
const issue = existsSync(path) ? JSON.parse(await readFile(path, 'utf8')) : { date, title: '', intro: '', articles: [] }
const ids = new Set(issue.articles.map((a) => a.id))
let added = 0
for (const file of files) {
  for (const a of JSON.parse(await readFile(file, 'utf8'))) {
    if (ids.has(a.id)) {
      console.warn(`skip ${a.id}: id already in ${date}`)
      continue
    }
    ids.add(a.id)
    issue.articles.push(a)
    added++
  }
}
await writeFile(path, JSON.stringify(issue, null, 2) + '\n')
console.log(`${path}: +${added} article(s), ${issue.articles.length} in total${issue.title ? '' : ' (title and intro still empty)'}`)
