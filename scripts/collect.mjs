/**
 * Collects today's candidates from every source, keeps the substantial AI items, scores them and
 * writes work/candidates-<date>.json for the editor (Claude) to pick from.
 *
 *   npm run collect                     # last 36 hours
 *   npm run collect -- --hours 48
 *   npm run collect -- --arxiv "agent,reasoning,speech"   # also scan arXiv for these words
 */
import { XMLParser } from 'fast-xml-parser'
import { mkdir, writeFile } from 'node:fs/promises'
import { SOURCES, AI_RE, DEEP_HOSTS, MEDIA_HOSTS } from './sources.mjs'
import { canonical, publishedList, titleSimilarity, todayVn, daysBefore } from './dedup.mjs'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36'
// Reddit rate-limits browser-like agents on its feeds and asks clients to name themselves
const REDDIT_UA = 'web:docbao-ai:v1.0 (personal news reader)'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i > 0 ? process.argv[i + 1] : fallback
}
const HOURS = Number(arg('--hours', 36))
const SINCE = Date.now() - HOURS * 3600e3
const ARXIV_WORDS = String(arg('--arxiv', '')).split(',').map((w) => w.trim().toLowerCase()).filter(Boolean)
const REDDIT_MIN_CHARS = Number(arg('--reddit-min', 1200))
const HN_MIN_POINTS = Number(arg('--hn-min', 80))
const today = todayVn()

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function get(url, reddit = false) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(url, { headers: { 'User-Agent': reddit ? REDDIT_UA : UA, Accept: '*/*' }, signal: AbortSignal.timeout(25000) })
    if (r.ok) return r.text()
    if (r.status === 429 || r.status >= 500) {
      await sleep(reddit ? 10000 : 2000)
      continue
    }
    throw new Error(`HTTP ${r.status}`)
  }
  throw new Error('gave up after retries')
}

/* ---------- text helpers ---------- */

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' }
const decode = (s) =>
  String(s ?? '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
const stripHtml = (html) =>
  decode(
    String(html ?? '')
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\/(p|div|li|h\d|blockquote|pre|tr)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim()
const text = (x) => (x == null ? '' : typeof x === 'object' ? (x['#text'] ?? '') : String(x))
const host = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}
const matchesHost = (h, list) => list.some((d) => h === d || h.endsWith('.' + d))

/* ---------- parsers ---------- */

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  textNodeName: '#text',
  htmlEntities: true,
  isArray: (name) => ['item', 'entry', 'link', 'category'].includes(name),
})

function parseFeed(body, src) {
  const doc = xml.parse(body)
  const items = doc?.rss?.channel?.item ?? doc?.['rdf:RDF']?.item ?? doc?.feed?.entry ?? []
  return items.map((it, index) => {
    const links = it.link ?? []
    const alt = links.find((l) => typeof l === 'object' && l['@href'] && (!l['@rel'] || l['@rel'] === 'alternate'))
    let url = (alt?.['@href'] ?? text(links[0])).trim()
    const html = text(it['content:encoded']) || text(it.content) || text(it.description) || text(it.summary)
    const date = Date.parse(text(it.pubDate) || text(it.published) || text(it.updated) || text(it['dc:date'])) || Date.now()
    const c = {
      source: src.name, sourceId: src.id, group: src.group,
      title: decode(text(it.title)).trim(), url, publishedAt: new Date(date).toISOString(),
      points: 0, comments: 0, text: '', discussionUrl: null, arxivId: null, rank: index,
    }
    if (src.reddit) {
      const md = /<div class="md">([\s\S]*?)<\/div>\s*<!--/i.exec(decode(html)) ?? /<div class="md">([\s\S]*)<\/div>/i.exec(decode(html))
      const linked = /<a href="([^"]+)">\[link\]<\/a>/.exec(decode(html))?.[1]
      c.text = stripHtml(md?.[1] ?? '')
      c.discussionUrl = url
      if (linked && !/reddit\.com\//.test(linked)) c.url = linked
    } else if (src.arxiv) {
      const t = stripHtml(html)
      if (/Announce Type:\s*replace/i.test(t)) return null
      const id = /arxiv\.org\/abs\/(\d{4}\.\d{4,5})/.exec(url)?.[1]
      c.arxivId = id
      c.url = `https://arxiv.org/abs/${id}`
      c.text = t.replace(/^[\s\S]*?Abstract:\s*/, '')
    } else {
      const t = stripHtml(html)
      c.text = t.length < 20 && /comment/i.test(t) ? '' : t
      const comments = text(it.comments)
      if (/^https?:/.test(comments) && comments !== url) c.discussionUrl = comments
    }
    return c
  }).filter(Boolean)
}

