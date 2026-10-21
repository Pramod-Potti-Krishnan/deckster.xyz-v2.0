// PASS2-PAGES publish flow + public viewer (FRONTEND-1; streams/ops/PASS2-PAGES/publish.md, PROGRAM-1's rulings ops/program/pass2-designs table D).
// Flags (each exact "true", Studio shell only, default off): NEXT_PUBLIC_STUDIO_P2_PUBLISH, NEXT_PUBLIC_STUDIO_P2_PUBLISH_INBOX, NEXT_PUBLIC_STUDIO_P2_PUBLISH_ORIGIN_URL.
//
// Rows: PUB-01 one audience vocabulary; PUB-02 masked passcode with a counter; PUB-03 (limited) the slide count in the subtitle and NO privacy sentence; PUB-04 one line on
// the Questions step; PUB-06 recording off by default, an "up to N cents" estimate, checked against the exact one before anything is charged; PUB-07 no script request
// without a session length; PUB-08 and PUB-15 on/off capability rows beside the thumbnail (wizard, Viewer page tab); PUB-10 the link and "View as a viewer" on the done
// screen; PUB-11 question, waiting and narration facts plus a badge on the Questions tab; PUB-16 Unblock and Remove from FAQ; VIEW-04 the viewer follows the visitor's
// system theme; VIEW-07 the narrated run's Ask popover on the viewer tokens; and the viewer link built on the origin the owner is on (not production) when
// NEXT_PUBLIC_APP_URL is unset.
//
// Run: node scripts/test-studio-p2-publish.mjs   (plain node: transpile + vm, a small hooks runtime, no network, no database, no writes)
//   P2_PUBLISH_BASE=<commit> picks the base the flag-off identity is measured against (default: the commit named in scripts/studio-p2-publish-strip.mjs, the
//   studio-v4-dev-preparation-code commit this branch was cut from; the repository needs that commit in its history).
//   P2_NO_MUTANTS=1 skips the mutants; P2_MUTANT_TARGETS_ONLY=1 only checks that every mutant names exactly one place.
//
// What is proved:
//   1. the import-free lib (lib/studio-p2-publish.ts) in a bare vm, helper by helper, every edge;
//   2. the strip table (scripts/studio-p2-publish-strip.mjs): stripping the branch's files gives the base commit's files byte for byte (so nothing is changed that is
//      not listed), every listed change is found exactly once, and each one that adds code is guarded by a flag (or is an import, a type, a comment, CSS or a doc line);
//   3. flag off (unset, "false", "1", "TRUE", " true", and the shell off): the real wizard, viewer summary and dialog draw the SAME tree as the base's for every scenario,
//      make the same requests, and the routes answer the same bytes (questions route request matrix, serialize with and without a request origin);
//   4. flag on: every row above, on the real components, with fake services (the requests are logged: nothing but GETs, and one estimate POST, ever leaves);
//   5. mutations: every rule above fails when its line is broken.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { BASE_COMMIT, P2_FILES, P2_NEW_FILES, P2_PAIRS, stripP2Publish } from './studio-p2-publish-strip.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.P2_PUBLISH_BASE || BASE_COMMIT
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const FLAG = 'NEXT_PUBLIC_STUDIO_P2_PUBLISH'
const INBOX = 'NEXT_PUBLIC_STUDIO_P2_PUBLISH_INBOX'
const ORIGIN = 'NEXT_PUBLIC_STUDIO_P2_PUBLISH_ORIGIN_URL'
const LIB = 'lib/studio-p2-publish.ts'
const WIZARD = 'components/publish-wizard.tsx'
const DIALOG = 'components/publish-dialog.tsx'
const P2 = 'components/publish-p2.tsx'
const SUMMARY = 'components/studio-publish-viewer-summary.tsx'
const PRESENTER = 'components/presenter-question.tsx'
const INBOX_UI = 'components/deck-qa-inbox.tsx'
const QUESTIONS = 'app/api/publish/[slug]/questions/route.ts'
const SERIALIZE = 'lib/publish/serialize.ts'
const LAYOUT = 'app/layout.tsx'
const THEME = 'components/studio-viewer-theme-provider.tsx'
const CSS = 'components/studio-publish.css'
const ROUTES_WITH_RECORD = ['app/api/publish/route.ts', 'app/api/publish/by-session/[sessionId]/route.ts', 'app/api/publish/[slug]/route.ts', 'app/api/publish/[slug]/rotate/route.ts']

const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const baseOf = rel => execFileSync('git', ['show', `${BASE}:${rel}`], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 })
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const ser = value => JSON.stringify(value, (key, item) => typeof item === 'function' ? '[fn]' : item === undefined ? '__undefined__' : item)
const plain = value => JSON.parse(JSON.stringify(value))
const deq = (actual, expected, message) => message === undefined ? assert.deepStrictEqual(plain(actual), plain(expected)) : assert.deepStrictEqual(plain(actual), plain(expected), message)
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
let checks = 0
const check = (fn, ...args) => { fn(...args); checks++ }
const unhandled = []
process.on('unhandledRejection', reason => { unhandled.push(reason) })

// ---- the files: the branch's, and the base's with the flags off ----------------------------------------------------------------------------------
const branchSources = Object.fromEntries([...P2_FILES, ...P2_NEW_FILES, ...ROUTES_WITH_RECORD, CSS, SUMMARY, PRESENTER, INBOX_UI, LAYOUT].map(rel => [rel, read(rel)]))
const baseSources = Object.fromEntries(P2_FILES.map(rel => [rel, baseOf(rel)]))

