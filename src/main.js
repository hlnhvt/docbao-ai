import './style.css'

/* ---------- Constants ---------- */

const GROUPS = {
  research: 'Nghiên cứu',
  lab: 'Lab AI',
  newsletter: 'Bản tin',
  press: 'Báo chí',
  community: 'Cộng đồng',
}
const TABS = [['hot', 'Nổi bật'], ['all', 'Tất cả'], ...Object.entries(GROUPS), ['saved', 'Đã lưu']]
const THEMES = [['auto', 'Tự động'], ['light', 'Sáng'], ['sepia', 'Giấy'], ['dark', 'Tối']]
const BASE = import.meta.env.BASE_URL
const $app = document.getElementById('app')
const $settings = document.getElementById('settings')

/* ---------- Storage (localStorage, all wrapped: private mode or blocked storage must not break the page) ---------- */

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem('dbai:' + key)
      return v == null ? fallback : JSON.parse(v)
    } catch {
      return fallback
    }
  },
  set(key, value) {
    try {
      localStorage.setItem('dbai:' + key, JSON.stringify(value))
    } catch {
      /* storage unavailable: keep working in memory */
    }
  },
}

const S = {
  index: null,
  issues: new Map(),
  settings: { theme: 'auto', font: 18, showEn: true, rate: 1, ...store.get('settings', {}) },
  read: new Set(store.get('read', [])),
  /** key "date/id" -> snapshot, so saved articles stay listed whatever issue is open */
  saved: store.get('saved', {}),
  tab: store.get('tab', 'hot'),
}

const saveSettings = () => store.set('settings', S.settings)
const keyOf = (date, id) => `${date}/${id}`

function markRead(key) {
  if (S.read.has(key)) return
  S.read.add(key)
  store.set('read', [...S.read].slice(-3000))
}

function toggleSaved(date, a) {
  const k = keyOf(date, a.id)
  if (S.saved[k]) delete S.saved[k]
  else
    S.saved[k] = {
      date,
      id: a.id,
      titleVi: a.titleVi,
      titleEn: a.titleEn,
      summary: a.summary,
      source: a.source,
      group: a.group,
      points: a.points ?? 0,
      comments: a.comments ?? 0,
      hot: !!a.hot,
      readMinutes: a.readMinutes,
      publishedAt: a.publishedAt,
      savedAt: Date.now(),
    }
  store.set('saved', S.saved)
  return !!S.saved[k]
}