function parseHf(body) {
  return JSON.parse(body).map((o) => {
    const p = o.paper ?? {}
    return {
      source: 'Hugging Face Papers', sourceId: 'hf', group: 'research',
      title: p.title?.trim() ?? '', url: `https://arxiv.org/abs/${p.id}`, arxivId: p.id,
      discussionUrl: `https://huggingface.co/papers/${p.id}`, pdfUrl: `https://arxiv.org/pdf/${p.id}`,
      publishedAt: o.publishedAt ?? p.publishedAt, points: p.upvotes ?? 0, comments: o.numComments ?? 0,
      text: (p.summary ?? '').replace(/\s+/g, ' ').trim(), github: p.githubRepo ?? null,
    }
  })
}

async function fetchHn() {
  const since = Math.floor(SINCE / 1000)
  const url = `https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=200&numericFilters=points%3E${HN_MIN_POINTS}%2Ccreated_at_i%3E${since}`
  const hits = JSON.parse(await get(url)).hits ?? []
  return hits.map((h) => ({
    source: 'Hacker News', sourceId: 'hn', group: 'community',
    title: h.title, url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
    discussionUrl: `https://news.ycombinator.com/item?id=${h.objectID}`,
    publishedAt: h.created_at, points: h.points ?? 0, comments: h.num_comments ?? 0,
    text: stripHtml(h.story_text ?? ''),
  }))
}

/* ---------- filters ---------- */

function keep(c, src) {
  if (!c.title || !c.url) return false
  if (src.kind !== 'hf' && Date.parse(c.publishedAt) < SINCE) return false
  if (src.aiOnly && !AI_RE.test(`${c.title} ${src.kind === 'hn' ? c.url : ''}`)) return false
  if (src.arxiv) {
    if (!ARXIV_WORDS.length) return false
    const t = (c.title + ' ' + c.text).toLowerCase()
    return ARXIV_WORDS.some((w) => t.includes(w))
  }
  if (src.reddit) {
    const h = host(c.url)
    if (c.text.length >= REDDIT_MIN_CHARS) return true
    if (matchesHost(h, MEDIA_HOSTS)) return false
    if (c.url !== c.discussionUrl && matchesHost(h, DEEP_HOSTS)) return true
    const tag = /^\s*\[(R|P|D|N)\]/i.exec(c.title)?.[1]?.toUpperCase()
    if (tag === 'D' && c.text.length >= REDDIT_MIN_CHARS / 2) return true
    return false
  }
  return true
}

/* ---------- run ---------- */

const all = []
const failures = []
let lastReddit = 0
for (const src of SOURCES) {
  if (src.arxiv && !ARXIV_WORDS.length) continue
  try {
    let items
    if (src.kind === 'hf') items = parseHf(await get(src.url))
    else if (src.kind === 'hn') items = await fetchHn()
    else {
      if (src.reddit) {
        const wait = 3000 - (Date.now() - lastReddit)
        if (wait > 0) await sleep(wait)
      }
      try {
        items = parseFeed(await get(src.url, src.reddit), src)
      } finally {
        if (src.reddit) lastReddit = Date.now()
      }
    }
    const kept = items.filter((c) => keep(c, src))
    all.push(...kept)
    console.error(`  ${src.name.padEnd(28)} ${String(items.length).padStart(4)} items, kept ${kept.length}`)
  } catch (e) {
    failures.push(`${src.name}: ${e.message}`)
    console.error(`! ${src.name.padEnd(28)} FAILED ${e.message}`)
  }
}

