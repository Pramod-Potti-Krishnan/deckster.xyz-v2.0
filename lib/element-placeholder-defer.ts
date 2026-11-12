/**
 * PASS2-J3 P1 (flag NEXT_PUBLIC_STUDIO_ELEMENT_PLACEHOLDER_FIX, Studio shell only, default off).
 *
 * Choosing an Add Element card used to drop an empty placeholder box on the slide at once. Cancelling the form left it there, and
 * Layout saves each insertion, so the empty box survived a reload. With the flag on, choosing a card puts nothing on the slide:
 * the placeholder's insertion is held back here and sent only when Generate first needs the element (the same command, with the
 * same parameters, that the card click used to send). If a Generate then fails before the generated element is in, the placeholder
 * is taken out again, so an empty element exists on the slide only while a Generate is in flight.
 *
 * Layout renders element content at creation time only, so nothing here patches an element: it only delays a create and, on
 * failure, deletes the empty one it created.
 *
 * Layout names a new text box itself: the real viewer's ElementManager.insertTextBox uses `config.id || generateId('textbox')` and
 * ignores the `elementId` the command carries (layout-builder src/utils/element-manager.js, insertTextBox). When the card click
 * inserted the placeholder, the form simply adopted the identity Layout answered. Here the form already holds its own identity
 * when Generate inserts the placeholder, so the identity Layout answers is recorded next to it, and every command the Generate
 * sends for the form's identity is aimed at the element Layout really holds (and its answer is given back under the form's identity).
 *
 * This module holds the bookkeeping only (no React, no Layout call of its own): the hook feeds it the commands.
 */

export const STUDIO_ELEMENT_PLACEHOLDER_FIX_ENABLED = process.env.NEXT_PUBLIC_STUDIO_ELEMENT_PLACEHOLDER_FIX === 'true'

export type PlaceholderCommandSender = (action: string, params: Record<string, any>) => Promise<any>

export interface PlaceholderLease {
  isCurrent: () => boolean
  sendElementCommand: PlaceholderCommandSender
}

export interface PlaceholderOwner {
  presentationId: string | null
  epoch: number
}

export interface DeferredPlaceholder {
  readonly elementId: string
  readonly params: Record<string, any>
  readonly owner: PlaceholderOwner
  /**
   * deferred: nothing on the slide; the next Generate inserts it. inserted: the empty element is in Layout, as `layoutId`.
   * removed: the running Generate deleted it itself (the generated element replaced it, or its rollback): nothing on the slide, and
   * only that Generate's own placeholder restore may put it back. A take-out turns it into deferred again.
   */
  state: 'deferred' | 'inserted' | 'removed'
  /** While inserted: the identity Layout gave the empty element (Layout ignores `elementId` and names a new text box itself). */
  layoutId: string | null
  /** The panel has pointed at this placeholder at least once (an effect saw it), so it may be swept when the panel moves on. */
  seen: boolean
  /** A Generate owns it: never swept or rolled back by anyone else. */
  inFlight: boolean
  /** The lease that inserted it: the only channel a later delete may use. */
  lease: PlaceholderLease | null
  /** The insertion (or the rollback) in progress; every other command on the element waits for it. */
  busy: Promise<void> | null
}

/** True for the Layout command Add Element sends to drop a blank placeholder (not a generated element). */
export function isBlankPlaceholderInsert(action: string, params: Record<string, any> | undefined | null): boolean {
  return action === 'insertTextBox'
    && Boolean(params)
    && typeof params!.elementId === 'string'
    && params!.elementId.length > 0
    && typeof params!.content === 'string'
    && params!.content.includes(`data-blank-element="${params!.elementId}"`)
}

export const PLACEHOLDER_NOT_ADDED_MESSAGE =
  'The element placeholder could not be added. Please wait for the slide to finish loading and try again.'

const NOT_FOUND = /not found|no such|does not exist/i

