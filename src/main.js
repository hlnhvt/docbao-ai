import './style.css'
import { forSpeech } from './speech-text.js'
import { Music, keepAwake, playSwish, unlockAudio } from './audio.js'
import { leaveQuiz, renderQuiz } from './quiz.js'

/* ---------- Constants ---------- */

const GROUPS = {
  research: 'Nghiên cứu',
  lab: 'Lab AI',
  newsletter: 'Bản tin',
  press: 'Báo chí',
  community: 'Cộng đồng',
}
const TABS = [['hot', 'Nổi bật'], ['all', 'Tất cả'], ...Object.entries(GROUPS), ['saved', 'Đã lưu']]
const THEMES = [['auto', 'Tự động'], ['light', 'Sáng'], ['sepia', 'Giấy'], ['dark', 'Tối'], ['contrast', 'Tương phản cao']]
const FACES = [['sans', 'Không chân'], ['serif', 'Có chân']]
const WEIGHTS = [[400, 'Thường'], [500, 'Vừa'], [600, 'Đậm'], [700, 'Rất đậm']]
const SPEEDS = [['Rất chậm', 0.6], ['Chậm', 0.8], ['Vừa', 1], ['Nhanh', 1.25], ['Rất nhanh', 1.5]]
const STOP_AFTER = [['15 phút', 15], ['30 phút', 30], ['1 tiếng', 60], ['2 tiếng', 120], ['Đến khi tôi tắt', 0]]
/** Background pad levels, all well under the voice. */
const MUSIC_LEVELS = [['Rất nhỏ', 0.02], ['Nhỏ', 0.04], ['Vừa', 0.06], ['To', 0.1], ['Rất to', 0.16]]
const ORDINALS = ['nhất', 'hai', 'ba', 'tư', 'năm', 'sáu', 'bảy', 'tám', 'chín', 'mười']
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
  settings: {
    theme: 'auto',
    font: 18,
    lineHeight: 1.75,
    face: 'sans',
    weight: 400,
    showEn: true,
    rate: 1,
    pitch: 1,
    /** voiceURI of the chosen Vietnamese voice ('' : the browser's default one). */
    voice: '',
    /** 'one': read the open article and stop; 'continuous': go on to the next article. */
    readMode: 'one',
    /** Continuous reading stops after this many minutes (0: only when the reader stops it). */
    stopAfter: 0,
    /** How the voice addresses the listener, e.g. "anh Nam" (blank: "bạn"). */
    listener: '',
    briefingCount: 8,
    readingMusic: false,
    briefingMusic: false,
    musicLevel: 0.06,
    ...store.get('settings', {}),
  },
  /** Set while continuous reading moves to the next article, so the new page starts reading. */
  autoRead: false,
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
  quiz: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 12l2 2 4-4"/>',
  book: '<path d="M4 5a2 2 0 012-2h13v15H6a2 2 0 00-2 2z"/><path d="M4 20a2 2 0 002 2h13v-4"/><path d="M9 7h6"/>',
}
const icon = (name, cls = 'size-6') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`

/* ---------- Theme ---------- */

const darkQuery = matchMedia('(prefers-color-scheme: dark)')
function applySettings() {
  const s = S.settings
  const theme = s.theme === 'auto' ? (darkQuery.matches ? 'dark' : 'light') : s.theme
  const root = document.documentElement
  root.dataset.theme = theme
  root.dataset.face = s.face
  root.style.setProperty('--fs', s.font + 'px')
  root.style.setProperty('--lh', String(s.lineHeight))
  root.style.setProperty('--fw', String(s.weight))
  // The serif face is fetched only when chosen: system serifs often lack Vietnamese diacritics
  if (s.face === 'serif' && !document.getElementById('serif-font')) {
    const link = Object.assign(document.createElement('link'), {
      id: 'serif-font',
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Noto+Serif:wght@400;500;600;700&display=swap',
    })
    document.head.append(link)
  }
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

/**
 * An issue, or a series under the key "s:<slug>": series are shaped like issues (articles in
 * reading order), so saving, read marks, previous/next and continuous reading work the same.
 */
async function loadIssue(date) {
  if (!S.issues.has(date)) S.issues.set(date, isSeries(date) ? seriesAsIssue(await getJson(`data/series/${date.slice(2)}.json`)) : await getJson(`data/issues/${date}.json`))
  return S.issues.get(date)
}

const isSeries = (key) => String(key).startsWith('s:')

function seriesAsIssue(s) {
  const n = s.articles.length
  return {
    ...s,
    date: 's:' + s.slug,
    series: true,
    articles: s.articles.map((a, i) => ({ ...a, source: 'Chuyên đề', seriesTitle: s.title, n: i + 1, of: n })),
  }
}

async function loadSeriesIndex() {
  if (!S.seriesIndex) S.seriesIndex = await getJson('data/series/index.json').catch(() => ({ series: [] }))
  return S.seriesIndex
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
  onDone: null,
  /** Bumped by every speak/stop, so callbacks of a cancelled utterance cannot move the new queue on. */
  gen: 0,
  /** Vietnamese voices of this browser, offline ones first. */
  voices() {
    if (!this.supported) return []
    return speechSynthesis
      .getVoices()
      .filter((v) => v.lang?.toLowerCase().replace('_', '-').startsWith('vi'))
      .sort((a, b) => Number(b.localService) - Number(a.localService))
  },
  voice() {
    const vs = this.voices()
    return vs.find((v) => v.voiceURI === S.settings.voice) || vs.find((v) => v.lang === 'vi-VN') || vs[0]
  },
  /**
   * parts: [{ key, text }]. Text is rewritten for speech, then split into short sentences (long
   * utterances stop early on some browsers). onDone runs when everything was read (not on stop).
   */
  speak(parts, { onPart = null, onDone = null } = {}) {
    this.cancel()
    this.queue = parts.flatMap((p) => splitSentences(forSpeech(p.text)).map((text) => ({ key: p.key, text })))
    this.i = 0
    this.active = true
    this.onPart = onPart
    this.onDone = onDone
    document.dispatchEvent(new Event('speech'))
    this.next(this.gen)
  },
  next(gen) {
    if (!this.active || gen !== this.gen) return
    if (this.i >= this.queue.length) {
      const done = this.onDone
      this.finish()
      return done?.()
    }
    const p = this.queue[this.i]
    const u = new SpeechSynthesisUtterance(p.text)
    u.lang = 'vi-VN'
    const v = this.voice()
    if (v) u.voice = v
    u.rate = S.settings.rate || 1
    u.pitch = S.settings.pitch || 1
    u.onend = u.onerror = () => {
      if (gen !== this.gen) return
      this.i++
      this.next(gen)
    }
    this.onPart?.(p.key)
    speechSynthesis.speak(u)
  },
  /** Stops the voice only (a reading session may go on with the next article). */
  cancel() {
    this.gen++
    if (this.supported) speechSynthesis.cancel()
  },
  finish() {
    const was = this.active
    this.cancel()
    this.active = false
    this.queue = []
    this.onPart?.(null)
    this.onPart = this.onDone = null
    if (was) document.dispatchEvent(new Event('speech'))
  },
  stop() {
    this.finish()
    Reading.end()
  },
}
if (Speech.supported) speechSynthesis.getVoices()

/**
 * A reading session: from the reader's tap until they stop, the sleep timer runs out or there is
 * nothing left to read. Holds the background music and keeps the screen awake meanwhile.
 */
const Reading = {
  session: null,
  /** continuous: read on to the next article whatever the reading mode ("Nghe cả chuyên đề"). */
  begin(kind, { continuous = false } = {}) {
    if (this.session?.kind !== kind) this.session = { kind, startedAt: Date.now(), continuous }
    if (continuous) this.session.continuous = true
    const music = kind === 'briefing' ? S.settings.briefingMusic : S.settings.readingMusic
    if (music) Music.start(S.settings.musicLevel)
    else Music.stop()
    keepAwake(true)
  },
  end() {
    this.session = null
    S.autoRead = false
    Music.stop()
    keepAwake(false)
  },
  timeUp() {
    const limit = (S.settings.stopAfter || 0) * 60000
    return !!this.session && limit > 0 && Date.now() - this.session.startedAt >= limit
  },
}

/** How the voice calls the listener: the configured name, or "bạn". */
const who = () => S.settings.listener.trim() || 'bạn'

/** Parts read for one article: title, summary, key points, then the body. */
const articleParts = (a) => [
  { key: 'title', text: a.titleVi },
  { key: 'summary', text: a.summary },
  ...(a.keyPoints ?? []).map((p, j) => ({ key: `k${j}`, text: p })),
  ...(a.body ?? []).map((b, j) => ({ key: `p${j}`, text: b.replace(/^(## |- |> )/, '') })),
]

/** Reads [a] (of the list [list] in issue [date]) and, in continuous mode, moves on afterwards. */
function readArticle(date, a, list, opts) {
  if (!Speech.supported) return alert('Trình duyệt này không hỗ trợ đọc to.')
  unlockAudio()
  Reading.begin('article', opts)
  Speech.speak(articleParts(a), { onPart: highlight, onDone: () => afterArticle(date, a, list) })
}

async function afterArticle(date, a, list) {
  if (S.settings.readMode !== 'continuous' && !Reading.session?.continuous) return Reading.end()
  const say = (text) => Speech.speak([{ key: 'end', text }], { onDone: () => Reading.end() })
  // Sleep timer: the article in progress is always finished, then a short goodbye
  if (Reading.timeUp()) return say(`Đã hết thời gian đọc tin đã hẹn. Xin tạm dừng tại đây. Cảm ơn ${who()} đã lắng nghe.`)
  const next = list[list.findIndex((x) => x.id === a.id) + 1]
  if (!next) return say(`Đã đọc hết các bài trong ${isSeries(date) ? 'chuyên đề' : 'số'} này. Cảm ơn ${who()} đã lắng nghe.`)
  await playSwish()
  if (!Reading.session) return // stopped during the swish
  S.autoRead = true
  go(date, next)
}

/** Words of the spoken briefing: greeting, each story's title and summary, then closing words. */
function briefingParts(issue, stories) {
  const h = new Date().getHours()
  const partOfDay = h >= 4 && h <= 10 ? 'buổi sáng' : h <= 13 && h >= 11 ? 'buổi trưa' : h >= 14 && h <= 17 ? 'buổi chiều' : 'buổi tối'
  const w = who()
  const parts = [
    {
      key: 'intro',
      text: `Xin chào ${w}. Chúc ${w} ${partOfDay} tốt lành. Sau đây là điểm tin AI ${dateVi(issue.date)}. ${issue.intro ?? ''}`,
    },
  ]
  stories.forEach((a, i) =>
    parts.push({ key: `b-${a.id}`, text: `Tin thứ ${ORDINALS[i] ?? i + 1}. ${a.titleVi.replace(/\.$/, '')}. ${a.summary}` }),
  )
  parts.push({ key: 'end', text: `Đó là các tin nổi bật hôm nay. Cảm ơn ${w} đã lắng nghe. Chúc ${w} một ngày vui vẻ.` })
  return parts
}

/** Stories of the briefing: the hot ones first, then the rest in issue order, up to the chosen count. */
function briefingStories(issue) {
  const hot = tabArticles(issue, 'hot')
  const rest = issue.articles.filter((a) => !a.hot)
  return [...hot, ...rest].slice(0, Math.max(1, S.settings.briefingCount || 8))
}

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
  if (a.points) bits.push(`▲ ${esc(a.points)}`)
  if (a.comments) bits.push(`${esc(a.comments)} bình luận`)
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
      <span class="flex-1">${esc(GROUPS[a.group] ?? '')}${a.readMinutes ? ` · ${esc(a.readMinutes)} phút đọc` : ''}${read ? ' · đã đọc' : ''}</span>
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
  const briefingCount = briefingStories(issue).length

  $app.innerHTML = `
  ${topBar({ right: iconButton('data-action="quiz"', 'quiz', 'Luyện thi') + iconButton('data-action="series"', 'book', 'Chuyên đề') + iconButton('data-action="archive"', 'archive', 'Các số trước') })}
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
        ${icon(Speech.active ? 'stop' : 'headphones', 'size-5')}<span>${Speech.active ? 'Dừng nghe' : `Nghe điểm tin (${briefingCount} bài)`}</span>
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
    } else if (t.dataset.action === 'quiz') {
      location.hash = '#/quiz'
    } else if (t.dataset.action === 'series') {
      location.hash = '#/series'
    } else if (t.dataset.action === 'archive') {
      location.hash = '#/archive'
    }
  }
  document.onspeech = () => renderFeed(date)
}

