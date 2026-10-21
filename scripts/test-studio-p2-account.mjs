// PASS2 account pages (FRONTEND-1): Billing, Profile settings, Shortcuts and the Landing plan words, as the accepted v4 mockup has them, with ONE plan list.
// Flag NEXT_PUBLIC_STUDIO_P2_ACCOUNT (exact "true"), default off. The account pages part also needs the Studio shell (NEXT_PUBLIC_STUDIO_V4_SHELL "true"); Landing needs only the flag.
//   ACC-04 Profile "Save", Billing "Upgrade Now" and "View Plans" use the ink action token (--ss-action), not the violet accent
//   ACC-12 Billing's usage card shows the real daily / weekly meters (/api/usage/quota, the account menu's numbers) in place of the "Planned" row
//   ACC-13 the plan's price comes from the shared plan list (never a fixed $29 / $290); a tier no plan carries falls back to "Billed monthly" / "Billed yearly"
//   ACC-14 ONE list (PRICING_TIERS: Starter $20, Pro $50, Max $100) feeds Billing and Landing; no "4 AI agents", no "Upgrade to Enterprise"
//   ACC-16 /shortcuts lists only the keys that have a handler, each proven against its handler's source   ACC-17 and is styled in the shell's tokens (dark mode readable)
//   ACC-02 (the account menu's Billing and Shortcuts rows) is delivered by the profile-menu PR, not here.
//
// Run: node scripts/test-studio-p2-account.mjs   (plain node: transpile + vm, no network, no browser, no env)
//   P2_ACCOUNT_BASE=<commit> overrides the base commit flag-off identity is checked against (default fbc77c0, the studio-v4-dev-preparation-code tip the work started from).
//
// Proven on the REAL sources:
//   1. lib/studio-billing.ts: import-free; plan match (free / unknown -> none, "max" is premium), price line, plan lines, next plan, Landing tiers (flag off = same array), the usage meters;
//   2. lib/studio-shortcuts.ts: import-free; the exact list; EVERY entry is pinned to the handler source that reads its key, and no un-handled key is listed;
//   3. the components (executed): the capacity row (in flight / failed / meters) and the shortcuts page;
//   4. the wiring (executed against the base commit's files): flag off or shell off = the same tree and the same requests as the base, for Billing, Profile, Shortcuts, the Landing
//      pricing section and /pricing; flag on = the words above, one extra read of /api/usage/quota on Billing;
//   5. the CSS: every rule scoped to the pages' own markers, tokens only (and every token exists in light and dark in studio-shell.css);
//   6. mutation check: every mutant of the sources is killed by sections 1-5.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import postcss from 'postcss'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const BASE_COMMIT = process.env.P2_ACCOUNT_BASE || 'fbc77c0430099ec7e11a188307ee5521b6937719'
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
const baseCache = new Map()
const baseSource = rel => {
  if (!baseCache.has(rel)) {
    try { baseCache.set(rel, execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })) }
    catch (error) { throw new Error(`base commit ${BASE_COMMIT} is not in this clone (fetch the full history): ${error.message}`) }
  }
  return baseCache.get(rel)
}
let checks = 0
let counting = true
const count = fn => (...args) => { if (counting) checks++; return fn(...args) }
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value)) // values built inside the vm carry its realm's prototypes
const eq = count(assert.equal), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch), deepEq = count((actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message))

const BILLING_LIB = 'lib/studio-billing.ts'
const SHORTCUTS_LIB = 'lib/studio-shortcuts.ts'
const CAPACITY = 'components/billing/studio-billing-capacity.tsx'
const SHORTCUTS_UI = 'components/settings/studio-p2-shortcuts.tsx'
const BILLING_PAGE = 'app/(app)/billing/page.tsx'
const PROFILE_PAGE = 'app/(app)/settings/profile/page.tsx'
const SHORTCUTS_PAGE = 'app/(app)/shortcuts/page.tsx'
const PRICING_HOME = 'components/marketing/v3/home/Pricing.tsx'
const PRICING_PAGE = 'app/(marketing-v3)/pricing/page.tsx'
const CSS_ACCOUNT = 'components/settings/studio-p2-account.css'
const CSS_SHORTCUTS = 'components/settings/studio-p2-shortcuts.css'
const PRICING_DATA = 'lib/marketing/homepage-v2-pricing.ts'
const LANDING_CONTENT = 'lib/marketing/v3-content.ts'
const SHELL_CSS = 'components/layout/studio-shell.css'
const ENV = '.env.example'
const PKG = 'package.json'
const SOURCES = Object.fromEntries([BILLING_LIB, SHORTCUTS_LIB, CAPACITY, SHORTCUTS_UI, BILLING_PAGE, PROFILE_PAGE, SHORTCUTS_PAGE, PRICING_HOME, PRICING_PAGE, CSS_ACCOUNT, CSS_SHORTCUTS, ENV, PKG].map(rel => [rel, read(rel)]))
const FLAG = 'NEXT_PUBLIC_STUDIO_P2_ACCOUNT'

// ---------------------------------------------------------------- loading
const jsx = (type, props) => ({ type, props: props ?? {} })
const JSX_RUNTIME = { jsx, jsxs: jsx, Fragment: 'Fragment' }
const names = new Proxy({}, { get: (_target, key) => key })
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : value && typeof value === 'object' ? [value, ...nodes(value.props?.children)] : []
const rawText = value => Array.isArray(value) ? value.map(rawText).join(value.every(x => x == null || typeof x !== 'object') ? '' : ' ') : value == null || typeof value === 'boolean' ? '' : typeof value === 'object' ? rawText(value.props?.children) : String(value)
const text = value => rawText(value).replace(/\s+/g, ' ').trim()
const rendered = value => JSON.stringify(value, (key, item) => key === 'children' && Array.isArray(item) ? item.filter(x => x !== false && x !== undefined && x !== null) : item)
const isElement = value => value && typeof value === 'object' && 'type' in value && 'props' in value
const expand = value => Array.isArray(value) ? value.map(expand) : isElement(value) ? (typeof value.type === 'function' ? expand(value.type(value.props)) : { type: value.type, props: Object.fromEntries(Object.entries(value.props).map(([k, v]) => [k, k === 'children' ? expand(v) : v])) }) : value
const compileCache = new Map()
const compile = (source, fileName) => {
  const key = `${fileName}\0${source}`
  if (!compileCache.has(key)) {
    const out = ts.transpileModule(source, { fileName, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } })
    assert.equal((out.diagnostics ?? []).filter(x => x.category === ts.DiagnosticCategory.Error).length, 0, `${fileName} compiles`)
    compileCache.set(key, out.outputText)
  }
  return compileCache.get(key)
}
function load(source, fileName, { deps = {}, env = {}, globals = {} } = {}) {
  const module = { exports: {} }
  vm.runInNewContext(compile(source, fileName), { module, exports: module.exports, process: { env }, Date, ...globals, require: name => {
    if (name in deps) return deps[name]
    if (name === 'react/jsx-runtime') return JSX_RUNTIME
    if (name.endsWith('.css')) return {}
    if (name === 'lucide-react' || name.startsWith('@/components/') || name.startsWith('./') || name.startsWith('../') || name === 'next/link') return names
    assert.fail(`Unexpected import ${name} in ${fileName}`)
  } })
  return module.exports
}
function makeReact() {
  const slots = [], effects = [], cleanups = []; let cursor = 0
  return {
    reset() { cursor = 0 },
    flushEffects() { while (effects.length) { const cleanup = effects.shift()(); if (typeof cleanup === 'function') cleanups.push(cleanup) } },
    unmount() { while (cleanups.length) cleanups.shift()() },
    api: {
      Suspense: 'Suspense',
      useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value }] },
      useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
      useCallback: fn => fn,
      useMemo: fn => fn(),
      useEffect(fn, deps) { const i = cursor++, previous = slots[i]; if (!previous || !deps || deps.some((x, index) => x !== previous.deps[index])) { slots[i] = { deps }; effects.push(fn) } },
    },
  }
}
const pricingModule = load(baseSource(PRICING_DATA), PRICING_DATA)
const PLANS = pricingModule.PRICING_TIERS
const agentStub = { AGENT_TEAM: new Proxy([], { get: (target, key) => key === 'find' ? () => ({ color: '#000000' }) : target[key] }) }
const LANDING = load(baseSource(LANDING_CONTENT), LANDING_CONTENT, { deps: { '@/lib/marketing/homepage-v2-content': agentStub } }).V3_CONTENT

