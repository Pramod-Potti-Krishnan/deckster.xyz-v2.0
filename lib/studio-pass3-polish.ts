// NEXT_PUBLIC_STUDIO_PASS3_POLISH (FRONTEND-2, Pass 3 polish set; default off, exact "true", read at build time). Import-free.
//
// ONE flag for the whole polish set: the findings of the static audit (POLISH-AUDIT.md) and of the rendered sweep, each a small presentation-only rule. The rules live in ONE stylesheet,
// components/studio-pass3-polish/studio-pass3-polish.css, organised in numbered sections that a later PR appends to; every rule in it starts with <html data-studio-pass3-polish="true">.
// This file is the other half: the attribute. A tiny client mount (components/studio-pass3-polish/studio-pass3-polish-mount.tsx for the account pages, the hook itself for the Builder) sets it on
// <html> while a Studio route is on screen and takes it off again when the route goes. Flag off, nothing here runs: the hook returns before it reads the document, so the attribute is never set
// and not one rule of the stylesheet matches anything.
//
// It only SETS AN ATTRIBUTE on <html>, the way hooks/use-studio-publish-review-fit.ts and lib/studio-payments-open-soon.ts do. It never changes a text node, never adds or removes a node and never
// touches an element React renders into (React keeps references to the nodes it made, and one it cannot find again throws on its next render). <html> has suppressHydrationWarning in app/layout.tsx.

/**
 * Exact "true" only, read at build time (Next inlines NEXT_PUBLIC_ values in the browser and server bundles alike), and only with the Studio shell (NEXT_PUBLIC_STUDIO_V4_SHELL, exact "true"): the polish set is
 * for the Studio shell's pages, and without the shell the account pages and the Builder are the older pages, which this set does not touch.
 */
export const STUDIO_PASS3_POLISH_ENABLED = process.env.NEXT_PUBLIC_STUDIO_PASS3_POLISH === 'true' && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

/** On <html> while a Studio route is on screen and the flag is on; the stylesheet is scoped to it. */
export const STUDIO_PASS3_POLISH_ATTR = 'data-studio-pass3-polish'

// How many mounts hold the attribute right now (the account layout and the Builder are never on screen together, but React strict mode runs an effect, its cleanup and the effect again).
let holders = 0

/**
 * Sets the attribute on the document's root element and returns the function that gives it back. The attribute comes off only when the LAST holder lets go, and a holder that lets go twice
 * counts once. `doc` is the document (a test passes a stand-in); only `documentElement` is read.
 */
export function installPass3Polish(doc: { documentElement: { setAttribute(name: string, value: string): void; removeAttribute(name: string): void } }): () => void {
  const root = doc.documentElement
  holders += 1
  root.setAttribute(STUDIO_PASS3_POLISH_ATTR, 'true')
  let released = false
  return () => {
    if (released) return
    released = true
    holders -= 1
    if (holders <= 0) {
      holders = 0
      root.removeAttribute(STUDIO_PASS3_POLISH_ATTR)
    }
  }
}
