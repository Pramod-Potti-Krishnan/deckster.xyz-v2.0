// FRONTEND-1 (P3-1 C "chat clean v3", 26 Oct). Flag NEXT_PUBLIC_STUDIO_CHAT_CLEAN (the string "true", default off, build-time): the Director chat in PK's v3 design (streams/frontend1/chat-design/v3): the user's
// turn a right-aligned box in the one tinted colour, Director's words on the page (no box, label or time), the build as an outlined job card inline in the thread, the composer a hairline box with a "+" options menu,
// two research toggle chips, an icon-only model picker and Send <-> Stop, and a held build as a slim "Stopped at slide N · Continue" bar above the composer. Every decision is lib/studio-chat-clean.ts (pure);
// components/builder/chat/studio-chat-clean.tsx draws; components/builder/studio-chat-clean.css styles (every rule keyed to the column's data-studio-chat-clean attribute, or the "+" menu's portal attribute).
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker CHAT-CLEAN (matched as a whole token): components/builder/chat-input.tsx, components/builder/message-list.tsx,
// app/builder/page.tsx (all after the Builder's runners, the import at the end with the flow import, for the same older proof), components/build-narration/director-presence.tsx and
// components/build-narration/pause-stop-control.tsx (one early return each, read from process.env directly so the proofs that evaluate them with a fake process see nothing). No existing line of app code is rewritten.
// Strip the marked lines and each file is its base, byte for byte.
// Seven older proofs are taught to read through the registry (CHAT_CLEAN_PIN_EDITS, [line now, line before], whole lines, every line now carrying "registry read (CHAT-CLEAN)"): the composer-popups proof hashes the
// composer's whole flag-off element tree, so it loads each source through stripLaterChanges first (a later change's null children are its own); the model-picker proof wants no app file to import the picker, which
// this change's composer does, so a registered later change's files are its own; the composer-copy, composer-picker and composer-stage-context proofs read chat-input.tsx raw (import allow-lists, a base identity), so they read it through
// the registry; the model-choice proof takes this change's block and registry lines out as it takes flow control's. putBackChatCleanEdits puts the previous lines back, so a proof that holds those files reads them as they were.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '6402b8d41d3dfdbed08d66b8b5117b0ad393c499' // the merge of origin/frontend2/model-picker-slider (#526, 20b1ea3a, stacked on #521) and origin/frontend1/flow-control-later-tolerant (#525) this change is cut from
export const CHAT_CLEAN_FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_CLEAN'
export const CHAT_CLEAN_MARKER = 'CHAT-CLEAN'
/** The marker as a WHOLE token: CHAT-CLEAN-X or X-CHAT-CLEAN are not this change's (the lowercase attribute names are not either). */
export const CHAT_CLEAN_MARKER_RE = /(?<![\w-])CHAT-CLEAN(?![\w-])/

/** Existing files that get marked lines (pure insertions only). */
export const CHAT_CLEAN_FILES = [
  'components/builder/chat-input.tsx',
  'components/builder/message-list.tsx',
  'app/builder/page.tsx',
  'components/build-narration/director-presence.tsx',
  'components/build-narration/pause-stop-control.tsx',
]

