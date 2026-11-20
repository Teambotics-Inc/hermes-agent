export const CONNECTING_EASTER_EGGS = [
  { stage: 1, suffix: 'OPENMODEL' },
  { stage: 2, suffix: 'OPENNESS' },
  { stage: 3, suffix: 'CREATOR' },
  { stage: 4, suffix: 'REASON' },
  { stage: 5, suffix: 'AGENT' },
  { stage: 6, suffix: 'MIND' },
  { stage: 7, suffix: 'OWN' },
  { stage: 8, suffix: 'AI' },
  { stage: 9, suffix: 'I' }
] as const

export const NOISE_FRAME_MS = 120
export const FORM_PER_CHAR_MS = 110
export const HOLD_MS = 1000
export const FINALE_HOLD_MS = 1200
export const GAP_MS = 400

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const CONNECTING_WORD = 'CONNECTING'
const CONNECTED_WORD = 'CONNECTED'

export const CONNECTING_READOUT = [
  CONNECTING_WORD,
  ...CONNECTING_EASTER_EGGS.map(({ suffix }) => suffix),
  CONNECTED_WORD
] as const

export type ReadoutMode = 'forming' | 'held' | 'gap'

export interface ReadoutFrame {
  mode: ReadoutMode
  text: string
}

export function alphabetNoise(length: number, rng: () => number = Math.random): string {
  return Array.from({ length }, () => ALPHABET[Math.min(ALPHABET.length - 1, Math.floor(rng() * ALPHABET.length))]).join('')
}

export function readoutCycleMs(): number {
  return CONNECTING_READOUT.reduce((duration, word) => {
    const form = word.length * FORM_PER_CHAR_MS
    const hold = word === CONNECTED_WORD ? FINALE_HOLD_MS : HOLD_MS
    const gap = GAP_MS

    return duration + form + hold + gap
  }, 0)
}

export function readoutFrameAt(elapsedMs: number, rng: () => number = Math.random): ReadoutFrame {
  const cycleMs = readoutCycleMs()
  let time = ((Math.max(0, elapsedMs) % cycleMs) + cycleMs) % cycleMs

  for (let index = 0; index < CONNECTING_READOUT.length; index += 1) {
    const word = CONNECTING_READOUT[index]
    const formMs = word.length * FORM_PER_CHAR_MS
    const holdMs = word === CONNECTED_WORD ? FINALE_HOLD_MS : HOLD_MS
    const nextWord = CONNECTING_READOUT[(index + 1) % CONNECTING_READOUT.length]
    const gapMs = GAP_MS

    if (time < formMs) {
      const resolved = Math.floor(time / FORM_PER_CHAR_MS)

      return {
        mode: 'forming',
        text: word.slice(0, resolved) + alphabetNoise(word.length - resolved, rng)
      }
    }

    time -= formMs

    if (time < holdMs) {
      return { mode: 'held', text: word }
    }

    time -= holdMs

    if (time < gapMs) {
      return { mode: 'gap', text: alphabetNoise(nextWord.length, rng) }
    }

    time -= gapMs
  }

  // The final gap wraps to CONNECTING; this is only reachable at a floating-point boundary.
  return { mode: 'forming', text: alphabetNoise(CONNECTING_WORD.length, rng) }
}
