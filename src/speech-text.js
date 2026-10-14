/**
 * Rewrites article text into what should be *said*: dates and times in words the Vietnamese voice
 * reads naturally ("18/5" is "18 tháng 5", not "18 phần 5"), a few abbreviations spelled out, and
 * all-capital acronyms spelled letter by letter ("AI" is "ây ai"). Port of the Android app's
 * SpeechText, with the acronyms of AI news added.
 */

/** Letters or digits on either side mean we are inside a longer word: leave it alone. */
const B = '(?<![\\p{L}\\p{N}])'
const E = '(?![\\p{L}\\p{N}])'

/** Only unambiguous ones; longest first so "TP.HCM" wins over "TP". */
const ABBREVIATIONS = [
  ['TP.HCM', 'thành phố Hồ Chí Minh'], ['TP. HCM', 'thành phố Hồ Chí Minh'], ['TPHCM', 'thành phố Hồ Chí Minh'],
  ['GD&ĐT', 'giáo dục và đào tạo'], ['KH&CN', 'khoa học và công nghệ'], ['PGS.TS', 'phó giáo sư, tiến sĩ'],
  ['GS.TS', 'giáo sư, tiến sĩ'], ['CNTT', 'công nghệ thông tin'], ['KHCN', 'khoa học công nghệ'],
  ['ĐHQG', 'đại học quốc gia'], ['LHQ', 'Liên Hợp Quốc'], ['UBND', 'ủy ban nhân dân'], ['BĐS', 'bất động sản'],
  ['USD', 'đô la Mỹ'], ['VNĐ', 'đồng'], ['VND', 'đồng'], ['TP', 'thành phố'], ['VN', 'Việt Nam'],
]

const VI_LETTERS = {
  A: 'a', B: 'bê', C: 'xê', D: 'dê', Đ: 'đê', E: 'e', F: 'ép', G: 'giê', H: 'hát', I: 'i', J: 'gi', K: 'ca', L: 'lờ',
  M: 'mờ', N: 'nờ', O: 'o', P: 'pê', Q: 'quy', R: 'rờ', S: 'ét', T: 'tê', U: 'u', V: 'vê', W: 'vê kép', X: 'ích',
  Y: 'i', Z: 'dét',
}

const EN_LETTERS = {
  A: 'ây', B: 'bi', C: 'xi', D: 'đi', E: 'i', F: 'ép', G: 'gi', H: 'ết', I: 'ai', J: 'giây', K: 'kây', L: 'eo',
  M: 'em', N: 'en', O: 'âu', P: 'pi', Q: 'kiu', R: 'a', S: 'ét', T: 'ti', U: 'diu', V: 'vi', W: 'đáp liu', X: 'ích',
  Y: 'oai', Z: 'dét',
}

/** Acronyms Vietnamese speakers spell the English way. */
const SPELL_ENGLISH = new Set(
  ('AI AGI ASI API LLM GPT GLM GPU CPU TPU NPU HBM RAM SSD SDK CLI IDE UI UX ML RL RLHF RAG MCP OCR TTS ASR NLP ' +
    'VLM VLA MoE CEO CFO CTO COO IPO IMF GDP FBI CIA DNA MIT UC UCLA EU UK US USA AMD IBM AWS GCP SQL PDF URL HTML ' +
    'HTTP JSON XML CSS PC MC GPS USB ATM SMS IQ BBC CNN VPN HDMI SUV BMW AR VR XR FFT OCP MGX ICLR ICML CVPR ACL ' +
    'HN HF YC SF NY NYC DC OK').split(' '),
)

/** Acronyms said as one word: left for the voice to pronounce. */
const SAY_AS_WORD = new Set(
  'NVIDIA NASA NATO ASEAN UNESCO UNICEF COVID OPEC APEC FIFA UEFA LED AIDS WIFI SIM VIP SARS'.split(' '),
)

