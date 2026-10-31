// FRONTEND-1 (PK's UAT feedback F-04, F-05, F-07, with F-06's one plain line; 30 Oct): proof of NEXT_PUBLIC_STUDIO_STRAWMAN_STAGE (the string "true", default off, build-time).
//   lib/studio-strawman-stage.ts (pure decisions), hooks/use-studio-strawman-stage.ts (the slide kept across the swap), components/builder/studio-strawman-plan.tsx (+ .css) (the plan strip),
//   marked lines in app/builder/page.tsx, and the .env.example block.
//
//   A. The lib, function by function: the flag, the phase (strawman / built / not applicable), the plan of a slide (title, content type + subtype else service, key message first then key points; an empty field is not drawn;
//      nothing is made up: a fuzz proves every drawn word is one the wire sent), the kept slide (what is remembered while the strawman shows, the return left when the built deck takes the stage, the wait for its viewer).
//   B. The strip, drawn: every field, every hidden field, the one plain line, no button.
//   C. The REAL hook in the chat harness's offline React host with a virtual clock: the return to the slide after the swap (waits for the built deck's viewer, goes once, clamps to the deck, gives up after 20 s), no return for slide 1 or
//      for a deck that is not another deck, and flag off: nothing remembered, timed or sent.
//   D. The page and .env.example: every marked line is where and as gated as it must be (the outline canvas is turned off by the flag and nothing else; the F-03 gate spots are untouched); stripping them gives the base's file byte for byte;
//      the scope is this change's files (not message-list.tsx, not the progress card, not lib/studio-stage-open-gate.ts); the registry names the change; the proof finds its own newest commit by its subject.
//   E. MUTANTS: every one of them must be caught by A-D.
//
//   node scripts/test-studio-strawman-stage.mjs
//
// Offline: no socket, fetch or real timer (the harness's host network guard is installed); git is read only for D.
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

const React = (await import('react')).default
const { renderToStaticMarkup } = await import('react-dom/server')
const { Root } = await import('./studio-chat-harness/mini-react.mjs')
const { createEnvironment } = await import('./studio-chat-harness/fake-env.mjs')
const strip = await import('./studio-strawman-stage-strip.mjs')
const macrotask = () => new Promise(resolve => setImmediate(resolve))
const unhandled = []
process.on('unhandledRejection', error => { unhandled.push(error) })

