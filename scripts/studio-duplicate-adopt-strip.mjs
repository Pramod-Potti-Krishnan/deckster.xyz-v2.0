// FRONTEND-2 (duplicate-deck adoption, Studio half; Director half is Director !561, DIRECTOR_DUPLICATE_ADOPT_ENABLED; contract streams/director2/dup-adopt/CONTRACT.md). Flag NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT (exact
// "true", default off, build-time; it acts only while NEXT_PUBLIC_STUDIO_DUPLICATE_DECK is "true" too): after Duplicate's session PATCH the Director adopts the copy into the new session, so chat can edit it, and a
// copy that was never adopted is adopted when the Builder opens it (lib/studio-duplicate-adopt.ts, app/api/director/sessions/[sourceSessionId]/adopt-duplicate/route.ts).
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker DUPLICATE-ADOPT (matched as a whole token): lib/studio-duplicate-deck.ts (step 4 in runDuplicateDeck, its optional
// `adopt` dependency, the result's `adoption`, and the copy's id in the step-3 marker: one key spread in after the base's own marker line, which stays as it is), app/(app)/dashboard/page.tsx (the flag, the
// dependency, the note), app/builder/page.tsx (the per-tab controller and the socket callback) and hooks/use-deckster-websocket-v2.ts (the callback's type and the one call in ws.onopen, for the socket's own
// session). Strip those lines and each file is its base, byte for byte.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '875334faa648ed72e63b260457ca2fc0a2020c0c' // studio-v4-dev-preparation-code at #518 (speed perceived), the branch this change is cut from
export const DUPLICATE_ADOPT_FLAG = 'NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT'
export const DUPLICATE_ADOPT_MARKER = 'DUPLICATE-ADOPT'
/** The marker as a WHOLE token: DUPLICATE-ADOPT-X or X-DUPLICATE-ADOPT are not this change's. */
export const DUPLICATE_ADOPT_MARKER_RE = /(?<![\w-])DUPLICATE-ADOPT(?![\w-])/

/** Existing files that get marked lines (pure insertions only). */
export const DUPLICATE_ADOPT_FILES = [
  'lib/studio-duplicate-deck.ts',
  'app/(app)/dashboard/page.tsx',
  'app/builder/page.tsx',
  'hooks/use-deckster-websocket-v2.ts',
]

/** The recorded Director answers (DIRECTOR-2, copied byte for byte from streams/director2/dup-adopt/examples/; the proof pins each one's sha256). */
export const DUPLICATE_ADOPT_FIXTURE_DIR = 'scripts/fixtures/duplicate-adopt'
export const DUPLICATE_ADOPT_FIXTURES = [
  '01-adopted-200.json', '02-persisted-row.json', '03-repeat-200-reused.json', '04-sync-response-after-adoption.json',
  '10-no-header-401.json', '11-claim-for-another-user-403.json', '12-claim-invalid-401.json', '13-secret-unset-503.json', '14-request-invalid-422.json',
  '20-not-owned-403.json', '21-not-a-duplicate-422.json', '22-in-use-409.json', '23-session-not-fresh-409.json', '24-presentation-not-found-404.json',
  '25-layout-unavailable-502.json', '26-deck-empty-422.json', '27-store-unavailable-503.json', '28-not-durable-500.json', '30-flag-off-404.json', 'index.json',
]

/** New files (no base text to put back). The route adds ONE route to the build: /api/director/sessions/[sourceSessionId]/adopt-duplicate. */
export const DUPLICATE_ADOPT_ROUTE = 'app/api/director/sessions/[sourceSessionId]/adopt-duplicate/route.ts'
export const DUPLICATE_ADOPT_NEW_FILES = [
  'lib/studio-duplicate-adopt.ts',
  DUPLICATE_ADOPT_ROUTE,
  'scripts/studio-duplicate-adopt-strip.mjs',
  'scripts/test-studio-duplicate-adopt.mjs',
  ...DUPLICATE_ADOPT_FIXTURES.map(name => `${DUPLICATE_ADOPT_FIXTURE_DIR}/${name}`),
]

/** The older proofs this change teaches (FRONTEND-2's own): [text the proof has now, text the proof had before] per edit, whole lines, so putting them back gives the previous file byte for byte.
 *  Every line the proof has now carries DUPLICATE_ADOPT_PIN_MARK. */
export const DUPLICATE_ADOPT_PIN_MARK = '// LATER-CHANGES: registry read (DUPLICATE-ADOPT)'
export const DUPLICATE_ADOPT_PIN_EDITS = {
  "scripts/test-studio-deck-import.mjs": [
    [
      "  const laterChangeFiles = (await import('./studio-later-changes.mjs')).LATER_CHANGE_FILES // LATER-CHANGES: registry read (DUPLICATE-ADOPT): a change registered after this one answers for its own importers of the minter in its own proof; the closure walk above still ran over its files\n",
      ""
    ],
    [
      "  deepEq([...text.keys()].filter(rel => rel !== HELPER && !laterChangeFiles.has(rel) && /director-rest-entitlement/.test(text.get(rel))).sort(), [JOBS, START].sort(), 'the minter is imported by the two import routes only') // LATER-CHANGES: registry read (DUPLICATE-ADOPT)\n",
      "  deepEq([...text.keys()].filter(rel => rel !== HELPER && /director-rest-entitlement/.test(text.get(rel))).sort(), [JOBS, START].sort(), 'the minter is imported by the two import routes only')\n"
    ]
  ],
  "scripts/test-studio-deck-grid-4.mjs": [
    [
      "const { stripLaterChanges } = await import('./studio-later-changes.mjs') // LATER-CHANGES: registry read (DUPLICATE-ADOPT): every registered later change's lines come out first, innermost, as the newer pins read (stripping one twice changes nothing)\n",
      ""
    ],
    [
      "const read = rel => stripLaunchWording(rel, stripDeckCardThumbnail(rel, stripLaterChanges(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8')))) // DECK-CARD-THUMBNAIL: its lines out first // LATER-CHANGES: registry read (DUPLICATE-ADOPT)\n",
      "const read = rel => stripLaunchWording(rel, stripDeckCardThumbnail(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8'))) // DECK-CARD-THUMBNAIL: its lines out first\n"
    ]
  ],
  "scripts/test-studio-create-word.mjs": [
    [
      "const { stripLaterChanges } = await import('./studio-later-changes.mjs') // LATER-CHANGES: registry read (DUPLICATE-ADOPT): every registered later change's lines come out first, innermost, as the newer pins read (stripping one twice changes nothing)\n",
      ""
    ],
    [
      "const read = rel => stripLaunchWording(rel, stripDeckCardThumbnail(rel, stripLaterChanges(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8')))) // DECK-CARD-THUMBNAIL: its lines out first // LATER-CHANGES: registry read (DUPLICATE-ADOPT)\n",
      "const read = rel => stripLaunchWording(rel, stripDeckCardThumbnail(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8'))) // DECK-CARD-THUMBNAIL: its lines out first\n"
    ]
  ],
  "scripts/test-studio-speed-perceived.mjs": [
    [
      "const HEAD = git('log', '-1', '--format=%H', '--no-merges', '-E', '--grep=^(Speed perceived|Studio perceived speed):', 'HEAD').trim() || git('rev-parse', 'HEAD').trim() // LATER-CHANGES: registry read (DUPLICATE-ADOPT): this change's own newest commit, so a change stacked after it is not read as this one's diff\n",
      "const HEAD = git('rev-parse', 'HEAD').trim()\n"
    ]
  ],
  "scripts/studio-duplicate-deck-strip.mjs": [
    [
      "import { stripDuplicateAdopt } from './studio-duplicate-adopt-strip.mjs' // LATER-CHANGES: registry read (DUPLICATE-ADOPT): Duplicate's step 4 adds marked lines inside this change's handler, so they come out first and the literals below still match\n",
      ""
    ],
    [
      "  return table.reduce((result, [added, original]) => result.replace(added, () => original), stripDuplicateAdopt(rel, text)) // LATER-CHANGES: registry read (DUPLICATE-ADOPT)\n",
      "  return table.reduce((result, [added, original]) => result.replace(added, () => original), text)\n"
    ]
  ]
}

/** The proof without this change's edits (the previous file). Used by the strip and the proof. */
export function putBackPin(rel, text) {
  return (DUPLICATE_ADOPT_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The older proofs this change teaches. */
export const DUPLICATE_ADOPT_PIN_FILES = Object.keys(DUPLICATE_ADOPT_PIN_EDITS)

export const DUPLICATE_ADOPT_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...DUPLICATE_ADOPT_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const DUPLICATE_ADOPT_SCOPE_FILES = new Set([...DUPLICATE_ADOPT_FILES, ...DUPLICATE_ADOPT_NEW_FILES, ...DUPLICATE_ADOPT_OWN_EDITS])

/** The whole .env.example block: its comment and its line. */
export const DUPLICATE_ADOPT_ENV_BLOCK = `# DUPLICATE ADOPT (FRONTEND-2; step 4 of the Decks page's "Duplicate", the PASS3 DUPLICATE A DECK block above). On for the exact value "true"; default off, and then Duplicate does exactly what it does today.
# Build-time value: change it on Vercel and redeploy. It acts only while the Duplicate flag above is "true" too. Needs the Director's DIRECTOR_DUPLICATE_ADOPT_ENABLED (Director !561; while that is off the
# Director answers 404 and the copy is still made) and DIRECTOR_WS_AUTH_SECRET here: the new route POST /api/director/sessions/{id}/adopt-duplicate signs the signed-in user (X-Deckster-Entitlement) on
# every call, whatever DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED says, because the Director requires that header on this route. On: after the copy's session is saved, the Director adopts the copied deck
# into it so chat can edit the copy (final-slot copies only; an outline preview is not adopted). If that fails, the copy and its session stay, the person reads "The copy is ready. Chat can't edit it yet;
# open it again in a moment.", and opening the copy in the Builder tries once more (and reconnects chat when it worked). Chat history is still not copied.
NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripDuplicateAdopt(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in DUPLICATE_ADOPT_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its previous text, so a proof that holds it byte for byte reads it as it was
  if (!DUPLICATE_ADOPT_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !DUPLICATE_ADOPT_MARKER_RE.test(line)).join('\n')
}
