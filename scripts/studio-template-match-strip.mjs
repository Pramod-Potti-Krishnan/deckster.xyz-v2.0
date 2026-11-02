// FRONTEND-2 (PK's W2 P4-7/8 rulings, 2 Nov: auto-apply ON by default with a user switch, a built slide keeps its template, switching from chat is allowed). Flag NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH (the string "true", default off, build-time):
// Studio shows the template Director applied. A badge above the slide ("Using your template <name> · <n> of <m> slides", "<n> slides use your templates", "Using <name> for the slides not built yet") with Change and, after a switch, Undo;
// a source chip inside each rail thumbnail; a "Use with this deck" group on top of the Template picker (today's list under "Start a new presentation"); the same rows as a bottom sheet on a phone; and one check at the top of the chat composer's
// "Reuse a template" pop-up ("Use my best-matching template", ticked by default). The socket advertises template_match1 (last in client_caps), sends template_auto_apply on every connect and each toggle and template_switch for a picker action
// or an Undo, and reads Director's template_match frame. Director's "applied" only RECORDS the choice until P4-8 / P4-9 land, so Director's DIRECTOR_TEMPLATE_MATCH_ENABLED stays off until then and this flag is never switched on before it.
// Every decision is lib/studio-template-match.ts (pure); hooks/use-studio-template-match.ts holds the latest frame, the preference and the sends; lib/studio-template-match-wire.ts is the capability on the wire; components/builder/studio-template-match-*.tsx (+ .css)
// and studio-template-auto-apply-check.tsx draw the pieces.
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker STUDIO-TEMPLATE-MATCH (matched as a whole token), except ONE rewritten line: the Template picker's heading (components/studio-template-workspace/picker.tsx), which
// reads "Start a new presentation" while the group above it is drawn; STUDIO_TEMPLATE_MATCH_REWRITES holds the marked line and the original it replaces, so the strip puts the original back byte for byte. Strip the marked lines and each file is its base.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines), and teaches the older proofs that read past it (STUDIO_TEMPLATE_MATCH_PIN_EDITS: one registry-read line each).
// Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'dc1540195b58630a345d4ada0f81edd9a31b4673' // origin/studio-v4-dev-preparation-code with #557 merged (2 Nov, 15:04Z): the dev tip this change was last merged with (it was cut from 1f7b9fc2, #556 merged)
export const STUDIO_TEMPLATE_MATCH_FLAG = 'NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH'
export const STUDIO_TEMPLATE_MATCH_MARKER = 'STUDIO-TEMPLATE-MATCH'
/** The marker as a WHOLE token: STUDIO-TEMPLATE-MATCH-X and X-STUDIO-TEMPLATE-MATCH are not it. */
export const STUDIO_TEMPLATE_MATCH_MARKER_RE = /(?<![\w-])STUDIO-TEMPLATE-MATCH(?![\w-])/
/** The subject prefix of this change's own commits (the proof finds them by it). */
export const STUDIO_TEMPLATE_MATCH_SUBJECT = 'Template match:'

/** Existing files that get marked lines (pure insertions, but for the rewrites below). */
export const STUDIO_TEMPLATE_MATCH_FILES = [
  'components/builder/presentation-area.tsx',
  'components/slide-thumbnail-strip.tsx',
  'components/studio-template-workspace/picker.tsx',
  'components/builder/template-picker.tsx',
  'hooks/use-deckster-websocket-v2.ts',
]

/** [the marked line the file has now, the original line it replaces], whole lines without the newline, per file. */
export const STUDIO_TEMPLATE_MATCH_REWRITES = {
  'components/studio-template-workspace/picker.tsx': [
    [
      "              <h3>{studioTemplateGroupShown ? 'Start a new presentation ' : 'Start from a template '}<span>{listedCount}</span></h3>{/* STUDIO-TEMPLATE-MATCH: with the group above, today's list is headed \"Start a new presentation\" (its line below, \"Creates a new presentation.\", is today's) */}",
      '              <h3>Start from a template <span>{listedCount}</span></h3>',
    ],
  ],
}