/** The older proofs this change teaches: [line now, line before] per edit, whole lines (a line now carries "registry read (CHAT-CLEAN)" and occurs once in its file; a line before of "" is an inserted line). */
export const CHAT_CLEAN_PIN_EDITS = {
  "scripts/test-studio-composer-popups-v2.mjs": [
    [
      "import { stripLaterChanges } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (CHAT-CLEAN): the lines of the changes registered after this one come out of every source this proof loads, so the flag-off tree and the mutation targets are the base's\n",
      "",
    ],
    [
      "    let source = stripLaterChanges(path.relative(treeRoot, file), fs.readFileSync(file, 'utf8')) // LATER-CHANGES: registry read (CHAT-CLEAN): a registered later change's marked lines (chat clean's, in chat-input.tsx) come out before the mutations and the transpile\n",
      "    let source = fs.readFileSync(file, 'utf8')\n",
    ],
  ],
  "scripts/test-studio-model-picker.mjs": [
    [
      "  await check('L: nothing in the app imports the picker (it is placed by FRONTEND-1), so flag off the app is the base', async () => { // LATER-CHANGES: registry read (CHAT-CLEAN)\n",
      "  await check('L: nothing in the app imports the picker (it is placed by FRONTEND-1), so flag off the app is the base', () => {\n",
    ],
    [
      "    const later = (await import(`${path.join(root, REGISTRY)}?t=${Date.now()}`)).LATER_CHANGE_FILES // LATER-CHANGES: registry read (CHAT-CLEAN): a change registered after this one may mount the picker (chat clean: the composer); its files are its own\n",
      "",
    ],
    [
      "    deep(hits.split('\\n').filter(Boolean).map(line => line.replace(/^HEAD:/, '')).filter(file => ![...PICKER_FILES, ...SLIDER_ADDED].includes(file) && !later.has(file)), [], 'no other file mentions it') // LATER-CHANGES: registry read (CHAT-CLEAN)\n",
      "    deep(hits.split('\\n').filter(Boolean).map(line => line.replace(/^HEAD:/, '')).filter(file => ![...PICKER_FILES, ...SLIDER_ADDED].includes(file)), [], 'no other file mentions it')\n",
    ],
    [
      "    deep(working.filter(file => ![...PICKER_FILES, ...SLIDER_ADDED].includes(file) && !later.has(file)), [], 'nor does the working tree') // LATER-CHANGES: registry read (CHAT-CLEAN)\n",
      "    deep(working.filter(file => ![...PICKER_FILES, ...SLIDER_ADDED].includes(file)), [], 'nor does the working tree')\n",
    ],
  ],
  "scripts/test-studio-model-choice.mjs": [
    [
      "    const flow = await import('./studio-flow-control-strip.mjs'); const chatClean = await import('./studio-chat-clean-strip.mjs') // dev 6fba3b7f (#524): flow control registers its block, its lines and a taught proof before this change's; they come out first // LATER-CHANGES: registry read (CHAT-CLEAN): chat clean registers its block, its lines and taught proofs after this change's; they come out too\n",
      "    const flow = await import('./studio-flow-control-strip.mjs') // dev 6fba3b7f (#524): flow control registers its block, its lines and a taught proof before this change's; they come out first\n",
    ],
    [
      "    eq(read(ENV).replace(`\\n${strip.MODEL_CHOICE_ENV_BLOCK}`, '').replace(`\\n${flow.FLOW_CONTROL_ENV_BLOCK}`, '').replace(`\\n${chatClean.CHAT_CLEAN_ENV_BLOCK}`, ''), baseOf(ENV)); ok(read(ENV).includes(`\\n${strip.MODEL_CHOICE_ENV_BLOCK}`)) // LATER-CHANGES: registry read (CHAT-CLEAN): a block registered after this one may follow it\n",
      "    eq(read(ENV).replace(`\\n${strip.MODEL_CHOICE_ENV_BLOCK}`, '').replace(`\\n${flow.FLOW_CONTROL_ENV_BLOCK}`, ''), baseOf(ENV)); ok(read(ENV).endsWith(strip.MODEL_CHOICE_ENV_BLOCK))\n",
    ],
    [
      "    eq(read(REGISTRY).split('\\n').filter(line => !line.includes('studio-model-choice-strip.mjs') && !line.includes('studio-flow-control-strip.mjs') && !line.includes('studio-model-slider-strip.mjs') && !line.includes('studio-chat-clean-strip.mjs')).join('\\n'), baseOf(REGISTRY)) // LATER-CHANGES: registry read (CHAT-CLEAN)\n",
      "    eq(read(REGISTRY).split('\\n').filter(line => !line.includes('studio-model-choice-strip.mjs') && !line.includes('studio-flow-control-strip.mjs') && !line.includes('studio-model-slider-strip.mjs')).join('\\n'), baseOf(REGISTRY))\n",
    ],
  ],
  "scripts/test-studio-pass2b-chat.mjs": [
    [
      "    for (const file of Object.keys(GOLDEN.imports)) if (sha(importLines(chatCleanStrip.stripChatClean(file, read(file))).join('\\n')) !== GOLDEN.imports[file]) fail(`${file}: its import lines changed (the existing pin tests load it with an allow-list of imports)`) // LATER-CHANGES: registry read (CHAT-CLEAN): the import lines a change registered after this one adds (chat clean's, in chat-input.tsx and message-list.tsx) are its own\n",
      "    for (const file of Object.keys(GOLDEN.imports)) if (sha(importLines(read(file)).join('\\n')) !== GOLDEN.imports[file]) fail(`${file}: its import lines changed (the existing pin tests load it with an allow-list of imports)`)\n",
    ],
    [
      "const chatCleanStrip = await import('./studio-chat-clean-strip.mjs') // LATER-CHANGES: registry read (CHAT-CLEAN): the strip of the change stacked after this one, so its marked lines come out before the pins below read a file\n",
      "",
    ],
  ],
  "scripts/test-studio-composer-stage-context.mjs": [
    [
      "  if (base) { checks++; assert.equal(stripLaterChanges(CHAT_INPUT, read(CHAT_INPUT)), stripLaterChanges(CHAT_INPUT, base), `chat-input.tsx is the base commit's file: the line is a string prop, as #382 passes it`) } // LATER-CHANGES: registry read (CHAT-CLEAN): the lines of the changes registered after this one (chat clean's) come out of both sides first\n",
      "  if (base) { checks++; assert.equal(read(CHAT_INPUT), base, `chat-input.tsx is the base commit's file: the line is a string prop, as #382 passes it`) }\n",
    ],
    [
      "import { stripLaterChanges } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (CHAT-CLEAN)\n",
      "",
    ],
  ],
  "scripts/test-composer-picker.mjs": [
    [
      "  const source = stripLaterChanges(relative.replace(/^\\.\\.\\//, ''), fs.readFileSync(new URL(relative, import.meta.url), 'utf8')) // LATER-CHANGES: registry read (CHAT-CLEAN): a registered later change's marked lines (chat clean's import in chat-input.tsx) come out before the allow-list sees the file\n",
      "  const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8')\n",
    ],
    [
      "import { stripLaterChanges } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (CHAT-CLEAN)\n",
      "",
    ],
  ],
  "scripts/test-studio-composer-copy.mjs": [
    [
      "const read = file => stripLaterChanges(file, fs.readFileSync(path.join(treeRoot, file), 'utf8')) // LATER-CHANGES: registry read (CHAT-CLEAN): a registered later change's marked lines (chat clean's import in chat-input.tsx) come out before the allow-list sees the file\n",
      "const read = file => fs.readFileSync(path.join(treeRoot, file), 'utf8')\n",
    ],
    [
      "import { stripLaterChanges } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (CHAT-CLEAN)\n",
      "",
    ],
  ],
}

