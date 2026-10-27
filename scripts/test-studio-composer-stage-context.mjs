// PASS2B G12 (FRONTEND-2): the Studio composer's context line names the stage until a built deck exists, as the accepted v4 mockup's composer
// does ("Review the outline", "Bring it to life"), instead of "New presentation" while planning or "Working on slide 1" while an outline or a
// build has slides on the canvas but none is being worked on. Flag NEXT_PUBLIC_STUDIO_COMPOSER_STAGE_CONTEXT (exact "true"; the line itself still
// needs NEXT_PUBLIC_STUDIO_CHAT_COMPOSER_CONTEXT), default off.
//
// Run: node scripts/test-studio-composer-stage-context.mjs   (plain node: transpile + vm, no network, no env)
//   COMPOSER_STAGE_BASE=<commit> overrides the base commit the flag-off identity is checked against (default a2e14da).
//
// Proven on the REAL lib/studio-chat-composer-context.ts and the REAL call site in app/builder/page.tsx:
//   1. the lib stays import-free; without `stage` every label is the base commit's over a grid (flag off cannot change a label);
//   2. the stage decision over the whole input grid equals an independently written decision table; the named scenarios read as intended;
//   3. the page: the flag is exact "true" and read inline, `stage` is added only inside that spread, from state the page already holds; with the
//      spread removed the call site is the base commit's text; chat-input.tsx is the base commit's file (no new import, as the existing tests require);
//   4. mutation check: every mutant of the lib and of the page wiring is killed by sections 1-3.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { stripLaterChanges } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (CHAT-CLEAN)

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const BASE_COMMIT = process.env.COMPOSER_STAGE_BASE || 'a2e14da'
function baseSource(rel) {
  try {
    execFileSync('git', ['cat-file', '-e', `${BASE_COMMIT}^{commit}`], { cwd: root, stdio: 'ignore' })
    return execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch { return null }
}
const load = source => {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module, exports: module.exports })
  return module.exports
}
let checks = 0
const eq = (got, wanted, label) => { checks++; assert.deepStrictEqual(JSON.parse(JSON.stringify(got)), JSON.parse(JSON.stringify(wanted)), label) }

const LIB = 'lib/studio-chat-composer-context.ts'
const PAGE = 'app/builder/page.tsx'
const CHAT_INPUT = 'components/builder/chat-input.tsx'
const libSource = read(LIB)
const pageSource = read(PAGE)

// ---------------------------------------------------------------- the grid
const PHASES = ['idle', 'planning', 'strawman', 'awaiting_user', 'building', 'qa', 'finalizing', 'complete', 'paused', 'stopped', 'error']
const VERSIONS = [null, undefined, 'blank', 'strawman', 'final']
const BOOLS = [false, true]
const GRID = []
for (const deckOpen of BOOLS) for (const builtDeck of BOOLS) for (const activeVersion of VERSIONS) for (const generatingFinal of BOOLS)
  for (const phase of PHASES) for (const directorWorking of BOOLS) GRID.push({ deckOpen, builtDeck, activeVersion, generatingFinal, phase, directorWorking })

/** The decision table, written as the spec reads, not as the lib is written. */
function expectedStage({ deckOpen, builtDeck, activeVersion, generatingFinal, phase, directorWorking }) {
  const buildRunning = generatingFinal || phase === 'building' || phase === 'qa' || phase === 'finalizing'
  if (buildRunning) return 'building'                       // slides are being made, whatever is open
  if (builtDeck) return null                                 // a built deck: "Working on slide N"
  if (deckOpen) return activeVersion === 'strawman' ? 'outline' : null   // the outline on the canvas; a hand-made blank deck stays "Working on slide N"
  return directorWorking ? 'planning' : null                 // no deck yet: Director is working on the brief, else the greeting's "New presentation"
}
const LABELS = { planning: 'Planning your deck', outline: 'Reviewing the outline', building: 'Building slides' }
const SLIDES = [{ slideNumber: 1, slideCount: 12 }, { slideNumber: 3, slideCount: 12 }, { slideNumber: 9, slideCount: 8 }, { slideNumber: 0, slideCount: 8 }, { slideNumber: 2, slideCount: null }]

