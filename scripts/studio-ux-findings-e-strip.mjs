// FRONTEND-2 (B64): UX findings E, PROGRAM-1's item E from FRONTEND-1's 4 Nov UX pass (streams/frontend1/ux-pass/findings.json): UX-08, UX-11, UX-12, UX-19, UX-22, UX-26, UX-27. ONE flag, NEXT_PUBLIC_STUDIO_UX_FINDINGS_E
// (the exact string "true", with the Studio shell, build-time, default off), defined in lib/studio-ux-findings-e.ts. With the flag off every page renders as it does at dev eeb78d4f.
// The change is a client mount that sets data-studio-ux-findings-e="true" on <html> and a stylesheet with every rule scoped to it (the shape of FRONTEND-1's page consistency, 12dadbc1), plus two behaviours in the mount itself:
// UX-08 the workspace intro plays once on a browser, and none plays on a browser that already holds any intro mark (FRONTEND-1's own seen-store reused and never emptied; the intro's file is not touched), UX-11 /settings/profile goes to /studio/details.
// FRONTEND-1 owns every existing page, component, lib and hook this could touch, so only a few lines go into their files (UX_FINDINGS_E_FE1_OK): the mount in app/(app)/layout.tsx and the same hook (two lines) in the Builder
// (the Builder sits outside that layout, and its loading skeleton, its Director header and the intro need the attribute). FRONTEND-1 OK'd the four lines (to-FRONTEND-2.md line 528, 22:20Z, 7 Nov), anchors checked against dev eeb78d4f.
// FRONTEND-1's review ruling (to-FRONTEND-2.md, 9 Nov 04:55Z, "#603, your code, my rulings" (7)) gates the mount like its neighbours, {FLAG && <Mount/>}: the layout holds three lines of ours (the flag import, the mount import and the gated mount line), the Builder two.
// Every line this change adds to an EXISTING app file carries the marker UX-FINDINGS-E (a WHOLE token). Strip them and the file is dev's, byte for byte (stripUxFindingsE(rel, text)).
// The older proofs this change teaches (tests only, every line carries the registry-read mark): the two that read the first-parent commits of BASE..HEAD for their own commits' subjects get one more inserted line each, for "UX findings E:".
// FRONTEND-1 also OK'd two after-merge edits of THEIR proofs (test-studio-ux-honesty, test-studio-voice-call: UX_FINDINGS_E_FE1_PROOF_OK), carried here with the mark and put back by the strip.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'eeb78d4f4b7676d75c244746f1edc7da1d269478' // Studio dev (7 Nov), the merge of #598
export const UX_FINDINGS_E_FLAG = 'NEXT_PUBLIC_STUDIO_UX_FINDINGS_E'
export const UX_FINDINGS_E_MARKER = 'UX-FINDINGS-E'
/** The marker as a WHOLE token: UX-FINDINGS-E is this change's; UX-FINDINGS-E-X and X-UX-FINDINGS-E are not. */
export const UX_FINDINGS_E_MARKER_RE = /(?<![\w-])UX-FINDINGS-E(?![\w-])/
/** The subject prefix of this change's own commits. */
export const UX_FINDINGS_E_SUBJECT = 'UX findings E:'
/** The mark every taught line in an older proof carries. */
export const UX_FINDINGS_E_PIN_MARK = '// LATER-CHANGES: registry read (UX-FINDINGS-E)'

