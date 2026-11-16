// AUDIT P-17 (production frontend audit, "Present, slide navigation and exit"): the Exit control of Present mode did not return to the Builder. Flag NEXT_PUBLIC_STUDIO_PRESENT_EXIT_FIX
// (exact "true", default off, build-time). Off, components/presentation-viewer.tsx is byte for byte what it was.
//
// ROOT CAUSE (found by reproducing it on the real Builder, headless Chromium, stand-in Layout; evidence in the PR). handleFullscreen is a toggle that decides "enter or leave" from the BROWSER's answer
// alone: `if (!document.fullscreenElement) { enter } else { leave }`. Present mode, though, is the PAGE's state (isFullscreen: the black stage, the Exit button, the layered view-only frame). While the two agree
// the toggle is right. When they do not (the page says "presenting", the browser says "no element is full screen": a fullscreenchange that never reached the page, or a browser whose fullscreen state the page
// cannot read), pressing Exit takes the ENTER branch: it asks for fullscreen again, the page stays in Present, and nothing visible happens. That is the audit's symptom, exactly. A leave that throws (the
// browser refusing exitFullscreen mid-transition) also leaves the page presenting, because the page only left Present after the browser said so.
//
// FIX. When the page says it is presenting and the browser is not full screen, Exit leaves Present: it asks the browser to leave only if the browser is in fullscreen (a refusal is swallowed) and then ALWAYS
// sets the page's own state to "not presenting". When the browser agrees with the page, nothing here acts and the original toggle runs unchanged.
//
// IMPORT-FREE BY DESIGN: scripts/test-studio-audit-present-exit.mjs transpiles this file into a bare function scope with a fake `process`.

export function presentExitFixOn(value: string | undefined): boolean {
  return value === 'true'
}

/** The flag (a literal process.env read, so Next inlines it at build time). */
export const STUDIO_PRESENT_EXIT_FIX_ENABLED = presentExitFixOn(process.env.NEXT_PUBLIC_STUDIO_PRESENT_EXIT_FIX)

/**
 * True when Exit must leave Present on the page's own authority: the flag is on, the page is presenting, and the browser reports no full-screen element. Off, or when the browser agrees with the page
 * (it is full screen) or the page is not presenting, false: the original toggle decides.
 */
export function presentExitDesynced(enabled: boolean, pagePresenting: boolean, browserFullscreen: boolean): boolean {
  return enabled === true && pagePresenting === true && browserFullscreen !== true
}

/** The slice of the DOM Document this reads. */
export interface PresentExitDocument {
  fullscreenElement?: unknown
  exitFullscreen?: () => Promise<void> | void
}

/** Asks the browser to leave fullscreen only while it is in fullscreen; a refusal or a missing API is swallowed (the caller then leaves Present itself). Never throws. */
export async function leaveBrowserFullscreen(doc: PresentExitDocument): Promise<void> {
  try {
    if (doc.fullscreenElement && typeof doc.exitFullscreen === 'function') await doc.exitFullscreen()
  } catch {
    // The page leaves Present anyway.
  }
}
