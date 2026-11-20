import { type ComponentProps, useEffect, useEffectEvent, useRef, useState } from 'react'

import { prefersReducedMotion } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

/**
 * DecodeText — the "CONNECTING" scramble-decode effect as a reusable
 * primitive (extracted from gateway-connecting-overlay.tsx; same mechanics):
 *
 *  - Even-weight mono ascii charset so cycling glyphs never jump width
 *    (matches the nousnet-web download-button decode effect).
 *  - Decode resolves half a character per 45ms tick; when fully resolved it
 *    holds for 16 ticks, then (in loop mode) replays.
 *  - The first `prefix` characters NEVER scramble — split at render level so
 *    no timer logic (even a stale HMR one) can garble them.
 *  - Optional blinking dither-cursor square.
 *
 * Typography (mono, small, uppercase, wide tracking) is baked in; color comes
 * from the caller via className/text color so the same primitive works on the
 * boot overlay (--theme-primary) and quiet surfaces (--ui-text-quaternary).
 */

export const DECODE_SCRAMBLE_CHARS = '/\\|-_=+<>~:*'
const TICK_MS = 45
const HOLD_TICKS = 16
const FLASH_DURATION_MS = 450

function scrambled(tail: string, resolvedCount: number): string {
  return Array.from(tail, (ch, i) =>
    ch === ' ' || i < resolvedCount ? ch : DECODE_SCRAMBLE_CHARS[(Math.random() * DECODE_SCRAMBLE_CHARS.length) | 0]
  ).join('')
}

export interface DecodeTextProps extends Omit<ComponentProps<'span'>, 'prefix'> {
  text: string
  /** Leading character count that stays legible at all times. */
  prefix?: number
  /** Additional progress-locked prefix; unlike `prefix`, may grow while decoding. */
  revealedPrefix?: number
  /** One-shot decorative suffix for the matching progress stage. */
  flash?: { stage: number; suffix: string } | null
  /** Run the decode. When false, renders the plain resolved text (used to
   *  freeze the word during exit choreography). */
  active?: boolean
  /** Replay after the hold (a progress surface such as the boot overlay), or
   *  resolve once and stop. Off by default: a quiet placeholder that replays
   *  forever is a 22 Hz setState ticker for as long as it is on screen — the
   *  empty-zone "HERMES" mark alone held the idle renderer at ~16 commits/s
   *  (#98394). */
  loop?: boolean
  /** Blinking dither-cursor square after the text. */
  cursor?: boolean
}

export function DecodeText({
  active = true,
  className,
  cursor = false,
  flash = null,
  loop = false,
  prefix = 0,
  revealedPrefix,
  text,
  ...props
}: DecodeTextProps) {
  const basePrefix = Math.max(0, Math.min(text.length, Math.trunc(prefix)))
  const stablePrefix = Math.max(basePrefix, Math.min(text.length, Math.trunc(revealedPrefix ?? basePrefix)))
  const progressive = revealedPrefix !== undefined
  const tailText = text.slice(basePrefix)
  const revealOffset = stablePrefix - basePrefix
  const reducedMotion = prefersReducedMotion()
  const readRevealOffset = useEffectEvent(() => revealOffset)
  const flashStage = flash?.stage
  const flashSuffixText = flash?.suffix

  const [tail, setTail] = useState(() =>
    progressive && reducedMotion ? '·'.repeat(tailText.length - revealOffset) : progressive ? scrambled(tailText, revealOffset) : tailText
  )

  const [flashed, setFlashed] = useState<null | { stage: number; suffix: string }>(null)

  const seenFlashStages = useRef(new Set<number>())
  const visibleFlashStage = useRef<number | null>(null)
  const flashTimer = useRef<number | null>(null)

  // These refs own timer/stage bookkeeping; they do not mirror atom state.
  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    const currentFlash =
      flashStage === undefined || flashSuffixText === undefined ? null : { stage: flashStage, suffix: flashSuffixText }

    if (!active || !progressive || reducedMotion || !currentFlash || currentFlash.suffix.length !== text.length - stablePrefix) {
      setFlashed(null)
      visibleFlashStage.current = null

      return
    }

    if (seenFlashStages.current.has(currentFlash.stage)) {
      // React StrictMode replays effects after cleanup. Re-arm the current
      // one-shot flash without making a later return to this stage replay it.
      if (visibleFlashStage.current !== currentFlash.stage || flashTimer.current !== null) {
        return
      }

      setFlashed(currentFlash)
    } else {
      seenFlashStages.current.add(currentFlash.stage)
      visibleFlashStage.current = currentFlash.stage
      setFlashed(currentFlash)
    }

    const id = window.setTimeout(() => {
      setFlashed(current => (current?.stage === currentFlash.stage ? null : current))
      visibleFlashStage.current = null
      flashTimer.current = null
    }, FLASH_DURATION_MS)

    flashTimer.current = id

    return () => {
      if (flashTimer.current === id) {
        window.clearTimeout(id)
        flashTimer.current = null
      }
    }
  }, [active, flashStage, flashSuffixText, progressive, reducedMotion, stablePrefix, text.length])

  useEffect(() => {
    if (!active) {
      setTail(tailText)

      return
    }

    // Under reduced motion, skip the scramble interval. Progressive callers
    // render a static unresolved-tail mask; other callers resolve the word.
    // The cursor blink is also killed by the blanket reduced-motion CSS rule.
    if (reducedMotion) {
      setTail(tailText)

      return
    }

    let resolved = progressive ? readRevealOffset() : 0
    let hold = 0

    const id = window.setInterval(() => {
      resolved = Math.max(resolved, readRevealOffset())

      if (resolved >= tailText.length) {
        hold += 1

        if (hold > HOLD_TICKS) {
          if (loop) {
            resolved = readRevealOffset()
            hold = 0
          } else {
            window.clearInterval(id)
          }
        }

        setTail(tailText)

        return
      }

      resolved += 0.5
      setTail(scrambled(tailText, Math.floor(resolved)))
    }, TICK_MS)

    return () => window.clearInterval(id)
  }, [active, loop, progressive, reducedMotion, tailText])

  const flashSuffix =
    active &&
    progressive &&
    !reducedMotion &&
    flashStage === stablePrefix &&
    flashed?.stage === flashStage
      ? flashed.suffix
      : null

  const visibleTail = !active
    ? ''
    : progressive && reducedMotion
      ? '·'.repeat(text.length - stablePrefix)
      : flashSuffix ?? tail.slice(revealOffset)

  const renderedText = active ? `${text.slice(0, stablePrefix)}${visibleTail}` : text

  return (
    <span
      className={cn(
        'inline-flex items-center font-mono text-[0.64rem] font-semibold uppercase tracking-[0.4em] tabular-nums',
        className
      )}
      {...props}
    >
      {renderedText}
      {cursor && (
        <span
          aria-hidden="true"
          className="dither ml-0.5 inline-block size-2 shrink-0 -translate-y-px rounded-[1px] decode-cursor-blink"
        />
      )}
    </span>
  )
}