// ---- the lines for FRONTEND-1's files: the four OK'd by them (22:20Z), the mount line gated and its flag import as they ruled (9 Nov 04:55Z) ---------------------------------------------------------------------------------------------
/** Where each line goes: the file, the line it goes right after (the whole line, as dev has it), and the new line, byte for byte. Placed away from the end of the account layout's list, where FRONTEND-1's page consistency (12dadbc1) adds its own. */
export const UX_FINDINGS_E_FE1_OK = {
  'app/(app)/layout.tsx': [
    {
      after: 'import { StudioPass3PolishGMount } from "@/components/studio-pass3-polish/studio-pass3-polish-g-mount" // PASS3-POLISH-G (NEXT_PUBLIC_STUDIO_PASS3_POLISH, default off): on iPhone and iPad the viewport meta gets maximum-scale=1, so a focused text control does not zoom the page',
      line: 'import { STUDIO_UX_FINDINGS_E_ENABLED } from "@/lib/studio-ux-findings-e" // UX-FINDINGS-E (NEXT_PUBLIC_STUDIO_UX_FINDINGS_E, default off): the flag the mount below is drawn on, like its neighbours',
    },
    {
      after: 'import { STUDIO_UX_FINDINGS_E_ENABLED } from "@/lib/studio-ux-findings-e" // UX-FINDINGS-E (NEXT_PUBLIC_STUDIO_UX_FINDINGS_E, default off): the flag the mount below is drawn on, like its neighbours',
      line: 'import { StudioUxFindingsEMount } from "@/components/studio-ux-findings-e/studio-ux-findings-e-mount" // UX-FINDINGS-E (NEXT_PUBLIC_STUDIO_UX_FINDINGS_E, default off): the attribute the findings stylesheet is scoped to, the intro once, /settings/profile to Your details',
    },
    {
      after: '      {STUDIO_PASS3_POLISH_ENABLED && <StudioPass3PolishGMount />}{/* PASS3-POLISH-G */}',
      line: '      {STUDIO_UX_FINDINGS_E_ENABLED && <StudioUxFindingsEMount />}{/* UX-FINDINGS-E: draws nothing; with the flag off it is not drawn at all */}',
    },
  ],
  'app/builder/page.tsx': [
    {
      after: "import { useStudioStageOpen } from '@/lib/studio-stage-open-gate' // STRAWMAN-CHAT: FRONTEND-2's gate, read on the one stage-open line",
      line: "import { useStudioUxFindingsE } from '@/components/studio-ux-findings-e/studio-ux-findings-e-mount' // UX-FINDINGS-E (NEXT_PUBLIC_STUDIO_UX_FINDINGS_E, default off): the attribute the findings stylesheet is scoped to, the intro once",
    },
    {
      after: "  const authScopeUserId = user?.id ?? user?.email ?? ''",
      line: '  useStudioUxFindingsE(authScopeUserId) // UX-FINDINGS-E: flag off, every effect returns before it reads the document, the window or storage',
    },
  ],
}
// ---- the lines this change adds to files of its own or shared infrastructure ------------------------------------------------------------------------------------
/** The .env.example block (one blank line, then the block), appended at the true end of the file. */
export const UX_FINDINGS_E_ENV_BLOCK = `# STUDIO UX FINDINGS E (FRONTEND-2, B64; small fixes from FRONTEND-1's 4 Nov UX pass; UX-12 hides nothing). On only for the string "true" (and only with NEXT_PUBLIC_STUDIO_V4_SHELL); default off, and then nothing changes.
# Build-time value: change it on Vercel and redeploy. On: the workspace intro plays once on a browser, then never again, and none plays on a browser that already holds an intro mark (Replay intro still works); /settings/profile goes to "Your details";
# the pages' H1 that repeats the top bar's title is kept for screen readers and not drawn; the Director header's status sits inline after its name; Themes' context line keeps its icon on the line on a phone;
# the Builder's loading skeleton shows the rail's new logo (with NEXT_PUBLIC_STUDIO_NEW_LOGO). Words and layout only: routes, handlers and requests are unchanged.
NEXT_PUBLIC_STUDIO_UX_FINDINGS_E="false"
`
const ENV_HAS = `\n${UX_FINDINGS_E_ENV_BLOCK}`
/** The three registry lines, byte for byte: each goes at the true end of its list, right above "// one line per later change, above this comment". */
export const UX_FINDINGS_E_REGISTRY_FILES_LINE = "  ...(await import('./studio-ux-findings-e-strip.mjs')).UX_FINDINGS_E_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B64 UX findings E: seven small fixes from FRONTEND-1's 4 Nov UX pass (NEXT_PUBLIC_STUDIO_UX_FINDINGS_E)"
export const UX_FINDINGS_E_REGISTRY_ENV_LINE = "  (await import('./studio-ux-findings-e-strip.mjs')).UX_FINDINGS_E_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B64 UX findings E (NEXT_PUBLIC_STUDIO_UX_FINDINGS_E)"
export const UX_FINDINGS_E_REGISTRY_STRIP_LINE = "  (await import('./studio-ux-findings-e-strip.mjs')).stripUxFindingsE, // LATER-CHANGE: FRONTEND-2, B64 UX findings E (NEXT_PUBLIC_STUDIO_UX_FINDINGS_E)"
/** The subject filter the two older proofs get, one inserted line each. */
export const UX_FINDINGS_E_FIRST_PARENT_LINE = "  shas.splice(0, shas.length, ...shas.filter(sha => !/^UX findings E:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (UX-FINDINGS-E): on a branch stacked after this change (the UX findings E), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files"
/** Where each taught line goes: right after the base proof's last "^…:" subject filter, the usage credits page's (the line that starts with this text). */
export const UX_FINDINGS_E_PIN_AFTER = "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Usage credits page:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (USAGE-CREDITS-PAGE)"

