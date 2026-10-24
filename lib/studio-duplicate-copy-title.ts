// NEXT_PUBLIC_STUDIO_DUPLICATE_COPY_TITLE (FRONTEND-2, follows "Duplicate a deck"; default off). Two small gaps E2E-2 found when the copy went live:
//   1. The Decks page cut the original and its copy to the same words ("moving weekly status meeting…"), so the " (copy)" suffix, the one thing that tells them apart, never showed.
//   2. The copy's Builder header said "Studio", not its title: the header reads slideStructure.metadata.main_title, which a copy has not got (duplicating stores the copy's title on the session row and
//      in Layout, but writes no slideStructure, and the Builder's restore only reads the slideStructure column).
// This module is the pure half. It reads nothing but what the duplicate already stored, and writes nothing.
//
// (1) The deck cards' files are held byte for byte by other changes' pins, so the card is fixed from outside, the way lib/studio-payments-open-soon.ts gates the Billing page: a DOM pass that ONLY SETS
// ATTRIBUTES (never a text node, never a node added or removed, which React would trip over on its next render), and a scoped stylesheet (components/builder/studio-duplicate-copy-title.css) that draws
// the title as two parts: the base name, cut with an ellipsis, and the suffix in its own part that never shrinks. The card's link keeps its real text (see the sheet: it is only made see-through, so
// it stays the focus target, the link and the accessible name), and gets a `title` tooltip with the full name unless it already has one.
// (2) The copy's session is found by its stored "copied from" marker (readCopiedFrom), the same marker the copy's chat note reads; the title is the session's own stored title, which is what the
// Decks page draws for it. A session with no marker (every deck that was not copied) gives nothing, so its header and card are as before.
import { COPY_TITLE_SUFFIX, duplicateTitle, readCopiedFrom } from '@/lib/studio-duplicate-deck'

/** Exact "true" only, read at build time (Next inlines NEXT_PUBLIC_ values in the browser and server bundles alike). */
export const STUDIO_DUPLICATE_COPY_TITLE_ENABLED = process.env.NEXT_PUBLIC_STUDIO_DUPLICATE_COPY_TITLE === 'true'

/** On <html> while the pass runs (the stylesheet is scoped to it). */
export const COPY_TITLE_HTML_ATTR = 'data-studio-copy-title'
/** "1" on the box that holds a copy card's title; the stylesheet draws the two parts from the two attributes below. */
export const COPY_TITLE_HOST_ATTR = 'data-studio-copy-title-host'
export const COPY_TITLE_BASE_ATTR = 'data-studio-copy-title-base'
export const COPY_TITLE_SUFFIX_ATTR = 'data-studio-copy-title-suffix'
/** "1" on a card link whose `title` tooltip this pass wrote (so it can be updated or taken away again without touching a tooltip somebody else set). */
export const COPY_TITLE_TIP_ATTR = 'data-studio-copy-title-tip'

/** The card's title box, as the Decks page draws it: a block with the class line-clamp-1 (one line, ellipsis) that holds the title's link, inside the card header. */
const CARD_HEADER = '[data-studio-deck-card-header]'
const CLAMP_CLASS = 'line-clamp-1'

export interface CopyTitleParts { base: string; suffix: string }

/** "<base> (copy)" is split into the base and the suffix duplicateTitle() adds; any other title (or one that is only the suffix) is not a copy's. */
export function splitCopyTitle(title: string | null | undefined): CopyTitleParts | null {
  if (typeof title !== 'string' || !title.endsWith(COPY_TITLE_SUFFIX)) return null
  const base = title.slice(0, title.length - COPY_TITLE_SUFFIX.length)
  return base.trim() ? { base, suffix: COPY_TITLE_SUFFIX } : null
}

const hasClass = (el: Element, name: string): boolean => (el.getAttribute('class') ?? '').split(/\s+/).includes(name)

/** Puts a title box back as the page drew it (the attributes this pass set come off; nothing else is touched). */
function releaseHost(host: Element, link: Element | null): void {
  for (const attr of [COPY_TITLE_HOST_ATTR, COPY_TITLE_BASE_ATTR, COPY_TITLE_SUFFIX_ATTR]) if (host.hasAttribute(attr)) host.removeAttribute(attr)
  if (link && link.getAttribute(COPY_TITLE_TIP_ATTR) === '1') { link.removeAttribute('title'); link.removeAttribute(COPY_TITLE_TIP_ATTR) }
}

