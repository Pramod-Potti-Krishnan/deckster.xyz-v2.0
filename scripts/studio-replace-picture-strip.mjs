// FRONTEND-1 (PK mandate M10 of 15 Nov 2026, Replace picture: swap a title, section or closing slide's picture as the slide's own background layer). Flag NEXT_PUBLIC_STUDIO_REPLACE_SLIDE_PICTURE (exact "true", default off, build-time).
// It acts only with NEXT_PUBLIC_STUDIO_V4_SHELL also on, and its command needs Layout's LAYOUT_SLIDE_BACKGROUND_PICTURE_ENABLED (SLIDE-4, Layout Draft !294). Off, the viewer, the slide area and the Builder page are byte for byte what they were.
// Every line this change adds to an EXISTING file carries the marker REPLACE-PICTURE (matched as a whole token). One base line is rewritten (the viewer bridge's rejection of a failed command), so the strip is a list of [has, was] pairs, not a marker
// filter: putting each pair back gives the file at BASE_COMMIT byte for byte. The new files have no base text.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '3098f860cd97226d6405631bad870a9be5b52523' // origin/studio-v4-dev-preparation-code (#634 merged), the trunk this change sits on
export const REPLACE_PICTURE_FLAGS = ["NEXT_PUBLIC_STUDIO_REPLACE_SLIDE_PICTURE"]
export const REPLACE_PICTURE_MARKER = 'REPLACE-PICTURE'
/** The marker as a WHOLE token: REPLACE-PICTURE is this change's; REPLACE-PICTURE-X and X-REPLACE-PICTURE are not. */
export const REPLACE_PICTURE_MARKER_RE = /(?<![\w-])REPLACE-PICTURE(?![\w-])/
/** The subject prefix of this change's own commits. */
export const REPLACE_PICTURE_SUBJECT = "Replace picture:"

/** Existing files that get marked lines. */
export const REPLACE_PICTURE_FILES = [
  "components/presentation-viewer.tsx",
  "components/builder/presentation-area.tsx",
  "app/builder/page.tsx"
]

/** New files (no base text to put back). */
export const REPLACE_PICTURE_NEW_FILES = [
  "lib/studio-replace-picture.ts",
  "hooks/use-studio-replace-picture.ts",
  "components/builder/replace-picture/replace-picture-control.tsx",
  "components/builder/replace-picture/replace-picture.css",
  "scripts/studio-replace-picture-strip.mjs",
  "scripts/test-studio-replace-picture.mjs"
]

/** The new libs that read a flag: [file, flag], one literal env read each. */
export const REPLACE_PICTURE_LIB_FLAGS = [["lib/studio-replace-picture.ts", "NEXT_PUBLIC_STUDIO_REPLACE_SLIDE_PICTURE"]]

/** [text the file has now, text the file had at BASE_COMMIT] per edit (one per marked line, in the order they sit in the file); putting them back gives the base file byte for byte. */
export const REPLACE_PICTURE_EDITS = {
  "components/presentation-viewer.tsx": [
    [
      "import { STUDIO_REPLACE_SLIDE_PICTURE_ENABLED, REPLACE_PICTURE_COMMAND, replacePictureReplyError } from '@/lib/studio-replace-picture' // REPLACE-PICTURE (NEXT_PUBLIC_STUDIO_REPLACE_SLIDE_PICTURE, default off): the Replace picture action sends Layout's setSlideBackgroundPicture\n",
      ""
    ],
    [
      "import { useStudioReplacePicture } from '@/hooks/use-studio-replace-picture' // REPLACE-PICTURE\n",
      ""
    ],
    [
      "import { ReplacePictureControl } from '@/components/builder/replace-picture/replace-picture-control' // REPLACE-PICTURE\n",
      ""
    ],
    [
      "  onReplacePictureReloadDeck?: () => void // REPLACE-PICTURE (NEXT_PUBLIC_STUDIO_REPLACE_SLIDE_PICTURE): the page's Reload deck, offered after a picture that was stored but not drawn; passed only with the flag on\n",
      ""
    ],
    [
      "            reject(STUDIO_REPLACE_SLIDE_PICTURE_ENABLED && action === REPLACE_PICTURE_COMMAND ? replacePictureReplyError(event.data) : new Error(event.data.error || 'Command failed')) // REPLACE-PICTURE: a failed setSlideBackgroundPicture rejects with an Error that carries the reply's stable code (lib/studio-replace-picture.ts maps it to plain words); every other command rejects as before\n",
      "            reject(new Error(event.data.error || 'Command failed'))\n"
    ],
    [
      "  onReplacePictureReloadDeck, // REPLACE-PICTURE\n",
      ""
    ],
    [
      "  const replacePicture = useStudioReplacePicture({ enabled: STUDIO_REPLACE_SLIDE_PICTURE_ENABLED && studioShell, deckOpen: Boolean(approvedPresentationUrl && presentationId), viewerReady: viewerIsReady, presenting: isFullscreen, presentationId, frameUrl: approvedPresentationUrl, activeVersion, currentSlide, railSlideId: slideThumbnails[currentSlide - 1]?.slideId ?? null, railSlideTitle: slideThumbnails[currentSlide - 1]?.title ?? null, tabPausedHint: studioTabPausedHint, templateMode: templateModeOn, building: Boolean(isGenerating || studioPartialArtifact), studioBusy: Boolean(studioFormatBusy), composeJobs, mutationPending: isSlideMutationPending, send: sendCommand, getIframe: () => iframeRef.current, begin: beginStudioNativeSlideMutation, afterReplace: () => { reportDeckChange('element'); if (presentationId) onThumbnailInvalidatedRef.current?.(presentationId); slideRailRefreshRef.current() }, onReloadDeck: onReplacePictureReloadDeck }) // REPLACE-PICTURE (NEXT_PUBLIC_STUDIO_REPLACE_SLIDE_PICTURE): the Replace picture action for the slide on screen; off, it reads and sends nothing\n",
      ""
    ],
    [
      "              {replacePicture.visible && <ReplacePictureControl reason={replacePicture.reason} slideNumber={replacePicture.slideNumber} slideTitle={replacePicture.slideTitle} onReplace={replacePicture.replace} onReloadDeck={replacePicture.reloadDeck} buttonClassName={cn(toolbarButtonClass, toolbarBtnBase)} labelClassName={cn(toolbarLabelClass, 'whitespace-nowrap')} tooltipContainer={toolbarDropdownPortalContainer} />}{/* REPLACE-PICTURE: Replace picture, beside Format (the flag, the shell, a built deck, not presenting) */}\n",
      ""
    ]
  ],
  "components/builder/presentation-area.tsx": [
    [
      "  onReplacePictureReloadDeck?: () => void // REPLACE-PICTURE: passed to the viewer unchanged (see PresentationViewer.onReplacePictureReloadDeck)\n",
      ""
    ],
    [
      "  onReplacePictureReloadDeck, // REPLACE-PICTURE\n",
      ""
    ],
    [
      "            onReplacePictureReloadDeck={onReplacePictureReloadDeck} // REPLACE-PICTURE\n",
      ""
    ]
  ],
  "app/builder/page.tsx": [
    [
      "            onReplacePictureReloadDeck={STUDIO_REPLACE_SLIDE_PICTURE_ENABLED && studioShell ? reloadDeckFromOtherTab : undefined} // REPLACE-PICTURE (NEXT_PUBLIC_STUDIO_REPLACE_SLIDE_PICTURE): the viewer's Replace picture offers this Reload deck after a picture that was stored but not drawn; off, nothing is passed\n",
      ""
    ],
    [
      "import { STUDIO_REPLACE_SLIDE_PICTURE_ENABLED } from '@/lib/studio-replace-picture' // REPLACE-PICTURE\n",
      ""
    ]
  ]
}

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, so putting them back gives the previous file byte for byte. */
export const REPLACE_PICTURE_PIN_MARK = "LATER-CHANGES: registry read (REPLACE-PICTURE)"
export const REPLACE_PICTURE_PIN_EDITS = {}

