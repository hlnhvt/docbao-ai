/**
 * "Luyện thi": a question bank built on a series (public/data/quiz/<slug>.json) and exams generated
 * from it with the reader's conditions. Question types: single, multi, truefalse, match, order.
 * Everything the reader does (current exam, past attempts, per-question stats) stays in localStorage.
 *
 * Routes: #/quiz, #/quiz/<slug>, #/quiz/<slug>/bank, #/quiz/<slug>/new, #/quiz/<slug>/run,
 * #/quiz/<slug>/result/<attemptId>
 */

const LEVELS = { 1: 'Nền tảng', 2: 'Vận dụng', 3: 'Chuyên gia' }
const TYPES = { single: 'Một đáp án', multi: 'Nhiều đáp án', truefalse: 'Đúng / Sai', match: 'Nối cặp', order: 'Sắp xếp thứ tự' }
const COUNTS = [10, 20, 30, 50, 0]
const TIMES = [0, 15, 30, 45, 60, 90]
const PASS = 80
const KEEP_ATTEMPTS = 30

let C // helpers from main.js: $app, topBar, icon, esc, store, getJson, loadIssue
const banks = new Map()
let timer = null

/* ---------- data ---------- */

async function loadBank(slug) {
  if (!banks.has(slug))
    banks.set(
      slug,
      (async () => {
        const bank = await C.getJson(`data/quiz/${slug}.json`)
        const series = await C.loadIssue('s:' + (bank.series || slug))
        const arts = new Map(series.articles.map((a) => [a.id, a]))
        const byId = new Map(bank.questions.map((q) => [q.id, q]))
        return { ...bank, slug, series, arts, byId }
      })(),
    )
  return banks.get(slug)
}

const key = (slug, name) => `quiz:${name}:${slug}`
const getAttempts = (slug) => C.store.get(key(slug, 'attempts'), [])
const getStats = (slug) => C.store.get(key(slug, 'stats'), {})
const getSession = (slug) => C.store.get(key(slug, 'session'), null)
const saveSession = (slug, s) => C.store.set(key(slug, 'session'), s)

const DEFAULT_SETUP = { mode: 'exam', count: 20, minutes: 30, articles: null, levels: [1, 2, 3], types: Object.keys(TYPES), scenario: 'any', smart: true }

function getSetup(bank) {
  const s = { ...DEFAULT_SETUP, ...C.store.get(key(bank.slug, 'setup'), {}) }
  const all = [...bank.arts.keys()]
  s.articles = (s.articles ?? all).filter((id) => bank.arts.has(id))
  if (!s.articles.length) s.articles = all
  return s
}

/* ---------- helpers ---------- */

const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const range = (n) => [...Array(n).keys()]
const pct = (x) => Math.round(x * 100)
const artTitle = (bank, id) => bank.arts.get(id)?.titleVi ?? id
const artNo = (bank, id) => bank.arts.get(id)?.n ?? ''

function badge(text, cls = 'bg-line/70') {
  return `<span class="rounded-full ${cls} px-2.5 py-0.5 text-[0.72em] font-semibold">${C.esc(text)}</span>`
}

function qBadges(bank, q) {
  return [
    badge(`Bài ${artNo(bank, q.article)}`),
    badge(LEVELS[q.level] ?? ''),
    badge(TYPES[q.type] ?? q.type),
    q.scenario ? badge('Tình huống', 'bg-accent/15 text-accent') : '',
  ].join(' ')
}

const btn = (attrs, label, kind = 'primary') => {
  const cls =
    kind === 'primary'
      ? 'bg-accent text-on-accent'
      : kind === 'hot'
        ? 'bg-hot text-white'
        : 'border border-line bg-card'
  return `<button ${attrs} class="inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-[0.9em] font-bold ${cls} disabled:opacity-40">${label}</button>`
}

const back = (href, label) =>
  `<a href="${href}" class="grid size-11 place-items-center rounded-full hover:bg-line/60" aria-label="${C.esc(label)}">${C.icon('back')}</a>`

/** Called by the router whenever a page outside the exam is shown. */
export function leaveQuiz() {
  stopTimer()
}

function stopTimer() {
  if (timer) clearInterval(timer)
  timer = null
}

/* ---------- grading ---------- */

/** Score of one answer, 0..1. Partial credit for multi, match and order. */
export function grade(q, ans) {
  if (ans == null) return 0
  switch (q.type) {
    case 'single':
      return ans === q.answer ? 1 : 0
    case 'truefalse':
      return ans === q.answer ? 1 : 0
    case 'multi': {
      const right = new Set(q.answer)
      const hits = ans.filter((i) => right.has(i)).length
      const wrong = ans.length - hits
      return Math.max(0, (hits - wrong) / right.size)
    }
    case 'match':
      return q.pairs.filter((_, i) => ans[i] === i).length / q.pairs.length
    case 'order':
      return ans.filter((v, i) => v === i).length / q.items.length
    default:
      return 0
  }
}

const answered = (q, ans) =>
  ans != null && (q.type === 'multi' ? ans.length > 0 : q.type === 'match' ? ans.every((v) => v != null) : true)

/* ---------- exam generation ---------- */

function pool(bank, setup) {
  return bank.questions.filter(
    (q) =>
      setup.articles.includes(q.article) &&
      setup.levels.includes(q.level) &&
      setup.types.includes(q.type) &&
      (setup.scenario !== 'only' || q.scenario),
  )
}

/**
 * Picks questions spread evenly over the chosen articles. "smart": questions never seen come first,
 * then those last answered wrong, then the rest; random within each band.
 */