const LIB = 'lib/studio-strawman-stage.ts'
const HOOK = 'hooks/use-studio-strawman-stage.ts'
const PLAN = 'components/builder/studio-strawman-plan.tsx'
const CSS = 'components/builder/studio-strawman-plan.css'
const PAGE = 'app/builder/page.tsx'
// Later changes stack on top of this one, so every source, diff and scope check reads THIS change's own newest commit, not HEAD or the working tree (the working tree only before the first commit exists).
const gitText = (...a) => execFileSync('git', ['-C', root, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
const OWN = (() => { try { return gitText('log', '-1', '--format=%H', '--no-merges', '-E', `--grep=^${strip.STRAWMAN_STAGE_SUBJECT}`, 'HEAD') || null } catch { return null } })()
const readAt = (commit, rel) => { if (!commit) return read(rel); try { return execFileSync('git', ['-C', root, 'show', `${commit}:${rel}`], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }) } catch { return read(rel) } }
const readOwn = rel => readAt(OWN, rel)
const SOURCES = { [LIB]: read(LIB), [HOOK]: read(HOOK), [PLAN]: read(PLAN), [CSS]: read(CSS), [PAGE]: readOwn(PAGE), '.env.example': readOwn('.env.example') }

// ---- evaluation of module text (the real files and the mutants), in THIS realm so deepEqual compares plain objects ----------------------------------
function compile(text, fileName) {
  const out = ts.transpileModule(text, { fileName, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, isolatedModules: true } })
  const errors = (out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(`${fileName} does not transpile: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`)
  return out.outputText
}
function evalModule(text, fileName, scope = {}, requires = {}) {
  const module = { exports: {} }
  const names = Object.keys(scope)
  new Function('module', 'exports', 'require', ...names, compile(text, fileName))(module, module.exports, name => {
    if (!(name in requires)) throw new Error(`unexpected import ${name} in ${fileName}`)
    return requires[name]
  }, ...names.map(name => scope[name]))
  return module.exports
}
const FLAG = strip.STRAWMAN_STAGE_FLAG
const ON = { [FLAG]: 'true' }
const loadLib = (text = SOURCES[LIB], env = ON) => evalModule(text, LIB, { process: { env } })
const realLib = loadLib()

// ============================================================================================================================================
// A. The lib
// ============================================================================================================================================
function libSuite(lib, libText = SOURCES[LIB]) {
  // -- flag -------------------------------------------------------------------------------------------------------------------------------
  for (const [label, env, want] of [['unset', {}, false], ['"false"', { [FLAG]: 'false' }, false], ['TRUE', { [FLAG]: 'TRUE' }, false], ['1', { [FLAG]: '1' }, false], ['yes', { [FLAG]: 'yes' }, false], ['empty', { [FLAG]: '' }, false], ['"true"', ON, true]]) {
    eq(loadLib(libText, env).STUDIO_STRAWMAN_STAGE_ENABLED, want, `flag: ${label}`)
  }
  eq([lib.strawmanStageFlagOn('true'), lib.strawmanStageFlagOn(undefined), lib.strawmanStageFlagOn('True')], [true, false, false], 'flag fn')
  eq(lib.STRAWMAN_STAGE_NO_ACTION_LINE, 'No action needed: building starts automatically.', 'the one plain line')

  // -- the phase --------------------------------------------------------------------------------------------------------------------------
  const phase = over => lib.strawmanStagePhase({ enabled: true, templateModeOn: false, activeVersion: 'strawman', strawmanPreviewUrl: 'https://layout/p/straw', finalPresentationUrl: null, ...over })
  eq(phase({}), 'strawman', 'phase: the strawman on the stage is the strawman phase')
  eq(phase({ enabled: false }), null, 'phase: flag off: not applicable'); eq(phase({ enabled: false, activeVersion: 'final' }), null, 'phase: flag off: not even built')
  eq(phase({ templateModeOn: true }), null, 'phase: template mode owns the stage'); eq(phase({ templateModeOn: true, activeVersion: 'final' }), null, 'phase: template mode, final')
  eq(phase({ strawmanPreviewUrl: null }), null, 'phase: no preview deck, no strawman phase'); eq(phase({ strawmanPreviewUrl: undefined }), null, 'phase: ...undefined'); eq(phase({ strawmanPreviewUrl: '' }), null, 'phase: ...empty')
  eq(phase({ finalPresentationUrl: 'https://layout/p/final' }), null, 'phase: a strawman viewed after the build is history, not the outline stage')
  eq(phase({ activeVersion: 'final' }), 'built', 'phase: the final version is built'); eq(phase({ activeVersion: 'final', finalPresentationUrl: 'https://layout/p/final' }), 'built', 'phase: built with its url')
  eq(phase({ activeVersion: 'final', strawmanPreviewUrl: null }), 'built', 'phase: a restored finished deck is built')
  eq(phase({ activeVersion: 'blank' }), null, 'phase: a blank canvas is not applicable'); eq(phase({ activeVersion: null }), null, 'phase: no version'); eq(phase({ activeVersion: undefined }), null, 'phase: undefined version')

  // -- the chip ---------------------------------------------------------------------------------------------------------------------------
  const chip = lib.strawmanStageChip
  eq(chip({ content_type: 'text_heavy', subtype: 'vertical' }, { service: 'text_service' }), 'Text heavy · Vertical', 'chip: content type + subtype, underscores read as spaces, first letter capital')
  eq(chip({ content_type: 'chart', subtype: null }, null), 'Chart', 'chip: no subtype'); eq(chip({ content_type: 'chart' }, null), 'Chart', 'chip: subtype absent')
  eq(chip({ content_type: 'chart', subtype: 'Chart' }, null), 'Chart', 'chip: a subtype that says the same adds nothing'); eq(chip({ content_type: 'chart', subtype: '   ' }, null), 'Chart', 'chip: a blank subtype adds nothing')
  eq(chip({ content_type: 'infographic', subtype: 'big_numbers' }, { service: 'x' }), 'Infographic · Big numbers', 'chip: the service is used only when there is no content type')
  eq(chip({}, { service: 'analytics_service' }), 'Analytics service', 'chip: else the service'); eq(chip(null, { service: 'diagram' }), 'Diagram', 'chip: no context at all')
  eq(chip({ content_type: '  ' }, { service: 'diagram' }), 'Diagram', 'chip: a blank content type is none'); eq(chip({ content_type: 7 }, { service: 'diagram' }), 'Diagram', 'chip: a content type that is not text is none')
  eq(chip({ subtype: 'vertical' }, null), null, 'chip: a subtype alone is not a chip'); eq(chip({}, {}), null, 'chip: neither'); eq(chip(undefined, undefined), null, 'chip: nothing'); eq(chip('x', 'y'), null, 'chip: not records')
  eq(chip({ content_type: 'a__b  c_' }, null), 'A b c', 'chip: runs of underscores and spaces collapse')

  // -- the plan ---------------------------------------------------------------------------------------------------------------------------
  const slides = [
    { slide_id: 's1', title: 'Opening', key_points: ['Welcome', 'Agenda'], service: 'text_service' },
    { slide_id: 's2', title: 'Market size', key_points: ['TAM is 40B', 'Growing 12% a year', 'Three segments'], service: 'analytics_service' },
    { slide_id: 's3', title: 'Close', key_points: [] },
  ]
  const context = { 1: { slide_index: 1, content_type: 'chart', subtype: 'bar', key_message: 'The market is large and growing' }, 0: { slide_index: 0, content_type: 'text_heavy' } }
  const plan = (over = {}) => lib.strawmanStagePlan({ slides, contextByIndex: context, index: 1, ...over })
  eq(plan(), { position: 2, total: 3, title: 'Market size', chip: 'Chart · Bar', points: ['The market is large and growing', 'TAM is 40B', 'Growing 12% a year', 'Three segments'] }, 'plan: title, chip, the key message first then the key points, and where the slide is')
  eq(plan({ index: 0 }), { position: 1, total: 3, title: 'Opening', chip: 'Text heavy', points: ['Welcome', 'Agenda'] }, 'plan: the first slide; no key message, no subtype')
  eq(plan({ index: 2 }), { position: 3, total: 3, title: 'Close', chip: null, points: [] }, 'plan: a slide with no context and no points: the chip and the list are empty, not made up')
  eq(plan({ index: 99 }).position, 3, 'plan: an index past the end is the last slide'); eq(plan({ index: -1 }).position, 1, 'plan: negative is the first'); eq(plan({ index: 1.5 }).position, 1, 'plan: a fraction is the first')
  eq(plan({ index: Number.NaN }).position, 1, 'plan: NaN is the first'); eq(plan({ index: '1' }).position, 1, 'plan: a string is the first')
  eq(plan({ contextByIndex: null }), { position: 2, total: 3, title: 'Market size', chip: 'Analytics service', points: ['TAM is 40B', 'Growing 12% a year', 'Three segments'] }, 'plan: no slide_context: the service is the chip, no key message')
  eq(plan({ contextByIndex: [] }).chip, 'Analytics service', 'plan: an array is no map'); eq(plan({ contextByIndex: 'x' }).chip, 'Analytics service', 'plan: a string is no map')
  eq(lib.strawmanStagePlan({ slides: [{ title: 'A' }], contextByIndex: { 0: { key_message: 'a' } }, index: 0 }).points, [], 'plan: a key message that only differs from the title in case says nothing more: dropped')
  eq(lib.strawmanStagePlan({ slides: [{ title: '   ' }], contextByIndex: { 0: { content_type: 'chart' } }, index: 0 }).title, null, 'plan: a blank title is no title')
  eq(lib.strawmanStagePlan({ slides: [{ title: 'Market size', key_points: ['market size', 'Other'] }], contextByIndex: { 0: { key_message: '  MARKET   SIZE ' } }, index: 0 }).points, ['Other'], 'plan: a point or message that repeats the title (any case, any spacing) is dropped')
  eq(lib.strawmanStagePlan({ slides: [{ title: 'T', key_points: ['One', 'one', ' ONE ', 'Two'] }], contextByIndex: null, index: 0 }).points, ['One', 'Two'], 'plan: repeated points are drawn once')
  eq(lib.strawmanStagePlan({ slides: [{ title: 'T', key_points: ['', '   ', null, 4, {}, ['x'], 'Real'] }], contextByIndex: null, index: 0 }).points, ['Real'], 'plan: empty and non-text points are skipped')
  eq(lib.strawmanStagePlan({ slides: [{ title: 'T', key_points: 'not a list' }], contextByIndex: null, index: 0 }).points, [], 'plan: key_points that is not a list is none')
  eq(lib.strawmanStagePlan({ slides: [{ title: '  Spaced \n title  ' }], contextByIndex: null, index: 0 }).title, 'Spaced title', 'plan: white space collapses')
  eq(lib.strawmanStagePlan({ slides: [{ title: 'T', key_points: Array.from({ length: 12 }, (_, i) => `Point ${i}`) }], contextByIndex: null, index: 0 }).points.length, lib.STRAWMAN_STAGE_MAX_POINTS, 'plan: a short list')
  eq(lib.STRAWMAN_STAGE_MAX_POINTS, 6, 'plan: six at most')
  eq(lib.strawmanStagePlan({ slides: [{ title: 'T', key_points: ['a', 'b'] }], contextByIndex: { 0: { key_message: 'M' } }, index: 0 }).points[0], 'M', 'plan: the key message comes first even with a short list')
  eq(lib.strawmanStagePlan({ slides: [{ title: 'T', key_points: ['a', 'b', 'c', 'd', 'e', 'f'] }], contextByIndex: { 0: { key_message: 'M' } }, index: 0 }).points, ['M', 'a', 'b', 'c', 'd', 'e'], 'plan: the cap cuts the last point, never the key message')
  eq(lib.strawmanStagePlan({ slides: [], contextByIndex: { 3: { content_type: 'chart', key_message: 'Only context' } }, index: 3 }), { position: null, total: null, title: null, chip: 'Chart', points: ['Only context'] }, 'plan: no outline frame yet: the context alone, no position')
  for (const empty of [{ slides: [], contextByIndex: null, index: 0 }, { slides: null, contextByIndex: null, index: 0 }, { slides: undefined, contextByIndex: undefined, index: 0 }, { slides: 'x', contextByIndex: 3, index: 0 },
    { slides: [{}], contextByIndex: {}, index: 0 }, { slides: [{ title: '  ', key_points: [] }], contextByIndex: { 0: {} }, index: 0 }, { slides: [null], contextByIndex: null, index: 0 }]) eq(lib.strawmanStagePlan(empty), null, `plan: nothing to show is null (${JSON.stringify(empty).slice(0, 60)})`)
  eq(lib.strawmanStagePlan({ slides: [{ title: 'T', slide_type: 'title_slide', narrative: 'a story', analytics_needed: 'x' }], contextByIndex: null, index: 0 }), { position: 1, total: 1, title: 'T', chip: null, points: [] }, 'plan: fields that are not part of the plan (slide_type, narrative ...) are not drawn')
  // nothing is made up: every word of every plan comes from the input (a deterministic fuzz)
  let seed = 7
  const rand = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n }
  const words = ['Alpha', 'beta', 'GAMMA', '  delta  ', 'text_heavy', 'bar_chart', '', ' ', 'x', 'Q3 results', 'a_b']
  const pick = () => { const kind = rand(8); return kind === 0 ? null : kind === 1 ? rand(5) : kind === 2 ? undefined : words[rand(words.length)] }
  const norm = s => String(s).replace(/\s+/g, ' ').trim()
  for (let round = 0; round < 300; round++) {
    const n = rand(4)
    const fuzzSlides = Array.from({ length: n }, () => ({ title: pick(), service: pick(), key_points: rand(3) === 0 ? pick() : Array.from({ length: rand(5) }, pick) }))
    const fuzzContext = {}; for (let i = 0; i < 4; i++) if (rand(2)) fuzzContext[i] = { content_type: pick(), subtype: pick(), key_message: pick() }
    const index = rand(6) - 1
    const got = lib.strawmanStagePlan({ slides: fuzzSlides, contextByIndex: fuzzContext, index })
    if (!got) continue
    const allowed = new Set()
    const allow = v => { if (typeof v === 'string') { allowed.add(norm(v).toLowerCase()); allowed.add(norm(v).replace(/_+/g, ' ').trim().toLowerCase()) } }
    for (const s of fuzzSlides) { for (const v of [s.title, s.service, ...(Array.isArray(s.key_points) ? s.key_points : [])]) allow(v) }
    for (const c of Object.values(fuzzContext)) for (const v of [c.content_type, c.subtype, c.key_message]) allow(v)
    const drawn = [got.title, ...got.points, ...(got.chip ? got.chip.split(' · ') : [])].filter(v => v !== null)
    for (const v of drawn) if (!allowed.has(norm(v).toLowerCase())) assert.fail(`fuzz: "${v}" was not on the wire (round ${round})`)
    checks++
    ok(got.points.length <= lib.STRAWMAN_STAGE_MAX_POINTS && new Set(got.points.map(p => p.toLowerCase())).size === got.points.length && got.points.every(p => p === norm(p) && p !== ''), `fuzz: a short list, no repeats, no blanks (round ${round})`)
  }

  // -- the kept slide ---------------------------------------------------------------------------------------------------------------------
  const { initialStrawmanStageState: initial, strawmanStageStep: step } = lib
  eq(initial(), { shown: null, pending: null }, 'step: nothing at rest')
  let state = step(initial(), { phase: 'strawman', presentationId: 'straw-1', index: 3, now: 100 })
  eq(state, { shown: { presentationId: 'straw-1', index: 3 }, pending: null }, 'step: the strawman on the stage and the slide the user is on are remembered')
  state = step(state, { phase: 'strawman', presentationId: 'straw-1', index: 5, now: 200 })
  eq(state.shown, { presentationId: 'straw-1', index: 5 }, 'step: ...and follow the user')
  eq(step(state, { phase: 'built', presentationId: 'built-1', index: 0, now: 300 }), { shown: null, pending: { presentationId: 'built-1', index: 5, at: 300 } }, 'step: the built deck takes the stage: a return to the user\'s slide, left for that deck')
  eq(step(step(initial(), { phase: 'strawman', presentationId: 'straw-1', index: 0, now: 1 }), { phase: 'built', presentationId: 'built-1', index: 0, now: 2 }), { shown: null, pending: null }, 'step: a user on slide 1 needs no return (a fresh viewer opens there)')
  eq(step(step(initial(), { phase: 'strawman', presentationId: 'straw-1', index: 4, now: 1 }), { phase: 'built', presentationId: 'straw-1', index: 0, now: 2 }), { shown: null, pending: null }, 'step: the same deck is no swap')
  eq(step(step(initial(), { phase: 'strawman', presentationId: null, index: 4, now: 1 }), { phase: 'built', presentationId: 'built-1', index: 0, now: 2 }).pending, { presentationId: 'built-1', index: 4, at: 2 }, 'step: a strawman with no id yet is still another deck than the built one')
  eq(step(state, { phase: 'built', presentationId: null, index: 0, now: 300 }), state, 'step: the built deck is not known yet: nothing decided, nothing lost')
  eq(step(state, { phase: 'built', presentationId: '', index: 0, now: 300 }), state, 'step: ...an empty id is not known either')
  const pending = step(state, { phase: 'built', presentationId: 'built-1', index: 0, now: 300 })
  eq(step(pending, { phase: 'built', presentationId: 'built-1', index: 0, now: 900 }), pending, 'step: the return waits for its deck (nothing changes while the deck is the same)')
  eq(step(pending, { phase: 'built', presentationId: 'built-2', index: 0, now: 900 }), { shown: null, pending: null }, 'step: ...and goes when another deck is on the stage')
  eq(step(pending, { phase: 'built', presentationId: null, index: 0, now: 900 }), pending, 'step: ...but not for a moment with no deck id')
  eq(step(pending, { phase: 'strawman', presentationId: 'straw-2', index: 2, now: 900 }), { shown: { presentationId: 'straw-2', index: 2 }, pending: null }, 'step: a strawman again (regenerated) cancels the return and is remembered')
  eq(step(pending, { phase: null, presentationId: 'built-1', index: 2, now: 900 }), initial(), 'step: not applicable (flag off, template mode, a blank canvas) forgets everything')
  eq(step(state, { phase: null, presentationId: 'x', index: 2, now: 900 }), initial(), 'step: ...from the strawman phase too')
  eq(step(initial(), { phase: 'built', presentationId: 'built-1', index: 3, now: 900 }), initial(), 'step: a built deck with nothing remembered (a restored deck) leaves no return')
  for (const bad of [-1, 1.5, Number.NaN, '3', null, undefined, Infinity]) eq(step(initial(), { phase: 'strawman', presentationId: 's', index: bad, now: 1 }).shown.index, 0, `step: an index that is no slide is slide 1 (${String(bad)})`)

  // The order found in the running app: once the build has started, the page's slide drops to 1 while the strawman is still the displayed version, one render BEFORE the phase flips. That drop is the viewer's, not the user's.
  const buildOn = { buildStarted: true }
  const atThree = step(initial(), { phase: 'strawman', presentationId: 'straw-1', index: 2, now: 1 })
  eq(step(atThree, { phase: 'strawman', presentationId: 'straw-1', index: 0, now: 2, ...buildOn }), { shown: { presentationId: 'straw-1', index: 2 }, pending: null }, 'step: the build has started and the same deck reports slide 1: the remembered slide stays')
  const afterDrop = step(atThree, { phase: 'strawman', presentationId: 'straw-1', index: 0, now: 2, ...buildOn })
  eq(step(afterDrop, { phase: 'built', presentationId: 'built-1', index: 0, now: 3 }), { shown: null, pending: { presentationId: 'built-1', index: 2, at: 3 } }, 'step: ...so the built deck takes the stage with a return to slide 3 (the order: slide 3, drop to slide 1, then the phase flips)')
  eq(step(atThree, { phase: 'strawman', presentationId: 'straw-1', index: 0, now: 2 }).shown, { presentationId: 'straw-1', index: 0 }, 'step: before the build has started a move to slide 1 is the user\'s')
  eq(step(atThree, { phase: 'strawman', presentationId: 'straw-1', index: 0, now: 2, buildStarted: false }).shown.index, 0, 'step: ...build not started, said so')
  eq(step(atThree, { phase: 'strawman', presentationId: 'straw-1', index: 4, now: 2, ...buildOn }).shown, { presentationId: 'straw-1', index: 4 }, 'step: the build has started and the user moves to another slide: followed')
  eq(step(atThree, { phase: 'strawman', presentationId: 'straw-1', index: 1, now: 2, ...buildOn }).shown.index, 1, 'step: ...also back to slide 2')
  eq(step(atThree, { phase: 'strawman', presentationId: 'straw-2', index: 0, now: 2, ...buildOn }).shown, { presentationId: 'straw-2', index: 0 }, 'step: the build has started but this is another strawman deck: remembered as it is')
  eq(step(step(initial(), { phase: 'strawman', presentationId: 'straw-1', index: 0, now: 1 }), { phase: 'strawman', presentationId: 'straw-1', index: 0, now: 2, ...buildOn }).shown, { presentationId: 'straw-1', index: 0 }, 'step: the user was on slide 1 all along')
  eq(step(initial(), { phase: 'strawman', presentationId: 'straw-1', index: 0, now: 2, ...buildOn }).shown, { presentationId: 'straw-1', index: 0 }, 'step: nothing remembered yet: slide 1 is remembered')
  eq(step(afterDrop, { phase: 'strawman', presentationId: 'straw-1', index: 0, now: 3, ...buildOn }), afterDrop, 'step: the viewer reporting slide 1 again changes nothing')
  eq(step(afterDrop, { phase: null, presentationId: 'straw-1', index: 0, now: 3, ...buildOn }), initial(), 'step: ...and not applicable still forgets')
  const started = lib.strawmanStageBuildStarted
  for (const phase of ['building', 'qa', 'finalizing', 'paused', 'stopped']) eq(started({ generatingFinal: false, narrationPhase: phase }), true, `build started: narration phase ${phase}`)
  for (const phase of ['idle', 'planning', 'strawman', 'awaiting_user', 'complete', 'error', '', null, undefined, 7]) eq(started({ generatingFinal: false, narrationPhase: phase }), false, `build not started: narration phase ${String(phase)}`)
  eq([started({ generatingFinal: true, narrationPhase: 'idle' }), started({ generatingFinal: true, narrationPhase: null }), started({ generatingFinal: null, narrationPhase: undefined }), started({ generatingFinal: undefined, narrationPhase: 'building' })], [true, true, false, true], 'build started: Director generating the final deck is enough, and so is a build phase')
  eq(lib.STRAWMAN_STAGE_BUILD_PHASES, ['building', 'qa', 'finalizing', 'paused', 'stopped'], 'build started: the phases (not error: a failed build leaves the strawman to the user)')

  // The hold: once the page was taken back to the kept slide, the narration's own page turns (its follow of the freshest built slide) stand down while this build runs.
  eq(lib.strawmanStageWent({ shown: null, pending: { presentationId: 'built-1', index: 2, at: 3 } }), { shown: null, pending: null, held: true }, 'went: nothing pending, held')
  const heldState = { shown: null, pending: null, held: true }
  eq(step(heldState, { phase: 'built', presentationId: 'built-1', index: 2, now: 5, buildStarted: true }), heldState, 'hold: kept while the build runs')
  eq(step(heldState, { phase: 'built', presentationId: 'built-1', index: 2, now: 5 }), heldState, 'hold: kept when the build start is not said')
  eq(step(heldState, { phase: 'built', presentationId: 'built-1', index: 2, now: 5, buildStarted: false }), { shown: null, pending: null }, 'hold: ends with the build it was made for (a later build is another build)')
  eq(step(heldState, { phase: 'built', presentationId: null, index: 2, now: 5, buildStarted: false }), heldState, 'hold: a moment with no deck id decides nothing')
  eq(step(heldState, { phase: 'strawman', presentationId: 'straw-2', index: 0, now: 5, buildStarted: true }), { shown: { presentationId: 'straw-2', index: 0 }, pending: null }, 'hold: a strawman again ends it')
  eq(step(heldState, { phase: null, presentationId: 'built-1', index: 0, now: 5, buildStarted: true }), initial(), 'hold: not applicable ends it')
  eq(step({ shown: null, pending: { presentationId: 'built-1', index: 2, at: 3 } }, { phase: 'built', presentationId: 'built-1', index: 0, now: 5, buildStarted: false }), { shown: null, pending: { presentationId: 'built-1', index: 2, at: 3 } }, 'hold: a pending return is not a hold and is not touched by the build ending')
  const holdOf = (over) => lib.strawmanStageHold({ held: true, phase: 'built', buildStarted: true, ...over })
  eq([holdOf({}), holdOf({ held: false }), holdOf({ phase: 'strawman' }), holdOf({ phase: null }), holdOf({ buildStarted: false })], [true, false, false, false, false], 'hold: only after the return, with the built deck on the stage and its build running')

  const keep = over => lib.strawmanStageKeepStep({ pending: { presentationId: 'built-1', index: 4, at: 1000 }, now: 1000, hasViewerApi: true, viewerReady: true, slideCount: 10, ...over })
  eq(keep({}), { action: 'go', index: 4 }, 'keep: the viewer is ready: go to the slide')
  eq(keep({ pending: null }), { action: 'drop' }, 'keep: nothing pending')
  eq(keep({ viewerReady: false }), { action: 'wait', retryInMs: lib.STRAWMAN_STAGE_KEEP_RETRY_MS }, 'keep: the built deck\'s viewer is not ready: wait'); eq(keep({ hasViewerApi: false }), { action: 'wait', retryInMs: 250 }, 'keep: no viewer api: wait')
  eq(lib.STRAWMAN_STAGE_KEEP_RETRY_MS, 250, 'keep: looks every 250 ms'); eq(lib.STRAWMAN_STAGE_KEEP_MAX_MS, 20000, 'keep: gives up after 20 s')
  eq(keep({ now: 21000 }).action, 'go', 'keep: exactly at 20 s it still goes'); eq(keep({ now: 21001 }), { action: 'drop' }, 'keep: past 20 s it gives up'); eq(keep({ now: 21001, viewerReady: false }), { action: 'drop' }, 'keep: ...ready or not')
  const known = { slideCount: 10 }
  eq(keep(known), { action: 'go', index: 4 }, 'keep: a deck that holds the slide: go to it'); eq(keep({ slideCount: 5 }), { action: 'go', index: 4 }, 'keep: ...it is its last slide')
  eq(keep({ slideCount: 4 }), { action: 'drop' }, 'keep: a deck that does not hold the slide (it grows with the build) cannot keep it: no move, no hold'); eq(keep({ slideCount: 3 }), { action: 'drop' }, 'keep: ...fewer slides'); eq(keep({ slideCount: 1 }), { action: 'drop' }, 'keep: ...a one-slide deck')
  for (const unknown of [null, undefined, 0, -2, 2.5, Number.NaN, '7']) eq(keep({ slideCount: unknown }), { action: 'wait', retryInMs: 250 }, `keep: a count that is not known (${String(unknown)}) is waited for, not guessed`)
  eq(keep({ slideCount: null, now: 21001 }), { action: 'drop' }, 'keep: ...for 20 s at most'); eq(keep({ slideCount: 10, viewerReady: false }), { action: 'wait', retryInMs: 250 }, 'keep: the viewer is waited for first')
}
libSuite(realLib)
console.log(`PASS A  lib: flag, phase, chip, plan (with a fuzz: nothing made up), kept slide (${checks} checks)`)