/** The older proofs this change teaches. */
export const REPLACE_PICTURE_PIN_FILES = Object.keys(REPLACE_PICTURE_PIN_EDITS)

export const REPLACE_PICTURE_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...REPLACE_PICTURE_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const REPLACE_PICTURE_SCOPE_FILES = new Set([...REPLACE_PICTURE_FILES, ...REPLACE_PICTURE_NEW_FILES, ...REPLACE_PICTURE_OWN_EDITS])

/** The whole .env.example block: its comments and its line. */
export const REPLACE_PICTURE_ENV_BLOCK = "# STUDIO REPLACE PICTURE (FRONTEND-1; PK mandate M10, 15 Nov). On for the exact value \"true\"; default off, and then the slide toolbar, the viewer and the Builder page are byte for byte what they were. Build-time value: change it on Vercel and redeploy.\n# On, and only with NEXT_PUBLIC_STUDIO_V4_SHELL also exactly \"true\": the slide toolbar gains a \"Replace picture\" button beside Format. It takes an https picture link (and an optional description) for the slide on screen and sends the Layout viewer's setSlideBackgroundPicture command (SLIDE-4, Layout Draft !294), which puts the picture into the slide's own background slot and HIDES (never deletes) a whole-slide free picture that Studio's older hero refine put over it. The reply takes up to 20 seconds.\n# Turn it on only after Layout's LAYOUT_SLIDE_BACKGROUND_PICTURE_ENABLED is on, with LAYOUT_SLIDES_PUT_STALE_GUARD_ENABLED and LAYOUT_STORAGE_TO_THREAD_ENABLED also true on that Layout (section 0 of docs/api/SLIDE_BACKGROUND_PICTURE.md): with Layout's flag off the viewer answers \"unknown action\" and Studio says in plain words that the server does not have it yet.\n# The button is greyed, with the reason, while a build or a regenerate of the slide runs, another slide change is in flight, the tab is paused, Template Mode is on, the deck is read-only (a view-only frame, the outline preview, a published copy), or the slide is not a title, section or closing slide. Nothing else changes: no new route, and no new request except that one viewer command and two small viewer reads (the slide's kind and its id).\nNEXT_PUBLIC_STUDIO_REPLACE_SLIDE_PICTURE=\"false\"\n"

/** The file with this change's edits put back (the previous text). Used by the strip and the proof. */
export function putBackReplacePicture(rel, text) {
  return (REPLACE_PICTURE_EDITS[rel] || REPLACE_PICTURE_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The file without this change's edits: each [has, was] pair put back; every other byte stays. Any other file is returned as it is. */
export function stripReplacePicture(rel, text) {
  if (typeof text !== 'string') return text
  if (!(rel in REPLACE_PICTURE_EDITS) && !(rel in REPLACE_PICTURE_PIN_EDITS)) return text
  return putBackReplacePicture(rel, text)
}
