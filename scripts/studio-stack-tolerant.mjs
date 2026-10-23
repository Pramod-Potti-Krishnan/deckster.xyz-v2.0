// FRONTEND-2: what the Pass 3 pins of #470 (refine an element from chat), #472 (theme / export from chat), #473 (model catalog) and #475 (narration through the router) hold a tree to once LATER PRs
// have changed it too. Each of those tests compared the whole committed tree with its base and failed on any file it did not list (FRONTEND-1's /docs/api pass, #476, failed all four), and held
// every shared file it edits to its base byte for byte once its own lines were stripped. The rules, used by all four tests (and by the stacked tests that come after them, e.g. #479):
//  1. Scope. A change answers for its own files: STACK[n].files, frozen from its PR's own diff (git diff --name-only STACK[n].base STACK[n].head; each test checks the list against that diff), every
//     file of its own path family (STACK[n].family; a family file that is not frozen is a stray, refused and never ignored), and the stack its test already declares (`known`). Any other changed
//     file is a later PR's: ignored, and counted on one printed line.
//  2. Every frozen file is still changed against the base (an own file missing is refused).
//  3. A shared file (sameOrTolerant): strip(HEAD) equal to the base byte for byte, as before. Only when it is not (a later PR edited the file too): every base line is still there, in order; none of
//     this change's added lines is left after its strip; and every one of them is in HEAD. In package.json the base's last entry of a list may carry the one trailing comma a later append gives it
//     (only that comma, only once, and only with an entry after it), the result must still parse, and this change's lines are compared without their trailing comma (an entry's comma depends on
//     what follows it). .env.example keeps scripts/studio-env-append-tolerant.mjs (sameAsBase, #480), which is stricter about what may be added.
//  4. A shared file the stack edits with no strip module (stackFileTolerant: scripts/studio-library-manage-harness.mjs): the file as the stack left it (STACK[475].head) byte for byte, as before; or
//     every line of it still there, in order, with only a later PR's lines added.
// stackMutants() runs a test's own data through these rules with their mutants (a base line dropped or a base script changed, this change's line left after its strip, its lines gone from HEAD or a later
// line taken for its own, an own file missing, a stray in its family, a line of the stack's harness dropped or edited) and controls. Plain JavaScript with no imports and no I/O: the tests hand in git's
// answers, and scripts/test-studio-narration-router.mjs loads this file from its text to mutate it.

const REFINE_FIXTURES = ['01-success', '02-failed', '03-dismissed', '04-g3-no-element-reference', '05-g5-slide-op-in-flight', '06-no-cap', '07-failed-viewer-unavailable',
  '08-failed-element-not-found', '09-failed-timeout', '10-two-elements', '11-off-list-type', '12-long-id', '13-non-refinable-type'].map(name => `scripts/fixtures/chat-element-refine/director-frames/${name}.json`)
const CATALOG_FIXTURES = ['200-available-page2', '200-available', '200', '400', '502', '503-unreachable', '503'].map(name => `scripts/fixtures/studio-model-catalog/fixture-${name}.json`)