// Same paper or page in several sources: count the coverage, keep one entry (the richest)
const byKey = new Map()
for (const c of all) {
  const k = c.arxivId ? 'arxiv:' + c.arxivId : canonical(c.url)
  const prev = byKey.get(k)
  if (!prev) byKey.set(k, { ...c, key: k, alsoIn: [] })
  else {
    prev.alsoIn.push({ source: c.source, url: c.discussionUrl ?? c.url, points: c.points, comments: c.comments })
    if (c.text.length > prev.text.length) prev.text = c.text
  }
}

// Already published (live issues or data/seen.json): drop exact matches, flag look-alike titles
const published = await publishedList()
const publishedKeys = new Map(published.flatMap((p) => p.keys.map((k) => [k, p.ref])))
let dropped = 0
const fresh = [...byKey.values()].filter((c) => {
  const keys = [c.key, c.discussionUrl && canonical(c.discussionUrl), ...c.alsoIn.map((x) => canonical(x.url))].filter(Boolean)
  if (keys.some((k) => publishedKeys.has(k))) return dropped++, false
  let best = { score: 0 }
  for (const p of published) {
    const score = titleSimilarity(c.title, p.titleEn)
    if (score > best.score) best = { score, ref: p.ref, title: p.titleEn }
  }
  if (best.score >= 0.4) c.similarTo = { ...best, score: Math.round(best.score * 100) / 100 }
  return true
})

const now = Date.now()
const candidates = fresh.map((c) => {
  const ageH = (now - Date.parse(c.publishedAt)) / 3600e3
  const pts = c.sourceId === 'hn' ? Math.min(c.points / 100, 4) : c.sourceId === 'hf' ? Math.min(c.points / 15, 4) : 0
  const reddit = c.group === 'community' && c.rank != null ? Math.max(0, 2 - c.rank / 5) : 0
  const score = 1 + 2.5 * c.alsoIn.length + pts + reddit + 2 * Math.max(0, 1 - ageH / 48)
  return { ...c, score: Math.round(score * 10) / 10, text: c.text.slice(0, 4000) }
})
candidates.sort((a, b) => a.group.localeCompare(b.group) || b.score - a.score)

await mkdir('work', { recursive: true })
const out = `work/candidates-${today}.json`
await writeFile(out, JSON.stringify({ date: today, hours: HOURS, failures, candidates }, null, 1))
// Titles of the last 7 days, for the editor to spot the same event told by another source
const recent = published.filter((p) => p.date >= daysBefore(today, 7) && p.titleVi)
await writeFile('work/published-recent.txt', recent.map((p) => `${p.ref} | ${p.titleVi} | ${p.titleEn}`).join('\n') + '\n')

console.log(`\n${candidates.length} candidates -> ${out}${failures.length ? `\nFailed: ${failures.join('; ')}` : ''}\n`)
let group = ''
candidates.forEach((c, i) => {
  if (c.group !== group) console.log(`\n== ${(group = c.group).toUpperCase()} ==`)
  const meta = [c.points ? `▲${c.points}` : '', c.comments ? `${c.comments}c` : '', c.alsoIn.length ? `+${c.alsoIn.map((x) => x.source).join('+')}` : ''].filter(Boolean).join(' ')
  const similar = c.similarTo ? ` ≈ĐÃ ĐĂNG? ${c.similarTo.ref} (${c.similarTo.score})` : ''
  console.log(`[${i}] ${c.score.toFixed(1).padStart(4)} ${c.source} ${meta} | ${c.title.slice(0, 110)} (${c.text.length}c)${similar}`)
})
