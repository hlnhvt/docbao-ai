/**
 * Sounds around reading aloud, all synthesised with the Web Audio API (no audio files):
 * a soft background pad under the voice, a short "swish" between articles in continuous reading,
 * and a screen wake lock so a phone does not sleep (and silence the voice) while reading.
 */

let ctx = null

/** Must first be called from a tap: browsers only start audio after a user gesture. */
export function unlockAudio() {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
  } catch {
    ctx = null
  }
  return ctx
}

/* ---------- Background pad ---------- */

// Slow, calm progression (Cmaj7, Am7, Fmaj7, G6), voiced low so it stays under the voice
const CHORDS = [
  [130.81, 164.81, 196.0, 246.94],
  [110.0, 130.81, 164.81, 196.0],
  [87.31, 130.81, 174.61, 220.0],
  [98.0, 146.83, 196.0, 246.94],
]
const CHORD_SECONDS = 9

let pad = null

export const Music = {
  get playing() {
    return !!pad
  },
  /** level: master gain, small (0.02 to 0.16). */
  start(level) {
    const ac = unlockAudio()
    if (!ac) return
    if (pad) return this.setLevel(level)
    const master = ac.createGain()
    master.gain.value = 0
    master.gain.setTargetAtTime(level, ac.currentTime, 1.2)
    const filter = ac.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 900
    filter.connect(master).connect(ac.destination)
    // Slow swell, so the pad breathes instead of droning
    const lfo = ac.createOscillator()
    const lfoDepth = ac.createGain()
    lfo.frequency.value = 0.07
    lfoDepth.gain.value = 0.25
    const swell = ac.createGain()
    swell.gain.value = 0.75
    lfo.connect(lfoDepth).connect(swell.gain)
    swell.connect(filter)
    const voices = CHORDS[0].map((f, i) => {
      const osc = ac.createOscillator()
      osc.type = i % 2 ? 'triangle' : 'sine'
      osc.frequency.value = f
      osc.detune.value = (i - 1.5) * 4
      const g = ac.createGain()
      g.gain.value = 0.22
      osc.connect(g).connect(swell)
      osc.start()
      return osc
    })
    lfo.start()
    let step = 0
    const timer = setInterval(() => {
      step = (step + 1) % CHORDS.length
      const t = ac.currentTime
      voices.forEach((o, i) => o.frequency.setTargetAtTime(CHORDS[step][i], t, 1.5))
    }, CHORD_SECONDS * 1000)
    pad = { master, voices, lfo, timer }
  },
  setLevel(level) {
    if (pad && ctx) pad.master.gain.setTargetAtTime(level, ctx.currentTime, 0.3)
  },
  stop() {
    if (!pad || !ctx) return
    const { master, voices, lfo, timer } = pad
    pad = null
    clearInterval(timer)
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.25)
    setTimeout(() => {
      voices.forEach((o) => o.stop())
      lfo.stop()
      master.disconnect()
    }, 1500)
  },
}

/* ---------- Swish between articles ---------- */

export function playSwish() {
  const ac = unlockAudio()
  if (!ac) return Promise.resolve()
  const seconds = 0.45
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const noise = ac.createBufferSource()
  noise.buffer = buffer
  const band = ac.createBiquadFilter()
  band.type = 'bandpass'
  band.Q.value = 1.2
  const t = ac.currentTime
  band.frequency.setValueAtTime(700, t)
  band.frequency.exponentialRampToValueAtTime(4200, t + seconds)
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.12)
  g.gain.exponentialRampToValueAtTime(0.0001, t + seconds)
  noise.connect(band).connect(g).connect(ac.destination)
  noise.start()
  return new Promise((done) => setTimeout(done, seconds * 1000 + 150))
}

/* ---------- Screen wake lock ---------- */

let lock = null
let wanted = false

export async function keepAwake(on) {
  wanted = on
  try {
    if (on && !lock && 'wakeLock' in navigator) {
      lock = await navigator.wakeLock.request('screen')
      lock.addEventListener('release', () => (lock = null))
    } else if (!on && lock) {
      await lock.release()
      lock = null
    }
  } catch {
    lock = null
  }
}

// The lock is dropped when the page is hidden; take it again on return
document.addEventListener('visibilitychange', () => {
  if (wanted && document.visibilityState === 'visible') keepAwake(true)
})