// ============================================================================================================================================
// B. The strip
// ============================================================================================================================================
function planSuite(lib, planText = SOURCES[PLAN], css = SOURCES[CSS]) {
  const { StudioStrawmanPlan } = evalModule(planText, PLAN, {}, { react: React, 'react/jsx-runtime': require('react/jsx-runtime'), '@/lib/studio-strawman-stage': lib, './studio-strawman-plan.css': {} })
  const draw = plan => renderToStaticMarkup(React.createElement(StudioStrawmanPlan, { plan }))
  const NOTE = 'No action needed: building starts automatically.'
  const full = { position: 2, total: 8, title: 'Market size', chip: 'Chart · Bar', points: ['The market is large', 'TAM is 40B'] }
  let html = draw(full)
  ok(html.includes('data-studio-strawman-plan="true"') && html.includes('aria-label="Slide plan"') && html.startsWith('<section'), 'strip: a labelled section keyed to the attribute the css uses')
  ok(html.includes('>Slide 2 of 8<') && html.includes('data-studio-strawman-plan-part="position"'), 'strip: where the slide is')
  ok(html.includes('data-studio-strawman-plan-part="chip">Chart · Bar<'), 'strip: the content type chip')
  ok(/<h3[^>]*data-studio-strawman-plan-part="title">Market size<\/h3>/.test(html), 'strip: the title')
  ok(html.includes('<ul') && html.includes('aria-label="Key points"') && html.includes('<li>The market is large</li><li>TAM is 40B</li>'), 'strip: the key points as a list, in order')
  ok(html.includes('aria-live="polite"'), 'strip: the plan is announced politely when the slide changes')
  ok(html.includes(`<p data-studio-strawman-plan-part="note">${NOTE}</p>`), 'strip: the one plain line')
  ok(html.indexOf('data-studio-strawman-plan-part="plan"') < html.indexOf('data-studio-strawman-plan-part="note"'), 'strip: the line comes after the plan')
  ok(!html.includes('<button') && !html.includes('<a ') && !/onclick/i.test(html) && !/approve/i.test(html), 'strip: no button, no link, no Approve')
  html = draw(null); ok(html.includes(NOTE) && !html.includes('data-studio-strawman-plan-part="plan"') && !html.includes('<ul') && !html.includes('<h3') && !/Slide \d/.test(html), 'strip: no plan: the plain line alone')
  html = draw({ position: null, total: null, title: null, chip: null, points: [] }); ok(html.includes(NOTE) && !html.includes('data-studio-strawman-plan-part="plan"'), 'strip: a plan with every field empty is the plain line alone')
  html = draw({ ...full, chip: null }); ok(!html.includes('part="chip"') && html.includes('Market size') && html.includes('<li>'), 'strip: no chip, none drawn')
  html = draw({ ...full, title: null }); ok(!html.includes('<h3') && html.includes('part="chip"') && html.includes('<li>'), 'strip: no title, none drawn')
  html = draw({ ...full, points: [] }); ok(!html.includes('<ul') && !html.includes('<li>') && html.includes('Market size'), 'strip: no points, no list')
  html = draw({ ...full, position: null, total: null }); ok(!/Slide \d/.test(html) && html.includes('Market size'), 'strip: no position, none drawn')
  html = draw({ ...full, position: 2, total: null }); ok(!/Slide \d/.test(html), 'strip: a position without a total is not drawn')
  html = draw({ ...full, title: 'A <b>bold</b> & "quoted" title' }); ok(html.includes('A &lt;b&gt;bold&lt;/b&gt; &amp; &quot;quoted&quot; title') && !html.includes('<b>'), 'strip: the words are text, never markup')
  html = draw({ ...full, points: ['<i>x</i> & "y"'] }); ok(html.includes('<li>&lt;i&gt;x&lt;/i&gt; &amp; &quot;y&quot;</li>') && !html.includes('<i>'), 'strip: a point is text, never markup')
  html = draw({ ...full, chip: null, title: null, points: ['Only a point'] }); ok(html.includes('<li>Only a point</li>') && !html.includes('part="chip"') && !html.includes('<h3'), 'strip: points alone')
  // the css: keyed to the strip's own attributes, scoped to the Studio shell, quiet (the shell's tokens, one hairline), never positioned over the viewer
  ok(/\[data-studio-v4-shell="true"\] \[data-studio-strawman-plan="true"\] \{/.test(css), 'css: the strip is scoped to the Studio shell')
  ok(css.split('\n').filter(line => /^\s*\[|^@container/.test(line)).every(line => line.includes('data-studio-strawman-plan') || line.startsWith('@container')), 'css: every rule is keyed to the strip\'s own attribute')
  ok(!/position:\s*(absolute|fixed)/.test(css) && /flex:\s*none/.test(css) && /border-top:\s*1px solid var\(--ss-line\)/.test(css) && /max-height:/.test(css), 'css: a row under the viewer (not over it), one hairline, a height cap')
  ok(!/#[0-9a-f]{3,8}\b/i.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'css: only the shell\'s tokens, no colours of its own')
}
planSuite(realLib)
console.log(`PASS B  strip: markup, hidden fields, no button, css (${checks} checks)`)

// ============================================================================================================================================
// C. The real hook in the offline React host
// ============================================================================================================================================
const BUILT = 'built-1'
async function makeWorld({ flags = ON, libText = SOURCES[LIB], hookText = SOURCES[HOOK], props = {} } = {}) {
  const processEnv = { ...flags }
  const env = createEnvironment({ processEnv })
  const scope = { process: { env: processEnv }, Date: env.globals.Date, setTimeout: env.clock.setTimeout, clearTimeout: env.clock.clearTimeout }
  const lib = evalModule(libText, LIB, { process: scope.process })
  const hookModule = evalModule(hookText, HOOK, scope, { react: React, '@/lib/studio-strawman-stage': lib })
  const calls = { go: [] }
  const p = {
    phase: 'strawman', presentationId: 'straw-1', currentSlideIndex: 0, buildStarted: false, slideCount: 8,
    goToSlide: async index => { calls.go.push(index) }, viewerSafety: { presentationId: 'straw-1', ready: true, busy: false, error: false },
    ...props,
  }
  let hold = false
  function Page() { hold = hookModule.useStudioStrawmanStage({ ...p }); return null }
  const rootNode = new Root()
  rootNode.setElement(React.createElement(Page))
  const settle = async () => { for (let quiet = 0, rounds = 0; quiet < 2; rounds++) { if (rounds > 80) throw new Error('did not settle'); await macrotask(); quiet = rootNode.flush() ? 0 : quiet + 1 } }
  await settle()
  return {
    env, lib, calls, p, settle, hold: () => hold, pending: () => env.clock.pending(),
    set: async patch => { Object.assign(p, patch); rootNode.schedule(); await settle() },
    advance: async ms => { await env.clock.advance(ms, settle) },
    // The built deck takes the stage (the page: effective version "final", the other presentation id), its viewer not ready yet.
    swap: async (over = {}) => { Object.assign(p, { phase: 'built', presentationId: BUILT, viewerSafety: { presentationId: 'straw-1', ready: true, busy: false, error: false }, ...over }); rootNode.schedule(); await settle() },
    ready: async (over = {}) => { Object.assign(p, { viewerSafety: { presentationId: BUILT, ready: true, busy: false, error: false }, ...over }); rootNode.schedule(); await settle() },
    unmount: () => rootNode.unmount(),
  }
}
const worldMaker = base => over => makeWorld({ ...base, ...over })
async function hookSuite(make) {
  // the user is on slide 4 of the strawman; the built deck takes the stage; its viewer is not ready: nothing yet, a look every 250 ms
  let w = await make({})
  await w.set({ currentSlideIndex: 3 })
  await w.swap()
  eq(w.calls.go, [], 'hook: the built deck\'s viewer is not ready (it is still the strawman\'s): not yet')
  ok(w.pending() > 0, 'hook: ...it looks again soon')
  await w.advance(1000); eq(w.calls.go, [], 'hook: ...and keeps waiting')
  await w.ready()
  await w.advance(250); eq(w.calls.go, [3], 'hook: the built deck\'s viewer is ready: back to slide 4 (index 3), once')
  await w.ready(); await w.ready({ slideCount: 9 }); await w.advance(250); eq(w.calls.go, [3], 'hook: ...the viewer\'s next report of being ready does not send it again: the return is made once')
  await w.advance(30000); eq(w.calls.go, [3], 'hook: ...and only once'); eq(w.pending(), 0, 'hook: no timer is left')
  await w.set({ currentSlideIndex: 0 }); await w.advance(1000); eq(w.calls.go, [3], 'hook: the new viewer reporting slide 1 afterwards does not send it back again')
  // a viewer that becomes ready without a new props object is found by the next look
  w = await make({}); await w.set({ currentSlideIndex: 3 })
  await w.swap({ viewerSafety: { presentationId: BUILT, ready: false, busy: false, error: false } }); await w.advance(500); eq(w.calls.go, [], 'hook: not ready yet')
  w.p.viewerSafety.ready = true; await w.advance(250); eq(w.calls.go, [3], 'hook: ...found at the next look, with no new props')
  // ready at once: no wait at all
  w = await make({ props: { currentSlideIndex: 2 } })
  await w.set({ currentSlideIndex: 2 })
  await w.swap({ viewerSafety: { presentationId: BUILT, ready: true, busy: false, error: false } })
  eq(w.calls.go, [2], 'hook: a viewer that is ready at the swap goes at once'); eq(w.pending(), 0, 'hook: ...with no timer')
  // the user moves about the strawman: the last slide counts
  w = await make({})
  for (const index of [1, 4, 2]) await w.set({ currentSlideIndex: index })
  await w.swap({ viewerSafety: { presentationId: BUILT, ready: true, busy: false, error: false } }); eq(w.calls.go, [2], 'hook: the slide the user was last on')
  // The order found in the running app: the user is on slide 3, the build starts, the page's slide drops to 1 while the strawman is still the displayed version, and only then does the phase flip.
  w = await make({}); await w.set({ currentSlideIndex: 2 }); await w.set({ buildStarted: true }); await w.set({ currentSlideIndex: 0 })
  await w.swap({ viewerSafety: { presentationId: BUILT, ready: false, busy: false, error: false } }); eq(w.calls.go, [], 'hook: reset first, then the phase flips: waits for the built deck\'s viewer')
  eq(w.hold(), false, 'hook: the narration\'s page turns have not stood down before the return')
  await w.ready(); await w.advance(250); eq(w.calls.go, [2], 'hook: ...and takes it back to slide 3, though the page had already dropped to slide 1')
  eq(w.hold(), true, 'hook: ...and from then on the narration\'s page turns stand down (they would page back to slide 1: found in the running app)')
  await w.ready(); await w.advance(1000); eq(w.hold(), true, 'hook: ...for as long as the build runs')
  await w.set({ buildStarted: false }); eq(w.hold(), false, 'hook: ...and not after it')
  await w.set({ buildStarted: true }); eq(w.hold(), false, 'hook: ...nor for a later build (the build ending ended it)')
  await w.advance(30000); eq([w.calls.go, w.pending()], [[2], 0], 'hook: ...once')
  w = await make({}); await w.set({ currentSlideIndex: 2 }); await w.set({ buildStarted: true }); await w.set({ currentSlideIndex: 0 }); await w.swap({ viewerSafety: { presentationId: BUILT, ready: true, busy: false, error: false } }); eq([w.calls.go, w.hold()], [[2], true], 'hook: ...at once when the viewer is ready, and the narration\'s page turns stand down')
  w = await make({}); await w.set({ currentSlideIndex: 2 }); await w.set({ buildStarted: true }); await w.set({ currentSlideIndex: 0 }); await w.swap({ viewerSafety: { presentationId: BUILT, ready: true, busy: false, error: false }, phase: 'strawman', presentationId: 'straw-1' }); eq(w.hold(), false, 'hook: the strawman still on the stage: no hold')
  w = await make({}); await w.set({ currentSlideIndex: 2 }); await w.set({ currentSlideIndex: 0 }); await w.set({ buildStarted: true }); await w.swap({ viewerSafety: { presentationId: BUILT, ready: true, busy: false, error: false } }); eq([w.calls.go, w.hold()], [[], false], 'hook: a user who went back to slide 1 before the build started is not sent anywhere, and the narration is left alone')
  w = await make({}); await w.set({ currentSlideIndex: 6 }); await w.set({ buildStarted: true }); await w.set({ currentSlideIndex: 0 }); await w.swap({ slideCount: 1, viewerSafety: { presentationId: BUILT, ready: true, busy: false, error: false } }); eq([w.calls.go, w.hold()], [[], false], 'hook: a deck too short for the slide is not gone back to, so the narration\'s follow carries on as today')
  w = await make({ flags: {} }); await w.set({ currentSlideIndex: 2 }); await w.set({ buildStarted: true }); await w.set({ currentSlideIndex: 0 }); await w.swap({ viewerSafety: { presentationId: BUILT, ready: true, busy: false, error: false } }); eq([w.calls.go, w.hold()], [[], false], 'hook: flag off: no return and no hold')
  w = await make({}); await w.set({ currentSlideIndex: 2 }); await w.set({ buildStarted: true }); await w.set({ currentSlideIndex: 4 }); await w.set({ currentSlideIndex: 0 }); await w.swap({ viewerSafety: { presentationId: BUILT, ready: true, busy: false, error: false } }); eq(w.calls.go, [4], 'hook: a user who moved on after the build started: the last slide they chose')
  // slide 1: nothing to go back to
  w = await make({})
  await w.swap({ viewerSafety: { presentationId: BUILT, ready: true, busy: false, error: false } }); await w.advance(5000); eq([w.calls.go, w.pending()], [[], 0], 'hook: a user on slide 1 needs no return: no call, no timer')
  // the viewer is busy / errored / for another deck: not ready
  for (const [label, safety] of [['busy', { presentationId: BUILT, ready: true, busy: true, error: false }], ['errored', { presentationId: BUILT, ready: true, busy: false, error: true }], ['not ready', { presentationId: BUILT, ready: false, busy: false, error: false }], ['another deck', { presentationId: 'straw-1', ready: true, busy: false, error: false }], ['unknown', null]]) {
    w = await make({}); await w.set({ currentSlideIndex: 3 }); await w.swap({ viewerSafety: safety }); await w.advance(5000); eq(w.calls.go, [], `hook: a viewer that is ${label} is waited for, not used`)
  }
  // no viewer api yet
  w = await make({}); await w.set({ currentSlideIndex: 3 }); await w.swap({ goToSlide: null, viewerSafety: { presentationId: BUILT, ready: true, busy: false, error: false } }); await w.advance(2000); eq(w.calls.go, [], 'hook: no viewer api: waits')
  const arrived = []; await w.ready({ goToSlide: async index => { arrived.push(index) } }); await w.advance(250); eq(arrived, [3], 'hook: ...and goes when the api is there')
  // a viewer that never gets ready: gives up after 20 s, leaves no timer
  w = await make({}); await w.set({ currentSlideIndex: 3 }); await w.swap(); await w.advance(19000); eq(w.calls.go, [], 'hook: still waiting at 19 s'); ok(w.pending() > 0, 'hook: ...still looking')
  await w.advance(2000); eq(w.pending(), 0, 'hook: gives up past 20 s: no timer left'); await w.ready(); await w.advance(1000); eq(w.calls.go, [], 'hook: ...and does not go late')
  // a deck that does not hold the user's slide cannot keep it (it grows with the build): no move, no hold, no timer
  w = await make({}); await w.set({ currentSlideIndex: 6 }); await w.set({ buildStarted: true }); await w.swap({ slideCount: 4, viewerSafety: { presentationId: BUILT, ready: true, busy: false, error: false } }); eq([w.calls.go, w.hold(), w.pending()], [[], false, 0], 'hook: a built deck of 4 slides, the user was on slide 7: nowhere to go, nothing held')
  w = await make({}); await w.set({ currentSlideIndex: 6 }); await w.set({ buildStarted: true }); await w.swap({ slideCount: 7, viewerSafety: { presentationId: BUILT, ready: true, busy: false, error: false } }); eq([w.calls.go, w.hold()], [[6], true], 'hook: a built deck of 7 slides holds slide 7: gone back to')
  // the built deck's slide count is not known yet (the page reads it from the viewer once it has drawn): waited for, not guessed
  w = await make({ props: { slideCount: null } }); await w.set({ currentSlideIndex: 2 }); await w.set({ buildStarted: true }); await w.swap({ viewerSafety: { presentationId: BUILT, ready: true, busy: false, error: false } }); await w.advance(1000)
  eq([w.calls.go, w.hold()], [[], false], 'hook: the viewer is ready but its slide count is not known: waits'); ok(w.pending() > 0, 'hook: ...and looks again')
  await w.set({ slideCount: 6 }); eq([w.calls.go, w.hold()], [[2], true], 'hook: ...goes as soon as the deck is known to hold the slide')
  w = await make({ props: { slideCount: null } }); await w.set({ currentSlideIndex: 2 }); await w.set({ buildStarted: true }); await w.swap({ viewerSafety: { presentationId: BUILT, ready: true, busy: false, error: false } }); await w.advance(21000)
  eq([w.calls.go, w.hold(), w.pending()], [[], false, 0], 'hook: a count that never comes: gives up past 20 s, nothing moved, nothing held')
  await w.set({ slideCount: 6 }); await w.advance(1000); eq(w.calls.go, [], 'hook: ...and does not go late')
  // a one-slide deck: nowhere to go
  w = await make({}); await w.set({ currentSlideIndex: 6 }); await w.swap({ slideCount: 1, viewerSafety: { presentationId: BUILT, ready: true, busy: false, error: false } }); eq([w.calls.go, w.pending()], [[], 0], 'hook: a built deck of 1 slide: nowhere to go')
  // the same deck on the stage (no swap): nothing
  w = await make({}); await w.set({ currentSlideIndex: 3 }); await w.swap({ presentationId: 'straw-1', viewerSafety: { presentationId: 'straw-1', ready: true, busy: false, error: false } }); await w.advance(2000); eq([w.calls.go, w.pending()], [[], 0], 'hook: the same deck is no swap')
  // a failing goToSlide is not an error
  unhandled.length = 0
  w = await make({ props: { goToSlide: async () => { throw new Error('viewer gone') } } }); await w.set({ currentSlideIndex: 3 }); await w.swap({ viewerSafety: { presentationId: BUILT, ready: true, busy: false, error: false } }); await w.advance(1000)
  await macrotask(); await macrotask(); eq([w.pending(), unhandled.length], [0, 0], 'hook: a viewer that refuses the move is not an error (no unhandled rejection) and not retried')
  // not applicable (template mode, flag off in the page): everything is forgotten
  w = await make({}); await w.set({ currentSlideIndex: 3 }); await w.set({ phase: null }); await w.swap({ viewerSafety: { presentationId: BUILT, ready: true, busy: false, error: false } }); eq(w.calls.go, [], 'hook: a stage that was not applicable in between forgot the slide')
  // a wait that is overtaken: another deck, or the strawman back
  w = await make({}); await w.set({ currentSlideIndex: 3 }); await w.swap(); await w.swap({ presentationId: 'built-2', viewerSafety: { presentationId: 'built-2', ready: true, busy: false, error: false } }); await w.advance(1000); eq(w.calls.go, [], 'hook: another deck on the stage ends the wait for the first')
  w = await make({}); await w.set({ currentSlideIndex: 3 }); await w.swap(); await w.set({ phase: 'strawman', presentationId: 'straw-2', currentSlideIndex: 0 }); await w.ready(); await w.advance(1000); eq(w.calls.go, [], 'hook: a regenerated strawman ends the wait')
  // flag off (the default): nothing remembered, timed or sent
  w = await make({ flags: {} }); await w.set({ currentSlideIndex: 3 }); await w.swap(); await w.ready(); await w.advance(30000); eq([w.calls.go, w.pending()], [[], 0], 'hook: flag off: no call, no timer')
  w = await make({ flags: { [FLAG]: 'false' } }); await w.set({ currentSlideIndex: 3 }); await w.swap({ viewerSafety: { presentationId: BUILT, ready: true, busy: false, error: false } }); eq([w.calls.go, w.pending()], [[], 0], 'hook: flag "false": nothing')
  w.unmount()
}
await hookSuite(makeWorld)
console.log(`PASS C  hook: the return to the user's slide, waits, clamps, gives up, flag off (${checks} checks)`)

// ============================================================================================================================================
// D. The page, .env.example, the scope
// ============================================================================================================================================
const lines = text => text.split('\n')
function sourceSuite(sources, { base = null } = {}) {
  const page = sources[PAGE], env = sources['.env.example'], hook = sources[HOOK], planSource = sources[PLAN], libSource = sources[LIB]
  const lineOf = (text, needle) => { const found = lines(text).filter(line => line.includes(needle)); ok(found.length === 1, `exactly one line with: ${needle.slice(0, 70)} (${found.length})`); return found[0] }
  const marked = lines(page).filter(line => strip.STRAWMAN_STAGE_MARKER_RE.test(line))
  eq(marked.length, 11, 'page: eleven marked lines (three imports, two comments, the phase, the plan, the hook call, the spread, the strip, the narration hold)')
  // nothing of it comes before the Builder's runners (an older proof slices the page by the positions of a parse that does not see these lines)
  const first = page.indexOf(marked[0])
  ok(first > page.indexOf('themeExportDirectiveRunnerRef.current = ') && first > page.indexOf('elementDirectiveRunnerRef.current = '), 'page: the first marked line is after the Builder\'s element and theme runners')
  // imports: after the Builder content, before the loading state, with the flow and chat imports
  const importLib = lineOf(page, "import { STUDIO_STRAWMAN_STAGE_ENABLED, strawmanStageBuildStarted, strawmanStagePhase, strawmanStagePlan } from '@/lib/studio-strawman-stage' // STRAWMAN-STAGE")
  const importHook = lineOf(page, "import { useStudioStrawmanStage } from '@/hooks/use-studio-strawman-stage' // STRAWMAN-STAGE")
  const importPlan = lineOf(page, "import { StudioStrawmanPlan } from '@/components/builder/studio-strawman-plan' // STRAWMAN-STAGE")
  for (const line of [importLib, importHook, importPlan]) ok(page.indexOf(line) > page.indexOf('function AuthenticatedBuilderContent(') && page.indexOf(line) < page.indexOf('function BuilderLoadingState('), 'page: imported between the Builder content and the loading state (after the runners)')
  ok(page.indexOf(importLib) > page.indexOf("import { useStudioFlowControl } from '@/hooks/use-studio-flow-control'"), 'page: ...with the flow and chat imports')
  // the decisions: before the outline canvas is selected, after what they read
  const phaseLine = lineOf(page, 'const studioStrawmanPhase = strawmanStagePhase({')
  ok(phaseLine.includes('enabled: STUDIO_STRAWMAN_STAGE_ENABLED && studioShell, templateModeOn, activeVersion: effectiveActiveVersion,') && phaseLine.includes('strawmanPreviewUrl') && phaseLine.includes('finalPresentationUrl'), 'page: the phase is the Studio shell\'s, not template mode, from the displayed version and the two urls')
  const planLine = lineOf(page, 'const studioStrawmanPlan = studioStrawmanPhase')
  ok(planLine.includes("studioStrawmanPhase === 'strawman' ? strawmanStagePlan({") && planLine.includes('slides: slideStructure?.slides') && planLine.includes('contextByIndex: slideContextByIndex') && planLine.includes('index: currentSlideIndex') && planLine.endsWith(': null // STRAWMAN-STAGE'), 'page: the plan is of the slide on stage, from the outline frame and slide_context, only in the strawman phase')
  const hookLine = lineOf(page, 'const studioStrawmanHold = useStudioStrawmanStage({')
  for (const piece of ['phase: studioStrawmanPhase', 'presentationId: effectivePresentationId', 'currentSlideIndex, buildStarted: strawmanStageBuildStarted({ generatingFinal: isGeneratingFinal, narrationPhase: buildNarration.phase }), slideCount: effectiveSlideCount', 'goToSlide: layoutServiceApis?.goToSlide', 'viewerSafety: studioViewerSafety']) ok(hookLine.includes(piece), `page: the hook is handed ${piece}`)
  const selectAt = page.indexOf('const studioOutlineCanvas = selectStudioOutlineCanvas({')
  ok(selectAt > 0, 'page: the outline canvas selection is there')
  for (const line of [phaseLine, planLine, hookLine]) ok(page.indexOf(line) < selectAt, 'page: decided before the outline canvas is selected')
  ok(page.indexOf(phaseLine) > page.indexOf('const effectiveActiveVersion = ') && page.indexOf(phaseLine) > page.indexOf('const effectiveSlideCount = ') && page.indexOf(phaseLine) > page.indexOf('const [layoutServiceApis') && page.indexOf(phaseLine) > page.indexOf('const [studioViewerSafety'), 'page: ...after everything it reads')
  // the one thing that turns the outline canvas off: the flag, inside the selection, after its own enabled
  const spread = lineOf(page, '...(STUDIO_STRAWMAN_STAGE_ENABLED && strawmanPreviewUrl ? { enabled: false } : {}), // STRAWMAN-STAGE')
  const selectEnd = page.indexOf('\n  })\n', selectAt)
  ok(page.indexOf(spread) > selectAt && page.indexOf(spread) < selectEnd, 'page: the spread is inside the outline canvas selection')
  ok(page.indexOf(spread) > page.indexOf('enabled: STUDIO_OUTLINE_CANVAS_ENABLED && studioShell,', selectAt), 'page: ...after its own enabled, so it wins')
  ok(!page.includes('STUDIO_OUTLINE_CANVAS_ENABLED && studioShell && !'), 'page: the outline canvas\'s own enabled line is not rewritten')
  // the narration's follow stands down once the viewer was taken back to the user's slide: one attribute after narrationNavigate's own, which it overrides, only while the hook says hold
  const holdLine = lineOf(page, '{...(studioStrawmanHold ? ({ narrationNavigate: null } as { narrationNavigate?: null }) : {})} // STRAWMAN-STAGE')
  ok(holdLine.trim().startsWith('{...(studioStrawmanHold ?') && page.indexOf(holdLine) > page.indexOf('? narrationNavigate : null}') && page.indexOf(holdLine) < page.indexOf('buildNarration={effectiveBuildNarrationEnabled ? buildNarration : null}') && page.indexOf(holdLine) > page.indexOf('<PresentationArea'), 'page: the hold is an attribute of the viewer area, after narrationNavigate\'s own and before buildNarration, so it overrides it')
  ok(page.indexOf(hookLine) < page.indexOf(holdLine), 'page: ...the hook is called first')
  eq(lines(page).filter(line => line.includes('narrationNavigate={')).length, 1, 'page: narrationNavigate\'s own attribute is not rewritten')
  // the strip: after the viewer, before the outline canvas's own JSX, only in the strawman phase
  const jsx = lineOf(page, '<StudioStrawmanPlan plan={studioStrawmanPlan} />')
  ok(jsx.trim().startsWith("{studioStrawmanPhase === 'strawman' && <StudioStrawmanPlan plan={studioStrawmanPlan} />}{/* STRAWMAN-STAGE"), 'page: the strip is drawn only in the strawman phase')
  ok(page.indexOf(jsx) > page.indexOf('<PresentationArea') && page.indexOf(jsx) < page.indexOf('{studioOutlineCanvas && <StudioOutlineCanvas'), 'page: ...after the viewer, before the outline canvas\'s own line')
  ok(!/onApprove|handleActionClick/.test(jsx), 'page: no approval on the stage')
  // the F-03 gate spots (FRONTEND-2's) and the outline canvas are untouched: the four lines around each anchor are the base's, contiguous
  if (base) {
    for (const anchor of ['const studioFirstRunStage = ', 'data-studio-first-run-stage={', '{studioOutlineCanvas && <StudioOutlineCanvas']) {
      const baseLines = lines(base[PAGE]), at = baseLines.findIndex(line => line.includes(anchor))
      ok(at >= 0, `base: ${anchor.trim()} is there`)
      const window = baseLines.slice(Math.max(0, at - 2), at + 4).join('\n')
      ok(page.includes(window) || anchor.includes('StudioOutlineCanvas'), `page: the lines around ${anchor.trim()} are the base's, nothing inserted`)
    }
    const outlineBase = lines(base[PAGE]).findIndex(line => line.includes('{studioOutlineCanvas && <StudioOutlineCanvas'))
    const outlineTail = lines(base[PAGE]).slice(outlineBase, outlineBase + 3).join('\n')
    ok(page.includes(outlineTail), 'page: the outline canvas\'s own JSX is the base\'s')
  }
  // the hook and the strip import only what they must
  ok(/import \{[^}]*\} from 'react'/.test(hook) && hook.includes("from '@/lib/studio-strawman-stage'") && lines(hook).filter(line => /^import /.test(line)).length === 2, 'hook: imports react and the lib, nothing else')
  ok(/if \(!STUDIO_STRAWMAN_STAGE_ENABLED\) return/.test(hook) && lines(hook).filter(line => line.includes('if (!STUDIO_STRAWMAN_STAGE_ENABLED')).length === 2, 'hook: both effects return at once with the flag off')
  ok(!/\bfetch\(|WebSocket|sendBuildControl|localStorage|sessionStorage/.test(hook), 'hook: it sends nothing and stores nothing')
  ok(!/<button|onClick|onApprove|handleActionClick/.test(planSource), 'strip component: no button, no click, no approval')
  ok(lines(planSource).filter(line => /^import /.test(line)).length === 2 && planSource.includes('./studio-strawman-plan.css'), 'strip component: imports the lib and its css only')
  ok(!/^import /m.test(libSource) && !/\brequire\(/.test(libSource), 'lib: import-free')
  ok((libSource.match(/process\.env\./g) ?? []).length === 1 && libSource.includes('process.env.NEXT_PUBLIC_STUDIO_STRAWMAN_STAGE'), 'lib: one literal process.env read (so Next inlines it)')
  // env
  ok(env.endsWith(`\n${strip.STRAWMAN_STAGE_ENV_BLOCK}`) && strip.STRAWMAN_STAGE_ENV_BLOCK.endsWith('\n'), '.env.example: the block is the last thing in the file, after one blank line')
  eq(lines(env).filter(line => line === `${FLAG}="false"`).length, 1, `.env.example: ${FLAG} once, "false"`)
  ok(lines(strip.STRAWMAN_STAGE_ENV_BLOCK).filter(line => line && !line.startsWith('#') && line !== `${FLAG}="false"`).length === 0, '.env.example: the block is comments and its one assignment')
}
const baseOk = (() => { try { execFileSync('git', ['-C', root, 'cat-file', '-e', `${strip.BASE_COMMIT}^{commit}`], { stdio: 'ignore' }); return true } catch { return false } })()
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 })
const baseSources = baseOk ? Object.fromEntries(strip.STRAWMAN_STAGE_FILES.map(rel => [rel, git('show', `${strip.BASE_COMMIT}:${rel}`)])) : null
// the committed diff when this change's commit exists, else the working tree against the base
const diffTo = OWN ? [strip.BASE_COMMIT, OWN] : [strip.BASE_COMMIT]
sourceSuite(SOURCES, { base: baseSources })
const registry = await import('./studio-later-changes.mjs')
if (baseOk) {
  for (const rel of strip.STRAWMAN_STAGE_FILES) {
    ok(strip.stripStrawmanStage(rel, SOURCES[rel]) === baseSources[rel], `${rel}: without this change's lines it is the base's file, byte for byte`)
    ok(SOURCES[rel] !== baseSources[rel], `${rel}: it is changed`)
    const diff = git('diff', '--unified=0', ...diffTo, '--', rel).split('\n')
    const added = diff.filter(line => line.startsWith('+') && !line.startsWith('+++')), removed = diff.filter(line => line.startsWith('-') && !line.startsWith('---'))
    ok(added.every(line => strip.STRAWMAN_STAGE_MARKER_RE.test(line)), `${rel}: every added line carries the marker (${added.filter(line => !strip.STRAWMAN_STAGE_MARKER_RE.test(line)).length} do not)`)
    eq(removed, [], `${rel}: no existing line is rewritten or removed (pure insertions, so a later or earlier stacked change cannot be broken by this one)`)
  }
  eq(strip.STRAWMAN_STAGE_FILES, ['app/builder/page.tsx'], 'strip: one existing file gets marked lines')
  // flag off is the base: through the registry, the page is the base's, whatever else is stacked
  ok(registry.stripLaterChanges(PAGE, SOURCES[PAGE]) === registry.stripLaterChanges(PAGE, baseSources[PAGE]), 'registry: the page, read through it, is the base\'s (older proofs read it like that)')
  const envDiff = git('diff', '--unified=0', ...diffTo, '--', '.env.example').split('\n').filter(line => /^[-+]/.test(line) && !/^(---|\+\+\+)/.test(line))
  ok(envDiff.length > 0 && envDiff.every(line => line.startsWith('+')), '.env.example: only lines added')
  eq(envDiff.map(line => line.slice(1)).join('\n') + '\n', '\n' + strip.STRAWMAN_STAGE_ENV_BLOCK, '.env.example: exactly the block, after one blank line')
  // The committed diff only: other suites write into docs/ and scripts/ while they run, so the working tree and untracked files are never read for scope.
  const changed = git('diff', '--name-only', ...diffTo).split('\n').filter(Boolean)
  eq(changed.filter(rel => !strip.STRAWMAN_STAGE_SCOPE_FILES.has(rel)), [], 'scope: every file of the diff is this change\'s')
  for (const rel of ['components/builder/chat/message-list.tsx', 'lib/studio-stage-open-gate.ts']) ok(!changed.includes(rel), `scope: ${rel} is not touched (another builder\'s)`)
  for (const rel of strip.STRAWMAN_STAGE_NEW_FILES) ok(fs.existsSync(path.join(root, rel)), `scope: ${rel} exists`)
  ok(strip.STRAWMAN_STAGE_FILES.every(rel => !strip.STRAWMAN_STAGE_NEW_FILES.includes(rel)), 'scope: marked and new files are different lists')
  // the older proofs taught (none needed, or each one whole marked line for one whole line)
  for (const rel of strip.STRAWMAN_STAGE_PIN_FILES) {
    const head = readOwn(rel), baseText = git('show', `${strip.BASE_COMMIT}:${rel}`)
    ok(strip.stripStrawmanStage(rel, head) === baseText, `${rel}: with the taught lines put back it is the base's file, byte for byte`)
    for (const [has, was] of strip.STRAWMAN_STAGE_PIN_EDITS[rel]) {
      eq(head.split(has).length - 1, 1, `${rel}: a taught line is there once`)
      ok(has.endsWith('\n') && strip.STRAWMAN_STAGE_MARKER_RE.test(has) && has.includes(strip.STRAWMAN_STAGE_PIN_MARK) && (was === '' || was.endsWith('\n')), `${rel}: a taught line is one whole marked line`)
      ok(!strip.STRAWMAN_STAGE_MARKER_RE.test(was), `${rel}: what it replaces is not marked`)
    }
  }
} else console.log(`NOTE D  git has no ${strip.BASE_COMMIT.slice(0, 8)}: the base-identity and scope checks were skipped`)
// This change's own newest commit is found by its subject (the proof reads that commit's files, not HEAD's).
if (OWN) {
  ok(git('log', '-1', '--format=%s', OWN).startsWith(strip.STRAWMAN_STAGE_SUBJECT), `scope: the newest commit of this change is named "${strip.STRAWMAN_STAGE_SUBJECT} ..."`)
  ok(git('log', '-1', '--format=%P', OWN).trim().split(' ').length === 1, 'scope: ...an ordinary commit, not a merge')
  const trailer = git('log', '-1', '--format=%B', OWN)
  ok(/^Co-Authored-By: Claude [A-Za-z0-9. ]+ <noreply@anthropic\.com>$/m.test(trailer), 'scope: ...with the co-author trailer')
} else console.log(`NOTE D  no commit named "${strip.STRAWMAN_STAGE_SUBJECT} ..." yet: the files were read from the working tree`)
ok(registry.LATER_STRIPS.includes(strip.stripStrawmanStage), 'registry: the strip is named'); ok(registry.LATER_ENV_BLOCKS.includes(strip.STRAWMAN_STAGE_ENV_BLOCK), 'registry: the block is named')
ok([...strip.STRAWMAN_STAGE_SCOPE_FILES].every(rel => registry.LATER_CHANGE_FILES.has(rel)), 'registry: every file is named')
ok(strip.stripStrawmanStage('lib/other.ts', 'x // STRAWMAN-STAGE\n') === 'x // STRAWMAN-STAGE\n', 'strip: a file that is not this change\'s comes back as it is')
ok(strip.stripStrawmanStage(PAGE, 'a\nb // STRAWMAN-STAGE-X\nc // X-STRAWMAN-STAGE\nd // STRAWMAN-STAGE\n') === 'a\nb // STRAWMAN-STAGE-X\nc // X-STRAWMAN-STAGE\n', 'strip: the marker is a whole token')
ok(strip.stripStrawmanStage(PAGE, 'a\r\nb // STRAWMAN-STAGE\r\nc') === 'a\r\nc', 'strip: only the marked lines go, the other bytes stay')
console.log(`PASS D  sources: marked lines, gates, base identity, .env.example, scope, registry (${checks} checks)`)

// ============================================================================================================================================
// E. Mutants: every one must be caught
// ============================================================================================================================================
const libMutants = [
  ['flag: anything but "false" turns it on', "return value === 'true'", "return value !== 'false'"],
  ['flag: 1 turns it on', "return value === 'true'", "return value === 'true' || value === '1'"],
  ['the plain line says something else', "'No action needed: building starts automatically.'", "'No action needed.'"],
  ['phase: a strawman viewed after the build is the outline stage', "&& !input.finalPresentationUrl) return 'strawman'", ") return 'strawman'"],
  ['phase: template mode is not excluded', 'if (!input.enabled || input.templateModeOn) return null', 'if (!input.enabled) return null'],
  ['phase: the flag does not matter', 'if (!input.enabled || input.templateModeOn) return null', 'if (input.templateModeOn) return null'],
  ['phase: no preview deck still counts', "input.activeVersion === 'strawman' && input.strawmanPreviewUrl &&", "input.activeVersion === 'strawman' &&"],
  ['phase: the final version is not built', "if (input.activeVersion === 'final') return 'built'", "if (input.activeVersion === 'finalx') return 'built'"],
  ['chip: the service comes first', 'const type = readable(isRecord(context) ? context.content_type : null)', 'const type = readable(isRecord(slide) ? slide.service : null) ?? readable(isRecord(context) ? context.content_type : null)'],
  ['chip: a subtype is always added', "return subtype && subtype.toLowerCase() !== type.toLowerCase() ? `${type} \u00b7 ${subtype}` : type", "return subtype ? `${type} \u00b7 ${subtype}` : type"],
  ['chip: the underscores stay', "text.replace(/_+/g, ' ')", 'text'],
  ['chip: no capital', 'spaced.charAt(0).toUpperCase() + spaced.slice(1)', 'spaced'],
  ['chip: a subtype alone is a chip', "  return readable(isRecord(slide) ? slide.service : null)\n}", "  return readable(isRecord(slide) ? slide.service : null) ?? readable(isRecord(context) ? context.subtype : null)\n}"],
  ['plan: the key message comes last', "  add(isRecord(context) ? context.key_message : null)\n  const keyPoints = isRecord(slide) && Array.isArray(slide.key_points) ? slide.key_points : []\n  for (const point of keyPoints) add(point)", "  const keyPoints = isRecord(slide) && Array.isArray(slide.key_points) ? slide.key_points : []\n  for (const point of keyPoints) add(point)\n  add(isRecord(context) ? context.key_message : null)"],
  ['plan: repeated points are drawn', 'if (!text || seen.has(text.toLowerCase())) return', 'if (!text) return'],
  ['plan: a point that repeats the title is drawn', "const seen = new Set<string>(title ? [title.toLowerCase()] : [])", 'const seen = new Set<string>()'],
  ['plan: a title is made up when there is none', 'const title = plainText(isRecord(slide) ? slide.title : null)', "const title = plainText(isRecord(slide) ? slide.title : null) ?? 'Untitled slide'"],
  ['plan: an empty plan is drawn', 'if (!title && !chip && !points.length) return null', ''],
  ['plan: no cap', 'points: points.slice(0, STRAWMAN_STAGE_MAX_POINTS)', 'points'],
  ['plan: the cap is 3', 'export const STRAWMAN_STAGE_MAX_POINTS = 6', 'export const STRAWMAN_STAGE_MAX_POINTS = 3'],
  ['plan: an index past the end is no slide', 'const index = slides.length ? Math.min(wanted, slides.length - 1) : wanted', 'const index = wanted'],
  ['plan: a fraction is an index', 'Number.isInteger(input.index) && input.index >= 0 ? input.index : 0', 'typeof input.index === \'number\' && input.index >= 0 ? input.index : 0'],
  ['plan: the position is 0-based', 'position: slides.length ? index + 1 : null', 'position: slides.length ? index : null'],
  ['plan: white space is kept', "const collapsed = value.replace(/\\s+/g, ' ').trim()", 'const collapsed = value'],
  ['plan: a blank string is text', 'return collapsed || null', 'return collapsed'],
  ['step: the strawman is not remembered', "    return { shown: { presentationId: id, index }, pending: null }", "    return state"],
  ['step: a drop to slide 1 after the build started is followed', "    if (input.buildStarted && index === 0 && state.shown && state.shown.presentationId === id && state.shown.index > 0) return { shown: state.shown, pending: null }\n", ""],
  ['step: the drop is kept off even before the build started', 'if (input.buildStarted && index === 0', 'if (index === 0'],
  ['step: every index is kept off once the build started', 'if (input.buildStarted && index === 0 &&', 'if (input.buildStarted &&'],
  ['step: another strawman deck is kept off too', 'state.shown && state.shown.presentationId === id && state.shown.index > 0) return', 'state.shown && state.shown.index > 0) return'],
  ['build started: Director generating is not enough', 'return Boolean(input.generatingFinal) ||', 'return'],
  ['build started: generating alone says nothing', '(typeof input.narrationPhase === \'string\' && STRAWMAN_STAGE_BUILD_PHASES.includes(input.narrationPhase))', 'false'],
  ['build started: building is not a build phase', "['building', 'qa', 'finalizing', 'paused', 'stopped']", "['qa', 'finalizing', 'paused', 'stopped']"],
  ['build started: idle is a build phase', "['building', 'qa', 'finalizing', 'paused', 'stopped']", "['idle', 'building', 'qa', 'finalizing', 'paused', 'stopped']"],
  ['build started: a failed build is a build phase', "['building', 'qa', 'finalizing', 'paused', 'stopped']", "['building', 'qa', 'finalizing', 'paused', 'stopped', 'error']"],
  ['step: a user on slide 1 gets a return', 'replaced && state.shown.index > 0 ?', 'replaced ?'],
  ['step: the same deck gets a return', 'const replaced = state.shown.presentationId !== id', 'const replaced = true'],
  ['step: the slide is the new viewer\'s, not the user\'s', 'index: state.shown.index, at: input.now', 'index: input.index, at: input.now'],
  ['step: not applicable keeps what was remembered', "if (input.phase !== 'built') return initialStrawmanStageState()", "if (input.phase !== 'built') return state"],
  ['step: a return survives another deck', 'if (state.pending && state.pending.presentationId !== id) return { shown: null, pending: null }', ''],
  ['step: a built deck with no id decides', 'if (!id) return state', ''],
  ['step: a bad index is kept', 'typeof value === \'number\' && Number.isInteger(value) && value >= 0 ? value : 0', 'typeof value === \'number\' ? value : 0'],
  ['went: no hold', 'return { shown: state.shown, pending: null, held: true }', 'return { shown: state.shown, pending: null }'],
  ['hold: the hold outlives the build', "  if (state.held && input.buildStarted === false) return { shown: state.shown, pending: state.pending }\n", ''],
  ['hold: ends with any built tick', 'if (state.held && input.buildStarted === false)', 'if (state.held)'],
  ['hold: a strawman keeps it', "    return { shown: { presentationId: id, index }, pending: null }", "    return { shown: { presentationId: id, index }, pending: null, ...(state.held ? { held: true } : {}) }"],
  ['hold: needs no return', 'return input.held && input.phase === \'built\' && input.buildStarted', 'return input.phase === \'built\' && input.buildStarted'],
  ['hold: needs no built deck', 'return input.held && input.phase === \'built\' && input.buildStarted', 'return input.held && input.buildStarted'],
  ['hold: needs no running build', 'return input.held && input.phase === \'built\' && input.buildStarted', 'return input.held && input.phase === \'built\''],
  ['keep: waits for ever', 'input.now - pending.at > STRAWMAN_STAGE_KEEP_MAX_MS', 'false'],
  ['keep: gives up at 20 s sharp', 'input.now - pending.at > STRAWMAN_STAGE_KEEP_MAX_MS', 'input.now - pending.at >= STRAWMAN_STAGE_KEEP_MAX_MS'],
  ['keep: goes before the viewer is ready', "if (!input.hasViewerApi || !input.viewerReady) return", "if (!input.hasViewerApi) return"],
  ['keep: goes without the viewer api', "if (!input.hasViewerApi || !input.viewerReady) return", "if (!input.viewerReady) return"],
  ['keep: goes to a deck that does not hold the slide', "return pending.index < count ? { action: 'go', index: pending.index } : { action: 'drop' }", "return { action: 'go', index: pending.index }"],
  ['keep: off by one (a deck whose last slide is the one before)', "return pending.index < count ?", "return pending.index <= count ?"],
  ['keep: goes blind when the count is unknown', "  if (count === null) return { action: 'wait', retryInMs: STRAWMAN_STAGE_KEEP_RETRY_MS }\n", ''],
  ['keep: drops at once when the count is unknown', "  if (count === null) return { action: 'wait', retryInMs: STRAWMAN_STAGE_KEEP_RETRY_MS }", "  if (count === null) return { action: 'drop' }"],
  ['keep: looks every second', 'export const STRAWMAN_STAGE_KEEP_RETRY_MS = 250', 'export const STRAWMAN_STAGE_KEEP_RETRY_MS = 1000'],
  ['keep: a count of 0 is a known count', 'input.slideCount > 0 ? input.slideCount : null', 'input.slideCount >= 0 ? input.slideCount : null'],
]
const hookMutants = [
  // Each effect checks the flag on its own (so neither depends on the other for the flag-off guarantee): taking out one guard alone changes nothing anyone can see, taking out both does.
  ['the flag is read by neither effect', ['if (!STUDIO_STRAWMAN_STAGE_ENABLED) return\n    const before', 'if (!STUDIO_STRAWMAN_STAGE_ENABLED || !pending) return'], ['const before', 'if (!pending) return']],
  ['the slide is not remembered', '[input.phase, input.presentationId, input.currentSlideIndex, input.buildStarted])', '[input.phase, input.presentationId, input.buildStarted])'],
  ['the hold is not set at the return', '    setPending(null)\n    setHeld(true)\n', '    setPending(null)\n'],
  ['the hold is never returned', 'return STUDIO_STRAWMAN_STAGE_ENABLED && strawmanStageHold({ held, phase: input.phase, buildStarted: input.buildStarted })', 'return false'],
  ['the hold is not cleared when the step clears it', 'if (Boolean(after.held) !== Boolean(before.held)) setHeld(Boolean(after.held))\n', ''],
  ['the return does not record the hold in the state', 'stateRef.current = strawmanStageWent(stateRef.current)', 'stateRef.current = { ...stateRef.current, pending: null }'],
  ['the build start is not handed to the step', 'now: Date.now(), buildStarted: input.buildStarted })', 'now: Date.now() })'],
  ['the viewer need not be ready', 'Boolean(safety && safety.ready && !safety.busy && !safety.error && safety.presentationId === pending.presentationId)', 'true'],
  ['a viewer of another deck will do', 'safety.presentationId === pending.presentationId)', 'true)'],
  ['a busy viewer will do', 'safety.ready && !safety.busy && !safety.error', 'safety.ready && !safety.error'],
  ['an errored viewer will do', 'safety.ready && !safety.busy && !safety.error', 'safety.ready && !safety.busy'],
  ['the deck\'s slide count is not handed on', 'slideCount: current.slideCount,', 'slideCount: null,'],
  ['the return is made twice', "    stateRef.current = strawmanStageWent(stateRef.current)\n    setPending(null)\n    setHeld(true)\n    void Promise.resolve(current.goToSlide!(step.index)).catch(() => {})", "    setHeld(true)\n    void Promise.resolve(current.goToSlide!(step.index)).catch(() => {})"],
  ['a refusing viewer is an error', '.catch(() => {})', ''],
  ['the wait never looks again', 'const timer = setTimeout(() => setTick(value => value + 1), step.retryInMs)', 'const timer = setTimeout(() => {}, step.retryInMs)'],
  ['the wrong slide', 'current.goToSlide!(step.index)', 'current.goToSlide!(step.index + 1)'],
]
const planMutants = [
  ['the plain line is not drawn', '<p data-studio-strawman-plan-part="note">{STRAWMAN_STAGE_NO_ACTION_LINE}</p>', ''],
  ['the plain line is not the lib\'s', '{STRAWMAN_STAGE_NO_ACTION_LINE}', 'Building starts automatically.'],
  ['an Approve button is drawn', '<p data-studio-strawman-plan-part="note">', '<button type="button">Approve</button><p data-studio-strawman-plan-part="note">'],
  ['an empty plan is drawn', 'plan && hasPlan &&', 'plan &&'],
  ['the chip is drawn empty', '{plan.chip && <span', '{<span'],
  ['the title is drawn empty', '{plan.title && <h3', '{<h3'],
  ['the list is drawn empty', '{plan.points.length > 0 && (', '{('],
  ['the position is drawn without a total', 'plan.position !== null && plan.total !== null &&', 'plan.position !== null &&'],
  ['the words are markup', '<li key={i}>{point}</li>', '<li key={i} dangerouslySetInnerHTML={{ __html: point }} />'],
  ['the plan is not announced', ' aria-live="polite"', ''],
  ['the strip is not labelled', ' aria-label="Slide plan"', ''],
]
const sourceMutants = [
  ['page: the outline canvas stays on', '...(STUDIO_STRAWMAN_STAGE_ENABLED && strawmanPreviewUrl ? { enabled: false } : {}), // STRAWMAN-STAGE: no separate outline design over the deck viewer', '// STRAWMAN-STAGE: no separate outline design over the deck viewer', PAGE],
  ['page: the outline canvas goes off without the flag', '...(STUDIO_STRAWMAN_STAGE_ENABLED && strawmanPreviewUrl ? { enabled: false } : {}), // STRAWMAN-STAGE', '...({ enabled: false }), // STRAWMAN-STAGE', PAGE],
  ['page: the outline canvas goes off even without a preview deck', '...(STUDIO_STRAWMAN_STAGE_ENABLED && strawmanPreviewUrl ? { enabled: false } : {}), // STRAWMAN-STAGE', '...(STUDIO_STRAWMAN_STAGE_ENABLED ? { enabled: false } : {}), // STRAWMAN-STAGE', PAGE],
  ['page: the outline canvas is turned off by the phase, not the flag', '...(STUDIO_STRAWMAN_STAGE_ENABLED && strawmanPreviewUrl ? { enabled: false } : {}), // STRAWMAN-STAGE', "...(studioStrawmanPhase === 'strawman' ? { enabled: false } : {}), // STRAWMAN-STAGE", PAGE],
  ['page: the strip is drawn in every phase', "{studioStrawmanPhase === 'strawman' && <StudioStrawmanPlan", '{studioStrawmanPhase !== null && <StudioStrawmanPlan', PAGE],
  ['page: the strip is drawn with the flag off', "{studioStrawmanPhase === 'strawman' && <StudioStrawmanPlan", '{<StudioStrawmanPlan', PAGE],
  ['page: the strip is drawn without a plan', "<StudioStrawmanPlan plan={studioStrawmanPlan} />", '<StudioStrawmanPlan plan={null} />', PAGE],
  ['page: the plan is of slide 1 always', 'index: currentSlideIndex }) : null // STRAWMAN-STAGE', 'index: 0 }) : null // STRAWMAN-STAGE', PAGE],
  ['page: the plan ignores slide_context', 'contextByIndex: slideContextByIndex', 'contextByIndex: null', PAGE],
  ['page: the phase ignores the Studio shell', 'enabled: STUDIO_STRAWMAN_STAGE_ENABLED && studioShell', 'enabled: STUDIO_STRAWMAN_STAGE_ENABLED', PAGE],
  ['page: the phase ignores template mode', ' templateModeOn, activeVersion: effectiveActiveVersion', ' templateModeOn: false, activeVersion: effectiveActiveVersion', PAGE],
  ['page: the phase reads the raw version', 'activeVersion: effectiveActiveVersion', 'activeVersion', PAGE],
  ['page: the narration hold is not applied', "{...(studioStrawmanHold ? ({ narrationNavigate: null } as { narrationNavigate?: null }) : {})} // STRAWMAN-STAGE", '// STRAWMAN-STAGE', PAGE],
  ['page: the narration is held always', '{...(studioStrawmanHold ? ({ narrationNavigate: null }', '{...(true ? ({ narrationNavigate: null }', PAGE],
  ['page: the hook is not told the build has started', 'buildStarted: strawmanStageBuildStarted({ generatingFinal: isGeneratingFinal, narrationPhase: buildNarration.phase }), ', '', PAGE],
  ['page: the build start ignores Director generating', 'generatingFinal: isGeneratingFinal, narrationPhase', 'generatingFinal: false, narrationPhase', PAGE],
  ['page: the build start ignores the narration phase', 'narrationPhase: buildNarration.phase })', 'narrationPhase: null })', PAGE],
  ['page: the hook is not handed the viewer', ', viewerSafety: studioViewerSafety }) // STRAWMAN-STAGE', ' }) // STRAWMAN-STAGE', PAGE],
  ['page: the hook is not handed the goToSlide', 'goToSlide: layoutServiceApis?.goToSlide, viewerSafety: studioViewerSafety }) // STRAWMAN-STAGE', 'viewerSafety: studioViewerSafety }) // STRAWMAN-STAGE', PAGE],
  ['page: an import lost its marker', "import { useStudioStrawmanStage } from '@/hooks/use-studio-strawman-stage' // STRAWMAN-STAGE", "import { useStudioStrawmanStage } from '@/hooks/use-studio-strawman-stage'", PAGE],
  ['page: a line was added without the marker', "  const studioStrawmanPhase = strawmanStagePhase({", "  const unmarkedExtra = 1\n  const studioStrawmanPhase = strawmanStagePhase({", PAGE],
  ['page: the F-03 gate spot was touched', "  const studioFirstRunStage = ", "  const strawmanTouch = 1 // STRAWMAN-STAGE\n  const studioFirstRunStage = ", PAGE],
  ['page: an existing line is rewritten', "enabled: STUDIO_OUTLINE_CANVAS_ENABLED && studioShell,", "enabled: STUDIO_OUTLINE_CANVAS_ENABLED && studioShell && !STUDIO_STRAWMAN_STAGE_ENABLED, // STRAWMAN-STAGE", PAGE],
  ['hook: it sends something', 'void Promise.resolve(current.goToSlide!(step.index))', 'void fetch("/x"); void Promise.resolve(current.goToSlide!(step.index))', HOOK],
  ['strip component: it gets a click', '<section data-studio-strawman-plan="true"', '<section onClick={() => {}} data-studio-strawman-plan="true"', PLAN],
  ['css: the strip floats over the viewer', 'flex: none; box-sizing: border-box;', 'position: absolute; flex: none; box-sizing: border-box;', CSS],
  ['css: a colour of its own', 'background: var(--ss-surface);', 'background: #ffffff;', CSS],
  ['env: the flag defaults on', `${FLAG}="false"`, `${FLAG}="true"`, '.env.example'],
]
const COMPILED_LABELS = { lib: LIB, hook: HOOK, plan: PLAN }
function mutate(text, [name, from, to], label) {
  const pairs = Array.isArray(from) ? from.map((f, i) => [f, to[i]]) : [[from, to]]
  let out = text
  for (const [f, t] of pairs) {
    const at = out.indexOf(f)
    ok(at >= 0, `mutant "${name}" no longer matches the ${label} source`)
    out = out.slice(0, at) + t + out.slice(at + f.length)
  }
  ok(out !== text, `mutant "${name}" changes the ${label} source`)
  if (COMPILED_LABELS[label]) compile(out, COMPILED_LABELS[label]) // a mutant that is not even valid code proves nothing: fail loudly
  return out
}
const survivors = [], crashes = []
const afterMutants = checks
const caughtAsync = async (name, run) => { try { await run() } catch (error) { if (error?.name !== 'AssertionError') crashes.push(`${name}: ${String(error?.message).slice(0, 60)}`); return } survivors.push(name) }
let mutantCount = 0
for (const mutant of libMutants) {
  mutantCount++
  const text = mutate(SOURCES[LIB], mutant, 'lib')
  const before = checks
  await caughtAsync(`lib: ${mutant[0]}`, async () => { libSuite(loadLib(text), text); planSuite(loadLib(text)); await hookSuite(worldMaker({ libText: text })) })
  checks = before
}
for (const mutant of hookMutants) {
  mutantCount++
  const text = mutate(SOURCES[HOOK], mutant, 'hook')
  const before = checks
  await caughtAsync(`hook: ${mutant[0]}`, () => hookSuite(worldMaker({ hookText: text })))
  checks = before
}
for (const mutant of planMutants) {
  mutantCount++
  const text = mutate(SOURCES[PLAN], mutant, 'plan')
  const before = checks
  await caughtAsync(`plan: ${mutant[0]}`, () => planSuite(realLib, text))
  checks = before
}
for (const [name, from, to, rel] of sourceMutants) {
  mutantCount++
  const broken = mutate(SOURCES[rel], [name, from, to], rel)
  const before = checks
  await caughtAsync(`source: ${name}`, () => {
    if (rel === CSS) { planSuite(realLib, SOURCES[PLAN], broken); return }
    sourceSuite({ ...SOURCES, [rel]: broken }, { base: baseSources })
    if (baseSources && rel === PAGE) {
      ok(strip.stripStrawmanStage(rel, broken) === baseSources[rel], 'without its marked lines the file is still the base\'s')
      const diff = lines(broken).filter(line => !lines(baseSources[rel]).includes(line)); ok(diff.every(line => strip.STRAWMAN_STAGE_MARKER_RE.test(line)), 'every added line carries the marker')
      ok(lines(baseSources[rel]).every(line => lines(broken).includes(line)), 'no existing line is rewritten')
    }
  })
  checks = before
}
// the strip module itself
const stripText = fs.readFileSync(path.join(root, 'scripts/studio-strawman-stage-strip.mjs'), 'utf8')
const loadStrip = text => evalModule(text, 'studio-strawman-stage-strip.ts', {}, {})
let stripMutantCount = 0
if (baseSources) {
  const stripMutants = [
    ['the marker matches inside a word', "/(?<![\\w-])STRAWMAN-STAGE(?![\\w-])/", '/STRAWMAN-STAGE/'],
    ['only the first marked line goes', '.filter(line => !STRAWMAN_STAGE_MARKER_RE.test(line))', ".filter((line, at, all) => !STRAWMAN_STAGE_MARKER_RE.test(line) || all.findIndex(l => STRAWMAN_STAGE_MARKER_RE.test(l)) !== at)"],
    ['another file is stripped too', "if (!STRAWMAN_STAGE_FILES.includes(rel)) return text", 'if (false) return text'],
    ['the page is not stripped', "export const STRAWMAN_STAGE_FILES = [\n  'app/builder/page.tsx',\n]", 'export const STRAWMAN_STAGE_FILES = []'],
    ...(strip.STRAWMAN_STAGE_PIN_FILES.length ? [['a taught line is not put back', 'return (STRAWMAN_STAGE_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)', 'return text']] : []),
    ['the line ends are normalised', "text.split('\\n').filter", "text.replace(/\\r/g, '').split('\\n').filter"],
  ]
  for (const mutant of stripMutants) {
    mutantCount++; stripMutantCount++
    const mod = loadStrip(mutate(stripText, mutant, 'strip'))
    const unchangedOther = mod.stripStrawmanStage('lib/other.ts', 'x // STRAWMAN-STAGE\n') === 'x // STRAWMAN-STAGE\n'
    const wholeToken = mod.stripStrawmanStage(PAGE, 'b // STRAWMAN-STAGE-X\n') === 'b // STRAWMAN-STAGE-X\n'
    const bytes = mod.stripStrawmanStage(PAGE, 'a\r\nb // STRAWMAN-STAGE\r\nc') === 'a\r\nc'
    const baseIdentity = strip.STRAWMAN_STAGE_FILES.every(rel => mod.stripStrawmanStage(rel, SOURCES[rel]) === baseSources[rel]) && strip.STRAWMAN_STAGE_PIN_FILES.every(rel => mod.stripStrawmanStage(rel, readOwn(rel)) === git('show', `${strip.BASE_COMMIT}:${rel}`))
    if (unchangedOther && wholeToken && bytes && baseIdentity) survivors.push(`strip: ${mutant[0]}`)
  }
}
eq(survivors, [], `every mutant is caught (survivors: ${survivors.join('; ') || 'none'})`)
console.log(`PASS E  ${mutantCount} mutants (lib ${libMutants.length}, hook ${hookMutants.length}, strip component ${planMutants.length}, sources ${sourceMutants.length}, strip ${stripMutantCount}), every one caught${crashes.length ? ` (${crashes.length} by a thrown error rather than an assertion)` : ''}`)
if (process.env.STRAWMAN_TEST_VERBOSE) for (const crash of crashes) console.log(`  threw: ${crash}`)
release()
console.log(`OK studio strawman stage: ${afterMutants} checks`)
