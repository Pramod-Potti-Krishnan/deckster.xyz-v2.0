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
  /** deferred: nothing on the slide. inserted: the empty element is in Layout. */
  state: 'deferred' | 'inserted'
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
      elementId: params.elementId, params: { ...params }, owner, state: 'deferred', seen: false, inFlight: false, lease: null, busy: null,
    })
    return { success: true, elementId: params.elementId as string }
  }

  /**
   * The lease handed to a Generate. Any command aimed at a held-back placeholder first sends the held-back insertion (once, in
   * order); everything else is forwarded untouched.
   */
  function wrapLease(lease: PlaceholderLease, ownerIsCurrent: (owner: PlaceholderOwner) => boolean): PlaceholderLease {
    async function ensureInserted(entry: DeferredPlaceholder) {
      if (entry.busy) await entry.busy
      if (entry.state === 'inserted') return
      if (!ownerIsCurrent(entry.owner)) {
        throw new Error('The active presentation changed before the element placeholder was added. Reload the presentation and try again.')
      }
      const run = (async () => {
        const response = await lease.sendElementCommand('insertTextBox', entry.params)
        if (response?.success === false) {
          throw new Error(typeof response.error === 'string' && response.error ? response.error : 'Layout rejected the blank placeholder')
        }
        const insertedId = typeof response?.elementId === 'string' && response.elementId ? response.elementId : entry.elementId
        if (insertedId !== entry.elementId) {
          // The panel, the draft and every retry are keyed by this identity: an element Layout renamed cannot be tracked.
          try { await lease.sendElementCommand('deleteElement', { elementId: insertedId }) } catch { /* best effort */ }
          throw new Error('Layout answered the blank placeholder with a different identity.')
        }
        entry.state = 'inserted'
        entry.lease = lease
      })()
      entry.busy = run.finally(() => { entry.busy = null }).catch(() => {})
      try { await run } catch (error) {
        // The user reads the plain sentence; the cause stays on the error for the console.
        throw new Error(PLACEHOLDER_NOT_ADDED_MESSAGE, { cause: error })
      }
    }
    return {
      isCurrent: lease.isCurrent,
      sendElementCommand: async (action, params) => {
        const id = params && typeof params.elementId === 'string' ? params.elementId : null
        const entry = id ? entries.get(id) : undefined
        if (entry && entry.state === 'deferred') await ensureInserted(entry)
        else if (entry?.busy) await entry.busy
        return lease.sendElementCommand(action, params)
      },
    }
  }

  /**
   * A Generate ended without the generated element replacing the placeholder: take the empty one out again. Only a placeholder this
   * module inserted, only through the lease that inserted it, and never while that lease no longer matches the viewer (then the
   * state of the slide is unknown and nothing is changed). A failed delete leaves it inserted, which is today's behaviour.
   * Returns true when the slide no longer holds it.
   */
  async function takeOut(id: string): Promise<boolean> {
    const entry = entries.get(id)
    if (!entry) return false
    if (entry.busy) await entry.busy
    if (entry.state !== 'inserted' || !entry.lease) return entry.state === 'deferred'
    const lease = entry.lease
    if (!lease.isCurrent()) return false
    const run = (async () => {
      const response = await lease.sendElementCommand('deleteElement', { elementId: id })
      if (response?.success === false) throw new Error(typeof response.error === 'string' ? response.error : 'Layout refused the delete')
      entry.state = 'deferred'
      entry.lease = null
    })()
    entry.busy = run.finally(() => { entry.busy = null }).catch(() => {})
    try { await run; return true } catch (error) {
      // Already gone from the slide (a failed restore, a manual delete): the goal is met, and the next Generate inserts it afresh.
      if (error instanceof Error && /not found|no such|does not exist/i.test(error.message)) {
        entry.state = 'deferred'
        entry.lease = null
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
