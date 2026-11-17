import type { ReactNode } from 'react'
import { useEffect } from 'react'

import { PlatformAvatar } from '@/app/messaging/platform-icon'
import { Codicon } from '@/components/ui/codicon'
import { DisclosureCaret } from '@/components/ui/disclosure-caret'
import { SidebarGroup, SidebarGroupContent } from '@/components/ui/sidebar'
import { useI18n } from '@/i18n'
import { isMessagingSource, sessionSourceLabel } from '@/lib/session-source'
import { relativeTime } from '@/lib/time'
import { cn } from '@/lib/utils'
import { clearExternalSessionReadOnly, markExternalSessionReadOnly } from '@/store/read-only-transcript'
import type { SessionInfo } from '@/types/hermes'

import { isCronRunRow, openCronRun } from '../../cron/open-cron-run'
import { SidebarPanelLabel } from '../../shell/sidebar-label'

import { SidebarRowBody, SidebarRowLabel, SidebarRowLead, SidebarRowShell } from './chrome'
import { type ExternalSessionGroup, externalSessionTitle } from './external-sessions'

interface ExternalSessionsSectionProps {
  children?: ReactNode
  groups: ExternalSessionGroup[]
  onOpenSession: (sessionId: string, session?: SessionInfo) => void
  onToggle: () => void
  open: boolean
}

export function ExternalSessionsSection({
  children,
  groups,
  onOpenSession,
  onToggle,
  open
}: ExternalSessionsSectionProps) {
  const { t } = useI18n()

  if (!groups.length && !children) {
    return null
  }

  return (
    <SidebarGroup className="shrink-0 p-0 pb-1">
      <div className="group/section flex shrink-0 items-center justify-between pb-1 pt-1.5">
        <button
          aria-expanded={open}
          className="group/section-label flex w-fit min-w-0 items-center gap-1 bg-transparent text-left leading-none"
          onClick={onToggle}
          type="button"
        >
          <SidebarPanelLabel>{t.sidebar.externalSessions}</SidebarPanelLabel>
          <DisclosureCaret
            className="text-(--ui-text-tertiary) opacity-0 transition group-hover/section-label:opacity-100"
            open={open}
          />
        </button>
      </div>
      {open && (
        <SidebarGroupContent className="scrollbar-fade flex max-h-80 flex-col gap-px overflow-x-hidden overflow-y-auto overscroll-contain pb-1.75 compact:max-h-none compact:overflow-visible">
          {groups.map(group => (
            <div className="pb-1" key={group.source}>
              <div className="flex h-6 items-center gap-1.5 px-2 text-[0.6875rem] font-medium text-(--ui-text-tertiary)">
                {isMessagingSource(group.source) ? (
                  <PlatformAvatar
                    className="size-3.5 rounded-[4px] text-[0.5rem] [&_svg]:size-2.5"
                    platformId={group.source}
                    platformName={sessionSourceLabel(group.source) ?? group.source}
                  />
                ) : (
                  <Codicon aria-hidden="true" name={sourceIcon(group.source)} size="0.75rem" />
                )}
                <span className="truncate">{sessionSourceLabel(group.source) ?? group.source}</span>
              </div>
              {group.sessions.map(session => (
                <ExternalSessionRow key={session.id} onOpenSession={onOpenSession} session={session} />
              ))}
              {group.footer}
            </div>
          ))}
          {children}
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  )
}

/** Active external runs attach to their stored id and stay read-only. Cron
 *  uses the existing scheduler-ownership verdict as well, so a zombie keeps
 *  the Cron write gate it already had on the Cron page. */
export function openExternalSession(
  sessionId: string,
  session: SessionInfo | undefined,
  onOpenSession: ExternalSessionsSectionProps['onOpenSession']
): void {
  if (!session) {
    onOpenSession(sessionId)

    return
  }

  // A null `ended_at` is not proof that a run is still alive (it may be in a
  // long tool call or be a zombie), but it is enough reason not to resume it as
  // an interactive chat. Only explicitly closed runs are writable by default.
  if (session.ended_at == null) {
    markExternalSessionReadOnly(sessionId)
  } else {
    clearExternalSessionReadOnly(sessionId)
  }

  if (isCronRunRow(session)) {
    openCronRun(session, onOpenSession)

    return
  }

  onOpenSession(sessionId, session)
}

function ExternalSessionRow({
  onOpenSession,
  session
}: {
  onOpenSession: ExternalSessionsSectionProps['onOpenSession']
  session: SessionInfo
}) {
  const { t } = useI18n()
  const activity = session.last_activity_description?.trim()
  const isLive = session.ended_at == null && (session.is_active || session.scheduler_owned === true)
  const when = session.last_active || session.started_at

  // A row with no end timestamp may be inside a long silent tool call; keep its
  // write gate even when the backend's activity window temporarily goes idle.
  useEffect(() => {
    if (session.ended_at != null) {
      clearExternalSessionReadOnly(session.id)
    }
  }, [session.ended_at, session.id])

  return (
    <SidebarRowShell>
      <SidebarRowBody
        aria-label={`${externalSessionTitle(session, t.sidebar.externalRun)}${isLive ? `, ${activity || t.sidebar.externalLive}` : ''}`}
        className="min-w-0 flex-1 gap-2 rounded-md px-2 py-1 hover:bg-(--ui-control-hover-background)"
        onClick={() => openExternalSession(session.id, session, onOpenSession)}
      >
        <SidebarRowLead>
          <Codicon
            className={cn(isLive ? 'text-(--ui-accent)' : 'text-(--ui-text-quaternary)')}
            name={isLive ? 'sync' : 'history'}
            size="0.8125rem"
          />
        </SidebarRowLead>
        <span className="flex min-w-0 flex-1 flex-col">
          <SidebarRowLabel>{externalSessionTitle(session, t.sidebar.externalRun)}</SidebarRowLabel>
          <span className="flex min-w-0 items-center gap-1 truncate text-[0.625rem] leading-tight text-(--ui-text-tertiary)">
            <span>{when ? relativeTime(when * 1000) : t.sidebar.externalUnknownTime}</span>
            {isLive && <span className="truncate">· {activity || t.sidebar.externalLive}</span>}
          </span>
        </span>
      </SidebarRowBody>
    </SidebarRowShell>
  )
}

function sourceIcon(source: string): string {
  switch (source) {
    case 'oneshot':

    case 'cli':
      return 'terminal'

    case 'cron':
      return 'watch'

    case 'kanban':
      return 'project'

    case 'subagent':
      return 'organization'

    default:
      return 'broadcast'
  }
}