/**
 * Marks every copy card under `root`: the title's box gets the host mark with the two parts, and its link gets the full name as a tooltip (an existing tooltip is left alone). A card whose title
 * is not a copy's any more (it was renamed, or the list re-used the node for another deck) is put back as it was. Safe to run again and again; the number of cards it changed.
 */
export function applyCopyTitles(root: ParentNode): number {
  let changed = 0
  for (const header of Array.from(root.querySelectorAll(CARD_HEADER))) {
    for (const link of Array.from(header.querySelectorAll('a'))) {
      const host = link.parentElement
      if (!host || !hasClass(host, CLAMP_CLASS)) continue
      const text = link.textContent ?? ''
      const parts = splitCopyTitle(text)
      if (!parts) {
        if (host.hasAttribute(COPY_TITLE_HOST_ATTR)) { releaseHost(host, link); changed++ }
        continue
      }
      const already = host.getAttribute(COPY_TITLE_HOST_ATTR) === '1' && host.getAttribute(COPY_TITLE_BASE_ATTR) === parts.base && host.getAttribute(COPY_TITLE_SUFFIX_ATTR) === parts.suffix
      if (!already) {
        host.setAttribute(COPY_TITLE_HOST_ATTR, '1')
        host.setAttribute(COPY_TITLE_BASE_ATTR, parts.base)
        host.setAttribute(COPY_TITLE_SUFFIX_ATTR, parts.suffix)
        changed++
      }
      if (!link.hasAttribute('title') || link.getAttribute(COPY_TITLE_TIP_ATTR) === '1') {
        if (link.getAttribute('title') !== text) { link.setAttribute('title', text); changed++ }
        link.setAttribute(COPY_TITLE_TIP_ATTR, '1')
      }
    }
  }
  return changed
}

/** Takes every attribute this pass set off again (a page that stays mounted when the pass stops is as it was). */
function release(root: ParentNode): void {
  for (const host of Array.from(root.querySelectorAll(`[${COPY_TITLE_HOST_ATTR}]`))) {
    const link = Array.from(host.querySelectorAll('a')).find(item => item.parentElement === host) ?? null
    releaseHost(host, link)
  }
}

/**
 * Turns the pass on for a window: <html> carries the attribute the stylesheet is scoped to, and the pass runs now and after every change of the page (a card that appears later, a deck that is
 * renamed). Returns the undo.
 */
export function installCopyTitles(win: Window & typeof globalThis): () => void {
  const doc = win.document
  const html = doc.documentElement
  html.setAttribute(COPY_TITLE_HTML_ATTR, 'true')
  let timer: number | null = null
  const run = () => { timer = null; applyCopyTitles(doc) }
  const schedule = () => { if (timer === null) timer = win.setTimeout(run, 0) } // many changes in one tick (a page of cards) are one pass
  const observer = new win.MutationObserver(schedule)
  observer.observe(doc.body, { childList: true, subtree: true, characterData: true })
  run()
  return () => {
    observer.disconnect()
    if (timer !== null) win.clearTimeout(timer)
    release(doc)
    html.removeAttribute(COPY_TITLE_HTML_ATTR)
  }
}

/**
 * The copy's own title, from the session as GET /api/sessions/{id} returns it, or null. Only a session that carries the "copied from" marker has one (a deck that was not copied gives null, so its
 * header stays as it was); the title is the session's stored title, else what the duplicate would have made of the marker's title.
 */
export function copyTitleFromSession(session: unknown): string | null {
  const marker = readCopiedFrom(session)
  if (!marker) return null
  const stored = (session as { title?: unknown } | null | undefined)?.title
  const own = typeof stored === 'string' ? stored.trim() : ''
  return own || duplicateTitle(marker.title)
}

/** Reads the one session. Never throws and never writes: any failure (offline, 401, 404 for an unsaved session, a bad body) is "no copy title". */
export async function loadCopyTitle(
  sessionId: string,
  fetchImpl: (input: string, init?: RequestInit) => Promise<Response>,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const response = await fetchImpl(`/api/sessions/${encodeURIComponent(sessionId)}`, { cache: 'no-store', ...(signal ? { signal } : {}) })
    if (!response.ok) return null
    const body = await response.json()
    return copyTitleFromSession(body?.session)
  } catch {
    return null
  }
}