/** Each change: its base and head commit (its PR's own diff), its frozen files in git's order, its path family and a made-up stray in that family (for the mutant). */
export const STACK = {
  470: {
    pr: 470, base: '8d5c494a7abcbfaf3d1b69eda257a5100013cb18', head: 'aa0cfeea25f4d8a7b8f82dc040a563034e8bc211', stray: 'lib/chat-element-refine-later.ts',
    family: /^(lib\/chat-element-refine[^/]*|scripts\/(test-)?studio-chat-element-refine[^/]*|scripts\/fixtures\/chat-element-refine\/.+|docs\/pass3\/chat-element-refine\/.+)$/,
    files: ['.env.example', 'app/builder/page.tsx', 'docs/pass3/chat-element-refine/LIVE-CHECK-PLAN.md', 'hooks/use-deckster-websocket-v2.ts', 'hooks/use-textlabs-generation.ts',
      'lib/chat-element-refine-wire.ts', 'lib/chat-element-refine.ts', 'package.json', ...REFINE_FIXTURES, 'scripts/fixtures/chat-element-refine/layout-replies.json',
      'scripts/fixtures/chat-element-refine/serve-layout-viewer.py', 'scripts/studio-add-slide-status-strip.mjs', 'scripts/studio-chat-element-refine-layout.mjs',
      'scripts/studio-chat-element-refine-strip.mjs', 'scripts/studio-library-manage-harness.mjs', 'scripts/studio-open-read-only-strip.mjs', 'scripts/studio-theme-dark-persist-strip.mjs',
      'scripts/test-studio-add-element-ownership.mjs', 'scripts/test-studio-chat-element-refine.mjs', 'scripts/test-studio-deck-mutation-dedupe.mjs', 'scripts/test-studio-director-transport.mjs',
      'scripts/test-studio-duplicate-deck.mjs', 'scripts/test-studio-element-free-spot.mjs', 'scripts/test-studio-element-placeholder-fix.mjs', 'scripts/test-studio-image-pending-write.mjs',
      'scripts/test-theme-font-selection.mjs', 'types/mdc.ts'],
  },
  472: {
    pr: 472, base: 'aa0cfeea25f4d8a7b8f82dc040a563034e8bc211', head: '72606f6ea84590f818a36b4551093db3f5057923', stray: 'lib/chat-theme-export-later.ts',
    family: /^(lib\/chat-theme-export[^/]*|scripts\/(test-)?studio-chat-theme-export[^/]*|scripts\/fixtures\/chat-theme-export\/.+|docs\/pass3\/chat-theme-export\/.+)$/,
    files: ['.env.example', 'app/builder/page.tsx', 'docs/pass3/chat-theme-export/LIVE-CHECK-PLAN.md', 'hooks/use-deckster-websocket-v2.ts', 'lib/chat-theme-export-wire.ts',
      'lib/chat-theme-export.ts', 'package.json', 'scripts/fixtures/chat-theme-export/director-frames.json', 'scripts/studio-add-slide-status-strip.mjs', 'scripts/studio-chat-theme-export-strip.mjs',
      'scripts/studio-library-manage-harness.mjs', 'scripts/studio-open-read-only-strip.mjs', 'scripts/studio-theme-dark-persist-strip.mjs', 'scripts/test-studio-chat-element-refine.mjs',
      'scripts/test-studio-chat-theme-export.mjs', 'scripts/test-studio-deck-mutation-dedupe.mjs', 'scripts/test-studio-director-transport.mjs', 'scripts/test-studio-duplicate-deck.mjs',
      'scripts/test-theme-font-selection.mjs'],
  },
  473: {
    pr: 473, base: '72606f6ea84590f818a36b4551093db3f5057923', head: '13c90ea9c94dc2b426c98bf775b870f890b99fab', stray: 'lib/studio-model-catalog-later.ts',
    // not the older 2026-10 static excerpt (scripts/test-studio-model-catalog-2026-10.mjs), which is the base's
    family: /^(lib\/studio-model-catalog[^/]*|app\/api\/models\/.+|app\/\(app\)\/studio\/intelligence\/layout\.tsx|components\/studio-personal\/intelligence-models[^/]*|scripts\/(test-)?studio-model-catalog(?!-2026-10)[^/]*|scripts\/fixtures\/studio-model-catalog\/.+)$/,
    files: ['.env.example', 'app/(app)/studio/intelligence/layout.tsx', 'app/api/models/catalogue/route.ts', 'components/studio-personal/intelligence-models.css',
      'components/studio-personal/intelligence-models.tsx', 'lib/studio-model-catalog.ts', 'package.json', ...CATALOG_FIXTURES, 'scripts/studio-library-manage-harness.mjs',
      'scripts/studio-model-catalog-strip.mjs', 'scripts/test-studio-chat-element-refine.mjs', 'scripts/test-studio-chat-theme-export.mjs', 'scripts/test-studio-model-catalog.mjs'],
  },
  475: {
    pr: 475, base: '13c90ea9c94dc2b426c98bf775b870f890b99fab', head: 'c1a7378752f6d7c90baecefb5a07fc33f4c9d6cd', stray: 'lib/narration/model-router-later.ts',
    family: /^(lib\/narration\/model-router[^/]*|scripts\/(test-)?studio-narration-router[^/]*|scripts\/fixtures\/(studio-)?narration-router\/.+)$/,
    files: ['.env.example', 'app/api/narration/render/route.ts', 'app/api/narration/script/route.ts', 'app/api/narration/speak/route.ts', 'app/api/narration/voice/sample/[voiceId]/route.ts',
      'lib/narration/draft.ts', 'lib/narration/model-router.ts', 'lib/narration/spoken.ts', 'lib/narration/tts.ts', 'package.json', 'scripts/studio-library-manage-harness.mjs',
      'scripts/studio-narration-router-strip.mjs', 'scripts/test-studio-chat-element-refine.mjs', 'scripts/test-studio-chat-theme-export.mjs', 'scripts/test-studio-model-catalog.mjs',
      'scripts/test-studio-narration-router.mjs'],
  },
}

