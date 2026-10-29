// FRONTEND-2 (B50, 29 Oct; parity rows 43 and 45, E2E-2 run-B3: a chat "Shorten this" on a slide TITLE came back "Done" while the title was rewritten from the instruction): proof of the Studio INTERIM
// (NEXT_PUBLIC_STUDIO_CHAT_REFINE_STRUCTURAL_DECLINE, exact "true", default off, build-time). A chat refine of a TEXT_BOX whose semantic role is a KNOWN STRUCTURAL role (every role but BODY_TEXT) is answered
// element_directive_result {status: "failed", error_code: "unsupported_type"} BEFORE any generation; Director says its own flagged line (Studio adds no copy). Everything else is refined as today.
//
//   node scripts/test-studio-chat-refine-structural-decline.mjs         # offline, no network, no model call: Text Labs is a recorder
//   CHECK_ONLY=<text in a check's label> node scripts/...               # one check only
//
// WHAT RUNS. The REAL chat refine runner (lib/chat-element-refine.ts, runElementRefineDirective) with lib/chat-refine-structural-decline.ts, lib/chat-element-refine-wire.ts, lib/mdc-element-directive.ts and the page's own
// element-type mapping and blank-placeholder rule (lib/element-semantic-type.ts, lib/element-blank-policy.ts) in a vm; the REAL buildRefineContext (hooks/use-element-refinement.ts, useCallback as the identity, which IS the page's);
// the REAL socket send (sendElementDirectiveResult, cut out of hooks/use-deckster-websocket-v2.ts by AST) for the exact frame. The only stand-ins are the ones the runner's deps are: the viewer bridge (it answers the REAL payloads below) and
// generate (it records what the runner would start: handleApprovedTextLabsGenerate -> Text Labs).
// THE PAYLOADS ARE REAL. B47's capture (scripts/fixtures/chat-refine-structural-decline/b47-capture.json, copied verbatim from B47's root-cause run, 29 Oct): the REAL Layout viewer's requestElementRefine payload for E2E-2's template title
// (SLIDE_TITLE, slot title / structural; Layout's real viewer code, run in a node vm) and what Studio's REAL useTextLabsGeneration then sends Text Labs for the chat refine. The viewer reply built from it here is checked by a round trip:
// the REAL buildRefineContext of it gives exactly the capture's existing_element. The recorded text box with NO role (scripts/fixtures/chat-element-refine/layout-replies.json, Layout !245's real viewer code) and the recorded chart are real too.
// A body text box (BODY_TEXT), the other 14 structural roles and unknown roles are VARIATIONS on the captured envelope (only the role, and for the body its slot, change): they are built from the contract, and the proof says so where it matters.
// THE FRAMES ARE RECORDED. DIRECTOR-2's seven recorded examples for rows 43/45 (workspace main 4c47fbd2, streams/director2/refine-unsupported/examples, Director MR !599 9a60d351), copied byte for byte to
// scripts/fixtures/chat-refine-structural-decline/director-frames and pinned by sha256: each carries Director's element_refine_directive and the element_directive_result Director expects back from Studio. Their directive is replayed
// through the real runner (flag on) and Studio's reply, through the real socket send, must be that frame byte for byte. The other scenarios vary the element and the role on the recorded envelope of DIRECTOR-2's older 01-success.json
// (scripts/fixtures/chat-element-refine/director-frames) and on B47's capture.
//
// What it proves:
//  1. the role set: every role but BODY_TEXT, identical to Studio's TextSemanticRole union (types/textlabs.ts), the slot catalog's TEXT_ROLES (lib/text-slot-catalog.ts) and the Text Service's SemanticTextRole enum, pinned from
//     backend/text-service app/models/atomic_models.py; a missing role (the Text Service's own default is BODY_TEXT), BODY_TEXT and an unknown role are NOT structural (the match is exact and upper case);
//  2. flag on: the captured template title (SLIDE_TITLE) and each of the 15 structural roles on a TEXT_BOX: failed / unsupported_type, deps.generate NOT called, no viewer command but the one payload read;
//  3. flag on: a body text box (BODY_TEXT), a text box with no role (null, absent, the recorded real one) and unknown roles: today's refine (generate called once, the same formData and result as dev's runner);
//  4. flag on: every other component type is unchanged, even with a structural role in its payload (the K5 types are refined, the others are unsupported_type as today); the guards before it keep their answers (not_owner,
//     dismissed, element_not_found, a blank placeholder, an empty instruction) and the decline comes after them;
//  5. flag off (unset, "false", "TRUE", "1", ...): byte-identical to dev's runner (hashed results, generations and viewer commands for the whole matrix); the strip gives dev's file back byte for byte, every added line is marked;
//  6. the result frame's exact shape and bytes (through the real socket send), and no new copy;
//  7. mutants are caught; 8. scope over the COMMITTED diff, GATE-SAFE and robust after merge (own commits by SUBJECT across `rev-list --no-merges BASE..head`, HEAD^2 on the gate's merge, registry / .env.example / strip reads
//     past later changes), proved on a gate-style merge, on a merge onto an advanced dev and on a synthetic change stacked after this one.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import {
  BASE_COMMIT, CHAT_REFINE_STRUCTURAL_DECLINE_FILES, CHAT_REFINE_STRUCTURAL_DECLINE_NEW_FILES, CHAT_REFINE_STRUCTURAL_DECLINE_PIN_FILES, CHAT_REFINE_STRUCTURAL_DECLINE_PIN_EDITS, CHAT_REFINE_STRUCTURAL_DECLINE_PIN_MARK,
  CHAT_REFINE_STRUCTURAL_DECLINE_SCOPE_FILES, CHAT_REFINE_STRUCTURAL_DECLINE_ENV_BLOCK, CHAT_REFINE_STRUCTURAL_DECLINE_MARKER_RE, CHAT_REFINE_STRUCTURAL_DECLINE_SUBJECT, CHAT_REFINE_STRUCTURAL_DECLINE_FLAG,
  stripChatRefineStructuralDecline,
} from './studio-chat-refine-structural-decline-strip.mjs'
import * as registry from './studio-later-changes.mjs'

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value))
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const [RUNNER, LIB, WIRE] = ['lib/chat-element-refine.ts', 'lib/chat-refine-structural-decline.ts', 'lib/chat-element-refine-wire.ts']
const FIXTURE = 'scripts/fixtures/chat-refine-structural-decline/b47-capture.json'

/** The strips of every change registered AFTER this one (below this change's strip in LATER_STRIPS), applied first: a file is read as this change left it, whatever a later change marked in it. */
const laterStrips = (rel, text) => { const at = registry.LATER_STRIPS.indexOf(stripChatRefineStructuralDecline); return (at === -1 ? [] : registry.LATER_STRIPS.slice(at + 1)).reduce((out, strip) => { const next = typeof strip === 'function' ? strip(rel, out) : out; return typeof next === 'string' ? next : out }, text) }
const laterRead = rel => laterStrips(rel, read(rel))
/** Every OTHER registered change's strip, in the registry's order (this change's is left out). */
const applyAll = (list, rel, text) => list.reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text)
const otherStrips = (rel, text) => applyAll(registry.LATER_STRIPS.filter(strip => strip !== stripChatRefineStructuralDecline), rel, text)
const laterBlocks = () => { const at = registry.LATER_ENV_BLOCKS.indexOf(CHAT_REFINE_STRUCTURAL_DECLINE_ENV_BLOCK); return at === -1 ? [] : registry.LATER_ENV_BLOCKS.slice(at + 1) }
/** `text` (an .env.example) without the blocks registered AFTER this one: theirs, not this change's. */
const withoutLaterEnvBlocks = text => laterBlocks().reduce((out, block) => { const body = String(block).replace(/^\n+/, '').replace(/\n+$/, ''); return body === '' ? out : out.replace(`\n${body}\n`, () => '') }, text)

