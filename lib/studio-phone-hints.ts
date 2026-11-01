// STUDIO PHONE HINTS (FRONTEND-1; F-13 PR 2, PK's answers of 1 Nov). Flag NEXT_PUBLIC_STUDIO_PHONE_HINTS (exact "true", default off, read at build time), only active with PR 1's flag (NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE) and so with the phone shell
// (NEXT_PUBLIC_STUDIO_PHONE_SHELL and NEXT_PUBLIC_STUDIO_V4_SHELL). Import-free: the flag, the two hints' storage keys and show rules, the Full screen state machine, and the swipe's decision. No I/O but the storage object it is handed; the hook
// (hooks/use-studio-phone-hints.ts) and the component (components/builder/studio-phone-hints.tsx) read the page and call these.
//
// What the flag adds on a phone: in the portrait slide view a one-time "Rotate for the best view" card (dismiss X, "Full screen", "Not now"; stored per phone, in localStorage, in try / catch), a "Full screen" button above the slide, and swipe left / right to change slide
// (there are no prev / next arrows) with a one-time swipe hint; in the landscape stage a Full screen button beside Chat. Full screen asks the browser for it inside the tap (requestFullscreen on the viewer's own box) and, where the browser refuses or has none (iPhone Safari),
// becomes a fixed 100dvh stage of our own. The screen is never locked to an orientation.

/** Exact "true" for the flag AND PR 1's flag AND the phone shell AND the Studio shell; anything else is off. The caller passes the four `process.env` values (Next inlines them at build time). */
export function studioPhoneHintsOn(flag: string | null | undefined, landscape: string | null | undefined, phoneShell: string | null | undefined, studioShell: string | null | undefined): boolean {
  return flag === 'true' && landscape === 'true' && phoneShell === 'true' && studioShell === 'true'
}

/** The flag, resolved once at build time. Every element this change adds is drawn only when it is true. */
export const STUDIO_PHONE_HINTS_ENABLED = studioPhoneHintsOn(process.env.NEXT_PUBLIC_STUDIO_PHONE_HINTS, process.env.NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE, process.env.NEXT_PUBLIC_STUDIO_PHONE_SHELL, process.env.NEXT_PUBLIC_STUDIO_V4_SHELL)

/** The attributes the page's <html> carries while the hints component is mounted; the stylesheet is keyed to them. */
export const STUDIO_PHONE_HINTS_ATTRIBUTE = 'data-studio-phone-hints'
export const STUDIO_PHONE_FULLSCREEN_ATTRIBUTE = 'data-studio-phone-fullscreen'
export const STUDIO_PHONE_SWIPE_ATTRIBUTE = 'data-studio-phone-swipe'

/** What is asked of the browser's full screen: the viewer's own box (the same element its Present uses; its own full-screen layout takes over when the browser says so). */
export const STUDIO_PHONE_FULLSCREEN_TARGET = '[data-studio-v4-viewer]'

// ---- the two one-time hints, stored per phone (not per account: the question is about this phone) --------------------------------------------------
export const STUDIO_PHONE_ROTATE_HINT_KEY = 'studio.phoneRotateHint.v1'
export const STUDIO_PHONE_SWIPE_HINT_KEY = 'studio.phoneSwipeHint.v1'

/** The two methods of localStorage the hints use. */
export interface StudioHintStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }

/** True when the key was stored on this phone. localStorage can throw (Safari private mode, blocked site data), and then the answer is "not seen": the hint shows once per page load at most (the caller keeps its own memory). */
export function studioPhoneHintSeen(storage: StudioHintStorage | null | undefined, key: string): boolean {
  try { return storage ? storage.getItem(key) === '1' : false } catch { return false }
}

/** Stores the key; a storage that throws is ignored (the caller's memory still holds for the page load). True when it was written. */
export function studioPhoneHintRemember(storage: StudioHintStorage | null | undefined, key: string): boolean {
  try { if (!storage) return false; storage.setItem(key, '1'); return true } catch { return false }
}