/** Rule 1 and 2 on `changed` (git diff --name-only base HEAD): the files the change answers for (`checked`), later PRs' files (`ignored`), family files that are not frozen (`stray`), frozen files not changed (`missing`). */
export function stackScope(changed, change, known = () => false) {
  const checked = [], ignored = [], stray = []
  for (const rel of changed) {
    if (change.files.includes(rel) || known(rel)) checked.push(rel)
    else if (change.family.test(rel)) { checked.push(rel); stray.push(rel) }
    else ignored.push(rel)
  }
  const missing = change.files.filter(rel => !changed.includes(rel))
  const named = ignored.length ? `: ${ignored.slice(0, 8).join(', ')}${ignored.length > 8 ? `, and ${ignored.length - 8} more` : ''}` : ''
  return { checked, ignored, stray, missing, line: `stacked scope (#${change.pr}): ${ignored.length} later-PR file${ignored.length === 1 ? '' : 's'} ignored (outside its ${change.files.length} frozen files, its path family and its declared stack)${named}` }
}

const lineKey = rel => (rel === 'package.json' ? line => line.replace(/,\s*$/, '') : line => line)

/** This change's added lines in `rel`: the lines of each [added, original] pair that the original does not have and the base file does not have either (a context line is nobody's). */
export function ownLines(rel, changes, baseText) {
  const key = lineKey(rel), base = new Set(baseText.split('\n').map(key))
  const own = new Set()
  for (const [added, original] of changes) {
    const was = new Set(original.split('\n').map(key))
    for (const line of added.split('\n').map(key)) if (line.trim() !== '' && !was.has(line) && !base.has(line)) own.add(line)
  }
  return [...own]
}

/** Rule 3: `head` is the file with the stacked changes' lines out, `stripped` the same with this change's lines out too. { ok, exact, reason }. */
export function sameOrTolerant(rel, head, stripped, baseText, changes) {
  if (stripped === baseText) return { ok: true, exact: true, reason: 'byte for byte' }
  const want = baseText.split('\n'), have = stripped.split('\n'), json = rel === 'package.json', closes = line => /^\s*\}/.test(line ?? '')
  let next = 0, commas = 0
  for (const [at, line] of have.entries()) {
    if (next >= want.length) break
    if (line === want[next]) next++
    // package.json: the base's last entry of a list followed now by a later PR's entry, with the comma that append gave it
    else if (json && commas === 0 && line === `${want[next]},` && closes(want[next + 1]) && !closes(have[at + 1])) { next++; commas++ }
  }
  if (next < want.length) return { ok: false, exact: false, reason: `base line ${next + 1} is missing or out of order: ${want[next].slice(0, 120)}` }
  if (json) { try { JSON.parse(stripped) } catch { return { ok: false, exact: false, reason: 'package.json does not parse after the strip' } } }
  const key = lineKey(rel), own = ownLines(rel, changes, baseText)
  if (own.length === 0) return { ok: false, exact: false, reason: 'this change has no added line here to look for' }
  const left = new Set(have.map(key)), inHead = new Set(head.split('\n').map(key))
  const leftover = own.find(line => left.has(line))
  if (leftover !== undefined) return { ok: false, exact: false, reason: `this change's line is left after its strip: ${leftover.slice(0, 120)}` }
  const gone = own.find(line => !inHead.has(line))
  if (gone !== undefined) return { ok: false, exact: false, reason: `this change's line is not in HEAD: ${gone.slice(0, 120)}` }
  return { ok: true, exact: false, reason: `${have.length - want.length} line(s) of a later PR taken` }
}