function startBriefing(issue) {
  if (!Speech.supported) return alert('Trình duyệt này không hỗ trợ đọc to.')
  unlockAudio()
  Reading.begin('briefing')
  Speech.speak(briefingParts(issue, briefingStories(issue)), { onPart: highlight, onDone: () => Reading.end() })
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

  const links = a.url
    ? [`<a href="${safeUrl(a.url)}" target="_blank" rel="noopener" class="flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-3">${icon('link', 'size-5 shrink-0 text-accent')}<span>Bài gốc <span class="text-muted">(${esc(host(a.url))})</span></span></a>`]
    : []
  const back = issue.series ? `#/s/${esc(issue.slug)}` : `#/d/${esc(date)}`
  const meta = issue.series
    ? `<span>${esc(a.seriesTitle)}</span><span class="font-normal text-muted">· Bài ${a.n}/${a.of}${a.part ? ` · ${esc(a.part)}` : ''}</span>`
    : `${a.hot ? hotBadge : ''}<span>${metaLine(a)}</span><span class="font-normal text-muted">· ${esc(timeAgo(a.publishedAt))}</span>`
  const footnote = issue.series
    ? 'Bài viết thuộc chuyên đề do Đọc Báo AI biên soạn. Ví dụ về sản phẩm là ví dụ minh hoạ, không phải thông tin nội bộ của doanh nghiệp nào.'
    : 'Bài viết được tóm lược và biên tập bằng tiếng Việt từ nguồn gốc tiếng Anh, không phải bản dịch nguyên văn.'
  if (a.discussionUrl && a.discussionUrl !== a.url)
    links.push(`<a href="${safeUrl(a.discussionUrl)}" target="_blank" rel="noopener" class="flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-3">${icon('link', 'size-5 shrink-0 text-accent')}<span>Thảo luận${a.comments ? ` (${esc(a.comments)} bình luận)` : ''} <span class="text-muted">(${esc(host(a.discussionUrl))})</span></span></a>`)
  if (a.pdfUrl)
    links.push(`<a href="${safeUrl(a.pdfUrl)}" target="_blank" rel="noopener" class="flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-3">${icon('link', 'size-5 shrink-0 text-accent')}<span>Bản PDF</span></a>`)

  $app.innerHTML = `
  ${topBar({
    left: `<a href="${back}" class="grid size-11 place-items-center rounded-full hover:bg-line/60" aria-label="Về danh sách">${icon('back')}</a>`,
    title: issue.series ? 'Chuyên đề' : (GROUPS[a.group] ?? 'Đọc Báo AI'),
    right:
      iconButton('data-action="speak"', Speech.active ? 'stop' : 'speak', speakLabel(), Speech.active ? 'text-hot' : '') +
      iconButton('data-action="save"', saved ? 'saved' : 'save', saved ? 'Bỏ lưu' : 'Lưu bài', saved ? 'text-accent' : ''),
  })}
  <main id="article" class="reading mx-auto max-w-2xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">
    <div class="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8em] font-semibold text-accent">
      ${meta}
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

    <div class="read-body mt-6 space-y-4">${bodyHtml(a)}</div>

    ${
      a.glossary?.length
        ? `<section class="mt-8 rounded-2xl border border-line bg-card p-4">
            <h2 class="text-[0.78em] font-bold uppercase tracking-wide text-muted">Thuật ngữ</h2>
            <dl class="mt-2 space-y-2.5 text-[0.92em]">${a.glossary.map((g) => `<div><dt class="font-bold">${esc(g.term)}</dt><dd class="leading-relaxed text-muted">${esc(g.explain)}</dd></div>`).join('')}</dl>
          </section>`
        : ''
    }

    ${links.length ? `<section class="mt-6 grid gap-2 text-[0.9em]">${links.join('')}</section>` : ''}
    <p class="mt-4 text-[0.75em] text-muted">${footnote}</p>
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
      if (Speech.active || Reading.session) return Speech.stop()
      readArticle(date, a, list)
    }
  }
  document.onspeech = () => {
    const btn = document.querySelector('[data-action="speak"]')
    if (!btn) return
    btn.innerHTML = icon(Speech.active ? 'stop' : 'speak')
    btn.classList.toggle('text-hot', Speech.active)
    btn.setAttribute('aria-label', speakLabel())
  }
  swipe(document.getElementById('article'), () => prev && go(date, prev), () => next && go(date, next))
  // Continuous reading arrived here from the previous article: go on reading
  if (S.autoRead) {
    S.autoRead = false
    readArticle(date, a, list, { continuous: S.listenAll })
    S.listenAll = false
  }
}

const speakLabel = () => (Speech.active ? 'Dừng đọc' : S.settings.readMode === 'continuous' ? 'Đọc liên tục' : 'Đọc to')

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

/* ---------- Series ---------- */

async function renderSeriesList() {
  const { series } = await loadSeriesIndex()
  $app.innerHTML = `
  ${topBar({ left: `<a href="#/" class="grid size-11 place-items-center rounded-full hover:bg-line/60" aria-label="Về số mới nhất">${icon('back')}</a>`, title: 'Chuyên đề' })}
  <main class="reading mx-auto max-w-3xl px-3 py-4">
    <p class="mb-3 text-[0.9em] text-muted">Loạt bài chuyên sâu do Đọc Báo AI biên soạn, đọc theo thứ tự từ đầu đến cuối.</p>
    <div class="grid gap-3">
      ${
        series.length
          ? series
              .map(
                (s) => `<a href="#/s/${esc(s.slug)}" class="block rounded-2xl border border-line bg-card p-4">
              <div class="text-[0.8em] font-semibold text-accent">${s.count} bài</div>
              <div class="mt-1 text-[1.1em] font-bold leading-snug">${esc(s.title)}</div>
              ${s.intro ? `<p class="mt-1 line-clamp-3 text-[0.9em] text-muted">${esc(s.intro)}</p>` : ''}
            </a>`,
              )
              .join('')
          : '<p class="py-16 text-center text-muted">Chưa có chuyên đề nào.</p>'
      }
    </div>
  </main>`
  $app.onclick = null
  document.onspeech = null
}

async function renderSeries(slug) {
  const key = 's:' + slug
  const s = await loadIssue(key)
  const first = s.articles.find((a) => !S.read.has(keyOf(key, a.id))) ?? s.articles[0]
  let part = ''
  const items = s.articles
    .map((a) => {
      const read = S.read.has(keyOf(key, a.id))
      const head = a.part && a.part !== part ? `<h2 class="mt-4 text-[0.78em] font-bold uppercase tracking-wide text-muted">${esc((part = a.part))}</h2>` : ''
      return `${head}<a href="#/a/${esc(key)}/${esc(a.id)}" class="flex gap-3 rounded-2xl border border-line bg-card p-4">
        <span class="grid size-9 shrink-0 place-items-center rounded-full ${read ? 'bg-line text-muted' : 'bg-accent text-on-accent'} text-[0.85em] font-bold">${a.n}</span>
        <span class="min-w-0">
          <span class="block font-bold leading-snug ${read ? 'opacity-60' : ''}">${esc(a.titleVi)}</span>
          <span class="mt-1 block line-clamp-2 text-[0.88em] text-muted">${esc(a.summary)}</span>
          <span class="mt-1 block text-[0.75em] text-muted">${a.readMinutes ? `${esc(a.readMinutes)} phút đọc` : ''}${read ? ' · đã đọc' : ''}</span>
        </span>
      </a>`
    })
    .join('')
  $app.innerHTML = `
  ${topBar({ left: `<a href="#/series" class="grid size-11 place-items-center rounded-full hover:bg-line/60" aria-label="Các chuyên đề">${icon('back')}</a>`, title: 'Chuyên đề' })}
  <main class="reading mx-auto max-w-3xl px-3 pb-[calc(2rem+env(safe-area-inset-bottom))]">
    <section class="mt-4 rounded-2xl border border-line bg-card p-4">
      <h1 class="text-[1.3em] font-bold leading-tight">${esc(s.title)}</h1>
      ${s.intro ? `<p class="mt-2 text-[0.95em] leading-relaxed text-muted">${esc(s.intro)}</p>` : ''}
      <div class="mt-3 flex flex-wrap gap-2">
        <a href="#/a/${esc(key)}/${esc(first.id)}" class="inline-flex h-11 items-center rounded-full bg-accent px-4 text-[0.88em] font-bold text-on-accent">${first === s.articles[0] ? 'Bắt đầu đọc' : `Đọc tiếp bài ${first.n}`}</a>
        <button data-action="listen-all" class="inline-flex h-11 items-center gap-2 rounded-full bg-hot px-4 text-[0.88em] font-bold text-white">${icon('headphones', 'size-5')}<span>Nghe cả chuyên đề</span></button>
        <a href="#/quiz/${esc(slug)}" class="inline-flex h-11 items-center gap-2 rounded-full border border-accent px-4 text-[0.88em] font-bold text-accent">${icon('quiz', 'size-5')}<span>Luyện thi</span></a>
      </div>
    </section>
    <div class="mt-2 grid gap-2">${items}</div>
  </main>`
  $app.onclick = (e) => {
    if (!e.target.closest('[data-action="listen-all"]')) return
    if (!Speech.supported) return alert('Trình duyệt này không hỗ trợ đọc to.')
    unlockAudio()
    S.autoRead = true
    S.listenAll = true
    go(key, first)
  }
  document.onspeech = null
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

const num1 = (x) => Number(x).toFixed(1).replace('.', ',')
const pitchWord = (p) => (p < 0.85 ? 'trầm' : p > 1.15 ? 'cao' : 'bình thường')
/** "Giọng 2 · Microsoft An · cần mạng": numbered, with the browser's name for it. */
const voiceLabel = (v, i) => `Giọng ${i + 1} · ${v.name.replace(/\s*[-–(].*$/, '') || v.name}${v.localService ? '' : ' · cần mạng'}`

/** Readable value shown next to each slider. */
const SHOW = {
  font: (v) => `${v}px`,
  lineHeight: (v) => num1(v),
  rate: (v) => `${num1(v)} lần`,
  pitch: (v) => `${num1(v)} (${pitchWord(v)})`,
  briefingCount: (v) => `${v} tin, khoảng ${Math.max(1, Math.round(v * 0.6))} phút`,
}

/** Row of choice buttons for setting [key]; the chosen one is filled. */
function choices(key, options, cols = options.length) {
  const cur = S.settings[key]
  return `<div class="grid gap-2" style="grid-template-columns: repeat(${Math.min(cols, 3)}, minmax(0, 1fr))">
    ${options
      .map(([value, label]) => {
        const on = String(cur) === String(value)
        return `<button type="button" data-pick="${key}" data-value="${esc(value)}" class="min-h-11 rounded-xl border px-2 py-1.5 text-sm font-semibold ${on ? 'border-accent bg-accent text-on-accent' : 'border-line'}">${esc(label)}</button>`
      })
      .join('')}
  </div>`
}

const slider = (key, label, min, max, step) => `
  <label class="block">
    <div class="mb-1 flex justify-between gap-2 text-sm font-semibold text-muted"><span>${label}</span><span data-out="${key}">${SHOW[key](S.settings[key])}</span></div>
    <input data-range="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${S.settings[key]}" class="w-full" />
  </label>`

const toggle = (key, label) => `
  <label class="flex min-h-11 items-center justify-between gap-3 text-sm font-semibold">
    <span>${label}</span>
    <input data-check="${key}" type="checkbox" ${S.settings[key] ? 'checked' : ''} class="size-5 shrink-0 accent-[var(--accent)]" />
  </label>`

const section = (title, body) => `
  <section class="space-y-3 border-t border-line pt-4 first:border-0 first:pt-0">
    <h3 class="text-base font-bold">${title}</h3>
    ${body}
  </section>`

function openSettings() {
  const s = S.settings
  const voices = Speech.voices()
  const scroll = $settings.open ? $settings.scrollTop : 0
  $settings.className = 'm-auto max-h-[90dvh] w-[min(94vw,28rem)] overflow-y-auto rounded-2xl border border-line p-0 shadow-xl'
  $settings.innerHTML = `
  <form method="dialog" class="space-y-5 p-5">
    <h2 class="text-lg font-bold">Cài đặt</h2>

    ${section(
      'Hiển thị',
      `${choices('theme', THEMES, 3)}
      ${slider('font', 'Cỡ chữ', 15, 30, 1)}
      ${slider('lineHeight', 'Giãn dòng', 1.4, 2.2, 0.1)}
      <div class="text-sm font-semibold text-muted">Kiểu chữ</div>
      ${choices('face', FACES)}
      <div class="text-sm font-semibold text-muted">Độ dày chữ</div>
      ${choices('weight', WEIGHTS, 2)}
      ${toggle('showEn', 'Hiện tiêu đề tiếng Anh')}
      <p class="reading read-body rounded-xl bg-line/50 p-3">Ví dụ chữ khi đọc bài: mô hình ngôn ngữ lớn ngày càng giỏi lập luận.</p>`,
    )}

    ${section(
      'Chế độ đọc bài',
      `${choices('readMode', [['one', 'Đọc một bài rồi dừng'], ['continuous', 'Đọc liên tục']])}
      <p class="text-sm text-muted">${
        s.readMode === 'continuous'
          ? 'Đọc xong tự chuyển sang bài tiếp trong cùng nhóm, có tiếng “xoẹt” nhẹ báo bài mới, cho tới khi bạn bấm dừng.'
          : 'Máy đọc xong bài đang xem thì dừng lại.'
      }</p>
      ${
        s.readMode === 'continuous'
          ? `<div class="text-sm font-semibold text-muted">Tự dừng sau</div>
            ${choices('stopAfter', STOP_AFTER.map(([l, v]) => [v, l]), 3)}
            <p class="text-sm text-muted">Hết giờ, máy đọc nốt bài đang đọc rồi mới dừng.</p>`
          : ''
      }
      ${toggle('readingMusic', 'Nhạc nền nhẹ khi đọc bài')}
      <p class="text-sm text-muted">Màn hình được giữ sáng trong lúc đọc, vì khi màn hình tắt trình duyệt sẽ ngừng đọc.</p>`,
    )}

    ${section(
      'Giọng đọc',
      `<label class="block">
        <div class="mb-1 text-sm font-semibold text-muted">Tên người nghe</div>
        <input data-text="listener" type="text" maxlength="40" value="${esc(s.listener)}" placeholder="Ví dụ: anh Nam, chị Lan" class="h-11 w-full rounded-xl border border-line bg-paper px-3" />
        <div class="mt-1 text-sm text-muted">Máy sẽ chào “Xin chào ${esc(who())}…” khi đọc điểm tin.</div>
      </label>
      <div class="text-sm font-semibold text-muted">Tốc độ đọc</div>
      ${choices('rate', SPEEDS.map(([l, v]) => [v, l]), 3)}
      ${slider('rate', 'Hoặc kéo để chỉnh chi tiết', 0.5, 2, 0.05)}
      <div class="text-sm font-semibold text-muted">Giọng đọc</div>
      ${
        !Speech.supported
          ? '<p class="text-sm text-muted">Trình duyệt này không hỗ trợ đọc to.</p>'
          : voices.length
            ? choices('voice', [['', 'Mặc định'], ...voices.map((v, i) => [v.voiceURI, voiceLabel(v, i)])], 1)
            : '<p class="text-sm text-muted">Chưa thấy giọng tiếng Việt. Nếu danh sách vẫn trống, hãy cài giọng tiếng Việt trong phần cài đặt chuyển văn bản thành giọng nói của máy, rồi mở lại trang.</p>'
      }
      ${slider('pitch', 'Độ cao giọng', 0.6, 1.5, 0.05)}
      <button type="button" data-action="test-voice" class="h-11 w-full rounded-xl border border-accent font-bold text-accent">Nghe thử</button>`,
    )}

    ${section('Nghe điểm tin', `${slider('briefingCount', 'Số tin được đọc', 3, 30, 1)} ${toggle('briefingMusic', 'Nhạc đệm nhẹ khi nghe điểm tin')}`)}

    ${section('Âm lượng nhạc nền', choices('musicLevel', MUSIC_LEVELS.map(([l, v]) => [v, l]), 3))}

    <button class="sticky bottom-0 h-12 w-full rounded-xl bg-accent font-bold text-on-accent shadow">Xong</button>
  </form>`

  const update = (key, value, redraw) => {
    s[key] = value
    saveSettings()
    applySettings()
    if (key === 'musicLevel') Music.setLevel(value)
    if ((key === 'readingMusic' && Reading.session?.kind === 'article') || (key === 'briefingMusic' && Reading.session?.kind === 'briefing'))
      value ? Music.start(s.musicLevel) : Music.stop()
    if (redraw) openSettings()
  }
  $settings.querySelectorAll('[data-pick]').forEach((b) =>
    b.addEventListener('click', () => {
      const old = s[b.dataset.pick]
      update(b.dataset.pick, typeof old === 'number' ? Number(b.dataset.value) : b.dataset.value, true)
    }),
  )
  $settings.querySelectorAll('[data-range]').forEach((r) =>
    r.addEventListener('input', () => {
      const key = r.dataset.range
      update(key, Number(r.value))
      $settings.querySelector(`[data-out="${key}"]`).textContent = SHOW[key](s[key])
    }),
  )
  // Preset buttons and the fine slider show the same speed: redraw once the slider is let go
  $settings.querySelector('[data-range="rate"]')?.addEventListener('change', () => openSettings())
  $settings.querySelectorAll('[data-check]').forEach((c) => c.addEventListener('change', () => update(c.dataset.check, c.checked)))
  $settings.querySelector('[data-text="listener"]')?.addEventListener('input', (e) => update('listener', e.target.value.slice(0, 40)))
  $settings.querySelector('[data-action="test-voice"]')?.addEventListener('click', () => {
    if (Reading.session) Speech.stop()
    Speech.speak([{ key: 'test', text: `Xin chào ${who()}. Đây là giọng sẽ đọc điểm tin AI cho ${who()} mỗi ngày.` }])
  })
  $settings.onclose = () => route({ keep: true })
  if (!$settings.open) $settings.showModal()
  $settings.scrollTop = scroll
}

// Browsers load their voice list late: refresh the dialog when it arrives
if (Speech.supported) speechSynthesis.addEventListener?.('voiceschanged', () => $settings.open && openSettings())

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-action="settings"]')) openSettings()
})
$settings.addEventListener('click', (e) => {
  if (e.target === $settings) $settings.close()
})

/* ---------- Router ---------- */

document.addEventListener('speech', () => document.onspeech?.())

/** keep: redraw the same page (after settings) without stopping the voice. */
async function route({ keep = false } = {}) {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  // Reading belongs to the page it started on, except when continuous reading moves to the next article
  if (!keep && !S.autoRead) Speech.stop()
  try {
    if (parts[0] === 'a') return await renderArticle(parts[1], parts[2])
    if (parts[0] === 'archive') return await renderArchive()
    if (parts[0] === 'quiz') return await renderQuiz(parts.slice(1), { $app, topBar, icon, esc, store, getJson, loadIssue })
    leaveQuiz()
    $app.onchange = null
    if (parts[0] === 'series') return await renderSeriesList()
    if (parts[0] === 's' && parts[1]) return await renderSeries(parts[1])
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