/** The proofs taught. */
export const CHAT_CLEAN_PIN_FILES = Object.keys(CHAT_CLEAN_PIN_EDITS)

/** New files (no base text to put back). */
export const CHAT_CLEAN_NEW_FILES = [
  'lib/studio-chat-clean.ts',
  'components/builder/chat/studio-chat-clean.tsx',
  'components/builder/studio-chat-clean.css',
  'scripts/studio-chat-clean-strip.mjs',
  'scripts/test-studio-chat-clean.mjs',
]

/** Files this change edits that are neither marked app code nor new: its .env.example block, the registry (three lines) and the older proofs it teaches. No package.json script: run the proof with `node scripts/test-studio-chat-clean.mjs`. */
export const CHAT_CLEAN_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...CHAT_CLEAN_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const CHAT_CLEAN_SCOPE_FILES = new Set([...CHAT_CLEAN_FILES, ...CHAT_CLEAN_NEW_FILES, ...CHAT_CLEAN_OWN_EDITS])

/** The whole .env.example block: its comments and its one line. */
export const CHAT_CLEAN_ENV_BLOCK = `# STUDIO CHAT CLEAN (FRONTEND-1; P3-1 C "chat clean v3", PK's design of 26 Oct, composer per v3.1). On only for the string "true"; default off, and then the Director chat, the build row and the composer are byte for byte what they were. Build-time value: change it on Vercel and redeploy. Studio shell only.
# On: the Director chat is one quiet thread (streams/frontend1/chat-design/v3): the user's turn is a right-aligned box in the one tinted colour, Director's words sit on the page with no box, label or time, an ask's choices are hairline chips with the chosen one outlined in ink, the header's
# connection dot is green when connected, amber while connecting and grey otherwise, and with NEXT_PUBLIC_BUILD_NARRATION the build is an outlined job card inline at the end of the thread (Plan › Outline › Build › Check › Package, one latest line, the elapsed clock) in place of the
# "Director is working" row, with small notes for each stop and resume. The composer is a hairline box: attach, template and theme as small square buttons, the research options button (deep research / web search / knowledge graph, as today) next to Send with a dot while any is on,
# the model picker as a gauge button (shown only with NEXT_PUBLIC_STUDIO_MODEL_CHOICE), and, with NEXT_PUBLIC_BUILD_CONTROL, Send becomes Stop while a build runs (build_control stop: finished slides are kept); the ribbon's Pause / Stop and the flow bar are not drawn. A stopped build is a
# slim bar above the composer ("Stopped at slide 5 · slides 1–4 kept" with Continue = build_control resume), and the composer stays free: Enter with new directions always sends build_control resume {instructions} (1000 characters at most; Director's building acknowledgement names
# the slides it applied them to, or says nothing was left to build), whatever the NEXT_PUBLIC_STUDIO_FLOW_* flags say (Director: a plain message after a stop is an ordinary chat turn and never rebuilds). No text is drawn larger than the chat draws it today. PK's open choices (the accent,
# the Stop colour, the primary action after a stop, the Director label, the user-box tint, where the research switches live) are one token each in lib/studio-chat-clean.ts.
NEXT_PUBLIC_STUDIO_CHAT_CLEAN="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays (a taught proof gets its previous lines back). Any other file is returned as it is. */
export function stripChatClean(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in CHAT_CLEAN_PIN_EDITS) return putBackChatCleanEdits(rel, text) // an older proof this change taught: its previous text, so a proof that holds it byte for byte reads it as it was
  if (!CHAT_CLEAN_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !CHAT_CLEAN_MARKER_RE.test(line)).join('\n')
}

/** The proof without this change's taught lines (the previous file). */
export function putBackChatCleanEdits(rel, text) {
  return (CHAT_CLEAN_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}