let passed = 0
const failed = []
async function check(label, fn) {
  if (process.env.CHECK_ONLY && !label.includes(process.env.CHECK_ONLY)) return
  try { await fn(); passed++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${process.env.FULL_ERRORS ? error?.stack : error?.stack?.split('\n').slice(0, 5).join(' | ') ?? error}`) }
}
let caught = 0
const missed = []
async function mutant(label, run) {
  if (process.env.CHECK_ONLY) return
  try { await run(); missed.push(label); console.error(`MISSED mutant ${label}`) } catch (error) {
    if (error?.mutationDidNotApply) { missed.push(label); console.error(`MISSED mutant ${label}: the mutation did not apply (${error.message})`); return } // a swap that finds no anchor must not count as a catch
    caught++; console.log(`CAUGHT mutant ${label}`)
  }
}
const swap = (text, from, to) => { if (text.split(from).length !== 2) throw Object.assign(new Error(`exactly one ${JSON.stringify(from.slice(0, 80))}`), { mutationDidNotApply: true }); return text.replace(from, () => to) }

// ---- the Studio libs in a vm --------------------------------------------------------------------------------------------------------------------------------
const FLAG = CHAT_REFINE_STRUCTURAL_DECLINE_FLAG
const ENV_ON = { NEXT_PUBLIC_CHAT_ELEMENT_REFINE: 'true', [FLAG]: 'true' }, ENV_OFF = { NEXT_PUBLIC_CHAT_ELEMENT_REFINE: 'true' }
function makeLibs({ env = ENV_ON, overrides = {} } = {}) {
  const cache = new Map()
  const load = file => {
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }
    cache.set(file, module)
    const text = overrides[file] ?? (file === RUNNER ? laterRead(file) : read(file)) // the runner as this change left it (a later change's marked lines out)
    const out = ts.transpileModule(text, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
    const sandbox = { module, exports: module.exports, process: { env }, console, URL, Promise, Error, JSON, Math, Set, Map, Object, Array, Number, String, Boolean, RegExp, Symbol, parseFloat, isFinite,
      require(spec) {
        if (spec === 'react') return { useCallback: fn => fn }
        if (spec.startsWith('@/')) for (const ext of ['.ts', '.tsx']) if (fs.existsSync(path.join(root, spec.slice(2) + ext))) return load(spec.slice(2) + ext)
        throw new Error(`unexpected dependency ${spec} of ${file}`)
      } }
    vm.runInNewContext(out, sandbox, { filename: file }) // no fetch, no WebSocket, no timers in the sandbox: nothing here can reach a network
    return module.exports
  }
  return { load, runner: load(RUNNER), lib: load(LIB), wire: load(WIRE), semantic: load('lib/element-semantic-type.ts'), blank: load('lib/element-blank-policy.ts'), refinement: load('hooks/use-element-refinement.ts') }
}
const runnerText = laterRead(RUNNER), libText = read(LIB)
/** dev's runner: this change's marked lines out. */
const DEV_OVERRIDES = { [RUNNER]: stripChatRefineStructuralDecline(RUNNER, runnerText) }
const devLibs = makeLibs({ env: ENV_OFF, overrides: DEV_OVERRIDES })
const onLibs = makeLibs({ env: ENV_ON }), offLibs = makeLibs({ env: ENV_OFF })

// ---- the real payloads ----------------------------------------------------------------------------------------------------------------------------------------
const capture = JSON.parse(read(FIXTURE))
const existing = capture.chat.body.existing_element
// useTextLabsGeneration adds normalized_component_type when it builds the Text Labs request; buildRefineContext (the runner's side) does not, so the round trip compares everything else.
const { normalized_component_type: capturedNormalizedType, ...capturedContext } = existing
const INSTRUCTION = capture.chat.body.message
const SESSION = 's_e2e', PRESENTATION = capture.chat.body.presentation_id // 'd68f9b14': E2E-2's deck
const SLIDE_ID = 'slide_3ccd465f4de3'
const recordedFrames = name => JSON.parse(read(`scripts/fixtures/chat-element-refine/director-frames/${name}.json`)).frames
const recordedDirective = recordedFrames('01-success').find(item => item.frame.type === 'element_refine_directive').frame
const recordedFailedResult = recordedFrames('02-failed').find(item => item.frame.type === 'element_directive_result').frame
const layoutReplies = JSON.parse(read('scripts/fixtures/chat-element-refine/layout-replies.json')).replies.on // Layout !245's real viewer code: [0] a chart, [1] a text box with no role
/** The viewer's requestElementRefine data for B47's template title: the capture's own fields (the viewer's payload keys, as Layout's recorded replies name them). `over` varies it. */
function titleData(over = {}) {
  const data = {
    type: 'refineElementRequested', elementId: existing.element_id, elementType: existing.renderer_type, componentType: existing.component_type,
    themeVariantId: existing.theme_variant_id, themeBindings: existing.theme_bindings, styleOwner: existing.style_owner, themeVariantSource: existing.theme_variant_source, metricsColorVariant: existing.metrics_color_variant,
    research_provenance: existing.research_provenance, semanticRole: capture.payload_semantic_role, slotName: capture.payload_slot[0], slotKind: capture.payload_slot[1], accessoryType: existing.accessory_type,
    generationConfig: existing.generation_config, citations_used: existing.citations_used, diagram_subtype: existing.diagram_subtype, z_index: existing.z_index, slideIndex: 0, gridPosition: existing.grid_position, isBlank: false,
    formatting: existing.formatting, properties: existing.properties, content: capture.payload_content, ...over,
  }
  for (const key of Object.keys(data)) if (data[key] === undefined) delete data[key]
  return data
}
/** Director's element_refine_directive for an element: DIRECTOR-2's recorded frame (01-success) with the element, the slide and the instruction set. */
function directiveFor(elementId, instruction = INSTRUCTION, elementType = 'TEXT_BOX', slideIndex = 0) {
  const message = plain(recordedDirective)
  message.payload = { ...message.payload, presentation_id: PRESENTATION, slide_index: slideIndex, slide_id: SLIDE_ID, element_id: elementId, element_type: elementType, instruction }
  return message
}
const OWNER = { sessionId: SESSION, isCurrent: () => true }

/** One chat refine through a lib set: the runner's deps are the page's own functions (real) with a viewer that answers `data` and a generate that records. Everything is returned as plain data. */
async function runCase(libs, spec) {
  const generations = [], commands = []
  let busyCalls = 0, slide = 0
  const buildRefineContext = libs.refinement.useElementRefinement({ slideContextByIndex: null, deckContext: null, sessionStoreName: null, sessionId: SESSION, currentSlideIndex: 0 })
  const presentation = spec.presentationId ?? PRESENTATION
  const deps = {
    displayed: () => ({ sessionId: SESSION, deckOwnerSessionId: SESSION, presentationId: presentation, epoch: 0 }),
    isBusy: () => spec.busy ? spec.busy(++busyCalls) : false,
    slideCount: () => 3,
    currentSlideIndex: () => slide,
    goToSlide: async index => { commands.push({ action: 'goToSlide', index }); slide = index },
    sendElementCommand: async (action, params) => {
      commands.push({ action, params: plain(params) })
      if (spec.viewerError) throw new Error(spec.viewerError)
      if (action !== 'requestElementRefine') throw new Error(`unexpected viewer command ${action}`)
      return { success: true, action, requestId: 'probe-1', elementId: params.elementId, data: spec.reply ?? spec.data }
    },
    componentTypeOf: payload => libs.semantic.normalizeSemanticComponentType(payload.componentType ?? payload.elementType),
    isBlankPlaceholder: payload => libs.blank.shouldOpenAsBlankPlaceholder(payload, undefined),
    buildRefineContext,
    generate: async (formData, invocation) => {
      generations.push({ formData: plain(formData), invocation: plain(invocation) })
      return spec.generateResult ?? { status: 'inserted', presentationId: presentation, slideIndex: invocation.slideIndex, elementIds: ['el_refined'] }
    },
    settle: async () => {},
    ...(spec.deps ? spec.deps(libs) : {}),
  }
  const elementId = spec.elementId ?? spec.data?.elementId
  const result = await libs.runner.runElementRefineDirective(spec.message ?? directiveFor(elementId, spec.instruction ?? INSTRUCTION, spec.data?.componentType ?? 'TEXT_BOX', spec.data?.slideIndex ?? 0), spec.owner ?? OWNER, deps)
  return plain({ result, generations, commands })
}
const word = outcome => `${outcome.result.status}${outcome.result.error_code ? `:${outcome.result.error_code}` : ''}/${outcome.generations.length}`

// ---- the matrix: every case, with what each lib set must answer --------------------------------------------------------------------------------------------------------------
const textLabsUnion = (() => { const block = /export type TextSemanticRole =([\s\S]*?)\n\nexport type TextGeometryMode/.exec(read('types/textlabs.ts')); assert.ok(block, 'types/textlabs.ts TextSemanticRole'); return [...block[1].matchAll(/'([A-Z_]+)'/g)].map(match => match[1]) })()
const slotCatalogRoles = (() => { const block = /const TEXT_ROLES = new Set<TextSemanticRole>\(\[([\s\S]*?)\]\)/.exec(read('lib/text-slot-catalog.ts')); assert.ok(block, 'lib/text-slot-catalog.ts TEXT_ROLES'); return [...block[1].matchAll(/'([A-Z_]+)'/g)].map(match => match[1]) })()
/** backend/text-service app/models/atomic_models.py `class SemanticTextRole(str, Enum)` (lines 113-130, 29 Oct), in its order: pinned here; the structural branch is app/api/atomic_routes.py:1444 `request.semantic_role != SemanticTextRole.BODY_TEXT`. */
const TEXT_SERVICE_ROLES = ['BODY_TEXT', 'SLIDE_TITLE', 'SLIDE_SUBTITLE', 'PRESENTATION_TITLE', 'PRESENTATION_SUBTITLE', 'EYEBROW', 'AUTHOR_INFO', 'SECTION_NUMBER', 'SECTION_TITLE', 'SECTION_SUBTITLE', 'CLOSING_TITLE', 'CLOSING_SUBTITLE', 'CONTACT_INFO', 'QUOTE_ATTRIBUTION', 'FOOTER', 'SOURCES']
const STRUCTURAL = TEXT_SERVICE_ROLES.filter(role => role !== 'BODY_TEXT')
const UNKNOWN_ROLES = ['MADE_UP_ROLE', 'slide_title', 'Slide_Title', ' SLIDE_TITLE', 'SLIDE_TITLE ', 'SLIDE-TITLE', '', 'body_text', 'BODY', 'toString', 'constructor', '__proto__', 'hasOwnProperty', 'valueOf']
const K5_OTHER = ['METRICS', 'TABLE', 'CHART', 'IMAGE', 'ICON_LABEL', 'SHAPE']
/** [name, spec, declinedWhenOn, the answer when on (guard cases only)]. A declined case answers failed / unsupported_type with no generation; every other case answers what dev's runner answers. */
const CASES = [
  ['B47 capture: the template title (SLIDE_TITLE, slot title / structural)', { data: titleData() }, true],
  ...STRUCTURAL.map(role => [`structural role ${role} on a text box`, { data: titleData({ semanticRole: role }) }, true]),
  ['BODY_TEXT, slot body / body', { data: titleData({ semanticRole: 'BODY_TEXT', slotName: 'body', slotKind: 'body' }) }, false],
  ['BODY_TEXT, no slot', { data: titleData({ semanticRole: 'BODY_TEXT', slotName: null, slotKind: null }) }, false],
  ['no role: Layout\'s recorded real text box (semanticRole null)', { data: layoutReplies[1].reply.data, elementId: layoutReplies[1].reply.data.elementId }, false],
  ['role null on the captured envelope', { data: titleData({ semanticRole: null }) }, false],
  ['role absent on the captured envelope', { data: titleData({ semanticRole: undefined }) }, false],
  ...UNKNOWN_ROLES.map(role => [`unknown role ${JSON.stringify(role)}`, { data: titleData({ semanticRole: role }) }, false]),
  ...[7, true, {}, ['SLIDE_TITLE']].map(role => [`role that is not a string ${JSON.stringify(role)}`, { data: titleData({ semanticRole: role }) }, false]),
  ...K5_OTHER.map(type => [`${type} with a structural role in its payload`, { data: titleData({ componentType: type, elementType: type.toLowerCase() }) }, false]),
  ['INFOGRAPHIC (outside the 7 K5 types) with a structural role: unsupported_type as today', { data: titleData({ componentType: 'INFOGRAPHIC', elementType: 'infographic' }) }, false],
  ['DIAGRAM (outside the 7 K5 types) with a structural role: unsupported_type as today', { data: titleData({ componentType: 'DIAGRAM', elementType: 'diagram' }) }, false],
  ['Layout\'s recorded real chart', { data: layoutReplies[0].reply.data, elementId: layoutReplies[0].reply.data.elementId }, false],
  // the guards before the decline keep their answers, structural title or not
  ['title, the Element panel is busy: dismissed (step 2)', { data: titleData(), busy: () => true }, false, 'dismissed/0'],
  ['title, a busy race after the form is built: the decline stands (the box cannot be refined from chat at all)', { data: titleData(), busy: call => call >= 2 }, true, 'failed:unsupported_type/0'],
  ['body, a busy race after the form is built: dismissed as today', { data: titleData({ semanticRole: 'BODY_TEXT' }), busy: call => call >= 2 }, false, 'dismissed/0'],
  ['title, another session owns the deck: not_owner', { data: titleData(), deps: () => ({ displayed: () => ({ sessionId: SESSION, deckOwnerSessionId: 'other', presentationId: PRESENTATION, epoch: 0 }) }) }, false, 'failed:not_owner/0'],
  ['title, the viewer no longer has the element: element_not_found', { data: titleData(), viewerError: 'element_not_found' }, false, 'failed:element_not_found/0'],
  ['title, the viewer answers another element: element_not_found', { data: titleData({ elementId: 'slide_other_textbox_00000000' }), elementId: existing.element_id }, false, 'failed:element_not_found/0'],
  ['title, a blank placeholder: unsupported_type as today', { data: titleData(), deps: () => ({ isBlankPlaceholder: () => true }) }, false, 'failed:unsupported_type/0'],
  ['title, an empty instruction: generation_failed as today (the decline answers only where a generation would have started)', { data: titleData(), instruction: '   ' }, false, 'failed:generation_failed/0'],
  ['title, the refine context cannot be built: generation_failed as today', { data: titleData(), deps: () => ({ buildRefineContext: () => { throw new Error('boom') } }) }, false, 'failed:generation_failed/0'],
]
const DECLINED = { generations: 0, commands: ['requestElementRefine'] }
const declinedOutcome = (spec) => plain({ result: { directive_id: recordedDirective.payload.directive_id, status: 'failed', element_id: spec.elementId ?? spec.data.elementId, error_code: 'unsupported_type' }, generations: [], commands: [{ action: 'requestElementRefine', params: { elementId: spec.elementId ?? spec.data.elementId } }] })

const DEV = new Map()
for (const [name, spec] of CASES) DEV.set(name, await runCase(devLibs, spec))
/** The whole matrix against a lib set with the flag ON: declined cases answer the contract, every other case answers dev's, to the byte. */
async function holdsOn(libs) {
  for (const [name, spec, declined] of CASES) {
    const got = await runCase(libs, spec)
    assert.deepEqual(got, declined ? declinedOutcome(spec) : DEV.get(name), name)
  }
}
/** The whole matrix against a lib set with the flag OFF (or any value but the exact "true"): every case answers dev's, to the byte. */
async function holdsOff(libs) {
  for (const [name, spec] of CASES) assert.deepEqual(await runCase(libs, spec), DEV.get(name), name)
}

// ===== 1. the role set ====================================================================================================================================================
await check('the role set: every role but BODY_TEXT; identical to the TextSemanticRole union (types/textlabs.ts), the slot catalog\'s TEXT_ROLES and the Text Service\'s SemanticTextRole enum (pinned); a missing role is BODY_TEXT\'s default there', () => {
  assert.deepEqual(textLabsUnion, TEXT_SERVICE_ROLES, 'Studio\'s union is the Text Service\'s enum, in order')
  assert.deepEqual(slotCatalogRoles, TEXT_SERVICE_ROLES, 'the slot catalog\'s role set is the same')
  const { lib } = onLibs
  assert.deepEqual([...lib.STRUCTURAL_TEXT_ROLES], STRUCTURAL, 'the lib\'s structural roles are the 15 non-body roles, in the enum\'s order')
  assert.equal(STRUCTURAL.length, 15)
  assert.ok(!lib.STRUCTURAL_TEXT_ROLES.includes('BODY_TEXT'))
  for (const role of TEXT_SERVICE_ROLES) assert.equal(lib.isStructuralTextRole(role), role !== 'BODY_TEXT', role)
  for (const role of [null, undefined, '', 'MADE_UP', 'slide_title', ' SLIDE_TITLE', 'toString', '__proto__', 0, 7, true, {}, [], ['SLIDE_TITLE']]) assert.equal(lib.isStructuralTextRole(role), false, String(role))
  for (const role of STRUCTURAL) { assert.equal(lib.declinesStructuralRefine('TEXT_BOX', role), true, role); for (const type of ['METRICS', 'TABLE', 'CHART', 'IMAGE', 'ICON_LABEL', 'SHAPE', 'INFOGRAPHIC', 'text_box', null, undefined, 7]) assert.equal(lib.declinesStructuralRefine(type, role), false, `${type} ${role}`) }
  for (const role of ['BODY_TEXT', null, undefined, 'x']) assert.equal(lib.declinesStructuralRefine('TEXT_BOX', role), false, String(role))
  assert.match(libText, /process\.env\.NEXT_PUBLIC_STUDIO_CHAT_REFINE_STRUCTURAL_DECLINE === 'true'/, 'the flag is read as the literal member expression Next inlines at build time, against the exact "true"')
  assert.match(libText, /Record<Exclude<TextSemanticRole, 'BODY_TEXT'>, true>/, 'the table is typed over the union, so tsc fails when a role is added or dropped without it')
  assert.doesNotMatch(libText, /^\s*import\s+(?!type\b)/m, 'the lib has no runtime import (types only)')
})
await check('the flag: on only for the exact "true"; any other value is off (the lib and the runner read the same constant); .env.example has the block after a blank line', () => {
  for (const value of [undefined, '', 'false', 'TRUE', 'True', '1', 'yes', ' true', 'true ', 'on', 'enabled']) assert.equal(makeLibs({ env: { ...ENV_OFF, ...(value === undefined ? {} : { [FLAG]: value }) } }).lib.CHAT_REFINE_STRUCTURAL_DECLINE_ENABLED, false, JSON.stringify(value))
  assert.equal(makeLibs({ env: { ...ENV_OFF, [FLAG]: 'true' } }).lib.CHAT_REFINE_STRUCTURAL_DECLINE_ENABLED, true)
  assert.equal(makeLibs({ env: ENV_ON }).lib.CHAT_REFINE_STRUCTURAL_DECLINE_ENABLED, true)
  assert.ok(read('.env.example').includes(`\n\n${CHAT_REFINE_STRUCTURAL_DECLINE_ENV_BLOCK}`), 'the block, after a blank line')
  assert.match(CHAT_REFINE_STRUCTURAL_DECLINE_ENV_BLOCK, new RegExp(`\\n${FLAG}="false"\\n$`), 'documented as "false"')
})

// ===== 2. the real payloads ================================================================================================================================================
await check('B47\'s capture: the viewer reply built from it, through the REAL buildRefineContext, is exactly the capture\'s existing_element; the form the chat refine sends carries the capture\'s role and message', async () => {
  const data = titleData()
  assert.equal(data.semanticRole, 'SLIDE_TITLE'); assert.deepEqual([data.slotName, data.slotKind], ['title', 'structural'])
  const context = offLibs.refinement.useElementRefinement({ slideContextByIndex: null, deckContext: null, sessionStoreName: null, sessionId: 's', currentSlideIndex: 0 })(data, 'TEXT_BOX')
  assert.deepEqual(plain(context.existingElement), plain(capturedContext), 'the refine context\'s existing_element is the capture\'s (bar the field the Text Labs request adds)'); assert.equal(capturedNormalizedType, 'TEXT_BOX')
  assert.equal(context.semanticRole, capture.chat.body.semantic_role, 'refineContext.semanticRole is what Studio sends as semantic_role')
  const formData = offLibs.runner.chatRefineFormData('TEXT_BOX', INSTRUCTION, context)
  assert.equal(formData.semanticRole, capture.chat.body.semantic_role); assert.equal(formData.prompt, capture.chat.body.message)
  assert.equal(capture.chat.body.refine, true); assert.equal(capture.chat.body.existing_element.content.plainText, capture.payload_content.plainText, 'the current text IS sent: the Text Service\'s structural branch ignores it')
  assert.equal(capture.chat.body.component_type, 'TEXT_BOX')
  assert.equal(capture.payload_semantic_role, 'SLIDE_TITLE')
})
await check('today (dev\'s runner, the false Done): the captured title is refined: generate is called once with the SLIDE_TITLE form and the instruction, and the result is "refined"', () => {
  const outcome = DEV.get('B47 capture: the template title (SLIDE_TITLE, slot title / structural)')
  assert.equal(word(outcome), 'refined/1')
  assert.equal(outcome.generations[0].formData.semanticRole, 'SLIDE_TITLE'); assert.equal(outcome.generations[0].formData.prompt, INSTRUCTION)
  assert.equal(outcome.generations[0].invocation.kind, 'chat-refine')
  assert.deepEqual(plain(outcome.generations[0].invocation.refineContext.existingElement), plain(capturedContext))
})

// ===== 3. flag on =========================================================================================================================================================
await check('flag on: the captured template title (SLIDE_TITLE) is failed / unsupported_type, deps.generate NOT called, and the only viewer command is the payload read', async () => {
  const [name, spec] = CASES[0]
  const got = await runCase(onLibs, spec)
  assert.equal(word(got), 'failed:unsupported_type/0'); assert.deepEqual(got, declinedOutcome(spec), name)
  assert.deepEqual(got.generations, []); assert.deepEqual(got.commands.map(item => item.action), ['requestElementRefine'], 'no goToSlide, no geometry or content command: nothing on the canvas is touched')
  assert.equal(got.result.directive_id, recordedDirective.payload.directive_id); assert.equal(got.result.element_id, existing.element_id)
})
await check('flag on: each of the 15 structural roles on a text box is declined the same way (failed / unsupported_type, no generation)', async () => {
  let declined = 0
  for (const [name, spec, isDeclined] of CASES.filter(([, , d]) => d)) { const got = await runCase(onLibs, spec); assert.equal(word(got), 'failed:unsupported_type/0', name); declined++ }
  assert.equal(declined, 15 + 1 + 1, 'the 15 roles, the captured title and the busy-race case')
})
await check('flag on: a body text box (BODY_TEXT) is refined as today: generate called once, the same form and result as dev\'s runner', async () => {
  for (const name of ['BODY_TEXT, slot body / body', 'BODY_TEXT, no slot']) {
    const got = await runCase(onLibs, CASES.find(item => item[0] === name)[1])
    assert.equal(word(got), 'refined/1', name); assert.deepEqual(got, DEV.get(name), name); assert.equal(got.generations[0].formData.semanticRole, 'BODY_TEXT')
  }
})
await check('flag on: a missing role (Layout\'s recorded text box, null, absent) and every unknown or non-string role are refined as today, the decline only on a KNOWN structural role', async () => {
  const names = CASES.filter(([name]) => /^(no role|role null|role absent|unknown role|role that is not a string)/.test(name)).map(item => item[0])
  assert.equal(names.length, 3 + UNKNOWN_ROLES.length + 4)
  for (const name of names) { const got = await runCase(onLibs, CASES.find(item => item[0] === name)[1]); assert.equal(word(got), 'refined/1', name); assert.deepEqual(got, DEV.get(name), name) }
})
await check('flag on: every other component type is unchanged (the K5 types are refined even with a structural role in the payload; INFOGRAPHIC / DIAGRAM are unsupported_type as today), and Layout\'s recorded chart is refined', async () => {
  for (const [name, spec] of CASES.filter(([name]) => /^(METRICS|TABLE|CHART|IMAGE|ICON_LABEL|SHAPE|INFOGRAPHIC|DIAGRAM|Layout's recorded real chart)/.test(name))) {
    const got = await runCase(onLibs, spec)
    assert.deepEqual(got, DEV.get(name), name)
    assert.equal(word(got), /outside the 7 K5/.test(name) ? 'failed:unsupported_type/0' : 'refined/1', name)
  }
})
await check('flag on: the guards before the decline keep their answers (dismissed, not_owner, element_not_found, a blank placeholder, an empty instruction, an unbuildable context) and the decline never pre-empts them', async () => {
  const guards = CASES.filter(item => item[3])
  assert.equal(guards.length, 9, 'nine guard cases')
  for (const [name, spec, declined, expected] of guards) {
    const got = await runCase(onLibs, spec)
    assert.equal(word(got), expected, name)
    if (!declined) assert.deepEqual(got, DEV.get(name), name)
  }
})
await check('flag on: the whole matrix at once (declined cases answer the contract; every other case answers dev\'s to the byte)', () => holdsOn(onLibs))

// ===== 4. flag off is identical ===========================================================================================================================================
await check('flag off (unset): the whole matrix is dev\'s to the byte: the same results, generations (form data and invocation) and viewer commands, hashed', async () => {
  await holdsOff(offLibs)
  const hash = async libs => sha(JSON.stringify(await Promise.all(CASES.map(([, spec]) => runCase(libs, spec)))))
  assert.equal(await hash(offLibs), await hash(devLibs), 'sha256 of the whole matrix, this change with the flag off vs dev\'s runner')
  assert.notEqual(await hash(onLibs), await hash(devLibs), 'and the flag on does differ (the declined cases)')
})
await check('flag off (any value but the exact "true"): the same matrix, dev\'s to the byte', async () => {
  for (const value of ['', 'false', 'TRUE', 'True', '1', 'yes', ' true', 'true ']) await holdsOff(makeLibs({ env: { ...ENV_OFF, [FLAG]: value } }))
})
await check('flag off: the strip gives dev\'s runner back byte for byte (the two added lines are pure insertions that carry the marker); the .env.example block comes out with its blank line; all read past the changes registered after this one', () => {
  const base = laterStrips(RUNNER, git('show', `${BASE_COMMIT}:${RUNNER}`)), now = laterRead(RUNNER)
  assert.equal(sha(stripChatRefineStructuralDecline(RUNNER, now)), sha(base), RUNNER)
  const added = now.split('\n').length - base.split('\n').length
  assert.equal(added, 2, 'two lines added: one import, one decline line')
  assert.equal(now.split('\n').filter(line => CHAT_REFINE_STRUCTURAL_DECLINE_MARKER_RE.test(line)).length, added, 'every added line carries the marker')
  assert.equal(sha(stripChatRefineStructuralDecline(RUNNER, stripChatRefineStructuralDecline(RUNNER, now))), sha(base), 'idempotent')
  const lines = now.split('\n'), declineAt = lines.findIndex(line => /declinesStructuralRefine\(componentType/.test(line))
  assert.ok(declineAt > 0 && /^\s*if \(CHAT_REFINE_STRUCTURAL_DECLINE_ENABLED && declinesStructuralRefine\(componentType, refineContext\.semanticRole\)\) return result\('failed', 'unsupported_type'\) \/\/ CHAT-REFINE-STRUCTURAL-DECLINE/.test(lines[declineAt]), 'the decline line')
  assert.ok(/^\s*if \(!formData\) return result\(/.test(lines[declineAt - 1]) && /^\s*if \(deps\.isBusy\(\)\) return result\('dismissed'\)/.test(lines[declineAt + 1]), 'it sits between the formData guard and the second busy check, before deps.generate')
  assert.ok(lines.findIndex(line => /await deps\.generate\(/.test(line)) > declineAt, 'and before deps.generate')
  assert.equal(withoutLaterEnvBlocks(read('.env.example')), `${git('show', `${BASE_COMMIT}:.env.example`)}\n${CHAT_REFINE_STRUCTURAL_DECLINE_ENV_BLOCK}`, 'the base, one blank line, the block (the blocks of the changes registered after this one aside)')
  assert.equal(registry.stripLaterEnvBlocks('.env.example', read('.env.example')), registry.stripLaterEnvBlocks('.env.example', git('show', `${BASE_COMMIT}:.env.example`)), 'the registry takes the block out')
  for (const rel of CHAT_REFINE_STRUCTURAL_DECLINE_NEW_FILES) assert.ok(fs.existsSync(path.join(root, rel)), rel)
  assert.equal(stripChatRefineStructuralDecline('scripts/studio-later-changes.mjs', 'x'), 'x')
  assert.equal(stripChatRefineStructuralDecline('hooks/use-deckster-websocket-v2.ts', 'x // CHAT-REFINE-STRUCTURAL-DECLINE\n'), 'x // CHAT-REFINE-STRUCTURAL-DECLINE\n', 'a file the change does not own comes back untouched')
  assert.equal(stripChatRefineStructuralDecline(RUNNER, 'a // CHAT-REFINE-STRUCTURAL-DECLINE-X\nb // X-CHAT-REFINE-STRUCTURAL-DECLINE\nc // CHAT-REFINE-STRUCTURAL-DECLINE\n'), 'a // CHAT-REFINE-STRUCTURAL-DECLINE-X\nb // X-CHAT-REFINE-STRUCTURAL-DECLINE\n', 'the marker is a whole token')
  for (const rel of CHAT_REFINE_STRUCTURAL_DECLINE_PIN_FILES) {
    const dev = git('show', `${BASE_COMMIT}:${rel}`)
    assert.equal(sha(otherStrips(rel, stripChatRefineStructuralDecline(rel, laterRead(rel)))), sha(otherStrips(rel, laterStrips(rel, dev))), `${rel}: the proof this change taught, put back (then the other changes' put-backs), is dev's`)
    assert.equal(sha(stripChatRefineStructuralDecline(rel, otherStrips(rel, laterRead(rel)))), sha(otherStrips(rel, laterStrips(rel, dev))), `${rel}: and in the other order (the other changes' put-backs first)`)
    for (const [has] of CHAT_REFINE_STRUCTURAL_DECLINE_PIN_EDITS[rel]) { const lines = has.split('\n').filter(Boolean); assert.ok(lines.some(line => line.includes(CHAT_REFINE_STRUCTURAL_DECLINE_PIN_MARK)), `${rel}: a taught line carries the pin mark`); for (const line of lines) assert.match(line, /\/\/ LATER-CHANGES: registry read \(/, `${rel}: every line of a taught block is a registry read`) }
  }
})
await check('the manual Element panel refine and every other path are not touched: only the runner imports the lib; the page wires the runner only behind the chat element refine flag; the generation hook, the panel and the wire are not edited by this change', () => {
  const importers = git('grep', '-l', 'chat-refine-structural-decline', '--', 'app', 'components', 'hooks', 'lib', 'types').split('\n').filter(Boolean).sort()
  assert.deepEqual(importers.filter(rel => rel !== LIB), [RUNNER], 'the runner is the only importer')
  const page = read('app/builder/page.tsx')
  assert.match(page, /elementRefineDirectiveRunnerRef\.current = !CHAT_ELEMENT_REFINE_ENABLED \? null/, 'the page wires the runner only with the chat element refine flag on')
  assert.doesNotMatch(page, /chat-refine-structural-decline|STRUCTURAL_DECLINE/, 'the page does not know the flag')
  assert.doesNotMatch(read('hooks/use-textlabs-generation.ts'), /STRUCTURAL_DECLINE/); assert.doesNotMatch(read(WIRE), /STRUCTURAL_DECLINE/)
  assert.doesNotMatch(read('hooks/use-deckster-websocket-v2.ts'), /STRUCTURAL_DECLINE/, 'the socket hook is not touched')
})

// ===== 5. the frame =======================================================================================================================================================
const parseTs = (rel, text) => ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
function findNode(ast, predicate) { let found = null; const visit = node => { if (found) return; if (predicate(node)) { found = node; return } ts.forEachChild(node, visit) }; visit(ast); return found }
/** The hook's own sendElementDirectiveResult (a useCallback arrow), cut out by AST and evaluated against a fake open socket: what is put on the wire is what the hook sends. */
function realSocketSend() {
  const rel = 'hooks/use-deckster-websocket-v2.ts', ast = parseTs(rel, read(rel))
  const declaration = findNode(ast, node => ts.isVariableDeclaration(node) && node.name.getText(ast) === 'sendElementDirectiveResult')
  assert.ok(declaration && ts.isCallExpression(declaration.initializer), 'sendElementDirectiveResult = useCallback(...)')
  const sent = [], sandbox = { wsRef: { current: { readyState: 1, send: data => sent.push(data) } }, WebSocket: { OPEN: 1 }, console: { error() {} }, JSON }
  const send = vm.runInNewContext(ts.transpileModule(`(${declaration.initializer.arguments[0].getText(ast)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText, sandbox)
  return { send, sent }
}
await check('the frame: the declined answer goes on the wire as exactly {"type":"element_directive_result","data":{directive_id,status:"failed",element_id,error_code:"unsupported_type"}} (the real socket send), equal to the recorded failed frame with the code set; no other field, no copy', async () => {
  const [, spec] = CASES[0]
  const got = await runCase(onLibs, spec)
  assert.deepEqual(Object.keys(got.result), ['directive_id', 'status', 'element_id', 'error_code'], 'exactly the four fields, in the existing order')
  const { send, sent } = realSocketSend()
  assert.equal(send(got.result), true)
  assert.equal(sent.length, 1)
  const wire = `{"type":"element_directive_result","data":{"directive_id":${JSON.stringify(recordedDirective.payload.directive_id)},"status":"failed","element_id":${JSON.stringify(existing.element_id)},"error_code":"unsupported_type"}}`
  assert.equal(sent[0], wire, 'the exact bytes')
  const recorded = plain(recordedFailedResult); recorded.data = { ...recorded.data, directive_id: recordedDirective.payload.directive_id, element_id: existing.element_id, error_code: 'unsupported_type' }
  assert.equal(sent[0], JSON.stringify(recorded), 'DIRECTOR-2\'s recorded element_directive_result (02-failed) with this directive, this element and unsupported_type: the same bytes')
  assert.deepEqual(Object.keys(recorded), ['type', 'data']); assert.deepEqual(Object.keys(recorded.data), ['directive_id', 'status', 'element_id', 'error_code'])
  assert.ok(offLibs.wire.ELEMENT_REFINE_DIRECTIVE_TYPE === 'element_refine_directive')
})
const RECORDED_DIR = 'scripts/fixtures/chat-refine-structural-decline/director-frames'
/** DIRECTOR-2's recorded examples (workspace main 4c47fbd2, MR !599 9a60d351), pinned: copied byte for byte. */
const RECORDED_SHA256 = {
  '01-with-element_text1': '31520d98a2e30cef0df1943ef474ea7b4da6f1cea9f164526be3e3c35f680a38',
  '02-without-element_text1': '68deb387c90f5d959f74b8645a934c597d26df73c04db57a9581b7f9c568657a',
  '03-text-set-off': 'ef43546f3647a03df2cb47db24522ba89dd49af69722a499998d321fe4cd9440',
  '04-blank-placeholder-null-element-id': 'df5952cc28c1eaf3d2b03d34ae28bfd0dd355695c166d29d532414d668bdbdb4',
  '05-flag-off-todays-line': '2479a8a2b0ed9c6effdaf2b5121bd08038f94f36ec5b8708bb52abdb4e80cd3a',
  '06-other-error-code': 'cc6b9b8947fb5226ce52a43271756a2543f0e546bae1ecceed2f9d0eec73c3d3',
  '07-element-edit-off-no-offer': 'e6930c46d15a2d249cd69b28a209fcbd9f151673bde7c533b5ad26d4ba44c92c',
}
const recordedExample = name => JSON.parse(read(`${RECORDED_DIR}/${name}.json`))
/** Replays the recorded Director directive of `file` through the real runner and puts the answer on the wire with the real socket send. */
async function replayRecorded(libs, file, spec) {
  const directive = file.director_frames_for_the_refine[0]
  assert.equal(directive.type, 'element_refine_directive')
  const got = await runCase(libs, { ...spec, message: directive, presentationId: directive.payload.presentation_id, elementId: directive.payload.element_id })
  const { send, sent } = realSocketSend()
  assert.equal(send(got.result), true)
  return { got, wire: sent[0], directive }
}
await check('RECORDED frames (DIRECTOR-2, workspace main 4c47fbd2, MR !599): the seven files are the ones copied (sha256); each is a refine of a title text box (TEXT_BOX, slide 3) answered by a failed element_directive_result with the keys directive_id, status, element_id, error_code', () => {
  assert.deepEqual(fs.readdirSync(path.join(root, RECORDED_DIR)).map(name => name.replace(/\.json$/, '')).sort(), Object.keys(RECORDED_SHA256).sort())
  for (const [name, digest] of Object.entries(RECORDED_SHA256)) {
    assert.equal(sha(read(`${RECORDED_DIR}/${name}.json`)), digest, name)
    const file = recordedExample(name), frame = file.studio_inbound_result_frame
    assert.deepEqual(Object.keys(frame), ['type', 'data']); assert.equal(frame.type, 'element_directive_result'); assert.deepEqual(Object.keys(frame.data), ['directive_id', 'status', 'element_id', 'error_code'], name)
    assert.equal(frame.data.directive_id, file.director_frames_for_the_refine[0].payload.directive_id, name); assert.equal(frame.data.status, 'failed', name)
    const reference = file.user_message.data.references[0]
    assert.deepEqual({ ...offLibs.runner.chatElementReferenceFor({ elementId: reference.element_id, elementType: reference.element_type, slideIndex: reference.slide_index, slideId: reference.slide_id }), label: reference.label }, reference, `${name}: Studio's reference rule gives the recorded reference (the label aside, which Director only displays)`)
    assert.ok(file.user_message.data.client_caps.includes('element_refine1') && file.user_message.data.client_caps.includes('mdc1'), name)
  }
})
await check('RECORDED frames: for each recorded title refine (01, 02, 03, 05, 07) the flag-on runner answers EXACTLY the recorded inbound element_directive_result, byte for byte (the real socket send), with the slide change, no generation and no viewer command but the payload read', async () => {
  for (const name of ['01-with-element_text1', '02-without-element_text1', '03-text-set-off', '05-flag-off-todays-line', '07-element-edit-off-no-offer']) {
    const file = recordedExample(name), payload = file.director_frames_for_the_refine[0].payload
    assert.equal(file.studio_inbound_result_frame.data.error_code, 'unsupported_type', name)
    const { got, wire } = await replayRecorded(onLibs, file, { data: titleData({ elementId: payload.element_id, slideIndex: payload.slide_index }) })
    assert.equal(wire, JSON.stringify(file.studio_inbound_result_frame), `${name}: Studio's frame is the recorded one, byte for byte`)
    assert.deepEqual(got.generations, [], name)
    assert.deepEqual(got.commands, [{ action: 'goToSlide', index: payload.slide_index }, { action: 'requestElementRefine', params: { elementId: payload.element_id } }], `${name}: the slide is opened, the payload is read, nothing else`)
    const off = await replayRecorded(offLibs, file, { data: titleData({ elementId: payload.element_id, slideIndex: payload.slide_index }) })
    assert.equal(off.got.result.status, 'refined', `${name}: flag off, Studio answers the false Done (refined) that the recorded frame replaces`); assert.notEqual(off.wire, JSON.stringify(file.studio_inbound_result_frame), name)
  }
})
await check('RECORDED frame 04 (blank placeholder): Studio answers failed / unsupported_type for a blank-placeholder text box, as it does today with the flag off; the element_id it carries is the DIRECTIVE\'s (Studio never turns it into null), so the bytes are the recorded frame\'s with that id', async () => {
  const file = recordedExample('04-blank-placeholder-null-element-id'), payload = file.director_frames_for_the_refine[0].payload
  assert.equal(file.studio_inbound_result_frame.data.element_id, null, 'DIRECTOR-2\'s frame 04 carries a null element_id')
  const spec = { data: titleData({ elementId: payload.element_id, slideIndex: payload.slide_index, semanticRole: 'BODY_TEXT' }), deps: () => ({ isBlankPlaceholder: () => true }) }
  const on = await replayRecorded(onLibs, file, spec), off = await replayRecorded(offLibs, file, spec), dev = await replayRecorded(devLibs, file, spec)
  assert.deepEqual(on.got, dev.got); assert.deepEqual(off.got, dev.got)
  assert.equal(on.wire, JSON.stringify({ ...file.studio_inbound_result_frame, data: { ...file.studio_inbound_result_frame.data, element_id: payload.element_id } }))
  assert.equal(word(on.got), 'failed:unsupported_type/0')
})
await check('RECORDED frame 06 (another error code): a refine that fails in generation answers the recorded generation_failed frame byte for byte, flag on and flag off alike (unchanged)', async () => {
  const file = recordedExample('06-other-error-code'), payload = file.director_frames_for_the_refine[0].payload
  assert.equal(file.studio_inbound_result_frame.data.error_code, 'generation_failed')
  const spec = { data: titleData({ elementId: payload.element_id, slideIndex: payload.slide_index, semanticRole: 'BODY_TEXT', slotName: 'body', slotKind: 'body' }), generateResult: { status: 'failed', presentationId: payload.presentation_id, slideIndex: payload.slide_index, error: 'synthetic Text Labs refusal' } }
  for (const libs of [onLibs, offLibs, devLibs]) { const { got, wire } = await replayRecorded(libs, file, spec); assert.equal(wire, JSON.stringify(file.studio_inbound_result_frame)); assert.equal(got.generations.length, 1) }
})
await check('no new copy: the declined result carries no text, and the files this change adds hold none of Director\'s sentence', () => {
  const phrases = ["can't refine this text box", 'so it is unchanged', 'choose Mode', 'click into the text box', 'toolbar']
  const added = runnerText.split('\n').filter(line => CHAT_REFINE_STRUCTURAL_DECLINE_MARKER_RE.test(line)).join('\n')
  for (const [what, text] of [['the lib', libText], ['the strip module', read('scripts/studio-chat-refine-structural-decline-strip.mjs')], ['the runner\'s added lines', added], ['the .env.example block', CHAT_REFINE_STRUCTURAL_DECLINE_ENV_BLOCK]]) for (const phrase of phrases) assert.ok(!text.includes(phrase), `${what}: ${phrase}`)
  const literals = [...libText.replace(/\/\*\*[\s\S]*?\*\//g, '').matchAll(/'([^'\n]*)'/g)].map(match => match[1])
  assert.deepEqual([...new Set(literals)].sort(), ['@/types/textlabs', 'BODY_TEXT', 'TEXT_BOX', 'string', 'true'], 'the lib\'s code has no string literal but the type path, BODY_TEXT, TEXT_BOX, typeof \'string\' and the flag\'s \'true\': nothing a user could read')
})

// ===== 6. mutants =========================================================================================================================================================
const mutated = (overrides, env = ENV_ON) => makeLibs({ env, overrides: { [RUNNER]: runnerText, [LIB]: libText, ...overrides } })
await check('control: the unmutated libs hold the whole matrix (the mutants below fail it, so they are not failing for another reason)', async () => { await holdsOn(mutated({})); await holdsOff(mutated({}, ENV_OFF)) })
await mutant('the table drops SLIDE_TITLE: the captured title is not declined', async () => holdsOn(mutated({ [LIB]: swap(libText, '  SLIDE_TITLE: true,\n', '') })))
await mutant('the table adds BODY_TEXT: a body text box is declined', async () => holdsOn(mutated({ [LIB]: swap(libText, '  SLIDE_TITLE: true,\n', '  BODY_TEXT: true,\n  SLIDE_TITLE: true,\n') })))
await mutant('the table drops FOOTER: a structural role is let through', async () => holdsOn(mutated({ [LIB]: swap(libText, '  FOOTER: true,\n', '') })))
await mutant('the component type is not checked: a structural role in a chart\'s payload is declined', async () => holdsOn(mutated({ [LIB]: swap(libText, "componentType === 'TEXT_BOX' && isStructuralTextRole(semanticRole)", 'isStructuralTextRole(semanticRole)') })))
await mutant('any other string declines (not just a known structural role): an unknown role is declined', async () => holdsOn(mutated({ [LIB]: swap(libText, "return typeof role === 'string' && Object.prototype.hasOwnProperty.call(STRUCTURAL_TEXT_ROLE_TABLE, role)", "return typeof role === 'string' && role !== 'BODY_TEXT' && role !== ''") })))
await mutant('a missing role declines: a text box with no role is declined', async () => holdsOn(mutated({ [LIB]: swap(libText, "return typeof role === 'string' && Object.prototype.hasOwnProperty.call(STRUCTURAL_TEXT_ROLE_TABLE, role)", "return role == null || (typeof role === 'string' && Object.prototype.hasOwnProperty.call(STRUCTURAL_TEXT_ROLE_TABLE, role))") })))
await mutant('the role is matched case-insensitively: "slide_title" is declined', async () => holdsOn(mutated({ [LIB]: swap(libText, "return typeof role === 'string' && Object.prototype.hasOwnProperty.call(STRUCTURAL_TEXT_ROLE_TABLE, role)", "return typeof role === 'string' && Object.prototype.hasOwnProperty.call(STRUCTURAL_TEXT_ROLE_TABLE, role.trim().toUpperCase())") })))
await mutant('the role is looked up with `in`: "toString" / "constructor" are declined', async () => holdsOn(mutated({ [LIB]: swap(libText, "return typeof role === 'string' && Object.prototype.hasOwnProperty.call(STRUCTURAL_TEXT_ROLE_TABLE, role)", "return typeof role === 'string' && role in STRUCTURAL_TEXT_ROLE_TABLE") })))
await mutant('the decline line is removed from the runner: generate is called for the title', async () => holdsOn(mutated({ [RUNNER]: stripChatRefineStructuralDecline(RUNNER, runnerText) })))
await mutant('the decline sits after deps.generate: the generation has started', async () => {
  const line = runnerText.split('\n').find(item => /declinesStructuralRefine\(componentType/.test(item))
  const moved = swap(swap(runnerText, `${line}\n`, ''), '  // 6. Swapped in place (or not).', `${line}\n  // 6. Swapped in place (or not).`)
  await holdsOn(mutated({ [RUNNER]: moved }))
})
await mutant('the decline sits before the formData guard: an empty instruction on a title is unsupported_type, not generation_failed', async () => {
  const line = runnerText.split('\n').find(item => /declinesStructuralRefine\(componentType/.test(item))
  const guard = "  if (!formData) return result('failed', typeof payload.instruction === 'string' && payload.instruction.trim() ? 'unsupported_type' : 'generation_failed')\n"
  await holdsOn(mutated({ [RUNNER]: swap(swap(runnerText, `${line}\n`, ''), guard, `${line}\n${guard}`) }))
})
await mutant('the decline answers generation_failed instead of unsupported_type', async () => holdsOn(mutated({ [RUNNER]: swap(runnerText, "declinesStructuralRefine(componentType, refineContext.semanticRole)) return result('failed', 'unsupported_type')", "declinesStructuralRefine(componentType, refineContext.semanticRole)) return result('failed', 'generation_failed')") })))
await mutant('the decline answers dismissed (status) instead of failed', async () => holdsOn(mutated({ [RUNNER]: swap(runnerText, "declinesStructuralRefine(componentType, refineContext.semanticRole)) return result('failed', 'unsupported_type')", "declinesStructuralRefine(componentType, refineContext.semanticRole)) return result('dismissed')") })))
await mutant('the decline reads the role from the instruction\'s payload instead of the refine context: no role is found, nothing is declined', async () => holdsOn(mutated({ [RUNNER]: swap(runnerText, 'declinesStructuralRefine(componentType, refineContext.semanticRole)', 'declinesStructuralRefine(componentType, payload.semanticRole)') })))
await mutant('the flag check is dropped from the runner: flag off declines too (the off matrix fails)', async () => holdsOff(mutated({ [RUNNER]: swap(runnerText, 'CHAT_REFINE_STRUCTURAL_DECLINE_ENABLED && declinesStructuralRefine(', 'declinesStructuralRefine(') }, ENV_OFF)))
await mutant('the flag is on unless it is "false": unset means on', async () => holdsOff(mutated({ [LIB]: swap(libText, "process.env.NEXT_PUBLIC_STUDIO_CHAT_REFINE_STRUCTURAL_DECLINE === 'true'", "process.env.NEXT_PUBLIC_STUDIO_CHAT_REFINE_STRUCTURAL_DECLINE !== 'false'") }, ENV_OFF)))
await mutant('the flag is read case-insensitively: "TRUE" turns it on', async () => holdsOff(mutated({ [LIB]: swap(libText, "process.env.NEXT_PUBLIC_STUDIO_CHAT_REFINE_STRUCTURAL_DECLINE === 'true'", "String(process.env.NEXT_PUBLIC_STUDIO_CHAT_REFINE_STRUCTURAL_DECLINE).toLowerCase() === 'true'") }, { ...ENV_OFF, [FLAG]: 'TRUE' })))
await mutant('the declined result gains a text field (new copy)', async () => {
  const from = "declinesStructuralRefine(componentType, refineContext.semanticRole)) return result('failed', 'unsupported_type')"
  const libs = mutated({ [RUNNER]: swap(runnerText, from, "declinesStructuralRefine(componentType, refineContext.semanticRole)) return { ...result('failed', 'unsupported_type'), message: 'nope' }") })
  assert.deepEqual(await runCase(libs, CASES[0][1]), declinedOutcome(CASES[0][1]))
})
for (const [label, tail] of [['element_id null', "{ ...result('failed', 'unsupported_type'), element_id: null }"], ['the keys in another order', "{ status: 'failed', directive_id: directiveId, element_id: elementId, error_code: 'unsupported_type' }"]]) {
  await mutant(`the declined result has ${label}: the recorded frame (byte for byte) is not what goes on the wire`, async () => {
    const from = "declinesStructuralRefine(componentType, refineContext.semanticRole)) return result('failed', 'unsupported_type')"
    const file = recordedExample('01-with-element_text1'), payload = file.director_frames_for_the_refine[0].payload
    const { wire } = await replayRecorded(mutated({ [RUNNER]: swap(runnerText, from, `declinesStructuralRefine(componentType, refineContext.semanticRole)) return ${tail}`) }), file, { data: titleData({ elementId: payload.element_id, slideIndex: payload.slide_index }) })
    assert.equal(wire, JSON.stringify(file.studio_inbound_result_frame))
  })
}
await mutant('a strip that leaves the import behind: the strip must give dev\'s runner back, byte for byte', () => {
  const brokenStrip = text => text.split('\n').filter(line => !/declinesStructuralRefine\(componentType/.test(line)).join('\n')
  assert.equal(sha(brokenStrip(runnerText)), sha(laterStrips(RUNNER, git('show', `${BASE_COMMIT}:${RUNNER}`))))
})
await mutant('an unmarked line sneaks into the runner: the marker count no longer equals the added lines', () => {
  const sneaky = swap(runnerText, "  if (deps.isBusy()) return result('dismissed')\n  let outcome", "  const sneaky = 1\n  if (deps.isBusy()) return result('dismissed')\n  let outcome")
  const base = laterStrips(RUNNER, git('show', `${BASE_COMMIT}:${RUNNER}`))
  assert.equal(sneaky.split('\n').filter(line => CHAT_REFINE_STRUCTURAL_DECLINE_MARKER_RE.test(line)).length, sneaky.split('\n').length - base.split('\n').length)
})

// ===== 7. scope over the COMMITTED diff (BASE..head), gate-safe and robust after merge ==========================================================================
console.log('scope over the committed diff (own commits by subject across `rev-list --no-merges BASE..head`)')
const GIT_IDENT = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-10-29T00:00:00Z', GIT_COMMITTER_DATE: '2026-10-29T00:00:00Z' }
const plumb = (args, input) => execFileSync('git', args, { cwd: root, encoding: 'utf8', ...(input === undefined ? {} : { input }), env: { ...process.env, ...GIT_IDENT }, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 60_000 }).trim()
/** A blob object for `text`, written from a temporary FILE (never `hash-object --stdin`: a large input through a stdin pipe once left a git child waiting forever in another proof's run): stdin ignored, a 60 s timeout, no filters. */
const blobOf = text => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crsd-blob-'))
  try { const file = path.join(dir, 'blob'); fs.writeFileSync(file, text); return plumb(['hash-object', '-w', '--no-filters', '--', file]) } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
const parentsOf = sha1 => git('rev-list', '--parents', '-n', '1', sha1).trim().split(/\s+/).slice(1)
/** This change's commits: found by SUBJECT across `rev-list --no-merges BASE..head`. A first-parent walk (`firstParentOnly`, the old query, kept for its mutant) sees nothing on the gate's merge and none of this change's commits once a change is stacked after it. */
const ownOf = (head, { firstParentOnly = false } = {}) => git('rev-list', ...(firstParentOnly ? ['--first-parent'] : []), '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => subjectOf(c).startsWith(CHAT_REFINE_STRUCTURAL_DECLINE_SUBJECT))
/** GATE-SAFE head of every scope query. The gate's merge has dev as its FIRST parent (it carries none of this change's commits, whether or not dev has moved past BASE) and this change's head as its SECOND parent: the scope runs against HEAD^2.
 *  On a branch (HEAD is this change's tip, or a merge of dev INTO it, whose first parent is the change) HEAD itself is used. `gateRule: false` is the mutant that drops the rule. */
function scopeHead(ref = 'HEAD', { gateRule = true } = {}) {
  const head = git('rev-parse', `${ref}^{commit}`).trim()
  const parents = parentsOf(head)
  if (!gateRule || parents.length !== 2) return head
  return ownOf(parents[0]).length === 0 && ownOf(parents[1]).length > 0 ? parents[1] : head
}
const REAL = { norm: otherStrips, env: text => registry.stripLaterEnvBlocks('.env.example', text) }
const diffLines = text => text.split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
/** `git diff -U0` of the base file against the file at `head`, both read through ctx.norm (every other change's lines out). */
const normDiff = (ctx, rel, head) => git('diff', '-U0', blobOf(ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`))), blobOf(ctx.norm(rel, git('show', `${head}:${rel}`))))
const OLDER_SUBJECTS = /^(Chat element edit|Targeted chat edit:|Targeted chat add:|Chat text set:|Chat add stacking:|MDC element fields:|Chat parity)/
const scopeOwnCommits = (head, opts) => {
  const own = ownOf(head, opts)
  assert.ok(own.length >= 1, 'no own commit yet')
  for (const c of own) assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude Sonnet 5\.5 <noreply@anthropic\.com>\s*$/, c.slice(0, 8))
  for (const c of git('rev-list', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)) assert.doesNotMatch(subjectOf(c), OLDER_SUBJECTS, `${c.slice(0, 8)} would be taken for an older change's own commit`)
  return own
}
const scopeCommittedFiles = (head, ctx = REAL) => {
  const own = scopeOwnCommits(head)
  const touched = new Set()
  for (const c of own) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) touched.add(rel)
  assert.deepEqual([...touched].sort(), [...CHAT_REFINE_STRUCTURAL_DECLINE_SCOPE_FILES].sort(), 'the files this change\'s own commits touch are exactly its scope')
  for (const rel of CHAT_REFINE_STRUCTURAL_DECLINE_FILES) {
    const diff = diffLines(normDiff(ctx, rel, head))
    for (const line of diff) { assert.ok(line.startsWith('+'), `${rel}: a removed line: ${line.slice(0, 120)}`); assert.match(line, CHAT_REFINE_STRUCTURAL_DECLINE_MARKER_RE, `${rel}: an unmarked added line: ${line.slice(0, 120)}`) }
    assert.ok(diff.length > 0, `${rel}: the number of added lines`)
    assert.equal(stripChatRefineStructuralDecline(rel, ctx.norm(rel, git('show', `${head}:${rel}`))), ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)), `${rel}: without its marked lines the file is the base's, byte for byte`)
  }
  for (const rel of CHAT_REFINE_STRUCTURAL_DECLINE_PIN_FILES) {
    const now = git('show', `${head}:${rel}`), dev = ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`))
    assert.equal(stripChatRefineStructuralDecline(rel, ctx.norm(rel, now)), dev, `${rel}: the proof this change taught, put back, is the base's`)
    assert.equal(ctx.norm(rel, stripChatRefineStructuralDecline(rel, now)), dev, `${rel}: in either order of the put-backs (this change's strip commutes with the other changes' on a file they share)`)
  }
  for (const rel of CHAT_REFINE_STRUCTURAL_DECLINE_NEW_FILES) assert.equal(git('cat-file', '-t', `${head}:${rel}`).trim(), 'blob', rel)
  for (const rel of ['app/builder/page.tsx', 'components/presentation-viewer.tsx', 'hooks/use-deckster-websocket-v2.ts', 'hooks/use-textlabs-generation.ts', 'hooks/use-generation-panel.ts', 'lib/chat-element-refine-wire.ts', 'lib/chat-element-edit.ts', 'lib/chat-element-edit-wire.ts', 'lib/chat-element-text-set.ts', 'lib/mdc-element-directive.ts', 'lib/text-slot-catalog.ts', 'types/textlabs.ts', 'package.json']) assert.ok(!touched.has(rel), `${rel} is not touched by this change`)
}
const scopeEnvAndRegistry = (head, ctx = REAL) => {
  const env = git('show', `${head}:.env.example`), baseEnv = git('show', `${BASE_COMMIT}:.env.example`)
  assert.equal(ctx.env(env), ctx.env(baseEnv), '.env.example is the base plus the registered blocks and nothing else')
  assert.equal(env.split(CHAT_REFINE_STRUCTURAL_DECLINE_ENV_BLOCK).length - 1, 1, 'this change\'s block is there exactly once, verbatim')
  assert.match(env, new RegExp(`\\n\\n${CHAT_REFINE_STRUCTURAL_DECLINE_ENV_BLOCK.split('\n')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), 'a blank line before the block')
  const diff = diffLines(git('diff', '-U0', `${BASE_COMMIT}..${head}`, '--', 'scripts/studio-later-changes.mjs'))
  assert.equal(diff.filter(line => line.startsWith('-')).length, 0, 'the registry loses no line')
  const mine = diff.filter(line => line.includes('studio-chat-refine-structural-decline-strip.mjs'))
  assert.equal(mine.length, 3, 'the registry gains exactly this change\'s three lines'); for (const line of mine) assert.ok(line.startsWith('+') && line.includes('// LATER-CHANGE:'), line.slice(0, 140))
  assert.deepEqual(mine.map(line => /\)\.(\w+), \/\//.exec(line)?.[1]), ['CHAT_REFINE_STRUCTURAL_DECLINE_SCOPE_FILES', 'CHAT_REFINE_STRUCTURAL_DECLINE_ENV_BLOCK', 'stripChatRefineStructuralDecline'])
}
const scopeAll = (head, ctx = REAL) => { scopeOwnCommits(head); scopeCommittedFiles(head, ctx); scopeEnvAndRegistry(head, ctx) }

const HEAD = scopeHead('HEAD')
await check(`this change's own commits (subject starts "${CHAT_REFINE_STRUCTURAL_DECLINE_SUBJECT}", found across the whole line, no merges) exist, with the co-author line; none could be taken for an older change's`, () => { scopeOwnCommits(HEAD) })
await check('the committed files are exactly this change\'s; every line added to an existing file is a pure insertion that carries the marker; the strip gives the base back byte for byte (other changes\' lines out of both sides); the taught proofs put back are the base\'s', () => scopeCommittedFiles(HEAD))
await check('.env.example is the base plus the block (after one blank line); the registry gains exactly its three marked lines and loses none; no secret-shaped literal in the new files', () => {
  scopeEnvAndRegistry(HEAD)
  for (const rel of [...CHAT_REFINE_STRUCTURAL_DECLINE_NEW_FILES.filter(rel => !rel.endsWith('.json')), RUNNER]) assert.doesNotMatch(fs.readFileSync(path.join(root, rel), 'utf8'), /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY)/, rel)
})
// GATE-SAFE: the gate's merge (first parent dev, second parent this change's head; the tree is `git merge-tree --write-tree dev head`) and the whole scope section against it
const gateMerge = (dev, head) => plumb(['commit-tree', plumb(['merge-tree', '--write-tree', dev, head]).split('\n')[0], '-p', dev, '-p', head, '-m', 'gate-style merge (local, no ref)'])
const GATE = gateMerge(BASE_COMMIT, HEAD)
await check('GATE-SAFE: on a gate-style merge (first parent BASE, second parent this change\'s head) the scope head is HEAD^2 and the whole scope section passes against it; the merged tree is read too', () => {
  assert.deepEqual(parentsOf(GATE), [BASE_COMMIT, HEAD])
  assert.deepEqual(git('log', '--format=%H', '--first-parent', '--no-merges', `${BASE_COMMIT}..${GATE}`).split('\n').filter(Boolean), [], 'the gate\'s first-parent, no-merges line from BASE is empty: why HEAD itself cannot be used')
  assert.equal(scopeHead(GATE), HEAD, 'HEAD^2 is the change\'s head')
  scopeAll(scopeHead(GATE))
  scopeEnvAndRegistry(GATE)
  for (const rel of CHAT_REFINE_STRUCTURAL_DECLINE_FILES) assert.equal(stripChatRefineStructuralDecline(rel, otherStrips(rel, git('show', `${GATE}:${rel}`))), otherStrips(rel, git('show', `${BASE_COMMIT}:${rel}`)), `the merged tree, without this change's lines, is the base's ${rel}`)
  assert.equal(scopeHead(HEAD), HEAD, 'a branch head is used as it is'); assert.equal(scopeHead(BASE_COMMIT), BASE_COMMIT, 'BASE itself is used as it is')
})
await check('mutant caught: the old first-parent own-commit query finds no own commit on the gate-style merge, and without the HEAD^2 rule the scope head is the merge itself', () => {
  const head = scopeHead(GATE, { gateRule: false })
  assert.equal(head, GATE)
  assert.throws(() => scopeOwnCommits(head, { firstParentOnly: true }), /no own commit yet/)
  assert.doesNotThrow(() => scopeOwnCommits(head), 'the subject query across the line finds them on the merge itself')
})
/** A commit (objects only, no ref) whose tree is `parent`'s with `edits` ({path: text}) applied, built through a temporary index file. */
const commitWith = (parent, edits, message) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crsd-idx-'))
  try {
    const env = { ...process.env, ...GIT_IDENT, GIT_INDEX_FILE: path.join(dir, 'index') }
    const viaIndex = (...a) => execFileSync('git', a, { cwd: root, env, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 }).trim()
    viaIndex('read-tree', parent)
    for (const [rel, text] of Object.entries(edits)) viaIndex('update-index', '--add', '--cacheinfo', `100644,${blobOf(text)},${rel}`)
    return plumb(['commit-tree', viaIndex('write-tree'), '-p', parent, '-m', message])
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const TRAILER = '\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>'
// a merge onto an ADVANCED dev: a commit on dev after BASE that touches an unrelated file; the gate's first parent is no longer BASE
const unrelated = commitWith(BASE_COMMIT, { 'unrelated-after-base.txt': 'unrelated\n' }, 'Dev: an unrelated commit after BASE')
const ADVANCED_GATE = gateMerge(unrelated, HEAD)
await check('GATE-SAFE after dev moved on: a gate merge whose first parent is a dev commit past BASE (an unrelated commit): the scope head is still this change\'s head and the scope section passes', () => {
  assert.deepEqual(parentsOf(ADVANCED_GATE), [unrelated, HEAD]); assert.notEqual(parentsOf(ADVANCED_GATE)[0], BASE_COMMIT)
  assert.equal(scopeHead(ADVANCED_GATE), HEAD)
  scopeAll(scopeHead(ADVANCED_GATE)); scopeEnvAndRegistry(ADVANCED_GATE)
  assert.equal(ownOf(ADVANCED_GATE).length, ownOf(HEAD).length, 'the same own commits are found on the merge')
})
// a SYNTHETIC change stacked after this one: marked lines in the runner (next to this change's own), a registry trio below this change's, an .env.example block, a new file
const SYN = { marker: 'SYNTHETIC-LATER', file: 'scripts/studio-synthetic-later-strip.mjs', block: '# SYNTHETIC LATER (a made-up change stacked after this one)\nNEXT_PUBLIC_SYNTHETIC_LATER="false"\n' }
const syntheticStrip = (rel, text) => rel === RUNNER && typeof text === 'string' ? text.split('\n').filter(line => !line.includes(SYN.marker)).join('\n') : text
const syntheticCommit = parent => {
  const at = rel => git('show', `${parent}:${rel}`)
  const runner = at(RUNNER).split('\n').flatMap(line => line.startsWith('export const REQUEST_ELEMENT_REFINE_ACTION') ? [line, `const syntheticLater = 1 // ${SYN.marker}`] : [line]).join('\n')
  assert.ok(runner.includes(SYN.marker), 'the synthetic anchor exists')
  const reg = at('scripts/studio-later-changes.mjs').split('\n').flatMap(line => {
    if (line.includes('CHAT_REFINE_STRUCTURAL_DECLINE_SCOPE_FILES')) return [line, "  ...(await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_SCOPE_FILES, // LATER-CHANGE: synthetic, stacked after this one"]
    if (line.includes('CHAT_REFINE_STRUCTURAL_DECLINE_ENV_BLOCK')) return [line, "  (await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_ENV_BLOCK, // LATER-CHANGE: synthetic, stacked after this one"]
    if (line.includes(').stripChatRefineStructuralDecline')) return [line, "  (await import('./studio-synthetic-later-strip.mjs')).stripSynthetic, // LATER-CHANGE: synthetic, stacked after this one"]
    return [line]
  }).join('\n')
  return commitWith(parent, { [RUNNER]: runner, 'scripts/studio-later-changes.mjs': reg, '.env.example': `${at('.env.example')}\n${SYN.block}`, [SYN.file]: 'export const SYNTHETIC_SCOPE_FILES = new Set()\n' }, `Synthetic later: a change stacked after this one${TRAILER}`)
}
const SYNTHETIC = syntheticCommit(HEAD)
const SYN_CTX = {
  norm: (rel, text) => syntheticStrip(rel, otherStrips(rel, text)),
  env: text => registry.stripLaterEnvBlocks('.env.example', text).replace(`\n${SYN.block}`, ''),
}
await check('ROBUST AFTER MERGE: a synthetic change stacked after this one (its marked line beside this change\'s in the runner, a registry trio, an .env.example block, a new file; its own commit has another subject) leaves this change\'s scope section passing, on the branch, on the gate\'s merge and on a merge onto an advanced dev', () => {
  assert.ok(ownOf(SYNTHETIC).length === ownOf(HEAD).length && !ownOf(SYNTHETIC).includes(SYNTHETIC), 'the later commit is not this change\'s')
  assert.equal(scopeHead(SYNTHETIC), SYNTHETIC)
  scopeAll(SYNTHETIC, SYN_CTX)
  const gate = gateMerge(BASE_COMMIT, SYNTHETIC)
  assert.equal(scopeHead(gate), SYNTHETIC); scopeAll(scopeHead(gate), SYN_CTX); scopeEnvAndRegistry(gate, SYN_CTX)
  for (const rel of CHAT_REFINE_STRUCTURAL_DECLINE_FILES) assert.equal(stripChatRefineStructuralDecline(rel, SYN_CTX.norm(rel, git('show', `${gate}:${rel}`))), SYN_CTX.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)), `the merged tree is the base's ${rel} without this change's and the later change's lines`)
  const advanced = gateMerge(unrelated, SYNTHETIC)
  assert.equal(scopeHead(advanced), SYNTHETIC); scopeAll(scopeHead(advanced), SYN_CTX)
})
await check('mutant caught: the same synthetic later change fails a scope that is not told about it (its lines are unmarked additions, its registry lines extra)', () => {
  assert.throws(() => scopeCommittedFiles(SYNTHETIC), /unmarked added line|exactly its scope/)
  assert.throws(() => scopeEnvAndRegistry(SYNTHETIC), /gains exactly|base plus the registered blocks/)
})
await check('mutant caught: a stray foreign file in a "Structural refine decline:" commit fails the committed-files check (own commits found by subject, the diff names the file)', () => {
  const stray = commitWith(HEAD, { 'stray-structural-decline.txt': 'stray\n' }, `${CHAT_REFINE_STRUCTURAL_DECLINE_SUBJECT} a stray file${TRAILER}`)
  assert.ok(ownOf(stray).includes(stray), 'the stray commit is found by its subject')
  assert.doesNotThrow(() => scopeCommittedFiles(HEAD), 'the real head passes')
  assert.throws(() => scopeCommittedFiles(stray), /exactly its scope/, 'the committed-files check must fail on a stray file')
})
await check('mutant caught: an own commit without the co-author line, an unmarked line added to the runner in an own commit, and an edit of the socket hook in an own commit fail the scope', () => {
  const noTrailer = commitWith(HEAD, {}, `${CHAT_REFINE_STRUCTURAL_DECLINE_SUBJECT} no trailer`)
  assert.throws(() => scopeOwnCommits(noTrailer), error => /^[0-9a-f]{8}$/.test(error.message), 'the commit without the trailer is named')
  const sneaky = commitWith(HEAD, { [RUNNER]: git('show', `${HEAD}:${RUNNER}`).replace('export const REQUEST_ELEMENT_REFINE_ACTION', 'const sneaky = 1\nexport const REQUEST_ELEMENT_REFINE_ACTION') }, `${CHAT_REFINE_STRUCTURAL_DECLINE_SUBJECT} a sneaky line${TRAILER}`)
  assert.throws(() => scopeCommittedFiles(sneaky), /unmarked added line/)
  const hook = commitWith(HEAD, { 'hooks/use-deckster-websocket-v2.ts': git('show', `${HEAD}:hooks/use-deckster-websocket-v2.ts`) + '\n' }, `${CHAT_REFINE_STRUCTURAL_DECLINE_SUBJECT} touches the hook${TRAILER}`)
  assert.throws(() => scopeCommittedFiles(hook), /exactly its scope|is not touched/)
})

console.log(`\n${passed} passed, ${failed.length} failed; mutants: ${caught} caught, ${missed.length} missed (offline, real runner, B47's captured payloads)`)
if (failed.length || missed.length) { if (failed.length) console.error(`failed: ${failed.join('; ')}`); if (missed.length) console.error(`missed: ${missed.join('; ')}`); process.exit(1) }
