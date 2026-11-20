import { describe, expect, it } from 'vitest'

import { CONNECTING_EASTER_EGGS, connectingPrefixLength } from './connecting-decode'

describe('connecting decode progress', () => {
  it('uses the gateway boot milestones to reveal letters without treating progress as elapsed time', () => {
    const milestones = [
      [0, 1],
      [6, 1],
      [7, 1],
      [8, 2],
      [12, 3],
      [24, 4],
      [28, 5],
      [32, 6],
      [94, 7],
      [95, 8],
      [97, 9],
      [100, 10],
      [120, 10]
    ] as const

    for (const [progress, expectedPrefix] of milestones) {
      expect(connectingPrefixLength(progress), `progress ${progress}`).toBe(expectedPrefix)
    }
  })

  it('keeps only the approved suffix Easter eggs, each sized for its unlocked tail', () => {
    expect(CONNECTING_EASTER_EGGS).toEqual([
      { stage: 1, suffix: 'OPENMODEL' },
      { stage: 2, suffix: 'OPENNESS' },
      { stage: 3, suffix: 'CREATOR' },
      { stage: 4, suffix: 'REASON' },
      { stage: 5, suffix: 'AGENT' },
      { stage: 6, suffix: 'MIND' },
      { stage: 7, suffix: 'OWN' },
      { stage: 8, suffix: 'AI' },
      { stage: 9, suffix: 'I' }
    ])

    for (const { stage, suffix } of CONNECTING_EASTER_EGGS) {
      expect(suffix).toHaveLength('CONNECTING'.length - stage)
    }
  })
})