const CONSONANT = '(?:NGH|NG|NH|CH|GH|GI|KH|PH|QU|TH|TR|B|C|D|Đ|G|H|K|L|M|N|P|R|S|T|V|X)'
const NUCLEUS = '(?:OAI|OAY|UYE|UYA|UOI|IEU|YEU|AI|AO|AU|AY|EO|EU|IA|IE|IU|OA|OE|OI|OO|UA|UE|UI|UO|UU|UY|YE|A|E|I|O|U|Y)'
const CODA = '(?:CH|NG|NH|C|M|N|P|T)'
/** Capitals that read as a Vietnamese syllable ("HOT", "TIN") are words, not acronyms. */
const SYLLABLE = new RegExp(`^${CONSONANT}?${NUCLEUS}${CODA}?$`)
/** A well-formed Roman numeral (so "LLM" or "CLI" are not mistaken for one). */
const ROMAN = /^(?=[MDCLXVI])M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/
/** An all-capitals token of 2+ characters with at least one letter. */
const ACRONYM = new RegExp(`${B}(?=[A-ZĐ0-9]*[A-ZĐ])[A-ZĐ][A-ZĐ0-9]+${E}`, 'gu')
/** Three capital words in a row: a shouted phrase, read as words. */
const SHOUTED = new RegExp(`${B}[A-ZĐ]{2,}(?:\\s+[A-ZĐ]{2,}){2,}${E}`, 'gu')

const spellWith = (token, names) => (token.match(/[0-9]+|./gu) ?? []).map((c) => names[c] ?? c).join(' ')

function spell(token) {
  if (SPELL_ENGLISH.has(token)) return spellWith(token, EN_LETTERS)
  if (SAY_AS_WORD.has(token) || ROMAN.test(token)) return token
  if (!/[0-9]/.test(token) && SYLLABLE.test(token)) return token
  return spellWith(token, VI_LETTERS)
}

function spellAcronyms(text) {
  const shouted = [...text.matchAll(SHOUTED)].map((m) => [m.index, m.index + m[0].length])
  return text.replace(ACRONYM, (m, offset) => (shouted.some(([a, b]) => offset >= a && offset < b) ? m : spell(m)))
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const abbreviationPatterns = ABBREVIATIONS.map(([short, long]) => [new RegExp(B + escapeRe(short) + E, 'gu'), long])

const isDate = (d, m) => +d >= 1 && +d <= 31 && +m >= 1 && +m <= 12
const TIME_WORD = '(?:ngày|sáng|trưa|chiều|tối|đêm|rạng sáng|hôm)'

const RULES = [
  // 18/5/2026, 18-5-2026, 18.5.2026 → 18 tháng 5 năm 2026
  [new RegExp(`${B}(\\d{1,2})[/.-](\\d{1,2})[/.-](\\d{4})${E}`, 'gu'), (m, d, mo, y) => (isDate(d, mo) ? `${d} tháng ${mo} năm ${y}` : m)],
  // 5/2026 → tháng 5 năm 2026
  [new RegExp(`${B}(?:([Tt]háng)\\s+)?(\\d{1,2})/(\\d{4})${E}`, 'gu'), (m, w, mo, y) => (+mo >= 1 && +mo <= 12 ? `${w ?? 'tháng'} ${mo} năm ${y}` : m)],
  // 18/5 → 18 tháng 5
  [new RegExp(`${B}(\\d{1,2})/(\\d{1,2})${E}`, 'gu'), (m, d, mo) => (isDate(d, mo) ? `${d} tháng ${mo}` : m)],
  // "ngày 1.10", "sáng 2-10" → ngày 1 tháng 10 (only after a time word: "1.5" alone may be a decimal)
  [new RegExp(`(${TIME_WORD})\\s+(\\d{1,2})[.-](\\d{1,2})${E}`, 'giu'), (m, w, d, mo) => (isDate(d, mo) ? `${w} ${d} tháng ${mo}` : m)],
  // 14h30, 14h → 14 giờ 30, 14 giờ
  [new RegExp(`${B}(\\d{1,2})[hg](\\d{2})?${E}`, 'gu'), (m, h, min) => (+h <= 24 ? (min ? `${h} giờ ${min}` : `${h} giờ`) : m)],
]

export function forSpeech(text) {
  let s = String(text ?? '')
  // Dates first: "TP.HCM" must not be touched by them, and "18/5" must not reach the abbreviations
  for (const [re, fn] of RULES) s = s.replace(re, fn)
  for (const [re, long] of abbreviationPatterns) s = s.replace(re, long)
  return spellAcronyms(s)
}
