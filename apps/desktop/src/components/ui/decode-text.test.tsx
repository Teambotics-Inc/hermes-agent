// The decode scramble is decorative. Once a quiet-surface placeholder (empty
// pane zone, contrib panes) has resolved and held, its interval must be gone:
// a replaying default kept a 22 Hz setState ticker alive for as long as the
// mark was on screen, holding an otherwise idle renderer at ~16 commits/s
// (#98394). Only a caller that asks for `loop` (the boot overlay) replays.
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { DecodeText } from './decode-text'

const TICK_MS = 45
// half a char per tick + the 16-tick hold, with slack for the final tick.
const settleTicks = (text: string) => text.length * 2 + 16 + 4

beforeEach(() => {
  vi.useFakeTimers()
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ addEventListener: vi.fn(), matches: false, removeEventListener: vi.fn() })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

it('resolves once and stops ticking by default', () => {
  const { container } = render(<DecodeText prefix={1} text="HERMES" />)

  act(() => vi.advanceTimersByTime(settleTicks('HERMES') * TICK_MS))
  expect(container.textContent).toBe('HERMES')

  // Fully resolved and held: the timer must be gone, not replaying.
  expect(vi.getTimerCount()).toBe(0)
  act(() => vi.advanceTimersByTime(TICK_MS * 40))
  expect(container.textContent).toBe('HERMES')
})

it('keeps replaying only when the caller asks for loop', () => {
  const { container } = render(<DecodeText loop prefix={1} text="HERMES" />)

  act(() => vi.advanceTimersByTime(settleTicks('HERMES') * TICK_MS))
  expect(vi.getTimerCount()).toBe(1)

  // The replay scrambles the tail again at some point after the hold.
  const seen = new Set<string>()

  for (let i = 0; i < 40; i++) {
    act(() => vi.advanceTimersByTime(TICK_MS))
    seen.add(container.textContent ?? '')
  }

  expect(seen.size).toBeGreaterThan(1)
})

it('locks a rising progress prefix without restarting the scramble interval', () => {
  const interval = vi.spyOn(window, 'setInterval')
  const view = render(<DecodeText loop prefix={1} revealedPrefix={1} text="CONNECTING" />)

  expect(interval).toHaveBeenCalledTimes(1)

  view.rerender(<DecodeText loop prefix={1} revealedPrefix={4} text="CONNECTING" />)

  expect(view.container.textContent?.slice(0, 4)).toBe('CONN')
  expect(interval).toHaveBeenCalledTimes(1)

  view.unmount()
  expect(vi.getTimerCount()).toBe(0)
  interval.mockRestore()
})

it('shows each stage word once in the unlocked suffix, then returns to scrambling', () => {
  const view = render(
    <DecodeText flash={{ stage: 1, suffix: 'OPENMODEL' }} loop prefix={1} revealedPrefix={1} text="CONNECTING" />
  )

  expect(view.container.textContent).toBe('COPENMODEL')
  act(() => vi.advanceTimersByTime(450))
  expect(view.container.textContent).not.toContain('OPENMODEL')

  view.rerender(
    <DecodeText flash={{ stage: 2, suffix: 'OPENNESS' }} loop prefix={1} revealedPrefix={2} text="CONNECTING" />
  )
  expect(view.container.textContent).toBe('COOPENNESS')

  act(() => vi.advanceTimersByTime(450))
  view.rerender(
    <DecodeText flash={{ stage: 1, suffix: 'OPENMODEL' }} loop prefix={1} revealedPrefix={1} text="CONNECTING" />
  )
  expect(view.container.textContent).not.toContain('OPENMODEL')
})

it('cleans up both decode and flash timers on unmount', () => {
  const view = render(
    <DecodeText flash={{ stage: 1, suffix: 'OPENMODEL' }} loop prefix={1} revealedPrefix={1} text="CONNECTING" />
  )

  expect(vi.getTimerCount()).toBe(2)
  view.unmount()
  expect(vi.getTimerCount()).toBe(0)
})

it('renders a static progress mask and skips flashes under reduced motion', () => {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ addEventListener: vi.fn(), matches: true, removeEventListener: vi.fn() })

  const { container } = render(
    <DecodeText flash={{ stage: 4, suffix: 'REASON' }} loop prefix={1} revealedPrefix={4} text="CONNECTING" />
  )

  expect(container.textContent).toBe('CONN······')
  expect(vi.getTimerCount()).toBe(0)
})

it('resolves the full word when decoding is frozen for the exit choreography', () => {
  const { container } = render(<DecodeText active={false} prefix={1} revealedPrefix={4} text="CONNECTING" />)

  expect(container.textContent).toBe('CONNECTING')
})
