// FRONTEND-2 (B27 follow-up, PROGRAM-1 GO 27 Oct 04:17Z): proof of NEXT_PUBLIC_STUDIO_PAUSED_LABEL (exact "true", default off, build-time).
//
// THE DEFECT. E2E-2 (Pass A row 14, streams/e2e2/parity-proofs/run-A/shots/05-row14-paused-header.png): with the build paused the ribbon read "Building your slides..." next to Resume. The reducer lets a "building"
// status move a PAUSED build's phase back to "building" (lib/build-narration-heuristics.ts, the 'status' case: `proposed >= cur || next.phase === 'paused'`) while the control state stays paused; the ribbon
// (components/build-narration/stage-ribbon.tsx) printed n.phaseLabel, the phase's label.
//
// THE FIX (flag on). While n.control is paused the ribbon's headline reads the existing "Paused" label (phaseLabelFor('paused'): PHASE_LABELS.paused). Only the headline: the icon, the timer, the count and the buttons
// (the real PauseStopControl) read what they read today. No new copy.
//
//   1. paused / running / stopped / failed and the in-between states (a pause or resume asked for, the E2E shape: paused control with a "building" phase) through the REAL ribbon and the REAL PauseStopControl, states made
//      by the REAL narration reducer: flag on, the headline reads "Paused" whenever the control is paused, and the rest of the markup is flag off's, byte for byte (same markup but the headline's words).
//   2. Flag off is byte-identical to the base: every state's markup hashes as the markup of the base tree's ribbon (scripts/fixtures/paused-label/baselines/flag-off.json); the strip gives the base file back.
//   3. Mutants of the ribbon: each must be caught.
//   4. Scope over the COMMITTED diff (BASE..HEAD, the commits that start "Paused label:").
//
//   node scripts/test-studio-paused-label.mjs
//   node scripts/test-studio-paused-label.mjs --record-baseline --root <base checkout>   (re-record the flag-off baseline from a base tree)
//
// Offline: no socket, fetch or real timer (the harness's host network guard is installed); git is read only for 4.
process.env.NODE_ENV = 'production'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import dns from 'node:dns'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const option = name => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1] }
const recordBaseline = args.includes('--record-baseline')
const root = path.resolve(option('--root') || repo)
const FLAG = 'NEXT_PUBLIC_STUDIO_PAUSED_LABEL'
const RIBBON = 'components/build-narration/stage-ribbon.tsx'
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const baselineFile = path.join(repo, 'scripts/fixtures/paused-label/baselines/flag-off.json')

let passed = 0, failed = 0
async function check(label, fn) {
  try { await fn(); passed++; console.log(`  ok   ${label}`) } catch (error) { failed++; console.log(`  FAIL ${label}\n       ${String(error?.message ?? error).split('\n').join('\n       ')}`) }
}

const registry = await import('./studio-later-changes.mjs')
const stripModule = await import('./studio-paused-label-strip.mjs')
const { stripPausedLabel, BASE_COMMIT, PAUSED_LABEL_FILES, PAUSED_LABEL_SCOPE_FILES, PAUSED_LABEL_ENV_BLOCK, PAUSED_LABEL_SUBJECT, PAUSED_LABEL_MARKER_RE, PAUSED_LABEL_PIN_EDITS } = stripModule

const React = (await import('react')).default
const { renderToStaticMarkup } = await import('react-dom/server')
const jsxRuntime = await import('react/jsx-runtime')
const { installHostNetworkGuard, createEnvironment } = await import('./studio-chat-harness/fake-env.mjs')
const { createModuleLoader } = await import('./studio-chat-harness/module-loader.mjs')
const { esmPackages, lucideStub } = await import('./studio-chat-harness/esm-packages.mjs')
const { PROFILES, BASE_ENV } = await import('./studio-chat-harness/profiles.mjs')
const release = installHostNetworkGuard(net, dns)