// ---------------------------------------------------------------- 1. the billing lib
const attempt = fn => { try { return fn() } catch (error) { return { threw: String(error) } } } // a mutant that crashes must fail an assertion, not the run
const NOW = new Date('2099-01-01T00:00:00Z')
const AT = hours => new Date(NOW.getTime() + hours * 3_600_000).toISOString()
const stamp = date => `D:${date.toISOString()}`
function proveBillingLib(source, label = 'billing lib') {
  nomatch(source, /^\s*(?:import\b|export\s+\*?\s*from\b)|require\(/m, `${label}: import-free`)
  const lib = load(source, BILLING_LIB)
  // the shared list itself: what Landing shows and the quota caps use
  deepEq(PLANS.map(p => [p.id, p.name, p.price, p.priceSuffix]), [['starter', 'Starter', '$20', 'per user / mo'], ['pro', 'Pro', '$50', 'per user / mo'], ['premium', 'Max', '$100', 'per user / mo']], `${label}: the shared plan list`)
  // plan match
  for (const [tier, want] of [['starter', 'starter'], ['pro', 'pro'], ['premium', 'premium'], ['max', 'premium'], ['free', null], ['', null], [undefined, null], [null, null], [42, null], ['Pro', null], ['PREMIUM', null], ['enterprise', null], ['constructor', null], ['__proto__', null], ['toString', null], ['hasOwnProperty', null], ['professional', null], ['pro-annual', null], ['starter2', null], ['premiumplus', null], ['max ', null], ['MAX', null], [' pro', null]]) {
    eq(attempt(() => lib.studioPlanForTier(PLANS, tier))?.id ?? null, want, `${label}: plan for tier ${JSON.stringify(tier)}`)
  }
  eq(attempt(() => lib.studioPlanForTier([], 'pro')), null, `${label}: no plan in an empty list`)
  // price words
  deepEq(PLANS.map(p => attempt(() => lib.studioPlanPrice(p))), ['$20 per user / mo', '$50 per user / mo', '$100 per user / mo'], `${label}: the price the way Landing prints it`)
  eq(attempt(() => lib.studioPlanPrice({ id: 'x', name: 'X', price: '$7', blurb: '', features: [], usageNote: '' })), '$7/month', `${label}: no suffix: per month`)
  for (const [tier, cycle, want] of [
    ['starter', undefined, '$20 per user / mo'], ['pro', null, '$50 per user / mo'], ['pro', 'monthly', '$50 per user / mo'], ['premium', 'monthly', '$100 per user / mo'], ['max', undefined, '$100 per user / mo'],
    ['pro', 'yearly', '$50 per user / mo · Billed yearly'], ['starter', 'yearly', '$20 per user / mo · Billed yearly'], ['premium', 'yearly', '$100 per user / mo · Billed yearly'],
    ['enterprise', 'yearly', 'Billed yearly'], ['enterprise', 'monthly', 'Billed monthly'], ['free', 'monthly', 'Billed monthly'], ['free', 'yearly', 'Billed yearly'], [undefined, 'yearly', 'Billed yearly'],
    ['free', undefined, 'No charge'], ['free', null, 'No charge'], ['enterprise', undefined, 'No charge'], ['enterprise', 'weekly', 'No charge'], ['free', '', 'No charge'], [undefined, undefined, 'No charge'],
  ]) eq(attempt(() => lib.studioBillingPriceLine(PLANS, tier, cycle)), want, `${label}: price line for ${tier} / ${cycle}`)
  ok(!PLANS.some(p => /\$29|\$290/.test(attempt(() => lib.studioBillingPriceLine(PLANS, p.id, 'yearly')))), `${label}: no fixed $29 / $290`)
  // plan lines
  for (const plan of PLANS) {
    const lines = attempt(() => lib.studioPlanLines(plan))
    deepEq(lines?.map?.(l => l.text), plan.features, `${label}: ${plan.id} lines are its own features in order`)
    deepEq(lines?.map?.(l => l.lead), plan.features.map(f => f.endsWith(':')), `${label}: ${plan.id} lead lines`)
  }
  deepEq(attempt(() => lib.studioPlanLines({ features: ['A:', 'B', 'C: ', 'D:E'] })).map(l => l.lead), [true, false, true, false], `${label}: a lead line ends with a colon (trailing space allowed)`)
  deepEq(PLANS.map(p => attempt(() => lib.studioPlanLines(p)).filter(l => l.lead).length), [0, 1, 1], `${label}: Starter has no lead line, Pro and Max one`)
  ok(!PLANS.some(p => p.features.some(f => /4 AI agents|Enterprise/i.test(f))), `${label}: the list has no "4 AI agents" and no "Enterprise"`)
  // next plan
  for (const [id, want] of [['starter', 'pro'], ['pro', 'premium'], ['premium', null]]) eq(attempt(() => lib.studioNextPlan(PLANS, PLANS.find(p => p.id === id)))?.id ?? null, want, `${label}: next plan after ${id}`)
  eq(attempt(() => lib.studioNextPlan(PLANS, null)), null, `${label}: no plan, no next plan`)
  eq(attempt(() => lib.studioNextPlan(PLANS, { id: 'ghost' })), null, `${label}: a plan that is not in the list has no next plan`)
  // landing tiers
  const tiers = [
    { id: 'starter', name: 'S', price: '$1', suffix: 's', blurb: 'b', features: ['x'], note: 'n', cta: 'Get started' },
    { id: 'pro', name: 'P', price: '$2', suffix: 's', blurb: 'b', features: ['x'], note: 'n', cta: 'Get started', tag: 'Most popular' },
    { id: 'max', name: 'M', price: '$3', suffix: 's', blurb: 'b', features: ['x'], note: 'n', cta: 'Get started' },
    { id: 'custom', name: 'C', price: '$4', suffix: 's', blurb: 'b', features: ['x'], note: 'n', cta: 'Talk' },
  ]
  const off = attempt(() => lib.studioLandingTiers(tiers, PLANS, false))
  ok(off === tiers, `${label}: flag off returns the same array`)
  for (const notOn of [undefined, null, 0, '', 'true', 1]) ok(attempt(() => lib.studioLandingTiers(tiers, PLANS, notOn)) === tiers, `${label}: only a real true switches it on (${JSON.stringify(notOn)})`)
  const on = attempt(() => lib.studioLandingTiers(tiers, PLANS, true))
  deepEq(on.map(t => [t.id, t.name, t.price, t.suffix]), [['starter', 'Starter', '$20', 'per user / mo'], ['pro', 'Pro', '$50', 'per user / mo'], ['max', 'Max', '$100', 'per user / mo'], ['custom', 'C', '$4', 's']], `${label}: flag on: the plan words from the list ("max" is premium; a tier no plan carries stays)`)
  deepEq(on.slice(0, 3).map(t => [t.blurb, t.features, t.note]), PLANS.map(p => [p.blurb, [...p.features], p.usageNote]), `${label}: flag on: blurb, features and note from the list`)
  deepEq(on.map(t => [t.cta, t.tag]), tiers.map(t => [t.cta, t.tag]), `${label}: Landing's own button label and tag stay`)
  ok(on[3] === tiers[3], `${label}: an unmatched tier is the same object`)
  eq(tiers[0].name, 'S', `${label}: the input is not changed`)
  const noSuffix = attempt(() => lib.studioLandingTiers([{ id: 'pro', suffix: 'kept' }], [{ id: 'pro', name: 'P', price: '$1', blurb: '', features: [], usageNote: '' }], true))
  eq(noSuffix[0].suffix, 'kept', `${label}: a plan with no suffix leaves the tier's suffix`)
  // meters
  deepEq({ ...lib.STUDIO_BILLING_USAGE_WORDS }, { title: 'Creative capacity', left: 'left', loading: '…', unavailable: 'Not available right now' }, `${label}: the usage words`)
  for (const [share, want] of [[0, 0], [1, 100], [.37, 37], [.82, 82], [.29, 29], [.005, 1], [.004, 0], [.125, 13], [.375, 38], [1.5, 100], [-.2, 0], [NaN, null], [Infinity, null], [-Infinity, null], ['0.5', null], ['', null], [null, null], [undefined, null], [{}, null], [true, null]]) {
    eq(attempt(() => lib.studioBillingPercent(share)), want, `${label}: percent left for ${String(share)}`)
  }
  for (const [resetAt, want] of [
    [AT(5.5), 'Resets in 5h'], [AT(1), 'Resets in 1h'], [AT(23.999), 'Resets in 23h'], [AT(.5), 'Resets in under 1h'], [AT(.999), 'Resets in under 1h'],
    [AT(24), `Resets ${stamp(new Date(AT(24)))}`], [AT(24 * 7), `Resets ${stamp(new Date(AT(24 * 7)))}`], [AT(0), 'Resets now'], [AT(-3), 'Resets now'],
    ['not a date', ''], ['', ''], [undefined, ''], [null, ''], [42, ''], [{}, ''],
  ]) eq(attempt(() => lib.studioBillingReset(resetAt, NOW, stamp)), want, `${label}: reset text for ${String(resetAt)}`)
  match(attempt(() => lib.studioBillingReset(AT(24 * 7 + 12), NOW)), /^Resets [A-Za-z]{3,4}\.? \d{1,2}$/, `${label}: the default date is a short month and day`)
  const quota = { remainingPct: { daily: .37, weekly: .82 }, resetAt: { daily: AT(5.5), weekly: AT(24 * 7) } }
  deepEq(attempt(() => lib.studioBillingMeters(quota, NOW, stamp)), [{ id: 'daily', label: 'Daily', percent: 37, reset: 'Resets in 5h' }, { id: 'weekly', label: 'Weekly', percent: 82, reset: `Resets ${stamp(new Date(AT(24 * 7)))}` }], `${label}: daily then weekly, real shares and reset times`)
  deepEq(attempt(() => lib.studioBillingMeters({ resetAt: quota.resetAt, remainingPct: { weekly: .82, daily: .37 } }, NOW, stamp)).map(m => m.id), ['daily', 'weekly'], `${label}: the order does not follow the read's key order`)
  deepEq(attempt(() => lib.studioBillingMeters({ remainingPct: { daily: .37, weekly: .82 } }, NOW, stamp)).map(m => m.reset), ['', ''], `${label}: no reset times in the read: no reset text`)
  deepEq(attempt(() => lib.studioBillingMeters({ remainingPct: { daily: NaN, weekly: .5 }, resetAt: quota.resetAt }, NOW, stamp)).map(m => [m.id, m.percent]), [['weekly', 50]], `${label}: an unreadable share leaves its meter out`)
  deepEq(attempt(() => lib.studioBillingMeters({ remainingPct: { daily: .5, weekly: 'x' } }, NOW, stamp)).map(m => [m.id, m.percent]), [['daily', 50]], `${label}: an unreadable weekly share leaves its meter out`)
  deepEq(attempt(() => lib.studioBillingMeters({ remainingPct: { daily: .5, weekly: .5 }, resetAt: { daily: AT(2), weekly: AT(30) } }, NOW, stamp)).map(m => m.reset), ['Resets in 2h', `Resets ${stamp(new Date(AT(30)))}`], `${label}: each meter has its own reset time`)
  for (const empty of [null, undefined, {}, { remainingPct: null }, { remainingPct: {} }, { remainingPct: { daily: 'a', weekly: null } }]) deepEq(attempt(() => lib.studioBillingMeters(empty, NOW, stamp)), [], `${label}: no meters for ${JSON.stringify(empty)}`)
  deepEq(attempt(() => lib.studioBillingMeters(quota)).map(m => m.id), ['daily', 'weekly'], `${label}: the clock and formatter are optional`)
  return lib
}

// ---------------------------------------------------------------- 2. the shortcuts lib, pinned to the handlers
const HANDLERS = {
  chat: 'components/builder/chat-input.tsx',
  viewer: 'components/presentation-viewer.tsx',
  strip: 'components/slide-thumbnail-strip.tsx',
  addSlide: 'components/studio-add-slide-v2.tsx',
  genPanel: 'components/generation-panel/index.tsx',
  slidePanel: 'components/slide-generation-panel/index.tsx',
  builder: 'app/builder/page.tsx',
}
const HANDLER_SOURCES = Object.fromEntries(Object.entries(HANDLERS).map(([key, rel]) => [key, read(rel)]))
const MOD_ENTER = /\.key === 'Enter' && \((?:e|event)\.metaKey \|\| (?:e|event)\.ctrlKey\)/
const EVIDENCE = {
  send: [['chat', /e\.key === 'Enter' && !e\.shiftKey\) \{\s*e\.preventDefault\(\)\s*guardedSubmit\(\)/]],
  newline: [['chat', /e\.key === 'Enter' && !e\.shiftKey\) \{\s*e\.preventDefault\(\)\s*guardedSubmit\(\)/]],
  stop: [['chat', /e\.key === 'Escape' && awaitingReply\) \{\s*e\.preventDefault\(\)\s*onStopAwaiting\?\.\(\)/], ['chat', /e\.key === 'Escape' && pendingActionInput\) \{\s*e\.preventDefault\(\)\s*onCancelAction\(\)/]],
  next: [['viewer', /case 'ArrowRight':\s*case 'ArrowDown':\s*e\.preventDefault\(\)\s*handleNextSlide\(\)/]],
  previous: [['viewer', /case 'ArrowLeft':\s*case 'ArrowUp':\s*e\.preventDefault\(\)\s*handlePrevSlide\(\)/]],
  edit: [['viewer', /case 'e':\s*case 'E':\s*e\.preventDefault\(\)\s*handleToggleEditModeButton\(\)/]],
  grid: [['viewer', /case 'g':\s*case 'G':\s*e\.preventDefault\(\)\s*handleToggleGrid\(\)/]],
  borders: [['viewer', /case 'b':\s*case 'B':\s*e\.preventDefault\(\)\s*handleToggleBorders\(\)/]],
  strip: [['viewer', /case 'Escape':\s*e\.preventDefault\(\)\s*handleToggleOverview\(\)/]],
  save: [['viewer', /\(e\.ctrlKey \|\| e\.metaKey\) && e\.key === 's'\) \{\s*e\.preventDefault\(\)\s*if \(isEditMode\) \{\s*handleForceSave\(\)/]],
  'strip-delete': [['strip', /\(e\.key === 'Delete' \|\| e\.key === 'Backspace'\)/]],
  'strip-all': [['strip', /\(e\.ctrlKey \|\| e\.metaKey\) && e\.key === 'a'\) \{\s*e\.preventDefault\(\)\s*const allSlides/]],
  'strip-clear': [['strip', /e\.key === 'Escape'\) \{\s*e\.preventDefault\(\)\s*onSelectionChange\?\.\(\[\]\)/]],
  'panel-generate': [['addSlide', MOD_ENTER], ['genPanel', MOD_ENTER], ['slidePanel', MOD_ENTER]],
  'panel-close': [['addSlide', /event\.key !== 'Escape' \|\| pending/], ['genPanel', /e\.key === 'Escape' && \(!isGenerating/], ['slidePanel', /e\.key === 'Escape' && !isGenerating\) \{\s*e\.preventDefault\(\)\s*onClose\(\)/]],
  'divider-resize': [['builder', /event\.key !== 'ArrowLeft' && event\.key !== 'ArrowRight' && event\.key !== 'Home'\) return/]],
  'divider-reset': [['builder', /event\.key === 'Home' \? side === 'chat' \? 304 : DEFAULT_DRAWER_WIDTH/], ['builder', /onDoubleClick=\{\(\) => persistStudioPaneWidth\(side, side === 'chat' \? 304 : DEFAULT_DRAWER_WIDTH\)\}/]],
}
const EXPECTED_GROUPS = [
  ['chat', 'Chat', [['send', 'Send a message', 'Enter'], ['newline', 'New line in the message box', 'Shift + Enter'], ['stop', 'Stop waiting for a reply or cancel an action', 'Esc']]],
  ['presentation', 'Presentation', [['next', 'Next slide', '→ / ↓'], ['previous', 'Previous slide', '← / ↑'], ['edit', 'Edit mode', 'E'], ['grid', 'Alignment grid', 'G'], ['borders', 'Element borders', 'B'], ['strip', 'Show or hide the slide strip', 'Esc'], ['save', 'Save now (in edit mode)', '⌘ / Ctrl + S']]],
  ['strip', 'Slide strip', [['strip-delete', 'Delete the selected slides', 'Delete / Backspace'], ['strip-all', 'Select all slides', '⌘ / Ctrl + A'], ['strip-clear', 'Clear the selection', 'Esc']]],
  ['panels', 'Panels', [['panel-generate', 'Generate', '⌘ / Ctrl + Enter'], ['panel-close', 'Close the panel', 'Esc'], ['divider-resize', 'Resize a side panel (divider selected)', '← / →'], ['divider-reset', "Reset a side panel's width", 'Home / Double-click divider']]],
]
function proveShortcutsLib(source, label = 'shortcuts lib', handlers = HANDLER_SOURCES) {
  nomatch(source, /^\s*(?:import\b|export\s+\*?\s*from\b)|require\(/m, `${label}: import-free`)
  const lib = load(source, SHORTCUTS_LIB)
  deepEq({ ...lib.STUDIO_SHORTCUTS_WORDS }, { title: 'Keyboard shortcuts', lede: 'Shortcuts that keep you in the flow.' }, `${label}: the page words`)
  deepEq(lib.STUDIO_SHORTCUT_GROUPS.map(g => [g.id, g.label, g.shortcuts.map(s => [s.id, s.label, s.keys])]), EXPECTED_GROUPS, `${label}: the exact list`)
  const list = lib.studioShortcutList()
  deepEq(list.map(s => s.id), EXPECTED_GROUPS.flatMap(g => g[2].map(s => s[0])), `${label}: the flat list is the groups in order`)
  eq(new Set(list.map(s => s.id)).size, list.length, `${label}: ids are unique`)
  // every entry is pinned to the handler that reads its key; nothing is listed without one
  deepEq(Object.keys(EVIDENCE).sort(), list.map(s => s.id).sort(), `${label}: every listed shortcut has its handler pinned, and every pin is listed`)
  for (const [id, pins] of Object.entries(EVIDENCE)) for (const [key, pattern] of pins) match(handlers[key], pattern, `${label}: ${id} is handled in ${HANDLERS[key]}`)
  // what the old page listed and nothing handles
  for (const word of ['Ctrl + K', 'Cmd + K', 'Undo', 'Redo', 'Command palette', 'Toggle sidebar', 'Bold', 'Italic', 'Zoom', 'Fullscreen', 'F11', 'Print', 'Share', '?']) ok(!list.some(s => s.label.includes(word) || s.keys === word || s.keys.includes(`⌘ / Ctrl + ${word.replace(/^Ctrl \+ /, '')}`)), `${label}: no "${word}"`)
  ok(!list.some(s => /\\|\//.test(s.keys.replace(/ \/ /g, '')) && /⌘ \/ Ctrl \+ [\\/KBZY]$/.test(s.keys)), `${label}: no Ctrl+K, Ctrl+B, Ctrl+Z, Ctrl+Y, Ctrl+\\ or Ctrl+/`)
  ok(list.every(s => s.keys.trim() === s.keys && s.keys !== '' && s.label.trim() === s.label && s.label !== ''), `${label}: no empty or padded words`)
  eq(list.find(s => s.id === 'borders').keys, 'B', `${label}: the mockup's M is B here (that is the key with a handler)`)
  return lib
}

// ---------------------------------------------------------------- 3. the components
function proveCapacity(source, label = 'capacity') {
  const billingLib = load(SOURCES[BILLING_LIB], BILLING_LIB)
  const { StudioBillingCapacity } = load(source, CAPACITY, { deps: { '@/lib/studio-billing': billingLib } })
  const find = (tree, marker) => nodes(tree).filter(x => x.props?.[marker] !== undefined)
  const first = (tree, marker, what) => { const [found] = find(tree, marker); ok(found, `${label}: ${what} exists`); return found }
  const inFlight = StudioBillingCapacity({ quota: undefined })
  eq(inFlight.props['data-studio-billing-capacity'], 'true', `${label}: capacity marker`)
  eq(inFlight.props.role, 'group', `${label}: a group`)
  eq(inFlight.props['aria-label'], 'Creative capacity', `${label}: named`)
  const head = first(inFlight, 'data-studio-billing-capacity-head', 'the head')
  deepEq(nodes(head).filter(x => x.type === 'span').map(x => text(x)), ['Creative capacity', '…'], `${label}: in flight: title and an ellipsis`)
  eq(find(inFlight, 'data-studio-billing-meter').length, 0, `${label}: in flight: no meter`)
  const failed = StudioBillingCapacity({ quota: null })
  deepEq(nodes(first(failed, 'data-studio-billing-capacity-head', 'the head')).filter(x => x.type === 'span').map(x => text(x)), ['Creative capacity', 'Not available right now'], `${label}: failed: says so`)
  eq(find(failed, 'data-studio-billing-meter').length, 0, `${label}: failed: no meter`)
  const empty = StudioBillingCapacity({ quota: { remainingPct: { daily: 'x' } } })
  deepEq(nodes(first(empty, 'data-studio-billing-capacity-head', 'the head')).filter(x => x.type === 'span').map(x => text(x)), ['Creative capacity', 'Not available right now'], `${label}: a read with no readable share is "not available"`)
  const quota = { remainingPct: { daily: .37, weekly: .82 }, resetAt: { daily: new Date(Date.now() + 5.5 * 3_600_000).toISOString(), weekly: new Date(Date.now() + 200 * 3_600_000).toISOString() } }
  const tree = StudioBillingCapacity({ quota })
  deepEq(nodes(first(tree, 'data-studio-billing-capacity-head', 'the head')).filter(x => x.type === 'span').map(x => text(x)), ['Creative capacity'], `${label}: with meters the head is just the title`)
  const meters = find(tree, 'data-studio-billing-meter')
  deepEq(meters.map(x => x.props['data-studio-billing-meter']), ['daily', 'weekly'], `${label}: daily then weekly`)
  const want = [['Daily', '37% left', 37, 'Resets in 5h'], ['Weekly', '82% left', 82, null]]
  meters.forEach((meter, index) => {
    const [name, share, percent, reset] = want[index]
    const meterHead = first(meter, 'data-studio-billing-meter-head', `${name} head`)
    deepEq([].concat(meterHead.props.children).map(x => text(x)), [name, share], `${label}: ${name} head`)
    const bar = first(meter, 'data-studio-billing-meter-bar', `${name} bar`)
    eq(bar.props.role, 'progressbar', `${label}: ${name} bar is a progressbar`)
    eq(bar.props['aria-valuemin'], 0, `${label}: ${name} min`); eq(bar.props['aria-valuemax'], 100, `${label}: ${name} max`); eq(bar.props['aria-valuenow'], percent, `${label}: ${name} now`)
    eq(bar.props['aria-label'], `${name} usage left`, `${label}: ${name} bar name`)
    const fill = nodes(bar).find(x => x.type === 'i'); ok(fill, `${label}: ${name} fill exists`)
    eq(fill.props.style.width, `${percent}%`, `${label}: ${name} fill is the share left`)
    const small = nodes(meter).find(x => x.type === 'small'); ok(small, `${label}: ${name} reset caption exists`)
    if (reset) eq(text(small), reset, `${label}: ${name} reset text`); else match(text(small), /^Resets /, `${label}: ${name} reset text starts with Resets`)
  })
  const noReset = StudioBillingCapacity({ quota: { remainingPct: { daily: 0, weekly: 1 } } })
  eq(nodes(noReset).filter(x => x.type === 'small').length, 0, `${label}: no reset time, no caption`)
  eq(nodes(find(noReset, 'data-studio-billing-meter')[0]).find(x => x.type === 'i').props.style.width, '0%', `${label}: 0 percent left is an empty meter`)
  ok(!/\bfetch\b|useEffect|useState/.test(source), `${label}: no state and no network`)
}
function proveShortcutsUi(source, lib, label = 'shortcuts ui') {
  const { StudioShortcutsPage } = load(source, SHORTCUTS_UI, { deps: { '@/lib/studio-shortcuts': lib } })
  const tree = StudioShortcutsPage()
  eq(tree.type, 'main', `${label}: main`)
  eq(tree.props['data-studio-p2-shortcuts'], 'true', `${label}: page marker`)
  const heading = nodes(tree).find(x => x.props?.['data-studio-p2-shortcuts-heading'])
  ok(heading && heading.type === 'header', `${label}: heading block`)
  eq(text(nodes(heading).find(x => x.type === 'h1')), 'Keyboard shortcuts', `${label}: the page names itself`)
  eq(text(nodes(heading).find(x => x.type === 'p')), 'Shortcuts that keep you in the flow.', `${label}: lede`)
  const sections = nodes(tree).filter(x => x.type === 'section')
  deepEq(sections.map(x => x.props['data-studio-p2-shortcuts-group']), EXPECTED_GROUPS.map(g => g[0]), `${label}: the groups in order`)
  sections.forEach((section, index) => {
    const [id, name, rows] = EXPECTED_GROUPS[index]
    const h2 = nodes(section).find(x => x.type === 'h2')
    eq(h2.props.id, `studio-p2-shortcuts-${id}`, `${label}: ${id} heading id`)
    eq(section.props['aria-labelledby'], h2.props.id, `${label}: ${id} is named by its heading`)
    eq(text(h2), name, `${label}: ${id} heading`)
    ok(nodes(section).some(x => x.type === 'ul'), `${label}: ${id} is a list`)
    const items = nodes(section).filter(x => x.type === 'li')
    deepEq(items.map(x => x.props['data-studio-p2-shortcut']), rows.map(r => r[0]), `${label}: ${id} rows`)
    items.forEach((item, i) => {
      deepEq([nodes(item).find(x => x.type === 'span'), nodes(item).find(x => x.type === 'kbd')].map(x => text(x)), [rows[i][1], rows[i][2]], `${label}: ${rows[i][0]} label and key chip`)
    })
  })
  eq(nodes(tree).filter(x => x.type === 'kbd').length, lib.studioShortcutList().length, `${label}: one chip per shortcut`)
  ok(!/\buse(State|Effect|Auth|Router)\b|fetch\(/.test(source), `${label}: static: no state, no network, no sign-in read`)
  match(source, /^import "\.\/studio-p2-shortcuts\.css"$/m, `${label}: imports its stylesheet`)
}

// ---------------------------------------------------------------- 4. the wiring, executed against the base commit
const requestsOf = calls => calls.filter(c => c[0] === 'fetch').map(c => c.slice(1))
const QUOTA_BODY = { tierLabel: 'Supplied', remainingPct: { daily: .37, weekly: .82, monthly: .5 }, resetAt: { daily: '2099-01-01T05:00:00Z', weekly: '2099-01-08T00:00:00Z' }, flags: {}, caps: {}, spent: {} }
const SUBSCRIPTION = (tier, billingCycle) => ({ status: 'active', tier, billingCycle, currentPeriodEnd: '2099-06-01T00:00:00Z', cancelAtPeriodEnd: false })
const FIXTURES = [
  ['free', { tier: 'free' }, null], ['starter', { tier: 'starter' }, null], ['pro monthly', { tier: 'pro' }, SUBSCRIPTION('pro', 'monthly')], ['pro yearly', { tier: 'pro' }, SUBSCRIPTION('pro', 'yearly')],
  ['pro, no subscription', { tier: 'pro' }, null], ['premium', { tier: 'premium' }, null], ['enterprise yearly', { tier: 'enterprise' }, SUBSCRIPTION('pro', 'yearly')], ['free with a subscription', { tier: 'free' }, SUBSCRIPTION('pro', 'monthly')],
]
function billingHarness({ code, env, user, subscription, coupon = false, pricing = pricingModule, quotaReply = async () => ({ ok: true, json: async () => QUOTA_BODY }) }) {
  const react = makeReact(), calls = []
  const account = { id: 'owned', name: 'Ada Morgan', email: 'owned@example.invalid', ...user }
  const deps = {
    react: react.api, '@/hooks/use-auth': { useAuth: () => ({ user: account, isLoading: false }) },
    '@/hooks/use-subscription': { useSubscription: () => ({ subscription, isLoading: false, isActive: subscription?.status === 'active', isPro: subscription?.tier === 'pro' }) },
    '@/hooks/use-wallet': { useWallet: () => ({ isLoading: false, balanceCents: 1234, transactions: [] }) }, '@/lib/config': { features: { couponAuthEnabled: coupon } },
    'next/navigation': { useRouter: () => ({ push: p => calls.push(['push', p]) }), useSearchParams: () => ({ get: () => null }) },
    '@/lib/marketing/homepage-v2-pricing': pricing, '@/lib/studio-billing': load(SOURCES[BILLING_LIB], BILLING_LIB),
  }
  const mod = load(code, BILLING_PAGE, { deps, env, globals: { fetch: async (url, options) => { calls.push(['fetch', url, options]); return url === '/api/usage/quota' ? quotaReply() : url === '/api/account/usage' ? { ok: true, json: async () => ({ presentationCount: 2, storageBytes: 2048 }) } : { ok: true, json: async () => ({ invoices: [] }) } } } })
  const content = mod.default().props.children
  const h = {
    calls, mod,
    render() { react.reset(); return content.type(content.props) },
    async flush() { react.flushEffects(); for (let i = 0; i < 40; i++) await Promise.resolve() },
    start() { react.flushEffects() }, unmount() { react.unmount() }, async settle() { for (let i = 0; i < 40; i++) await Promise.resolve() },
  }
  return h
}
const SHELL_ON = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', [FLAG]: 'true' }
async function proveBilling(code, label = 'billing') {
  const prior = baseSource(BILLING_PAGE)
  match(code, /import \{ StudioBillingCapacity \} from "@\/components\/billing\/studio-billing-capacity"/, `${label}: imports the capacity row`)
  match(code, /import "@\/components\/settings\/studio-p2-account\.css"/, `${label}: imports the account stylesheet`)
  match(code, /import \{ PRICING_TIERS \} from "@\/lib\/marketing\/homepage-v2-pricing"/, `${label}: reads the shared plan list`)
  // flag off / shell off / anything but the exact words: the base commit's page, same tree, same requests
  const notOn = [{ NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', [FLAG]: 'false' }, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', [FLAG]: 'TRUE' }, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', [FLAG]: '1' }, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', [FLAG]: ' true' },
    { [FLAG]: 'true' }, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'false', [FLAG]: 'true' }, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'TRUE', [FLAG]: 'true' }, {}]
  for (const env of notOn) {
    for (const [name, user, subscription] of FIXTURES.filter(([n]) => ['free', 'pro monthly', 'premium', 'enterprise yearly'].includes(n))) {
      const tag = `${label}: env ${JSON.stringify(env)} ${name}`
      const h = billingHarness({ code, env, user, subscription, coupon: name === 'premium' }), old = billingHarness({ code: prior, env, user, subscription, coupon: name === 'premium' })
      eq(rendered(expand(h.render())), rendered(expand(old.render())), `${tag}: tree equals the base commit's`)
      await h.flush(); await old.flush()
      eq(rendered(expand(h.render())), rendered(expand(old.render())), `${tag}: tree equals the base commit's after the reads`)
      eq(JSON.stringify(requestsOf(h.calls)), JSON.stringify(requestsOf(old.calls)), `${tag}: same requests`)
      ok(!requestsOf(h.calls).some(c => c[0] === '/api/usage/quota'), `${tag}: no quota read`)
    }
  }
  // on: the words
  const on = (name, extra = {}) => { const [, user, subscription] = FIXTURES.find(f => f[0] === name); return billingHarness({ code, env: SHELL_ON, user, subscription, ...extra }) }
  const flat = tree => text(expand(tree))
  const rows = {}
  for (const [name] of FIXTURES) rows[name] = flat(on(name).render())
  const mainOf = tree => expand(tree)
  eq(mainOf(on('pro monthly').render()).props['data-studio-p2-account'], 'true', `${label}: on: the page carries the account marker`)
  eq(mainOf(billingHarness({ code, env: { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }, user: { tier: 'pro' }, subscription: null }).render()).props['data-studio-p2-account'], undefined, `${label}: off: no marker`)
  for (const name of Object.keys(rows)) for (const stale of ['$29', '$290', 'Enterprise', '4 AI agents', 'Planned', 'AI Agent Interactions', 'Upgrade to Pro']) {
    if (name === 'free' || name === 'free with a subscription') { if (stale !== 'Upgrade to Pro' && stale !== '4 AI agents') nomatch(rows[name], new RegExp(stale.replace(/[$]/g, '\\$')), `${label}: on: ${name} has no "${stale}"`); continue }
    if (name === 'enterprise yearly') { if (stale === '$29' || stale === '$290' || stale === 'Planned' || stale === 'AI Agent Interactions') nomatch(rows[name], new RegExp(stale.replace(/[$]/g, '\\$')), `${label}: on: ${name} has no "${stale}"`); continue }
    nomatch(rows[name], new RegExp(stale.replace(/[$]/g, '\\$')), `${label}: on: ${name} has no "${stale}"`)
  }
  match(rows.starter, /Starter Plan/, `${label}: on: Starter's own title`); match(rows.starter, /\$20 per user \/ mo/, `${label}: on: Starter's price`)
  match(rows.starter, /Director, Content Generator, Visualizer, Slide Composer, Theme Builder/, `${label}: on: Starter's own list`); nomatch(rows.starter, /3 presentations|upgrade to Pro|Custom branding/, `${label}: on: Starter is not the free list`)
  match(rows['pro monthly'], /Pro Plan/, `${label}: on: Pro title`); match(rows['pro monthly'], /\$50 per user \/ mo/, `${label}: on: Pro price`); nomatch(rows['pro monthly'], /Billed yearly|\$29/, `${label}: on: Pro monthly is not "Billed yearly"`)
  match(rows['pro monthly'], /Everything in Starter, plus: Researcher: pull live data from the open web Upload your own files as source material Analyst: finds the story in your numbers Higher monthly credit allowance/, `${label}: on: Pro's own list`)
  match(rows['pro monthly'], /Upgrade to Max/, `${label}: on: Pro's upgrade is the next plan, Max`)
  match(rows['pro yearly'], /\$50 per user \/ mo · Billed yearly/, `${label}: on: Pro yearly adds Billed yearly`)
  match(rows['pro, no subscription'], /Pro Plan \$50 per user \/ mo/, `${label}: on: Pro without a subscription still has its price`)
  match(rows.premium, /Max Plan/, `${label}: on: Max title`); match(rows.premium, /\$100 per user \/ mo/, `${label}: on: Max price`); match(rows.premium, /Knowledge Graph: agents learn your domain across decks Priority generation queue Highest monthly credit allowance/, `${label}: on: Max's own list`)
  match(rows.free, /Free Plan No charge/, `${label}: on: free keeps its title and "No charge"`); match(rows.free, /3 presentations 2 AI agents/, `${label}: on: free keeps its list`)
  match(rows['enterprise yearly'], /Enterprise Plan Billed yearly/, `${label}: on: a tier no plan carries: its own title and "Billed yearly"`)
  match(rows['free with a subscription'], /Free Plan Billed monthly/, `${label}: on: no plan for the tier, a monthly subscription: "Billed monthly"`)
  // lead lines have no check; the others do
  const proTree = expand(on('pro monthly').render())
  const lead = nodes(proTree).filter(x => x.props?.['data-studio-billing-feature-lead'] === 'true')
  deepEq(lead.map(x => text(x)), ['Everything in Starter, plus:'], `${label}: on: the lead line is plain text`)
  eq(nodes(proTree).filter(x => x.props?.className?.includes?.('text-green-600') && x.type === 'Check').length, 4, `${label}: on: four feature lines carry a check`)
  // upgrade button is the next plan's name and still goes to /pricing
  const upgrade = nodes(on('pro monthly').render()).filter(x => x.type === 'Button' && text(x) === 'Upgrade to Max')
  eq(upgrade.length, 1, `${label}: on: one "Upgrade to Max" button`)
  const h = on('pro monthly'); h.render(); nodes(h.render()).find(x => x.type === 'Button' && text(x) === 'Upgrade to Max').props.onClick()
  deepEq(h.calls.filter(c => c[0] === 'push'), [['push', '/pricing']], `${label}: on: the upgrade goes to /pricing as before`)
  eq(nodes(on('premium').render()).filter(x => x.type === 'Button' && /Upgrade to/.test(text(x))).length, 0, `${label}: on: no upgrade button for the last plan`)
  // it reads the SHARED list: change the list and the page changes with it (names, prices, features, next plan); a list without a next plan has no upgrade button
  const custom = PLANS.map(p => ({ ...p, name: { starter: 'Launch', pro: 'Plus', premium: 'Scale' }[p.id], price: { starter: '$15', pro: '$55', premium: '$120' }[p.id], features: [`Own ${p.id} line`] }))
  const viaList = (plans, name) => { const [, user, subscription] = FIXTURES.find(f => f[0] === name); return billingHarness({ code, env: SHELL_ON, user, subscription, pricing: { PRICING_TIERS: plans } }) }
  const customPro = flat(viaList(custom, 'pro monthly').render())
  match(customPro, /Plus Plan \$55 per user \/ mo/, `${label}: on: the title and price come from the list it is given`); match(customPro, /Own pro line/, `${label}: on: the included lines come from the list it is given`); match(customPro, /Upgrade to Scale/, `${label}: on: the upgrade names the list's next plan`)
  nomatch(customPro, /Pro Plan|\$50|Researcher|Upgrade to Max/, `${label}: on: nothing of the real list is left when the list changes`)
  match(flat(viaList(custom, 'starter').render()), /Launch Plan \$15 per user \/ mo.*Own starter line/, `${label}: on: Starter from the list it is given`)
  match(flat(viaList(custom, 'pro yearly').render()), /Plus Plan \$55 per user \/ mo · Billed yearly/, `${label}: on: the yearly note on the list's price`)
  eq(nodes(viaList(PLANS.slice(0, 2), 'pro monthly').render()).filter(x => x.type === 'Button' && /Upgrade to/.test(text(x))).length, 0, `${label}: on: a list with no plan after Pro: no upgrade button`)
  match(flat(viaList(PLANS.filter(p => p.id !== 'pro'), 'pro monthly').render()), /Pro Plan Billed monthly/, `${label}: on: a tier the list does not carry falls back to the billing cycle`)
  // the capacity row replaces the Planned row, with the real read
  const gone = on('pro monthly'); gone.render(); gone.start(); gone.unmount(); await gone.settle()
  eq(nodes(gone.render()).find(x => x.type === 'StudioBillingCapacity').props.quota, undefined, `${label}: on: a read that finishes after the page is gone changes nothing`)
  const cap = on('pro monthly')
  const capNodes = () => nodes(cap.render()).filter(x => x.type === 'StudioBillingCapacity')
  eq(capNodes().length, 1, `${label}: on: the capacity row is rendered once`)
  eq(capNodes()[0].props.quota, undefined, `${label}: on: in flight: quota undefined`)
  await cap.flush()
  deepEq(requestsOf(cap.calls).map(c => c[0]), ['/api/account/usage', '/api/usage/quota', '/api/billing/invoices'], `${label}: on: one extra read, of /api/usage/quota`)
  eq(requestsOf(cap.calls).find(c => c[0] === '/api/usage/quota')[1], undefined, `${label}: on: a plain GET`)
  deepEq(capNodes()[0].props.quota, QUOTA_BODY, `${label}: on: the capacity row gets the real read`)
  const bad = on('pro monthly', { quotaReply: async () => ({ ok: false, json: async () => ({}) }) }); bad.render(); await bad.flush()
  eq(nodes(bad.render()).find(x => x.type === 'StudioBillingCapacity').props.quota, null, `${label}: on: a failed read is null`)
  const rejected = on('pro monthly', { quotaReply: async () => { throw new Error('offline') } }); rejected.render(); await rejected.flush()
  eq(nodes(rejected.render()).find(x => x.type === 'StudioBillingCapacity').props.quota, null, `${label}: on: a rejected read is null`)
  const free = on('free'); free.render(); await free.flush()
  deepEq(requestsOf(free.calls).map(c => c[0]), ['/api/account/usage', '/api/usage/quota'], `${label}: on: a free account reads usage and quota (no invoices)`)
  match(code, /fetch\("\/api\/usage\/quota"\)/, `${label}: the quota read is a plain GET (no options, never a write)`)
  match(code, /const STUDIO_P2_ACCOUNT = process\.env\.NEXT_PUBLIC_STUDIO_V4_SHELL === "true" && process\.env\.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true"/, `${label}: flag read inline (Next inlines NEXT_PUBLIC at build), exact true, only with the Studio shell`)
}
async function proveProfile(code, label = 'profile') {
  const prior = baseSource(PROFILE_PAGE)
  match(code, /import "@\/components\/settings\/studio-p2-account\.css"/, `${label}: imports the account stylesheet`)
  const run = (source, env) => {
    const react = makeReact()
    const deps = { react: react.api, '@/hooks/use-auth': { useAuth: () => ({ user: { id: 'owned', name: 'Ada Morgan', email: 'owned@example.invalid', tier: 'pro', image: null }, isLoading: false }) }, 'next-auth/react': { useSession: () => ({ update: async () => undefined }) } }
    const mod = load(source, PROFILE_PAGE, { deps, env, globals: { fetch: async () => ({ ok: true, json: async () => ({}) }) } })
    return expand(mod.default())
  }
  const card = tree => nodes(tree).find(x => x.type === 'Card')
  for (const env of [{ NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', [FLAG]: 'false' }, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', [FLAG]: 'TRUE' }, { [FLAG]: 'true' }, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'false', [FLAG]: 'true' }, {}]) {
    eq(rendered(run(code, env)), rendered(run(prior, env)), `${label}: env ${JSON.stringify(env)}: tree equals the base commit's`)
  }
  eq(card(run(code, SHELL_ON)).props['data-studio-p2-account'], 'true', `${label}: on: the card carries the account marker`)
  eq(card(run(code, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' })).props['data-studio-p2-account'], undefined, `${label}: off: no marker`)
  // on = base + the marker, nothing else
  const strip = tree => rendered(tree).replace(',"data-studio-p2-account":"true"', '')
  eq(strip(run(code, SHELL_ON)), rendered(run(prior, SHELL_ON)), `${label}: on: the tree is the base commit's plus the marker`)
  match(code, /<Button data-studio-settings-profile-save=\{STUDIO_SHELL \? "true" : undefined\} size="sm" onClick=\{handleSave\}/, `${label}: the Save button (shown while editing) keeps its own marker, the one the ink rule hangs on`)
  match(code, /import "@\/components\/settings\/studio-p2-account\.css"/, `${label}: imports the account stylesheet`)
  match(code, /const STUDIO_P2_ACCOUNT = STUDIO_SHELL && process\.env\.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true"/, `${label}: flag read inline, exact true, only with the Studio shell`)
}
async function proveShortcutsPage(code, label = 'shortcuts page') {
  const prior = baseSource(SHORTCUTS_PAGE)
  match(code, /import \{ StudioShortcutsPage \} from "@\/components\/settings\/studio-p2-shortcuts"/, `${label}: imports the new page`)
  const run = (source, env) => {
    const react = makeReact()
    const deps = { react: react.api, '@/hooks/use-auth': { useAuth: () => ({ user: { id: 'owned' }, isLoading: false }) }, 'next/navigation': { useRouter: () => ({ push: () => undefined }) } }
    const mod = load(source, SHORTCUTS_PAGE, { deps, env })
    return mod.default()
  }
  for (const env of [{ NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', [FLAG]: 'false' }, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', [FLAG]: 'TRUE' }, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', [FLAG]: '1' }, { [FLAG]: 'true' }, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'false', [FLAG]: 'true' }, {}]) {
    eq(rendered(expand(run(code, env))), rendered(expand(run(prior, env))), `${label}: env ${JSON.stringify(env)}: the old page, same tree as the base commit's`)
  }
  const on = run(code, SHELL_ON)
  eq(on.type, 'StudioShortcutsPage', `${label}: on: the new page`)
  eq(Object.keys(on.props).length, 0, `${label}: on: no props`)
  match(code, /import \{ StudioShortcutsPage \} from "@\/components\/settings\/studio-p2-shortcuts"/, `${label}: imports the new page`)
  match(code, /const STUDIO_P2_SHORTCUTS = process\.env\.NEXT_PUBLIC_STUDIO_V4_SHELL === "true" && process\.env\.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true"/, `${label}: flag read inline, exact true, only with the Studio shell`)
  const legacyBody = code.slice(code.indexOf('function LegacyShortcutsPage()'))
  eq(legacyBody, prior.slice(prior.indexOf('export default function ShortcutsPage()')).replace('export default function ShortcutsPage()', 'function LegacyShortcutsPage()'), `${label}: the old page's code is untouched (renamed only)`)
}
function landingTexts(tree) {
  return nodes(tree).filter(x => x.props?.className === 'tier' || x.props?.className === 'tier tier--hi').map(x => text(x))
}
async function proveLanding(homeCode, pageCode, label = 'landing') {
  const billingLib = load(SOURCES[BILLING_LIB], BILLING_LIB)
  const runHome = (source, env) => load(source, PRICING_HOME, { deps: { '@/lib/marketing/homepage-v2-pricing': pricingModule, '@/lib/studio-billing': billingLib }, env }).Pricing({ copy: LANDING.pricingHome })
  const runPage = (source, env) => load(source, PRICING_PAGE, { deps: { '@/lib/marketing/v3-content': { V3_CONTENT: LANDING }, '@/lib/marketing/homepage-v2-pricing': pricingModule, '@/lib/studio-billing': billingLib }, env }).default()
  for (const env of [{}, { [FLAG]: 'false' }, { [FLAG]: 'TRUE' }, { [FLAG]: '1' }, { [FLAG]: ' true' }, { [FLAG]: 'true ' }]) {
    eq(rendered(runHome(homeCode, env)), rendered(runHome(baseSource(PRICING_HOME), env)), `${label}: home, env ${JSON.stringify(env)}: the base commit's section`)
    eq(rendered(runPage(pageCode, env)), rendered(runPage(baseSource(PRICING_PAGE), env)), `${label}: /pricing, env ${JSON.stringify(env)}: the base commit's page`)
  }
  // on: the shared list's words; Landing needs the flag only (no shell)
  for (const env of [{ [FLAG]: 'true' }, SHELL_ON, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'false', [FLAG]: 'true' }]) {
    const home = landingTexts(runHome(homeCode, env)), page = landingTexts(runPage(pageCode, env))
    for (const [name, tiers] of [['home', home], ['/pricing', page]]) {
      eq(tiers.length, 3, `${label}: ${name} on: three tiers`)
      PLANS.forEach((plan, index) => {
        const words = [plan.name, plan.price, plan.priceSuffix, plan.blurb, ...plan.features, plan.usageNote].join(' ')
        ok(tiers[index].includes(words), `${label}: ${name} on: ${plan.id} shows the shared list's name, price, suffix, blurb, features and note: ${JSON.stringify(env)}`)
      })
    }
    match(home[1], /Most popular/, `${label}: home on: Landing's own tag stays`); match(page[1], /Most popular/, `${label}: /pricing on: Landing's own tag stays`)
    ok(home.every(t => /Get started/.test(t)) && page.every(t => /Get started/.test(t)), `${label}: on: Landing's own button label stays`)
  }
  // Landing's own copy already agrees with the list on the plan's name, price and suffix (so flag off and flag on never disagree on money)
  for (const [name, tiers] of [['home', LANDING.pricingHome.tiers], ['/pricing', LANDING.pages.pricing.start.tiers]]) {
    deepEq(tiers.map(t => [t.name, t.price, t.suffix]), PLANS.map(p => [p.name, p.price, p.priceSuffix]), `${label}: Landing's ${name} copy and the list agree on name, price and suffix`)
  }
  match(homeCode, /const STUDIO_P2_ACCOUNT = process\.env\.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true"/, `${label}: home flag read inline, exact true`)
  match(pageCode, /const STUDIO_P2_ACCOUNT = process\.env\.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true"/, `${label}: /pricing flag read inline, exact true`)
}

// ---------------------------------------------------------------- 5. the CSS
const rulesOf = css => { const rules = []; postcss.parse(css).walkRules(rule => rules.push(rule)); return rules }
const declsOf = (rules, selector, label) => { const rule = rules.find(r => r.selectors.includes(selector)); ok(rule, `${label}: rule ${selector}`); return Object.fromEntries(rule.nodes.filter(n => n.type === 'decl').map(n => [n.prop, n.value])) }
const tokenCss = css => { const tokens = new Set(); postcss.parse(css).walkDecls(d => { for (const m of d.value.matchAll(/var\((--[\w-]+)/g)) tokens.add(m[1]) }); return tokens }
function proveShellTokens(css, label) {
  const rules = rulesOf(read(SHELL_CSS))
  const light = rules.find(r => r.selectors.includes('[data-studio-v4-shell="true"]')), dark = rules.find(r => r.selectors.includes('.dark [data-studio-v4-shell="true"]'))
  const defined = rule => new Set(rule.nodes.filter(n => n.type === 'decl').map(n => n.prop))
  for (const token of tokenCss(css)) { ok(defined(light).has(token), `${label}: ${token} exists in the shell's light set`); ok(defined(dark).has(token), `${label}: ${token} exists in the shell's dark set (dark mode is readable)`) }
}
const ACC = '[data-studio-v4-shell="true"] [data-studio-p2-account="true"]'
function proveAccountCss(css, label = 'account css') {
  const rules = rulesOf(css)
  ok(rules.length >= 13, `${label}: has its rules`)
  for (const rule of rules) for (const selector of rule.selectors) ok(selector.startsWith(`${ACC} `), `${label}: scoped to the account marker under the shell: ${selector}`)
  postcss.parse(css).walkDecls(decl => nomatch(decl.value, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, `${label}: tokens only in ${decl.prop}`))
  const save = declsOf(rules, `${ACC} [data-studio-settings-profile-save]`, label)
  eq(save.background, 'var(--ss-action)', `${label}: Save is the ink action`); eq(save.color, 'var(--ss-on-action)', `${label}: Save text on the action`)
  eq(declsOf(rules, `${ACC} [data-studio-settings-profile-save]:hover:not(:disabled)`, label).background, 'var(--ss-action-hover)', `${label}: Save hover`)
  for (const selector of [`${ACC} :is([data-studio-billing-plan-summary], [data-studio-billing-upgrade]) button`]) {
    const d = declsOf(rules, selector, label); eq(d.background, 'var(--ss-action)', `${label}: plan buttons are the ink action`); eq(d.color, 'var(--ss-on-action)', `${label}: plan button text`)
    eq(declsOf(rules, `${selector}:hover:not(:disabled)`, label).background, 'var(--ss-action-hover)', `${label}: plan button hover`)
  }
  ok(!/--ss-accent/.test(css), `${label}: no violet accent here (violet is for AI and generation)`)
  const bar = declsOf(rules, `${ACC} [data-studio-billing-meter-bar="true"]`, label)
  eq(bar.height, '4px', `${label}: thin meter`); eq(bar['border-radius'], '5px', `${label}: meter radius`); eq(bar.background, 'var(--ss-line)', `${label}: meter track`); eq(bar.overflow, 'hidden', `${label}: the fill is clipped`)
  const fill = declsOf(rules, `${ACC} [data-studio-billing-meter-bar="true"] > i`, label)
  eq(fill.background, 'var(--ss-teal)', `${label}: meter fill`); eq(fill.height, '100%', `${label}: fill height`); eq(fill.display, 'block', `${label}: fill block`)
  const head = declsOf(rules, `${ACC} [data-studio-billing-meter-head="true"]`, label); eq(head.display, 'flex', `${label}: head is a row`); eq(head['justify-content'], 'space-between', `${label}: label left, share right`)
  eq(declsOf(rules, `${ACC} [data-studio-billing-meter] > small`, label).color, 'var(--ss-muted)', `${label}: reset text is muted`)
  eq(declsOf(rules, `${ACC} [data-studio-billing-capacity-head="true"]`, label).display, 'flex', `${label}: capacity head is a row`)
  proveShellTokens(css, label)
}
const SCUT = '[data-studio-v4-shell="true"] [data-studio-p2-shortcuts="true"]'
function proveShortcutsCss(css, label = 'shortcuts css') {
  const rules = rulesOf(css)
  ok(rules.length >= 10, `${label}: has its rules`)
  for (const rule of rules) for (const selector of rule.selectors) ok(selector.startsWith(SCUT) || selector.startsWith(`[data-studio-v4-shell="true"] [data-studio-p2-shortcuts-heading="true"]`), `${label}: scoped to the page marker under the shell: ${selector}`)
  postcss.parse(css).walkDecls(decl => nomatch(decl.value, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, `${label}: tokens only in ${decl.prop}`))
  const section = declsOf(rules, `${SCUT} section`, label); eq(section.border, '1px solid var(--ss-line)', `${label}: group card line`); eq(section.background, 'var(--ss-panel)', `${label}: group card surface`); eq(section['border-radius'], '12px', `${label}: group card radius`)
  const row = declsOf(rules, `${SCUT} li`, label); eq(row.display, 'flex', `${label}: row`); eq(row['justify-content'], 'space-between', `${label}: label left, chip right`); eq(row['border-top'], '1px solid var(--ss-line)', `${label}: thin line between rows`); eq(row.color, 'var(--ss-text)', `${label}: row text is the text token (readable in dark)`)
  eq(declsOf(rules, `${SCUT} li:first-child`, label)['border-top'], '0', `${label}: no line above the first row`)
  const chip = declsOf(rules, `${SCUT} kbd`, label); eq(chip.border, '1px solid var(--ss-line)', `${label}: chip line`); eq(chip.background, 'var(--ss-surface)', `${label}: chip surface`); eq(chip.color, 'var(--ss-text)', `${label}: chip text`); match(chip.font, /ui-monospace/, `${label}: mono chip`); eq(chip['white-space'], 'nowrap', `${label}: a chip does not wrap`)
  eq(declsOf(rules, `${SCUT} h2`, label)['text-transform'], 'uppercase', `${label}: group eyebrow`)
  ok(!/\bhover\b|:hover/.test(css), `${label}: no hover rows (the old near-white hover under light text is gone)`)
  proveShellTokens(css, label)
}

// ---------------------------------------------------------------- .env.example and package.json
function proveEnv(source, label = 'env') {
  match(source, new RegExp(`^${FLAG}="false"$`, 'm'), `${label}: documented, default off`)
  eq(source.split(`${FLAG}=`).length, 2, `${label}: once`)
}
function provePackage(source, label = 'package') {
  eq(JSON.parse(source).scripts['test:studio-p2-account'], 'node scripts/test-studio-p2-account.mjs', `${label}: the test is registered`)
}

// ---------------------------------------------------------------- run on the real sources
const billingLib = proveBillingLib(SOURCES[BILLING_LIB])
const shortcutsLib = proveShortcutsLib(SOURCES[SHORTCUTS_LIB])
proveCapacity(SOURCES[CAPACITY])
proveShortcutsUi(SOURCES[SHORTCUTS_UI], shortcutsLib)
await proveBilling(SOURCES[BILLING_PAGE])
await proveProfile(SOURCES[PROFILE_PAGE])
await proveShortcutsPage(SOURCES[SHORTCUTS_PAGE])
await proveLanding(SOURCES[PRICING_HOME], SOURCES[PRICING_PAGE])
proveAccountCss(SOURCES[CSS_ACCOUNT])
proveShortcutsCss(SOURCES[CSS_SHORTCUTS])
proveEnv(SOURCES[ENV])
provePackage(SOURCES[PKG])

// ---------------------------------------------------------------- 6. mutation check
const MUTANTS = []
const mutant = (file, name, from, to) => MUTANTS.push([file, name, from, to])
// lib: plans
mutant(BILLING_LIB, 'max is not premium', "tier === 'max' ? 'premium' : tier", 'tier')
mutant(BILLING_LIB, 'max is pro', "tier === 'max' ? 'premium' : tier", "tier === 'max' ? 'pro' : tier")
mutant(BILLING_LIB, 'tier matched loosely', "plans.find(plan => plan.id === id) ?? null", "plans.find(plan => String(id).startsWith(plan.id)) ?? null")
mutant(BILLING_LIB, 'free is a plan', "plans.find(plan => plan.id === id) ?? null", "plans.find(plan => plan.id === id) ?? (id === 'free' ? plans[0] : null)")
mutant(BILLING_LIB, 'price without suffix', 'plan.priceSuffix ? `${plan.price} ${plan.priceSuffix}` : `${plan.price}/month`', '`${plan.price}/month`')
mutant(BILLING_LIB, 'price suffix always', 'plan.priceSuffix ? `${plan.price} ${plan.priceSuffix}` : `${plan.price}/month`', '`${plan.price} ${plan.priceSuffix}`')
mutant(BILLING_LIB, 'price per year', '`${plan.price}/month`', '`${plan.price}/year`')
mutant(BILLING_LIB, 'yearly not said', "billingCycle === 'yearly' ? `${studioPlanPrice(plan)} · Billed yearly` : studioPlanPrice(plan)", 'studioPlanPrice(plan)')
mutant(BILLING_LIB, 'monthly said as yearly', "billingCycle === 'yearly' ? `${studioPlanPrice(plan)} · Billed yearly`", "billingCycle ? `${studioPlanPrice(plan)} · Billed yearly`")
mutant(BILLING_LIB, 'fallback yearly dropped', "if (billingCycle === 'yearly') return 'Billed yearly'", '')
mutant(BILLING_LIB, 'fallback monthly dropped', "if (billingCycle === 'monthly') return 'Billed monthly'", '')
mutant(BILLING_LIB, 'fallback any cycle is monthly', "if (billingCycle === 'monthly') return 'Billed monthly'", "if (billingCycle) return 'Billed monthly'")
mutant(BILLING_LIB, 'fallback word', "return 'Billed yearly'\n", "return 'Billed annually'\n")
mutant(BILLING_LIB, 'no charge word', "return 'No charge'", "return 'Free'")
mutant(BILLING_LIB, 'no plan, no cycle is the first plan', "return 'No charge'", 'return studioPlanPrice(plans[0])')
mutant(BILLING_LIB, 'lead needs no colon', "/:\\s*$/.test(text)", '/plus/.test(text)')
mutant(BILLING_LIB, 'lead anywhere', "/:\\s*$/.test(text)", '/:/.test(text)')
mutant(BILLING_LIB, 'lead nothing', "lead: /:\\s*$/.test(text)", 'lead: false')
mutant(BILLING_LIB, 'lines reordered', 'plan.features.map(text =>', '[...plan.features].reverse().map(text =>')
mutant(BILLING_LIB, 'next plan is the same', 'plans[index + 1]', 'plans[index]')
mutant(BILLING_LIB, 'next plan wraps', 'index < plans.length - 1 ? plans[index + 1] : null', 'plans[(index + 1) % plans.length]')
mutant(BILLING_LIB, 'next plan of nothing', 'if (!plan) return null\n  const index', 'const index')
mutant(BILLING_LIB, 'next plan of a stranger', 'index >= 0 && index < plans.length - 1', 'index < plans.length - 1')
// lib: landing
mutant(BILLING_LIB, 'landing always on', 'if (enabled !== true) return tiers', '')
mutant(BILLING_LIB, 'landing truthy', 'if (enabled !== true) return tiers', 'if (!enabled) return tiers')
mutant(BILLING_LIB, 'landing copy of the array', 'if (enabled !== true) return tiers', 'if (enabled !== true) return [...tiers]')
mutant(BILLING_LIB, 'landing name kept', 'const words = { name: plan.name,', 'const words = { name: undefined,')
mutant(BILLING_LIB, 'landing price kept', 'price: plan.price, blurb', 'price: undefined, blurb')
mutant(BILLING_LIB, 'landing features kept', 'features: plan.features, note', 'features: undefined, note')
mutant(BILLING_LIB, 'landing note from blurb', 'note: plan.usageNote }', 'note: plan.blurb }')
mutant(BILLING_LIB, 'landing suffix dropped', '{ ...tier, ...words, suffix: plan.priceSuffix }', '{ ...tier, ...words }')
mutant(BILLING_LIB, 'landing suffix cleared', ': { ...tier, ...words }) as T', ': { ...tier, ...words, suffix: undefined }) as T')
mutant(BILLING_LIB, 'landing cta overwritten', '{ ...tier, ...words,', '{ ...words,')
mutant(BILLING_LIB, 'landing unmatched replaced', 'if (!plan) return tier', 'if (!plan) return { ...tier }')
mutant(BILLING_LIB, 'landing mutates', 'return tiers.map(tier => {', 'return tiers.map(tier => { tier.name = "x";')
mutant(BILLING_LIB, 'an import added', 'export interface StudioPlan', "import { cn } from '@/lib/utils'\nexport interface StudioPlan")
// lib: meters
mutant(BILLING_LIB, 'meters: title', "title: 'Creative capacity'", "title: 'Usage'")
mutant(BILLING_LIB, 'meters: left word', "left: 'left'", "left: 'used'")
mutant(BILLING_LIB, 'meters: loading word', "loading: '…'", "loading: 'Loading'")
mutant(BILLING_LIB, 'meters: unavailable word', "unavailable: 'Not available right now'", "unavailable: 'Error'")
mutant(BILLING_LIB, 'percent not clamped high', 'Math.max(0, Math.min(1, share))', 'Math.max(0, share)')
mutant(BILLING_LIB, 'percent not clamped low', 'Math.max(0, Math.min(1, share))', 'Math.min(1, share)')
mutant(BILLING_LIB, 'percent floored', 'Math.round(Math.max(0', 'Math.floor(Math.max(0')
mutant(BILLING_LIB, 'percent as a fraction', 'Math.min(1, share)) * 100)', 'Math.min(1, share)) * 10)')
mutant(BILLING_LIB, 'percent takes NaN', "typeof share === 'number' && Number.isFinite(share)", "typeof share === 'number'")
mutant(BILLING_LIB, 'percent takes strings', "typeof share === 'number' && Number.isFinite(share)", 'Number.isFinite(Number(share))')
mutant(BILLING_LIB, 'reset: equal time is not now', 'if (ms <= 0)', 'if (ms < 0)')
mutant(BILLING_LIB, 'reset: past is not now', "return 'Resets now'", "return ''")
mutant(BILLING_LIB, 'reset: hours rounded up', 'Math.floor(ms / HOUR_MS)', 'Math.ceil(ms / HOUR_MS)')
mutant(BILLING_LIB, 'reset: hour unit', 'const HOUR_MS = 3_600_000', 'const HOUR_MS = 60_000')
mutant(BILLING_LIB, 'reset: under an hour', 'if (hours < 1)', 'if (hours < 2)')
mutant(BILLING_LIB, 'reset: under an hour word', "'Resets in under 1h'", "'Resets soon'")
mutant(BILLING_LIB, 'reset: a day is hours', 'hours < 24 ?', 'hours <= 24 ?')
mutant(BILLING_LIB, 'reset: two days are hours', 'hours < 24 ?', 'hours < 48 ?')
mutant(BILLING_LIB, 'reset: hours word', '`Resets in ${hours}h`', '`In ${hours}h`')
mutant(BILLING_LIB, 'reset: date word', '`Resets ${formatDate(at)}`', '`${formatDate(at)}`')
mutant(BILLING_LIB, 'reset: unreadable time kept', "if (Number.isNaN(ms)) return ''", '')
mutant(BILLING_LIB, 'reset: non-text accepted', "if (typeof resetAt !== 'string') return ''", "if (resetAt == null) return ''")
mutant(BILLING_LIB, 'reset: default date long month', "{ month: 'short', day: 'numeric' }", "{ month: 'long', day: 'numeric' }")
mutant(BILLING_LIB, 'reset: default date has a year', "{ month: 'short', day: 'numeric' }", "{ month: 'short', day: 'numeric', year: 'numeric' }")
mutant(BILLING_LIB, 'meters: weekly first', "  { id: 'daily', label: 'Daily' },\n  { id: 'weekly', label: 'Weekly' },", "  { id: 'weekly', label: 'Weekly' },\n  { id: 'daily', label: 'Daily' },")
mutant(BILLING_LIB, 'meters: daily word', "label: 'Daily'", "label: 'Today'")
mutant(BILLING_LIB, 'meters: weekly word', "label: 'Weekly'", "label: 'Week'")
mutant(BILLING_LIB, 'meters: unreadable share kept', 'if (percent === null) continue', '')
mutant(BILLING_LIB, 'meters: unreadable share read as 0', 'const percent = studioBillingPercent(quota.remainingPct?.[id])', 'const percent = studioBillingPercent(quota.remainingPct?.[id]) ?? 0')
mutant(BILLING_LIB, 'meters: no quota is a crash', 'if (!quota) return []', '')
mutant(BILLING_LIB, 'meters: reset from the wrong window', 'quota.resetAt?.[id]', "quota.resetAt?.['daily']")
mutant(BILLING_LIB, 'meters: share from the wrong window', 'quota.remainingPct?.[id]', "quota.remainingPct?.['daily']")
mutant(BILLING_LIB, 'meters: reset text dropped', 'reset: studioBillingReset(quota.resetAt?.[id], now, formatDate) })', "reset: '' })")
mutant(BILLING_LIB, 'meters: formatter ignored', 'studioBillingReset(quota.resetAt?.[id], now, formatDate)', 'studioBillingReset(quota.resetAt?.[id], now)')
mutant(BILLING_LIB, 'meters: clock ignored', 'studioBillingReset(quota.resetAt?.[id], now, formatDate)', 'studioBillingReset(quota.resetAt?.[id], new Date(), formatDate)')
// lib: shortcuts
mutant(SHORTCUTS_LIB, 'title word', "title: 'Keyboard shortcuts'", "title: 'Shortcuts'")
mutant(SHORTCUTS_LIB, 'lede word', "lede: 'Shortcuts that keep you in the flow.'", "lede: 'Master Deckster with these handy keyboard shortcuts'")
mutant(SHORTCUTS_LIB, 'send key', "keys: 'Enter' }", "keys: 'Ctrl + Enter' }")
mutant(SHORTCUTS_LIB, 'newline key', "keys: 'Shift + Enter'", "keys: 'Alt + Enter'")
mutant(SHORTCUTS_LIB, 'stop key', "label: 'Stop waiting for a reply or cancel an action', keys: 'Esc'", "label: 'Stop waiting for a reply or cancel an action', keys: 'Ctrl + C'")
mutant(SHORTCUTS_LIB, 'next key', "keys: '→ / ↓'", "keys: '→'")
mutant(SHORTCUTS_LIB, 'previous key', "keys: '← / ↑'", "keys: '← / ↑ / PageUp'")
mutant(SHORTCUTS_LIB, 'edit key', "{ id: 'edit', label: 'Edit mode', keys: 'E' }", "{ id: 'edit', label: 'Edit mode', keys: 'M' }")
mutant(SHORTCUTS_LIB, 'borders is the mockup M', "{ id: 'borders', label: 'Element borders', keys: 'B' }", "{ id: 'borders', label: 'Element borders', keys: 'M' }")
mutant(SHORTCUTS_LIB, 'grid key', "keys: 'G' }", "keys: 'Ctrl + G' }")
mutant(SHORTCUTS_LIB, 'strip key', "label: 'Show or hide the slide strip', keys: 'Esc'", "label: 'Show or hide the slide strip', keys: 'Cmd + \\\\'")
mutant(SHORTCUTS_LIB, 'save key', "keys: '⌘ / Ctrl + S'", "keys: 'Ctrl + S'")
mutant(SHORTCUTS_LIB, 'save label', "label: 'Save now (in edit mode)'", "label: 'Save presentation'")
mutant(SHORTCUTS_LIB, 'delete key', "keys: 'Delete / Backspace'", "keys: 'Delete'")
mutant(SHORTCUTS_LIB, 'select all key', "keys: '⌘ / Ctrl + A'", "keys: '⌘ / Ctrl + Shift + A'")
mutant(SHORTCUTS_LIB, 'generate key', "keys: '⌘ / Ctrl + Enter'", "keys: 'Enter'")
mutant(SHORTCUTS_LIB, 'resize key', "keys: '← / →' }", "keys: '← / → / ↑ / ↓' }")
mutant(SHORTCUTS_LIB, 'reset key', "keys: 'Home / Double-click divider'", "keys: 'Double-click divider'")
mutant(SHORTCUTS_LIB, 'a command palette row added', "  {\n    id: 'chat',", "  {\n    id: 'nav',\n    label: 'Navigation',\n    shortcuts: [{ id: 'palette', label: 'Open command palette', keys: '⌘ / Ctrl + K' }],\n  },\n  {\n    id: 'chat',")
mutant(SHORTCUTS_LIB, 'an undo row added', "      { id: 'save', label: 'Save now (in edit mode)', keys: '⌘ / Ctrl + S' },", "      { id: 'save', label: 'Save now (in edit mode)', keys: '⌘ / Ctrl + S' },\n      { id: 'undo', label: 'Undo', keys: '⌘ / Ctrl + Z' },")
mutant(SHORTCUTS_LIB, 'a group dropped', "  {\n    id: 'strip',\n    label: 'Slide strip',", "  {\n    id: 'strip-x',\n    label: 'Slide strip',")
mutant(SHORTCUTS_LIB, 'rows reordered', "      { id: 'next', label: 'Next slide', keys: '→ / ↓' },\n      { id: 'previous', label: 'Previous slide', keys: '← / ↑' },", "      { id: 'previous', label: 'Previous slide', keys: '← / ↑' },\n      { id: 'next', label: 'Next slide', keys: '→ / ↓' },")
mutant(SHORTCUTS_LIB, 'group label', "label: 'Slide strip'", "label: 'Thumbnails'")
mutant(SHORTCUTS_LIB, 'flat list reversed', 'STUDIO_SHORTCUT_GROUPS.flatMap(group => group.shortcuts)', 'STUDIO_SHORTCUT_GROUPS.flatMap(group => [...group.shortcuts].reverse())')
mutant(SHORTCUTS_LIB, 'an import added', 'export interface StudioShortcut {', "import { cn } from '@/lib/utils'\nexport interface StudioShortcut {")
// the pins bite: a handler that goes away makes its shortcut fail
const HANDLER_MUTANTS = [
  ['chat', "e.key === 'Enter' && !e.shiftKey) {\n                e.preventDefault()\n                guardedSubmit()", "e.key === 'Return' && !e.shiftKey) {\n                e.preventDefault()\n                guardedSubmit()", 'chat Enter handler removed'],
  ['chat', "e.key === 'Escape' && awaitingReply", "e.key === 'Esc' && awaitingReply", 'chat Esc (waiting) handler removed'],
  ['chat', "e.key === 'Escape' && pendingActionInput", "e.key === 'Esc' && pendingActionInput", 'chat Esc (action) handler removed'],
  ['viewer', "case 'ArrowRight':\n        case 'ArrowDown':", "case 'ArrowRight':\n        case 'Down':", 'viewer next handler removed'],
  ['viewer', "case 'ArrowLeft':\n        case 'ArrowUp':", "case 'ArrowLeft':\n        case 'Up':", 'viewer previous handler removed'],
  ['viewer', "case 'e':\n        case 'E':", "case 'x':\n        case 'X':", 'viewer E handler removed'],
  ['viewer', "case 'g':\n        case 'G':", "case 'x':\n        case 'X':", 'viewer G handler removed'],
  ['viewer', "case 'b':\n        case 'B':", "case 'm':\n        case 'M':", 'viewer B handler moved to M'],
  ['viewer', "case 'Escape':\n          e.preventDefault()\n          handleToggleOverview()", "case 'Tab':\n          e.preventDefault()\n          handleToggleOverview()", 'viewer Esc handler removed'],
  ['viewer', "(e.ctrlKey || e.metaKey) && e.key === 's') {", "(e.ctrlKey || e.metaKey) && e.key === 'p') {", 'viewer save handler removed'],
  ['strip', "(e.key === 'Delete' || e.key === 'Backspace')", "(e.key === 'Del')", 'strip delete handler removed'],
  ['strip', "(e.ctrlKey || e.metaKey) && e.key === 'a'", "(e.ctrlKey || e.metaKey) && e.key === 'q'", 'strip select-all handler removed'],
  ['strip', "if (e.key === 'Escape') {\n        e.preventDefault()\n        onSelectionChange?.([])", "if (e.key === 'Home') {\n        e.preventDefault()\n        onSelectionChange?.([])", 'strip clear handler removed'],
  ['addSlide', "event.key === 'Enter' && (event.metaKey || event.ctrlKey)", "event.key === 'Enter' && event.altKey", 'add-slide generate handler removed'],
  ['genPanel', "e.key === 'Enter' && (e.metaKey || e.ctrlKey)", "e.key === 'Enter' && e.altKey", 'generation-panel generate handler removed'],
  ['slidePanel', "e.key === 'Enter' && (e.metaKey || e.ctrlKey)", "e.key === 'Enter' && e.altKey", 'slide-panel generate handler removed'],
  ['addSlide', "event.key !== 'Escape' || pending", "event.key !== 'Home' || pending", 'add-slide close handler removed'],
  ['genPanel', "e.key === 'Escape' && (!isGenerating", "e.key === 'Home' && (!isGenerating", 'generation-panel close handler removed'],
  ['slidePanel', "e.key === 'Escape' && !isGenerating", "e.key === 'Home' && !isGenerating", 'slide-panel close handler removed'],
  ['builder', "event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home') return", "event.key !== 'ArrowUp' && event.key !== 'ArrowDown' && event.key !== 'Home') return", 'divider arrow handler removed'],
  ['builder', "onDoubleClick={() => persistStudioPaneWidth(side, side === 'chat' ? 304 : DEFAULT_DRAWER_WIDTH)}", "onClick={() => persistStudioPaneWidth(side, side === 'chat' ? 304 : DEFAULT_DRAWER_WIDTH)}", 'divider double-click reset removed'],
]
// capacity + ui
mutant(CAPACITY, 'marker dropped', 'data-studio-billing-capacity="true" role="group"', 'role="group"')
mutant(CAPACITY, 'not a group', ' role="group" aria-label={STUDIO_BILLING_USAGE_WORDS.title}', ' aria-label={STUDIO_BILLING_USAGE_WORDS.title}')
mutant(CAPACITY, 'unnamed', ' aria-label={STUDIO_BILLING_USAGE_WORDS.title}>', '>')
mutant(CAPACITY, 'title dropped', '        <span>{STUDIO_BILLING_USAGE_WORDS.title}</span>\n', '')
mutant(CAPACITY, 'ellipsis always', '{meters.length === 0 && <span>', '{true && <span>')
mutant(CAPACITY, 'no ellipsis', '{meters.length === 0 && <span>', '{false && <span>')
mutant(CAPACITY, 'failed reads as loading', 'quota === undefined ? STUDIO_BILLING_USAGE_WORDS.loading : STUDIO_BILLING_USAGE_WORDS.unavailable', 'STUDIO_BILLING_USAGE_WORDS.loading')
mutant(CAPACITY, 'in flight reads as failed', 'quota === undefined ? STUDIO_BILLING_USAGE_WORDS.loading : STUDIO_BILLING_USAGE_WORDS.unavailable', 'STUDIO_BILLING_USAGE_WORDS.unavailable')
mutant(CAPACITY, 'meters from nothing', 'const meters = studioBillingMeters(quota)', 'const meters = studioBillingMeters(null)')
mutant(CAPACITY, 'meter marker dropped', 'data-studio-billing-meter={meter.id}', '')
mutant(CAPACITY, 'meter head dropped', '<div data-studio-billing-meter-head="true">', '<div>')
mutant(CAPACITY, 'meter label dropped', '            <span>{meter.label}</span>\n', '')
mutant(CAPACITY, 'meter share used', '<span>{meter.percent}% {STUDIO_BILLING_USAGE_WORDS.left}</span>', '<span>{100 - meter.percent}% used</span>')
mutant(CAPACITY, 'meter share without word', '<span>{meter.percent}% {STUDIO_BILLING_USAGE_WORDS.left}</span>', '<span>{meter.percent}%</span>')
mutant(CAPACITY, 'bar not a progressbar', 'role="progressbar"', 'role="presentation"')
mutant(CAPACITY, 'bar value dropped', 'aria-valuenow={meter.percent}', '')
mutant(CAPACITY, 'bar max', 'aria-valuemax={100}', 'aria-valuemax={1}')
mutant(CAPACITY, 'bar min', 'aria-valuemin={0}', 'aria-valuemin={1}')
mutant(CAPACITY, 'bar unnamed', 'aria-label={`${meter.label} usage left`}', 'aria-label="Usage"')
mutant(CAPACITY, 'bar marker dropped', 'data-studio-billing-meter-bar="true" role', 'role')
mutant(CAPACITY, 'fill ignores the share', 'style={{ width: `${meter.percent}%` }}', 'style={{ width: "100%" }}')
mutant(CAPACITY, 'fill inverted', 'style={{ width: `${meter.percent}%` }}', 'style={{ width: `${100 - meter.percent}%` }}')
mutant(CAPACITY, 'reset always', '{meter.reset && <small>', '{true && <small>')
mutant(CAPACITY, 'reset dropped', '          {meter.reset && <small>{meter.reset}</small>}\n', '')
mutant(CAPACITY, 'network added', 'export function StudioBillingCapacity', 'const probe = () => fetch("/x")\nexport function StudioBillingCapacity')
mutant(SHORTCUTS_UI, 'page marker dropped', '<main data-studio-p2-shortcuts="true">', '<main>')
mutant(SHORTCUTS_UI, 'not a main', '<main data-studio-p2-shortcuts="true">', '<div data-studio-p2-shortcuts="true">')
mutant(SHORTCUTS_UI, 'heading marker dropped', '<header data-studio-p2-shortcuts-heading="true">', '<header>')
mutant(SHORTCUTS_UI, 'title dropped', '        <h1>{STUDIO_SHORTCUTS_WORDS.title}</h1>\n', '')
mutant(SHORTCUTS_UI, 'lede dropped', '        <p>{STUDIO_SHORTCUTS_WORDS.lede}</p>\n', '')
mutant(SHORTCUTS_UI, 'groups from nothing', 'STUDIO_SHORTCUT_GROUPS.map((group) => (', '[].map((group) => (')
mutant(SHORTCUTS_UI, 'group marker dropped', 'data-studio-p2-shortcuts-group={group.id} ', '')
mutant(SHORTCUTS_UI, 'group unnamed', ' aria-labelledby={`studio-p2-shortcuts-${group.id}`}', '')
mutant(SHORTCUTS_UI, 'group heading id dropped', '<h2 id={`studio-p2-shortcuts-${group.id}`}>', '<h2>')
mutant(SHORTCUTS_UI, 'group heading label', '{group.label}</h2>', '{group.id}</h2>')
mutant(SHORTCUTS_UI, 'not a list', '          <ul>\n', '          <div>\n')
mutant(SHORTCUTS_UI, 'row marker dropped', ' data-studio-p2-shortcut={shortcut.id}', '')
mutant(SHORTCUTS_UI, 'label dropped', '                <span>{shortcut.label}</span>\n', '')
mutant(SHORTCUTS_UI, 'keys swapped', '<kbd>{shortcut.keys}</kbd>', '<kbd>{shortcut.label}</kbd>')
mutant(SHORTCUTS_UI, 'chip not a kbd', '<kbd>{shortcut.keys}</kbd>', '<span>{shortcut.keys}</span>')
mutant(SHORTCUTS_UI, 'stylesheet not imported', 'import "./studio-p2-shortcuts.css"', '// import "./studio-p2-shortcuts.css"')
mutant(SHORTCUTS_UI, 'sign-in read added', 'export function StudioShortcutsPage', 'const probe = () => useAuth()\nexport function StudioShortcutsPage')
// billing page
const FLAGLINE = 'const STUDIO_P2_ACCOUNT = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true" && process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true"'
mutant(BILLING_PAGE, 'flag loose', 'process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true"', 'process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT !== "false"')
mutant(BILLING_PAGE, 'flag truthy', 'process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true"', 'Boolean(process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT)')
mutant(BILLING_PAGE, 'shell not required', FLAGLINE, 'const STUDIO_P2_ACCOUNT = process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true"')
mutant(BILLING_PAGE, 'flag ignored', FLAGLINE, 'const STUDIO_P2_ACCOUNT = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true"')
mutant(BILLING_PAGE, 'always on', FLAGLINE, 'const STUDIO_P2_ACCOUNT = true')
mutant(BILLING_PAGE, 'never on', FLAGLINE, 'const STUDIO_P2_ACCOUNT = false')
mutant(BILLING_PAGE, 'marker dropped', ' data-studio-p2-account={STUDIO_P2_ACCOUNT ? "true" : undefined}', '')
mutant(BILLING_PAGE, 'marker always', 'data-studio-p2-account={STUDIO_P2_ACCOUNT ? "true" : undefined}', 'data-studio-p2-account="true"')
mutant(BILLING_PAGE, 'plan from nothing', 'const plan = STUDIO_P2_ACCOUNT ? studioPlanForTier(PRICING_TIERS, user.tier) : null', 'const plan = null')
mutant(BILLING_PAGE, 'plan from the wrong tier', 'studioPlanForTier(PRICING_TIERS, user.tier)', 'studioPlanForTier(PRICING_TIERS, subscription?.tier)')
mutant(BILLING_PAGE, 'plan with the flag off', 'const plan = STUDIO_P2_ACCOUNT ? studioPlanForTier(PRICING_TIERS, user.tier) : null', 'const plan = studioPlanForTier(PRICING_TIERS, user.tier)')
mutant(BILLING_PAGE, 'next plan from nothing', 'const nextPlan = studioNextPlan(PRICING_TIERS, plan)', 'const nextPlan = null')
mutant(BILLING_PAGE, 'title not from the plan', '{plan\n                      ? `${plan.name} Plan`', '{false\n                      ? `${plan.name} Plan`')
mutant(BILLING_PAGE, 'title word', '`${plan.name} Plan`', '`${plan.name} plan`')
mutant(BILLING_PAGE, 'price line from nothing', 'studioBillingPriceLine(PRICING_TIERS, user.tier, subscription?.billingCycle)', 'studioBillingPriceLine(PRICING_TIERS, "free", subscription?.billingCycle)')
mutant(BILLING_PAGE, 'price line without the cycle', 'studioBillingPriceLine(PRICING_TIERS, user.tier, subscription?.billingCycle)', 'studioBillingPriceLine(PRICING_TIERS, user.tier, undefined)')
mutant(BILLING_PAGE, 'price line from the wrong list', 'studioBillingPriceLine(PRICING_TIERS, user.tier', 'studioBillingPriceLine([], user.tier')
mutant(BILLING_PAGE, 'the old literal is back', ': subscription\n                      ? subscription.billingCycle === "yearly"', ': false\n                      ? subscription?.billingCycle === "yearly"')
mutant(BILLING_PAGE, 'features not from the plan', '{plan ? (\n                  studioPlanLines(plan).map', '{false ? (\n                  studioPlanLines(plan).map')
mutant(BILLING_PAGE, 'features of the next plan', 'studioPlanLines(plan).map', 'studioPlanLines(nextPlan ?? plan).map')
mutant(BILLING_PAGE, 'lead line checked', 'line.lead ? (', 'false ? (')
mutant(BILLING_PAGE, 'every line a lead', 'line.lead ? (', 'true ? (')
mutant(BILLING_PAGE, 'lead marker dropped', ' data-studio-billing-feature-lead="true"', '')
mutant(BILLING_PAGE, 'feature not included', '<Feature key={line.text} included text={line.text} />', '<Feature key={line.text} text={line.text} />')
mutant(BILLING_PAGE, 'upgrade label is Enterprise', '`Upgrade to ${nextPlan?.name}`', '"Upgrade to Enterprise"')
mutant(BILLING_PAGE, 'upgrade for the last plan', '(STUDIO_P2_ACCOUNT ? nextPlan : true) &&', 'true &&')
mutant(BILLING_PAGE, 'upgrade label with the flag off', '{STUDIO_P2_ACCOUNT ? `Upgrade to ${nextPlan?.name}` : "Upgrade to Enterprise"}', '{`Upgrade to ${nextPlan?.name}`}')
mutant(BILLING_PAGE, 'planned row stays', '{STUDIO_P2_ACCOUNT ? (\n                <StudioBillingCapacity quota={quota} />', '{false ? (\n                <StudioBillingCapacity quota={quota} />')
mutant(BILLING_PAGE, 'planned row removed with the flag off', '{STUDIO_P2_ACCOUNT ? (\n                <StudioBillingCapacity quota={quota} />\n              ) : (', '{true ? (\n                <StudioBillingCapacity quota={quota} />\n              ) : (')
mutant(BILLING_PAGE, 'capacity gets no quota', '<StudioBillingCapacity quota={quota} />', '<StudioBillingCapacity quota={undefined} />')
mutant(BILLING_PAGE, 'quota read ungated', '    if (!STUDIO_P2_ACCOUNT) return\n    let cancelled = false\n    fetch("/api/usage/quota")', '    let cancelled = false\n    fetch("/api/usage/quota")')
mutant(BILLING_PAGE, 'quota read twice', '  }, [])\n\n  // Real invoice history', '  })\n\n  // Real invoice history')
mutant(BILLING_PAGE, 'quota read url', 'fetch("/api/usage/quota")', 'fetch("/api/usage/quota?fresh=1")')
mutant(BILLING_PAGE, 'quota read posts', 'fetch("/api/usage/quota")', 'fetch("/api/usage/quota", { method: "POST" })')
mutant(BILLING_PAGE, 'quota failure ignored', '.catch(() => {\n        if (!cancelled) setQuota(null)\n      })', '.catch(() => {})')
mutant(BILLING_PAGE, 'quota set after unmount', '.then((d) => {\n        if (!cancelled) setQuota(d)', '.then((d) => {\n        setQuota(d)')
mutant(BILLING_PAGE, 'quota starts null', 'useState<StudioBillingQuota | null | undefined>(undefined)', 'useState<StudioBillingQuota | null | undefined>(null)')
mutant(BILLING_PAGE, 'capacity import dropped', 'import { StudioBillingCapacity } from "@/components/billing/studio-billing-capacity"\n', '')
mutant(BILLING_PAGE, 'account stylesheet not imported', 'import "@/components/settings/studio-p2-account.css"\n', '')
mutant(BILLING_PAGE, 'handleUpgrade changed', 'router.push("/pricing")', 'router.push("/billing")')
// profile page
const PROFILE_FLAG = 'const STUDIO_P2_ACCOUNT = STUDIO_SHELL && process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true"'
mutant(PROFILE_PAGE, 'flag loose', 'process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true"', 'process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT !== "false"')
mutant(PROFILE_PAGE, 'shell not required', PROFILE_FLAG, 'const STUDIO_P2_ACCOUNT = process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true"')
mutant(PROFILE_PAGE, 'always on', PROFILE_FLAG, 'const STUDIO_P2_ACCOUNT = true')
mutant(PROFILE_PAGE, 'never on', PROFILE_FLAG, 'const STUDIO_P2_ACCOUNT = false')
mutant(PROFILE_PAGE, 'marker dropped', ' data-studio-p2-account={STUDIO_P2_ACCOUNT ? "true" : undefined}', '')
mutant(PROFILE_PAGE, 'marker always', 'data-studio-p2-account={STUDIO_P2_ACCOUNT ? "true" : undefined}', 'data-studio-p2-account="true"')
mutant(PROFILE_PAGE, 'stylesheet not imported', 'import "@/components/settings/studio-p2-account.css"\n', '')
mutant(PROFILE_PAGE, 'save marker moved', 'data-studio-settings-profile-save={STUDIO_SHELL ? "true" : undefined}', 'data-studio-settings-profile-savex={STUDIO_SHELL ? "true" : undefined}')
// shortcuts page
const SHORTCUTS_FLAG = 'const STUDIO_P2_SHORTCUTS = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true" && process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true"'
mutant(SHORTCUTS_PAGE, 'flag loose', 'process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true"', 'process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT !== "false"')
mutant(SHORTCUTS_PAGE, 'shell not required', SHORTCUTS_FLAG, 'const STUDIO_P2_SHORTCUTS = process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true"')
mutant(SHORTCUTS_PAGE, 'flag ignored', SHORTCUTS_FLAG, 'const STUDIO_P2_SHORTCUTS = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true"')
mutant(SHORTCUTS_PAGE, 'always on', SHORTCUTS_FLAG, 'const STUDIO_P2_SHORTCUTS = true')
mutant(SHORTCUTS_PAGE, 'never on', SHORTCUTS_FLAG, 'const STUDIO_P2_SHORTCUTS = false')
mutant(SHORTCUTS_PAGE, 'wrapper swapped', 'return STUDIO_P2_SHORTCUTS ? <StudioShortcutsPage /> : <LegacyShortcutsPage />', 'return STUDIO_P2_SHORTCUTS ? <LegacyShortcutsPage /> : <StudioShortcutsPage />')
mutant(SHORTCUTS_PAGE, 'new page import dropped', 'import { StudioShortcutsPage } from "@/components/settings/studio-p2-shortcuts"\n', '')
mutant(SHORTCUTS_PAGE, 'old page changed', 'Master Deckster with these handy keyboard shortcuts', 'Master Deckster')
mutant(SHORTCUTS_PAGE, 'old page loses a shortcut', '{ category: "Navigation", keys: ["Ctrl", "K"], description: "Open command palette" },', '')
// landing
const LANDING_FLAG = 'const STUDIO_P2_ACCOUNT = process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true"'
mutant(PRICING_HOME, 'flag loose', 'process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true"', 'process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT !== "false"')
mutant(PRICING_HOME, 'flag truthy', 'process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true"', 'Boolean(process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT)')
mutant(PRICING_HOME, 'always on', LANDING_FLAG, 'const STUDIO_P2_ACCOUNT = true')
mutant(PRICING_HOME, 'never on', LANDING_FLAG, 'const STUDIO_P2_ACCOUNT = false')
mutant(PRICING_HOME, 'needs the shell', LANDING_FLAG, 'const STUDIO_P2_ACCOUNT = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true" && process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true"')
mutant(PRICING_HOME, 'tiers not merged', 'const tiers = studioLandingTiers(copy.tiers, PRICING_TIERS, STUDIO_P2_ACCOUNT)', 'const tiers = copy.tiers')
mutant(PRICING_HOME, 'merged from nothing', 'studioLandingTiers(copy.tiers, PRICING_TIERS, STUDIO_P2_ACCOUNT)', 'studioLandingTiers(copy.tiers, [], STUDIO_P2_ACCOUNT)')
mutant(PRICING_HOME, 'merge ignores the flag', 'studioLandingTiers(copy.tiers, PRICING_TIERS, STUDIO_P2_ACCOUNT)', 'studioLandingTiers(copy.tiers, PRICING_TIERS, true)')
mutant(PRICING_HOME, 'merged tiers not rendered', '{tiers.map((tier) => (', '{copy.tiers.map((tier) => (')
mutant(PRICING_PAGE, 'flag loose', 'process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true"', 'process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT !== "false"')
mutant(PRICING_PAGE, 'flag truthy', 'process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true"', 'Boolean(process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT)')
mutant(PRICING_PAGE, 'always on', LANDING_FLAG, 'const STUDIO_P2_ACCOUNT = true')
mutant(PRICING_PAGE, 'never on', LANDING_FLAG, 'const STUDIO_P2_ACCOUNT = false')
mutant(PRICING_PAGE, 'needs the shell', LANDING_FLAG, 'const STUDIO_P2_ACCOUNT = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true" && process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true"')
mutant(PRICING_PAGE, 'tiers not merged', 'studioLandingTiers(copy.start.tiers, PRICING_TIERS, STUDIO_P2_ACCOUNT).map(', 'copy.start.tiers.map(')
mutant(PRICING_PAGE, 'merged from nothing', 'studioLandingTiers(copy.start.tiers, PRICING_TIERS, STUDIO_P2_ACCOUNT)', 'studioLandingTiers(copy.start.tiers, [], STUDIO_P2_ACCOUNT)')
mutant(PRICING_PAGE, 'merge ignores the flag', 'studioLandingTiers(copy.start.tiers, PRICING_TIERS, STUDIO_P2_ACCOUNT)', 'studioLandingTiers(copy.start.tiers, PRICING_TIERS, true)')
// css
mutant(CSS_ACCOUNT, 'save violet', '[data-studio-settings-profile-save] { color: var(--ss-on-action); background: var(--ss-action); }', '[data-studio-settings-profile-save] { color: var(--ss-on-action); background: var(--ss-accent); }')
mutant(CSS_ACCOUNT, 'save text', '[data-studio-settings-profile-save] { color: var(--ss-on-action);', '[data-studio-settings-profile-save] { color: var(--ss-panel);')
mutant(CSS_ACCOUNT, 'save hover', '[data-studio-settings-profile-save]:hover:not(:disabled) { background: var(--ss-action-hover); }', '[data-studio-settings-profile-save]:hover:not(:disabled) { background: var(--ss-accent); }')
mutant(CSS_ACCOUNT, 'plan buttons violet', 'button { color: var(--ss-on-action); background: var(--ss-action); }', 'button { color: var(--ss-on-action); background: var(--ss-accent); }')
mutant(CSS_ACCOUNT, 'plan buttons hover', 'button:hover:not(:disabled) { background: var(--ss-action-hover); }', 'button:hover:not(:disabled) { background: var(--ss-action); }')
mutant(CSS_ACCOUNT, 'view plans dropped', ':is([data-studio-billing-plan-summary], [data-studio-billing-upgrade]) button {', ':is([data-studio-billing-plan-summary]) button {')
mutant(CSS_ACCOUNT, 'scope loosened', '[data-studio-v4-shell="true"] [data-studio-p2-account="true"] [data-studio-settings-profile-save] {', '[data-studio-settings-profile-save] {')
mutant(CSS_ACCOUNT, 'shell not required', '[data-studio-v4-shell="true"] [data-studio-p2-account="true"] [data-studio-billing-capacity="true"]', '[data-studio-p2-account="true"] [data-studio-billing-capacity="true"]')
mutant(CSS_ACCOUNT, 'meter thick', 'height: 4px; margin: 6px 0 5px;', 'height: 8px; margin: 6px 0 5px;')
mutant(CSS_ACCOUNT, 'meter square', 'margin: 6px 0 5px; border-radius: 5px;', 'margin: 6px 0 5px; border-radius: 0;')
mutant(CSS_ACCOUNT, 'meter track', 'border-radius: 5px; background: var(--ss-line); overflow: hidden;', 'border-radius: 5px; background: var(--ss-panel); overflow: hidden;')
mutant(CSS_ACCOUNT, 'meter not clipped', 'background: var(--ss-line); overflow: hidden;', 'background: var(--ss-line);')
mutant(CSS_ACCOUNT, 'fill violet', 'border-radius: 5px; background: var(--ss-teal); }', 'border-radius: 5px; background: var(--ss-accent); }')
mutant(CSS_ACCOUNT, 'fill height', 'display: block; height: 100%;', 'display: block; height: 50%;')
mutant(CSS_ACCOUNT, 'fill inline', 'display: block; height: 100%;', 'display: inline; height: 100%;')
mutant(CSS_ACCOUNT, 'head not a row', 'display: flex; align-items: baseline; justify-content: space-between;', 'display: block; align-items: baseline; justify-content: space-between;')
mutant(CSS_ACCOUNT, 'head not spread', 'justify-content: space-between; gap: 8px;', 'justify-content: flex-start; gap: 8px;')
mutant(CSS_ACCOUNT, 'capacity head not a row', '[data-studio-billing-capacity-head="true"] { display: flex;', '[data-studio-billing-capacity-head="true"] { display: block;')
mutant(CSS_ACCOUNT, 'reset not muted', '[data-studio-billing-meter] > small { display: block; font-size: 10px; line-height: 14px; color: var(--ss-muted); }', '[data-studio-billing-meter] > small { display: block; font-size: 10px; line-height: 14px; color: var(--ss-text); }')
mutant(CSS_ACCOUNT, 'literal colour', 'color: var(--ss-muted); }\n[data-studio-v4-shell="true"] [data-studio-p2-account="true"] [data-studio-billing-meter] {', 'color: #566965; }\n[data-studio-v4-shell="true"] [data-studio-p2-account="true"] [data-studio-billing-meter] {')
mutant(CSS_ACCOUNT, 'unknown token', 'background: var(--ss-teal); }', 'background: var(--ss-teal-soft); }')
mutant(CSS_SHORTCUTS, 'scope loosened', '[data-studio-v4-shell="true"] [data-studio-p2-shortcuts="true"] kbd {', '[data-studio-p2-shortcuts="true"] kbd {')
mutant(CSS_SHORTCUTS, 'a global rule', '[data-studio-v4-shell="true"] [data-studio-p2-shortcuts="true"] kbd {', 'kbd {')
mutant(CSS_SHORTCUTS, 'card line', 'border: 1px solid var(--ss-line); border-radius: 12px; background: var(--ss-panel); }', 'border: 0; border-radius: 12px; background: var(--ss-panel); }')
mutant(CSS_SHORTCUTS, 'card surface', 'border-radius: 12px; background: var(--ss-panel); }', 'border-radius: 12px; background: var(--ss-surface); }')
mutant(CSS_SHORTCUTS, 'card radius', 'border-radius: 12px; background: var(--ss-panel); }', 'border-radius: 2px; background: var(--ss-panel); }')
mutant(CSS_SHORTCUTS, 'row not a flex row', 'li { display: flex; align-items: center; justify-content: space-between;', 'li { display: block; align-items: center; justify-content: space-between;')
mutant(CSS_SHORTCUTS, 'row chip not at the end', 'justify-content: space-between; gap: 16px; padding: 11px 0;', 'justify-content: flex-start; gap: 16px; padding: 11px 0;')
mutant(CSS_SHORTCUTS, 'row without lines', 'padding: 11px 0; border-top: 1px solid var(--ss-line);', 'padding: 11px 0; border-top: 0;')
mutant(CSS_SHORTCUTS, 'row text unreadable in dark', 'font-size: 12px; line-height: 18px; color: var(--ss-text); }', 'font-size: 12px; line-height: 18px; color: var(--ss-panel); }')
mutant(CSS_SHORTCUTS, 'first row line', 'li:first-child { border-top: 0; }', 'li:first-child { border-top: 1px solid var(--ss-line); }')
mutant(CSS_SHORTCUTS, 'chip line', 'kbd { flex-shrink: 0; padding: 3px 8px; border: 1px solid var(--ss-line);', 'kbd { flex-shrink: 0; padding: 3px 8px; border: 0;')
mutant(CSS_SHORTCUTS, 'chip surface', 'background: var(--ss-surface); color: var(--ss-text); font:', 'background: var(--ss-panel); color: var(--ss-text); font:')
mutant(CSS_SHORTCUTS, 'chip text', 'background: var(--ss-surface); color: var(--ss-text); font:', 'background: var(--ss-surface); color: var(--ss-muted); font:')
mutant(CSS_SHORTCUTS, 'chip not mono', 'font: 500 10.5px/16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;', 'font: 500 10.5px/16px system-ui, sans-serif;')
mutant(CSS_SHORTCUTS, 'chip wraps', 'white-space: nowrap; }', 'white-space: normal; }')
mutant(CSS_SHORTCUTS, 'eyebrow not uppercase', 'text-transform: uppercase;', 'text-transform: none;')
mutant(CSS_SHORTCUTS, 'hover rows come back', 'li:first-child { border-top: 0; }', 'li:first-child { border-top: 0; }\n[data-studio-v4-shell="true"] [data-studio-p2-shortcuts="true"] li:hover { background: #f8fafc; }')
mutant(CSS_SHORTCUTS, 'literal colour', 'color: var(--ss-muted); }\n[data-studio-v4-shell="true"] [data-studio-p2-shortcuts="true"] section', 'color: #566965; }\n[data-studio-v4-shell="true"] [data-studio-p2-shortcuts="true"] section')
mutant(CSS_SHORTCUTS, 'unknown token', 'background: var(--ss-surface); color: var(--ss-text); font:', 'background: var(--ss-kbd); color: var(--ss-text); font:')
// env + package
mutant(ENV, 'default on', `${FLAG}="false"`, `${FLAG}="true"`)
mutant(ENV, 'not documented', `${FLAG}="false"\n`, '')
mutant(PKG, 'test not registered', '"test:studio-p2-account": "node scripts/test-studio-p2-account.mjs",\n', '')
mutant(PKG, 'test registered to another file', 'node scripts/test-studio-p2-account.mjs', 'node scripts/test-studio-p2-profile-menu.mjs')

let killed = 0
const survivors = []
counting = false
const inLib = (file, mutated) => {
  if (file === BILLING_LIB) return proveBillingLib(mutated, 'mutant')
  if (file === SHORTCUTS_LIB) return proveShortcutsLib(mutated, 'mutant')
}
for (const [file, name, from, to] of MUTANTS) {
  const source = SOURCES[file]
  assert.ok(source.includes(from), `mutant "${name}": the text it replaces exists in ${file}`)
  const mutated = source.replace(from, () => to)
  assert.notEqual(mutated, source, `mutant "${name}" changes the source`)
  let survived = false
  try {
    if (file === BILLING_LIB || file === SHORTCUTS_LIB) inLib(file, mutated)
    else if (file === CAPACITY) proveCapacity(mutated, name)
    else if (file === SHORTCUTS_UI) proveShortcutsUi(mutated, shortcutsLib, name)
    else if (file === BILLING_PAGE) await proveBilling(mutated, name)
    else if (file === PROFILE_PAGE) await proveProfile(mutated, name)
    else if (file === SHORTCUTS_PAGE) await proveShortcutsPage(mutated, name)
    else if (file === PRICING_HOME) await proveLanding(mutated, SOURCES[PRICING_PAGE], name)
    else if (file === PRICING_PAGE) await proveLanding(SOURCES[PRICING_HOME], mutated, name)
    else if (file === CSS_ACCOUNT) proveAccountCss(mutated, name)
    else if (file === CSS_SHORTCUTS) proveShortcutsCss(mutated, name)
    else if (file === ENV) proveEnv(mutated, name)
    else if (file === PKG) provePackage(mutated, name)
    survived = true
  } catch (error) { assert.equal(error?.code, 'ERR_ASSERTION', `mutant "${name}" must be killed by an assertion, not a crash: ${error}`); killed++ }
  if (survived) survivors.push(name)
}
for (const [key, from, to, name] of HANDLER_MUTANTS) {
  assert.ok(HANDLER_SOURCES[key].includes(from), `handler mutant "${name}": the text it replaces exists in ${HANDLERS[key]}`)
  const handlers = { ...HANDLER_SOURCES, [key]: HANDLER_SOURCES[key].replace(from, () => to) }
  let survived = false
  try { proveShortcutsLib(SOURCES[SHORTCUTS_LIB], name, handlers); survived = true } catch (error) { assert.equal(error?.code, 'ERR_ASSERTION', `handler mutant "${name}" must be killed by an assertion, not a crash: ${error}`); killed++ }
  if (survived) survivors.push(name)
}
counting = true
assert.deepEqual(survivors, [], `mutants survived: ${survivors.join(', ')}`)
const TOTAL = MUTANTS.length + HANDLER_MUTANTS.length
eq(killed, TOTAL)

console.log(`Studio P2 account (ACC-04/12/13/14/16/17): ${checks} checks passed, ${killed}/${TOTAL} mutants killed; no network.`)
