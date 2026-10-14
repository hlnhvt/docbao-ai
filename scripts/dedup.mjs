/**
 * What has already been published, so collect.mjs can hide it and publish.mjs can refuse repeats.
 * Live issues are in public/data/issues; articles of pruned issues are kept in data/seen.json
 * (keys and titles only), so a story stays "already published" after its issue is deleted.
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'

export const ISSUES_DIR = 'public/data/issues'
export const SEEN_FILE = 'data/seen.json'
/** Issues older than this many days (Vietnam date) are deleted. */
export const KEEP_DAYS = 45
/** Pruned articles are remembered this long. */
export const SEEN_DAYS = 365

export const todayVn = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
export const daysBefore = (date, days) => new Date(Date.parse(date + 'T00:00:00Z') - days * 864e5).toISOString().slice(0, 10)

export const canonical = (u) => {
  const m = /arxiv\.org\/(?:abs|pdf|html)\/(\d{4}\.\d{4,5})/.exec(u) ?? /huggingface\.co\/papers\/(\d{4}\.\d{4,5})/.exec(u)
  if (m) return 'arxiv:' + m[1]
  return String(u).toLowerCase().replace(/#.*$/, '').replace(/\?(?!id=).*$/, '').replace(/^https?:\/\/(www\.|m\.|old\.)?/, '').replace(/\/$/, '')
}

/** Every key that identifies an article's story: its page, discussion thread and PDF. */
export const articleKeys = (a) => [...new Set([a.url, a.discussionUrl, a.pdfUrl].filter(Boolean).map(canonical))]

const STOP = new Set(
  'a an the and or of to in on for with by from at as is are was were be been it its this that these those how why what when who new now just your you we our their his her than into about over after vs via'.split(' '),
)
const words = (t) =>
  new Set(
    String(t ?? '')
      .toLowerCase()
      .replace(/[’'`]s\b/g, '')
      .split(/[^\p{L}\p{N}.]+/u)
      .map((w) => w.replace(/^\.+|\.+$/g, ''))
      .filter((w) => w && !STOP.has(w)),
  )
/** Jaccard similarity of the meaningful words of two titles, 0..1. */
export function titleSimilarity(x, y) {
  const a = words(x)
  const b = words(y)
  if (!a.size || !b.size) return 0
  let n = 0
  for (const w of a) if (b.has(w)) n++
  return n / (a.size + b.size - n)
}

export async function loadIssues() {
  const files = (await readdir(ISSUES_DIR)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse()
  const out = []
  for (const file of files) out.push({ file, date: file.slice(0, 10), raw: await readFile(`${ISSUES_DIR}/${file}`, 'utf8') })
  return out
}

export async function loadSeen() {
  try {
    return JSON.parse(await readFile(SEEN_FILE, 'utf8'))
  } catch {
    return { articles: [] }
  }
}

export async function saveSeen(seen) {
  await mkdir('data', { recursive: true })
  const lines = seen.articles.map((s) => JSON.stringify(s))
  await writeFile(SEEN_FILE, `{"articles": [\n${lines.join(',\n')}\n]}\n`)
}

/** Flat list of everything published: { ref: "date/id", date, titleEn, titleVi, keys }. */
export async function publishedList() {
  const list = []
  for (const { date, raw } of await loadIssues()) {
    let issue
    try {
      issue = JSON.parse(raw)
    } catch {
      continue
    }
    for (const a of issue.articles ?? []) list.push({ ref: `${date}/${a.id}`, date, titleEn: a.titleEn, titleVi: a.titleVi, keys: articleKeys(a) })
  }
  for (const s of (await loadSeen()).articles) list.push({ ...s, ref: `${s.date}/${s.id}` })
  return list
}