// ---- the world: the real ribbon (or a mutant of it), the real PauseStopControl, the real reducer ---------------------------------------------------------------------------------------------
const passChildren = ({ children }) => children ?? null
const MOTION_PROPS = new Set(['initial', 'animate', 'exit', 'transition', 'variants', 'layout', 'layoutId', 'whileHover', 'whileTap', 'custom'])
const framerMotion = () => {
  const cache = new Map()
  const motion = new Proxy({}, { get(_t, tag) { if (typeof tag !== 'string') return undefined; if (!cache.has(tag)) cache.set(tag, ({ children, ...props }) => React.createElement(tag, Object.fromEntries(Object.entries(props).filter(([key]) => !MOTION_PROPS.has(key))), children)); return cache.get(tag) } })
  return { __esModule: true, AnimatePresence: passChildren, motion, useReducedMotion: () => true }
}
const alertDialog = () => ({ __esModule: true, AlertDialog: ({ open, children }) => (open ? React.createElement('div', { role: 'alertdialog' }, children) : null),
  AlertDialogContent: passChildren, AlertDialogHeader: passChildren, AlertDialogFooter: passChildren, AlertDialogTitle: passChildren, AlertDialogDescription: passChildren,
  AlertDialogCancel: ({ children }) => React.createElement('button', null, children), AlertDialogAction: ({ children }) => React.createElement('button', null, children) })

async function world({ flagOn, shell = true, ribbonText = null }) {
  const processEnv = { ...BASE_ENV, ...(shell ? PROFILES.studio : PROFILES.classic), NEXT_PUBLIC_BUILD_NARRATION: 'true', NEXT_PUBLIC_BUILD_CONTROL: 'true', ...(flagOn ? { [FLAG]: 'true' } : {}) }
  const env = createEnvironment({ processEnv })
  const fileStubs = { 'components/ui/alert-dialog': alertDialog() }
  const loader = createModuleLoader({ root, globals: env.globals, stubs: { ...(await esmPackages(root)), react: React, 'lucide-react': lucideStub(React), 'framer-motion': framerMotion() }, fileStubs })
  if (ribbonText !== null) { // a mutant: the ribbon's text compiled in the loader's context, its imports resolved to the real siblings
    const compiled = ts.transpileModule(ribbonText, { fileName: RIBBON, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, isolatedModules: true } })
    assert.equal((compiled.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, 'the mutant transpiles')
    const mod = { exports: {} }
    const requires = { react: React, 'react/jsx-runtime': jsxRuntime, 'framer-motion': framerMotion(), 'lucide-react': lucideStub(React), '@/lib/build-narration-heuristics': loader.load('lib/build-narration-heuristics.ts'),
      './stage-icons': loader.load('components/build-narration/stage-icons.tsx'), './pause-stop-control': loader.load('components/build-narration/pause-stop-control.tsx'), './motion': loader.load('components/build-narration/motion.ts'), './studio-build-status.css': {} }
    vm.runInContext(`(function (module, exports, require) {${compiled.outputText}\n})`, loader.context, { filename: RIBBON })(mod, mod.exports, spec => { if (!(spec in requires)) throw new Error(`unexpected import ${spec}`); return requires[spec] })
    return { loader, ribbon: mod.exports.StageRibbon, lib: requires['@/lib/build-narration-heuristics'] }
  }
  return { loader, ribbon: loader.load(RIBBON).StageRibbon, lib: loader.load('lib/build-narration-heuristics.ts') }
}