// ---- module loader (transpile + vm) ------------------------------------------------------------------------------------------------------------------
const transpiled = new Map()
function createLoader({ sources = {}, env = {}, stubs = {}, globals = {} }) {
  const cache = new Map()
  const resolve = (spec, from) => {
    const target = spec.startsWith('@/') ? path.join(root, spec.slice(2)) : path.join(root, path.dirname(from), spec)
    for (const suffix of ['', '.ts', '.tsx', '/index.ts']) {
      const full = target + suffix
      if (fs.existsSync(full) && fs.statSync(full).isFile()) return path.relative(root, full)
    }
    throw new Error(`unresolved import ${spec} in ${from}`)
  }
  function run(rel) {
    if (cache.has(rel)) return cache.get(rel)
    const mod = { exports: {} }
    cache.set(rel, mod.exports)
    const source = sources[rel] ?? read(rel)
    const key = sha(rel + '\0' + source)
    if (!transpiled.has(key)) {
      const out = ts.transpileModule(source, { fileName: rel, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
      deq((out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error), [], `${rel} transpiles`)
      transpiled.set(key, out.outputText)
    }
    const requireFor = spec => {
      if (spec in stubs) return stubs[spec]
      if (spec.endsWith('.css')) return {}
      if (spec.startsWith('@/') || spec.startsWith('.')) return run(resolve(spec, rel))
      throw new Error(`unexpected import ${spec} in ${rel}`)
    }
    vm.runInNewContext(transpiled.get(key), { module: mod, exports: mod.exports, process: { env }, console, URL, ...globals, require: requireFor })
    cache.set(rel, mod.exports)
    return mod.exports
  }
  return { load: run }
}
const libWith = (env, sources = branchSources) => createLoader({ sources, env, stubs: {}, globals: {} }).load(LIB)
const ENV_ON = { [SHELL]: 'true', [FLAG]: 'true', [INBOX]: 'true', [ORIGIN]: 'true' }

// ---- a small hooks runtime: one per mounted root; function children are expanded once, statelessly ------------------------------------------------------
let activeRuntime = null
const jsx = (type, props, key) => ({ type, props: props ?? {}, key })
function createRuntime() {
  const cells = [], effects = []
  let cursor = 0, dirty = false
  const changed = (old, deps) => !old || !deps || deps.some((value, index) => !Object.is(value, old.deps?.[index]))
  const api = {
    useState(init) {
      const i = cursor++
      cells[i] ??= { value: typeof init === 'function' ? init() : init }
      const cell = cells[i]
      return [cell.value, value => { const next = typeof value === 'function' ? value(cell.value) : value; if (!Object.is(next, cell.value)) { cell.value = next; dirty = true } }]
    },
    useRef(init) { const i = cursor++; return cells[i] ??= { current: init } },
    useCallback(fn, deps) { const i = cursor++, old = cells[i]; if (changed(old, deps)) cells[i] = { deps, value: fn }; return cells[i].value },
    useMemo(fn, deps) { const i = cursor++, old = cells[i]; if (changed(old, deps)) cells[i] = { deps, value: fn() }; return cells[i].value },
    useEffect(fn, deps) {
      const i = cursor++, old = cells[i]
      if (changed(old, deps)) { cells[i] = { deps, cleanup: old?.cleanup }; effects.push(() => { cells[i].cleanup?.(); cells[i].cleanup = fn() }) }
    },
  }
  return {
    api,
    unmount() { for (const cell of cells) cell?.cleanup?.() },
    pending: () => dirty,
    render(Component, props, { runEffects = true } = {}) {
      const outer = activeRuntime
      activeRuntime = this
      try {
        for (let attempt = 0; attempt < 14; attempt++) {
          cursor = 0; dirty = false
          const tree = Component(props)
          if (runEffects) while (effects.length) effects.shift()()
          if (!dirty) return tree
        }
        throw new Error('render did not settle')
      } finally { activeRuntime = outer }
    },
  }
}
const react = new Proxy({}, {
  get: (_, name) => name === '__esModule' ? false : name === 'default' ? react : name === 'useLayoutEffect' ? (...a) => activeRuntime.api.useEffect(...a) : (...a) => activeRuntime.api[name](...a),
})
const reactStub = { ...Object.fromEntries(['useState', 'useRef', 'useCallback', 'useMemo', 'useEffect', 'useLayoutEffect'].map(name => [name, (...a) => name === 'useLayoutEffect' ? activeRuntime.api.useEffect(...a) : activeRuntime.api[name](...a)])) }
reactStub.default = reactStub
const expand = node => Array.isArray(node) ? node.map(expand)
  : !node || typeof node !== 'object' ? node
    : typeof node.type === 'function' ? expand(createRuntime().render(node.type, node.props, { runEffects: false }))
      : { ...node, props: { ...node.props, ...(node.props?.children === undefined ? {} : { children: expand(node.props.children) }) } }
const flat = node => Array.isArray(node) ? node.flatMap(flat) : !node || typeof node !== 'object' ? [] : [node, ...flat(node.props?.children)]
const text = node => Array.isArray(node) ? node.map(text).join('') : node == null || typeof node === 'boolean' ? '' : typeof node === 'object' ? text(node.props?.children) : String(node)
const squash = value => value.replace(/\s+/g, ' ').trim()
const iconProxy = new Proxy({}, { get: (_, name) => name === '__esModule' ? false : `Icon:${String(name)}` })
const uiStubs = {
  react: reactStub, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' }, 'lucide-react': iconProxy,
  '@/components/ui/button': { Button: 'Button' }, '@/components/ui/input': { Input: 'Input' }, '@/components/ui/label': { Label: 'Label' }, '@/components/ui/switch': { Switch: 'Switch' },
}

// =====================================================================================================================================================
// 1. the import-free lib, in a bare vm
// =====================================================================================================================================================
function libChecks(sources) {
  const lib = (env = ENV_ON) => libWith(env, sources)
  const on = lib()

  // flags: exact "true", Studio shell only
  for (const [name, key] of [['STUDIO_P2_PUBLISH_ENABLED', FLAG], ['STUDIO_P2_PUBLISH_INBOX_ENABLED', INBOX], ['STUDIO_P2_PUBLISH_ORIGIN_ENABLED', ORIGIN]]) {
    for (const value of [undefined, 'false', '1', 'TRUE', ' true', 'true ', '', 'yes']) check(assert.equal, lib({ [SHELL]: 'true', ...(value === undefined ? {} : { [key]: value }) })[name], false, `${name} off for ${JSON.stringify(value)}`)
    check(assert.equal, lib({ [SHELL]: 'true', [key]: 'true' })[name], true, `${name} on`)
    check(assert.equal, lib({ [key]: 'true' })[name], false, `${name}: the Studio shell is required`)
    check(assert.equal, lib({ [SHELL]: 'false', [key]: 'true' })[name], false, `${name}: the shell must be exactly true`)
    for (const other of [FLAG, INBOX, ORIGIN].filter(item => item !== key)) check(assert.equal, lib({ [SHELL]: 'true', [other]: 'true' })[name], false, `${name} is not switched by ${other}`)
  }

  // PUB-01: one vocabulary
  deq(Object.keys(on.AUDIENCE_COPY), ['unlisted', 'public', 'restricted'])
  deq(Object.values(on.AUDIENCE_COPY).map(item => item.title), ['Anyone with the link', 'Anyone — listed publicly', 'Only people with a passcode'])
  check(assert.equal, on.audienceCopy('public').title, 'Anyone — listed publicly')
  for (const value of [null, undefined, '', 'Public', 'private', 'listed', 7, {}]) check(assert.equal, on.audienceCopy(value), null, `audience ${JSON.stringify(value)} is not known`)

  // PUB-02: passcode counter, minimum 6
  check(assert.equal, on.PASSCODE_MIN_LENGTH, 6)
  deq([on.passcodeShortBy(''), on.passcodeShortBy('a'), on.passcodeShortBy('abcde'), on.passcodeShortBy('abcdef'), on.passcodeShortBy('abcdefg')], [0, 5, 1, 0, 0])
  deq([on.passcodeCounter(''), on.passcodeCounter('a'), on.passcodeCounter('abcde'), on.passcodeCounter('abcdef')], [null, '5 more characters needed', '1 more character needed', null])

  // PUB-06: the estimate before recording
  const budget = { narrationMinutes: 16, compressedMinutes: 8.8 }
  deq(on.estimateRecording(budget, 0.05, 10), { minutes: 25.5, cents: 128, segments: 21 })
  deq(on.estimateRecording({ narrationMinutes: 1, compressedMinutes: 0 }, 0, null), { minutes: 1.7, cents: 1, segments: null }, 'a free voice still comes to at least one cent; no slide count, no segments')
  for (const [b, rate, slides] of [[null, 0.05, 10], [undefined, 0.05, 10], [{ narrationMinutes: 0, compressedMinutes: 1 }, 0.05, 10], [{ narrationMinutes: 5, compressedMinutes: -1 }, 0.05, 10],
    [budget, null, 10], [budget, NaN, 10], [budget, Infinity, 10], [budget, -0.1, 10], [budget, '0.05', 10]]) check(assert.equal, on.estimateRecording(b, rate, slides), null, `no estimate for ${ser([b, rate])}`)
  for (const slides of [0, -3, 2.5, NaN, '10', undefined]) check(assert.equal, on.estimateRecording(budget, 0.05, slides).segments, null, `slides ${slides}`)
  deq(on.voiceRateFrom({ voices: [{ id: 'a', name: 'Alloy', costPerMinuteUsd: 0.04 }, { id: 'b', name: 'Bright', costPerMinuteUsd: 0.2 }], effectiveVoiceId: 'b' }), { name: 'Bright', costPerMinuteUsd: 0.2 })
  for (const data of [null, undefined, 'x', {}, { voices: 'no' }, { voices: [], effectiveVoiceId: 'a' }, { voices: [{ id: 'a', name: 'A' }], effectiveVoiceId: 'a' }, { voices: [{ id: 'a', name: 7, costPerMinuteUsd: 1 }], effectiveVoiceId: 'a' },
    { voices: [{ id: 'a', name: 'A', costPerMinuteUsd: NaN }], effectiveVoiceId: 'a' }, { voices: [null, { id: 'a', name: 'A', costPerMinuteUsd: 1 }], effectiveVoiceId: 'zz' }]) check(assert.equal, on.voiceRateFrom(data), null, ser(data))

  // PUB-06 / PUB-07: what the review step may send
  const choices = (extra = {}) => ({ narrationEnabled: true, writeScript: true, recordNarration: true, recordConsentCents: 128, visibility: 'unlisted', ...extra })
  deq(on.publishChoicesFor(choices(), true), choices())
  check(assert.equal, on.publishChoicesFor(choices(), false).writeScript, false, 'no session length, no script request')
  check(assert.equal, on.publishChoicesFor(choices(), false).recordNarration, false, 'no script, no recording')
  check(assert.equal, on.publishChoicesFor(choices({ recordConsentCents: null }), true).recordNarration, false, 'no tick, no recording')
  check(assert.equal, on.publishChoicesFor(choices({ recordConsentCents: 0 }), true).recordNarration, false)
  check(assert.equal, on.publishChoicesFor(choices({ recordConsentCents: undefined }), true).recordNarration, false)
  check(assert.equal, on.publishChoicesFor(choices({ narrationEnabled: false }), true).writeScript, false, 'narration off, no script')
  check(assert.equal, on.publishChoicesFor(choices({ narrationEnabled: false }), true).recordNarration, false)
  check(assert.equal, on.publishChoicesFor(choices({ writeScript: false }), true).recordNarration, false, 'no script step, no recording')
  check(assert.equal, on.publishChoicesFor(choices({ recordNarration: false }), true).recordNarration, false, 'recording not asked for')
  check(assert.equal, on.publishChoicesFor(choices({ visibility: 'public', passcode: 'x' }), true).passcode, 'x', 'everything else passes through')

  // PUB-06: the exact estimate decides
  for (const [consent, body, proceed] of [[128, { estimatedCents: 128 }, true], [128, { estimatedCents: 90 }, true], [128, { estimatedCents: 0 }, true], [128, { estimatedCents: 129 }, false], [128, { estimatedCents: -1 }, false],
    [128, { estimatedCents: NaN }, false], [128, { estimatedCents: '90' }, false], [128, {}, false], [128, null, false], [128, { error: 'x' }, false], [null, { estimatedCents: 1 }, false], [0, { estimatedCents: 1 }, false], [0, { estimatedCents: 0 }, false], [-5, { estimatedCents: 0 }, false],
    [undefined, { estimatedCents: 1 }, false], [-5, { estimatedCents: 1 }, false]]) check(assert.equal, on.recordingVerdict(consent, body).proceed, proceed, `verdict ${ser([consent, body])}`)
  check(assert.match, on.recordingVerdict(128, { estimatedCents: 200 }).detail, /200¢, above the 128¢ you confirmed/)

  // VIEW-04
  for (const [p, expected] of [['/p/abc', true], ['/p/abc/q/tok', true], ['/p/', false], ['/p', false], ['/pricing', false], ['/builder', false], ['/x/p/abc', false], ['', false], [null, false], [undefined, false], [5, false]]) check(assert.equal, on.isPublishedViewerPath(p), expected, `path ${p}`)
  check(assert.equal, on.viewerDefaultTheme('/p/abc', true, 'light'), 'system')
  check(assert.equal, on.viewerDefaultTheme('/p/abc', false, 'light'), 'light', 'flag off keeps the root default')
  check(assert.equal, on.viewerDefaultTheme('/builder', true, 'light'), 'light')
  check(assert.equal, on.viewerDefaultTheme('/p/abc', true, undefined), 'system')

  // PUB-16
  deq(on.inboxRowActions({ status: 'blocked' }), { unblock: true, removeFromFaq: false, publishToFaq: false, answer: false })
  deq(on.inboxRowActions({ status: 'deferred' }), { unblock: false, removeFromFaq: false, publishToFaq: true, answer: true })
  deq(on.inboxRowActions({ status: 'answered', faqItemId: 'f1' }), { unblock: false, removeFromFaq: true, publishToFaq: false, answer: true })
  deq(on.inboxRowActions({ status: 'blocked', faqItemId: 'f1' }), { unblock: true, removeFromFaq: false, publishToFaq: false, answer: false }, 'a blocked row offers Unblock only')
  for (const id of [null, undefined, '', 0, 7, {}, false]) check(assert.equal, on.faqItemIdOf({ status: 'answered', faqItemId: id }), null, `faq id ${ser(id)}`)

  // PUB-03: the subtitle says the count, and says nothing about hidden slides or notes
  deq(['x', 0, -1, 2.5, NaN, '3', null, undefined, 1, 12].map(on.slideCountPhrase), [null, null, null, null, null, null, null, null, '1 slide', '12 slides'])
  check(assert.equal, on.dialogSubtitle({ live: false, title: 'Q3 Review', slideCount: 12 }), 'Share a view-only copy of “Q3 Review” at a Deckster link. Viewers will see 12 slides.')
  check(assert.equal, on.dialogSubtitle({ live: false, title: 'Q3 Review', slideCount: 1 }), 'Share a view-only copy of “Q3 Review” at a Deckster link. Viewers will see 1 slide.')
  check(assert.equal, on.dialogSubtitle({ live: false, title: null, slideCount: null }), 'Share a view-only copy of this deck at a Deckster link.')
  check(assert.equal, on.dialogSubtitle({ live: true, title: 'Q3 Review', slideCount: 12 }), '“Q3 Review” · 12 slides · Anyone with access can view its frozen published copy.')
  check(assert.equal, on.dialogSubtitle({ live: true, title: '', slideCount: 12 }), '12 slides · Anyone with access can view a frozen copy of this deck.')
  check(assert.equal, on.dialogSubtitle({ live: true, title: 'Q3 Review', slideCount: 0 }), '“Q3 Review” · Anyone with access can view its frozen published copy.')
  for (const live of [true, false]) for (const title of ['T', null]) for (const slideCount of [null, 0, 3]) {
    check(assert.doesNotMatch, on.dialogSubtitle({ live, title, slideCount }), /hidden|private|notes|stay/i, 'the privacy sentence is not claimed: the published copy carries speaker notes')
  }

  // PUB-04
  check(assert.equal, on.QUESTIONS_AFTER_PUBLISH_NOTE, 'Style, limits and sources are set in Questions after you publish.')

  // PUB-08 / PUB-15: one row per thing that works
  const all = { visibility: 'restricted', allowPdf: true, allowPptx: false, qaEnabled: true, qaAutoAnswer: true, narrationEnabled: true }
  deq(on.capabilityRows(all).map(row => [row.id, row.on]), [['lock', true], ['index', false], ['present', true], ['ask', true], ['pdf', true], ['pptx', false], ['narration', true]])
  deq(on.capabilityRows({ ...all, visibility: 'public' }).slice(0, 2).map(row => [row.id, row.on]), [['lock', false], ['index', true]])
  deq(on.capabilityRows({ ...all, visibility: 'unlisted' }).slice(0, 2).map(row => [row.id, row.on]), [['lock', false], ['index', false]])
  deq(on.capabilityRows({}).map(row => row.id), ['present'], 'nothing confirmed, nothing claimed except the viewer itself')
  for (const visibility of ['Public', '', null, undefined, 5, 'private']) check(assert.equal, on.capabilityRows({ ...all, visibility }).some(row => row.id === 'lock' || row.id === 'index'), false, `unknown audience ${ser(visibility)} gets no audience rows`)
  for (const key of ['allowPdf', 'allowPptx', 'qaEnabled', 'narrationEnabled']) for (const value of [undefined, null, 'true', 1, 0, 'yes']) {
    const id = { allowPdf: 'pdf', allowPptx: 'pptx', qaEnabled: 'ask', narrationEnabled: 'narration' }[key]
    check(assert.equal, on.capabilityRows({ ...all, [key]: value }).some(row => row.id === id), false, `${key} ${ser(value)} is not a plain boolean: no row`)
  }
  check(assert.match, on.capabilityRows({ ...all, qaAutoAnswer: false }).find(row => row.id === 'ask').note, /Every question comes to you/)
  check(assert.match, on.capabilityRows({ ...all, qaAutoAnswer: true }).find(row => row.id === 'ask').note, /Answers come from the deck/)
  check(assert.match, on.capabilityRows({ ...all, qaEnabled: false }).find(row => row.id === 'ask').note, /switched off/)
  check(assert.match, on.capabilityRows(all).find(row => row.id === 'narration').note, /once a script and a recording exist/, 'narration is not promised without its script and recording')
  for (const row of on.capabilityRows(all)) check(assert.doesNotMatch, row.label + row.note, /hidden slide|notes stay|aloud|speaks/i, `${row.id}: only what works is claimed`)
  check(assert.match, on.viewerPreviewNote('current'), /matches the published copy at the last check/)
  check(assert.match, on.viewerPreviewNote('stale'), /frozen earlier and may differ/)
  check(assert.match, on.viewerPreviewNote('checking'), /Checking/)
  check(assert.match, on.viewerPreviewNote('unknown'), /not confirmed/)
  check(assert.match, on.viewerPreviewNote(undefined), /not confirmed/)

  // PUB-11: facts
  deq(on.parseQuestionCounts({ totalCount: 5, unansweredCount: 2, qaEnabled: true }), { total: 5, waiting: 2 })
  deq(on.parseQuestionCounts({ totalCount: 0, unansweredCount: 0 }), { total: 0, waiting: 0 })
  for (const data of [null, undefined, 'x', 3, {}, { totalCount: 5 }, { unansweredCount: 2 }, { totalCount: -1, unansweredCount: 0 }, { totalCount: 2.5, unansweredCount: 0 }, { totalCount: '5', unansweredCount: 2 },
    { totalCount: 2, unansweredCount: 5 }, { totalCount: NaN, unansweredCount: 0 }, { totalCount: Infinity, unansweredCount: 0 }, { totalCount: 1e20, unansweredCount: 0 }]) check(assert.equal, on.parseQuestionCounts(data), null, ser(data))
  deq([on.questionsFact(false, { total: 3, waiting: 1 }), on.questionsFact(true, null), on.questionsFact(true, { total: 0, waiting: 0 }), on.questionsFact(true, { total: 3, waiting: 1 }), on.questionsFact(true, { total: 3, waiting: 0 })],
    ['Questions: off', 'Questions: on', 'Questions: on · none asked yet', 'Questions: on · 3 asked · 1 waiting', 'Questions: on · 3 asked · none waiting'])
  deq([on.questionsBadge(null), on.questionsBadge({ total: 3, waiting: 0 }), on.questionsBadge({ total: 3, waiting: 1 }), on.questionsBadge({ total: 30, waiting: 9 }), on.questionsBadge({ total: 30, waiting: 10 }), on.questionsBadge({ total: 30, waiting: 12 })],
    [null, null, { text: '1', label: '1 question waiting' }, { text: '9', label: '9 questions waiting' }, { text: '9+', label: '10 questions waiting' }, { text: '9+', label: '12 questions waiting' }])
  const manifest = (slides, extra = {}) => ({ voiceName: 'Alloy', slides: slides.map(full => ({ slideId: 's', full, stale: false })), missing: 0, ...extra })
  deq(on.parseNarrationState(manifest(['a', 'b', null])), { voiceName: 'Alloy', recorded: 2, needRecording: 0 })
  deq(on.parseNarrationState(manifest(['', null], { missing: 2, voiceName: '  ' })), { voiceName: null, recorded: 0, needRecording: 2 })
  deq(on.parseNarrationState({ ...manifest(['a']), slides: [null, { full: 'a' }, { full: 5 }] }), { voiceName: 'Alloy', recorded: 1, needRecording: 0 })
  for (const data of [null, undefined, 'x', {}, { slides: [] }, { slides: 'no', missing: 0 }, { slides: [], missing: -1 }, { slides: [], missing: 1.5 }, { slides: [], missing: '0' }]) check(assert.equal, on.parseNarrationState(data), null, ser(data))
  deq([on.narrationFact(false, { voiceName: 'Alloy', recorded: 3, needRecording: 0 }), on.narrationFact(true, null), on.narrationFact(true, { voiceName: 'Alloy', recorded: 12, needRecording: 0 }),
    on.narrationFact(true, { voiceName: 'Alloy', recorded: 1, needRecording: 0 }), on.narrationFact(true, { voiceName: null, recorded: 4, needRecording: 2 }), on.narrationFact(true, { voiceName: 'Alloy', recorded: 0, needRecording: 3 }),
    on.narrationFact(true, { voiceName: 'Alloy', recorded: 0, needRecording: 1 }), on.narrationFact(true, { voiceName: 'Alloy', recorded: 0, needRecording: 0 })],
    ['Narration: off', 'Narration: on', 'Narration: on · Narrated by Alloy · 12 slides recorded', 'Narration: on · Narrated by Alloy · 1 slide recorded', 'Narration: on · 4 slides recorded · 2 need recording',
      'Narration: on · Narrated by Alloy · 3 slides need recording', 'Narration: on · Narrated by Alloy · 1 slide need recording', 'Narration: on · Narrated by Alloy · no script yet'])

  // the viewer link's origin
  deq(['https://uat.example.com', 'https://uat.example.com/p/x?y=1#z', 'http://localhost:3000/a', 'HTTPS://UAT.example.com'].map(on.cleanOrigin), ['https://uat.example.com', 'https://uat.example.com', 'http://localhost:3000', 'https://uat.example.com'])
  for (const value of [null, undefined, '', 5, 'uat.example.com', 'javascript:alert(1)', 'ftp://x.com', 'https://user:pw@x.com', 'https://user@x.com', 'data:text/html,x', 'https://', 'a'.repeat(301), {}, 'file:///etc/passwd']) check(assert.equal, on.cleanOrigin(value), null, `origin ${ser(value)}`)
  const req = (url, headers = {}) => ({ url, headers: { get: name => headers[name.toLowerCase()] ?? null } })
  check(assert.equal, on.requestOrigin(req('http://localhost:3000/api/publish')), 'http://localhost:3000')
  check(assert.equal, on.requestOrigin(req('http://localhost:3000/api/publish', { 'x-forwarded-host': 'uat.example.com', 'x-forwarded-proto': 'https' })), 'https://uat.example.com')
  check(assert.equal, on.requestOrigin(req('http://internal/x', { 'x-forwarded-host': 'uat.example.com, proxy.local', 'x-forwarded-proto': 'https, http' })), 'https://uat.example.com', 'the first hop')
  check(assert.equal, on.requestOrigin(req('http://internal/x', { 'x-forwarded-host': 'uat.example.com' })), 'https://uat.example.com', 'no forwarded protocol: https')
  check(assert.equal, on.requestOrigin(req('http://internal/x', { 'x-forwarded-host': 'uat.example.com', 'x-forwarded-proto': 'javascript' })), 'https://uat.example.com', 'a forwarded protocol that is not http(s) is ignored')
  check(assert.equal, on.requestOrigin(req('http://internal/x', { 'x-forwarded-host': 'dev.local:8443', 'x-forwarded-proto': 'http' })), 'http://dev.local:8443')
  check(assert.equal, on.requestOrigin(req('http://internal/x', { 'x-forwarded-host': 'evil.com/path?x', 'x-forwarded-proto': 'https' })), 'https://evil.com', 'a forwarded host is an origin, never a path')
  check(assert.equal, on.requestOrigin(req('http://internal/x', { 'x-forwarded-host': 'user:pw@evil.com' })), 'http://internal', 'credentials in a forwarded host: fall back to the request address')
  check(assert.equal, on.requestOrigin(req('http://internal/x', { 'x-forwarded-host': 'bad host' })), 'http://internal')
  check(assert.equal, on.requestOrigin(req('not a url')), null)
  check(assert.equal, on.requestOrigin(null), null)
  check(assert.equal, on.requestOrigin(undefined), null)
  check(assert.equal, on.publicBaseUrl('https://deckster-xyz-uat.vercel.app', 'https://other.example', true), 'https://deckster-xyz-uat.vercel.app', 'NEXT_PUBLIC_APP_URL wins')
  check(assert.equal, on.publicBaseUrl('https://configured.example', 'https://other.example', false), 'https://configured.example')
  check(assert.equal, on.publicBaseUrl(undefined, 'https://uat.example.com/x', true), 'https://uat.example.com')
  check(assert.equal, on.publicBaseUrl('', 'https://uat.example.com', true), 'https://uat.example.com', 'an empty NEXT_PUBLIC_APP_URL counts as unset')
  check(assert.equal, on.publicBaseUrl(undefined, 'https://uat.example.com', false), 'https://deckster.xyz', 'flag off: production, as before')
  check(assert.equal, on.publicBaseUrl(undefined, null, true), 'https://deckster.xyz')
  check(assert.equal, on.publicBaseUrl(undefined, 'garbage', true), 'https://deckster.xyz')
  check(assert.equal, on.publicBaseUrl(undefined, 'javascript:alert(1)', true), 'https://deckster.xyz')
  const record = { slug: 'abc_123-X', publicUrl: 'https://deckster.xyz/p/abc_123-X' }
  check(assert.equal, on.viewerLinkFor(record, undefined, 'https://uat.example.com', true), 'https://uat.example.com/p/abc_123-X')
  check(assert.equal, on.viewerLinkFor(record, undefined, 'https://uat.example.com', false), record.publicUrl, 'flag off: the server link')
  check(assert.equal, on.viewerLinkFor(record, 'https://configured.example', 'https://uat.example.com', true), record.publicUrl, 'NEXT_PUBLIC_APP_URL set: the server link (it used it)')
  check(assert.equal, on.viewerLinkFor(record, undefined, null, true), record.publicUrl, 'the browser does not know its origin')
  check(assert.equal, on.viewerLinkFor(record, undefined, 'garbage', true), record.publicUrl)
  check(assert.equal, on.viewerLinkFor({ slug: '../x', publicUrl: 'U' }, undefined, 'https://uat.example.com', true), 'U', 'a slug that is not a slug is never put in a link')
  check(assert.equal, on.viewerLinkFor({ slug: '', publicUrl: 'U' }, undefined, 'https://uat.example.com', true), 'U')
  check(assert.equal, on.viewerLinkFor({ slug: 5, publicUrl: 'U' }, undefined, 'https://uat.example.com', true), 'U')
  // linkOriginOf reads the flag itself
  check(assert.equal, lib(ENV_ON).linkOriginOf(req('http://localhost:3000/x')), 'http://localhost:3000')
  check(assert.equal, lib({ [SHELL]: 'true' }).linkOriginOf(req('http://localhost:3000/x')), undefined, 'flag off: nothing is handed to the serializer')
  check(assert.equal, lib(ENV_ON).linkOriginOf(null), undefined)
}

// =====================================================================================================================================================
// 2. the strip table: nothing is changed that is not listed, and every listed change is guarded
// =====================================================================================================================================================
const MARKERS = ['STUDIO_P2_PUBLISH', 'STUDIO_P2_INBOX', 'STUDIO_P2_PUBLISH_INBOX_ENABLED', 'STUDIO_P2_PUBLISH_ENABLED', 'STUDIO_P2_PUBLISH_ORIGIN_ENABLED', 'p2Actions', 'p2Facts', 'AppThemeProvider',
  'linkOriginOf', 'publishedLink', 'reverse', 'data-studio-published-ask']
// The one kind of change a line-level guard cannot see: a parameter that only a flag-guarded line reads. Each is proved inert by the flag-off tree identity (section 5) and
// the serialize matrix (section 3).
const UNGUARDED_BUT_INERT = ['export function StudioPublishViewerSummary({ record, sessionId, isLoading, loadError, staleness, deckPreview }: Props) {', 'export function getPublicAppUrl(origin?: string | null): string {',
  'export function publicUrlForSlug(slug: string, origin?: string | null): string {', '  return `${getPublicAppUrl(origin)}/p/${slug}`', 'export function serializePublishedDeck(deck: PublishedDeck, origin?: string | null): SerializedPublishedDeck {',
  '    publicUrl: publicUrlForSlug(deck.slug, origin),', '  const p2Facts = useP2ManageFacts(record, open)']
const gitGrep = (needle, paths) => { try { return execFileSync('git', ['grep', '-l', '-F', needle, BASE, '--', ...paths], { cwd: root, encoding: 'utf8' }).trim() } catch { return '' } }

function stripChecks(sources, base = baseSources) {
  for (const rel of P2_FILES) {
    const stripped = stripP2Publish(rel, sources[rel])
    check(assert.equal, sha(stripped), sha(base[rel]), `${rel}: stripping this change gives back the base's file, byte for byte`)
    // every listed change is found exactly once, in the order it is put back
    let text = sources[rel]
    for (const [from, to] of P2_PAIRS[rel]) {
      check(assert.equal, text.split(from).length - 1, 1, `${rel}: one place for ${JSON.stringify(from.slice(0, 70))}`)
      check(assert.notEqual, from, to, `${rel}: a listed change changes something`)
      text = text.replace(from, () => to)
    }
    check(assert.equal, text, base[rel])
  }
  check(assert.ok, true)
}

/** Static guard: each listed change that adds code mentions a flag, unless what it adds is only imports, comments, optional type members, CSS rules with markup the base never had, or a doc line. */
function guardChecks(sources) {
  for (const rel of P2_FILES) {
    for (const [from, to] of P2_PAIRS[rel]) {
      const had = new Map()
      for (const line of to.split('\n')) had.set(line, (had.get(line) ?? 0) + 1)
      const added = []
      for (const line of from.split('\n')) {
        if ((had.get(line) ?? 0) > 0) had.set(line, had.get(line) - 1)
        else added.push(line)
      }
      const code = added.filter(line => line.trim() && !UNGUARDED_BUT_INERT.includes(line) && !/^\s*(\/\/|\/\*|\*|#)/.test(line) && !/^\s*import\b/.test(line) && !/^\s*\}?\s*from '/.test(line) && !/^\s*[A-Za-z_]+\?: [^=]+$/.test(line) && !/^\s*(<\/[A-Za-z.]*>|[)}\]]+)[;,)]*\s*$/.test(line))
      if (rel.endsWith('.css')) {
        const rules = added.join('\n').replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(line => line.trim())
        for (const line of rules) {
          const tokens = line.match(/\.studio-[a-z0-9-]+|data-studio-[a-z-]+/g) ?? []
          check(assert.ok, tokens.some(token => !gitGrep(token.replace(/^\./, ''), ['components', 'app', 'lib', 'hooks'])), `${rel}: a CSS rule that can only match flag-on markup: ${line.slice(0, 80)}`)
        }
      } else if (rel === '.env.example' || rel === 'package.json') {
        check(assert.ok, code.every(line => /P2_PUBLISH|test:studio-p2-publish|test:studio-image-pending-write/.test(line)), `${rel}: only this change's lines`)
      } else if (code.length) {
        check(assert.ok, MARKERS.some(marker => added.some(line => line.includes(marker))), `${rel}: guarded by a flag: ${added.join(' / ').slice(0, 140)}`)
      }
    }
  }
  // the new files are imported by the changed files only, and the base has never heard of them
  for (const rel of P2_NEW_FILES) {
    const module = rel.replace(/^(components|lib)\//, '').replace(/\.(tsx|ts)$/, '')
    check(assert.equal, gitGrep(module, ['components', 'app', 'lib', 'hooks', 'middleware.ts']), '', `${rel} does not exist in the base and nothing there imports it`)
    const importers = execFileSync('git', ['grep', '-l', '-F', module, '--', 'components', 'app', 'lib', 'hooks'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean)
    for (const importer of importers) check(assert.ok, P2_FILES.includes(importer) || P2_NEW_FILES.includes(importer), `${importer} imports ${module} and is in the strip table`)
  }
  // the three flags are read in exactly one place each (the lib); every consumer goes through its constant
  const flagReads = ['NEXT_PUBLIC_STUDIO_P2_PUBLISH', 'NEXT_PUBLIC_STUDIO_P2_PUBLISH_INBOX', 'NEXT_PUBLIC_STUDIO_P2_PUBLISH_ORIGIN_URL']
  for (const name of flagReads) {
    const candidates = execFileSync('git', ['grep', '-l', '-F', `process.env.${name}`, '--', 'components', 'app', 'lib', 'hooks'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean)
    const users = candidates.filter(rel => new RegExp(`process\\.env\\.${name}(?![A-Za-z0-9_])`).test(read(rel)))
    deq(users, [LIB], `${name} is read in the lib only`)
  }
}

// =====================================================================================================================================================
// 3. serialize: the published link's base
// =====================================================================================================================================================
const DECK = {
  id: 'd1', slug: 'abc123', sessionId: 's1', sourcePresentationId: 'src', snapshotPresentationId: 'snap', title: 'Q3 Review', slideCount: 12, visibility: 'unlisted', passcodeHash: null,
  allowPdf: true, allowPptx: true, viewCount: 3, publishedAt: new Date('2026-10-01T10:00:00Z'), republishedAt: null, revokedAt: null, sourceUpdatedAt: '2026-10-01T09:00:00Z',
  qaEnabled: true, qaCorpusStatus: 'ready', qaDailyCap: 50, qaMonthlyCap: 500, qaVisitorBurstLimit: 3, qaVisitorDailyLimit: 10, qaTonePreset: 'neutral', qaToneInstruction: null, qaCiteWebSources: false,
  qaAutoAnswer: true, narrationEnabled: true, narrationBudgetMinutes: 20, qaReserveMinutes: null,
}

function serializeChecks(sources, base = baseSources) {
  const load = (env, rel = SERIALIZE, from = sources) => createLoader({ sources: from, env }).load(rel)
  const APP = 'https://deckster-xyz-uat.vercel.app'
  const ORIGINS = [undefined, null, 'https://uat.example.com', 'garbage', 'javascript:alert(1)', 'http://localhost:3000']
  for (const shell of [true, false]) for (const flag of [undefined, 'false', '1', 'TRUE', ' true', 'true']) for (const app of [undefined, APP]) {
    const env = { ...(shell ? { [SHELL]: 'true' } : {}), ...(flag === undefined ? {} : { [ORIGIN]: flag }), ...(app ? { NEXT_PUBLIC_APP_URL: app } : {}) }
    const branch = load(env), before = load(env, SERIALIZE, { [SERIALIZE]: base[SERIALIZE] })
    const enabled = shell && flag === 'true'
    for (const origin of ORIGINS) {
      const out = branch.serializePublishedDeck(DECK, origin)
      const expected = app ?? (enabled && origin === 'https://uat.example.com' ? 'https://uat.example.com' : enabled && origin === 'http://localhost:3000' ? 'http://localhost:3000' : 'https://deckster.xyz')
      check(assert.equal, out.publicUrl, `${expected}/p/abc123`, `publicUrl for ${ser([shell, flag, app, origin])}`)
      if (!enabled) {
        // flag off: the whole record, and the helper's answers, are the base's
        check(assert.equal, ser(out), ser(before.serializePublishedDeck(DECK)), `flag off: the record is the base's (${ser([shell, flag, app, origin])})`)
        check(assert.equal, branch.getPublicAppUrl(origin), before.getPublicAppUrl())
        check(assert.equal, branch.publicUrlForSlug('x', origin), before.publicUrlForSlug('x'))
      }
    }
    check(assert.equal, ser(branch.serializePublishedDeck(DECK)), ser(enabled || !app && false ? branch.serializePublishedDeck(DECK) : before.serializePublishedDeck(DECK)), 'no origin: nothing to derive')
  }
  // every route that answers with a record hands the serializer the request's origin
  const callSites = { 'app/api/publish/route.ts': 1, 'app/api/publish/by-session/[sessionId]/route.ts': 2, 'app/api/publish/[slug]/route.ts': 2, 'app/api/publish/[slug]/rotate/route.ts': 1 }
  for (const [rel, count] of Object.entries(callSites)) {
    const source = sources[rel]
    const calls = source.match(/serializePublishedDeck\([^)]*\)+/g).filter(call => !/^serializePublishedDeck\(deck: /.test(call))
    check(assert.equal, calls.length, count, `${rel}: ${count} record answers`)
    for (const call of calls) check(assert.match, call, /^serializePublishedDeck\(\w+, linkOriginOf\(req\)\)/, `${rel}: ${call}`)
    check(assert.match, source, /import \{ linkOriginOf \} from '@\/lib\/studio-p2-publish';/)
  }
}

// =====================================================================================================================================================
// 4. the owner's questions route: request matrix
// =====================================================================================================================================================
function questionsWorld(routeSource, env, { rows = null, owner = null, fail = false } = {}) {
  const world = { calls: [] }
  const defaults = [
    { id: 'q3', status: 'deferred', ownerAnswer: null, faq: null }, { id: 'q2', status: 'answered', ownerAnswer: 'Yes', faq: { id: 'f1', published: true } },
    { id: 'q1', status: 'blocked', ownerAnswer: null, faq: { id: 'f2', published: false } },
  ]
  const stubs = {
    'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) }, NextRequest: Request },
    '@/lib/prisma': { prisma: { deckQuestion: {
      findMany: async query => { world.calls.push(['findMany', query]); return structuredClone(rows ?? defaults) },
      count: async query => {
        world.calls.push(['count', query])
        if (fail) throw new Error('database down')
        return query.where.ownerAnswer === null ? 3 : 7
      },
    } } },
    '@/lib/publish/qa-owner': { requireDeckOwner: async slug => { world.calls.push(['owner', slug]); return owner ?? { deck: { id: 'deck1', qaEnabled: true, qaCorpusStatus: 'ready' } } } },
    '@/lib/publish/qa-serialize': { serializeQuestionForOwner: row => ({ id: row.id, status: row.status, ownerAnswer: row.ownerAnswer ?? null }) },
  }
  const route = createLoader({ sources: { [QUESTIONS]: routeSource, [LIB]: branchSources[LIB] }, env, stubs, globals: { Response, Request, console: { ...console, error: () => {}, warn: () => {} } } }).load(QUESTIONS)
  world.get = async (query = '') => {
    world.calls = []
    const res = await route.GET(new Request(`http://localhost/api/publish/abc/questions${query}`), { params: Promise.resolve({ slug: 'abc' }) })
    return { status: res.status, body: await res.json(), calls: plain(world.calls) }
  }
  return world
}

async function questionsChecks(sources, base = baseSources) {
  const QUERIES = ['', '?summary=1', '?summary=true', '?summary=0', '?summary=', '?summary=1&status=blocked', '?summary=1&status=bogus', '?status=answered', '?status=bogus', '?cursor=q9', '?summary=1&cursor=q9', '?summary=1&summary=0']
  const OFF_ENVS = [{}, { [SHELL]: 'true' }, { [SHELL]: 'true', [FLAG]: 'false' }, { [SHELL]: 'true', [FLAG]: '1' }, { [SHELL]: 'true', [FLAG]: 'TRUE' }, { [FLAG]: 'true' }, { [SHELL]: 'true', [ORIGIN]: 'true' }]
  const before = env => questionsWorld(base[QUESTIONS], env)
  // flag off: the route answers the base's bytes to every question, the summary parameter included (it is not read)
  for (const env of OFF_ENVS) {
    const now = questionsWorld(sources[QUESTIONS], env), then = before(env)
    for (const query of QUERIES) deq(await now.get(query), await then.get(query), `flag off ${ser(env)} ${query}`)
    check(assert.ok, true)
  }
  // INBOX on alone: only the FAQ join changes, and never the summary
  { const world = questionsWorld(sources[QUESTIONS], { [SHELL]: 'true', [INBOX]: 'true' }), out = await world.get('')
    deq(out.body.questions.map(item => item.faqItemId), ['null', 'f1', 'null'].map(item => item === 'null' ? null : item), 'a published FAQ entry only')
    deq(out.calls.find(call => call[0] === 'findMany')[1].include, { faq: { select: { id: true, published: true } } })
    const summary = await world.get('?summary=1')
    check(assert.equal, 'totalCount' in summary.body, false, 'the summary is the main flag\'s') }
  // main flag on: ?summary=1 answers the counts and nothing else
  for (const env of [{ [SHELL]: 'true', [FLAG]: 'true' }, { [SHELL]: 'true', [FLAG]: 'true', [INBOX]: 'true' }]) {
    const world = questionsWorld(sources[QUESTIONS], env)
    const out = await world.get('?summary=1')
    check(assert.equal, out.status, 200)
    deq(out.body, { totalCount: 7, unansweredCount: 3, qaEnabled: true })
    deq(out.calls, [['owner', 'abc'], ['count', { where: { publishedDeckId: 'deck1' } }], ['count', { where: { publishedDeckId: 'deck1', ownerAnswer: null, status: { not: 'blocked' } } }]], 'two counts over the deck, no rows, nothing written')
    for (const query of ['?summary=true', '?summary=0', '?summary=', '?summary=2', '?Summary=1', '?summary=%31']) {
      const other = await world.get(query)
      check(assert.equal, query === '?summary=%31' ? 'totalCount' in other.body : 'totalCount' in other.body, query === '?summary=%31', `only summary=1 asks for the counts (${query})`)
    }
    check(assert.equal, (await world.get('?summary=1&status=bogus')).status, 400, 'the status filter is still validated first')
    deq((await world.get('?summary=1&status=blocked')).body, { totalCount: 7, unansweredCount: 3, qaEnabled: true }, 'the counts are over the whole deck, as the inbox badge is')
    const plainList = await world.get('')
    check(assert.equal, plainList.body.questions.length, 3, 'the list is unchanged')
    check(assert.equal, plainList.calls.filter(call => call[0] === 'count').length, 1)
    // qa off still answers (the facts are only asked for when questions are on)
    const off = questionsWorld(sources[QUESTIONS], env, { owner: { deck: { id: 'deck1', qaEnabled: false, qaCorpusStatus: 'none' } } })
    deq((await off.get('?summary=1')).body, { totalCount: 7, unansweredCount: 3, qaEnabled: false })
    // not the owner / not signed in: the owner check's answer, and nothing is counted
    const denied = questionsWorld(sources[QUESTIONS], env, { owner: { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) } })
    const refused = await denied.get('?summary=1')
    check(assert.equal, refused.status, 401); deq(refused.body, { error: 'Unauthorized' }); deq(refused.calls, [['owner', 'abc']], 'a stranger is refused before any count')
    const broken = questionsWorld(sources[QUESTIONS], env, { fail: true })
    const failed = await broken.get('?summary=1')
    check(assert.equal, failed.status, 500); deq(failed.body, { error: 'Could not load questions' })
  }
}

// =====================================================================================================================================================
// 5. the components, on the real source with a small hooks runtime and fake services
// =====================================================================================================================================================
// The base's answers do not change between mutants: measured once. LIGHT (the mutants) runs two spellings of the flag, the whole suite runs them all.
const memo = new Map()
const once = (key, fn) => { if (!memo.has(key)) memo.set(key, fn()); return memo.get(key) }
let LIGHT = false
const pickEnvs = list => LIGHT ? [list[0], list[Math.min(5, list.length - 1)]] : list

const RECORD = {
  id: 'd1', slug: 'abc123', sessionId: 's1', sourcePresentationId: 'src', snapshotPresentationId: 'snap1', title: 'Q3 Review', slideCount: 12, visibility: 'unlisted', hasPasscode: false,
  allowPdf: true, allowPptx: false, viewCount: 3, publishedAt: '2026-10-01T10:00:00.000Z', republishedAt: null, revokedAt: null, sourceUpdatedAt: '2026-10-01T09:00:00.000Z',
  publicUrl: 'https://deckster.xyz/p/abc123', qaEnabled: true, qaCorpusStatus: 'ready', qaDailyCap: 50, qaMonthlyCap: 500, qaVisitorBurstLimit: 3, qaVisitorDailyLimit: 10, qaTonePreset: 'neutral',
  qaToneInstruction: null, qaCiteWebSources: false, qaAutoAnswer: true, narrationEnabled: true, narrationBudgetMinutes: 20, qaReserveMinutes: null,
}
const OFF_ENVS = [{ [SHELL]: 'true' }, { [SHELL]: 'true', [FLAG]: 'false' }, { [SHELL]: 'true', [FLAG]: '1' }, { [SHELL]: 'true', [FLAG]: 'TRUE' }, { [SHELL]: 'true', [FLAG]: ' true' }, { [FLAG]: 'true' },
  { [FLAG]: 'true', [INBOX]: 'true', [ORIGIN]: 'true' }, { [SHELL]: 'true', [INBOX]: 'true', [ORIGIN]: 'true' }, {}]
const ON_ENV = { [SHELL]: 'true', [FLAG]: 'true' }
const LIVE_ORIGIN = 'https://uat.example.com'

/** The tree as React sees it: `false`, `true`, null and undefined children draw nothing, so a guarded line that is off leaves no trace; a one-child array is the child. */
const canon = node => {
  if (Array.isArray(node)) {
    const kept = node.filter(child => child !== false && child !== true && child !== null && child !== undefined).map(canon)
    return kept.length === 1 ? kept[0] : kept
  }
  if (!node || typeof node !== 'object') return node
  const props = Object.fromEntries(Object.entries(node.props).filter(([, value]) => value !== undefined))
  if ('children' in props) {
    const children = canon(props.children)
    if (Array.isArray(children) && children.length === 0) delete props.children
    else if (children === false || children === true || children === null || children === undefined) delete props.children
    else props.children = children
  }
  return { ...node, props }
}

const componentStubs = (extra = {}) => ({
  ...uiStubs,
  '@/components/narration-voice-picker': { NarrationVoicePicker: 'NarrationVoicePicker' },
  '@/components/studio-publish-preview': { StudioPublishPreview: 'StudioPublishPreview' },
  '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
  '@/hooks/use-copy-to-clipboard': { useCopyToClipboard: () => ({ copied: false, copy: async () => true }) },
  ...extra,
})

/** One mounted component: `fetchImpl(url, init)` answers the requests, every one is logged. */
function makeUi({ sources, env, rel, name, props, stubs = {}, fetchImpl = async () => ({ ok: false, status: 404, json: async () => ({}) }), window: win }) {
  const log = []
  const fetch = async (url, init = {}) => { log.push([init.method ?? 'GET', url, init.body ?? null]); return fetchImpl(url, init) }
  const globals = { fetch, AbortSignal, DOMException, Error, setTimeout: () => 1, clearTimeout() {}, ...(win === undefined ? {} : { window: win }) }
  const mod = createLoader({ sources, env, stubs: componentStubs(stubs), globals }).load(rel)
  const runtime = createRuntime()
  let current = props, tree = null
  const snaps = []
  const ui = {
    log, snaps, mod,
    get tree() { return tree },
    render(next = {}) { current = { ...current, ...next }; tree = runtime.render(mod[name], current); return tree },
    async settle(turns = 12) { ui.render(); for (let i = 0; i < turns; i++) { await tick(); ui.render() } return tree },
    all: () => flat(expand(tree)),
    find: pred => ui.all().filter(pred),
    text: () => squash(text(expand(tree))),
    snap(label) { ui.render(); snaps.push([label, sha(ser(canon(tree)))]); return snaps.at(-1)[1] },
    button: label => ui.all().find(node => node.type === 'Button' && squash(text(node)).startsWith(label)),
    click(label) { const button = ui.button(label); assert.ok(button, `button "${label}"`); if (button.props.disabled) return 'disabled'; button.props.onClick(); ui.render(); return 'clicked' },
    byId: (type, id) => ui.all().find(node => node.type === type && node.props.id === id),
    setSwitch(id, value) { const node = ui.byId('Switch', id); assert.ok(node, `switch ${id}`); node.props.onCheckedChange(value); ui.render() },
    setInput(id, value) { const node = ui.byId('Input', id); assert.ok(node, `input ${id}`); node.props.onChange({ target: { value } }); ui.render() },
    pick(value) {
      const node = ui.all().find(item => item.type === 'input' && item.props.type === 'radio' && item.props.value === value)
      if (node) node.props.onChange()
      else { const select = ui.all().find(item => item.type === 'select' && item.props.id === 'wiz-visibility'); assert.ok(select, `radio or select for ${value}`); select.props.onChange({ target: { value } }) }
      ui.render()
    },
    unmount: () => runtime.unmount(),
  }
  ui.render()
  return ui
}

const WIZARD_PROPS = (extra = {}) => ({ sessionId: 's1', deckPreview: undefined, slideCount: 12, record: null, busy: false, progress: null, onPublish() {}, onCancel() {}, onProgressClose() {}, ...extra })
const wizardUi = (sources, env, props = {}, extra = {}) => makeUi({ sources, env, rel: WIZARD, name: 'PublishWizard', props: WIZARD_PROPS(props), ...extra })

/** The wizard through its steps, snapshotting the whole tree at each point. */
const WIZARD_SCENARIOS = {
  fresh: ui => { ui.snap('0'); ui.click('Next'); ui.snap('1'); ui.click('Next'); ui.snap('2'); ui.click('Next'); ui.snap('3'); ui.click('Back'); ui.snap('2b'); ui.click('Back'); ui.snap('1b') },
  questions: ui => { ui.click('Next'); ui.setSwitch('wiz-qa', true); ui.snap('qa on'); ui.setSwitch('wiz-qa-auto', false); ui.snap('manual'); ui.click('Next'); ui.snap('2'); ui.click('Next'); ui.snap('3') },
  narration: ui => {
    ui.click('Next'); ui.click('Next'); ui.setSwitch('wiz-narration', true); ui.snap('narration on'); ui.click('Next'); ui.snap('3 no budget')
    ui.click('Back'); ui.setInput('wiz-budget', '20'); ui.setInput('wiz-reserve', '5'); ui.snap('budget'); ui.click('Next'); ui.snap('3 budget')
  },
  restricted: ui => { ui.pick('restricted'); ui.snap('restricted'); ui.click('Next'); ui.snap('blocked?'); ui.setInput('wiz-passcode', 'abc'); ui.snap('short'); ui.setInput('wiz-passcode', 'abcdef'); ui.snap('six'); ui.click('Next'); ui.snap('1') },
  downloads: ui => { ui.setSwitch('wiz-pdf', false); ui.setSwitch('wiz-pptx', false); ui.snap('off'); ui.pick('public'); ui.snap('public'); ui.click('Next'); ui.click('Next'); ui.click('Next'); ui.snap('3') },
  republish: ui => { ui.snap('0'); ui.click('Next'); ui.snap('1'); ui.click('Next'); ui.snap('2'); ui.click('Next'); ui.snap('3') },
}
const PROGRESS_DONE = [{ label: 'Publish', status: 'done' }, { label: 'Script', status: 'done', detail: '12 slides' }, { label: 'Recording', status: 'skipped', detail: 'Not asked for' }]
const PROGRESS_FAIL = [{ label: 'Publish', status: 'failed', detail: 'No' }]
const PROGRESS_RUN = [{ label: 'Publish', status: 'done' }, { label: 'Script', status: 'running' }]

function wizardSnapshots(sources, env) {
  const out = {}
  for (const [name, run] of Object.entries(WIZARD_SCENARIOS)) {
    const ui = wizardUi(sources, env, name === 'republish' ? { record: { ...RECORD, qaEnabled: true, narrationEnabled: true, visibility: 'restricted', hasPasscode: true } } : {})
    run(ui)
    out[name] = ui.snaps
  }
  for (const [name, progress, record, busy] of [['done', PROGRESS_DONE, RECORD, false], ['done busy', PROGRESS_DONE, RECORD, true], ['failed', PROGRESS_FAIL, null, false], ['running', PROGRESS_RUN, RECORD, true], ['failed republish', PROGRESS_FAIL, RECORD, false],
    ['done no url', PROGRESS_DONE, { ...RECORD, publicUrl: '' }, false]]) {
    const ui = wizardUi(sources, env, { progress, record, busy })
    ui.snap(name)
    out[name] = ui.snaps
  }
  return out
}

async function wizardChecks(sources, base = baseSources) {
  // ---- flag off: the wizard draws the base's tree at every step of every scenario, in the Studio shell and the classic one ---------------------------------
  const baseline = {}
  for (const [index, env] of pickEnvs([...OFF_ENVS, { [SHELL]: 'false' }]).entries()) {
    baseline[index] = once(`wizard|${ser(env)}`, () => wizardSnapshots({ ...sources, [WIZARD]: base[WIZARD] }, env))
    deq(wizardSnapshots(sources, env), baseline[index], `flag off, env ${ser(env)}: the wizard draws the base's tree`)
  }
  check(assert.ok, Object.values(baseline[0]).every(snaps => snaps.length > 0))
  check(assert.ok, new Set(Object.values(baseline[0]).flat().map(([, hash]) => hash)).size > 20, 'the scenarios reach many different screens')
  // and it asks for nothing: no request leaves from any step
  for (const env of pickEnvs(OFF_ENVS)) { const ui = wizardUi(sources, env); WIZARD_SCENARIOS.fresh(ui); deq(ui.log, [], 'no request from the wizard') }

  // ---- flag on --------------------------------------------------------------------------------------------------------------------------------------------------
  const on = (props = {}, extra = {}) => wizardUi(sources, ON_ENV, props, extra)
  // PUB-01: the mock's words in the audience step and the review
  { const ui = on()
    const titles = ui.all().filter(node => node.type === 'strong').map(node => squash(text(node)))
    for (const title of ['Anyone with the link', 'Anyone — listed publicly', 'Only people with a passcode']) check(assert.ok, titles.includes(title), `audience "${title}"`)
    check(assert.equal, titles.includes('Only with a passcode'), false, 'the old wording is gone')
    ui.pick('public'); ui.click('Next'); ui.click('Next'); ui.click('Next')
    check(assert.match, ui.text(), /Who can viewAnyone — listed publicly/) }

  // PUB-02: masked passcode with a counter; Next waits for six characters
  { const ui = on(); ui.pick('restricted')
    const field = ui.byId('Input', 'wiz-passcode')
    check(assert.equal, field.props.type, 'password'); check(assert.equal, field.props.autoComplete, 'new-password')
    const eye = ui.find(node => node.type === 'button' && node.props['aria-label'] === 'Show passcode')[0]
    check(assert.ok, eye, 'an eye to show it')
    deq(ui.find(node => node.props?.role === 'status').map(node => squash(text(node))), [], 'no counter while the field is empty')
    check(assert.equal, ui.button('Next').props.disabled, true, 'empty: Next waits')
    ui.setInput('wiz-passcode', 'abc')
    check(assert.equal, ui.byId('Input', 'wiz-passcode').props.value, 'abc')
    check(assert.ok, ui.text().includes('3 more characters needed'), 'the counter')
    check(assert.equal, ui.button('Next').props.disabled, true, 'three characters: Next waits')
    ui.setInput('wiz-passcode', 'abcde'); check(assert.ok, ui.text().includes('1 more character needed'))
    ui.setInput('wiz-passcode', 'abcdef')
    check(assert.equal, ui.text().includes('more character'), false, 'six characters: no counter')
    check(assert.equal, ui.button('Next').props.disabled, false, 'six characters: Next opens')
    // a saved passcode with the field empty may go on (it is kept)
    const kept = on({ record: { ...RECORD, visibility: 'restricted', hasPasscode: true } })
    check(assert.equal, kept.button('Next').props.disabled, false, 'a kept passcode needs no typing')
    kept.setInput('wiz-passcode', 'ab'); check(assert.equal, kept.button('Next').props.disabled, true, 'a replacement under six characters waits') }

  // PUB-04: the Questions step stays short and says where the rest is
  { const ui = on(); ui.click('Next')
    check(assert.equal, ui.find(node => node.props?.['data-publish-questions-note']).length, 0, 'no note while questions are off')
    ui.setSwitch('wiz-qa', true)
    const notes = ui.find(node => node.props?.['data-publish-questions-note'])
    check(assert.equal, notes.length, 1)
    check(assert.equal, squash(text(notes[0])), 'Style, limits and sources are set in Questions after you publish.')
    deq(ui.all().filter(node => node.type === 'Switch').map(node => node.props.id), ['wiz-qa', 'wiz-qa-auto'], 'the step is still the master switch and auto-answer, nothing more')
    ui.setSwitch('wiz-qa', false); check(assert.equal, ui.find(node => node.props?.['data-publish-questions-note']).length, 0) }

  // PUB-07: no script without a session length; PUB-06: recording off, needs the tick
  { const published = []
    const ui = on({ onPublish: choices => published.push(choices) })
    ui.click('Next'); ui.click('Next'); ui.setSwitch('wiz-narration', true); ui.click('Next')
    const write = ui.byId('Switch', 'wiz-write'), record = ui.byId('Switch', 'wiz-record')
    deq([write.props.checked, write.props.disabled, record.props.checked, record.props.disabled], [false, true, false, true], 'no session length: the script switch is off and disabled, recording too')
    check(assert.ok, ui.text().includes('Set a session length in Narration first.'))
    ui.click('Publish')
    check(assert.equal, published.length, 1)
    deq([published[0].writeScript, published[0].recordNarration, published[0].narrationEnabled], [false, false, true], 'publish asks for no script and no recording')
    // with a session length
    ui.click('Back'); ui.setInput('wiz-budget', '20'); ui.click('Next')
    const write2 = ui.byId('Switch', 'wiz-write'), record2 = ui.byId('Switch', 'wiz-record')
    deq([write2.props.checked, write2.props.disabled, record2.props.checked, record2.props.disabled], [true, false, false, false], 'with a session length: the script is on, recording is off but can be chosen')
    ui.click('Publish')
    deq([published[1].writeScript, published[1].recordNarration], [true, false], 'recording was not asked for')
    check(assert.equal, published[1].recordConsentCents ?? null, null) }

  // PUB-08: the aside carries one on/off row per choice, beside the real thumbnail
  { const ui = on({ deckPreview: { sessionId: 's1' } })
    const aside = ui.find(node => node.type === 'aside')[0]
    const preview = ui.find(node => node.type === 'StudioPublishPreview')
    check(assert.equal, preview.length, 1, 'the real thumbnail stays'); check(assert.equal, preview[0].props.sessionId, 's1'); deq(preview[0].props.source, { sessionId: 's1' })
    const rows = () => ui.find(node => node.type === 'li' && node.props['data-capability']).map(node => [node.props['data-capability'], node.props['data-on']])
    deq(rows(), [['lock', 'false'], ['index', 'false'], ['present', 'true'], ['ask', 'false'], ['pdf', 'true'], ['pptx', 'true'], ['narration', 'false']])
    check(assert.equal, ui.text().includes('Access follows your audience choice.'), false, 'the four-line summary is replaced')
    ui.pick('restricted'); ui.setSwitch('wiz-pdf', false)
    deq(rows().slice(0, 2).concat(rows().filter(([id]) => id === 'pdf')), [['lock', 'true'], ['index', 'false'], ['pdf', 'false']])
    ui.pick('public'); deq(rows().slice(0, 2), [['lock', 'false'], ['index', 'true']])
    ui.click('Next'); ui.setSwitch('wiz-qa', true); deq(rows().filter(([id]) => id === 'ask'), [['ask', 'true']])
    ui.setSwitch('wiz-qa-auto', false); check(assert.ok, ui.text().includes('Every question comes to you.'))
    ui.click('Next'); ui.setSwitch('wiz-narration', true); deq(rows().filter(([id]) => id === 'narration'), [['narration', 'true']])
    check(assert.ok, ui.text().includes('Plays once a script and a recording exist. It never starts by itself.'))
    check(assert.ok, aside, 'the aside is still the aside')
    for (const word of ['hidden', 'notes stay', 'private']) check(assert.equal, ui.text().toLowerCase().includes(word), false, `nothing about "${word}"`) }

  // PUB-10: the link and "View as a viewer" once the deck is live
  { const ui = on({ progress: PROGRESS_DONE, record: RECORD })
    const link = ui.find(node => node.type === 'Input' && node.props['aria-label'] === 'Published deck link')[0]
    check(assert.equal, link.props.value, 'https://deckster.xyz/p/abc123')
    check(assert.ok, ui.text().includes('View as a viewer'))
    for (const [progress, record, busy, why] of [[PROGRESS_FAIL, RECORD, false, 'not published'], [PROGRESS_DONE, RECORD, true, 'busy'], [PROGRESS_DONE, { ...RECORD, publicUrl: '' }, false, 'no url'], [PROGRESS_DONE, null, false, 'no record']]) {
      check(assert.equal, wizardUi(sources, ON_ENV, { progress, record, busy }).text().includes('View as a viewer'), false, `no link: ${why}`)
    } }

  // the viewer link on the page the owner is on (NEXT_PUBLIC_STUDIO_P2_PUBLISH_ORIGIN_URL)
  for (const [env, win, expected, why] of [
    [{ ...ON_ENV, [ORIGIN]: 'true' }, { location: { origin: LIVE_ORIGIN } }, `${LIVE_ORIGIN}/p/abc123`, 'origin flag on, APP_URL unset: the browser\'s origin'],
    [{ ...ON_ENV, [ORIGIN]: 'true', NEXT_PUBLIC_APP_URL: 'https://configured.example' }, { location: { origin: LIVE_ORIGIN } }, 'https://deckster.xyz/p/abc123', 'APP_URL set: the server link (built on it)'],
    [{ ...ON_ENV, [ORIGIN]: 'true' }, undefined, 'https://deckster.xyz/p/abc123', 'no window (server render): the server link'],
    [{ ...ON_ENV }, { location: { origin: LIVE_ORIGIN } }, 'https://deckster.xyz/p/abc123', 'origin flag off: the server link'],
    [{ ...ON_ENV, [ORIGIN]: 'true' }, { location: { origin: 'null' } }, 'https://deckster.xyz/p/abc123', 'an opaque origin is not used'],
  ]) {
    const ui = wizardUi(sources, env, { progress: PROGRESS_DONE, record: RECORD }, { window: win })
    const link = ui.find(node => node.type === 'Input' && node.props['aria-label'] === 'Published deck link')[0]
    check(assert.equal, link.props.value, expected, why)
    check(assert.equal, ui.find(node => node.type === 'a' && node.props.href).every(node => node.props.href === expected), true, `${why}: open links`)
  }
}

// ---- the recording review (PUB-06 / PUB-07): the estimate, the tick, the exact check -------------------------------------------------------------------------------
async function recordReviewChecks(sources) {
  const VOICES = { voices: [{ id: 'a', name: 'Alloy', costPerMinuteUsd: 0.05 }, { id: 'b', name: 'Bright', costPerMinuteUsd: 0.2 }], effectiveVoiceId: 'a' }
  const BUDGET = { narrationMinutes: 16, compressedMinutes: 8.8 }
  const answer = (status, data) => ({ ok: status < 400, status, json: async () => data })
  let consents = []
  const make = (props = {}, fetchImpl = async () => answer(200, VOICES)) => {
    consents = []
    return makeUi({ sources, env: ON_ENV, rel: P2, name: 'PublishRecordReview', fetchImpl,
      props: { deckSessionId: 's1', deckSlides: 10, budget: BUDGET, scriptOn: true, recordOn: true, busyNow: false, onScriptToggle() {}, onRecordToggle() {}, onConsent: cents => consents.push(cents), ...props } })
  }
  const box = ui => ui.find(node => node.props?.['data-record-estimate'])[0]
  const tickBox = ui => ui.byId('input', 'wiz-record-confirm') ?? ui.all().find(node => node.type === 'input' && node.props.id === 'wiz-record-confirm')

  { // the estimate, then the tick
    const ui = make()
    check(assert.equal, box(ui).props['data-record-estimate'], 'loading', 'asking for the voice\'s price')
    await ui.settle()
    deq(ui.log, [['GET', '/api/narration/voice?sessionId=s1', null]], 'one read, a GET; nothing is generated or charged')
    check(assert.equal, box(ui).props['data-record-estimate'], 'ready')
    check(assert.ok, ui.text().includes('Record for up to 128¢'), 'an upper bound, labelled as one')
    check(assert.ok, ui.text().includes('about 25.5 min of audio with Alloy · up to 21 segments'))
    check(assert.match, ui.text(), /Estimate only: the script is not written yet/)
    check(assert.match, ui.text(), /if it is higher than this, nothing is recorded/)
    check(assert.equal, tickBox(ui).props.checked, false, 'nothing is ticked for the owner')
    check(assert.equal, consents.at(-1), null)
    tickBox(ui).props.onChange({ target: { checked: true } }); await ui.settle()
    check(assert.equal, tickBox(ui).props.checked, true); check(assert.equal, consents.at(-1), 128, 'the amount that was ticked')
    tickBox(ui).props.onChange({ target: { checked: false } }); await ui.settle()
    check(assert.equal, consents.at(-1), null, 'unticked: no consent')
    // a different figure is not the one they agreed to
    tickBox(ui).props.onChange({ target: { checked: true } }); await ui.settle()
    check(assert.equal, consents.at(-1), 128)
    ui.render({ budget: { narrationMinutes: 8, compressedMinutes: 4.4 } }); await ui.settle()
    check(assert.equal, tickBox(ui).props.checked, false, 'the figure changed: the tick is taken back')
    check(assert.equal, consents.at(-1), null)
    check(assert.ok, ui.text().includes('Record for up to 66¢'))
    // switching recording off and on again asks again
    tickBox(ui).props.onChange({ target: { checked: true } }); await ui.settle()
    check(assert.equal, consents.at(-1), 66)
    ui.render({ recordOn: false }); await ui.settle(); check(assert.equal, consents.at(-1), null, 'recording off: no consent')
    ui.render({ recordOn: true }); await ui.settle()
    check(assert.equal, tickBox(ui).props.checked, false, 'recording back on: the earlier tick is not remembered'); check(assert.equal, consents.at(-1), null)
    tickBox(ui).props.onChange({ target: { checked: true } }); await ui.settle()
    check(assert.equal, consents.at(-1), 66)
    // leaving the step takes it back
    ui.unmount(); check(assert.equal, consents.at(-1), null, 'leaving the step: no consent')
    check(assert.equal, ui.log.every(([method]) => method === 'GET'), true, 'nothing but GETs') }

  { // recording is a choice the owner has to make; scripts need a session length
    const off = make({ recordOn: false }); await off.settle()
    check(assert.equal, box(off), undefined, 'record off: no estimate'); deq(off.log, [], 'record off: no request')
    check(assert.equal, off.byId('Switch', 'wiz-record').props.checked, false)
    const noScript = make({ scriptOn: false }); await noScript.settle()
    deq([noScript.byId('Switch', 'wiz-record').props.checked, noScript.byId('Switch', 'wiz-record').props.disabled, noScript.byId('Switch', 'wiz-write').props.checked], [false, true, false]); deq(noScript.log, [])
    const noBudget = make({ budget: null }); await noBudget.settle()
    deq([noBudget.byId('Switch', 'wiz-write').props.checked, noBudget.byId('Switch', 'wiz-write').props.disabled, noBudget.byId('Switch', 'wiz-record').props.disabled], [false, true, true], 'no session length')
    check(assert.ok, noBudget.text().includes('Set a session length in Narration first.')); deq(noBudget.log, []); check(assert.equal, box(noBudget), undefined)
    const busy = make({ busyNow: true }); await busy.settle()
    deq([busy.byId('Switch', 'wiz-write').props.disabled, busy.byId('Switch', 'wiz-record').props.disabled, tickBox(busy).props.disabled], [true, true, true], 'while publishing nothing can be changed')
    const toggled = []; const live = make({ onScriptToggle: value => toggled.push(['script', value]), onRecordToggle: value => toggled.push(['record', value]) })
    live.byId('Switch', 'wiz-write').props.onCheckedChange(false); live.byId('Switch', 'wiz-record').props.onCheckedChange(true)
    deq(toggled, [['script', false], ['record', true]]) }

  { // the price cannot be learned: recording stays off, and says where it can be done
    for (const [why, impl] of [['not ok', async () => answer(500, {})], ['throws', async () => { throw new TypeError('network') }], ['no voice', async () => answer(200, { voices: [], effectiveVoiceId: 'a' })],
      ['not json', async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('x') } })]]) {
      const ui = make({}, impl); await ui.settle()
      check(assert.equal, box(ui).props['data-record-estimate'], 'unavailable', why)
      check(assert.equal, tickBox(ui), undefined, `${why}: nothing to tick`)
      check(assert.match, ui.text(), /not available right now, so recording stays off/)
      check(assert.equal, consents.at(-1), null)
    } }

  { // a late answer for a step that is gone changes nothing
    let release
    const ui = make({}, () => new Promise(resolve => { release = () => resolve(answer(200, VOICES)) }))
    ui.render({ recordOn: false }); await ui.settle()
    release(); await ui.settle()
    check(assert.equal, box(ui), undefined, 'the answer arrived after record was switched off') }
  { // two reads in flight: the older one arriving last does not win
    const holds = {}
    const bright = { voices: [{ id: 'b', name: 'Bright', costPerMinuteUsd: 0.2 }], effectiveVoiceId: 'b' }
    const ui = make({}, url => new Promise(resolve => { holds[url] = () => resolve(answer(200, url.endsWith('s1') ? VOICES : bright)) }))
    ui.render({ deckSessionId: 's2' }); await ui.settle()
    holds['/api/narration/voice?sessionId=s2'](); await ui.settle()
    check(assert.ok, ui.text().includes('with Bright'), 'the current session\'s voice')
    holds['/api/narration/voice?sessionId=s1'](); await ui.settle()
    check(assert.ok, ui.text().includes('with Bright') && !ui.text().includes('with Alloy'), 'a slow answer for the earlier session does not replace it') }
}

// ---- the Viewer page tab (PUB-15) --------------------------------------------------------------------------------------------------------------------------
const SUMMARY_PROPS = (extra = {}) => ({ record: RECORD, sessionId: 's1', isLoading: false, loadError: false, staleness: 'current', deckPreview: { sessionId: 's1', finalPresentationId: 'p1' }, ...extra })
const summaryUi = (sources, env, props = {}) => makeUi({ sources, env, rel: SUMMARY, name: 'StudioPublishViewerSummary', props: SUMMARY_PROPS(props) })
const SUMMARY_CASES = [
  {}, { isLoading: true }, { record: null }, { record: { ...RECORD, revokedAt: '2026-10-02T00:00:00.000Z' } }, { record: { ...RECORD, sessionId: 'other' } }, { record: { ...RECORD, slug: '' } },
  { staleness: 'stale' }, { staleness: 'checking' }, { staleness: 'unknown' }, { loadError: true }, { record: { ...RECORD, visibility: 'restricted', hasPasscode: true, qaAutoAnswer: false } },
  { record: { ...RECORD, visibility: 'public', qaEnabled: false, narrationEnabled: false, narrationBudgetMinutes: null, qaReserveMinutes: 4 } }, { record: { ...RECORD, visibility: 'weird', allowPdf: undefined, qaEnabled: undefined } },
  { record: { ...RECORD, slideCount: 1, title: '   ' } }, { deckPreview: undefined }, { deckPreview: null },
]

async function summaryChecks(sources, base = baseSources) {
  for (const env of pickEnvs(OFF_ENVS)) for (const [index, extra] of SUMMARY_CASES.entries()) {
    const then = once(`summary|${ser(env)}|${index}`, () => summaryUi({ ...sources, [SUMMARY]: base[SUMMARY] }, env, extra).snap('x')), now = summaryUi(sources, env, extra)
    check(assert.equal, now.snap('x'), then, `flag off ${ser(env)} case ${index}: the Viewer page tab draws the base's tree`)
  }
  const on = (extra = {}) => summaryUi(sources, ON_ENV, extra)
  { const ui = on()
    const preview = ui.find(node => node.type === 'StudioPublishPreview')
    check(assert.equal, preview.length, 1, 'the first-slide image'); check(assert.equal, preview[0].props.sessionId, 's1'); deq(preview[0].props.source, { sessionId: 's1', finalPresentationId: 'p1' })
    check(assert.equal, ui.text().includes('Preview unavailable'), false, 'the "unavailable" block is replaced by the image (which has its own fallback)')
    check(assert.equal, ui.find(node => node.type === 'aside')[0].props['aria-label'], 'Published copy preview and viewer page')
    check(assert.ok, ui.text().includes('First slide of your deck. It matches the published copy at the last check.'))
    deq(ui.find(node => node.type === 'li' && node.props['data-capability']).map(node => [node.props['data-capability'], node.props['data-on']]),
      [['lock', 'false'], ['index', 'false'], ['present', 'true'], ['ask', 'true'], ['pdf', 'true'], ['pptx', 'false'], ['narration', 'true']], 'from the saved record')
    for (const row of ui.find(node => node.type === 'li' && node.props['data-capability'])) {
      const isOn = row.props['data-on'] === 'true'
      check(assert.ok, squash(text(row)).endsWith(isOn ? 'On' : 'Off'), `${row.props['data-capability']}: the word is ${isOn ? 'On' : 'Off'}`)
      check(assert.equal, flat(row).some(node => node.type === `Icon:${isOn ? 'Check' : 'Minus'}`), true, `${row.props['data-capability']}: the mark`)
      check(assert.equal, flat(row).some(node => node.type === `Icon:${isOn ? 'Minus' : 'Check'}`), false)
    }
    deq(ui.find(node => node.type === 'dt').map(node => squash(text(node))), ['Who can view', 'Passcode', 'Session budget', 'Question reserve'], 'the rows replace the on/off facts; the numbers stay')
    check(assert.ok, ui.text().includes('Anyone with the link'))
    check(assert.ok, ui.text().includes('This summary shows saved configuration, not a check of download access, question readiness or playable narration.'), 'the honesty line stays')
    for (const [staleness, expected] of [['stale', /frozen earlier and may differ/], ['checking', /Checking whether it matches/], ['unknown', /not confirmed/]]) check(assert.match, on({ staleness }).text(), expected, staleness)
    const restricted = on({ record: { ...RECORD, visibility: 'restricted', hasPasscode: true, qaEnabled: false } })
    deq(restricted.find(node => node.type === 'li' && node.props['data-capability']).map(node => [node.props['data-capability'], node.props['data-on']]).filter(([id]) => ['lock', 'ask'].includes(id)), [['lock', 'true'], ['ask', 'false']])
    check(assert.ok, restricted.text().includes('Only people with a passcode'))
    deq(on({ record: { ...RECORD, visibility: 'weird', allowPdf: undefined, qaEnabled: undefined } }).find(node => node.type === 'li' && node.props['data-capability']).map(node => node.props['data-capability']), ['present', 'pptx', 'narration'], 'nothing unconfirmed is claimed')
    check(assert.equal, on({ isLoading: true }).find(node => node.type === 'li').length, 0, 'loading: no rows')
    check(assert.equal, on({ record: null }).find(node => node.type === 'li').length, 0, 'no record: no rows') }
}

// ---- the dialog (PUB-03, PUB-11, the link) ----------------------------------------------------------------------------------------------------------------------
const dialogStubs = (copies = []) => ({
  '@/components/ui/dialog': { Dialog: 'Dialog', DialogContent: 'DialogContent', DialogDescription: 'DialogDescription', DialogFooter: 'DialogFooter', DialogHeader: 'DialogHeader', DialogTitle: 'DialogTitle' },
  '@/components/ui/select': { Select: 'Select', SelectContent: 'SelectContent', SelectItem: 'SelectItem', SelectTrigger: 'SelectTrigger', SelectValue: 'SelectValue' },
  '@/components/ui/tabs': { Tabs: 'Tabs', TabsContent: 'TabsContent', TabsList: 'TabsList', TabsTrigger: 'TabsTrigger' },
  '@/components/publish-qa-settings': { PublishQaSettings: 'PublishQaSettings' },
  '@/components/publish-session-controls': { PublishSessionControls: 'PublishSessionControls' },
  '@/components/publish-wizard': { PublishWizard: 'PublishWizard' },
  '@/hooks/use-copy-to-clipboard': { useCopyToClipboard: () => ({ copied: false, copy: async value => { copies.push(value); return true } }) },
})
const MANIFEST = { voiceName: 'Alloy', slides: [...Array(11).fill({ full: 'seg', stale: false }), { full: null, stale: false }], missing: 1, closing: 'c', budget: null, qaEnabled: true }
const dialogFetch = ({ record = RECORD, staleness = 'current', current = 12, questions = { totalCount: 5, unansweredCount: 2, qaEnabled: true }, manifest = MANIFEST } = {}) => async url => {
  const reply = (status, data) => ({ ok: status < 400, status, json: async () => data })
  if (url === '/api/publish/by-session/s1') return reply(200, { deck: record })
  if (url === '/api/publish/by-session/s1?checkStale=1') return reply(200, { staleness, currentSlideCount: current })
  if (record && url === `/api/publish/${record.slug}/questions?summary=1`) return questions === 'fail' ? reply(500, { error: 'x' }) : reply(200, questions)
  if (record && url === `/api/narration/manifest?slug=${record.slug}`) return manifest === 'missing' ? reply(404, { error: 'x' }) : reply(200, manifest)
  return reply(404, {})
}
const DIALOG_PROPS = (extra = {}) => ({ open: true, onOpenChange() {}, sessionId: 's1', deckTitle: 'Q3 Review', slideCount: 12, deckPreview: { sessionId: 's1' }, ...extra })
async function dialogUi(sources, env, { props = {}, fetch: fetchOptions = {}, win, copies = [] } = {}) {
  const ui = makeUi({ sources, env, rel: DIALOG, name: 'PublishDialog', props: DIALOG_PROPS(props), stubs: dialogStubs(copies), fetchImpl: dialogFetch(fetchOptions), window: win })
  await ui.settle(16)
  return ui
}
const DIALOG_CASES = [
  ['live', {}, {}], ['live stale', {}, { staleness: 'stale', current: 14 }], ['live qa off', {}, { record: { ...RECORD, qaEnabled: false } }], ['live narration off', {}, { record: { ...RECORD, narrationEnabled: false } }],
  ['live restricted', {}, { record: { ...RECORD, visibility: 'restricted', hasPasscode: true } }], ['live public', {}, { record: { ...RECORD, visibility: 'public' } }], ['unpublished', {}, { record: null }],
  ['closed', { open: false }, {}], ['no title', { deckTitle: null }, { record: null }], ['no count', { slideCount: null }, { record: null }], ['one slide', { slideCount: 1 }, { record: null }],
  ['revoked', {}, { record: { ...RECORD, revokedAt: '2026-10-02T00:00:00.000Z' } }],
]

async function dialogChecks(sources, base = baseSources) {
  // ---- flag off: the base's tree and the base's requests, in every state --------------------------------------------------------------------------------------
  for (const env of pickEnvs([...OFF_ENVS.slice(0, 6), OFF_ENVS[7], OFF_ENVS[8]])) for (const [name, props, fetch] of DIALOG_CASES) {
    const key = `dialog|${ser(env)}|${name}`
    if (!memo.has(key)) { const then = await dialogUi({ ...sources, [DIALOG]: base[DIALOG] }, env, { props, fetch }); memo.set(key, { hash: then.snap('x'), log: then.log }) }
    const then = memo.get(key), now = await dialogUi(sources, env, { props, fetch })
    check(assert.equal, now.snap('x'), then.hash, `flag off ${ser(env)} / ${name}: the dialog draws the base's tree`)
    deq(now.log, then.log, `flag off ${ser(env)} / ${name}: and makes the base's requests`)
  }
  // ---- flag on ---------------------------------------------------------------------------------------------------------------------------------------------------
  { const ui = await dialogUi(sources, ON_ENV)
    deq([...ui.log.map(([method, url]) => `${method} ${url}`)].sort(), ['GET /api/narration/manifest?slug=abc123', 'GET /api/publish/abc123/questions?summary=1', 'GET /api/publish/by-session/s1', 'GET /api/publish/by-session/s1?checkStale=1'], 'two small reads more, both GETs')
    check(assert.equal, text(ui.find(node => node.type === 'DialogDescription')), '“Q3 Review” · 12 slides · Anyone with access can view its frozen published copy.', 'PUB-03: the count, and no claim about hidden slides or notes')
    const chips = ui.find(node => node.props?.className === 'studio-publish-features')[0].props.children.flat().filter(Boolean).map(node => squash(text(node)))
    deq(chips, ['12 slides · frozen copy', 'Anyone with the link', 'Downloads: PDF', 'Questions: on · 5 asked · 2 waiting', 'Narration: on · Narrated by Alloy · 11 slides recorded · 1 need recording'], 'PUB-11')
    const qaTab = ui.find(node => node.type === 'TabsTrigger' && node.props.value === 'qa')[0]
    const badge = ui.find(node => node.props?.className === 'studio-publish-badge')
    check(assert.equal, badge.length, 1); check(assert.equal, text(badge[0]), '2'); check(assert.ok, squash(text(qaTab)).includes('2 questions waiting'), 'the badge is spoken')
    check(assert.equal, ui.find(node => node.type === 'StudioPublishPreview').length, 1, 'the Viewer page tab gets the first slide'); deq(ui.find(node => node.type === 'StudioPublishPreview')[0].props.source, { sessionId: 's1' })
    check(assert.ok, ui.text().includes('First slide of your deck. It matches the published copy at the last check.'))
    const post = ui.log.filter(([method]) => method !== 'GET'); deq(post, [], 'nothing is written') }
  { // the frozen copy's count, not the deck's today
    const ui = await dialogUi(sources, ON_ENV, { props: { slideCount: 14 } })
    check(assert.equal, text(ui.find(node => node.type === 'DialogDescription')), '“Q3 Review” · 12 slides · Anyone with access can view its frozen published copy.')
    // reopening reads the numbers again (questions may have arrived while it was closed)
    const factReads = () => ui.log.filter(([, url]) => url.includes('questions?summary=1')).length
    check(assert.equal, factReads(), 1)
    ui.render({ open: false }); await ui.settle(); check(assert.equal, factReads(), 1, 'closing reads nothing')
    ui.render({ open: true }); await ui.settle(16); check(assert.equal, factReads(), 2, 'opening again reads them again') }
  { // no questions waiting: no badge, "none waiting"
    const ui = await dialogUi(sources, ON_ENV, { fetch: { questions: { totalCount: 3, unansweredCount: 0, qaEnabled: true } } })
    check(assert.ok, ui.text().includes('Questions: on · 3 asked · none waiting')); check(assert.equal, ui.find(node => node.props?.className === 'studio-publish-badge').length, 0)
    const none = await dialogUi(sources, ON_ENV, { fetch: { questions: { totalCount: 0, unansweredCount: 0 } } }); check(assert.ok, none.text().includes('Questions: on · none asked yet'))
    const many = await dialogUi(sources, ON_ENV, { fetch: { questions: { totalCount: 40, unansweredCount: 23 } } }); check(assert.equal, text(many.find(node => node.props?.className === 'studio-publish-badge')[0]), '9+') }
  { // questions or narration off: not asked for
    const qaOff = await dialogUi(sources, ON_ENV, { fetch: { record: { ...RECORD, qaEnabled: false } } })
    check(assert.equal, qaOff.log.some(([, url]) => url.includes('/questions')), false, 'questions off: no questions read'); check(assert.ok, qaOff.text().includes('Questions: off'))
    const narrationOff = await dialogUi(sources, ON_ENV, { fetch: { record: { ...RECORD, narrationEnabled: false } } })
    check(assert.equal, narrationOff.log.some(([, url]) => url.includes('/narration/')), false, 'narration off: no manifest read'); check(assert.ok, narrationOff.text().includes('Narration: off'))
    const closed = await dialogUi(sources, ON_ENV, { props: { open: false } }); deq(closed.log, [], 'closed: nothing is read') }
  { // a read that fails shows less, never a guess
    const ui = await dialogUi(sources, ON_ENV, { fetch: { questions: 'fail', manifest: 'missing' } })
    check(assert.ok, ui.text().includes('Questions: on')); check(assert.equal, ui.text().includes('asked'), false)
    check(assert.ok, ui.text().includes('Narration: on')); check(assert.equal, ui.text().includes('Narrated by'), false)
    check(assert.equal, ui.find(node => node.props?.className === 'studio-publish-badge').length, 0)
    const odd = await dialogUi(sources, ON_ENV, { fetch: { questions: { totalCount: 'many', unansweredCount: 1 }, manifest: { voiceName: 'Alloy' } } })
    check(assert.ok, odd.text().includes('Questions: on') && !odd.text().includes('asked')); check(assert.ok, odd.text().includes('Narration: on') && !odd.text().includes('Narrated by')) }
  { // PUB-03 before publishing
    const ui = await dialogUi(sources, ON_ENV, { fetch: { record: null } })
    check(assert.equal, text(ui.find(node => node.type === 'DialogDescription')), 'Share a view-only copy of “Q3 Review” at a Deckster link. Viewers will see 12 slides.')
    check(assert.equal, ui.log.length, 1, 'unpublished: only the record is read')
    const one = await dialogUi(sources, ON_ENV, { props: { slideCount: 1 }, fetch: { record: null } }); check(assert.ok, text(one.find(node => node.type === 'DialogDescription')).endsWith('Viewers will see 1 slide.')) }
  // the link the owner copies and opens
  for (const [env, win, expected, why] of [
    [{ ...ON_ENV, [ORIGIN]: 'true' }, { location: { origin: LIVE_ORIGIN } }, `${LIVE_ORIGIN}/p/abc123`, 'origin flag on: the origin the owner is on'],
    [{ ...ON_ENV }, { location: { origin: LIVE_ORIGIN } }, 'https://deckster.xyz/p/abc123', 'origin flag off: the server\'s link'],
    [{ ...ON_ENV, [ORIGIN]: 'true', NEXT_PUBLIC_APP_URL: 'https://configured.example' }, { location: { origin: LIVE_ORIGIN } }, 'https://deckster.xyz/p/abc123', 'APP_URL set: the server\'s link'],
    [{ [SHELL]: 'true', [ORIGIN]: 'true' }, { location: { origin: LIVE_ORIGIN } }, `${LIVE_ORIGIN}/p/abc123`, 'the origin flag stands on its own (no other P2 flag needed)'],
  ]) {
    const copies = []
    const ui = await dialogUi(sources, env, { win, copies })
    check(assert.equal, ui.find(node => node.type === 'Input' && node.props['aria-label'] === 'Published deck link')[0].props.value, expected, why)
    check(assert.equal, ui.find(node => node.type === 'a' && node.props.href).every(node => node.props.href === expected), true, `${why}: open`)
    ui.all().find(node => node.type === 'Button' && node.props['aria-label'] === 'Copy link').props.onClick(); await tick()
    deq(copies, [expected], `${why}: copy`)
  }
}

// ---- the narrated run's Ask popover (VIEW-07) and the owner's inbox (PUB-16) --------------------------------------------------------------------------------
async function presenterChecks(sources, base = baseSources) {
  const props = { slug: 'abc123', open: true, onClose() {}, onQueueForPresenter() {}, onCiteSlide() {}, canSpeak: true, speakingAnswerId: null, spokenAnswerIds: [] }
  const stubs = { '@/components/published-qa-panel': { AnswerBody: 'AnswerBody' }, '@/lib/publish/qa-threads': { rememberThread() {} } }
  for (const env of pickEnvs(OFF_ENVS)) for (const extra of [{}, { questionTime: true }, { canSpeak: false }, { open: false }]) {
    const then = once(`presenter|${ser(env)}|${ser(extra)}`, () => makeUi({ sources: { ...sources, [PRESENTER]: base[PRESENTER] }, env, rel: PRESENTER, name: 'PresenterQuestion', props: { ...props, ...extra }, stubs }).snap('x'))
    const now = makeUi({ sources, env, rel: PRESENTER, name: 'PresenterQuestion', props: { ...props, ...extra }, stubs })
    check(assert.equal, now.snap('x'), then, `flag off ${ser(env)} ${ser(extra)}: the Ask popover is the base's`)
  }
  const ui = makeUi({ sources, env: ON_ENV, rel: PRESENTER, name: 'PresenterQuestion', props, stubs })
  const aside = ui.tree
  deq([aside.type, aside.props['data-studio-v4-shell'], aside.props['data-studio-published-ask']], ['aside', 'true', 'true'], 'the markers the viewer tokens are keyed on')
  const shellOnly = makeUi({ sources, env: { [SHELL]: 'true' }, rel: PRESENTER, name: 'PresenterQuestion', props, stubs })
  check(assert.equal, 'data-studio-published-ask' in canon(shellOnly.tree).props, false, 'no marker without the flag')
}

async function inboxChecks(sources, base = baseSources) {
  const QUESTIONS_LIST = {
    questions: [
      { id: 'q1', question: 'Why is churn flat?', status: 'blocked', gateReason: null, aiAnswer: null, askerName: null, askerEmail: null, ownerAnswer: null, ownerAnsweredAt: null, createdAt: '2026-10-01T10:00:00.000Z', faqItemId: null },
      { id: 'q2', question: 'What is the plan?', status: 'answered', gateReason: null, aiAnswer: 'Grow.', askerName: 'Ann', askerEmail: null, ownerAnswer: 'We grow.', ownerAnsweredAt: '2026-10-02T10:00:00.000Z', createdAt: '2026-10-01T11:00:00.000Z', faqItemId: 'f1' },
      { id: 'q3', question: 'When?', status: 'deferred', gateReason: 'no_evidence', aiAnswer: null, askerName: null, askerEmail: null, ownerAnswer: null, ownerAnsweredAt: null, createdAt: '2026-10-01T12:00:00.000Z', faqItemId: null },
    ],
    nextCursor: null, unansweredCount: 1, qaEnabled: true, corpusStatus: 'ready',
  }
  const stubs = { '@/components/ui/textarea': { Textarea: 'Textarea' } }
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    calls.push([init.method ?? 'GET', url])
    const reply = (status, data) => ({ ok: status < 400, status, json: async () => data })
    if (url === '/api/publish/by-session/s1') return reply(200, { deck: { slug: 'abc123', sessionId: 's1' } })
    if (url === '/api/publish/abc123/questions') return reply(200, QUESTIONS_LIST)
    return reply(200, { question: null })
  }
  const mountInbox = async (src, env) => { calls.length = 0; const ui = makeUi({ sources: src, env, rel: INBOX_UI, name: 'DeckQaInbox', props: { sessionId: 's1' }, stubs, fetchImpl }); await ui.settle(16); return ui }
  const labels = ui => ui.all().filter(node => node.type === 'Button').map(node => squash(text(node)))
  const INBOX_OFF_ENVS = [{ [SHELL]: 'true' }, { [SHELL]: 'true', [INBOX]: 'false' }, { [SHELL]: 'true', [INBOX]: '1' }, { [SHELL]: 'true', [INBOX]: 'TRUE' }, { [SHELL]: 'true', [INBOX]: ' true' }, { [INBOX]: 'true' },
    { [SHELL]: 'true', [FLAG]: 'true', [ORIGIN]: 'true' }, { [SHELL]: 'false', [INBOX]: 'true' }, {}]
  for (const env of pickEnvs(INBOX_OFF_ENVS)) {
    const key = `inbox|${ser(env)}`
    if (!memo.has(key)) { const then = await mountInbox({ ...sources, [INBOX_UI]: base[INBOX_UI] }, env); memo.set(key, { hash: then.snap('x'), log: [...calls] }) }
    const then = memo.get(key)
    const now = await mountInbox(sources, env)
    check(assert.equal, now.snap('x'), then.hash, `flag off ${ser(env)}: the inbox is the base's`)
    deq(calls, then.log)
    check(assert.equal, labels(now).some(label => label === 'Unblock' || label === 'Remove from FAQ'), false)
  }
  const inboxOn = { [SHELL]: 'true', [INBOX]: 'true' }
  const ui = await mountInbox(sources, inboxOn)
  const actionLabels = labels(ui)
  check(assert.equal, actionLabels.filter(label => label === 'Unblock').length, 1, 'the blocked row can be unblocked')
  check(assert.equal, actionLabels.filter(label => label === 'Remove from FAQ').length, 1, 'the row in the FAQ can be taken out of it')
  check(assert.equal, actionLabels.filter(label => label === 'Publish to FAQ').length, 1, 'the open row can still be published')
  check(assert.ok, ui.text().includes('In the FAQ'))
  check(assert.ok, ui.text().includes('Their blocked questions come back to this inbox as waiting.'))
  // each is one DELETE on its own route, nothing else
  calls.length = 0
  ui.all().find(node => node.type === 'Button' && squash(text(node)) === 'Unblock').props.onClick(); await tick(); await tick()
  deq(calls.filter(call => call[0] !== 'GET'), [['DELETE', '/api/publish/abc123/questions/q1/block']], 'one DELETE (the inbox then reads its list again)'); check(assert.equal, calls[0][0], 'DELETE')
  calls.length = 0
  ui.all().find(node => node.type === 'Button' && squash(text(node)) === 'Remove from FAQ').props.onClick(); await tick(); await tick()
  deq(calls.filter(call => call[0] !== 'GET'), [['DELETE', '/api/publish/abc123/faq/f1']]); check(assert.equal, calls[0][0], 'DELETE')
}

// ---- VIEW-04: the root layout's provider and the viewer's default theme ------------------------------------------------------------------------------------
async function themeChecks(sources, base = baseSources) {
  const layoutStubs = { 'next/font/google': { Inter: () => ({ className: 'inter' }) }, '@vercel/analytics/next': { Analytics: 'Analytics' }, '@/components/providers/session-provider': { SessionProvider: 'SessionProvider' },
    '@/components/theme-provider': { ThemeProvider: 'ThemeProvider' }, '@/components/ui/toaster': { Toaster: 'Toaster' }, '@/components/studio-viewer-theme-provider': { StudioViewerThemeProvider: 'StudioViewerThemeProvider' } }
  const layoutOf = (src, env) => createLoader({ sources: src, env, stubs: { ...layoutStubs, react: reactStub, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' } }, globals: {} }).load(LAYOUT).default({ children: 'kid' })
  for (const env of pickEnvs(OFF_ENVS)) check(assert.equal, sha(ser(canon(layoutOf(sources, env)))), once(`layout|${ser(env)}`, () => sha(ser(canon(layoutOf({ ...sources, [LAYOUT]: base[LAYOUT] }, env))))), `flag off ${ser(env)}: the root layout is the base's`)
  const provider = tree => flat(tree).find(node => node.type === 'ThemeProvider' || node.type === 'StudioViewerThemeProvider')
  check(assert.equal, provider(layoutOf(sources, ON_ENV)).type, 'StudioViewerThemeProvider', 'flag on: the viewer-aware provider')
  check(assert.equal, provider(layoutOf(sources, { [SHELL]: 'true' })).type, 'ThemeProvider', 'flag off: the app provider')
  deq(provider(layoutOf(sources, ON_ENV)).props, { attribute: 'class', defaultTheme: 'light', enableSystem: true, disableTransitionOnChange: true, children: provider(layoutOf(sources, ON_ENV)).props.children })
  // the provider itself
  const themeOf = pathname => {
    const runtime = createRuntime()
    const mod = createLoader({ sources, env: ON_ENV, stubs: { react: reactStub, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' }, 'next/navigation': { usePathname: () => pathname }, 'next-themes': { ThemeProvider: 'NextThemes' } }, globals: {} }).load(THEME)
    return runtime.render(mod.StudioViewerThemeProvider, { attribute: 'class', defaultTheme: 'light', enableSystem: true, disableTransitionOnChange: true, children: 'kid' })
  }
  for (const [pathname, theme, key] of [['/p/abc', 'system', 'published-viewer'], ['/p/abc/q/tok', 'system', 'published-viewer'], ['/builder', 'light', 'app'], ['/', 'light', 'app'], ['/pricing', 'light', 'app'], [null, 'light', 'app']]) {
    const tree = themeOf(pathname)
    deq([tree.type, tree.props.defaultTheme, tree.key, tree.props.attribute, tree.props.enableSystem, tree.props.disableTransitionOnChange, tree.props.children], ['NextThemes', theme, key, 'class', true, true, 'kid'], `${pathname}`)
  }
}

// ---- CSS: every new rule can only match flag-on markup ------------------------------------------------------------------------------------------------------
function cssChecks(sources) {
  const block = (rel, marker) => sources[rel].slice(sources[rel].indexOf(marker))
  const splitTop = list => { const parts = []; let depth = 0, from = 0; for (let i = 0; i < list.length; i++) { const c = list[i]; if (c === '(' || c === '[') depth++; else if (c === ')' || c === ']') depth--; else if (c === ',' && depth === 0) { parts.push(list.slice(from, i)); from = i + 1 } } parts.push(list.slice(from)); return parts.map(part => part.trim()).filter(Boolean) }
  const selectors = css => css.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map(rule => rule.split('{')[0].trim()).filter(Boolean).flatMap(splitTop)
  for (const selector of selectors(block('components/studio-published-viewer.css', '/* NEXT_PUBLIC_STUDIO_P2_PUBLISH (VIEW-07)'))) check(assert.match, selector, /data-studio-published-ask="true"/, `viewer css: ${selector}`)
  for (const selector of selectors(block('components/studio-qa-inbox.css', '/* NEXT_PUBLIC_STUDIO_P2_PUBLISH_INBOX'))) check(assert.match, selector, /\[data-studio-qa-inbox="true"\]/, `inbox css: ${selector}`)
  for (const selector of selectors(block(CSS, '/* NEXT_PUBLIC_STUDIO_P2_PUBLISH (components/publish-p2.tsx)'))) check(assert.match, selector, /^\[data-studio-publish="true"\] /, `publish css: ${selector}`)
  // none of the classes it introduces exists in the markup of the base
  for (const className of ['studio-publish-passcode', 'studio-publish-record-estimate', 'studio-publish-done-link', 'studio-publish-caps', 'studio-publish-step-note', 'studio-publish-badge', 'studio-publish-viewer-preview-note', 'studio-qa-unblock', 'studio-qa-remove-faq', 'studio-qa-in-faq']) {
    check(assert.equal, gitGrep(className, ['components', 'app', 'lib', 'hooks']).split('\n').filter(rel => rel && !rel.endsWith('.css')).length, 0, `${className} is not in the base's markup`)
  }
}

// ---- PUB-11's reads, on the hook itself: each fact belongs to the link it was read for ------------------------------------------------------------------------
async function factsHookChecks(sources) {
  const calls = []
  const deferred = new Map()
  const answers = { abc123: { questions: { totalCount: 5, unansweredCount: 2 }, manifest: MANIFEST }, zzz999: { questions: { totalCount: 9, unansweredCount: 4 }, manifest: { ...MANIFEST, voiceName: 'Bright' } } }
  const fetch = async url => {
    calls.push(url)
    const slug = /abc123|zzz999/.exec(url)?.[0]
    const kind = url.includes('/questions') ? 'questions' : 'manifest'
    const body = answers[slug]?.[kind]
    const hold = deferred.get(`${slug}|${kind}`)
    if (hold) await hold
    return { ok: !!body, status: body ? 200 : 404, json: async () => body }
  }
  const mod = createLoader({ sources, env: ON_ENV, stubs: componentStubs(), globals: { fetch } }).load(P2)
  const runtime = createRuntime()
  const Probe = props => mod.useP2ManageFacts(props.record, props.open)
  const facts = props => runtime.render(Probe, props)
  const settle = async () => { for (let i = 0; i < 8; i++) await tick() }
  let out = facts({ record: RECORD, open: true }); await settle(); out = facts({ record: RECORD, open: true })
  deq(out.questions, { total: 5, waiting: 2 }); check(assert.equal, out.narration.voiceName, 'Alloy'); check(assert.equal, out.narration.recorded, 11)
  deq(calls.sort(), ['/api/narration/manifest?slug=abc123', '/api/publish/abc123/questions?summary=1'])
  // a rotated link: nothing of the old link's numbers is shown for the new one, even while the new reads are on their way
  let releaseQuestions
  deferred.set('zzz999|questions', new Promise(resolve => { releaseQuestions = resolve }))
  out = facts({ record: { ...RECORD, slug: 'zzz999' }, open: true })
  check(assert.equal, out.questions, null, 'the new link has no numbers yet')
  check(assert.equal, out.narration, null)
  await settle(); out = facts({ record: { ...RECORD, slug: 'zzz999' }, open: true })
  check(assert.equal, out.questions, null, 'still waiting for the questions read'); check(assert.equal, out.narration.voiceName, 'Bright')
  releaseQuestions(); await settle(); out = facts({ record: { ...RECORD, slug: 'zzz999' }, open: true })
  deq(out.questions, { total: 9, waiting: 4 })
  // an answer for a link that is no longer the current one is dropped
  const late = []
  answers.late = { questions: { totalCount: 1, unansweredCount: 1 } }
  let releaseLate
  deferred.set('late|questions', new Promise(resolve => { releaseLate = resolve }))
  const lateFetch = async url => { late.push(url); await deferred.get('late|questions'); return { ok: true, status: 200, json: async () => ({ totalCount: 1, unansweredCount: 1 }) } }
  const mod2 = createLoader({ sources, env: ON_ENV, stubs: componentStubs(), globals: { fetch: lateFetch } }).load(P2)
  const runtime2 = createRuntime()
  const Probe2 = props => mod2.useP2ManageFacts(props.record, props.open)
  runtime2.render(Probe2, { record: { ...RECORD, slug: 'late' }, open: true })
  runtime2.render(Probe2, { record: { ...RECORD, slug: 'late' }, open: false }); releaseLate(); await settle()
  check(assert.equal, runtime2.render(Probe2, { record: { ...RECORD, slug: 'late' }, open: true }).questions, null, 'closed before the answer: it is not shown as current')
  // not asked for
  calls.length = 0
  const quiet = [{ record: null, open: true }, { record: RECORD, open: false }, { record: { ...RECORD, revokedAt: '2026-10-02T00:00:00.000Z' }, open: true }, { record: { ...RECORD, qaEnabled: false, narrationEnabled: false }, open: true }]
  for (const props of quiet) { const r = createRuntime(); r.render(Probe, props); await settle(); const result = r.render(Probe, props); deq([result.questions, result.narration], [null, null], ser(props).slice(0, 80)) }
  deq(calls.filter(url => !url.includes('abc123')), [], 'nothing is read for a deck that is not live, a closed dialog, or a feature that is off')
  check(assert.equal, calls.length, 0)
  // flag off: the hook reads nothing at all
  const offCalls = []
  const modOff = createLoader({ sources, env: { [SHELL]: 'true' }, stubs: componentStubs(), globals: { fetch: async url => { offCalls.push(url); return { ok: false, json: async () => ({}) } } } }).load(P2)
  const r3 = createRuntime(); r3.render(props => modOff.useP2ManageFacts(props.record, props.open), { record: RECORD, open: true }); await settle()
  deq(offCalls, [], 'flag off: no read')
}

// ---- publishing itself (PUB-06): the exact price is checked against the tick before a single cent is spent ---------------------------------------------------
async function publishRunChecks(sources, base = baseSources) {
  const choices = (extra = {}) => ({ visibility: 'unlisted', passcode: '', allowPdf: true, allowPptx: true, qaEnabled: true, qaAutoAnswer: true, narrationEnabled: true, narrationBudgetMinutes: 20,
    qaReserveMinutes: null, writeScript: true, recordNarration: true, recordConsentCents: 128, ...extra })
  const run = async (src, env, chosen, { exact = { estimatedCents: 100 }, estimateFails = false, publishFails = false } = {}) => {
    const log = []
    const reply = (status, data) => ({ ok: status < 400, status, json: async () => data })
    const fetchImpl = async (url, init = {}) => {
      const body = init.body ? JSON.parse(init.body) : null
      log.push([init.method ?? 'GET', url, body && body.estimate === true ? 'estimate' : body ? 'body' : null])
      if (url === '/api/publish/by-session/s1') return reply(200, { deck: null })
      if (url === '/api/publish' && init.method === 'POST') return publishFails ? reply(500, { error: 'No' }) : reply(200, { deck: RECORD })
      if (url === `/api/publish/${RECORD.slug}` && init.method === 'PATCH') return reply(200, { deck: RECORD })
      if (url === '/api/narration/script') return reply(200, { written: 12, total: 12 })
      if (url === '/api/narration/render' && body?.estimate === true) { if (estimateFails) throw new TypeError('network'); return reply(200, exact) }
      if (url === '/api/narration/render') return reply(200, { rendered: 25, spentCents: 100 })
      return reply(404, {})
    }
    const ui = makeUi({ sources: src, env, rel: DIALOG, name: 'PublishDialog', props: DIALOG_PROPS(), stubs: dialogStubs(), fetchImpl })
    await ui.settle(16)
    log.length = 0
    await ui.find(node => node.type === 'PublishWizard')[0].props.onPublish(chosen)
    await ui.settle(16)
    return { log, progress: ui.find(node => node.type === 'PublishWizard')[0]?.props.progress ?? null }
  }
  const labels = result => result.progress.map(step => `${step.label}: ${step.status}`)
  const ENV = { [SHELL]: 'true' }
  // flag off: the base's requests and progress, whatever was chosen (recording starts after the script with no price check, as before)
  const COMBOS = [choices(), choices({ recordNarration: false }), choices({ writeScript: false, recordNarration: false }), choices({ narrationEnabled: false }), choices({ recordConsentCents: undefined }), choices({ qaEnabled: false, visibility: 'restricted', passcode: 'secret1' })]
  for (const env of pickEnvs(OFF_ENVS)) for (const [index, chosen] of COMBOS.entries()) {
    const then = await once(`run|${ser(env)}|${index}`, () => run({ ...sources, [DIALOG]: base[DIALOG] }, env, chosen)), now = await run(sources, env, chosen)
    deq(now.log, then.log, `flag off ${ser(env)} combo ${index}: the base's requests`)
    deq(now.progress, then.progress, `flag off ${ser(env)} combo ${index}: the base's progress`)
  }
  const flagOff = await run(sources, ENV, choices())
  check(assert.equal, flagOff.log.some(([, , kind]) => kind === 'estimate'), false, 'flag off: no estimate request, recording follows the script as it always did')
  check(assert.equal, flagOff.log.filter(([method, url]) => method === 'POST' && url === '/api/narration/render').length, 1)
  // flag on
  const ON = ON_ENV
  // the writes and the one price request, in order (the GETs that follow are the manage view's two small reads of the live copy)
  const sequence = result => result.log.filter(([method]) => method !== 'GET').map(([method, url, kind]) => `${method} ${url}${kind === 'estimate' ? ' (estimate)' : ''}`)
  { const result = await run(sources, ON, choices())
    deq(sequence(result), ['POST /api/publish', 'PATCH /api/publish/abc123', 'POST /api/narration/script', 'POST /api/narration/render (estimate)', 'POST /api/narration/render'], 'publish, settings, script, the price, then the recording')
    deq(labels(result), ['Publishing the deck: done', 'Applying your settings: done', 'Writing the script: done', 'Recording the narration: done']) }
  { const result = await run(sources, ON, choices(), { exact: { estimatedCents: 128 } })
    check(assert.equal, sequence(result).at(-1), 'POST /api/narration/render', 'a price equal to the tick is recorded') }
  for (const [why, options] of [['above the tick', { exact: { estimatedCents: 129 } }], ['unreadable', { exact: { oops: true } }], ['an error body', { exact: { error: 'x' } }], ['the request fails', { estimateFails: true }]]) {
    const result = await run(sources, ON, choices(), options)
    check(assert.equal, sequence(result).filter(line => line === 'POST /api/narration/render').length, 0, `${why}: nothing is recorded`)
    check(assert.equal, result.progress[3].status, 'skipped', why); check(assert.ok, /Record it from Voice|Confirm it from Voice/.test(result.progress[3].detail), `${why}: says where to go`)
    check(assert.equal, result.progress[2].status, 'done', `${why}: the script is still written`)
  }
  { const result = await run(sources, ON, choices({ exact: undefined }), { exact: { estimatedCents: 129 } }); check(assert.match, result.progress[3].detail, /came to 129¢, above the 128¢ you confirmed/) }
  { const result = await run(sources, ON, choices({ recordConsentCents: null }))
    check(assert.equal, sequence(result).includes('POST /api/narration/render'), false, 'no tick: no recording'); check(assert.match, result.progress[3].detail, /No estimate was confirmed/) }
  { const result = await run(sources, ON, choices({ recordNarration: false }))
    check(assert.equal, sequence(result).some(line => line.includes('/api/narration/render')), false, 'recording not asked for: no price request, no recording'); check(assert.equal, result.progress[3].status, 'skipped') }
  { const result = await run(sources, ON, choices({ narrationEnabled: false, writeScript: false, recordNarration: false }))
    deq(sequence(result), ['POST /api/publish', 'PATCH /api/publish/abc123']) }
  { const result = await run(sources, ON, choices(), { publishFails: true })
    deq(sequence(result), ['POST /api/publish'], 'a failed publish goes no further'); check(assert.equal, result.progress[0].status, 'failed') }
}

// =====================================================================================================================================================
// the suite, the mutants, the run
// =====================================================================================================================================================
async function suite(sources, { light = false } = {}) {
  LIGHT = light
  libChecks(sources)
  serializeChecks(sources)
  await questionsChecks(sources)
  await wizardChecks(sources)
  await recordReviewChecks(sources)
  await summaryChecks(sources)
  await dialogChecks(sources)
  await publishRunChecks(sources)
  await factsHookChecks(sources)
  await presenterChecks(sources)
  await inboxChecks(sources)
  await themeChecks(sources)
  cssChecks(sources)
  if (!light) { stripChecks(sources); guardChecks(sources) }
  if (unhandled.length) throw unhandled[0]
}

/** [file, what breaks, text it has, text it becomes]: each `from` must be in the file exactly once. */
const MUTANTS = [
  // ---- the lib: flags
  [LIB, 'the main flag is read loosely', "process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_P2_PUBLISH === 'true'", "process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_P2_PUBLISH !== 'false'"],
  [LIB, 'the main flag works without the Studio shell', "process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_P2_PUBLISH === 'true'", "process.env.NEXT_PUBLIC_STUDIO_P2_PUBLISH === 'true'"],
  [LIB, 'the inbox flag is read loosely', "process.env.NEXT_PUBLIC_STUDIO_P2_PUBLISH_INBOX === 'true'", "!!process.env.NEXT_PUBLIC_STUDIO_P2_PUBLISH_INBOX"],
  [LIB, 'the origin flag is read from the main flag', "process.env.NEXT_PUBLIC_STUDIO_P2_PUBLISH_ORIGIN_URL === 'true'", "process.env.NEXT_PUBLIC_STUDIO_P2_PUBLISH === 'true'"],
  [LIB, 'the origin flag works without the Studio shell', "process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_P2_PUBLISH_ORIGIN_URL === 'true'", "process.env.NEXT_PUBLIC_STUDIO_P2_PUBLISH_ORIGIN_URL === 'true'"],
  // ---- the lib: PUB-01 / 02
  [LIB, 'PUB-01 the public audience reads as before', "title: 'Anyone — listed publicly'", "title: 'Anyone'"],
  [LIB, 'PUB-01 an unknown audience gets copy', "return visibility === 'unlisted' || visibility === 'public' || visibility === 'restricted' ? AUDIENCE_COPY[visibility] : null", "return AUDIENCE_COPY[visibility as 'unlisted'] ?? AUDIENCE_COPY.unlisted"],
  [LIB, 'PUB-02 the passcode minimum is four', 'export const PASSCODE_MIN_LENGTH = 6', 'export const PASSCODE_MIN_LENGTH = 4'],
  [LIB, 'PUB-02 an empty field is "short"', 'return passcode.length > 0 && passcode.length < PASSCODE_MIN_LENGTH', 'return passcode.length < PASSCODE_MIN_LENGTH'],
  [LIB, 'PUB-02 the counter is always plural', "`${short} more character${short === 1 ? '' : 's'} needed`", "`${short} more characters needed`"],
  // ---- the lib: PUB-06 / 07
  [LIB, 'PUB-06 the estimate leaves out the closing line', 'export const CLOSING_MINUTES = 0.67', 'export const CLOSING_MINUTES = 0'],
  [LIB, 'PUB-06 the estimate rounds down', 'cents: Math.max(1, Math.ceil(minutes * costPerMinuteUsd * 100))', 'cents: Math.max(1, Math.floor(minutes * costPerMinuteUsd * 100))'],
  [LIB, 'PUB-06 a free estimate is zero', 'cents: Math.max(1, Math.ceil(', 'cents: Math.max(0, Math.ceil('],
  [LIB, 'PUB-07 a script is asked for without a session length', 'const writeScript = choices.narrationEnabled && choices.writeScript && hasBudget', 'const writeScript = choices.narrationEnabled && choices.writeScript'],
  [LIB, 'PUB-06 recording without the tick', 'recordNarration: choices.narrationEnabled && writeScript && choices.recordNarration && consented', 'recordNarration: choices.narrationEnabled && writeScript && choices.recordNarration'],
  [LIB, 'PUB-06 recording without a script', 'recordNarration: choices.narrationEnabled && writeScript && choices.recordNarration && consented', 'recordNarration: choices.narrationEnabled && choices.recordNarration && consented'],
  [LIB, 'PUB-06 a price equal to the tick is refused', 'if (exact > consentCents) {', 'if (exact >= consentCents) {'],
  [LIB, 'PUB-06 a price above the tick is recorded', 'if (exact > consentCents) {', 'if (exact > consentCents + 1000) {'],
  [LIB, 'PUB-06 no tick is enough', "if (typeof consentCents !== 'number' || !(consentCents > 0)) return", "if (typeof consentCents !== 'number') return"],
  [LIB, 'PUB-06 an unreadable price is recorded', "if (typeof exact !== 'number' || !Number.isFinite(exact) || exact < 0) {", "if (typeof exact !== 'number' && false) {"],
  // ---- the lib: VIEW-04 / PUB-16
  [LIB, 'VIEW-04 every page follows the system theme', "return enabled && isPublishedViewerPath(pathname) ? 'system' : fallback", "return enabled ? 'system' : fallback"],
  [LIB, 'VIEW-04 the flag is ignored', "return enabled && isPublishedViewerPath(pathname) ? 'system' : fallback", "return isPublishedViewerPath(pathname) ? 'system' : fallback"],
  [LIB, 'VIEW-04 any /p prefix counts', "/^\\/p\\/[^/]+/.test(pathname)", "/^\\/p/.test(pathname)"],
  [LIB, 'PUB-16 a blocked row can leave the FAQ', 'removeFromFaq: !blocked && inFaq', 'removeFromFaq: inFaq'],
  [LIB, 'PUB-16 an in-FAQ row can be published again', 'publishToFaq: !blocked && !inFaq', 'publishToFaq: !blocked'],
  // ---- the lib: PUB-03
  [LIB, 'PUB-03 the privacy sentence is claimed', "` Viewers will see ${count}.`", "` Viewers will see ${count}. Hidden slides and notes stay private.`"],
  [LIB, 'PUB-03 one slides', "plural(count, 'slide')", "`${count} slides`"],
  [LIB, 'PUB-03 a zero count is shown', 'typeof count === \'number\' && Number.isSafeInteger(count) && count > 0 ? plural(count, \'slide\') : null', 'typeof count === \'number\' ? plural(count, \'slide\') : null'],
  [LIB, 'PUB-03 the published subtitle drops the title', "const title = input.title ? `“${input.title}”` : null", 'const title = null'],
  // ---- the lib: PUB-08 / 15
  [LIB, 'PUB-08 the lock row is inverted', "const locked = input.visibility === 'restricted'", "const locked = input.visibility !== 'restricted'"],
  [LIB, 'PUB-08 an unknown audience gets rows', "const known = input.visibility === 'unlisted' || input.visibility === 'public' || input.visibility === 'restricted'", 'const known = true'],
  [LIB, 'PUB-08 an unconfirmed PDF setting gets a row', "if (typeof input.allowPdf === 'boolean') rows.push(", 'if (true) rows.push('],
  [LIB, 'PUB-08 narration is promised without its script', "'Plays once a script and a recording exist. It never starts by itself.'", "'Plays on its own.'"],
  [LIB, 'PUB-08 manual answers read as automatic', "input.qaAutoAnswer === false ? 'Every question comes to you.'", "input.qaAutoAnswer === false ? 'Answers come from the deck; the rest come to you.'"],
  [LIB, 'PUB-15 a stale copy reads as current', "if (staleness === 'stale') return 'First slide of your current deck. The published copy was frozen earlier and may differ; republish to update it.'", "if (staleness === 'stale') return 'First slide of your deck. It matches the published copy at the last check.'"],
  // ---- the lib: PUB-11
  [LIB, 'PUB-11 more waiting than asked', '|| body.unansweredCount > body.totalCount) return null', ') return null'],
  [LIB, 'PUB-11 a text count is read', 'const wholeCount = (value: unknown): value is number => typeof value === \'number\' && Number.isSafeInteger(value) && value >= 0', 'const wholeCount = (value: unknown): value is number => Number(value) >= 0'],
  [LIB, 'PUB-11 nobody waiting reads as one', "counts.waiting > 0 ? `${counts.waiting} waiting` : 'none waiting'", "`${counts.waiting} waiting`"],
  [LIB, 'PUB-11 the badge caps at 99', "counts.waiting > 9 ? '9+'", "counts.waiting > 99 ? '9+'"],
  [LIB, 'PUB-11 a zero badge shows', 'if (!counts || counts.waiting <= 0) return null', 'if (!counts) return null'],
  [LIB, 'PUB-11 every slide counts as recorded', "(slide => slide && typeof slide.full === 'string' && slide.full.length > 0)", '(slide => slide)'],
  [LIB, 'PUB-11 the voice is not named', "if (state.voiceName) parts.push(`Narrated by ${state.voiceName}`)", ''],
  // ---- the lib: the origin
  [LIB, 'ORIGIN credentials in an address are accepted', "|| url.username || url.password || !url.hostname) return null", "|| !url.hostname) return null"],
  [LIB, 'ORIGIN any protocol is accepted', "if ((url.protocol !== 'http:' && url.protocol !== 'https:') ||", 'if ('],
  [LIB, 'ORIGIN the forwarded host is ignored', "const host = first(request.headers.get('x-forwarded-host'))", "const host = ''"],
  [LIB, 'ORIGIN the whole forwarded list is used', "const first = (value: string | null) => (value ?? '').split(',')[0].trim()", "const first = (value: string | null) => (value ?? '').trim()"],
  [LIB, 'ORIGIN a forwarded protocol is trusted', "proto === 'http' || proto === 'https' ? proto : 'https'", 'proto || \'https\''],
  [LIB, 'ORIGIN NEXT_PUBLIC_APP_URL no longer wins', 'if (appUrl) return appUrl', ''],
  [LIB, 'ORIGIN the flag no longer decides', 'return (enabled ? cleanOrigin(origin) : null) ?? PRODUCTION_APP_URL', 'return cleanOrigin(origin) ?? PRODUCTION_APP_URL'],
  [LIB, 'ORIGIN an invalid origin is used', 'return (enabled ? cleanOrigin(origin) : null) ?? PRODUCTION_APP_URL', 'return (enabled ? (origin as string | null) : null) ?? PRODUCTION_APP_URL'],
  [LIB, 'ORIGIN the browser link ignores NEXT_PUBLIC_APP_URL', 'if (!enabled || appUrl) return record.publicUrl', 'if (!enabled) return record.publicUrl'],
  [LIB, 'ORIGIN a slug that is not a slug is linked', "&& /^[A-Za-z0-9_-]+$/.test(record.slug)", ''],
  [LIB, 'ORIGIN the routes hand the origin over with the flag off', 'return STUDIO_P2_PUBLISH_ORIGIN_ENABLED ? requestOrigin(request) ?? undefined : undefined', 'return requestOrigin(request) ?? undefined'],
  // ---- serialize and the routes
  [SERIALIZE, 'the flag no longer gates the origin', 'if (STUDIO_P2_PUBLISH_ORIGIN_ENABLED) return publicBaseUrl(', 'if (true) return publicBaseUrl('],
  [SERIALIZE, 'the origin is not passed on to the base', 'return `${getPublicAppUrl(origin)}/p/${slug}`', 'return `${getPublicAppUrl()}/p/${slug}`'],
  [SERIALIZE, 'the record drops the origin', 'publicUrl: publicUrlForSlug(deck.slug, origin),', 'publicUrl: publicUrlForSlug(deck.slug),'],
  [SERIALIZE, 'the flag is off in the helper', 'return publicBaseUrl(process.env.NEXT_PUBLIC_APP_URL, origin, true)', 'return publicBaseUrl(process.env.NEXT_PUBLIC_APP_URL, origin, false)'],
  ['app/api/publish/[slug]/rotate/route.ts', 'rotate forgets the origin', 'serializePublishedDeck(updated, linkOriginOf(req))', 'serializePublishedDeck(updated)'],
  ['app/api/publish/route.ts', 'publish forgets the origin', 'serializePublishedDeck(record, linkOriginOf(req))', 'serializePublishedDeck(record)'],
  ['app/api/publish/[slug]/route.ts', 'unpublish forgets the origin', 'serializePublishedDeck(revoked, linkOriginOf(req))', 'serializePublishedDeck(revoked)'],
  [QUESTIONS, 'the summary is not gated by the flag', "if (STUDIO_P2_PUBLISH_ENABLED && url.searchParams.get('summary') === '1') {", "if (url.searchParams.get('summary') === '1') {"],
  [QUESTIONS, 'any summary value asks for the counts', "url.searchParams.get('summary') === '1'", "url.searchParams.get('summary') !== null"],
  [QUESTIONS, 'the waiting count counts blocked questions', "prisma.deckQuestion.count({ where: { publishedDeckId: owned.deck.id, ownerAnswer: null, status: { not: 'blocked' } } }),\n      ])", "prisma.deckQuestion.count({ where: { publishedDeckId: owned.deck.id, ownerAnswer: null } }),\n      ])"],
  [QUESTIONS, 'the total counts only the answered', "prisma.deckQuestion.count({ where: { publishedDeckId: owned.deck.id } }),", "prisma.deckQuestion.count({ where: { publishedDeckId: owned.deck.id, status: 'answered' } }),"],
  [QUESTIONS, 'the FAQ join is not gated by the inbox flag', '...(STUDIO_P2_PUBLISH_INBOX_ENABLED ? { include:', '...(true ? { include:'],
  [QUESTIONS, 'an unpublished FAQ entry counts', 'faqItemId: faq && faq.published ? faq.id : null', 'faqItemId: faq ? faq.id : null'],
  // ---- publish-p2: the pieces
  [P2, 'PUB-02 the passcode is shown', "type={shown ? 'text' : 'password'}", "type=\"text\""],
  [P2, 'PUB-07 the script can be asked for with no session length', 'locked={busyNow || !hasBudget}', 'locked={busyNow}'],
  [P2, 'PUB-06 recording can be chosen without a script', 'locked={busyNow || !writes}', 'locked={busyNow}'],
  [P2, 'PUB-06 any tick counts', 'const consentCents = estimate && ticked === estimate.cents ? ticked : null', 'const consentCents = estimate ? ticked : null'],
  [P2, 'PUB-06 leaving the step keeps the tick', 'useEffect(() => () => reportRef.current(null), [])', 'useEffect(() => () => {}, [])'],
  [P2, 'PUB-06 the tick stays when recording is switched off', 'useEffect(() => { if (!wantsEstimate) setTicked(null) }, [wantsEstimate])', 'useEffect(() => {}, [wantsEstimate])'],
  [P2, 'PUB-06 the price is read from another route', '`/api/narration/voice?sessionId=${encodeURIComponent(deckSessionId)}`', '`/api/narration/render?sessionId=${encodeURIComponent(deckSessionId)}`'],
  [P2, 'PUB-06 a failed price read leaves recording waiting', ".catch(() => { if (!cancelled) setRate('unavailable') })", '.catch(() => {})'],
  [P2, 'PUB-06 a late answer is used', 'return () => { cancelled = true }\n  }, [wantsEstimate, deckSessionId])', 'return () => {}\n  }, [wantsEstimate, deckSessionId])'],
  [P2, 'PUB-10 "View as a viewer" goes nowhere', '<a href={url} target="_blank" rel="noopener noreferrer">View as a viewer', '<a href="#" target="_blank" rel="noopener noreferrer">View as a viewer'],
  [P2, 'PUB-08 every row reads On', "<em>{row.on ? 'On' : 'Off'}</em>", '<em>On</em>'],
  [P2, 'PUB-08 the mark is the same for off', '{row.on ? <Check size={14} aria-hidden="true" /> : <Minus size={14} aria-hidden="true" />}', '<Check size={14} aria-hidden="true" />'],
  [P2, 'PUB-11 the badge is never drawn', 'if (!badge) return null', 'return null'],
  [P2, 'PUB-11 the badge is not spoken', '<span className="sr-only">{badge.label}</span>', ''],
  [P2, 'PUB-11 numbers of another link are shown', 'questions: slug && asks && questionsRead?.slug === slug ? questionsRead.counts : null', 'questions: slug && asks && questionsRead ? questionsRead.counts : null'],
  [P2, 'PUB-11 narration of another link is shown', 'narration: slug && narrates && narrationRead?.slug === slug ? narrationRead.state : null', 'narration: slug && narrates && narrationRead ? narrationRead.state : null'],
  [P2, 'PUB-11 questions are read with questions off', 'if (!slug || !asks) return', 'if (!slug) return'],
  [P2, 'PUB-11 the summary read asks for the whole list', '`/api/publish/${encodeURIComponent(slug)}/questions?summary=1`', '`/api/publish/${encodeURIComponent(slug)}/questions`'],
  [P2, 'PUB-11 the facts are read while the dialog is closed', 'const slug = STUDIO_P2_PUBLISH_ENABLED && open && record && !record.revokedAt ? record.slug : null', 'const slug = STUDIO_P2_PUBLISH_ENABLED && record && !record.revokedAt ? record.slug : null'],
  [P2, 'PUB-11 the facts are read with the flag off', 'const slug = STUDIO_P2_PUBLISH_ENABLED && open && record', 'const slug = open && record'],
  [P2, 'ORIGIN the link is built with the flag off', 'process.env.NEXT_PUBLIC_APP_URL, typeof window === \'undefined\' ? null : window.location.origin, STUDIO_P2_PUBLISH_ORIGIN_ENABLED)', 'process.env.NEXT_PUBLIC_APP_URL, typeof window === \'undefined\' ? null : window.location.origin, true)'],
  [P2, 'ORIGIN NEXT_PUBLIC_APP_URL is not looked at', 'viewerLinkFor(record, process.env.NEXT_PUBLIC_APP_URL,', 'viewerLinkFor(record, undefined,'],
  // ---- the wizard
  [WIZARD, 'PUB-06 recording starts on', 'recordNarration: STUDIO_P2_PUBLISH ? false : true,', 'recordNarration: true,'],
  [WIZARD, 'PUB-02 a short passcode lets Next through', "|| (STUDIO_P2_PUBLISH && choices.visibility === 'restricted' && passcodeShortBy(choices.passcode) > 0)", ''],
  [WIZARD, 'PUB-04 the note shows with questions off', '{STUDIO_P2_PUBLISH && choices.qaEnabled && <PublishQuestionsNote />}', '{STUDIO_P2_PUBLISH && <PublishQuestionsNote />}'],
  [WIZARD, 'PUB-04 the note is not drawn', '{STUDIO_P2_PUBLISH && choices.qaEnabled && <PublishQuestionsNote />}', ''],
  [WIZARD, 'PUB-07 publish sends the raw choices', 'onPublish(STUDIO_P2_PUBLISH ? publishChoicesFor(choices, budget !== null) : choices)', 'onPublish(choices)'],
  [WIZARD, 'PUB-08 the aside keeps the four lines', '{STUDIO_P2_PUBLISH ? (\n            <PublishCapabilityRows', '{false ? (\n            <PublishCapabilityRows'],
  [WIZARD, 'PUB-08 the rows are drawn with the flag off', '{STUDIO_P2_PUBLISH ? (\n            <PublishCapabilityRows', '{true ? (\n            <PublishCapabilityRows'],
  [WIZARD, 'PUB-08 the rows ignore the downloads', 'allowPdf: choices.allowPdf, allowPptx: choices.allowPptx, qaEnabled: choices.qaEnabled', 'allowPdf: true, allowPptx: true, qaEnabled: choices.qaEnabled'],
  [WIZARD, 'PUB-10 the link shows before the deck is live', '{STUDIO_P2_PUBLISH && published && !busy && record?.publicUrl &&', '{STUDIO_P2_PUBLISH && !busy && record?.publicUrl &&'],
  [WIZARD, 'ORIGIN the done link ignores the origin', '<PublishDoneLink url={publishedLink(record)} />', '<PublishDoneLink url={record.publicUrl} />'],
  // ---- the dialog
  [DIALOG, 'PUB-03 the subtitle is the old one', '{STUDIO_P2_PUBLISH ? dialogSubtitle({', '{false ? dialogSubtitle({'],
  [DIALOG, 'PUB-03 the published subtitle counts the deck, not the copy', 'slideCount: isLive ? record!.slideCount : slideCount })', 'slideCount })'],
  [DIALOG, 'PUB-11 the question fact is not drawn', '{STUDIO_P2_PUBLISH ? <span>{questionsFact(record!.qaEnabled, p2Facts.questions)}</span>', '{false ? <span>{questionsFact(record!.qaEnabled, p2Facts.questions)}</span>'],
  [DIALOG, 'PUB-11 the narration fact is not drawn', '{STUDIO_P2_PUBLISH ? <span>{narrationFact(record!.narrationEnabled, p2Facts.narration)}</span>', '{false ? <span>{narrationFact(record!.narrationEnabled, p2Facts.narration)}</span>'],
  [DIALOG, 'PUB-11 the badge is not drawn', '{STUDIO_P2_PUBLISH && <PublishQuestionsBadge counts={p2Facts.questions} />}', ''],
  [DIALOG, 'PUB-11 the badge is drawn with the flag off', '{STUDIO_P2_PUBLISH && <PublishQuestionsBadge counts={p2Facts.questions} />}', '{<PublishQuestionsBadge counts={p2Facts.questions} />}'],
  [DIALOG, 'PUB-11 the facts are read while closed', 'const p2Facts = useP2ManageFacts(record, open)', 'const p2Facts = useP2ManageFacts(record, true)'],
  [DIALOG, 'PUB-15 the tab gets no image', '{...(STUDIO_P2_PUBLISH ? { deckPreview } : {})} />', '/>'],
  [DIALOG, 'PUB-15 the image is handed over with the flag off', '{...(STUDIO_P2_PUBLISH ? { deckPreview } : {})} />', '{...{ deckPreview }} />'],
  [DIALOG, 'ORIGIN the link field ignores the origin', '<Input readOnly value={publishedLink(record!)}', '<Input readOnly value={record!.publicUrl}'],
  [DIALOG, 'ORIGIN Copy ignores the origin', 'const ok = await copy(publishedLink(record))', 'const ok = await copy(record.publicUrl)'],
  [DIALOG, 'ORIGIN Open ignores the origin', '<a href={publishedLink(record!)} target="_blank"', '<a href={record!.publicUrl} target="_blank"'],
  [DIALOG, 'PUB-06 recording starts without the exact check', "if (STUDIO_P2_PUBLISH && steps[3].status === 'pending') {", 'if (false) {'],
  [DIALOG, 'PUB-06 the verdict is not applied', 'if (!verdict.proceed) update(3, { status: \'skipped\', detail: verdict.detail })', ''],
  [DIALOG, 'PUB-06 the price check is a charge', "body: JSON.stringify({ slug: deck.slug, estimate: true }),", 'body: JSON.stringify({ slug: deck.slug }),'],
  // ---- the Viewer page tab
  [SUMMARY, 'PUB-15 the rows are not drawn', 'input={{ visibility: record.visibility, allowPdf: record.allowPdf,', 'input={{ visibility: record.visibility, allowPdf: undefined,'],
  [SUMMARY, 'PUB-15 the old facts stay', '{!STUDIO_P2_PUBLISH_ENABLED && <div><dt>PDF download</dt>', '{true && <div><dt>PDF download</dt>'],
  [SUMMARY, 'PUB-15 the note is always "current"', '<p className="studio-publish-viewer-preview-note">{viewerPreviewNote(staleness)}</p>', "<p className=\"studio-publish-viewer-preview-note\">{viewerPreviewNote('current')}</p>"],
  [SUMMARY, 'PUB-15 the image shows with the flag off', "{STUDIO_P2_PUBLISH_ENABLED ? (\n            <>\n              <StudioPublishPreview", "{true ? (\n            <>\n              <StudioPublishPreview"],
  [SUMMARY, 'PUB-15 the image is not drawn', '<StudioPublishPreview sessionId={sessionId} source={deckPreview} />', ''],
  // ---- VIEW-07 / VIEW-04 / PUB-16
  [PRESENTER, 'VIEW-07 the Ask popover is marked with the flag off', "data-studio-published-ask={STUDIO_P2_PUBLISH_ENABLED ? 'true' : undefined}", "data-studio-published-ask=\"true\""],
  [PRESENTER, 'VIEW-07 the Ask popover is not marked', "data-studio-published-ask={STUDIO_P2_PUBLISH_ENABLED ? 'true' : undefined}", ''],
  [LAYOUT, 'VIEW-04 the root layout always uses the viewer provider', 'const AppThemeProvider = STUDIO_P2_PUBLISH_ENABLED ? StudioViewerThemeProvider : ThemeProvider', 'const AppThemeProvider = StudioViewerThemeProvider'],
  [LAYOUT, 'VIEW-04 the root layout never does', 'const AppThemeProvider = STUDIO_P2_PUBLISH_ENABLED ? StudioViewerThemeProvider : ThemeProvider', 'const AppThemeProvider = ThemeProvider'],
  [THEME, 'VIEW-04 the provider is never re-keyed', "key={isPublishedViewerPath(pathname) ? 'published-viewer' : 'app'}", "key=\"app\""],
  [THEME, 'VIEW-04 the default is the root one', 'defaultTheme={viewerDefaultTheme(pathname, true, defaultTheme)}', 'defaultTheme={defaultTheme}'],
  [THEME, 'VIEW-04 the other props are dropped', '{...props}\n      defaultTheme', 'defaultTheme'],
  [INBOX_UI, 'PUB-16 the actions show with the flag off', 'const p2Actions = STUDIO_P2_INBOX ? inboxRowActions(item) : null', 'const p2Actions = inboxRowActions(item)'],
  [INBOX_UI, 'PUB-16 Unblock sends a POST', "method: reverse ? 'DELETE' : 'POST',", "method: 'POST',"],
  [INBOX_UI, 'PUB-16 Remove from FAQ calls the wrong route', "{ url: `/api/publish/${slug}/faq/${encodeURIComponent(faqItemIdOf(item) ?? '')}` }", "{ url: `/api/publish/${slug}/faqs/${encodeURIComponent(faqItemIdOf(item) ?? '')}` }"],
  [INBOX_UI, 'PUB-16 Unblock calls the wrong route', "{ url: `/api/publish/${slug}/questions/${item.id}/block` }", "{ url: `/api/publish/${slug}/questions/${item.id}/unblock` }"],
  [INBOX_UI, 'PUB-16 a blocked row cannot be unblocked', '{p2Actions?.unblock && (', '{false && ('],
  // ---- CSS: nothing leaks out of the flag-on markup
  ['components/studio-published-viewer.css', 'VIEW-07 a viewer rule is global', '.dark [data-studio-v4-shell="true"][data-studio-published-ask="true"] button[aria-label="Send"] { color: #14211d; }', '.dark button[aria-label="Send"] { color: #14211d; }'],
  ['components/studio-qa-inbox.css', 'PUB-16 an inbox rule is global', '[data-studio-qa-inbox="true"] .studio-qa-unblock-note { color: var(--sqi-muted); line-height: 1.6; }', '.studio-qa-unblock-note { color: var(--sqi-muted); line-height: 1.6; }'],
  [CSS, 'PUB-08 a dialog rule is global', '[data-studio-publish="true"] .studio-publish-viewer-preview-note { margin: 0;', '.studio-publish-viewer-preview-note { margin: 0;'],
]

const started = Date.now()
if (process.env.P2_MUTANT_TARGETS_ONLY) {
  let bad = 0
  for (const [rel, name, from] of MUTANTS) { const count = branchSources[rel].split(from).length - 1; if (count !== 1) { bad++; console.log(`mutant "${name}": ${count} places in ${rel}`) } }
  console.log(bad ? `${bad} mutants do not name exactly one place` : `${MUTANTS.length} mutant targets match`)
  process.exit(bad ? 1 : 0)
}

await suite(branchSources)
const total = checks
if (process.env.P2_NO_MUTANTS) { console.log(`PASS (no mutants run): studio P2 publish (${total} checks)`); process.exit(0) }

let caught = 0
const survivors = []
for (const [rel, name, from, to] of MUTANTS) {
  const count = branchSources[rel].split(from).length - 1
  assert.equal(count, 1, `mutant "${name}" must match exactly one place in ${rel} (${count})`)
  const mutated = branchSources[rel].replace(from, () => to)
  const transpile = ts.transpileModule(mutated, { fileName: rel, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
  if (!rel.endsWith('.css')) assert.deepEqual((transpile.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error).length, 0, `mutant "${name}" must still be code that compiles`)
  let failure = null
  const before = checks
  try { await suite({ ...branchSources, [rel]: branchSources[rel].replace(from, () => to) }, { light: true }) } catch (error) { failure = error }
  unhandled.length = 0
  checks = before
  if (failure) caught++
  else survivors.push(`${rel}: ${name}`)
}
assert.deepEqual(survivors, [], `${survivors.length} mutants survived`)
console.log(`PASS: studio P2 publish (${total} checks, ${caught}/${MUTANTS.length} mutants caught, ${((Date.now() - started) / 1000).toFixed(0)} s)`)
