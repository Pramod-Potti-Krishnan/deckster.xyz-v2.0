/**
 * D-A5 (Studio half): the "N of M built" counter (stage-ribbon.tsx) is `slidesDone`, the number of slides
 * the narration reducer holds as 'built'. With the flag on, 'built' (and 'skipped') is terminal against a
 * late per-slide 'qa' event and against a reconnect snapshot that is behind the live state, so the counter
 * only ever grows within one build. A real 'error' after build still shows, and a new build id still starts
 * from an empty state. Exact "true" enables it; default off, and then the reducer is exactly as before.
 *
 * The rule itself lives in lib/build-narration-heuristics.ts (setSlideState and the typed_sync case); this
 * module only reads the flag, because that file is import-free and unit-tested in a bare vm sandbox.
 */
export const STUDIO_BUILD_COUNTER_BUILT_TERMINAL_ENABLED =
  process.env.NEXT_PUBLIC_STUDIO_BUILD_COUNTER_BUILT_TERMINAL_ENABLED === 'true'