const T = 1_790_000_000_000
const GHOSTS = [0, 1, 2, 3, 4].map(index => ({ index, title: `Slide ${index + 1}`, points: [], slideType: null }))
/** The narration states a build goes through, made by the REAL reducer (and, for the two no reducer action reaches, a restored snapshot). */
function states(lib) {
  const R = lib.narrationReducer, init = lib.initialNarrationState
  const running = R(R(R(init(), { type: 'strawman', ghosts: GHOSTS, ts: T }), { type: 'typed_phase', payload: { build_id: 'b1', phase: 'building', label: 'Building your slides…', slide_count: 5 }, ts: T + 1 }), { type: 'typed_slide_built', payload: { build_id: 'b1', slide_index: 0, slide_count: 5, presentation_id: 'deck' }, ts: T + 2 })
  const paused = R(running, { type: 'control', control: 'paused', ts: T + 3 })
  // the E2E shape: a "building" status after the pause moves the phase back to building; the control stays paused
  const pausedBuilding = R(paused, { type: 'status', status: 'thinking', text: 'Composing 5 slides (v2 path)...', ts: T + 4 })
  const out = {
    running, paused, pausedBuilding,
    'pause asked for': R(running, { type: 'control', control: 'pause_requested', ts: T + 3 }),
    'resume asked for (paused)': R(paused, { type: 'control', control: 'resume_requested', ts: T + 4 }),
    'resumed': R(paused, { type: 'control', control: 'running', ts: T + 4 }),
    stopped: R(running, { type: 'control', control: 'stopped', ts: T + 3 }),
    'stop asked for': R(running, { type: 'control', control: 'stop_requested', ts: T + 3 }),
    failed: R(running, { type: 'typed_phase', payload: { build_id: 'b1', phase: 'error', label: 'Something went wrong', slide_count: 5 }, ts: T + 3 }),
    complete: R(running, { type: 'typed_phase', payload: { build_id: 'b1', phase: 'complete', label: 'Your deck is ready', slide_count: 5 }, ts: T + 3 }),
    'paused in the typed phase': R(running, { type: 'typed_phase', payload: { build_id: 'b1', phase: 'paused', label: 'Paused', slide_count: 5 }, ts: T + 3 }),
    'failed, control paused (restored)': R(init(), { type: 'hydrate', state: { ...running, phase: 'error', phaseLabel: 'Something went wrong', control: 'paused' } }),
  }
  return out
}
const CONTROL = { enabled: true, onPause() {}, onResume() {}, onStop() {} }
const headlineOf = markup => (/<p class="truncate text-sm font-semibold[^"]*"[^>]*>([^<]*)<\/p>/.exec(markup) || [])[1] ?? null
const buttonsOf = markup => [...markup.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map(m => m[1].replace(/<[^>]*>/g, '').trim())
const draw = (w, state) => renderToStaticMarkup(React.createElement(w.ribbon, { narration: state, control: CONTROL }))
async function drawAll(opts) {
  const w = await world(opts), table = states(w.lib), out = {}
  for (const [name, state] of Object.entries(table)) out[name] = { markup: draw(w, state), phase: state.phase, control: state.control }
  return out
}

if (recordBaseline) {
  const baseline = { recorded_from: 'the base tree (studio-v4-dev-preparation-code 14a06c30), flag off', runs: {} }
  for (const shell of [true, false]) { const drawn = await drawAll({ flagOn: false, shell }); for (const [name, d] of Object.entries(drawn)) baseline.runs[`${shell ? 'shell' : 'classic'}|${name}`] = sha(d.markup) }
  release()
  fs.writeFileSync(baselineFile, JSON.stringify(baseline, null, 1) + '\n')
  console.log(`recorded ${Object.keys(baseline.runs).length} flag-off renders from ${root} into ${path.relative(repo, baselineFile)}`)
  process.exit(0)
}

const off = await drawAll({ flagOn: false }), on = await drawAll({ flagOn: true })
const offClassic = await drawAll({ flagOn: false, shell: false }), onClassic = await drawAll({ flagOn: true, shell: false })

console.log('1. the real ribbon and PauseStopControl, states from the real reducer')
await check('the states are what they claim: the E2E shape is a "building" phase with a paused control', () => {
  assert.deepEqual([off.running.phase, off.running.control], ['building', 'running'])
  assert.deepEqual([off.paused.phase, off.paused.control], ['paused', 'paused'])
  assert.deepEqual([off.pausedBuilding.phase, off.pausedBuilding.control], ['building', 'paused'])
  assert.deepEqual([off.stopped.phase, off.stopped.control], ['stopped', 'stopped'])
  assert.deepEqual([off.failed.phase, off.failed.control], ['error', 'running'])
  assert.deepEqual([off['pause asked for'].phase, off['pause asked for'].control], ['building', 'pause_requested'])
  assert.deepEqual([off['failed, control paused (restored)'].phase, off['failed, control paused (restored)'].control], ['error', 'paused'])
})
await check('flag OFF is today\'s defect: a paused control with the "building" phase reads "Building your slides…" next to Resume', () => {
  assert.equal(headlineOf(off.pausedBuilding.markup), 'Building your slides…'); assert.deepEqual(buttonsOf(off.pausedBuilding.markup), ['Resume', 'Stop'])
})
await check('flag ON: the headline reads "Paused" whenever the control is paused (a typed paused phase, the E2E shape, a failed phase with a paused control; a resume asked for from a pause already reads "Paused" from its phase)', () => {
  for (const name of ['paused', 'pausedBuilding', 'resume asked for (paused)', 'paused in the typed phase', 'failed, control paused (restored)']) {
    assert.equal(headlineOf(on[name].markup), 'Paused', name)
  }
})
await check('flag ON: running, a pause asked for, resumed, stopped, a stop asked for, failed and complete read exactly as flag off (the same markup, byte for byte)', () => {
  for (const name of ['running', 'pause asked for', 'resumed', 'stopped', 'stop asked for', 'failed', 'complete']) assert.equal(on[name].markup, off[name].markup, name)
  assert.equal(headlineOf(on.running.markup), 'Building your slides…'); assert.equal(headlineOf(on.stopped.markup), 'Stopped'); assert.equal(headlineOf(on.failed.markup), 'Something went wrong')
})
await check('flag ON changes only the headline\'s words: the icon, timer, "N of M built" count and the buttons (Resume / Stop, the real PauseStopControl) are flag off\'s, in every state', () => {
  for (const name of Object.keys(off)) {
    const a = off[name].markup, b = on[name].markup
    if (a === b) continue
    const wordsA = headlineOf(a), wordsB = headlineOf(b)
    assert.notEqual(wordsA, wordsB, name); assert.equal(wordsB, 'Paused', name)
    assert.equal(b, a.replace(`>${wordsA}</p>`, `>${wordsB}</p>`), `${name}: nothing but the headline's words differs`)
    assert.deepEqual(buttonsOf(b), buttonsOf(a), `${name}: the buttons`)
  }
  assert.match(on.pausedBuilding.markup, /1 of 5 built/); assert.deepEqual(buttonsOf(on.pausedBuilding.markup), ['Resume', 'Stop'])
  assert.deepEqual(buttonsOf(on.paused.markup), ['Resume', 'Stop']); assert.deepEqual(buttonsOf(on.running.markup), ['Pause', 'Stop'])
})
await check('the same without the Studio shell (the classic Builder): flag on is flag off but for the headline, flag off is its own', () => {
  for (const name of Object.keys(offClassic)) {
    const a = offClassic[name].markup, b = onClassic[name].markup
    if (offClassic[name].control === 'paused') { assert.equal(headlineOf(b), 'Paused', name); assert.equal(b, a.replace(`>${headlineOf(a)}</p>`, '>Paused</p>'), name) } else assert.equal(b, a, name)
  }
})

console.log('2. flag off is byte-identical to the base')
const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'))
await check(`every state's flag-off markup (Studio shell and classic) hashes as the base tree's: ${Object.keys(baseline.runs).length} renders`, () => {
  const now = {}
  for (const [name, d] of Object.entries(off)) now[`shell|${name}`] = sha(d.markup)
  for (const [name, d] of Object.entries(offClassic)) now[`classic|${name}`] = sha(d.markup)
  assert.deepEqual(now, baseline.runs)
})
await check('the strip gives the base ribbon back byte for byte (the committed file), and the page / hook / reducer are not touched by this change', () => {
  const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 28 })
  assert.equal(stripPausedLabel(RIBBON, fs.readFileSync(path.join(repo, RIBBON), 'utf8')), git('show', `${BASE_COMMIT}:${RIBBON}`))
  assert.deepEqual(PAUSED_LABEL_FILES, [RIBBON])
})
await check('plumbing: the ribbon reads the literal env name, exact "true"; .env.example documents "false"; the label is the reducer\'s own (phaseLabelFor), no new words', () => {
  const text = read(RIBBON)
  assert.equal((text.match(/NEXT_PUBLIC_STUDIO_PAUSED_LABEL/g) || []).length, 2) // the comment and the read
  assert.match(text, /^  n = process\.env\.NEXT_PUBLIC_STUDIO_PAUSED_LABEL === 'true' && n\.control === 'paused' \? \{ \.\.\.n, phaseLabel: phaseLabelFor\('paused'\) \} : n \/\/ PAUSED-LABEL$/m)
  assert.match(read('.env.example'), new RegExp(`^${FLAG}="false"$`, 'm'))
  assert.equal((read('.env.example').match(new RegExp(FLAG, 'g')) || []).length, 1)
  assert.match(read('lib/build-narration-heuristics.ts'), /^  paused: 'Paused',$/m)
})