function generate(bank, setup, stats) {
  const candidates = pool(bank, setup)
  const n = setup.count ? Math.min(setup.count, candidates.length) : candidates.length
  const band = (q) => {
    if (!setup.smart) return 0
    const s = stats[q.id]
    return !s ? 0 : s.lastRight ? 2 : 1
  }
  const byArticle = new Map()
  for (const q of shuffle(candidates)) {
    if (!byArticle.has(q.article)) byArticle.set(q.article, [])
    byArticle.get(q.article).push(q)
  }
  for (const list of byArticle.values()) list.sort((a, b) => band(a) - band(b))
  const queues = shuffle([...byArticle.values()])
  const picked = []
  while (picked.length < n && queues.some((q) => q.length)) for (const q of queues) if (q.length && picked.length < n) picked.push(q.shift())
  return shuffle(picked).map(newItem)
}

/** One exam item: the question id, its display shuffle and the reader's answer (in original indices). */
function newItem(q) {
  const item = { id: q.id, ans: null, checked: false, flag: false }
  if (q.type === 'single' || q.type === 'multi') item.perm = shuffle(range(q.options.length))
  if (q.type === 'match') {
    item.perm = shuffle(range(q.pairs.length))
    item.ans = q.pairs.map(() => null)
  }
  if (q.type === 'order') {
    let p = shuffle(range(q.items.length))
    for (let tries = 0; p.every((v, i) => v === i) && tries < 5; tries++) p = shuffle(p)
    item.ans = p
  }
  return item
}

function startSession(bank, setup, items) {
  const s = {
    id: Date.now().toString(36),
    mode: setup.mode,
    createdAt: Date.now(),
    deadline: setup.minutes ? Date.now() + setup.minutes * 60000 : null,
    minutes: setup.minutes,
    scope: summary(bank, setup),
    items,
    i: 0,
  }
  saveSession(bank.slug, s)
  location.hash = `#/quiz/${bank.slug}/run`
}

function summary(bank, setup) {
  const arts = setup.articles.length === bank.arts.size ? 'tất cả các bài' : `${setup.articles.length} bài`
  const lv = setup.levels.length === 3 ? 'mọi mức' : setup.levels.map((l) => LEVELS[l]).join(', ')
  return `${setup.mode === 'exam' ? 'Thi thử' : 'Luyện tập'} · ${arts} · ${lv}${setup.scenario === 'only' ? ' · chỉ tình huống' : ''}`
}

/* ---------- pages ---------- */

export async function renderQuiz(parts, helpers) {
  C = helpers
  stopTimer()
  C.$app.onchange = null
  const [slug, page, arg] = parts
  if (!slug) return renderBanks()
  const bank = await loadBank(slug)
  if (page === 'bank') return renderBank(bank)
  if (page === 'new') return renderSetup(bank)
  if (page === 'run') return renderRun(bank)
  if (page === 'result') return renderResult(bank, arg)
  return renderHub(bank)
}

async function renderBanks() {
  const { banks: list } = await C.getJson('data/quiz/index.json').catch(() => ({ banks: [] }))
  if (list.length === 1) return void location.replace(`#/quiz/${list[0].slug}`)
  C.$app.innerHTML = `
  ${C.topBar({ left: back('#/', 'Về trang chính'), title: 'Luyện thi' })}
  <main class="reading mx-auto max-w-3xl px-3 py-4 grid gap-3">
    ${
      list.length
        ? list.map((b) => `<a href="#/quiz/${C.esc(b.slug)}" class="block rounded-2xl border border-line bg-card p-4"><div class="text-[0.8em] font-semibold text-accent">${b.count} câu hỏi</div><div class="mt-1 font-bold">${C.esc(b.title)}</div></a>`).join('')
        : '<p class="py-16 text-center text-muted">Chưa có ngân hàng câu hỏi nào.</p>'
    }
  </main>`
  C.$app.onclick = null
}