/** New files (no base text to put back). */
export const STUDIO_TEMPLATE_MATCH_NEW_FILES = [
  'lib/studio-template-match.ts',
  'lib/studio-template-match-wire.ts',
  'hooks/use-studio-template-match.ts',
  'components/builder/studio-template-match-badge.tsx',
  'components/builder/studio-template-match-chip.tsx',
  'components/builder/studio-template-match-group.tsx',
  'components/builder/studio-template-match-sheet.tsx',
  'components/builder/studio-template-auto-apply-check.tsx',
  'components/builder/studio-template-match.css',
  'scripts/studio-template-match-strip.mjs',
  'scripts/test-studio-template-match.mjs',
  'scripts/studio-template-match-fixtures/frames.json',
]

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, whole lines, so putting them back gives the previous file byte for byte. Every line the proof has now carries STUDIO_TEMPLATE_MATCH_PIN_MARK. */
export const STUDIO_TEMPLATE_MATCH_PIN_MARK = '// LATER-CHANGES: registry read (STUDIO-TEMPLATE-MATCH)'
export const STUDIO_TEMPLATE_MATCH_PIN_EDITS = {
  "scripts/test-studio-empty-catalog-hide.mjs": [ // the Template picker is read past the registered changes' lines (one line)
    [
      "const SOURCE = (await import('./studio-later-changes.mjs')).stripLaterChanges(PICKER, read(PICKER)), BASE = baseSource(PICKER) // LATER-CHANGES: registry read (STUDIO-TEMPLATE-MATCH): the Template picker is read past the lines of the changes registered after this one (the template match's marked lines)\n",
      "const SOURCE = read(PICKER), BASE = baseSource(PICKER)\n",
    ],
  ],
  "scripts/test-studio-export-after-build.mjs": [ // PresentationArea is read through the registry (one line)
    [
      "const SOURCES = { [LIB]: read(LIB), [CONTROLS]: read(CONTROLS), [BOX]: read(BOX), [AREA]: (await import('./studio-later-changes.mjs')).stripLaterChanges(AREA, read(AREA)) } // LATER-CHANGES: registry read (STUDIO-TEMPLATE-MATCH): PresentationArea is read past the lines of the changes registered after this one (the template match's marked lines)\n",
      "const SOURCES = { [LIB]: read(LIB), [CONTROLS]: read(CONTROLS), [BOX]: read(BOX), [AREA]: read(AREA) }\n",
    ],
  ],
  "scripts/test-studio-first-run-poster-hide.mjs": [ // PresentationArea is read through the registry (one line)
    [
      "const SOURCES = { [STAGE]: read(STAGE), [AREA]: (await import('./studio-later-changes.mjs')).stripLaterChanges(AREA, read(AREA)), [PAGE]: read(PAGE) } // LATER-CHANGES: registry read (STUDIO-TEMPLATE-MATCH): PresentationArea is read past the lines of the changes registered after this one (the template match's marked lines)\n",
      "const SOURCES = { [STAGE]: read(STAGE), [AREA]: read(AREA), [PAGE]: read(PAGE) }\n",
    ],
  ],
  "scripts/test-studio-panel-focus.mjs": [ // PresentationArea is read through the registry (one line)
    [
      "  const area = (await import('./studio-later-changes.mjs')).stripLaterChanges('components/builder/presentation-area.tsx', read('components/builder/presentation-area.tsx')) // LATER-CHANGES: registry read (STUDIO-TEMPLATE-MATCH): PresentationArea is read past the lines of the changes registered after this one (the template match's marked lines)\n",
      "  const area = read('components/builder/presentation-area.tsx')\n",
    ],
  ],
  "scripts/test-studio-rail-add-slide.mjs": [ // its count of what the strip gains skips this change's marked strip lines (one line, a replaced assertion that no other change taught)
    [
      "    assert.equal(changed(STRIP).filter(line => line.startsWith('+') && !/(?<![\\w-])STUDIO-TEMPLATE-MATCH(?![\\w-])/.test(line)).length, 2 + 3 + 1 + 1, 'the strip gains two imports, the prop, its destructuring and the footer') // LATER-CHANGES: registry read (STUDIO-TEMPLATE-MATCH): the template match's three marked strip lines are pinned by scripts/test-studio-template-match.mjs, so they are not counted here\n",
      "    assert.equal(changed(STRIP).filter(line => line.startsWith('+')).length, 2 + 3 + 1 + 1, 'the strip gains two imports, the prop, its destructuring and the footer')\n",
    ],
  ],
  "scripts/test-studio-template-display-names.mjs": [ // the two pickers are read through the registry, and the loader that runs them (an import and one line)
    [
      "import { stripLaterChanges } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (STUDIO-TEMPLATE-MATCH): the loader below reads the files it runs past the lines of the changes registered after this one\n",
      "",
    ],
    [
      "const SOURCES = { [LIB]: read(LIB), [PICKER]: (await import('./studio-later-changes.mjs')).stripLaterChanges(PICKER, read(PICKER)), [TEMPLATE_PICKER]: (await import('./studio-later-changes.mjs')).stripLaterChanges(TEMPLATE_PICKER, read(TEMPLATE_PICKER)), [DIALOG]: read(DIALOG) } // LATER-CHANGES: registry read (STUDIO-TEMPLATE-MATCH): the two pickers are read past the lines of the changes registered after this one (the template match's marked lines)\n",
      "const SOURCES = { [LIB]: read(LIB), [PICKER]: read(PICKER), [TEMPLATE_PICKER]: read(TEMPLATE_PICKER), [DIALOG]: read(DIALOG) }\n",
    ],
    [
      "    const source = overrides[rel] ?? stripLaterChanges(rel, fs.readFileSync(file, 'utf8')) // LATER-CHANGES: registry read (STUDIO-TEMPLATE-MATCH): the files this loader runs (the pickers) are read past the template match's marked lines\n",
      "    const source = overrides[rel] ?? fs.readFileSync(file, 'utf8')\n",
    ],
  ],
  "scripts/test-stage-f-thumbnail-recovery.mjs": [ // the strip loader's import allowlist gets two flag-off stubs (one line)
    [
      "    '@/lib/studio-template-match': {STUDIO_TEMPLATE_MATCH_ENABLED:false}, '@/components/builder/studio-template-match-chip': {StudioTemplateMatchChip:()=>null}, // LATER-CHANGES: registry read (STUDIO-TEMPLATE-MATCH): flag-off stubs (NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH, default off); the chip is drawn only with the flag on; older refs never import them\n",
      "",
    ],
  ],
  "scripts/test-studio-chat-element-edit.mjs": [ // the first-parent scope check skips this change's commits (one line)
    [
      "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Template match:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (STUDIO-TEMPLATE-MATCH): on a branch stacked after this change (the template match's), the first-parent commits are its own, not this change's; with none left the pins and identity checks above cover the files\n",
      "",
    ],
  ],
  "scripts/test-studio-deck-sync-truth.mjs": [ // the first-parent scope check skips this change's commits (one line)
    [
      "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Template match:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (STUDIO-TEMPLATE-MATCH): on a branch stacked after this change (the template match's), the first-parent commits are its own, not this change's; with none left the pins and identity checks above cover the files\n",
      "",
    ],
  ],
}