console.log('3. mutants')
const mutate = (text, from, to, label) => { const at = text.indexOf(from); if (at === -1 || text.indexOf(from, at + 1) !== -1) throw new Error(`mutant "${label}": target ${JSON.stringify(from.slice(0, 60))} not found exactly once`); return text.replace(from, () => to) }
/** Every expectation above on one mutant's renders (flag on and off): must throw. */
async function mutantChecks(ribbonText) {
  const o = await drawAll({ flagOn: false, ribbonText }), n = await drawAll({ flagOn: true, ribbonText })
  for (const name of ['paused', 'pausedBuilding', 'resume asked for (paused)', 'paused in the typed phase', 'failed, control paused (restored)']) assert.equal(headlineOf(n[name].markup), 'Paused', name)
  for (const name of ['running', 'pause asked for', 'resumed', 'stopped', 'stop asked for', 'failed', 'complete']) assert.equal(n[name].markup, o[name].markup, name)
  assert.equal(headlineOf(o.pausedBuilding.markup), 'Building your slides…', 'flag off is today\'s')
  for (const [name, d] of Object.entries(o)) assert.equal(sha(d.markup), baseline.runs[`shell|${name}`], `flag off ${name}`)
  for (const name of Object.keys(o)) { const a = o[name].markup, b = n[name].markup; if (a !== b) { assert.equal(b, a.replace(`>${headlineOf(a)}</p>`, '>Paused</p>'), name); assert.deepEqual(buttonsOf(b), buttonsOf(a), name) } }
}
const ribbonText = read(RIBBON)
await check('the unmutated ribbon passes the mutant checks (the checks can pass)', async () => { await mutantChecks(ribbonText) })
const mutants = [
  ['the flag is ignored (always on)', "process.env.NEXT_PUBLIC_STUDIO_PAUSED_LABEL === 'true' && n.control === 'paused'", "n.control === 'paused'"],
  ['the flag is read loosely (!== "false"; unset is on)', "process.env.NEXT_PUBLIC_STUDIO_PAUSED_LABEL === 'true'", "process.env.NEXT_PUBLIC_STUDIO_PAUSED_LABEL !== 'false'"],
  ['it keys on the phase, not the control (the E2E shape stays "Building")', "n.control === 'paused' ? {", "n.phase === 'paused' ? {"],
  ['it never fires (the control check is inverted)', "n.control === 'paused' ? {", "n.control !== 'paused' ? {"],
  ['it also fires for a pause asked for', "n.control === 'paused' ? {", "(n.control === 'paused' || n.control === 'pause_requested') ? {"],
  ['it also fires for a stopped control', "n.control === 'paused' ? {", "(n.control === 'paused' || n.control === 'stopped') ? {"],
  ['it also fires whenever the phase is paused or stopped', "n.control === 'paused' ? {", "(n.control === 'paused' || n.phase === 'stopped') ? {"],
  ['the label is new copy (another word)', "phaseLabel: phaseLabelFor('paused')", "phaseLabel: 'On hold'"],
  ['the label is the stopped one', "phaseLabel: phaseLabelFor('paused')", "phaseLabel: phaseLabelFor('stopped')"],
  ['the phase is changed too (the icon and the timer stop)', "{ ...n, phaseLabel: phaseLabelFor('paused') }", "{ ...n, phase: 'paused', phaseLabel: phaseLabelFor('paused') }"],
  ['the count is hidden too', "{ ...n, phaseLabel: phaseLabelFor('paused') }", "{ ...n, slideCount: 0, phaseLabel: phaseLabelFor('paused') }"],
  ['the control is changed too (the buttons change)', "{ ...n, phaseLabel: phaseLabelFor('paused') }", "{ ...n, control: 'running', phaseLabel: phaseLabelFor('paused') }"],
  ['flag off changes today\'s headline (the base path is altered)', "              {n.phaseLabel}\n", "              {n.phaseLabel.toUpperCase()}\n"],
]
for (const [label, from, to] of mutants) await check(`mutant caught: ${label}`, async () => {
  const mutant = mutate(ribbonText, from, to, label)
  await assert.rejects(() => mutantChecks(mutant), undefined, 'the checks must fail on this mutant')
})
await check('mutant caught: an unmarked line added to the ribbon is not stripped (the strip gives the base back only for marked lines)', () => {
  const mutant = mutate(ribbonText, "import { StageIcon } from './stage-icons'\n", "import { StageIcon } from './stage-icons'\nimport { extra } from './extra'\n", 'unmarked')
  assert.notEqual(stripPausedLabel(RIBBON, mutant), stripPausedLabel(RIBBON, ribbonText))
})

