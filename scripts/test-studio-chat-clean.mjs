// FRONTEND-1 (P3-1 C "chat clean v3"): proof of NEXT_PUBLIC_STUDIO_CHAT_CLEAN (the string "true", default off, build-time).
//   lib/studio-chat-clean.ts (pure decisions), components/builder/chat/studio-chat-clean.tsx (the job card, the notes, the slim bar, the "+" menu, the chips / model button / Stop),
//   components/builder/studio-chat-clean.css, marked lines in chat-input.tsx, message-list.tsx, app/builder/page.tsx, director-presence.tsx and pause-stop-control.tsx, and the .env.example block.
//
//   A. The lib, function by function: the flag, PK's choice tokens, the reader words, the composer table (Send <-> Stop, the slim bar, what Enter does), the job card model and its segments, the notes, the status line.
//   B. The components with real React: the job card (running / held / the trailing stop note), the notes and the user's directions, the slim bar, the "+" menu's trigger, the chips, the model button and Stop; the notes hook on the offline host.
//   C. The sources: every marked line is an insertion that carries the marker, stripping them gives the base's files byte for byte (and through the registry), the two taught proofs put back, the gates,
//      .env.example is the base plus the block, the registry gained its three lines, the committed diff is this change's files, the stylesheet is scoped and near-monochrome, no secrets.
//   D. MUTANTS: every one of them must be caught by A-C.
//
//   node scripts/test-studio-chat-clean.mjs
//
// Offline: no socket, fetch or timer of its own (the harness's host network guard is installed); git is read only for C. Later changes stack on top of this one, so every source, diff and scope
// check reads THIS change's own newest commit (subject "Chat clean: ..."), not HEAD or the working tree.
process.env.NODE_ENV = 'production'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import net from 'node:net'
import dns from 'node:dns'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { installHostNetworkGuard } from './studio-chat-harness/fake-env.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const release = installHostNetworkGuard(net, dns)
let checks = 0
const ok = (condition, message) => { checks++; assert.ok(condition, message) }
const eq = (actual, expected, message) => { checks++; assert.deepEqual(actual, expected, message) }
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
// React and the offline host are loaded AFTER NODE_ENV is set above (a static import would load React's development build first and mismatch the production server renderer).
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { createModuleLoader } = await import('./studio-chat-harness/module-loader.mjs')
const { Root } = await import('./studio-chat-harness/mini-react.mjs')
const postcss = require('postcss')
const strip = await import('./studio-chat-clean-strip.mjs')
const registry = await import('./studio-later-changes.mjs')
const macrotask = () => new Promise(resolve => setImmediate(resolve))
// values built inside the loader's vm have their own Array / Object prototypes: compare them as plain data
const plain = value => JSON.parse(JSON.stringify(value))

const LIB = 'lib/studio-chat-clean.ts'
const COMPONENT = 'components/builder/chat/studio-chat-clean.tsx'
const CSS = 'components/builder/studio-chat-clean.css'
const FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_CLEAN'
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
const OWN = (() => { try { return git('log', '-1', '--format=%H', '--no-merges', '-E', '--grep=^Chat clean', 'HEAD').trim() || git('rev-parse', 'HEAD').trim() } catch { return null } })()
const readOwn = rel => { if (!OWN) return read(rel); try { return git('show', `${OWN}:${rel}`) } catch { return read(rel) } }
const hasBase = (() => { try { git('cat-file', '-e', `${strip.BASE_COMMIT}^{commit}`); return true } catch { return false } })()

// ---- the lib, evaluated in THIS realm with a fake process ----------------------------------------------------------------------------------
function compile(text, fileName) {
  const out = ts.transpileModule(text, { fileName, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, isolatedModules: true } })
  const errors = (out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(`${fileName} does not transpile: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`)
  return out.outputText
}
function loadLib(text = read(LIB), env = { [FLAG]: 'true' }) {
  const module = { exports: {} }
  new Function('module', 'exports', 'require', 'process', compile(text, LIB))(module, module.exports, () => { throw new Error('the lib must stay import-free') }, { env })
  return module.exports
}