function renderHub(bank) {
  const qs = bank.questions
  const count = (f) => qs.filter(f).length
  const attempts = getAttempts(bank.slug)
  const stats = getStats(bank.slug)
  const seen = Object.keys(stats).filter((id) => bank.byId.has(id)).length
  const mastered = Object.entries(stats).filter(([id, s]) => bank.byId.has(id) && s.lastRight).length
  const session = getSession(bank.slug)
  const best = attempts.length ? Math.max(...attempts.map((a) => a.score)) : null

  C.$app.innerHTML = `
  ${C.topBar({ left: back('#/series', 'Chuyên đề'), title: 'Luyện thi' })}
  <main class="reading mx-auto max-w-3xl px-3 pb-[calc(2rem+env(safe-area-inset-bottom))]">
    <section class="mt-4 rounded-2xl border border-line bg-card p-4">
      <div class="text-[0.8em] font-semibold text-accent">Ngân hàng câu hỏi</div>
      <h1 class="mt-1 text-[1.25em] font-bold leading-tight">${C.esc(bank.title)}</h1>
      <p class="mt-2 text-[0.92em] leading-relaxed text-muted">${C.esc(bank.intro ?? '')}</p>
      <div class="mt-3 grid grid-cols-3 gap-2 text-center">
        <div class="rounded-xl bg-line/50 p-2"><div class="text-[1.3em] font-bold">${qs.length}</div><div class="text-[0.72em] text-muted">câu hỏi</div></div>
        <div class="rounded-xl bg-line/50 p-2"><div class="text-[1.3em] font-bold">${count((q) => q.scenario)}</div><div class="text-[0.72em] text-muted">tình huống</div></div>
        <div class="rounded-xl bg-line/50 p-2"><div class="text-[1.3em] font-bold">${pct(mastered / qs.length)}%</div><div class="text-[0.72em] text-muted">đã thông thạo</div></div>
      </div>
      <div class="mt-4 flex flex-wrap gap-2">
        ${session ? btn(`data-go="#/quiz/${bank.slug}/run"`, 'Tiếp tục bài đang làm', 'hot') : ''}
        ${btn(`data-go="#/quiz/${bank.slug}/new"`, 'Tạo bài thi')}
        ${btn(`data-go="#/quiz/${bank.slug}/bank"`, 'Duyệt ngân hàng câu hỏi', 'ghost')}
      </div>
      <p class="mt-3 text-[0.78em] text-muted">Đã gặp ${seen}/${qs.length} câu. “Thông thạo” là câu bạn trả lời đúng hoàn toàn ở lần gần nhất.${best != null ? ` Điểm cao nhất: ${best}%.` : ''}</p>
    </section>

    <section class="mt-4">
      <h2 class="text-[0.78em] font-bold uppercase tracking-wide text-muted">Theo bài</h2>
      <div class="mt-2 grid gap-2">
        ${bank.series.articles
          .map((a) => {
            const mine = qs.filter((q) => q.article === a.id)
            if (!mine.length) return ''
            const ok = mine.filter((q) => stats[q.id]?.lastRight).length
            return `<div class="min-w-0 rounded-xl border border-line bg-card px-3 py-2">
              <div class="flex items-baseline gap-2"><span class="font-bold">${a.n}.</span><a href="#/a/s:${C.esc(bank.series.slug)}/${C.esc(a.id)}" class="min-w-0 flex-1 truncate font-semibold">${C.esc(a.titleVi)}</a><span class="shrink-0 text-[0.78em] text-muted">${ok}/${mine.length}</span></div>
              <div class="mt-1.5 h-1.5 rounded-full bg-line"><div class="h-1.5 rounded-full bg-accent" style="width:${pct(ok / mine.length)}%"></div></div>
            </div>`
          })
          .join('')}
      </div>
    </section>

    <section class="mt-5">
      <h2 class="text-[0.78em] font-bold uppercase tracking-wide text-muted">Các lần làm bài</h2>
      ${
        attempts.length
          ? `<div class="mt-2 grid gap-2">${attempts
              .slice()
              .reverse()
              .slice(0, 10)
              .map(
                (a) => `<a href="#/quiz/${bank.slug}/result/${a.id}" class="flex items-center gap-3 rounded-xl border border-line bg-card px-3 py-2">
                <span class="text-[1.1em] font-bold ${a.score >= PASS ? 'text-ok' : 'text-bad'}">${a.score}%</span>
                <span class="min-w-0 flex-1"><span class="block truncate text-[0.88em] font-semibold">${C.esc(a.scope)}</span><span class="block text-[0.75em] text-muted">${new Date(a.at).toLocaleString('vi-VN')} · ${a.n} câu</span></span>
              </a>`,
              )
              .join('')}</div>`
          : '<p class="mt-2 text-[0.9em] text-muted">Chưa có lần làm bài nào.</p>'
      }
    </section>
  </main>`
  C.$app.onclick = (e) => {
    const go = e.target.closest('[data-go]')
    if (go) location.hash = go.dataset.go
  }
}

/* ---------- browse the bank ---------- */