/** The proof without this change's edits (the previous file). Used by the strip and the proof. */
export function putBackPin(rel, text) {
  return (STUDIO_TEMPLATE_MATCH_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The older proofs this change teaches. */
export const STUDIO_TEMPLATE_MATCH_PIN_FILES = Object.keys(STUDIO_TEMPLATE_MATCH_PIN_EDITS)

export const STUDIO_TEMPLATE_MATCH_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...STUDIO_TEMPLATE_MATCH_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const STUDIO_TEMPLATE_MATCH_SCOPE_FILES = new Set([...STUDIO_TEMPLATE_MATCH_FILES, ...STUDIO_TEMPLATE_MATCH_NEW_FILES, ...STUDIO_TEMPLATE_MATCH_OWN_EDITS])

/** The whole .env.example block: its comments and its line. */
export const STUDIO_TEMPLATE_MATCH_ENV_BLOCK = `# STUDIO TEMPLATE MATCH (FRONTEND-2; PK's W2 P4-7/8 rulings, 2 Nov). On for the exact value "true"; default off, and then Studio is exactly as today: no badge, no chips, no group in the Template picker, no check in the composer, and nothing extra on the Director socket.
# Build-time value: change it on Vercel and redeploy. Never switch it on before Director's DIRECTOR_TEMPLATE_MATCH_ENABLED: Director's "applied" only records the choice until the slide reuse (P4-8) and deck reuse (P4-9) land, so a badge before then would claim a template the build does not use.
# On: Studio advertises template_match1 (last in client_caps), sends template_auto_apply on every connect and each toggle and template_switch for a picker action or an Undo, and shows Director's template_match frame: a badge above the slide with Change and Undo, a source chip inside each rail thumbnail,
# "Use with this deck" on top of the Template picker, a bottom sheet on a phone, and "Use my best-matching template" (ticked by default; unticked, no template is applied at all) at the top of the composer's "Reuse a template" pop-up. A built slide keeps its template; a switch changes only the slides not built yet.
NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH="false"
`

/** The file without this change's lines: a rewritten line goes back to its original, every other line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripStudioTemplateMatch(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in STUDIO_TEMPLATE_MATCH_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its previous text
  if (!STUDIO_TEMPLATE_MATCH_FILES.includes(rel)) return text
  const rewrites = new Map(STUDIO_TEMPLATE_MATCH_REWRITES[rel] || [])
  const out = []
  for (const line of text.split('\n')) {
    if (rewrites.has(line)) out.push(rewrites.get(line))
    else if (!STUDIO_TEMPLATE_MATCH_MARKER_RE.test(line)) out.push(line)
  }
  return out.join('\n')
}