export function createPlaceholderDeferral() {
  const entries = new Map<string, DeferredPlaceholder>()

  /** Hold a placeholder insertion back. Answers like Layout would, so the caller tracks it as usual. */
  function defer(params: Record<string, any>, owner: PlaceholderOwner) {
    // A new card supersedes any placeholder nobody generated: nothing of it ever reached the slide. Mark it reachable-by-nobody; the next
    // sweep (the panel now points at the new card) forgets it and its tracking.
    for (const entry of entries.values()) {
      if (entry.state === 'deferred' && !entry.inFlight) entry.seen = true
    }
    entries.set(params.elementId, {
      elementId: params.elementId, params: { ...params }, owner, state: 'deferred', layoutId: null, seen: false, inFlight: false, lease: null, busy: null,
    })
    return { success: true, elementId: params.elementId as string }
  }

  /** Layout answered: the empty element is on the slide under `layoutId` (Layout's own name for it). */
  function markInserted(entry: DeferredPlaceholder, layoutId: string, lease: PlaceholderLease) {
    entry.state = 'inserted'
    entry.layoutId = layoutId
    entry.lease = lease
  }

  /**
   * The lease handed to a Generate. Any command aimed at a held-back placeholder first sends the held-back insertion (once, in
   * order). Commands that name the placeholder (`elementId`, or a slide-context read's `targetElementId`) are aimed at the element
   * Layout really holds, and an answer that names it comes back under the form's identity. Everything else is forwarded untouched.
   */
  function wrapLease(lease: PlaceholderLease, ownerIsCurrent: (owner: PlaceholderOwner) => boolean): PlaceholderLease {
    async function ensureInserted(entry: DeferredPlaceholder) {
      if (entry.busy) await entry.busy
      if (entry.state !== 'deferred') return
      if (!ownerIsCurrent(entry.owner)) {
        throw new Error('The active presentation changed before the element placeholder was added. Reload the presentation and try again.')
      }
      const run = (async () => {
        const response = await lease.sendElementCommand('insertTextBox', entry.params)
        if (response?.success === false) {
          throw new Error(typeof response.error === 'string' && response.error ? response.error : 'Layout rejected the blank placeholder')
        }
        // Layout names the new text box itself (it ignores `elementId`), as it did when the card click inserted it.
        markInserted(entry, typeof response?.elementId === 'string' && response.elementId ? response.elementId : entry.elementId, lease)
      })()
      entry.busy = run.finally(() => { entry.busy = null }).catch(() => {})
      try { await run } catch (error) {
        // The user reads the plain sentence; the cause stays on the error for the console.
        throw new Error(PLACEHOLDER_NOT_ADDED_MESSAGE, { cause: error })
      }
    }
    const heldBy = (value: unknown) => (typeof value === 'string' && value ? entries.get(value) : undefined)
    return {
      isCurrent: lease.isCurrent,
      sendElementCommand: async (action, params) => {
        const entry = heldBy(params?.elementId)
        const target = heldBy(params?.targetElementId)
        if (!entry && !target) return lease.sendElementCommand(action, params)
        if (entry?.busy) await entry.busy
        if (target?.busy) await target.busy
        if (entry && isBlankPlaceholderInsert(action, params)) {
          // The Generate puts its own placeholder back (its restore after a failed replacement). Layout names it afresh; the form
          // keeps its identity, so the answer comes back under it and a later take-out removes the element Layout really made.
          const response = await lease.sendElementCommand(action, params)
          if (response?.success === false || typeof response?.elementId !== 'string' || !response.elementId) return response
          markInserted(entry, response.elementId, lease)
          return { ...response, elementId: entry.elementId }
        }
        // A delete never inserts first: nothing would be gained, and a placeholder the Generate removed must stay removed.
        if (entry && entry.state === 'deferred' && action !== 'deleteElement') await ensureInserted(entry)
        const layoutId = entry?.state === 'inserted' ? entry.layoutId : null
        const targetLayoutId = target?.state === 'inserted' ? target.layoutId : null
        const aimed = layoutId || targetLayoutId
          ? { ...params, ...(layoutId ? { elementId: layoutId } : {}), ...(targetLayoutId ? { targetElementId: targetLayoutId } : {}) }
          : params
        const removedBy = (deleted: boolean) => {
          if (deleted && entry && layoutId && action === 'deleteElement' && entry.layoutId === layoutId) {
            entry.state = 'removed'
            entry.layoutId = null
            entry.lease = null
          }
        }
        let response: any
        try {
          response = await lease.sendElementCommand(action, aimed)
        } catch (error) {
          removedBy(error instanceof Error && NOT_FOUND.test(error.message))
          throw error
        }
        removedBy(response?.success !== false)
        return layoutId && response && typeof response === 'object' && response.elementId === layoutId
          ? { ...response, elementId: entry!.elementId }
          : response
      },
    }
  }

  /**
   * A Generate ended without the generated element replacing the placeholder: take the empty one out again (under the identity
   * Layout gave it). Only a placeholder this module inserted, only through the lease that inserted it, and never while that lease no longer matches the viewer (then the
   * state of the slide is unknown and nothing is changed). A failed delete leaves it inserted, which is today's behaviour.
   * Returns true when the slide no longer holds it.
   */
  async function takeOut(id: string): Promise<boolean> {
    const entry = entries.get(id)
    if (!entry) return false
    if (entry.busy) await entry.busy
    const nothingOnSlide = () => {
      entry.state = 'deferred'
      entry.layoutId = null
      entry.lease = null
    }
    // The Generate already deleted it itself: nothing is on the slide; the next Generate inserts it afresh.
    if (entry.state === 'removed') { nothingOnSlide(); return true }
    if (entry.state !== 'inserted' || !entry.lease || !entry.layoutId) return entry.state === 'deferred'
    const lease = entry.lease
    const layoutId = entry.layoutId
    if (!lease.isCurrent()) return false
    const run = (async () => {
      const response = await lease.sendElementCommand('deleteElement', { elementId: layoutId })
      if (response?.success === false) throw new Error(typeof response.error === 'string' ? response.error : 'Layout refused the delete')
      nothingOnSlide()
    })()
    entry.busy = run.finally(() => { entry.busy = null }).catch(() => {})
    try { await run; return true } catch (error) {
      // Already gone from the slide (a failed restore, a manual delete): the goal is met, and the next Generate inserts it afresh.
      if (error instanceof Error && NOT_FOUND.test(error.message)) {
        nothingOnSlide()
        return true
      }
      return false
    }
  }

  return {
    defer,
    wrapLease,
    takeOut,
    get: (id: string | null | undefined) => (id ? entries.get(id) : undefined),
    has: (id: string | null | undefined) => Boolean(id && entries.has(id)),
    forget: (id: string) => { entries.delete(id) },
    ids: () => [...entries.keys()],
    get size() { return entries.size },
    /** The panel's present target (null when it is closed). Marks that target seen; returns the placeholders nobody can reach any more. */
    sweep(liveId: string | null): DeferredPlaceholder[] {
      const gone: DeferredPlaceholder[] = []
      for (const entry of entries.values()) {
        if (entry.elementId === liveId) { entry.seen = true; continue }
        if (entry.seen && !entry.inFlight && !entry.busy) gone.push(entry)
      }
      return gone
    },
  }
}

export type PlaceholderDeferral = ReturnType<typeof createPlaceholderDeferral>