export const UX_FINDINGS_E_PIN_EDITS = {
  'scripts/test-studio-deck-sync-truth.mjs': [[`${UX_FINDINGS_E_FIRST_PARENT_LINE}\n`, '']],
  'scripts/test-studio-chat-element-edit.mjs': [[`${UX_FINDINGS_E_FIRST_PARENT_LINE}\n`, '']],
}
export const UX_FINDINGS_E_PIN_FILES = Object.keys(UX_FINDINGS_E_PIN_EDITS)
export const UX_FINDINGS_E_REGISTRY = 'scripts/studio-later-changes.mjs'
export const UX_FINDINGS_E_ENV_FILE = '.env.example'

/** FRONTEND-1's files with their OK'd lines: [line now, line before] pairs, whole lines, was = '' (pure insertions). */
const fe1Pairs = lines => Object.fromEntries(Object.entries(lines).map(([rel, list]) => [rel, list.map(({ line }) => [`${line}\n`, ''])]))
export const UX_FINDINGS_E_FE1_EDITS = fe1Pairs(UX_FINDINGS_E_FE1_OK)

/**
 * FRONTEND-1's two PROOFS with the after-merge edits FRONTEND-1 OK'd (to-FRONTEND-2.md line 545, FE1-OK-REQUEST-2.md, 8 Nov): each reads a file raw, so a later change's marked lines show up in it. [line now, line before] per edit, whole lines;
 * was = '' for an inserted line. Every line now carries UX_FINDINGS_E_PIN_MARK. Put back, each proof is dev's, byte for byte. These are the ONLY edits of FRONTEND-1's proofs this change makes; every other proof of theirs stays untouched.
 */
export const UX_FINDINGS_E_FE1_PROOF_OK = {
  'scripts/test-studio-ux-honesty.mjs': [
    ["const phFiles = { [LIB_PH]: read(LIB_PH), [LAYOUT]: registry.LATER_STRIPS.slice(registry.LATER_STRIPS.indexOf(strip.stripUxHonesty) + 1).reduce((text, fn) => fn(LAYOUT, text), read(LAYOUT)), [CSS_PH]: read(CSS_PH) } // LATER-CHANGES: registry read (UX-FINDINGS-E)\n", "const phFiles = { [LIB_PH]: read(LIB_PH), [LAYOUT]: read(LAYOUT), [CSS_PH]: read(CSS_PH) }\n"],
  ],
  'scripts/test-studio-voice-call.mjs': [
    ["const laterRegistry = await import('./studio-later-changes.mjs') // LATER-CHANGES: registry read (UX-FINDINGS-E)\n", ''],
    ["const laterEnvOut = text => laterRegistry.LATER_ENV_BLOCKS.slice(laterRegistry.LATER_ENV_BLOCKS.indexOf(strip.VOICE_CALL_ENV_BLOCK) + 1).reduce((out, block) => out.replace(`\\n${block}`, ''), text) // LATER-CHANGES: registry read (UX-FINDINGS-E)\n", ''],
    ["  ok(laterEnvOut(env).endsWith(`\\n${strip.VOICE_CALL_ENV_BLOCK}`) && strip.VOICE_CALL_ENV_BLOCK.endsWith('\\n'), '.env.example: the block is the last thing in the file, after one blank line') // LATER-CHANGES: registry read (UX-FINDINGS-E)\n", "  ok(env.endsWith(`\\n${strip.VOICE_CALL_ENV_BLOCK}`) && strip.VOICE_CALL_ENV_BLOCK.endsWith('\\n'), '.env.example: the block is the last thing in the file, after one blank line')\n"],
    ["    ok(laterEnvOut(`${envDiff.map(line => line.slice(1)).join('\\n')}\\n`).trimEnd().endsWith(strip.VOICE_CALL_ENV_BLOCK.trimEnd()), '.env.example: this change adds exactly its block (after ELEMENT-3\\'s two lines)') // LATER-CHANGES: registry read (UX-FINDINGS-E)\n", "    ok(envDiff.map(line => line.slice(1)).join('\\n').endsWith(strip.VOICE_CALL_ENV_BLOCK.trimEnd()), '.env.example: this change adds exactly its block (after ELEMENT-3\\'s two lines)')\n"],
  ],
}
/** The anchor the two inserted voice-call lines go right after, and the two proofs. */
export const UX_FINDINGS_E_FE1_PROOF_ANCHOR = "const core = await import('./studio-voice-core-strip.mjs')"
export const UX_FINDINGS_E_FE1_PROOF_FILES = Object.keys(UX_FINDINGS_E_FE1_PROOF_OK)