// ============================================================================================================================================
// A. The lib
// ============================================================================================================================================
function libSuite(libText = read(LIB)) {
  const lib = loadLib(libText)
  // -- the flag -----------------------------------------------------------------------------------------------------------------------
  for (const [value, want] of [[undefined, false], ['false', false], ['TRUE', false], ['1', false], [' true', false], ['true', true]]) eq(lib.chatCleanFlagOn(value), want, `flag ${JSON.stringify(value)}`)
  eq(loadLib(libText, {}).STUDIO_CHAT_CLEAN_ENABLED, false, 'unset: off'); eq(loadLib(libText, { [FLAG]: 'true' }).STUDIO_CHAT_CLEAN_ENABLED, true, '"true": on'); eq(loadLib(libText, { [FLAG]: 'yes' }).STUDIO_CHAT_CLEAN_ENABLED, false, '"yes": off')
  // -- PK's choices, one token each, as the column's attributes --------------------------------------------------------------------------
  eq({ ...lib.CHAT_CLEAN_CHOICES }, { accent: 'graphite', stop: 'ink', stoppedDraftPrimary: 'send', directorLabel: 'none', userBox: 'tint', research: 'menu' }, 'v3 / v3.1 defaults')
  ok(Object.isFrozen(lib.CHAT_CLEAN_CHOICES), 'the choices are frozen')
  eq(lib.chatCleanRootAttributes(), { 'data-studio-chat-clean': 'v3', 'data-studio-chat-clean-accent': 'graphite', 'data-studio-chat-clean-stop-colour': 'ink', 'data-studio-chat-clean-primary': 'send', 'data-studio-chat-clean-label': 'none', 'data-studio-chat-clean-user': 'tint', 'data-studio-chat-clean-research': 'menu' }, 'root attributes')
  eq(lib.chatCleanRootAttributes({ ...lib.CHAT_CLEAN_CHOICES, accent: 'violet', userBox: 'neutral' })['data-studio-chat-clean-accent'], 'violet', 'a changed token reaches the attribute')
  eq(lib.CHAT_CLEAN_TEXTAREA_MIN_HEIGHT, 40, 'the box starts one line tall')
  // -- the reader words -------------------------------------------------------------------------------------------------------------------
  eq([lib.chatCleanSlidesKept(0), lib.chatCleanSlidesKept(1), lib.chatCleanSlidesKept(4), lib.chatCleanSlidesKept(-2), lib.chatCleanSlidesKept(Number.NaN)], ['no slide finished yet', 'slide 1 kept', 'slides 1–4 kept', 'no slide finished yet', 'no slide finished yet'], 'slides kept')
  eq([lib.chatCleanHeldAt('stopped', 4, 10), lib.chatCleanHeldAt('stopped', 10, 10), lib.chatCleanHeldAt('paused', 0, 10), lib.chatCleanHeldAt('stopped', 3, 0)], ['Stopped at slide 5', 'Stopped after the last slide', 'Paused at slide 1', 'Stopped at slide 4'], 'held at')
  eq([lib.chatCleanDirectionsFrom(4, 10), lib.chatCleanDirectionsFrom(10, 10), lib.chatCleanDirectionsFrom(3, 0), lib.chatCleanDirectionsFrom(0, 0)], [5, 10, 4, 1], 'directions from')
  eq([lib.chatCleanElapsed(null, 5000), lib.chatCleanElapsed(1000, 63000), lib.chatCleanElapsed(5000, 1000), lib.chatCleanElapsed(0, 600000)], [null, '1:02', '0:00', '10:00'], 'elapsed')
  // -- the composer: Send <-> Stop, the slim bar, what Enter does ----------------------------------------------------------------------------
  const base = { enabled: true, active: true, phase: 'building', control: 'running', slidesDone: 4, slideCount: 10, controlEnabled: true, amendOn: true, instructionsOn: true, amendKey: null, amendLine: '' }
  const state = over => lib.chatCleanComposerState({ ...base, ...over })
  const idle = state({ enabled: false })
  eq(idle, { mode: 'idle', showStop: false, stopEnabled: false, barText: null, barDetail: null, showContinue: false, continueEnabled: false, sendMode: 'message', placeholder: null, hint: null, directionsFrom: null, context: null }, 'disabled: idle, nothing of the base changes')
  for (const over of [{ active: false }, { phase: 'complete' }, { phase: 'error' }, { phase: 'idle' }, { phase: 'awaiting_user' }, { controlEnabled: false }]) eq(state(over).mode, 'idle', `idle: ${JSON.stringify(over)}`)
  const running = state({})
  eq([running.mode, running.showStop, running.stopEnabled, running.sendMode, running.placeholder, running.hint, running.barText, running.showContinue], ['running', true, true, 'message', 'Stop to give new directions…', 'Stop keeps the finished slides · then continue, or send new directions', null, false], 'running: Send is Stop, Enter is the base')
  for (const phase of ['planning', 'strawman', 'qa', 'finalizing']) eq(state({ phase }).mode, 'running', `running through ${phase}`)
  eq(state({ amendKey: 'applied', amendLine: 'Applied to slides 5–8.' }).hint, 'Applied to slides 5–8.', 'running: Director\'s applied line is the hint while it shows')
  eq(state({ amendKey: 'not_applied', amendLine: 'x' }).sendMode, 'rebuild', 'running: changes that could not be applied go by the rebuild path')
  eq(state({ amendKey: 'not_applied', amendLine: 'x', amendOn: false }).sendMode, 'message', '...only with the flow hook live')
  const stopping = state({ control: 'stop_requested' })
  eq([stopping.mode, stopping.showStop, stopping.stopEnabled, stopping.placeholder, stopping.hint, stopping.sendMode], ['stopping', true, false, 'Stopping…', 'Stopping the build · the finished slides are kept', 'message'], 'stopping')
  const held = state({ control: 'stopped', phase: 'stopped' })
  eq(held, { mode: 'held', showStop: false, stopEnabled: false, barText: 'Stopped at slide 5', barDetail: 'slides 1–4 kept', showContinue: true, continueEnabled: true, sendMode: 'instructions', placeholder: 'New directions from slide 5…', hint: 'Enter sends new directions from slide 5 · Continue resumes as planned', directionsFrom: 5, context: 'New directions apply from slide 5' }, 'held: the slim bar, Continue, Enter sends directions')
  eq(state({ control: 'stopped', phase: 'stopped', controlEnabled: false }).continueEnabled, false, 'held without the control flag: Continue cannot send')
  eq(state({ control: 'stopped', instructionsOn: false }).sendMode, 'rebuild', 'held without the instructions flag: the rebuild path')
  eq(state({ control: 'stopped', instructionsOn: false }).hint, 'Enter rebuilds from slide 5 with your directions · Continue resumes as planned', '...and its hint')
  eq(state({ control: 'stopped', instructionsOn: false, amendOn: false }).sendMode, 'message', 'held without the flow hook: an ordinary message')
  eq(state({ control: 'stopped', instructionsOn: false, amendOn: false }).hint, 'Continue resumes as planned · slides 1–4 kept', '...and its hint')
  eq(state({ control: 'stopped', amendKey: 'not_applied', amendLine: 'x' }).sendMode, 'rebuild', 'held after a not-applied acknowledgement: the rebuild path even with instructions on')
  eq(state({ control: 'paused', phase: 'paused' }).barText, 'Paused at slide 5', 'paused reads as paused')
  eq(state({ control: 'running', phase: 'stopped' }).mode, 'held', 'the phase alone says stopped')
  eq(state({ control: 'stopped', slidesDone: 10 }).barText, 'Stopped after the last slide', 'stopped after the last slide')
  const resuming = state({ control: 'resume_requested', phase: 'stopped' })
  eq([resuming.mode, resuming.barText, resuming.showContinue, resuming.continueEnabled, resuming.sendMode, resuming.placeholder], ['resuming', 'Resuming', true, false, 'wait', 'Resuming…'], 'resuming: Continue waits, Enter waits')
  const rebuilding = state({ control: 'stopped', amendKey: 'rebuilding', amendLine: 'Rebuilding once the last slide finishes…' })
  eq([rebuilding.mode, rebuilding.barText, rebuilding.showContinue, rebuilding.sendMode, rebuilding.showStop], ['rebuilding', 'Rebuilding once the last slide finishes…', false, 'wait', false], 'rebuilding: the bar says so, nothing else to do')
  // -- the job card ---------------------------------------------------------------------------------------------------------------------
  const seg = (phase, control = 'running', done = 4, count = 10) => lib.chatCleanJobSegments({ phase, control, slidesDone: done, slideCount: count }).map(s => s.state)
  eq(seg('planning'), ['now', 'todo', 'todo', 'todo', 'todo'], 'segments: planning')
  eq(seg('strawman'), ['done', 'now', 'todo', 'todo', 'todo'], 'segments: strawman')
  eq(seg('awaiting_user'), ['done', 'now', 'todo', 'todo', 'todo'], 'segments: waiting at the outline')
  eq(seg('building'), ['done', 'done', 'now', 'todo', 'todo'], 'segments: building')
  eq(seg('qa'), ['done', 'done', 'done', 'now', 'todo'], 'segments: checking')
  eq(seg('finalizing'), ['done', 'done', 'done', 'done', 'now'], 'segments: packaging')
  eq(seg('complete'), ['done', 'done', 'done', 'done', 'done'], 'segments: done')
  eq(seg('error'), ['todo', 'todo', 'todo', 'todo', 'todo'], 'segments: error shows no progress')
  eq(seg('stopped', 'stopped'), ['done', 'done', 'held', 'todo', 'todo'], 'segments: stopped holds Build')
  eq(seg('building', 'paused'), ['done', 'done', 'held', 'todo', 'todo'], 'segments: paused holds Build')
  eq(lib.chatCleanJobSegments({ phase: 'building', control: 'running', slidesDone: 4, slideCount: 10 })[2].fill, 0.4, 'the Build segment follows the tally')
  eq(lib.chatCleanJobSegments({ phase: 'building', control: 'running', slidesDone: 0, slideCount: 10 })[2].fill, 0.1, '...never empty while it is current')
  eq(lib.chatCleanJobSegments({ phase: 'planning', control: 'running', slidesDone: 0, slideCount: 0 })[0].fill, 0.4, '...a plain 40% elsewhere')
  const job = over => lib.chatCleanJobModel({ phase: 'building', control: 'running', phaseLabel: 'Building your slides…', slidesDone: 4, slideCount: 10, latestEventText: 'Rendering the revenue chart for slide 4', latestEventStatus: 'progress', ...over })
  const building = job({})
  eq([building.title, building.icon, building.tally, building.halted, building.clockFrozen, building.line], ['Building slides', 'brush', '4 of 10', false, false, 'Rendering the revenue chart for slide 4'], 'job: building')
  const stopped = job({ phase: 'stopped', control: 'stopped' })
  eq([stopped.title, stopped.icon, stopped.tally, stopped.halted, stopped.clockFrozen, stopped.line], ['Stopped', 'stop', '4 of 10 built', true, true, 'Stopped while working on slide 5.'], 'job: stopped')
  eq([job({ control: 'paused' }).title, job({ control: 'paused' }).icon, job({ control: 'paused' }).line], ['Paused', 'pause', 'Paused before slide 5.'], 'job: paused')
  eq([job({ control: 'stop_requested' }).title, job({ control: 'stop_requested' }).clockFrozen], ['Stopping', true], 'job: stopping freezes the clock')
  eq(job({ control: 'resume_requested', phase: 'stopped' }).title, 'Resuming', 'job: resuming')
  eq([job({ phase: 'planning', latestEventText: null }).title, job({ phase: 'planning', latestEventText: null }).tally, job({ phase: 'planning', latestEventText: null }).line], ['Planning your deck', null, 'Building your slides…'], 'job: planning falls back to Director\'s label')
  eq([job({ phase: 'strawman' }).icon, job({ phase: 'awaiting_user' }).title, job({ phase: 'awaiting_user' }).clockFrozen, job({ phase: 'qa' }).title, job({ phase: 'finalizing' }).title], ['list', 'Waiting for you', true, 'Checking slides', 'Packaging the deck'], 'job: the other phases')
  eq([job({ phase: 'complete', slidesDone: 10 }).title, job({ phase: 'complete', slidesDone: 10 }).icon, job({ phase: 'complete', slidesDone: 10 }).tally, job({ phase: 'complete' }).clockFrozen], ['Deck ready', 'check', '10 of 10', true], 'job: complete')
  eq([job({ phase: 'error', latestEventText: 'Image generation failed', latestEventStatus: 'error' }).line, job({ phase: 'error', latestEventText: 'last progress', latestEventStatus: 'progress', phaseLabel: 'Something went wrong' }).line, job({ phase: 'error' }).icon], ['Image generation failed', 'Something went wrong', 'alert'], 'job: error shows the error event, never a stale progress line')
  eq(job({ latestEventText: null, phaseLabel: '' }).line, 'Building slides', 'job: no event and no label: the title')
  // -- the notes ----------------------------------------------------------------------------------------------------------------------------
  const snap = over => ({ active: true, buildId: 'b1', phase: 'building', control: 'running', slidesDone: 4, slideCount: 10, ...over })
  const reduce = (notes, prev, next, amend) => lib.chatCleanNotesReduce(notes, prev, next, 1000, amend)
  eq(reduce([], null, snap({})), [], 'notes: a running build adds nothing')
  eq(reduce([], snap({}), snap({ active: false })), [], 'notes: an inactive narration adds nothing')
  const afterStop = reduce([], snap({}), snap({ control: 'stopped', phase: 'stopped' }))
  eq(afterStop.map(n => [n.kind, n.text, n.at, n.buildId]), [['stopped', 'Stopped at slide 5 · slides 1–4 kept', 1000, 'b1']], 'notes: a stop')
  eq(reduce(afterStop, snap({ control: 'stopped', phase: 'stopped' }), snap({ control: 'stopped', phase: 'stopped' })), afterStop, 'notes: the same held state again adds nothing')
  eq(reduce([], snap({}), snap({ control: 'paused' })).map(n => n.kind), ['paused'], 'notes: a pause')
  eq(reduce([], snap({}), snap({ phase: 'stopped' })).map(n => n.kind), ['stopped'], 'notes: the phase alone says stopped')
  const afterResume = reduce(afterStop, snap({ control: 'stopped', phase: 'stopped' }), snap({}))
  eq(afterResume.map(n => [n.kind, n.text]), [['stopped', 'Stopped at slide 5 · slides 1–4 kept'], ['resumed', 'Resumed · building from slide 5']], 'notes: a resume')
  eq(reduce(afterStop, snap({ control: 'stopped', phase: 'stopped' }), snap({}), { key: 'applied', line: 'Applied to slides 5–8.' }).map(n => n.text)[1], 'Resumed · new directions applied to slides 5–8', 'notes: a resume whose acknowledgement names the slides')
  const applied = reduce(afterResume, snap({}), snap({}), { key: 'applied', line: 'Applied to slides 5–8.' })
  eq(applied.map(n => n.text), ['Stopped at slide 5 · slides 1–4 kept', 'Resumed · new directions applied to slides 5–8'], 'notes: an acknowledgement after the resume completes the resume note')
  eq(reduce(applied, snap({}), snap({}), { key: 'applied', line: 'Applied to slides 5–8.' }), applied, 'notes: the same acknowledgement again adds nothing')
  eq(reduce([], snap({}), snap({}), { key: 'applied', line: 'Applied to slide 4.' }).map(n => [n.kind, n.text]), [['applied', 'New directions applied to slide 4']], 'notes: an acknowledgement with no resume note of its own')
  const notApplied = reduce(afterResume, snap({}), snap({}), { key: 'not_applied', line: "These changes couldn't be applied." })
  eq(notApplied.map(n => n.kind), ['stopped', 'resumed', 'not_applied'], 'notes: not applied, in Director\'s words')
  eq(reduce(notApplied, snap({}), snap({}), { key: 'not_applied', line: "These changes couldn't be applied." }), notApplied, 'notes: not applied, once')
  eq(reduce(afterStop, snap({ control: 'stopped', phase: 'stopped', buildId: 'b0' }), snap({})).map(n => n.kind), ['stopped'], 'notes: another build running is not a resume of this one')
  const many = Array.from({ length: 45 }, (_, i) => ({ id: `n${i}`, kind: 'stopped', text: 't', at: i, buildId: 'b1' }))
  eq(reduce(many, snap({}), snap({ control: 'stopped' })).length, lib.CHAT_CLEAN_NOTES_MAX, 'notes: capped')
  eq(lib.chatCleanDirectionsNote([], '  Shorter titles  ', 'b1', 7).map(n => [n.kind, n.text, n.at, n.buildId]), [['directions', 'Shorter titles', 7, 'b1']], 'notes: the user\'s directions')
  eq(lib.chatCleanDirectionsNote(afterStop, '   ', 'b1', 7), afterStop, 'notes: empty directions add nothing')
  eq([lib.chatCleanAppliedPhrase('Applied to slides 5–8.'), lib.chatCleanAppliedPhrase('Applied to slide 4.'), lib.chatCleanAppliedPhrase('Applied to slides 4, 6 and 9.'), lib.chatCleanAppliedPhrase("These changes couldn't be applied to slides already in progress — use Rebuild to apply them."), lib.chatCleanAppliedPhrase('')], ['new directions applied to slides 5–8', 'new directions applied to slide 4', 'new directions applied to slides 4, 6 and 9', null, null], 'the applied phrase')
  // -- Director's status line --------------------------------------------------------------------------------------------------------------
  eq([lib.chatCleanStatusLine(true, { status: 'thinking', text: 'x' }), lib.chatCleanStatusLine(false, null), lib.chatCleanStatusLine(false, { status: 'thinking', text: 'Reading the brief' }), lib.chatCleanStatusLine(false, { status: 'generating', text: ' ' }), lib.chatCleanStatusLine(false, { status: 'complete', text: 'Done' })], [null, null, 'Reading the brief', 'Working on it…', null], 'the status line')
  return lib
}

