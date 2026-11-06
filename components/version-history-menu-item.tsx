"use client"

// VERSION-HISTORY-V2 (flag NEXT_PUBLIC_STUDIO_VERSION_HISTORY_V2, default off; Pass 2 row PRO-09): the profile menu's "Version history" row (the mock has it). It opens the panel of the deck on screen,
// so it is there only while a deck is on screen (the viewer registers itself in versionHistoryBridge) and never on the library pages. Flag off: renders nothing and calls no hook.

import { useSyncExternalStore } from "react"
import { ChevronRight, History } from "lucide-react"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { STUDIO_VERSION_HISTORY_V2_ENABLED, versionHistoryBridge } from "@/lib/studio-version-history-v2"

const noDeckOnServer = () => false

function VersionHistoryMenuItemRow({ chevron }: { chevron: boolean }) {
  const available = useSyncExternalStore(versionHistoryBridge.subscribe, versionHistoryBridge.isAvailable, noDeckOnServer)
  if (!available) return null
  return (
    <DropdownMenuItem data-studio-v4-profile-role="item" data-studio-p2-row={chevron ? "version-history" : undefined} onSelect={() => { versionHistoryBridge.open() }}>
      <History className="mr-2 h-4 w-4" />
      <span>Version history</span>
      {chevron && <ChevronRight data-studio-p2-chevron="true" />}
    </DropdownMenuItem>
  )
}

/** chevron: the mockup menu's trailing chevron (every row of that menu has one; the original menu has none). */
export function VersionHistoryMenuItem({ chevron = false }: { chevron?: boolean }) {
  if (!STUDIO_VERSION_HISTORY_V2_ENABLED) return null
  return <VersionHistoryMenuItemRow chevron={chevron} />
}
