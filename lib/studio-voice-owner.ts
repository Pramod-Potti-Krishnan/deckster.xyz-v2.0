import type { StudioAutomaticBlankOrigin, StudioInitialFreshCanonicalEntry } from './studio-initial-stage-owner'

export interface StudioVoiceOwnerObservation {
  authUserId: string | null
  sessionId: string | null
  routeSessionId: string | null
  navigationExtras: string
  presentationId: string | null
  presentationUrl: string | null
  activeVersion: string | null
  templateIdentity: string | null
  transcriptEpoch: object | null
  restoreReceipt: object | null
  eligible: boolean
  freshAssignment: StudioInitialFreshCanonicalEntry | null
  automaticBlank: StudioAutomaticBlankOrigin | null
}

/** Caller-private authority. It changes before any retained interaction can
 * dispatch; it never rebinds the Builder, transport, jobs or saved transcript. */
export function createStudioVoiceOwner() {
  let active = true
  let token: object = {}
  let observation: StudioVoiceOwnerObservation | null = null
  const usedRoutes = new Set<object>()
  const usedBlanks = new Set<object>()
  const retire = () => {
    token = {}
    if (observation) observation = { ...observation, eligible: false }
  }

  return {
    observe(next: StudioVoiceOwnerObservation): object | null {
      const previous = observation
      if (previous) {
        const sameBase = previous.authUserId === next.authUserId
          && previous.sessionId === next.sessionId
          && previous.navigationExtras === next.navigationExtras
          && previous.templateIdentity === next.templateIdentity
          && previous.transcriptEpoch === next.transcriptEpoch
          && previous.restoreReceipt === next.restoreReceipt
          && previous.eligible === next.eligible
        const fresh = next.freshAssignment
        const sameRoute = previous.routeSessionId === next.routeSessionId
        const canonicalAssignment = !sameRoute && sameBase && previous.eligible && next.eligible
          && fresh && !usedRoutes.has(fresh) && fresh.isCurrentAssignment()
          && fresh.authUserId === next.authUserId && fresh.sessionId === next.sessionId
          && fresh.sourceRouteSessionId === previous.routeSessionId
          && (!previous.routeSessionId || previous.routeSessionId === 'new')
          && next.routeSessionId === fresh.sessionId
        const sameDeck = previous.presentationId === next.presentationId
          && previous.presentationUrl === next.presentationUrl
          && previous.activeVersion === next.activeVersion
        const blank = next.automaticBlank
        const firstBlank = !sameDeck && sameBase && previous.eligible && next.eligible
          && !previous.presentationId && !previous.presentationUrl
          && blank && !usedBlanks.has(blank.token)
          && blank.userId === next.authUserId && blank.sessionId === next.sessionId
          && blank.presentationId === next.presentationId && blank.presentationUrl === next.presentationUrl
          && next.activeVersion === 'blank'
        if (!sameBase || (!sameRoute && !canonicalAssignment) || (!sameDeck && !firstBlank)) token = {}
        else {
          if (canonicalAssignment) usedRoutes.add(fresh)
          if (firstBlank) usedBlanks.add(blank.token)
        }
      }
      // Seeing a completed assignment consumes its preservation opportunity,
      // even if no call was open. A later ABA cannot reuse an old receipt.
      if (next.freshAssignment && next.routeSessionId === next.freshAssignment.sessionId) usedRoutes.add(next.freshAssignment)
      if (next.automaticBlank && next.presentationUrl === next.automaticBlank.presentationUrl
        && next.presentationId === next.automaticBlank.presentationId) usedBlanks.add(next.automaticBlank.token)
      observation = next
      return active && next.eligible ? token : null
    },
    isCurrent(owner: object): boolean {
      return active && token === owner && observation?.eligible === true
    },
    retire,
    mount() { active = true },
    unmount() { active = false; retire() },
  }
}

/** Computed visibility supplements the retained leaf's connected/inert tests. */
export function studioVoiceElementVisible(element: HTMLElement | null): element is HTMLElement {
  if (!element?.isConnected || element.closest('[inert], [aria-hidden="true"], [hidden]')
    || element.getClientRects().length === 0) return false
  for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
    const style = getComputedStyle(ancestor)
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false
  }
  return true
}