// ============================================================================================================================================
// B. The components, with real React (through the chat harness loader: `@/` from the repo, packages from node_modules, css stubbed)
// ============================================================================================================================================
function makeLoader(env = {}, overrides = {}) {
  const fsReal = fs.readFileSync
  // in-memory mutations: the loader reads from disk, so a mutated file is served from here
  const loader = createModuleLoader({
    root,
    globals: { process: { env: { NODE_ENV: 'production', ...env } }, console, setTimeout, clearTimeout, setInterval, clearInterval, Date, Symbol, Promise, Math, JSON, Object, Array, Error, Map, Set, Number, String, Boolean, RegExp, TextEncoder, TextDecoder, URL, queueMicrotask },
  })
  if (Object.keys(overrides).length) {
    // the loader's own fs read is the module's; patch for the duration of the loads below
    fs.readFileSync = function (file, ...rest) { const rel = typeof file === 'string' ? path.relative(root, file) : null; return rel && rel in overrides ? overrides[rel] : fsReal.call(fs, file, ...rest) }
  }
  return { loader, restore: () => { fs.readFileSync = fsReal } }
}
function withOverrides(overrides, fn) {
  const { loader, restore } = makeLoader({}, overrides)
  try { return fn(loader) } finally { restore() }
}
const html = element => renderToStaticMarkup(element)
const count = (markup, needle) => markup.split(needle).length - 1