/** Rule 4: `stackText` is the file as the stack left it (git show STACK[475].head:<rel>), `headText` the file now. { ok, exact, reason }. */
export function stackFileTolerant(stackText, headText) {
  if (headText === stackText) return { ok: true, exact: true, reason: 'byte for byte as the stack left it' }
  const keep = stackText.split('\n'), now = headText.split('\n')
  let kept = 0
  for (const line of now) if (kept < keep.length && line === keep[kept]) kept++
  if (kept < keep.length) return { ok: false, exact: false, reason: `the stack's line ${kept + 1} is missing or out of order: ${keep[kept].slice(0, 120)}` }
  return { ok: true, exact: false, reason: `${now.length - keep.length} line(s) of a later PR taken` }
}

/** The rules on a test's own data, with their mutants. `shared`: [{ rel, head, strip, base, changes }] as for sameOrTolerant; `kept`: [{ rel, stack, head }] as for stackFileTolerant.
 * Returns [label, true when the mutant is refused / the control taken]. */
export function stackMutants({ change, changed, known = () => false, shared, kept = [] }) {
  const out = []
  const scope = list => stackScope(list, change, known)
  const clean = s => s.missing.length === 0 && s.stray.length === 0
  const elsewhere = 'app/later-pr/page.tsx'
  out.push(['control: the tree as it is: no own file missing, no stray, every own file checked', (s => clean(s) && change.files.every(rel => s.checked.includes(rel)))(scope(changed))])
  out.push(['control: a later PR\'s file elsewhere is ignored and counted', (s => clean(s) && s.ignored.includes(elsewhere) && !s.checked.includes(elsewhere))(scope([...changed, elsewhere]))])
  out.push(['mutant: an own file missing (each of them in turn) is refused', change.files.every(rel => !clean(scope(changed.filter(other => other !== rel))))])
  out.push(['mutant: a later-PR file in this change\'s path family is not ignored', (s => !clean(s) && s.stray.includes(change.stray) && !s.ignored.includes(change.stray))(scope([...changed, change.stray]))])
  for (const { rel, head, strip, base, changes } of shared) {
    const verdict = text => sameOrTolerant(rel, text, strip(text), base, changes)
    const lines = head.split('\n'), baseLines = base.split('\n'), own = ownLines(rel, changes, base)
    const later = rel === 'package.json' ? '    "test:studio-later": "node scripts/test-studio-later.mjs",' : '// a later PR\'s line (made up, for this check)'
    const put = (list, line) => [list[0], line, ...list.slice(1)].join('\n')
    const once = (list, line) => list.filter(other => other === line).length === 1
    const at = lines.findIndex((line, i) => i > 0 && line.trim() !== '' && once(lines, line) && once(baseLines, line) && !changes.some(([added]) => added.includes(line)))
    out.push([`${rel}: control: the base itself is byte for byte`, (v => v.ok && v.exact)(sameOrTolerant(rel, head, base, base, changes))])
    out.push([`${rel}: control: a later PR's line is taken, not as byte for byte`, (v => v.ok && !v.exact)(verdict(put(lines, later)))])
    out.push([`${rel}: mutant: a base line dropped is refused`, at > 0 && !verdict(put(lines.filter((_, i) => i !== at), later)).ok])
    out.push([`${rel}: mutant: this change's line left behind after its strip is refused`, own.length > 0 && !verdict(`${put(lines, later)}\n${own[0]}\n`).ok])
    out.push([`${rel}: mutant: this change's lines gone from HEAD (the base with a later PR's line) are refused`, !verdict(put(baseLines, later)).ok])
    out.push([`${rel}: mutant: no line of this change to look for is refused`, !sameOrTolerant(rel, put(lines, later), strip(put(lines, later)), base, []).ok])
    if (rel !== 'package.json') continue
    // package.json, built on the base so that it holds whatever HEAD carries: this change's line as the last entry, then a later registration appended after it (this change's line gains a comma)
    // `line` after the last entry of `list` (that entry gains its comma); with no `line`, only the comma: what a strip that forgot to take it back leaves
    const append = (text, list, line) => { const at = text.split('\n'), open = at.findIndex(l => l === `  "${list}": {`), end = at.findIndex((l, i) => i > open && /^  \},?$/.test(l)); return open < 0 || end <= open + 1 ? null : [...at.slice(0, end - 1), `${at[end - 1]},`, ...(line === undefined ? [] : [line]), ...at.slice(end)].join('\n') }
    const laterLast = '    "test:studio-later": "node scripts/test-studio-later.mjs"', mine = own[0] === undefined ? null : append(base, 'scripts', own[0]), both = mine && append(mine, 'scripts', laterLast)
    const script = baseLines.find(line => /^ {4}"test:[^"]+": "node [^"]+\.mjs",$/.test(line) && once(baseLines, line))
    out.push([`${rel}: control: this change's line as the last entry comes out byte for byte`, mine !== null && (v => v.ok && v.exact)(verdict(mine))])
    out.push([`${rel}: control: a later registration appended after it (its entry gains a comma) is taken`, both !== null && (v => v.ok && !v.exact)(verdict(both))])
    out.push([`${rel}: mutant: ... and a base script line changed is refused`, both !== null && script !== undefined && !verdict(both.replace(script, script.replace('.mjs",', '-changed.mjs",'))).ok])
    out.push([`${rel}: mutant: ... and this change's line left behind after its strip is refused`, both !== null && !verdict(both.replace('  "scripts": {\n', `  "scripts": {\n${own[0]},\n`)).ok])
    out.push([`${rel}: mutant: an appended later line taken for this change's (its line gone, a later one appended) is refused`, (text => text !== null && !verdict(text).ok)(append(base, 'scripts', laterLast))])
    out.push([`${rel}: mutant: the entry before this change's removed last line keeps its comma is refused`, mine !== null && (text => text !== null && !sameOrTolerant(rel, mine, text, base, changes).ok)(append(base, 'scripts'))])
    out.push([`${rel}: mutant: a comma gained on two base lines (two lists appended to) is refused`, both !== null && (text => text !== null && !verdict(text).ok)(append(both, 'devDependencies', '    "later-package": "1.0.0"') ?? append(both, 'dependencies', '    "later-package": "1.0.0"'))])
  }
  for (const { rel, stack, head } of kept) {
    const lines = stack.split('\n'), once = line => lines.filter(other => other === line).length === 1
    const later = '  // a later PR\'s line (made up, for this check)', put = list => [list[0], later, ...list.slice(1)].join('\n')
    const at = lines.findIndex((line, i) => i > 0 && line.trim() !== '' && once(line))
    out.push([`${rel}: control: the file as the stack left it is byte for byte`, (v => v.ok && v.exact)(stackFileTolerant(stack, stack))])
    out.push([`${rel}: control: the file as it is now`, stackFileTolerant(stack, head).ok])
    out.push([`${rel}: control: a later PR's line is taken, not as byte for byte`, (v => v.ok && !v.exact)(stackFileTolerant(stack, put(lines)))])
    out.push([`${rel}: mutant: a line of the stack dropped is refused`, at > 0 && !stackFileTolerant(stack, put(lines.filter((_, i) => i !== at))).ok])
    out.push([`${rel}: mutant: a line of the stack edited is refused`, at > 0 && !stackFileTolerant(stack, put(lines.map((line, i) => (i === at ? `${line} // edited` : line)))).ok])
  }
  return out
}