/** Every [has, was] pair this change makes, by file: .env.example, the registry, the two taught proofs, FRONTEND-1's two files and FRONTEND-1's two OK'd proof edits. */
export const UX_FINDINGS_E_EDITS = {
  [UX_FINDINGS_E_ENV_FILE]: [[ENV_HAS, '']],
  [UX_FINDINGS_E_REGISTRY]: [[`${UX_FINDINGS_E_REGISTRY_FILES_LINE}\n`, ''], [`${UX_FINDINGS_E_REGISTRY_ENV_LINE}\n`, ''], [`${UX_FINDINGS_E_REGISTRY_STRIP_LINE}\n`, '']],
  ...UX_FINDINGS_E_PIN_EDITS,
  ...UX_FINDINGS_E_FE1_EDITS,
  ...UX_FINDINGS_E_FE1_PROOF_OK,
}

/** New files (no base text to put back). */
export const UX_FINDINGS_E_NEW_FILES = [
  'lib/studio-ux-findings-e.ts',
  'components/studio-ux-findings-e/studio-ux-findings-e-mount.tsx',
  'components/studio-ux-findings-e/studio-ux-findings-e.css',
  'scripts/studio-ux-findings-e-strip.mjs',
  'scripts/test-studio-ux-findings-e.mjs',
]
/** Existing files of FRONTEND-1's that carry the OK'd lines. */
export const UX_FINDINGS_E_FE1_FILES = Object.keys(UX_FINDINGS_E_FE1_OK)
/** Files this change edits that are not app code: .env.example (its block), the registry (its three lines) and the two older proofs it teaches. */
export const UX_FINDINGS_E_OWN_EDITS = [UX_FINDINGS_E_ENV_FILE, UX_FINDINGS_E_REGISTRY, ...UX_FINDINGS_E_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const UX_FINDINGS_E_SCOPE_FILES = new Set([...UX_FINDINGS_E_FE1_FILES, ...UX_FINDINGS_E_FE1_PROOF_FILES, ...UX_FINDINGS_E_NEW_FILES, ...UX_FINDINGS_E_OWN_EDITS])

/** `text` with one whole line taken out: `has` is the line with its newline, and it counts only at the start of a line (never the tail of a longer one). Only the first occurrence goes: a line that is there twice is a merge mistake the older pins must still see. */
function putBackLine(text, has, was) {
  let at = text.indexOf(has)
  while (at !== -1 && !(at === 0 || text[at - 1] === '\n')) at = text.indexOf(has, at + 1)
  return at === -1 ? text : text.slice(0, at) + was + text.slice(at + has.length)
}

/** The file without this change's lines: .env.example loses its block, the registry its three lines, an older proof this change taught its filter, FRONTEND-1's files their OK'd lines. Any other file is returned as it is. Idempotent. */
export function stripUxFindingsE(rel, text) {
  if (typeof text !== 'string') return text
  if (!Object.prototype.hasOwnProperty.call(UX_FINDINGS_E_EDITS, rel)) return text
  return UX_FINDINGS_E_EDITS[rel].reduce((out, [has, was]) => putBackLine(out, has, was), text)
}