function proveLib(lib, label = 'lib') {
  for (const input of GRID) {
    const { builtDeck, activeVersion, generatingFinal, phase, directorWorking, deckOpen } = input
    const stageInput = { builtDeck, activeVersion, generatingFinal, phase, directorWorking }
    const at = `${label} ${JSON.stringify(input)}`
    assert.equal(lib.studioComposerStage(input), expectedStage(input), `${at}: stage`)
    for (const { slideNumber, slideCount } of SLIDES) {
      const without = lib.studioComposerContextLabel({ deckOpen, slideNumber, slideCount })
      const withStage = lib.studioComposerContextLabel({ deckOpen, slideNumber, slideCount, stage: stageInput })
      const want = expectedStage(input)
      assert.equal(withStage, want ? LABELS[want] : without, `${at} slide ${slideNumber}/${slideCount}: label`)
    }
  }
  assert.deepEqual({ ...lib.STUDIO_COMPOSER_STAGE_LABELS }, LABELS, `${label}: the three words`)
}
proveLib(load(libSource)); checks += GRID.length * (1 + SLIDES.length)

// ---------------------------------------------------------------- 1. import-free, and flag off cannot change a label
checks++; assert.doesNotMatch(libSource, /^\s*import\s/m, 'the lib stays import-free (tests transpile it in a bare sandbox, the page reads it)')
{
  const real = load(libSource)
  const base = baseSource(LIB)
  const oracle = base ? load(base) : null
  if (!oracle) console.log(`  SKIP base-commit label identity: ${BASE_COMMIT} is not in this clone`)
  for (const deckOpen of BOOLS) for (const slideNumber of [Number.NaN, -1, 0, 1, 2.5, 3, 9, 12, 13, 1e9]) for (const slideCount of [undefined, null, 0, -3, Number.NaN, 8, 12]) {
    const input = { deckOpen, slideNumber, slideCount }
    const got = real.studioComposerContextLabel(input)
    if (oracle) { checks++; assert.equal(got, oracle.studioComposerContextLabel(input), `no stage: label of ${JSON.stringify(input)} is the base commit's`) }
    checks++; assert.equal(real.studioComposerContextLabel({ ...input, stage: undefined }), got, 'an absent stage is no stage')
  }
}

// ---------------------------------------------------------------- 2. the scenarios, in words
{
  const lib = load(libSource)
  const label = (deckOpen, stage, slideNumber = 1, slideCount = 12) => lib.studioComposerContextLabel({ deckOpen, slideNumber, slideCount, stage })
  const idle = { builtDeck: false, activeVersion: null, generatingFinal: false, phase: 'idle', directorWorking: false }
  eq(label(false, idle), 'New presentation', 'the greeting: nothing has been sent, so as before')
  eq(label(false, { ...idle, directorWorking: true }), 'Planning your deck', 'the brief is sent and Director is working on it')
  eq(label(false, { ...idle, phase: 'planning', directorWorking: true }), 'Planning your deck', 'planning narration')
  eq(label(true, { ...idle, activeVersion: 'strawman', phase: 'awaiting_user' }, 1), 'Reviewing the outline', 'the outline is on the canvas')
  eq(label(true, { ...idle, activeVersion: 'strawman', phase: 'strawman' }, 1), 'Reviewing the outline', 'the outline arrives')
  eq(label(true, { ...idle, activeVersion: 'strawman', phase: 'building', generatingFinal: true }, 1), 'Building slides', 'the build has started')
  eq(label(true, { ...idle, activeVersion: 'final', phase: 'qa', generatingFinal: true }, 4), 'Building slides', 'slides are filling in')
  eq(label(true, { ...idle, activeVersion: 'final', builtDeck: true, phase: 'complete' }, 3), 'Working on slide 3', 'a built deck: as before')
  eq(label(true, { ...idle, activeVersion: 'final', builtDeck: true }, 1), 'Working on slide 1', 'a built deck, slide 1')
  eq(label(true, { ...idle, activeVersion: 'blank' }, 2, 5), 'Working on slide 2', 'a blank deck the user is filling by hand: as before')
  eq(label(true, { ...idle, activeVersion: 'final', builtDeck: true, directorWorking: true }, 2), 'Working on slide 2', 'Director answering about a built deck: as before')
  eq(label(true, { ...idle, activeVersion: 'strawman', phase: 'stopped' }, 1), 'Reviewing the outline', 'a stopped build leaves the outline')
  eq(label(true, { ...idle, activeVersion: 'strawman', phase: 'error' }, 1), 'Reviewing the outline', 'a failed build leaves the outline')
}

