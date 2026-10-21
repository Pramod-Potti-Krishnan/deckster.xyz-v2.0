// RAIL-SLIDES-1-MIDBUILD (flag NEXT_PUBLIC_STUDIO_RAIL_BUILD_COUNT): the lines this change adds to components/builder/presentation-area.tsx,
// components/presentation-viewer.tsx and components/slide-thumbnail-strip.tsx, which earlier pins hold to a base commit ("without the added lines the
// file is <base>'s", "the viewer loses no line"). Sibling pins call these first and then do what they always did, the way they already take out the
// PASS2D B4 and SLIDE-OPS-VIA-VIEWER lines. scripts/test-studio-rail-build-count.mjs pins every one of these lines.
//
// Every added line carries the marker. Three base lines are replaced, not just added to (the rail's render condition in the viewer, the strip's early
// return, the strip heading's number); the diff-based pins take them out with `belongsToRailBuildCount`, the text-based ones restore the condition with
// `restoreRailCondition`.

export const RAIL_BUILD_COUNT_MARKER = 'RAIL-SLIDES-1-MIDBUILD'

/** `text` without the lines that carry this change's marker (the area has no replaced line, so that is the base file). */
export function stripRailBuildCount(text) {
  return text.split('\n').filter(line => !line.includes(RAIL_BUILD_COUNT_MARKER)).join('\n')
}

const REPLACED_BASE_LINES = [
  /^-            \{showThumbnails && \(slideThumbnails\.length > 0 \|\| composeJobs\.length > 0\) && \($/,
  /^-  if \(slides\.length === 0 && composeJobs\.length === 0\) \{$/,
]
const HEADING_LINE = /^[+-]      \{STUDIO_THUMBNAILS && <div className="studio-thumbnail-heading">/

/** A line of `git diff -U0` that belongs to this change (marked, or one of the base lines it replaces, or the heading line in either text). */
export function belongsToRailBuildCount(diffLine) {
  return diffLine.includes(RAIL_BUILD_COUNT_MARKER) || REPLACED_BASE_LINES.some(pattern => pattern.test(diffLine)) || HEADING_LINE.test(diffLine)
}

const RAIL_CONDITION = '{showThumbnails && (slideThumbnails.length > 0 || composeJobs.length > 0) && ('
const RAIL_CONDITION_MARKED = `{showThumbnails && (slideThumbnails.length > 0 || composeJobs.length > 0 || Boolean(railBuildRows?.length)) && ( // ${RAIL_BUILD_COUNT_MARKER}`

/** The viewer text with the rail's render condition as it was before this change (the marked line is the only replaced one). */
export function restoreRailCondition(text) {
  return text.replace(RAIL_CONDITION_MARKED, RAIL_CONDITION)
}
