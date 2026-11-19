import type { ReactNode } from 'react'

import { isMessagingSource, normalizeSessionSource, sessionSourceLabel } from '@/lib/session-source'
import { fmtDayTime } from '@/lib/time'
import type { SessionInfo } from '@/types/hermes'

const SOURCE_ORDER = ['oneshot', 'cli']
const LOCAL_CHAT_SOURCES = new Set(['desktop', 'local'])

export function isExternalSession(session: Pick<SessionInfo, 'source'>): boolean {
  const source = normalizeSessionSource(session.source)

  return Boolean(source && !LOCAL_CHAT_SOURCES.has(source))
}

export interface ExternalSessionGroup {
  footer?: ReactNode
  sessions: SessionInfo[]
  source: string
}

/** External sources are grouped by their durable source id; they never get
 *  relabelled as ordinary Desktop chats. Rows are recency ordered within a
 *  group, with known product sources ahead of extension-defined sources. */
export function groupExternalSessions(sessions: readonly SessionInfo[]): ExternalSessionGroup[] {
  const bySource = new Map<string, SessionInfo[]>()

  for (const session of sessions) {
    const source = normalizeSessionSource(session.source)

    if (!source || !isExternalSession(session)) {
      continue
    }

    const rows = bySource.get(source) ?? []

    rows.push(session)
    bySource.set(source, rows)
  }

  return [...bySource.entries()]
    .sort(([left], [right]) => sourceRank(left) - sourceRank(right) || left.localeCompare(right))
    .map(([source, rows]) => ({
      source,
      sessions: rows.sort((a, b) => (b.last_active || b.started_at) - (a.last_active || a.started_at))
    }))
}

function sourceRank(source: string): number {
  const known = SOURCE_ORDER.indexOf(source)

  if (known >= 0) {
    return known
  }

  if (isMessagingSource(source)) {
    return 2
  }

  return source === 'cron' ? 3 : source === 'kanban' ? 4 : source === 'subagent' ? 5 : 6
}

export function externalSessionTitle(
  session: Pick<SessionInfo, 'last_active' | 'source' | 'started_at' | 'title'>,
  generatedLabel: (sourceLabel: string) => string = source => `${source} run`
): string {
  const title = session.title?.trim()

  if (title) {
    return title
  }

  const source = normalizeSessionSource(session.source) ?? 'external'
  const rawLabel = sessionSourceLabel(source) ?? source
  const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1)
  const generated = generatedLabel(label)

  // One-shot runs are commonly untitled and a user may have several. Their
  // start time gives each row a stable, human-scannable identity.
  return source === 'oneshot' ? `${generated} · ${fmtDayTime.format(new Date(session.started_at * 1000))}` : generated
}
