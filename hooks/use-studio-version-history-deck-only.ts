import { useEffect } from 'react'
import { versionHistoryBridge } from '@/lib/studio-version-history-v2'

/**
 * NEXT_PUBLIC_STUDIO_VERSION_HISTORY_DECK_ONLY (exact "true", default off, build-time): the profile menu's Version history row is there only while a deck is
 * on stage (design #456), and the welcome is not a deck. On a new session Studio keeps the viewer mounted under the welcome (a blank deck behind the first-run
 * poster), the viewer registers its opener as soon as it has a deck URL, and so the row showed on the empty Builder and did nothing when it was chosen.
 * The page already knows what is on stage (studioWelcome: the canvas lifecycle's single landing decision, the one that puts the welcome up). With the flag on, the
 * page hands that here, and while the welcome is up the bridge reports no deck and refuses open(); the row is gone and comes back the moment a deck is on stage
 * (a generated or authored deck, or the blank canvas once it is chosen). Off: nothing here runs, the bridge is told nothing and the row is as before.
 */
export const STUDIO_VERSION_HISTORY_DECK_ONLY_ENABLED = process.env.NEXT_PUBLIC_STUDIO_VERSION_HISTORY_DECK_ONLY === 'true'

export function useStudioVersionHistoryDeckOnly(welcomeOnStage: boolean): void {
  useEffect(() => {
    if (!STUDIO_VERSION_HISTORY_DECK_ONLY_ENABLED || !welcomeOnStage) return
    versionHistoryBridge.setCovered(true)
    return () => { versionHistoryBridge.setCovered(false) }
  }, [welcomeOnStage])
}
