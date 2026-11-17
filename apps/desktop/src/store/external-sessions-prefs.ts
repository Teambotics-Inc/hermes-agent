import { Codecs, persistentAtom } from '@/lib/persisted'

export const $externalSessionsVisible = persistentAtom('hermes.desktop.sidebarExternalSessions', true, Codecs.bool)

export function setExternalSessionsVisible(visible: boolean): void {
  $externalSessionsVisible.set(visible)
}