async function componentSuite(overrides = {}) {
  const { loader, restore } = makeLoader({}, overrides)
  let mod, lib
  try { mod = loader.load(COMPONENT); lib = loader.load(LIB) } finally { restore() }
  const narration = over => ({ active: true, buildId: 'b1', phase: 'building', control: 'running', slidesDone: 4, slideCount: 10, phaseLabel: 'Building your slides…', startedAt: Date.now() - 102000, deckEvents: [{ text: 'Planning', status: 'done' }, { text: 'Rendering the revenue chart for slide 4', status: 'progress' }], ...over })
  const composer = over => lib.chatCleanComposerState({ enabled: true, active: true, phase: 'building', control: 'running', slidesDone: 4, slideCount: 10, controlEnabled: true, amendOn: true, instructionsOn: true, amendKey: null, amendLine: '', ...over })
  const note = (kind, text, i = 0) => ({ id: `${kind}${i}`, kind, text, at: i, buildId: 'b1' })

  // -- the job card -----------------------------------------------------------------------------------------------------------------------
  const job = (props) => html(React.createElement(mod.StudioChatCleanJob, props))
  eq(job({ narration: narration({ active: false, phase: 'idle' }), notes: [], composer: composer({ active: false }) }), '', 'job: nothing when no build and no status')
  const status = job({ narration: narration({ active: false, phase: 'idle' }), notes: [], composer: composer({ active: false }), currentStatus: { status: 'thinking', text: 'Reading your brief' } })
  ok(status.includes('data-studio-chat-clean-status="true"') && status.includes('Reading your brief') && status.includes('role="status"'), 'job: Director\'s one status line when no build runs')
  const running = job({ narration: narration({}), notes: [], composer: composer({}) })
  ok(running.includes('data-studio-chat-clean-job="building"'), 'job: the card carries the phase')
  ok(running.includes('<h3>') && running.includes('Building slides') && running.includes('4 of 10 · 1:42'), 'job: title and tally with the elapsed clock')
  eq(count(running, 'data-studio-chat-clean-step='), 5, 'job: five segments')
  ok(running.includes('data-studio-chat-clean-step="done"') && running.includes('data-studio-chat-clean-step="now"') && running.includes('--scc-fill:40%'), 'job: done / now and the Build fill')
  ok(running.includes('Rendering the revenue chart for slide 4') && !running.includes('>Planning<'), 'job: the newest line only')
  const heldNotes = [note('stopped', 'Stopped at slide 3 · slides 1–2 kept', 1), note('resumed', 'Resumed · building from slide 3', 2), note('stopped', 'Stopped at slide 5 · slides 1–4 kept', 3)]
  const held = job({ narration: narration({ phase: 'stopped', control: 'stopped' }), notes: heldNotes, composer: composer({ control: 'stopped', phase: 'stopped' }) })
  ok(held.includes('data-studio-chat-clean-job="held"') && held.includes('>Stopped<') && held.includes('4 of 10 built') && held.includes('data-studio-chat-clean-step="held"'), 'job: the held card')
  ok(held.includes('Stopped at slide 3') && held.includes('Resumed · building from slide 3') && !held.includes('Stopped at slide 5'), 'job: while held the newest stop note stays out (the slim bar carries it)')
  const resumed = job({ narration: narration({}), notes: heldNotes, composer: composer({}) })
  ok(resumed.includes('Stopped at slide 5'), 'job: once running again the stop note shows as the record')
  eq(count(resumed, 'data-studio-chat-clean-note="stopped"'), 2, 'job: the notes carry their kind'); eq(count(resumed, 'data-studio-chat-clean-note="resumed"'), 1, 'job: ...')
  const directions = job({ narration: narration({}), notes: [note('directions', 'Skip the image on slide 3 — use a quote card instead.')], composer: composer({}) })
  ok(directions.includes('data-studio-chat-clean-directions="true"') && directions.includes('Skip the image on slide 3') && !directions.includes('data-studio-chat-clean-note='), 'job: the user\'s directions are their own box')
  ok(job({ narration: narration({ phase: 'error' }), notes: [], composer: composer({ phase: 'error' }) }).includes('data-studio-chat-clean-job="error"'), 'job: the error card')
  // -- the slim bar -------------------------------------------------------------------------------------------------------------------------
  const bar = (state, onContinue = () => {}) => html(React.createElement(mod.StudioChatCleanBar, { composer: state, onContinue }))
  eq(bar(composer({})), '', 'bar: nothing while the build runs')
  const heldBar = bar(composer({ control: 'stopped', phase: 'stopped' }))
  ok(heldBar.includes('data-studio-chat-clean-bar="held"') && heldBar.includes('<b>Stopped at slide 5</b>') && heldBar.includes('slides 1–4 kept') && heldBar.includes('data-studio-chat-clean-continue="true"') && !heldBar.includes('disabled'), 'bar: held, with Continue')
  ok(bar(composer({ control: 'stopped', phase: 'stopped', controlEnabled: false })).includes('disabled=""'), 'bar: Continue cannot send without the control flag')
  const resumingBar = bar(composer({ control: 'resume_requested', phase: 'stopped' }))
  ok(resumingBar.includes('data-studio-chat-clean-bar="resuming"') && resumingBar.includes('disabled=""'), 'bar: resuming, Continue waits')
  const rebuildingBar = bar(composer({ control: 'stopped', amendKey: 'rebuilding', amendLine: 'Rebuilding once the last slide finishes…' }))
  ok(rebuildingBar.includes('data-studio-chat-clean-bar="rebuilding"') && !rebuildingBar.includes('<button'), 'bar: rebuilding, nothing to press')
  // -- the send side (v3.1: the research options live in the composer's own button, moved next to Send by the stylesheet; no chips, no "+" menu) ----
  const research = { deep: false, onDeep: () => {}, web: true, onWeb: () => {}, locked: false }
  ok(!('StudioChatCleanPlus' in mod), 'no "+" menu (v3.1): the composer keeps its attach / template / theme buttons')
  const side = html(React.createElement(mod.StudioChatCleanSendSide, { composer: composer({}), onStop: () => {}, research, picker: { sessionId: 'sess-1', disabled: false } }))
  ok(!side.includes('data-studio-chat-clean-toggle'), 'side: no research chips (CHAT_CLEAN_CHOICES.research = menu): the research options button holds the switches')
  ok(side.includes('data-studio-chat-clean-stop="true"') && side.includes('aria-label="Stop building"') && !side.includes('cursor'), 'side: Stop while the build runs')
  ok(!side.includes('mpick-chip'), 'side: the model picker renders nothing without NEXT_PUBLIC_STUDIO_MODEL_CHOICE')
  const sideHeld = html(React.createElement(mod.StudioChatCleanSendSide, { composer: composer({ control: 'stopped' }), onStop: () => {}, research: { ...research, locked: true }, picker: { sessionId: null, disabled: true } }))
  eq(sideHeld, '', 'side: no Stop while held, and nothing else without the model flag')
  const stopping = html(React.createElement(mod.StudioChatCleanSendSide, { composer: composer({ control: 'stop_requested' }), onStop: () => {}, research, picker: { sessionId: null, disabled: false } }))
  ok(stopping.includes('data-studio-chat-clean-stop="true"') && stopping.includes('disabled=""'), 'side: Stop waits for the acknowledgement')
  // the picker with its flag on: the chip, with the class the stylesheet turns into an icon
  const { loader: onLoader, restore: onRestore } = makeLoader({ NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true' }, overrides)
  let onMod
  try { onMod = onLoader.load(COMPONENT) } finally { onRestore() }
  const sideOn = html(React.createElement(onMod.StudioChatCleanSendSide, { composer: composer({}), onStop: () => {}, research, picker: { sessionId: 'sess-1', disabled: false } }))
  ok(sideOn.includes('mpick-gauge studio-chat-clean-model') && sideOn.includes('aria-label="Model:') && sideOn.includes('mpick-gauge-icon'), 'side: with the model flag FRONTEND-2\'s gauge button stands before Stop, named')
  return { mod, lib }
}

// -- the notes hook on the offline host --------------------------------------------------------------------------------------------------
async function hookSuite(overrides = {}) {
  const { loader, restore } = makeLoader({}, overrides)
  let mod
  try { mod = loader.load(COMPONENT) } finally { restore() }
  const p = { enabled: true, sessionKey: 'sess-1', narration: { active: true, buildId: 'b1', phase: 'building', control: 'running', slidesDone: 4, slideCount: 10 }, amend: { key: null, line: '' } }
  let latest = null
  function Page() { latest = mod.useStudioChatCleanNotes({ ...p, narration: { ...p.narration }, amend: { ...p.amend } }); return null }
  const rootNode = new Root()
  rootNode.setElement(React.createElement(Page))
  const settle = async () => { for (let quiet = 0, rounds = 0; quiet < 2; rounds++) { if (rounds > 80) throw new Error('did not settle'); await macrotask(); quiet = rootNode.flush() ? 0 : quiet + 1 } }
  await settle()
  const set = async patch => { Object.assign(p, patch); rootNode.schedule(); await settle() }
  eq(plain(latest.notes), [], 'hook: nothing at rest')
  await set({ narration: { ...p.narration, control: 'stopped', phase: 'stopped' } })
  eq(plain(latest.notes.map(n => n.text)), ['Stopped at slide 5 · slides 1–4 kept'], 'hook: a stop lands as a note')
  latest.addDirections('  Shorter titles ')
  await settle()
  eq(plain(latest.notes.map(n => n.kind)), ['stopped', 'directions'], 'hook: the user\'s directions are kept')
  await set({ narration: { ...p.narration, control: 'running', phase: 'building' }, amend: { key: 'applied', line: 'Applied to slides 5–8.' } })
  eq(plain(latest.notes.map(n => n.text).slice(-1)), ['Resumed · new directions applied to slides 5–8'], 'hook: the resume, with Director\'s slides')
  await set({ sessionKey: 'sess-2' })
  eq(plain(latest.notes), [], 'hook: another session starts clean')
  await set({ narration: { ...p.narration, control: 'stopped', phase: 'stopped' }, amend: { key: null, line: '' } })
  eq(latest.notes.length, 1, 'hook: ...and keeps recording')
  await set({ enabled: false })
  eq(plain(latest.notes), [], 'hook: disabled, nothing is kept or returned')
  latest.addDirections('x'); await settle()
  eq(plain(latest.notes), [], 'hook: disabled, directions are dropped')
  rootNode.unmount()
}

// ============================================================================================================================================
// C. The sources
// ============================================================================================================================================
function sourceSuite(over = {}) {
  const src = rel => rel in over ? over[rel] : readOwn(rel)
  const stripModule = over.strip ?? strip
  const marker = stripModule.CHAT_CLEAN_MARKER_RE
  // -- the marked files: insertions only, every added line marked, stripping gives the base ------------------------------------------------
  for (const rel of stripModule.CHAT_CLEAN_FILES) {
    const now = src(rel)
    const marked = now.split('\n').filter(line => marker.test(line))
    ok(marked.length > 0, `${rel}: carries marked lines`)
    if (hasBase && OWN) {
      const base = git('show', `${stripModule.BASE_COMMIT}:${rel}`)
      eq(stripModule.stripChatClean(rel, now), base, `${rel}: without this change's lines it is the base, byte for byte`)
      eq(registry.stripLaterChanges(rel, now), registry.stripLaterChanges(rel, base), `${rel}: ...and through the registry (both sides: other registered changes strip their own lines from the same files)`)
      const diff = git('diff', '--unified=0', stripModule.BASE_COMMIT, OWN, '--', rel).split('\n').filter(line => /^[-+]/.test(line) && !/^(---|\+\+\+)/.test(line))
      eq(diff.filter(line => line.startsWith('-')), [], `${rel}: no existing line is rewritten`)
      ok(diff.length > 0 && diff.every(line => marker.test(line)), `${rel}: every added line carries the marker`)
    }
    ok(!/CHAT-CLEAN-|-CHAT-CLEAN/.test(now), `${rel}: the marker is never part of a longer token`)
  }
  // -- the gates ----------------------------------------------------------------------------------------------------------------------------
  const presence = src('components/build-narration/director-presence.tsx').split('\n').find(line => marker.test(line))
  ok(/studioShell && process\.env\.NEXT_PUBLIC_STUDIO_CHAT_CLEAN === 'true'\) return null/.test(presence), 'director-presence: hidden only with the flag and the Studio shell, reading process.env itself')
  const pause = src('components/build-narration/pause-stop-control.tsx').split('\n').find(line => marker.test(line))
  ok(/NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process\.env\.NEXT_PUBLIC_STUDIO_CHAT_CLEAN === 'true'\) return null/.test(pause), 'pause-stop-control: hidden only with the flag and the Studio shell')
  const page = src('app/builder/page.tsx')
  const pageLines = page.split('\n')
  const firstMarked = pageLines.findIndex(line => marker.test(line)), flowHook = pageLines.findIndex(line => line.includes('useStudioFlowControl({'))
  ok(flowHook >= 0 && firstMarked > flowHook, 'page: nothing of this change comes before the flow hook (after the Builder\'s runners)')
  ok(pageLines.filter(line => marker.test(line) && /^import /.test(line)).every(line => pageLines.indexOf(line) > pageLines.findIndex(line => line.includes("from '@/hooks/use-studio-flow-control'"))), 'page: the imports sit at the end, with the flow import')
  ok(/const chatCleanShell = STUDIO_CHAT_CLEAN_ENABLED && studioShell/.test(page) && /const chatCleanOn = chatCleanShell && effectiveBuildNarrationEnabled/.test(page), 'page: gated on the flag, the shell and the narration')
  ok(/sendBuildControl\('stop', buildNarration\.buildId \?\? undefined\)/.test(page) && /markNarrationControl\('stop_requested'/.test(page), 'page: Stop is the existing build control')
  ok(/sendBuildControl\('resume', buildNarration\.buildId \?\? undefined\)/.test(page) && /markNarrationControl\('resume_requested'/.test(page), 'page: Continue is the existing resume')
  ok(/sendMode === 'instructions'\) \{ chatCleanNotes\.addDirections\(text\); flowControl\.resume\(\) \}/.test(page) && /sendMode === 'rebuild'\) flowControl\.rebuild\(\)/.test(page), 'page: new directions go through the flow hook')
  ok(page.includes("{...(chatCleanShell ? chatCleanRootAttributes() : {})") && page.includes('{...(chatCleanShell ? { studioChatClean: { narration: buildNarration') && page.includes('{...(chatCleanShell ? { studioChatClean: { composer: chatCleanComposer, onStop: chatCleanStop'), 'page: the column attributes and the two props travel in spreads that are empty with the flag off')
  ok(page.includes('{chatCleanOn ? <StudioChatCleanBar composer={chatCleanComposer} onContinue={chatCleanContinue} /> : null}'), 'page: the slim bar')
  const input = src('components/builder/chat-input.tsx')
  ok(/const chatClean = STUDIO_CHAT_CLEAN_ENABLED && studio \? studioChatClean \?\? null : null/.test(input), 'chat-input: gated on the flag, the shell and the prop')
  ok(/const TEXTAREA_MIN_HEIGHT = STUDIO_CHAT_CLEAN_ENABLED && studio \? CHAT_CLEAN_TEXTAREA_MIN_HEIGHT : 96/.test(input), 'chat-input: the box height shadows the base\'s 96 only under the flag')
  ok(/if \(chatClean && chatClean\.composer\.sendMode !== 'message'\) \{ e\?\.preventDefault\(\);/.test(input), 'chat-input: Enter is intercepted only for the directions modes')
  ok(input.includes('{...chatCleanPlaceholder /* CHAT-CLEAN */}') && input.includes("{...(chatClean ? { 'data-studio-chat-clean-composer': chatClean.composer.mode"), 'chat-input: the placeholder and the mode attribute are spreads')
  ok(input.includes('research={chatCleanResearch}') && /deep: researchEnabled, onDeep: onResearchEnabledChange, web: webSearchEnabled, onWeb: onWebSearchEnabledChange, locked: researchSettingsLocked/.test(input), 'chat-input: the study\'s chips are bound to the existing research props')
  ok(input.includes("'data-studio-chat-clean-research-on': researchEnabled || webSearchEnabled || knowledgeGraphEnabled ? 'true' : 'false'"), 'chat-input: the dot on the research button reads the three existing switches')
  ok(!/StudioChatCleanPlus|data-studio-chat-clean-plus/.test(input), 'chat-input: no "+" menu (v3.1)')
  ok(input.includes('{chatClean ? <span data-studio-chat-clean-menu="research" hidden /> : null}'), 'chat-input: the research menu carries a marker only under the flag (the eyebrow is styled through it)')
  ok(input.includes('{chatClean?.composer.context ? <div data-studio-chat-context="true" data-studio-chat-clean-context="true"><span>{chatClean.composer.context}</span></div> : null}'), 'chat-input: the held context line ("New directions apply from slide N"), only while the lib words one')
  const list = src('components/builder/message-list.tsx')
  ok(list.includes('{studioChatClean ? <StudioChatCleanJob {...studioChatClean} currentStatus={currentStatus} /> : null}'), 'message-list: the job card at the end of the thread, from the prop alone')
  // -- the new files --------------------------------------------------------------------------------------------------------------------------
  const lib = src(LIB)
  ok(!/^import |^export .* from |require\(/m.test(lib), 'lib: import-free')
  ok(/process\.env\.NEXT_PUBLIC_STUDIO_CHAT_CLEAN/.test(lib) && count(lib, 'process.env.') === 1, 'lib: one literal flag read')
  const component = src(COMPONENT)
  ok(component.startsWith('"use client"'), 'component: a client file')
  ok(!/fetch\(|WebSocket|localStorage|console\./.test(component), 'component: draws, never talks or stores')
  ok(component.includes("from '@/components/model-choice/model-picker'") && component.includes('variant="slider"') && !/onChange=/.test(component), 'component: the picker is FRONTEND-2\'s slider variant, mounted as it ships (no onChange of our own to read null)')
  // -- the stylesheet --------------------------------------------------------------------------------------------------------------------------
  const css = postcss.parse(src(CSS))
  const scoped = sel => /^(\.dark )?\[data-studio-v4-shell="true"\] \[data-studio-chat-clean(\]|\[)/.test(sel) || /^\[data-studio-composer-menu="research"\]:has\(\[data-studio-chat-clean-menu="research"\]\)/.test(sel)
  let rules = 0
  css.walkRules(rule => { if (rule.parent.type === 'atrule' && rule.parent.name === 'keyframes') return; rules++; for (const sel of rule.selectors) ok(scoped(sel), `css: scoped: ${sel.slice(0, 80)}`) })
  ok(rules > 80, 'css: a stylesheet, not a stub')
  const allowed = new Set(['#c3cfcb', '#46565a', '#8a9896', '#74857f', '#f1edfb', '#2b2742', '#eef1f0', '#26323a', '#9b3f36', '#e3a29a', '#2f8f5b', '#6cc596', '#c4902e', '#e2b667', '#ffffff', '#1b2426', '#000'])
  css.walkDecls(decl => { for (const hex of decl.value.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []) ok(allowed.has(hex.toLowerCase()) || /^#[0-9a-fA-F]{8}$/.test(hex), `css: ${decl.prop}: ${hex} is a v3 token`) })
  const text = src(CSS)
  for (const needle of ['--scc-user: #f1edfb', '--scc-user: #2b2742', '--scc-accent: var(--scc-ink)', '[data-studio-chat-clean-accent="violet"]', '[data-studio-chat-clean-stop-colour="accent"]', '[data-studio-chat-clean-primary="continue"]', '[data-studio-chat-clean-label="small"]', '[data-studio-chat-clean-user="neutral"]', 'button[aria-label="Research options"] { order: 11; position: relative; }', 'order: 10; margin-left: auto; width: 24px;', '.studio-chat-clean-model .mpick-gauge-icon', '[data-studio-chat-clean-research-on="true"]', '--scc-ok: #2f8f5b', '--scc-ok: #6cc596', '--scc-wait: #c4902e', '--scc-wait: #e2b667', 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }', '[data-studio-chat-header-state="ready"]::before { background: var(--scc-ok); }', '[data-studio-chat-header-state="reconnecting"])::before { background: var(--scc-wait); }']) ok(text.includes(needle), `css: ${needle}`)
  // PK: no element is set larger than the live panel draws it; sizes are written only for this change's own elements and the two smaller ones
  css.walkDecls('font-size', decl => { const sel = decl.parent.selector ?? ''; const own = /data-studio-chat-clean-(note|directions|job|step|status|bar|continue|toggle)|studio-chat-clean-model/.test(sel); const smaller = /data-studio-director-option\]|question-number|\[data-studio-v4-prompt\] textarea\[data-studio-v4-type-role="prompt"\]|job-ledger-part="body"|data-studio-chat-clean-menu="research"/.test(sel); ok(own || smaller, `css: font-size only on this change's elements or where v3 is smaller: ${sel.slice(0, 90)}`); if (smaller) ok(parseFloat(decl.value) <= 13, `css: ${sel.slice(0, 60)}: ${decl.value} is not larger than the live size`) })
  ok(/\[data-testid="bn-flow-amend"\] \{ display: none; \}/.test(text), 'css: the flow bar is hidden under the flag (the slim bar stands in for it)')
  ok(/\[data-studio-chat-clean-composer="running"\], \[data-studio-chat-clean-composer="stopping"\]\) \[data-studio-v4-send\] \{ display: none; \}/.test(text), 'css: Send stands aside while Stop shows')
  ok(/\[data-studio-director-part="speaker"\] \{ display: none; \}/.test(text) && /\[data-studio-director-part="avatar"\] \{ display: none; \}/.test(text), 'css: no label, no avatar (v3)')
  ok(!/phone-tab-bar|data-studio-phone|studio-workspace-switch/.test(text), 'css: nothing of the phone shell or the pane switch (they stay the live ones)')
  ok(/\[data-studio-chat-clean-job-part="head"\] h3 \{[^}]*font-size: 11px/.test(text), 'css: the job card title at the panel\'s build-text size (v3.1 table)')
  ok(/prefers-reduced-motion/.test(text) && /forced-colors/.test(text), 'css: motion and forced colours')
  // -- .env.example, the registry, the taught proofs, the scope ------------------------------------------------------------------------------
  if (hasBase && OWN) {
    const envBase = git('show', `${stripModule.BASE_COMMIT}:.env.example`), envOwn = src('.env.example')
    eq(envOwn, `${envBase}\n${stripModule.CHAT_CLEAN_ENV_BLOCK}`, '.env.example: the base plus the block, after one blank line')
    ok(!stripModule.CHAT_CLEAN_ENV_BLOCK.includes('exact "true" enables it'), '.env.example: the block never uses the phrase the older env proofs refuse')
    eq(registry.stripLaterEnvBlocks('.env.example', envOwn).includes('NEXT_PUBLIC_STUDIO_CHAT_CLEAN'), false, '.env.example: the registry takes the block out')
    const regDiff = git('diff', '-U0', stripModule.BASE_COMMIT, OWN, '--', 'scripts/studio-later-changes.mjs').split('\n').filter(line => /^[-+]/.test(line) && !/^(---|\+\+\+)/.test(line))
    eq(regDiff.length, 3, 'registry: three lines'); ok(regDiff.every(line => line.startsWith('+') && line.includes('studio-chat-clean-strip.mjs') && line.includes('// LATER-CHANGE: ')), 'registry: ...all this change\'s')
    for (const rel of stripModule.CHAT_CLEAN_SCOPE_FILES) ok(registry.LATER_CHANGE_FILES.has(rel), `registry: ${rel} is registered`)
    ok(registry.LATER_STRIPS.includes(strip.stripChatClean) && registry.LATER_ENV_BLOCKS.includes(strip.CHAT_CLEAN_ENV_BLOCK), 'registry: the strip and the block are registered')
    eq(stripModule.CHAT_CLEAN_PIN_FILES.length, 7, 'seven older proofs are taught (composer-popups-v2, model-picker, pass2b-chat, model-choice, composer-stage-context, composer-copy, composer-picker)')
    for (const rel of stripModule.CHAT_CLEAN_PIN_FILES) {
      const now = src(rel), base = git('show', `${stripModule.BASE_COMMIT}:${rel}`)
      eq(stripModule.stripChatClean(rel, now), base, `${rel}: put back, it is the base`)
      for (const [has] of stripModule.CHAT_CLEAN_PIN_EDITS[rel]) { ok(now.includes(has), `${rel}: taught line present`); ok(has.includes('registry read (CHAT-CLEAN)'), `${rel}: taught line marked`) }
    }
    const changed = git('diff', '--name-only', `${stripModule.BASE_COMMIT}..${OWN}`).split('\n').filter(Boolean).sort()
    eq(changed, [...stripModule.CHAT_CLEAN_SCOPE_FILES].sort(), 'scope: the committed diff is exactly this change\'s files')
    for (const rel of stripModule.CHAT_CLEAN_NEW_FILES) ok(fs.existsSync(path.join(root, rel)), `scope: ${rel} exists`)
  } else console.log(`NOTE C  git has no ${stripModule.BASE_COMMIT.slice(0, 8)} or no own commit yet: the base-identity, .env.example, registry and scope checks were skipped`)
  // -- no secrets --------------------------------------------------------------------------------------------------------------------------------
  const CRED = /Bearer [A-Za-z0-9._-]{16,}|\bsk-[A-Za-z0-9]{16,}|\beyJ[A-Za-z0-9_-]{20,}|(?:api[_-]?key|secret|token|passw(?:or)?d|credential)[A-Za-z0-9_]*['"]?\s*[:=]\s*['"`][^'"`\s$]{8,}['"`]/i
  for (const rel of stripModule.CHAT_CLEAN_NEW_FILES) ok(!CRED.test(src(rel)), `${rel}: no credential-shaped literal`)
}

// ============================================================================================================================================
// run
// ============================================================================================================================================
const lib = libSuite()
console.log(`PASS A  the lib: flag, choices, words, the composer table, the job card, the notes, the status line (${checks} checks)`)
await componentSuite()
await hookSuite()
console.log(`PASS B  the components with real React and the notes hook on the offline host (${checks} checks)`)
sourceSuite()
console.log(`PASS C  the sources: marked lines, gates, base identity, the registry, .env.example, the stylesheet, scope (${checks} checks)`)

// ---- D. mutants ------------------------------------------------------------------------------------------------------------------------------
const libText = read(LIB), componentText = read(COMPONENT), cssText = read(CSS)
const mutate = (text, from, to) => { if (!text.includes(from)) throw new Error(`mutant target missing: ${from.slice(0, 60)}`); return text.replace(from, to) }
const expectFail = async (label, fn) => { let failed = false; try { await fn() } catch { failed = true } ok(failed, `mutant caught: ${label}`) }
await expectFail('the flag accepts any value', () => libSuite(mutate(libText, "return value === 'true'", 'return value !== undefined')))
await expectFail('a held build is not held', () => libSuite(mutate(libText, '  if (held) {', '  if (false && held) {')))
await expectFail('a stop request shows no Stop', () => libSuite(mutate(libText, "if (control === 'stop_requested') {", "if (control === 'stop_requested_') {")))
await expectFail('the rebuild path is never chosen', () => libSuite(mutate(libText, ": input.amendOn ? 'rebuild' : 'message'", ": 'message'")))
await expectFail('a stop adds no note', () => libSuite(mutate(libText, '  if (nowHeld && !wasHeld) {', '  if (false) {')))
await expectFail('the Build segment never fills with the tally', () => libSuite(mutate(libText, 'index === 2 && count > 0 ? Math.max(0.1, Math.min(1, done / count)) : 0.4', '0.4')))
await expectFail('finished segments read as pending', () => libSuite(mutate(libText, "if (index < at) return { label, state: 'done', fill: 1 }", "if (index < at) return { label, state: 'todo', fill: 0 }")))
await expectFail('the status line shows during a build', () => libSuite(mutate(libText, 'if (narrationActive || !status) return null', 'if (!status) return null')))
await expectFail('the bar never hides', () => componentSuite({ [COMPONENT]: mutate(componentText, 'if (!composer.barText) return null', 'if (false) return null') }))
await expectFail('the newest stop note shows under the held card too', () => componentSuite({ [COMPONENT]: mutate(componentText, "const shown = held && notes.length", 'const shown = false && notes.length') }))
await expectFail('Stop ignores the acknowledgement wait', () => componentSuite({ [COMPONENT]: mutate(componentText, 'disabled={!composer.stopEnabled}', 'disabled={false}') }))
await expectFail('the hook keeps notes across sessions', () => hookSuite({ [COMPONENT]: mutate(componentText, '  }, [enabled, sessionKey])', '  }, [enabled])') }))
await expectFail('the strip leaves the marked lines in', () => sourceSuite({ strip: { ...strip, stripChatClean: (rel, text) => text } }))
await expectFail('the stylesheet forgets the flow bar', () => sourceSuite({ [CSS]: mutate(cssText, '[data-studio-v4-shell="true"] [data-studio-chat-clean] [data-testid="bn-flow-amend"] { display: none; }', '') }))
await expectFail('the stylesheet brings a colour of its own', () => sourceSuite({ [CSS]: mutate(cssText, '--scc-error: #9b3f36;', '--scc-error: #b91c1c;') }))
await expectFail('a rule escapes the flag', () => sourceSuite({ [CSS]: cssText + '\n[data-studio-v4-send] { display: none; }\n' }))
console.log(`PASS D  mutants: every one caught (${checks} checks)`)
release?.()
console.log(`ALL PASS test-studio-chat-clean: ${checks} checks`)
