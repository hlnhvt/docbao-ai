/**
 * Downloads pages and extracts their readable text (Mozilla Readability), for the editor to read
 * before writing the Vietnamese version. Output: work/text/<n>-<host>.md, one file per URL.
 *
 *   npm run text -- https://example.com/post https://arxiv.org/html/2610.12345
 */
import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import { mkdir, writeFile } from 'node:fs/promises'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36'
const urls = process.argv.slice(2).filter((u) => /^https?:\/\//.test(u))
if (!urls.length) {
  console.error('Usage: npm run text -- <url> [url...]')
  process.exit(1)
}
await mkdir('work/text', { recursive: true })

const BLOCKS = 'h1,h2,h3,h4,p,li,pre,blockquote,figcaption,td'

for (const [n, url] of urls.entries()) {
  const name = `work/text/${n}-${new URL(url).hostname.replace(/^www\./, '')}.md`
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })
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