function renderBank(bank, state = { article: '', type: '', level: '', scenario: '', shown: 20 }) {
  const list = bank.questions.filter(
    (q) =>
      (!state.article || q.article === state.article) &&
      (!state.type || q.type === state.type) &&
      (!state.level || String(q.level) === state.level) &&
      (!state.scenario || q.scenario),
  )
  const sel = (name, options, value) =>
    `<select data-filter="${name}" class="h-11 min-w-0 rounded-xl border border-line bg-card px-2 text-[0.85em]">${options.map(([v, l]) => `<option value="${C.esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${C.esc(l)}</option>`).join('')}</select>`
  C.$app.innerHTML = `
  ${C.topBar({ left: back(`#/quiz/${bank.slug}`, 'Luyện thi'), title: 'Ngân hàng câu hỏi' })}
  <main class="reading mx-auto max-w-3xl px-3 pb-[calc(2rem+env(safe-area-inset-bottom))]">
    <div class="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-3 grid grid-cols-2 gap-2 bg-paper/95 px-3 py-2 backdrop-blur">
      ${sel('article', [['', 'Tất cả các bài'], ...bank.series.articles.map((a) => [a.id, `${a.n}. ${a.titleVi}`])], state.article)}
      ${sel('type', [['', 'Mọi dạng câu'], ...Object.entries(TYPES)], state.type)}
      ${sel('level', [['', 'Mọi mức độ'], ...Object.entries(LEVELS)], state.level)}
      ${sel('scenario', [['', 'Mọi câu'], ['1', 'Chỉ câu tình huống']], state.scenario)}
    </div>
    <p class="mt-2 text-[0.85em] text-muted">${list.length} câu</p>
    <div class="mt-2 grid gap-3">
      ${list
        .slice(0, state.shown)
        .map(
          (q, i) => `<article class="rounded-2xl border border-line bg-card p-4">
          <div class="flex flex-wrap gap-1.5">${qBadges(bank, q)}</div>
          ${questionHtml(bank, q, null, { review: false, index: i })}
          <details class="mt-3">
            <summary class="cursor-pointer font-semibold text-accent">Xem đáp án</summary>
            ${reviewHtml(bank, q, null, true)}
          </details>
        </article>`,
        )
        .join('')}
    </div>
    ${list.length > state.shown ? `<div class="mt-4 text-center">${btn('data-more', `Xem thêm (${list.length - state.shown})`, 'ghost')}</div>` : ''}
  </main>`
  C.$app.onclick = (e) => {
    if (e.target.closest('[data-more]')) renderBank(bank, { ...state, shown: state.shown + 20 })
  }
  C.$app.onchange = (e) => {
    const f = e.target.closest('[data-filter]')
    if (f) renderBank(bank, { ...state, [f.dataset.filter]: f.value, shown: 20 })
  }
}

/* ---------- exam setup ---------- */

function renderSetup(bank) {
  const setup = getSetup(bank)
  const stats = getStats(bank.slug)
  const available = pool(bank, setup).length
  const save = () => C.store.set(key(bank.slug, 'setup'), setup)
  const chip = (group, value, label, on) =>
    `<button type="button" data-set="${group}" data-value="${C.esc(value)}" class="min-h-11 rounded-xl border px-3 py-1.5 text-[0.85em] font-semibold ${on ? 'border-accent bg-accent text-on-accent' : 'border-line bg-card'}">${C.esc(label)}</button>`
  const check = (group, value, label, on) =>
    `<label class="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-[0.88em]"><input type="checkbox" data-toggle="${group}" value="${C.esc(value)}" ${on ? 'checked' : ''} class="size-5 shrink-0 accent-[var(--accent)]" /><span>${label}</span></label>`
  let part = ''
  const n = setup.count ? Math.min(setup.count, available) : available

  C.$app.innerHTML = `
  ${C.topBar({ left: back(`#/quiz/${bank.slug}`, 'Luyện thi'), title: 'Tạo bài thi' })}
  <main class="reading mx-auto max-w-3xl space-y-5 px-3 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4">
    <section>
      <h2 class="mb-2 font-bold">Chế độ</h2>
      <div class="grid grid-cols-2 gap-2">${chip('mode', 'exam', 'Thi thử', setup.mode === 'exam')}${chip('mode', 'practice', 'Luyện tập', setup.mode === 'practice')}</div>
      <p class="mt-1.5 text-[0.82em] text-muted">${setup.mode === 'exam' ? 'Làm hết rồi nộp bài, có giờ làm bài, chấm điểm và phân tích ở cuối.' : 'Kiểm tra đáp án và đọc giải thích ngay sau mỗi câu.'}</p>
    </section>
    <section>
      <h2 class="mb-2 font-bold">Số câu</h2>
      <div class="grid grid-cols-5 gap-2">${COUNTS.map((c) => chip('count', c, c ? String(c) : 'Tất cả', setup.count === c)).join('')}</div>
    </section>
    <section>
      <h2 class="mb-2 font-bold">Thời gian</h2>
      <div class="grid grid-cols-3 gap-2">${TIMES.map((t) => chip('minutes', t, t ? `${t} phút` : 'Không giới hạn', setup.minutes === t)).join('')}</div>
    </section>
    <section>
      <div class="mb-2 flex items-center gap-2"><h2 class="flex-1 font-bold">Phạm vi bài</h2>${btn('data-all="articles"', 'Tất cả', 'ghost')}${btn('data-none="articles"', 'Bỏ hết', 'ghost')}</div>
      <div class="grid gap-2">
        ${bank.series.articles
          .map((a) => {
            const head = a.part && a.part !== part ? `<div class="mt-2 text-[0.75em] font-bold uppercase tracking-wide text-muted">${C.esc((part = a.part))}</div>` : ''
            const k = bank.questions.filter((q) => q.article === a.id).length
            return k ? head + check('articles', a.id, `${a.n}. ${C.esc(a.titleVi)} <span class="text-muted">(${k})</span>`, setup.articles.includes(a.id)) : ''
          })
          .join('')}
      </div>
    </section>
    <section>
      <h2 class="mb-2 font-bold">Mức độ</h2>
      <div class="grid gap-2 sm:grid-cols-3">${Object.entries(LEVELS).map(([v, l]) => check('levels', v, l, setup.levels.includes(Number(v)))).join('')}</div>
    </section>
    <section>
      <h2 class="mb-2 font-bold">Dạng câu hỏi</h2>
      <div class="grid gap-2 sm:grid-cols-2">${Object.entries(TYPES).map(([v, l]) => check('types', v, l, setup.types.includes(v))).join('')}</div>
    </section>
    <section>
      <h2 class="mb-2 font-bold">Câu tình huống</h2>
      <div class="grid grid-cols-2 gap-2">${chip('scenario', 'any', 'Trộn mọi loại', setup.scenario === 'any')}${chip('scenario', 'only', 'Chỉ câu tình huống', setup.scenario === 'only')}</div>
    </section>
    <section>
      <label class="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-line bg-card px-3 py-2 text-[0.88em] font-semibold">
        <span>Ưu tiên câu chưa làm và câu lần trước làm sai</span>
        <input type="checkbox" data-smart ${setup.smart ? 'checked' : ''} class="size-5 shrink-0 accent-[var(--accent)]" />
      </label>
      <p class="mt-1.5 text-[0.78em] text-muted">Đã có thống kê cho ${Object.keys(stats).length} câu trên máy này.</p>
    </section>
  </main>
  <nav class="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
    <div class="mx-auto flex max-w-3xl items-center gap-3 px-3 py-2">
      <span class="flex-1 text-[0.85em]">${available ? `Có <b>${available}</b> câu phù hợp, đề gồm <b>${n}</b> câu.` : 'Không có câu nào phù hợp. Hãy nới điều kiện.'}</span>
      ${btn(`data-create ${available ? '' : 'disabled'}`, 'Tạo bài thi')}
    </div>
  </nav>`

  C.$app.onclick = (e) => {
    const t = e.target.closest('[data-set],[data-all],[data-none],[data-create]')
    if (!t) return
    if (t.dataset.set) {
      const v = t.dataset.value
      setup[t.dataset.set] = ['count', 'minutes'].includes(t.dataset.set) ? Number(v) : v
      if (t.dataset.set === 'mode') setup.minutes = v === 'practice' ? 0 : setup.minutes || 30
    } else if (t.dataset.all) setup.articles = [...bank.arts.keys()]
    else if (t.dataset.none) setup.articles = []
    else if (t.hasAttribute('data-create')) {
      if (getSession(bank.slug) && !confirm('Bạn đang có một bài làm dở. Tạo bài mới sẽ bỏ bài đó. Tiếp tục?')) return
      save()
      return startSession(bank, setup, generate(bank, setup, getStats(bank.slug)))
    }
    save()
    renderSetup(bank)
  }
  C.$app.onchange = (e) => {
    const t = e.target
    if (t.dataset.toggle) {
      const group = t.dataset.toggle
      const v = group === 'levels' ? Number(t.value) : t.value
      setup[group] = t.checked ? [...new Set([...setup[group], v])] : setup[group].filter((x) => x !== v)
    } else if (t.hasAttribute('data-smart')) setup.smart = t.checked
    else return
    save()
    renderSetup(bank)
  }
}

/* ---------- question rendering ---------- */

/** The question and its answer controls. item: the exam item (null when only browsing). */
function questionHtml(bank, q, item, { review = false } = {}) {
  const locked = review || item?.checked
  const ans = item?.ans
  const context = q.scenario && q.context ? `<div class="mt-3 rounded-xl border-l-4 border-accent/60 bg-accent/5 px-3 py-2 text-[0.92em] leading-relaxed"><div class="text-[0.75em] font-bold uppercase tracking-wide text-accent">Tình huống</div>${C.esc(q.context)}</div>` : ''
  const head = `${context}<p class="mt-3 font-bold leading-snug">${C.esc(q.question)}</p>`
  if (!item) {
    // Browsing: plain list of what the reader would see
    if (q.type === 'single' || q.type === 'multi') return head + `<ol class="mt-2 list-[upper-alpha] space-y-1 pl-6 text-[0.95em]">${q.options.map((o) => `<li>${C.esc(o)}</li>`).join('')}</ol>`
    if (q.type === 'match') return head + `<ul class="mt-2 space-y-1 text-[0.95em]">${q.pairs.map((p) => `<li>• ${C.esc(p.left)}</li>`).join('')}</ul>`
    if (q.type === 'order') return head + `<ul class="mt-2 space-y-1 text-[0.95em]">${shuffle(q.items).map((t) => `<li>• ${C.esc(t)}</li>`).join('')}</ul>`
    return head
  }
  const choice = (attrs, label, on, mark = '') =>
    `<button type="button" ${attrs} ${locked ? 'disabled' : ''} class="flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-[0.95em] ${on ? 'border-accent bg-accent/10' : 'border-line bg-card'} ${mark}">${label}</button>`
  const markOf = (correct, chosen) => (!locked ? '' : correct ? 'ring-2 ring-ok' : chosen ? 'ring-2 ring-bad' : '')
  if (q.type === 'single' || q.type === 'truefalse') {
    const opts = q.type === 'truefalse' ? [[true, 'Đúng'], [false, 'Sai']] : item.perm.map((o) => [o, q.options[o]])
    return (
      head +
      `<div class="mt-3 grid gap-2">${opts
        .map(([v, label], i) => {
          const on = ans === v
          const letter = q.type === 'truefalse' ? '' : `<span class="font-bold text-muted">${String.fromCharCode(65 + i)}.</span>`
          return choice(`data-pick="${C.esc(String(v))}"`, `<span class="grid size-5 shrink-0 place-items-center rounded-full border-2 ${on ? 'border-accent bg-accent' : 'border-muted'}"></span>${letter}<span>${C.esc(label)}</span>`, on, markOf(v === q.answer, on))
        })
        .join('')}</div>`
    )
  }
  if (q.type === 'multi') {
    const set = new Set(ans ?? [])
    return (
      head +
      `${/chọn tất cả/i.test(q.question) ? '' : '<p class="mt-1 text-[0.8em] text-muted">Chọn tất cả phương án đúng.</p>'}<div class="mt-2 grid gap-2">${item.perm
        .map((o, i) => {
          const on = set.has(o)
          return choice(`data-toggle-opt="${o}"`, `<span class="grid size-5 shrink-0 place-items-center rounded border-2 ${on ? 'border-accent bg-accent text-on-accent' : 'border-muted'}">${on ? '✓' : ''}</span><span class="font-bold text-muted">${String.fromCharCode(65 + i)}.</span><span>${C.esc(q.options[o])}</span>`, on, markOf(q.answer.includes(o), on))
        })
        .join('')}</div>`
    )
  }
  if (q.type === 'match') {
    return (
      head +
      `<p class="mt-1 text-[0.8em] text-muted">Chọn vế phải phù hợp cho từng vế trái.</p><div class="mt-2 grid gap-2">${q.pairs
        .map((p, li) => {
          const mark = locked ? (ans[li] === li ? 'border-ok' : 'border-bad') : 'border-line'
          return `<div class="rounded-xl border ${mark} bg-card p-3">
            <div class="font-semibold">${C.esc(p.left)}</div>
            <select data-match="${li}" ${locked ? 'disabled' : ''} class="mt-2 h-11 w-full rounded-lg border border-line bg-paper px-2 text-[0.92em]">
              <option value="">— Chọn —</option>
              ${item.perm.map((r) => `<option value="${r}" ${ans[li] === r ? 'selected' : ''}>${C.esc(q.pairs[r].right)}</option>`).join('')}
            </select>
          </div>`
        })
        .join('')}</div>`
    )
  }
  if (q.type === 'order') {
    return (
      head +
      `<p class="mt-1 text-[0.8em] text-muted">Dùng nút ▲ ▼ để xếp từ trên (đầu tiên) xuống dưới (cuối cùng).</p><ol class="mt-2 grid gap-2">${ans
        .map((v, pos) => {
          const mark = locked ? (v === pos ? 'border-ok' : 'border-bad') : 'border-line'
          return `<li class="flex items-center gap-2 rounded-xl border ${mark} bg-card py-1.5 pl-3 pr-1 text-[0.95em]">
            <span class="font-bold text-muted">${pos + 1}.</span><span class="flex-1">${C.esc(q.items[v])}</span>
            ${locked ? '' : `<button type="button" data-move="${pos}:-1" ${pos === 0 ? 'disabled' : ''} class="grid size-10 place-items-center rounded-lg border border-line disabled:opacity-30" aria-label="Lên">▲</button><button type="button" data-move="${pos}:1" ${pos === ans.length - 1 ? 'disabled' : ''} class="grid size-10 place-items-center rounded-lg border border-line disabled:opacity-30" aria-label="Xuống">▼</button>`}
          </li>`
        })
        .join('')}</ol>`
    )
  }
  return head
}

/** The correct answer, the explanation and a link to the article section. */
function reviewHtml(bank, q, item, browsing = false) {
  let correct = ''
  if (q.type === 'single') correct = `Đáp án đúng: ${C.esc(q.options[q.answer])}`
  else if (q.type === 'truefalse') correct = `Đáp án đúng: ${q.answer ? 'Đúng' : 'Sai'}`
  else if (q.type === 'multi') correct = `Các đáp án đúng:<ul class="mt-1 list-disc pl-5">${q.answer.map((i) => `<li>${C.esc(q.options[i])}</li>`).join('')}</ul>`
  else if (q.type === 'match') correct = `Cặp đúng:<ul class="mt-1 list-disc pl-5">${q.pairs.map((p) => `<li>${C.esc(p.left)} → ${C.esc(p.right)}</li>`).join('')}</ul>`
  else if (q.type === 'order') correct = `Thứ tự đúng:<ol class="mt-1 list-decimal pl-5">${q.items.map((t) => `<li>${C.esc(t)}</li>`).join('')}</ol>`
  const score = item && !browsing ? grade(q, item.ans) : null
  const verdict =
    score == null ? '' : score === 1 ? '<div class="font-bold text-ok">Chính xác</div>' : score > 0 ? `<div class="font-bold text-bad">Đúng một phần (${pct(score)}%)</div>` : `<div class="font-bold text-bad">${answered(q, item.ans) ? 'Chưa đúng' : 'Chưa trả lời'}</div>`
  return `<div class="mt-3 space-y-2 rounded-xl bg-line/40 p-3 text-[0.92em] leading-relaxed">
    ${verdict}
    <div>${correct}</div>
    <div class="text-muted">${C.esc(q.explanation ?? '')}</div>
    <a href="#/a/s:${C.esc(bank.series.slug)}/${C.esc(q.article)}" class="inline-block font-semibold text-accent">Ôn lại: Bài ${artNo(bank, q.article)}${q.section ? ` · ${C.esc(q.section)}` : ''}</a>
  </div>`
}

/* ---------- taking the exam ---------- */

function renderRun(bank) {
  const s = getSession(bank.slug)
  if (!s) return void location.replace(`#/quiz/${bank.slug}`)
  s.items = s.items.filter((it) => bank.byId.has(it.id))
  const item = s.items[s.i]
  const q = bank.byId.get(item.id)
  const practice = s.mode === 'practice'
  const done = s.items.filter((it) => answered(bank.byId.get(it.id), it.ans)).length
  const left = () => (s.deadline ? Math.max(0, s.deadline - Date.now()) : null)
  const clock = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`

  C.$app.innerHTML = `
  ${C.topBar({
    left: back(`#/quiz/${bank.slug}`, 'Tạm dừng'),
    title: `Câu ${s.i + 1}/${s.items.length}`,
    right: s.deadline ? `<span id="quiz-clock" class="px-2 font-mono text-[0.95em] font-bold">${clock(left())}</span>` : '',
  })}
  <main class="reading mx-auto max-w-3xl px-3 pb-[calc(9rem+env(safe-area-inset-bottom))]">
    <div class="no-scrollbar -mx-3 mt-2 flex gap-1.5 overflow-x-auto px-3 py-1">
      ${s.items
        .map((it, k) => {
          const qq = bank.byId.get(it.id)
          const has = answered(qq, it.ans)
          const cls = k === s.i ? 'ring-2 ring-accent' : ''
          const fill = practice && it.checked ? (grade(qq, it.ans) === 1 ? 'bg-ok text-white' : 'bg-bad text-white') : has ? 'bg-accent text-on-accent' : 'bg-card'
          return `<button data-jump="${k}" class="relative size-9 shrink-0 rounded-lg border border-line text-[0.8em] font-bold ${fill} ${cls}">${k + 1}${it.flag ? '<span class="absolute -right-1 -top-1 size-2.5 rounded-full bg-hot"></span>' : ''}</button>`
        })
        .join('')}
    </div>
    <article class="mt-2 rounded-2xl border border-line bg-card p-4">
      <div class="flex flex-wrap gap-1.5">${qBadges(bank, q)}</div>
      ${questionHtml(bank, q, item)}
      ${practice && item.checked ? reviewHtml(bank, q, item) : ''}
    </article>
    <p class="mt-3 text-center text-[0.8em] text-muted">${s.scope} · đã trả lời ${done}/${s.items.length}</p>
  </main>
  <nav class="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
    <div class="mx-auto grid max-w-3xl grid-cols-4 gap-2 px-3 py-2">
      ${btn(`data-nav="-1" ${s.i === 0 ? 'disabled' : ''}`, 'Trước', 'ghost')}
      ${btn('data-flag', item.flag ? 'Bỏ đánh dấu' : 'Đánh dấu', 'ghost')}
      ${
        practice && !item.checked
          ? btn(`data-check ${answered(q, item.ans) ? '' : 'disabled'}`, 'Kiểm tra')
          : btn(`data-nav="1" ${s.i === s.items.length - 1 ? 'disabled' : ''}`, 'Tiếp')
      }
      ${btn('data-submit', practice ? 'Kết thúc' : 'Nộp bài', 'hot')}
    </div>
  </nav>`
  scrollTo(0, 0)

  const save = () => saveSession(bank.slug, s)
  const redraw = () => {
    const y = scrollY
    save()
    renderRun(bank)
    scrollTo(0, y)
  }
  C.$app.onclick = (e) => {
    const t = e.target.closest('[data-pick],[data-toggle-opt],[data-move],[data-jump],[data-nav],[data-flag],[data-check],[data-submit]')
    if (!t || t.disabled) return
    if (t.dataset.pick != null) item.ans = q.type === 'truefalse' ? t.dataset.pick === 'true' : Number(t.dataset.pick)
    else if (t.dataset.toggleOpt != null) {
      const o = Number(t.dataset.toggleOpt)
      const set = new Set(item.ans ?? [])
      set.has(o) ? set.delete(o) : set.add(o)
      item.ans = [...set].sort((a, b) => a - b)
    } else if (t.dataset.move) {
      const [pos, dir] = t.dataset.move.split(':').map(Number)
      const a = item.ans
      ;[a[pos], a[pos + dir]] = [a[pos + dir], a[pos]]
    } else if (t.dataset.jump) s.i = Number(t.dataset.jump)
    else if (t.dataset.nav) s.i = Math.min(s.items.length - 1, Math.max(0, s.i + Number(t.dataset.nav)))
    else if (t.hasAttribute('data-flag')) item.flag = !item.flag
    else if (t.hasAttribute('data-check')) item.checked = true
    else if (t.hasAttribute('data-submit')) {
      const missing = s.items.length - done
      const msg = missing ? `Còn ${missing} câu chưa trả lời. ${practice ? 'Kết thúc' : 'Nộp bài'} ngay?` : `${practice ? 'Kết thúc' : 'Nộp bài'} ngay?`
      if (confirm(msg)) finish(bank, s)
      return
    }
    if (t.dataset.jump || t.dataset.nav) {
      save()
      return renderRun(bank)
    }
    redraw()
  }
  C.$app.onchange = (e) => {
    const sel = e.target.closest('[data-match]')
    if (!sel) return
    item.ans[Number(sel.dataset.match)] = sel.value === '' ? null : Number(sel.value)
    redraw()
  }
  if (s.deadline) {
    timer = setInterval(() => {
      const el = document.getElementById('quiz-clock')
      const ms = left()
      if (el) el.textContent = clock(ms)
      if (ms <= 0) {
        stopTimer()
        alert('Hết giờ làm bài. Hệ thống tự nộp bài.')
        finish(bank, getSession(bank.slug) ?? s)
      }
    }, 1000)
  }
}

function finish(bank, s) {
  stopTimer()
  const stats = getStats(bank.slug)
  const results = s.items.map((it) => {
    const q = bank.byId.get(it.id)
    const score = grade(q, it.ans)
    const st = stats[it.id] ?? { seen: 0, right: 0 }
    st.seen++
    if (score === 1) st.right++
    st.lastRight = score === 1
    stats[it.id] = st
    return { ...it, score }
  })
  const total = results.reduce((n, r) => n + r.score, 0)
  const attempt = {
    id: s.id,
    at: Date.now(),
    mode: s.mode,
    scope: s.scope,
    n: results.length,
    seconds: Math.round((Date.now() - s.createdAt) / 1000),
    score: results.length ? pct(total / results.length) : 0,
    items: results,
  }
  C.store.set(key(bank.slug, 'stats'), stats)
  C.store.set(key(bank.slug, 'attempts'), [...getAttempts(bank.slug), attempt].slice(-KEEP_ATTEMPTS))
  C.store.set(key(bank.slug, 'session'), null)
  location.hash = `#/quiz/${bank.slug}/result/${attempt.id}`
}