// ---------------------------------------------------------------- 3. the page
/** The text of the composer's context prop in the page. */
const callSite = text => {
  const from = text.indexOf('studioContextLabel={')
  const to = text.indexOf('pausedInOtherTab={', from)
  assert.ok(from > 0 && to > from, 'the call site is found')
  return text.slice(from, to)
}
const G12_BLOCK = /\s*\/\/ PASS2B G12[^\n]*\n\s*\.\.\.\(process\.env\.NEXT_PUBLIC_STUDIO_COMPOSER_STAGE_CONTEXT === 'true' \? \{ stage: \{[\s\S]*?\} \} : \{\}\),/
function proveWiring(page, label = 'page') {
  const site = callSite(page)
  const block = site.match(G12_BLOCK)
  assert.ok(block, `${label}: the stage spread is there, behind the exact-"true" flag read inline`)
  assert.equal((page.match(/NEXT_PUBLIC_STUDIO_COMPOSER_STAGE_CONTEXT/g) ?? []).length, 2, `${label}: the flag appears in the comment and once as code`)
  // the stage comes from state the page already holds
  for (const wanted of [
    'builtDeck: studioCanvasLifecycle.hasGeneratedDeck,',
    'activeVersion: effectiveActiveVersion,',
    'generatingFinal: isGeneratingFinal,',
    "phase: buildNarration.active ? buildNarration.phase : 'idle',",
    'directorWorking: buildNarration.active || awaitingDirectorReply || isGeneratingStrawman || isGeneratingFinal',
    "(['thinking', 'generating', 'awaiting_user'] as string[]).includes(String(currentStatus?.status))",
  ]) assert.ok(block[0].includes(wanted), `${label}: the stage input ${wanted}`)
  // the outer guard is untouched: Studio shell and the existing flag
  assert.ok(site.startsWith("studioContextLabel={studioShell && process.env.NEXT_PUBLIC_STUDIO_CHAT_COMPOSER_CONTEXT === 'true' ?"), `${label}: still behind the existing flag`)
  assert.equal((site.match(/studioComposerContextLabel\(/g) ?? []).length, 1, `${label}: one call`)
  // flag off: with the spread removed, the call site is the base commit's text, character for character
  const basePage = baseSource(PAGE)
  if (basePage) assert.equal(site.replace(G12_BLOCK, ''), callSite(basePage), `${label}: without the spread the call site is ${BASE_COMMIT}'s`)
}
proveWiring(pageSource); checks += 6 + 6
{
  const base = baseSource(CHAT_INPUT)
  if (base) { checks++; assert.equal(stripLaterChanges(CHAT_INPUT, read(CHAT_INPUT)), stripLaterChanges(CHAT_INPUT, base), `chat-input.tsx is the base commit's file: the line is a string prop, as #382 passes it`) } // LATER-CHANGES: registry read (CHAT-CLEAN): the lines of the changes registered after this one (chat clean's) come out of both sides first
  checks++; assert.doesNotMatch(read(CHAT_INPUT), /from\s+['"][^'"]*studio-chat-composer-context['"]/, 'chat-input.tsx imports nothing from the composer-context lib (existing tests forbid it)')
}

// ---------------------------------------------------------------- 4. mutation check
const LIB_MUTANTS = [
  ['building ignores generatingFinal', 'input.generatingFinal || STUDIO_COMPOSER_BUILD_PHASES.includes(input.phase)', 'STUDIO_COMPOSER_BUILD_PHASES.includes(input.phase)'],
  ['building ignores the phase', 'input.generatingFinal || STUDIO_COMPOSER_BUILD_PHASES.includes(input.phase)', 'input.generatingFinal'],
  ["building phases lack 'qa'", "['building', 'qa', 'finalizing']", "['building', 'finalizing']"],
  ["building phases lack 'finalizing'", "['building', 'qa', 'finalizing']", "['building', 'qa']"],
  ["building phases include 'complete'", "['building', 'qa', 'finalizing']", "['building', 'qa', 'finalizing', 'complete']"],
  ["building phases include 'paused'", "['building', 'qa', 'finalizing']", "['building', 'qa', 'finalizing', 'paused']"],
  ['a built deck is still staged', 'if (input.builtDeck) return null', ''],
  ['a built deck is never "building"', 'input.generatingFinal || STUDIO_COMPOSER_BUILD_PHASES.includes(input.phase)', '!input.builtDeck && (input.generatingFinal || STUDIO_COMPOSER_BUILD_PHASES.includes(input.phase))'],
  ['any open deck is the outline', "input.activeVersion === 'strawman' ? 'outline' : null", "'outline'"],
  ['a blank deck is the outline', "input.activeVersion === 'strawman'", "input.activeVersion !== 'final'"],
  ['no deck is always planning', 'return input.directorWorking ? \'planning\' : null', "return 'planning'"],
  ['planning ignores Director working', 'return input.directorWorking ? \'planning\' : null', 'return null'],
  ['an open deck can be planning', 'if (input.deckOpen) return input.activeVersion', 'if (!input.deckOpen) return input.activeVersion'],
  ['stage ignored by the label', 'if (context.stage) {', 'if (false) {'],
  ['stage read from the wrong deckOpen', '{ ...context.stage, deckOpen: context.deckOpen }', '{ ...context.stage, deckOpen: false }'],
  ['label swapped', "outline: 'Reviewing the outline'", "outline: 'Planning your deck'"],
  ['label reworded', "building: 'Building slides'", "building: 'Building'"],
  ['label reworded 2', "planning: 'Planning your deck'", "planning: 'Planning'"],
  ['no stage falls through to nothing', 'if (stage) return STUDIO_COMPOSER_STAGE_LABELS[stage]', 'return STUDIO_COMPOSER_STAGE_LABELS[stage] ?? \'\''],
  ['a base label changed', "return 'New presentation'", "return 'New deck'"],
]
const PAGE_MUTANTS = [
  ['flag read loosely', "process.env.NEXT_PUBLIC_STUDIO_COMPOSER_STAGE_CONTEXT === 'true'", "process.env.NEXT_PUBLIC_STUDIO_COMPOSER_STAGE_CONTEXT !== 'false'"],
  ['stage always supplied', "...(process.env.NEXT_PUBLIC_STUDIO_COMPOSER_STAGE_CONTEXT === 'true' ? { stage: {", '...(true ? { stage: {'],
  ['built deck from the wrong state', 'builtDeck: studioCanvasLifecycle.hasGeneratedDeck,', 'builtDeck: studioCanvasLifecycle.hasAuthoredDeck,'],
  ['version from the raw state', 'activeVersion: effectiveActiveVersion,', 'activeVersion: activeVersion,'],
  ['generatingFinal dropped', 'generatingFinal: isGeneratingFinal,', 'generatingFinal: false,'],
  ['phase from the wrong place', "phase: buildNarration.active ? buildNarration.phase : 'idle',", 'phase: buildNarration.phase,'],
  ['Director working forgets the reply wait', '|| awaitingDirectorReply', ''],
  ['Director working forgets the status', "(['thinking', 'generating', 'awaiting_user'] as string[]).includes(String(currentStatus?.status))", 'false'],
  ['outer guard dropped', "studioContextLabel={studioShell && process.env.NEXT_PUBLIC_STUDIO_CHAT_COMPOSER_CONTEXT === 'true' ?", 'studioContextLabel={studioShell ?'],
  ['the base arguments changed', 'slideNumber: currentSlideIndex + 1,', 'slideNumber: currentSlideIndex,'],
]
let killed = 0
for (const [name, from, to] of LIB_MUTANTS) {
  assert.ok(libSource.includes(from), `lib mutant "${name}": the text it replaces exists`)
  const mutated = libSource.replace(from, () => to)
  assert.notEqual(mutated, libSource, `lib mutant "${name}" changes the source`)
  let survived = false
  try {
    const lib = load(mutated)
    proveLib(lib, name)
    const base = baseSource(LIB)
    if (base) for (const deckOpen of BOOLS) for (const slideNumber of [0, 1, 3, 9]) for (const slideCount of [null, 8]) {
      const input = { deckOpen, slideNumber, slideCount }
      assert.equal(lib.studioComposerContextLabel(input), load(base).studioComposerContextLabel(input), `${name}: base label`)
    }
    survived = true
  } catch (error) { assert.equal(error?.code, 'ERR_ASSERTION', `lib mutant "${name}" must be killed by an assertion, not a crash: ${error}`); killed++ }
  assert.ok(!survived, `lib mutant survived: ${name}`)
}
// the mutants change the call site (its outer guard and arguments) and the G12 block, not another place in the page that spells the same words
const SITE_START = pageSource.indexOf('studioContextLabel={')
for (const [name, from, to] of PAGE_MUTANTS) {
  const at = pageSource.indexOf(from, SITE_START)
  assert.ok(at >= SITE_START && at < pageSource.indexOf('pausedInOtherTab={', SITE_START), `page mutant "${name}": the text it replaces exists at the call site`)
  const mutated = pageSource.slice(0, at) + to + pageSource.slice(at + from.length)
  assert.notEqual(mutated, pageSource, `page mutant "${name}" changes the source`)
  let survived = false
  try { proveWiring(mutated, name); survived = true } catch (error) { assert.equal(error?.code, 'ERR_ASSERTION', `page mutant "${name}" must be killed by an assertion, not a crash: ${error}`); killed++ }
  assert.ok(!survived, `page mutant survived: ${name}`)
}
checks++; assert.equal(killed, LIB_MUTANTS.length + PAGE_MUTANTS.length)

// ---------------------------------------------------------------- .env.example
checks++; assert.match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_COMPOSER_STAGE_CONTEXT="false"$/m, 'documented in .env.example, default off')

console.log(`Composer stage context: ${checks} checks passed, ${killed}/${LIB_MUTANTS.length + PAGE_MUTANTS.length} mutants killed; no network.`)
