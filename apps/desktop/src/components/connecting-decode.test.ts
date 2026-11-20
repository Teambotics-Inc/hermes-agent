import { describe, expect, it } from 'vitest'

import {
  alphabetNoise,
  CONNECTING_EASTER_EGGS,
  CONNECTING_READOUT,
  FINALE_HOLD_MS,
  FORM_PER_CHAR_MS,
  GAP_MS,
  HOLD_MS,
  readoutCycleMs,
  readoutFrameAt
} from './connecting-decode'

describe('connecting timed readout', () => {
  it('derives the word sequence from the Easter egg table', () => {
    expect(CONNECTING_READOUT).toEqual([
      'CONNECTING',
      ...CONNECTING_EASTER_EGGS.map(({ suffix }) => suffix),
      'CONNECTED'
    ])
  })

  it('renders forming prefixes, holds, and next-word-length noise gaps at sampled times', () => {
    const rng = () => 0
    const firstFormMs = 'CONNECTING'.length * FORM_PER_CHAR_MS

    expect(readoutFrameAt(0, rng)).toEqual({ mode: 'forming', text: 'A'.repeat(10) })
    expect(readoutFrameAt(2 * FORM_PER_CHAR_MS, rng)).toEqual({ mode: 'forming', text: 'CO' + 'A'.repeat(8) })
    expect(readoutFrameAt(firstFormMs, rng)).toEqual({ mode: 'held', text: 'CONNECTING' })
    expect(readoutFrameAt(firstFormMs + HOLD_MS, rng)).toEqual({ mode: 'gap', text: 'A'.repeat('OPENMODEL'.length) })

    const openModelStart = firstFormMs + HOLD_MS + GAP_MS
    expect(readoutFrameAt(openModelStart + 3 * FORM_PER_CHAR_MS, rng)).toEqual({
      mode: 'forming',
      text: 'OPE' + 'A'.repeat('OPENMODEL'.length - 3)
    })
    expect(readoutFrameAt(openModelStart + 'OPENMODEL'.length * FORM_PER_CHAR_MS, rng)).toEqual({
      mode: 'held',
      text: 'OPENMODEL'
    })
  })

  it('holds CONNECTED for the finale duration, gaps, then wraps to CONNECTING', () => {
    const connectedIndex = CONNECTING_READOUT.length - 1
    const connectedStart = CONNECTING_READOUT.slice(0, connectedIndex).reduce((time, word) => time + word.length * FORM_PER_CHAR_MS + HOLD_MS + GAP_MS, 0)
    const connectedForm = 'CONNECTED'.length * FORM_PER_CHAR_MS

    expect(readoutFrameAt(connectedStart + connectedForm, () => 0)).toEqual({ mode: 'held', text: 'CONNECTED' })
    expect(readoutFrameAt(connectedStart + connectedForm + FINALE_HOLD_MS, () => 0)).toEqual({
      mode: 'gap',
      text: 'A'.repeat('CONNECTING'.length)
    })
    expect(readoutFrameAt(readoutCycleMs(), () => 0)).toEqual({ mode: 'forming', text: 'A'.repeat(10) })
  })

  it('uses uppercase alphabet-only noise', () => {
    expect(alphabetNoise(128, () => 0.5)).toMatch(/^[A-Z]{128}$/)
    expect(alphabetNoise(1, () => 1)).toBe('Z')
  })
})
