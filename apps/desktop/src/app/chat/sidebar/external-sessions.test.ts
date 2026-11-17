import { describe, expect, it, vi } from 'vitest'

import {
  clearExternalSessionReadOnly,
  isStoredTranscriptReadOnly,
  recordCronRunVerdict
} from '@/store/read-only-transcript'
import { makeSessionInfo } from '@/test/session-info'

import { externalSessionTitle, groupExternalSessions } from './external-sessions'
import { openExternalSession } from './external-sessions-section'

describe('external sidebar sessions', () => {
  it('groups supported sources and excludes desktop sessions', () => {
    const groups = groupExternalSessions([
      makeSessionInfo({ id: 'one', source: 'oneshot' }),
      makeSessionInfo({ id: 'cli', source: 'cli' }),
      makeSessionInfo({ id: 'whatsapp', source: 'whatsapp' }),
      makeSessionInfo({ id: 'cron', source: 'cron' }),
      makeSessionInfo({ id: 'kanban', source: 'kanban' }),
      makeSessionInfo({ id: 'child', is_internal_child: true, source: 'subagent' }),
      makeSessionInfo({ id: 'desktop', source: 'desktop' })
    ])

    expect(groups.map(group => [group.source, group.sessions.map(session => session.id)])).toEqual([
      ['oneshot', ['one']],
      ['cli', ['cli']],
      ['whatsapp', ['whatsapp']],
      ['cron', ['cron']],
      ['kanban', ['kanban']],
      ['subagent', ['child']]
    ])
  })

  it('labels untitled one-shot runs with their local start time so concurrent runs are distinguishable', () => {
    const first = makeSessionInfo({ id: 'run-1', last_active: 1_800_000_000, started_at: 1_799_999_000, source: 'oneshot' })
    const second = makeSessionInfo({ id: 'run-2', last_active: 1_800_000_000, started_at: 1_800_000_000, source: 'oneshot' })

    expect(externalSessionTitle(first)).toMatch(/^One-shot run · /)
    expect(externalSessionTitle(second)).not.toBe(externalSessionTitle(first))
  })

  it('keeps unknown sources visible under their source identity', () => {
    expect(groupExternalSessions([makeSessionInfo({ id: 'unknown', source: 'custom_runner' })])).toMatchObject([
      { source: 'custom_runner' }
    ])
  })

  it('opens active messaging sessions read-only through the existing stored session route', () => {
    const session = makeSessionInfo({ ended_at: null, id: 'active-message', is_active: true, source: 'whatsapp' })
    const open = vi.fn()

    openExternalSession(session.id, session, open)

    expect(open).toHaveBeenCalledWith(session.id, session)
    expect(isStoredTranscriptReadOnly(session.id)).toBe(true)
    clearExternalSessionReadOnly(session.id)
  })

  it('keeps Cron zombie runs behind the existing scheduler read-only verdict', () => {
    const session = makeSessionInfo({
      ended_at: null,
      id: 'cron-zombie-test',
      is_active: false,
      scheduler_owned: false,
      source: 'cron'
    })

    const open = vi.fn()

    openExternalSession(session.id, session, open)

    expect(open).toHaveBeenCalledWith(session.id, session)
    expect(isStoredTranscriptReadOnly(session.id)).toBe(true)
    recordCronRunVerdict(session.id, false)
  })
})
