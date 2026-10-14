/**
 * Downloads pages and extracts their readable text (Mozilla Readability), for the editor to read
 * before writing the Vietnamese version. Output: work/text/<host>-<slug>.md, one file per URL
 * (named from the URL, so several runs at once do not overwrite each other).
 *
 *   npm run text -- https://example.com/post https://arxiv.org/html/2610.12345
 */
import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import { mkdir, writeFile } from 'node:fs/promises'
import { lookup } from 'node:dns/promises'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36'
const urls = process.argv.slice(2).filter((u) => /^https?:\/\//.test(u))
if (!urls.length) {
  console.error('Usage: npm run text -- <url> [url...]')
  process.exit(1)
}
await mkdir('work/text', { recursive: true })

const BLOCKS = 'h1,h2,h3,h4,p,li,pre,blockquote,figcaption,td'

const fileName = (url) => {
  const u = new URL(url)
  const slug = (u.pathname + u.search).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(-60) || 'index'
  return `work/text/${u.hostname.replace(/^www\./, '')}-${slug}.md`
}

// Pages are summarised onto a public site, so never read anything from the local or company network
const INTERNAL_HOST = /^(localhost|.*\.(local|internal|intranet|corp|lan|home)|(.*\.)?(fpt\.com|fpt\.net|fpt\.vn|fis\.com\.vn))$/i
const PRIVATE_IP = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|::1$|f[cd][0-9a-f]{2}:|fe80:)/i
async function assertPublic(url) {
  const { hostname, protocol } = new URL(url)
  if (!/^https?:$/.test(protocol)) throw new Error(`blocked protocol ${protocol}`)
  if (!hostname.includes('.') || INTERNAL_HOST.test(hostname)) throw new Error(`blocked internal host ${hostname}`)
  for (const { address } of await lookup(hostname.replace(/^\[|\]$/g, ''), { all: true }))
    if (PRIVATE_IP.test(address)) throw new Error(`blocked ${hostname}: resolves to private address ${address}`)
}
async function fetchPublic(url) {
  for (let hop = 0; hop < 5; hop++) {
    await assertPublic(url)
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'manual', signal: AbortSignal.timeout(30000) })
    const next = r.status >= 300 && r.status < 400 && r.headers.get('location')
    if (!next) return r
    url = new URL(next, url).href
  }
  throw new Error('too many redirects')
}

for (const url of urls) {
  const name = fileName(url)
  try {
    const r = await fetchPublic(url)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const html = await r.text()
    const { document } = parseHTML(html)
    const article = new Readability(document).parse()
    let body = ''
    if (article?.content) {
      const { document: frag } = parseHTML(`<!doctype html><html><body>${article.content}</body></html>`)
      body = [...frag.querySelectorAll(BLOCKS)]
        .filter((el) => !el.querySelector(BLOCKS))
        .map((el) => {
          const t = el.textContent.replace(/\s+/g, ' ').trim()
          if (!t) return ''
          const tag = el.tagName.toLowerCase()
          if (/^h\d$/.test(tag)) return `## ${t}`
          if (tag === 'li') return `- ${t}`
          return t
        })
        .filter(Boolean)
        .join('\n\n')
    }
    if (!body) body = document.body?.textContent.replace(/\s+\n/g, '\n').trim() ?? ''
    await writeFile(name, `# ${article?.title ?? ''}\n\nURL: ${url}\n\n${body}\n`)
    console.log(`OK  ${String(body.length).padStart(6)} chars  ${name}`)
  } catch (e) {
    console.log(`ERR ${url}: ${e.message}`)
  }
}