/* ---------- result ---------- */

function scenarioBar(items, bank, bar) {
  const g = items.filter((it) => bank.byId.get(it.id).scenario).reduce((g, it) => ({ sum: g.sum + it.score, n: g.n + 1 }), { sum: 0, n: 0 })
  return g.n ? bar('Câu tình huống', g) : ''
}

function verdict(score) {
  if (score >= 90) return ['Xuất sắc', 'Bạn nắm vững nội dung ở mức có thể tự tin đảm nhận vai trò.']
  if (score >= PASS) return ['Đạt', 'Nền tảng tốt. Ôn lại các câu sai để chắc chắn hơn.']
  if (score >= 60) return ['Cần ôn thêm', 'Bạn đã hiểu phần lớn, nhưng còn lỗ hổng ở vài chủ đề bên dưới.']
  return ['Chưa đạt', 'Hãy đọc lại các bài có điểm thấp rồi luyện tập theo từng bài.']
}

function renderResult(bank, id, onlyWrong = false) {
  const a = getAttempts(bank.slug).find((x) => x.id === id)
  if (!a) return void location.replace(`#/quiz/${bank.slug}`)
  const items = a.items.filter((it) => bank.byId.has(it.id))
  const group = (keyOf) => {
    const m = new Map()
    for (const it of items) {
      const k = keyOf(bank.byId.get(it.id))
      const g = m.get(k) ?? { sum: 0, n: 0 }
      g.sum += it.score
      g.n++
      m.set(k, g)
    }
    return [...m.entries()]
  }
  const bar = (label, g, extra = '') => `<div class="min-w-0 rounded-xl border border-line bg-card px-3 py-2">
    <div class="flex items-baseline gap-2 text-[0.88em]"><span class="min-w-0 flex-1 truncate font-semibold">${label}</span><span class="shrink-0 font-bold ${pct(g.sum / g.n) >= PASS ? 'text-ok' : 'text-bad'}">${pct(g.sum / g.n)}%</span><span class="shrink-0 text-muted">${g.n} câu</span></div>
    <div class="mt-1.5 h-1.5 rounded-full bg-line"><div class="h-1.5 rounded-full ${pct(g.sum / g.n) >= PASS ? 'bg-ok' : 'bg-bad'}" style="width:${pct(g.sum / g.n)}%"></div></div>${extra}</div>`
  const [title, advice] = verdict(a.score)
  const wrong = items.filter((it) => it.score < 1)
  const shown = onlyWrong ? wrong : items
  const byArticle = group((q) => q.article).sort((x, y) => artNo(bank, x[0]) - artNo(bank, y[0]))

  C.$app.innerHTML = `
  ${C.topBar({ left: back(`#/quiz/${bank.slug}`, 'Luyện thi'), title: 'Kết quả' })}
  <main class="reading mx-auto max-w-3xl px-3 pb-[calc(2rem+env(safe-area-inset-bottom))]">
    <section class="mt-4 rounded-2xl border border-line bg-card p-4 text-center">
      <div class="text-[3em] font-bold leading-none ${a.score >= PASS ? 'text-ok' : 'text-bad'}">${a.score}%</div>
      <div class="mt-2 text-[1.15em] font-bold">${title}</div>
      <p class="mt-1 text-[0.9em] text-muted">${advice}</p>
      <p class="mt-2 text-[0.8em] text-muted">${C.esc(a.scope)} · ${a.n} câu · đúng hoàn toàn ${items.length - wrong.length} câu · ${Math.floor(a.seconds / 60)} phút ${a.seconds % 60} giây · ngưỡng đạt ${PASS}%</p>
      <div class="mt-3 flex flex-wrap justify-center gap-2">
        ${wrong.length ? btn('data-retry', `Làm lại ${wrong.length} câu chưa đúng`, 'hot') : ''}
        ${btn(`data-go="#/quiz/${bank.slug}/new"`, 'Tạo bài thi mới')}
      </div>
    </section>

    <section class="mt-5">
      <h2 class="text-[0.78em] font-bold uppercase tracking-wide text-muted">Theo bài</h2>
      <div class="mt-2 grid gap-2">${byArticle
        .map(([art, g]) => bar(`${artNo(bank, art)}. ${C.esc(artTitle(bank, art))}`, g, pct(g.sum / g.n) < PASS ? `<a href="#/a/s:${C.esc(bank.series.slug)}/${C.esc(art)}" class="mt-1 inline-block text-[0.8em] font-semibold text-accent">Đọc lại bài này</a>` : ''))
        .join('')}</div>
    </section>
    <section class="mt-5 grid gap-4 sm:grid-cols-2">
      <div><h2 class="text-[0.78em] font-bold uppercase tracking-wide text-muted">Theo mức độ</h2><div class="mt-2 grid gap-2">${group((q) => q.level).sort((x, y) => x[0] - y[0]).map(([l, g]) => bar(LEVELS[l], g)).join('')}</div></div>
      <div><h2 class="text-[0.78em] font-bold uppercase tracking-wide text-muted">Theo dạng câu</h2><div class="mt-2 grid gap-2">${group((q) => q.type).map(([t, g]) => bar(TYPES[t], g)).join('')}${scenarioBar(items, bank, bar)}</div></div>
    </section>

    <section class="mt-6">
      <div class="flex items-center gap-2">
        <h2 class="flex-1 text-[0.78em] font-bold uppercase tracking-wide text-muted">Xem lại bài làm</h2>
        ${btn('data-filter-wrong', onlyWrong ? 'Hiện tất cả' : 'Chỉ câu chưa đúng', 'ghost')}
      </div>
      <div class="mt-2 grid gap-3">${shown
        .map((it) => {
          const q = bank.byId.get(it.id)
          return `<article class="rounded-2xl border ${it.score === 1 ? 'border-ok/60' : 'border-bad/60'} bg-card p-4">
            <div class="flex flex-wrap gap-1.5">${badge(`Câu ${items.indexOf(it) + 1}`)} ${qBadges(bank, q)}</div>
            ${questionHtml(bank, q, it, { review: true })}
            ${reviewHtml(bank, q, it)}
          </article>`
        })
        .join('')}</div>
    </section>
  </main>`
  C.$app.onclick = (e) => {
    const t = e.target.closest('[data-go],[data-retry],[data-filter-wrong]')
    if (!t) return
    if (t.dataset.go) location.hash = t.dataset.go
    else if (t.hasAttribute('data-filter-wrong')) renderResult(bank, id, !onlyWrong)
    else if (t.hasAttribute('data-retry')) {
      const setup = { ...getSetup(bank), mode: 'practice', minutes: 0 }
      startSession(bank, { ...setup, articles: [...new Set(wrong.map((it) => bank.byId.get(it.id).article))] }, shuffle(wrong.map((it) => newItem(bank.byId.get(it.id)))))
    }
  }
}