/** The rotate hint: in the portrait slide view (a deck on the stage, the stage on screen), not stored, not in full screen. `seen` is null until the storage has been read (nothing flashes before that). */
export function studioPhoneRotateHintShown(input: { enabled: boolean; portraitSlideView: boolean; seen: boolean | null; fullscreen: StudioPhoneFullscreenState }): boolean {
  return input.enabled === true && input.portraitSlideView === true && input.seen === false && input.fullscreen === 'off'
}

/** The swipe hint is for a view where a swipe works and there is something to swipe to, until it has been shown once on this phone. */
export function studioPhoneSwipeHintShown(input: { swipeOn: boolean; seen: boolean | null; slideCount: number }): boolean {
  return input.swipeOn === true && input.seen === false && input.slideCount > 1
}

// ---- Full screen: the browser's where it works, a stage of our own where it does not --------------------------------------------------------------
export type StudioPhoneFullscreenState = 'off' | 'native' | 'fallback'

/** Whether to ask the browser at all: it must say it can (document.fullscreenEnabled) and the box must have requestFullscreen. iPhone Safari has no element full screen: it goes straight to the stage of our own. */
export function studioPhoneFullscreenCanTry(input: { fullscreenEnabled: unknown; hasRequest: unknown }): boolean {
  return input.fullscreenEnabled === true && input.hasRequest === true
}

/** The state after what happened: the tap found no way to ask ('unsupported'), the browser said yes ('granted') or refused ('refused', a rejected promise or a throw), the browser's own full screen ended ('ended', Escape or a system gesture),
 *  or Exit was tapped on our own stage ('exit'). The browser's own end never ends a stage of our own (only Exit does). */
export function studioPhoneFullscreenNext(state: StudioPhoneFullscreenState, event: 'unsupported' | 'granted' | 'refused' | 'ended' | 'exit'): StudioPhoneFullscreenState {
  if (event === 'unsupported' || event === 'refused') return 'fallback'
  if (event === 'granted') return 'native'
  if (event === 'ended') return state === 'native' ? 'off' : state
  return 'off'
}

// ---- Swipe: left / right changes the slide in the portrait slide view (and in our own full-screen stage), no prev / next arrows ------------------------
/** A swipe is a quick, mostly horizontal drag: far enough, fast enough, and clearly more across than up or down. */
export const STUDIO_PHONE_SWIPE = { minDistance: 40, maxMilliseconds: 800, horizontalRatio: 1.5 } as const

/** Whether a swipe changes the slide: the portrait slide view or our own full-screen stage, not while the user is editing the slide (its frame then takes the touches), and only with more than one slide. */
export function studioPhoneSwipeOn(input: { enabled: boolean; portraitSlideView: boolean; fallback: boolean; editing: boolean; slideCount: number }): boolean {
  return input.enabled === true && (input.portraitSlideView === true || input.fallback === true) && input.editing !== true && input.slideCount > 1
}

/** A drag from touch-down to touch-up (dx, dy in px, dt in ms; left is negative dx): swiping left goes to the next slide, right to the previous one; nothing past the first or the last slide, and nothing for a slow, short or mostly vertical drag. */
export function studioPhoneSwipeDirection(input: { dx: number; dy: number; dt: number; slide: number; count: number }): 'next' | 'prev' | null {
  const { dx, dy, dt, slide, count } = input
  if (![dx, dy, dt, slide, count].every(Number.isFinite)) return null
  if (Math.abs(dx) < STUDIO_PHONE_SWIPE.minDistance || dt > STUDIO_PHONE_SWIPE.maxMilliseconds || Math.abs(dx) < Math.abs(dy) * STUDIO_PHONE_SWIPE.horizontalRatio) return null
  if (dx < 0) return slide < count ? 'next' : null
  return slide > 1 ? 'prev' : null
}