console.log('4. scope over the committed diff (BASE..HEAD)')
const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 28 })
const own = git('log', '--format=%H', '--no-merges', '-E', `--grep=^${PAUSED_LABEL_SUBJECT}`, `${BASE_COMMIT}..HEAD`).split('\n').filter(Boolean)
const HEAD = own[0] || git('rev-parse', 'HEAD').trim()
await check(`this change's own commits (subject starts "${PAUSED_LABEL_SUBJECT}") exist, and every non-merge commit between the base and the newest of them is one, with the co-author line`, () => {
  assert.ok(own.length >= 1, 'no own commit yet')
  const all = git('log', '--format=%H', '--no-merges', `${BASE_COMMIT}..${HEAD}`).split('\n').filter(Boolean)
  assert.deepEqual([...all].sort(), [...own].sort(), 'a commit between the base and HEAD is not this change\'s')
  for (const c of own) assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude Sonnet 5\.5 <noreply@anthropic\.com>\s*$/, c.slice(0, 8))
})
await check('the committed files are exactly this change\'s; every line added to an existing file is a pure insertion that carries the marker; the strip gives each its base back byte for byte', () => {
  const changed = git('diff', '--name-only', `${BASE_COMMIT}..${HEAD}`).split('\n').filter(Boolean).filter(rel => PAUSED_LABEL_SCOPE_FILES.has(rel) || !registry.LATER_CHANGE_FILES.has(rel)).sort()
  assert.deepEqual(changed, [...PAUSED_LABEL_SCOPE_FILES].sort())
  for (const rel of PAUSED_LABEL_FILES) {
    const diff = git('diff', '-U0', `${BASE_COMMIT}..${HEAD}`, '--', rel).split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
    assert.equal(diff.length, 4, `${rel}: an import, a two-line comment and the assignment`)
    for (const line of diff) { assert.ok(line.startsWith('+'), `${rel}: a removed line: ${line.slice(0, 120)}`); assert.match(line, PAUSED_LABEL_MARKER_RE, `${rel}: an unmarked added line: ${line.slice(0, 120)}`) }
    assert.equal(stripPausedLabel(rel, git('show', `${HEAD}:${rel}`)), git('show', `${BASE_COMMIT}:${rel}`), `${rel}: without its marked lines the file is the base's, byte for byte`)
  }
  for (const rel of Object.keys(PAUSED_LABEL_PIN_EDITS)) assert.equal(stripPausedLabel(rel, git('show', `${HEAD}:${rel}`)), git('show', `${BASE_COMMIT}:${rel}`), `${rel}: the taught proof`)
  for (const rel of stripModule.PAUSED_LABEL_NEW_FILES) assert.ok(git('cat-file', '-t', `${HEAD}:${rel}`).trim() === 'blob', rel)
})
await check('.env.example is the base plus the block; the registry gains exactly its three marked lines and loses none; no secret-shaped literal in the new files', () => {
  assert.equal(registry.stripLaterEnvBlocks('.env.example', git('show', `${HEAD}:.env.example`)), registry.stripLaterEnvBlocks('.env.example', `${git('show', `${BASE_COMMIT}:.env.example`)}\n${PAUSED_LABEL_ENV_BLOCK}`))
  const diff = git('diff', '-U0', `${BASE_COMMIT}..${HEAD}`, '--', 'scripts/studio-later-changes.mjs').split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
  assert.equal(diff.length, 3); for (const line of diff) assert.ok(line.startsWith('+') && line.includes('LATER-CHANGE') && line.includes('studio-paused-label-strip.mjs'), line.slice(0, 140))
  for (const rel of ['scripts/test-studio-paused-label.mjs', 'scripts/studio-paused-label-strip.mjs']) assert.doesNotMatch(fs.readFileSync(path.join(repo, rel), 'utf8'), /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|xox[bp]-)/, rel)
})

release()
console.log(`\n${failed ? 'FAILED' : 'PASS'}: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