/* ---------- Helpers ---------- */

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const safeUrl = (u) => (/^https?:\/\//i.test(u ?? '') ? esc(u) : '#')

function timeAgo(iso) {
  const t = Date.parse(iso)
  if (!t) return ''
  const m = Math.max(0, Math.round((Date.now() - t) / 60000))
  if (m < 60) return `${m} phút trước`
  if (m < 1440) return `${Math.round(m / 60)} giờ trước`
  return `${Math.round(m / 1440)} ngày trước`
}

function dateVi(date) {
  const d = new Date(date + 'T00:00:00')
  if (isNaN(d)) return date
  const days = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
  return `${days[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}

function host(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

const ICON = {
  back: '<path d="M15 18l-6-6 6-6"/>',
  next: '<path d="M9 18l6-6-6-6"/>',
  save: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  saved: '<path d="M6 3h12v18l-6-4-6 4z" fill="currentColor"/>',
  speak: '<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 010 7"/><path d="M18.5 5.5a9 9 0 010 13"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
  type: '<path d="M4 7V5h11v2"/><path d="M9.5 5v14"/><path d="M7.5 19h4"/><path d="M14 12v-1h7v1"/><path d="M17.5 11v8"/><path d="M16 19h3"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11h14V8"/><path d="M10 12h4"/>',
  hot: '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  link: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
  headphones: '<path d="M4 15v-3a8 8 0 0116 0v3"/><rect x="3" y="14" width="5" height="7" rx="2"/><rect x="16" y="14" width="5" height="7" rx="2"/>',
}
const icon = (name, cls = 'size-6') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`

/* ---------- Theme ---------- */

const darkQuery = matchMedia('(prefers-color-scheme: dark)')
function applySettings() {
  const s = S.settings
  const theme = s.theme === 'auto' ? (darkQuery.matches ? 'dark' : 'light') : s.theme
  document.documentElement.dataset.theme = theme
  document.documentElement.style.setProperty('--fs', s.font + 'px')
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
}
darkQuery.addEventListener?.('change', () => S.settings.theme === 'auto' && applySettings())

/* ---------- Data ---------- */

async function getJson(path) {
  const r = await fetch(BASE + path, { cache: 'no-cache' })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

async function loadIndex() {
  if (!S.index) S.index = await getJson('data/index.json')
  return S.index
}

async function loadIssue(date) {
  if (!S.issues.has(date)) S.issues.set(date, await getJson(`data/issues/${date}.json`))
  return S.issues.get(date)
}

/** Articles of [issue] shown under [tab], in the order the issue lists them. */
function tabArticles(issue, tab) {
  const all = issue.articles ?? []
  if (tab === 'all') return all
  if (tab === 'hot') return all.filter((a) => a.hot)
  if (GROUPS[tab]) return all.filter((a) => a.group === tab)
  return all
}

/* ---------- Read aloud (Web Speech API, Vietnamese voice of the phone) ---------- */

const Speech = {
  supported: 'speechSynthesis' in window,
  active: false,
  queue: [],
  i: 0,
  onPart: null,
  voice() {
    const vs = speechSynthesis.getVoices()
    return vs.find((v) => v.lang === 'vi-VN') || vs.find((v) => v.lang?.toLowerCase().startsWith('vi'))
  },
  /** parts: [{ key, text }]; each is split into short sentences (long utterances stop early on some browsers). */
  speak(parts, onPart) {
    this.stop()
    this.queue = parts.flatMap((p) => splitSentences(p.text).map((text) => ({ key: p.key, text })))
    this.i = 0
    this.active = true
    this.onPart = onPart
    document.dispatchEvent(new Event('speech'))
    this.next()
  },
  next() {
    if (!this.active) return
    if (this.i >= this.queue.length) return this.stop()
    const p = this.queue[this.i]
    const u = new SpeechSynthesisUtterance(p.text)
    u.lang = 'vi-VN'
    const v = this.voice()
    if (v) u.voice = v
    u.rate = S.settings.rate || 1
    u.onend = u.onerror = () => {
      this.i++
      this.next()
    }
    this.onPart?.(p.key)
    speechSynthesis.speak(u)
  },
  stop() {
    const was = this.active
    this.active = false
    this.queue = []
    if (this.supported) speechSynthesis.cancel()
    this.onPart?.(null)
    this.onPart = null
    if (was) document.dispatchEvent(new Event('speech'))
  },
}
if (Speech.supported) speechSynthesis.getVoices()

function splitSentences(text) {
  const out = []
  for (const s of String(text).split(/(?<=[.!?…:;])\s+/)) {
    if (s.length <= 220) out.push(s)
    else for (const part of s.split(/(?<=,)\s+/)) out.push(part)
  }
  return out.filter((s) => s.trim())
}

function highlight(key) {
  document.querySelectorAll('.saying').forEach((el) => el.classList.remove('saying'))
  if (!key) return
  const el = document.querySelector(`[data-say="${key}"]`)
  if (!el) return
  el.classList.add('saying')
  const r = el.getBoundingClientRect()
  if (r.top < 70 || r.bottom > innerHeight - 90) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

/* ---------- Shared pieces ---------- */

function topBar({ left = '', title = 'Đọc Báo AI', right = '' } = {}) {
  return `
  <header class="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur pt-[env(safe-area-inset-top)]">
    <div class="mx-auto flex h-14 max-w-3xl items-center gap-1 px-2">
      ${left}
      <a href="#/" class="min-w-0 flex-1 truncate px-2 text-lg font-bold tracking-tight">${esc(title)}</a>
      ${right}
      <button data-action="settings" class="grid size-11 place-items-center rounded-full hover:bg-line/60" aria-label="Cỡ chữ và giao diện">${icon('type')}</button>
    </div>
  </header>`
}

const iconButton = (attrs, name, label, cls = '') =>
  `<button ${attrs} class="grid size-11 place-items-center rounded-full hover:bg-line/60 ${cls}" aria-label="${esc(label)}">${icon(name)}</button>`

function metaLine(a) {
  const bits = [esc(a.source)]
  if (a.points) bits.push(`▲ ${a.points}`)
  if (a.comments) bits.push(`${a.comments} bình luận`)
  return bits.join('<span class="opacity-50"> · </span>')
}

const hotBadge = `<span class="inline-flex items-center gap-1 rounded-full bg-hot px-2 py-0.5 text-[0.75em] font-bold text-white">${icon('hot', 'size-3.5')}Nổi bật</span>`

function card(date, a) {
  const k = keyOf(date, a.id)
  const read = S.read.has(k)
  const saved = !!S.saved[k]
  return `
  <article class="rounded-2xl border border-line bg-card shadow-sm">
    <a href="#/a/${esc(date)}/${esc(a.id)}" class="block px-4 pt-4 pb-2">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.78em] font-semibold text-accent">
        ${a.hot ? hotBadge : ''}<span>${metaLine(a)}</span>
      </div>
      <h2 class="mt-1.5 text-[1.12em] font-bold leading-snug ${read ? 'opacity-55' : ''}">${esc(a.titleVi)}</h2>
      ${S.settings.showEn && a.titleEn ? `<p class="mt-1 text-[0.82em] leading-snug text-muted">${esc(a.titleEn)}</p>` : ''}
      <p class="mt-2 line-clamp-3 text-[0.94em] leading-relaxed ${read ? 'opacity-70' : ''}">${esc(a.summary)}</p>
    </a>
    <div class="flex items-center gap-2 pl-4 pr-1 pb-1 text-[0.78em] text-muted">
      <span class="flex-1">${esc(GROUPS[a.group] ?? '')}${a.readMinutes ? ` · ${a.readMinutes} phút đọc` : ''}${read ? ' · đã đọc' : ''}</span>
      <button data-save="${esc(k)}" class="grid size-11 place-items-center rounded-full ${saved ? 'text-accent' : ''}" aria-label="${saved ? 'Bỏ lưu' : 'Lưu bài'}">${icon(saved ? 'saved' : 'save', 'size-5')}</button>
    </div>
  </article>`
}

/* ---------- Feed ---------- */

async function renderFeed(date) {
  const index = await loadIndex()
  const issue = await loadIssue(date)
  const pos = index.issues.findIndex((i) => i.date === date)
  const newer = index.issues[pos - 1]
  const older = index.issues[pos + 1]
  const tab = TABS.some(([t]) => t === S.tab) ? S.tab : 'hot'
  const list =
    tab === 'saved'
      ? Object.values(S.saved).sort((x, y) => y.savedAt - x.savedAt)
      : tabArticles(issue, tab)
  const hotCount = tabArticles(issue, 'hot').length

  $app.innerHTML = `
  ${topBar({ right: iconButton('data-action="archive"', 'archive', 'Các số trước') })}
  <main class="reading mx-auto max-w-3xl px-3 pb-[calc(2rem+env(safe-area-inset-bottom))]">
    <section class="mt-4 rounded-2xl border border-line bg-card p-4">
      <div class="flex items-center gap-2 text-[0.8em] text-muted">
        ${older ? `<a href="#/d/${older.date}" class="grid size-9 place-items-center rounded-full hover:bg-line/60" aria-label="Số trước">${icon('back', 'size-5')}</a>` : '<span class="size-9"></span>'}
        <span class="flex-1 text-center font-semibold">${esc(dateVi(date))}</span>
        ${newer ? `<a href="#/d/${newer.date}" class="grid size-9 place-items-center rounded-full hover:bg-line/60" aria-label="Số mới hơn">${icon('next', 'size-5')}</a>` : '<span class="size-9"></span>'}
      </div>
      <h1 class="mt-2 text-[1.3em] font-bold leading-tight">${esc(issue.title)}</h1>
      ${issue.intro ? `<p class="mt-2 text-[0.95em] leading-relaxed text-muted" data-say="intro">${esc(issue.intro)}</p>` : ''}
      <button data-action="briefing" class="mt-3 inline-flex h-11 items-center gap-2 rounded-full bg-hot px-4 text-[0.88em] font-bold text-white">
        ${icon(Speech.active ? 'stop' : 'headphones', 'size-5')}<span>${Speech.active ? 'Dừng nghe' : `Nghe điểm tin (${hotCount || Math.min(8, issue.articles.length)} bài)`}</span>
      </button>
    </section>

    <nav class="no-scrollbar sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-3 mt-3 flex gap-2 overflow-x-auto bg-paper/95 px-3 py-2 backdrop-blur" aria-label="Nhóm bài">
      ${TABS.map(([t, label]) => {
        const n = t === 'saved' ? Object.keys(S.saved).length : tabArticles(issue, t).length
        const on = t === tab
        return `<button data-tab="${t}" class="shrink-0 rounded-full border px-4 py-2 text-[0.85em] font-semibold ${on ? 'border-accent bg-accent text-on-accent' : 'border-line bg-card'}">${label}<span class="ml-1 opacity-70">${n}</span></button>`
      }).join('')}
    </nav>

    <div class="mt-2 grid gap-3">
      ${
        list.length
          ? list.map((a) => card(a.date ?? date, a)).join('')
          : `<p class="py-16 text-center text-muted">${tab === 'saved' ? 'Chưa lưu bài nào. Bấm biểu tượng đánh dấu trên một bài để lưu.' : 'Số này không có bài trong nhóm này.'}</p>`
      }
    </div>
    <p class="mt-8 text-center text-[0.75em] text-muted">Bài được tóm lược và biên tập bằng tiếng Việt. Bản quyền nội dung gốc thuộc về các nguồn được dẫn.</p>
  </main>`

  $app.onclick = (e) => {
    const t = e.target.closest('[data-tab],[data-save],[data-action]')
    if (!t) return
    if (t.dataset.tab) {
      S.tab = t.dataset.tab
      store.set('tab', S.tab)
      renderFeed(date)
    } else if (t.dataset.save) {
      e.preventDefault()
      const [d, id] = t.dataset.save.split('/')
      const a = S.issues.get(d)?.articles.find((x) => x.id === id) ?? S.saved[t.dataset.save]
      if (a) toggleSaved(d, a)
      renderFeed(date)
    } else if (t.dataset.action === 'briefing') {
      if (Speech.active) return Speech.stop()
      startBriefing(issue)
    } else if (t.dataset.action === 'archive') {
      location.hash = '#/archive'
    }
  }
  document.onspeech = () => renderFeed(date)
}

function startBriefing(issue) {
  if (!Speech.supported) return alert('Trình duyệt này không hỗ trợ đọc to.')
  const hot = tabArticles(issue, 'hot')
  const picks = (hot.length ? hot : issue.articles).slice(0, 10)
  const ord = ['nhất', 'hai', 'ba', 'tư', 'năm', 'sáu', 'bảy', 'tám', 'chín', 'mười']
  const parts = [{ key: 'intro', text: `Điểm tin AI ${dateVi(issue.date)}. ${issue.intro ?? ''}` }]
  picks.forEach((a, i) => parts.push({ key: `b-${a.id}`, text: `Tin thứ ${ord[i]}. ${a.titleVi}. ${a.summary}` }))
  parts.push({ key: 'end', text: 'Hết điểm tin hôm nay. Cảm ơn bạn đã lắng nghe.' })
  Speech.speak(parts, highlight)
}

/* ---------- Article ---------- */

function bodyHtml(a) {
  const out = []
  let list = []
  const flush = () => {
    if (list.length) out.push(`<ul class="ml-5 list-disc space-y-2">${list.join('')}</ul>`)
    list = []
  }
  ;(a.body ?? []).forEach((block, i) => {
    const key = `p${i}`
    if (block.startsWith('- ')) {
      list.push(`<li data-say="${key}">${esc(block.slice(2))}</li>`)
      return
    }
    flush()
    if (block.startsWith('## ')) out.push(`<h3 class="pt-2 text-[1.1em] font-bold" data-say="${key}">${esc(block.slice(3))}</h3>`)
    else if (block.startsWith('> ')) out.push(`<blockquote class="border-l-4 border-accent/60 pl-4 italic text-muted" data-say="${key}">${esc(block.slice(2))}</blockquote>`)
    else out.push(`<p data-say="${key}">${esc(block)}</p>`)
  })
  flush()
  return out.join('')
}

async function renderArticle(date, id) {
  const issue = await loadIssue(date)
  const a = issue.articles.find((x) => x.id === id)
  if (!a) throw new Error('Không tìm thấy bài này.')
  const k = keyOf(date, id)
  markRead(k)
  const tab = S.tab === 'saved' || !tabArticles(issue, S.tab).some((x) => x.id === id) ? 'all' : S.tab
  const list = tabArticles(issue, tab)
  const i = list.findIndex((x) => x.id === id)
  const prev = list[i - 1]
  const next = list[i + 1]
  const saved = !!S.saved[k]

  const links = [
    `<a href="${safeUrl(a.url)}" target="_blank" rel="noopener" class="flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-3">${icon('link', 'size-5 shrink-0 text-accent')}<span>Bài gốc <span class="text-muted">(${esc(host(a.url))})</span></span></a>`,
  ]
  if (a.discussionUrl && a.discussionUrl !== a.url)
    links.push(`<a href="${safeUrl(a.discussionUrl)}" target="_blank" rel="noopener" class="flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-3">${icon('link', 'size-5 shrink-0 text-accent')}<span>Thảo luận${a.comments ? ` (${a.comments} bình luận)` : ''} <span class="text-muted">(${esc(host(a.discussionUrl))})</span></span></a>`)
  if (a.pdfUrl)
    links.push(`<a href="${safeUrl(a.pdfUrl)}" target="_blank" rel="noopener" class="flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-3">${icon('link', 'size-5 shrink-0 text-accent')}<span>Bản PDF</span></a>`)

  $app.innerHTML = `
  ${topBar({
    left: `<a href="#/d/${esc(date)}" class="grid size-11 place-items-center rounded-full hover:bg-line/60" aria-label="Về danh sách">${icon('back')}</a>`,
    title: GROUPS[a.group] ?? 'Đọc Báo AI',
    right:
      iconButton('data-action="speak"', Speech.active ? 'stop' : 'speak', Speech.active ? 'Dừng đọc' : 'Đọc to', Speech.active ? 'text-hot' : '') +
      iconButton('data-action="save"', saved ? 'saved' : 'save', saved ? 'Bỏ lưu' : 'Lưu bài', saved ? 'text-accent' : ''),
  })}
  <main id="article" class="reading mx-auto max-w-2xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">
    <div class="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8em] font-semibold text-accent">
      ${a.hot ? hotBadge : ''}<span>${metaLine(a)}</span><span class="font-normal text-muted">· ${esc(timeAgo(a.publishedAt))}</span>
    </div>
    <h1 class="mt-2 text-[1.55em] font-bold leading-tight" data-say="title">${esc(a.titleVi)}</h1>
    ${a.titleEn ? `<p class="mt-2 text-[0.9em] leading-snug text-muted">${esc(a.titleEn)}</p>` : ''}
    ${a.tags?.length ? `<div class="mt-3 flex flex-wrap gap-1.5">${a.tags.map((t) => `<span class="rounded-full bg-line/70 px-2.5 py-0.5 text-[0.72em]">${esc(t)}</span>`).join('')}</div>` : ''}

    <section class="mt-5 rounded-2xl border border-accent/30 bg-accent/5 p-4">
      <h2 class="text-[0.78em] font-bold uppercase tracking-wide text-accent">Tóm tắt</h2>
      <p class="mt-1.5 font-medium leading-relaxed" data-say="summary">${esc(a.summary)}</p>
    </section>

    ${
      a.keyPoints?.length
        ? `<section class="mt-5">
            <h2 class="text-[0.78em] font-bold uppercase tracking-wide text-muted">Ý chính</h2>
            <ul class="mt-2 space-y-2">${a.keyPoints.map((p, j) => `<li class="flex gap-2.5 leading-relaxed" data-say="k${j}"><span class="mt-[0.55em] size-2 shrink-0 rounded-full bg-accent"></span><span>${esc(p)}</span></li>`).join('')}</ul>
          </section>`
        : ''
    }

    <div class="mt-6 space-y-4 leading-[1.75]">${bodyHtml(a)}</div>

    ${
      a.glossary?.length
        ? `<section class="mt-8 rounded-2xl border border-line bg-card p-4">
            <h2 class="text-[0.78em] font-bold uppercase tracking-wide text-muted">Thuật ngữ</h2>
            <dl class="mt-2 space-y-2.5 text-[0.92em]">${a.glossary.map((g) => `<div><dt class="font-bold">${esc(g.term)}</dt><dd class="leading-relaxed text-muted">${esc(g.explain)}</dd></div>`).join('')}</dl>
          </section>`
        : ''
    }

    <section class="mt-6 grid gap-2 text-[0.9em]">${links.join('')}</section>
    <p class="mt-4 text-[0.75em] text-muted">Bài viết được tóm lược và biên tập bằng tiếng Việt từ nguồn gốc tiếng Anh, không phải bản dịch nguyên văn.</p>
  </main>

  <nav class="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
    <div class="mx-auto flex max-w-2xl gap-2 px-3 py-2">
      ${navButton(date, prev, 'back', 'Bài trước')}
      ${navButton(date, next, 'next', 'Bài tiếp')}
    </div>
  </nav>`
  scrollTo(0, 0)

  $app.onclick = (e) => {
    const t = e.target.closest('[data-action]')
    if (!t) return
    if (t.dataset.action === 'save') {
      toggleSaved(date, a)
      renderArticle(date, id)
    } else if (t.dataset.action === 'speak') {
      if (Speech.active) return Speech.stop()
      if (!Speech.supported) return alert('Trình duyệt này không hỗ trợ đọc to.')
      const parts = [
        { key: 'title', text: a.titleVi },
        { key: 'summary', text: a.summary },
        ...(a.keyPoints ?? []).map((p, j) => ({ key: `k${j}`, text: p })),
        ...(a.body ?? []).map((b, j) => ({ key: `p${j}`, text: b.replace(/^(## |- |> )/, '') })),
      ]
      Speech.speak(parts, highlight)
    }
  }
  document.onspeech = () => {
    const btn = document.querySelector('[data-action="speak"]')
    if (!btn) return
    btn.innerHTML = icon(Speech.active ? 'stop' : 'speak')
    btn.classList.toggle('text-hot', Speech.active)
    btn.setAttribute('aria-label', Speech.active ? 'Dừng đọc' : 'Đọc to')
  }
  swipe(document.getElementById('article'), () => prev && go(date, prev), () => next && go(date, next))
}

function navButton(date, a, dir, label) {
  if (!a) return `<span class="flex h-12 flex-1 items-center justify-center rounded-xl border border-line text-[0.85em] text-muted opacity-50">${dir === 'back' ? 'Bài đầu' : 'Hết bài'}</span>`
  return `<a href="#/a/${esc(date)}/${esc(a.id)}" class="flex h-12 flex-1 items-center justify-center gap-1 rounded-xl bg-accent px-3 text-[0.9em] font-bold text-on-accent">
    ${dir === 'back' ? icon('back', 'size-5') : ''}<span>${label}</span>${dir === 'next' ? icon('next', 'size-5') : ''}</a>`
}

const go = (date, a) => (location.hash = `#/a/${date}/${a.id}`)

/** Horizontal swipe on the article: left for the next one, right for the previous one. */
function swipe(el, onRight, onLeft) {
  let x0 = 0
  let y0 = 0
  el.addEventListener('touchstart', (e) => {
    x0 = e.touches[0].clientX
    y0 = e.touches[0].clientY
  }, { passive: true })
  el.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - x0
    const dy = e.changedTouches[0].clientY - y0
    if (Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 2) return
    if (dx > 0) onRight()
    else onLeft()
  }, { passive: true })
}

/* ---------- Archive ---------- */

async function renderArchive() {
  const index = await loadIndex()
  $app.innerHTML = `
  ${topBar({ left: `<a href="#/" class="grid size-11 place-items-center rounded-full hover:bg-line/60" aria-label="Về số mới nhất">${icon('back')}</a>`, title: 'Các số trước' })}
  <main class="reading mx-auto max-w-3xl px-3 py-4">
    <div class="grid gap-3">
      ${index.issues
        .map(
          (i) => `<a href="#/d/${esc(i.date)}" class="block rounded-2xl border border-line bg-card p-4">
            <div class="text-[0.8em] font-semibold text-accent">${esc(dateVi(i.date))} · ${i.count} bài</div>
            <div class="mt-1 text-[1.05em] font-bold">${esc(i.title)}</div>
            ${i.intro ? `<p class="mt-1 line-clamp-2 text-[0.9em] text-muted">${esc(i.intro)}</p>` : ''}
          </a>`,
        )
        .join('')}
    </div>
  </main>`
  $app.onclick = null
  document.onspeech = null
}

/* ---------- Settings dialog ---------- */

function openSettings() {
  const s = S.settings
  $settings.className = 'm-auto w-[min(92vw,26rem)] rounded-2xl border border-line p-0 shadow-xl'
  $settings.innerHTML = `
  <form method="dialog" class="space-y-5 p-5">
    <h2 class="text-lg font-bold">Cỡ chữ và giao diện</h2>
    <div>
      <div class="mb-2 text-sm font-semibold text-muted">Màu nền</div>
      <div class="grid grid-cols-4 gap-2">
        ${THEMES.map(([t, label]) => `<button type="button" data-theme-pick="${t}" class="h-11 rounded-xl border text-sm font-semibold ${s.theme === t ? 'border-accent bg-accent text-on-accent' : 'border-line'}">${label}</button>`).join('')}
      </div>
    </div>
    <label class="block">
      <div class="mb-1 flex justify-between text-sm font-semibold text-muted"><span>Cỡ chữ</span><span id="fs-val">${s.font}px</span></div>
      <input id="fs" type="range" min="15" max="26" step="1" value="${s.font}" class="w-full" />
    </label>
    <label class="block">
      <div class="mb-1 flex justify-between text-sm font-semibold text-muted"><span>Tốc độ đọc to</span><span id="rate-val">${s.rate.toFixed(1)}×</span></div>
      <input id="rate" type="range" min="0.6" max="1.6" step="0.1" value="${s.rate}" class="w-full" />
    </label>
    <label class="flex items-center justify-between gap-3 text-sm font-semibold">
      <span>Hiện tiêu đề tiếng Anh</span>
      <input id="show-en" type="checkbox" ${s.showEn ? 'checked' : ''} class="size-5 accent-[var(--accent)]" />
    </label>
    <p class="reading rounded-xl bg-line/50 p-3 leading-relaxed" style="font-size: var(--fs)">Ví dụ chữ khi đọc bài: mô hình ngôn ngữ lớn ngày càng giỏi lập luận.</p>
    <button class="h-11 w-full rounded-xl bg-accent font-bold text-on-accent">Xong</button>
  </form>`
  const rerender = () => route()
  $settings.querySelectorAll('[data-theme-pick]').forEach((b) =>
    b.addEventListener('click', () => {
      s.theme = b.dataset.themePick
      saveSettings()
      applySettings()
      openSettings()
    }),
  )
  $settings.querySelector('#fs').addEventListener('input', (e) => {
    s.font = Number(e.target.value)
    $settings.querySelector('#fs-val').textContent = s.font + 'px'
    saveSettings()
    applySettings()
  })
  $settings.querySelector('#rate').addEventListener('input', (e) => {
    s.rate = Number(e.target.value)
    $settings.querySelector('#rate-val').textContent = s.rate.toFixed(1) + '×'
    saveSettings()
  })
  $settings.querySelector('#show-en').addEventListener('change', (e) => {
    s.showEn = e.target.checked
    saveSettings()
  })
  $settings.onclose = rerender
  if (!$settings.open) $settings.showModal()
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-action="settings"]')) openSettings()
})
$settings.addEventListener('click', (e) => {
  if (e.target === $settings) $settings.close()
})

/* ---------- Router ---------- */

document.addEventListener('speech', () => document.onspeech?.())

async function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  // Reading belongs to the page it started on
  Speech.stop()
  try {
    if (parts[0] === 'a') return await renderArticle(parts[1], parts[2])
    if (parts[0] === 'archive') return await renderArchive()
    const index = await loadIndex()
    const date = parts[0] === 'd' ? parts[1] : index.issues[0]?.date
    if (!date) {
      $app.innerHTML = `${topBar()}<p class="p-8 text-center text-muted">Chưa có số nào.</p>`
      return
    }
    await renderFeed(date)
  } catch (err) {
    $app.innerHTML = `${topBar()}
    <div class="mx-auto max-w-md p-8 text-center">
      <p class="font-semibold">Không mở được trang này.</p>
      <p class="mt-1 text-sm text-muted">${esc(err.message)}</p>
      <a href="#/" class="mt-4 inline-block rounded-xl bg-accent px-4 py-2 font-bold text-on-accent">Về số mới nhất</a>
    </div>`
  }
}

applySettings()
addEventListener('hashchange', route)
route()
