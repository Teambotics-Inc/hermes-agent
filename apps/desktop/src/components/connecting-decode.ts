// These values are boot milestones, not elapsed-time percentages. Keep the
// reveal tied to the gateway's coarse phase updates so long waits do not imply
// smooth, time-based progress.
const REVEAL_MILESTONES = [8, 12, 24, 28, 32, 94, 95, 97, 100] as const

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

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function shuffleLetters(word: string, rng: () => number = Math.random): string {
  const letters = [...word]

  for (let index = letters.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.min(index, Math.floor(rng() * (index + 1)))

    ;[letters[index], letters[swapIndex]] = [letters[swapIndex], letters[index]]
  }

  return letters.join('')
}

export function alphabetNoise(length: number, rng: () => number = Math.random): string {
  return Array.from({ length }, () => ALPHABET[Math.min(ALPHABET.length - 1, Math.floor(rng() * ALPHABET.length))]).join('')
}

export function connectingPrefixLength(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 1
  }

  return 1 + REVEAL_MILESTONES.filter(milestone => progress >= milestone).length
}

export function connectingFlashForPrefix(prefixLength: number) {
  return CONNECTING_EASTER_EGGS.find(({ stage }) => stage === prefixLength) ?? null
}

export function connectingFrame(progress: number, rng: () => number = Math.random): string {
  const stage = Math.min(CONNECTING_EASTER_EGGS.length, connectingPrefixLength(progress))
  const word = connectingFlashForPrefix(stage)?.suffix ?? ''

  return alphabetNoise(stage, rng) + shuffleLetters(word, rng)
}
