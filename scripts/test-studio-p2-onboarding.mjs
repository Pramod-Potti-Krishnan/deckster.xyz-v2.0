// PASS2 ONBOARDING (FRONTEND-1): the /onboarding wizard in the Studio shell's look, with what was broken on it fixed. Flag NEXT_PUBLIC_STUDIO_P2_ONBOARDING (exact "true"), default off; it also needs the
// Studio shell (NEXT_PUBLIC_STUDIO_V4_SHELL "true"), because "Use a template" opens the shell's template library.
//
// Run: node scripts/test-studio-p2-onboarding.mjs   (plain node: transpile + vm, no network, no browser, no env)
//   P2_ONBOARDING_BASE=<commit> overrides the base commit flag-off identity is checked against (default 55cef1d, the studio-v4-dev-preparation-code tip the work started from).
//
// Proven on the REAL sources:
//   1. lib/studio-onboarding.ts: import-free; the steps, the choices (equal to the old page's lists), the rule for "may continue", the status line, the prompts, the recap, where the last button goes, no promise the page cannot keep;
//   2. the wizard (executed with a hook stub): every step and every choice, Back / Continue / Finish, the callouts, the last screen, focus on a step change, radio groups, no timers / network / storage / utility classes;
//   3. the wiring: flag off or shell off = the old page through the layout untouched (page.tsx is the base commit's bytes), flag + shell on = the wizard;
//   4. the CSS: scoped to the page's own marker, tokens only (all declared, light and dark, equal to the Studio introduction's), WCAG AA contrast of every text pair, the phone and short-window rules;
//   5. env + package registration;
//   6. mutation check: every mutant of the sources is killed by sections 1-5.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import postcss from 'postcss'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const BASE_COMMIT = process.env.P2_ONBOARDING_BASE || '55cef1d29341ed9cf4bc1c1d93657e644ded4de4'
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

const LIB = 'lib/studio-onboarding.ts'
const UI = 'components/studio-p2-onboarding.tsx'
const LAYOUT = 'app/onboarding/layout.tsx'
const PAGE = 'app/onboarding/page.tsx'
const CSS = 'components/studio-p2-onboarding.css'
const CSS_INTRO = 'components/studio-onboarding.css'
const ENV = '.env.example'
const PKG = 'package.json'
const SOURCES = Object.fromEntries([LIB, UI, LAYOUT, CSS, ENV, PKG].map(rel => [rel, read(rel)]))
const FLAG = 'NEXT_PUBLIC_STUDIO_P2_ONBOARDING'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'

// ---------------------------------------------------------------- loading
const jsx = (type, props, key) => ({ type, props: props ?? {}, ...(key === undefined ? {} : { key }) })
const JSX_RUNTIME = { jsx, jsxs: jsx, Fragment: 'Fragment' }
const names = new Proxy({}, { get: (_target, key) => key })
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : value && typeof value === 'object' ? [value, ...nodes(value.props?.children)] : []
const rawText = value => Array.isArray(value) ? value.map(rawText).join('') : value == null || typeof value === 'boolean' ? '' : typeof value === 'object' ? rawText(value.props?.children) : String(value)
const text = value => rawText(value).replace(/\s+/g, ' ').trim()
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
  vm.runInNewContext(compile(source, fileName), { module, exports: module.exports, process: { env }, Object, JSON, Array, String, Boolean, Math, ...globals, require: name => {
    if (name in deps) return deps[name]
    if (name === 'react/jsx-runtime') return JSX_RUNTIME
    if (name.endsWith('.css')) return {}
    if (name === 'lucide-react' || name.startsWith('@/components/') || name === 'next/link') return names
    assert.fail(`Unexpected import ${name} in ${fileName}`)
  } })
  return module.exports
}
function makeReact() {
  const slots = [], effects = []; let cursor = 0
  return {
    reset() { cursor = 0 },
    flushEffects() { while (effects.length) { const [i, fn] = effects.shift(); if (typeof slots[i].cleanup === 'function') slots[i].cleanup(); slots[i].cleanup = fn() } },
    api: {
      useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value }] },
      useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
      useId() { const i = cursor++; return slots[i] ||= `:r${i}:` },
      useEffect(fn, deps) { const i = cursor++, previous = slots[i]; if (!previous || !deps || deps.some((x, index) => x !== previous.deps[index])) { slots[i] = { deps, cleanup: previous?.cleanup }; effects.push([i, fn]) } },
    },
  }
}
const attempt = fn => { try { return fn() } catch (error) { return { threw: String(error) } } } // a mutant that crashes must fail an assertion, not the run

// ---------------------------------------------------------------- 1. the lib
const USE_CASES = [['sales', 'Sales Pitches', 'Win more deals with compelling pitch decks'], ['marketing', 'Marketing Decks', 'Showcase campaigns and results'], ['education', 'Educational Content', 'Teach and train effectively'],
  ['business', 'Business Reports', 'Present data and insights'], ['creative', 'Creative Projects', 'Portfolios and showcases'], ['startup', 'Startup Pitches', 'Fundraising and investor decks']]
const ROLES = [['marketer', 'Marketer'], ['sales', 'Sales Professional'], ['educator', 'Educator'], ['founder', 'Founder/Entrepreneur'], ['designer', 'Designer'], ['consultant', 'Consultant'], ['student', 'Student'], ['other', 'Other']]
const TEAMS = [['solo', 'Just me', 'Individual creator'], ['small', '2-10 people', 'Small team'], ['medium', '11-50 people', 'Growing organization'], ['large', '50+ people', 'Enterprise team']]
const STARTS = [['scratch', 'Create from scratch', 'Open Studio and describe your deck to the Director'], ['template', 'Use a template', 'Browse the template library and start from a design']]
const EXPECTED_PROMPTS = {
  sales: ['Create a product pitch deck for a B2B SaaS platform', 'Build a sales proposal for enterprise clients', 'Make a customer success story presentation'],
  marketing: ['Create a Q4 marketing campaign results presentation', 'Build a social media strategy deck for next year', 'Make a brand positioning presentation'],
  education: ['Create a lecture on Introduction to Machine Learning', 'Build a training workshop on effective communication', 'Make a course overview presentation for students'],
  business: ['Create a quarterly business review for executives', 'Build a project status report with timeline', 'Make a strategic planning presentation for next year'],
  creative: ['Create a creative portfolio showcasing recent work', 'Build a design case study presentation', 'Make an agency capabilities deck'],
  startup: ['Create a Series A fundraising pitch deck', 'Build a product roadmap presentation for investors', 'Make a startup overview for potential partners'],
}
const GENERIC = ['Create a professional presentation about...', 'Build a compelling deck for...', 'Make an engaging presentation on...']
const EMPTY = { useCase: '', role: '', team: '', start: '' }
const FULL = { useCase: 'sales', role: 'founder', team: 'solo', start: 'scratch' }
const KEYS = [null, 'useCase', 'role', 'team', 'start']
const CHOICE_TABLE = { useCase: USE_CASES, role: ROLES, team: TEAMS, start: STARTS }

// What the old page offered (it is evaluated from the base commit's own source, not retyped): the choices and the prompt lists stay what they were, apart from "2025".
function legacyLists() {
  const source = baseSource(PAGE)
  const file = ts.createSourceFile('onboarding.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const out = {}
  const iconNames = [...source.matchAll(/^\s+(\w+),?$/gm)].map(m => m[1])
  const context = Object.fromEntries(iconNames.map(name => [name, name]))
  ts.forEachChild(file, function visit(node) {
    if (ts.isVariableDeclaration(node) && ['useCases', 'roles', 'teamSizes', 'getPromptSuggestions'].includes(node.name.getText(file))) out[node.name.getText(file)] = vm.runInNewContext(`(${ts.transpileModule(node.initializer.getText(file), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText.trim().replace(/;$/, '')})`, vm.createContext({ ...context }))
    ts.forEachChild(node, visit)
  })
  return out
}
function proveLib(source, label = 'lib') {
  const file = ts.createSourceFile(LIB, source, ts.ScriptTarget.Latest, true)
  ok(!file.statements.some(s => ts.isImportDeclaration(s) || (ts.isExportDeclaration(s) && s.moduleSpecifier)), `${label}: import-free`)
  nomatch(source, /\brequire\(|\bimport\(|\bfetch\(|localStorage|sessionStorage|setTimeout|document\.|window\./, `${label}: no browser, timer or network use`)
  const lib = load(source, LIB)
  const steps = plain(lib.STUDIO_ONBOARDING_STEPS)
  deepEq(steps.map(s => [s.id, s.chapter]), [['welcome', 'Welcome'], ['useCase', 'Use'], ['role', 'Role'], ['team', 'Team'], ['start', 'Start']], `${label}: five steps, in order`)
  deepEq(steps.map(s => s.title), ['Welcome to Deckster.', 'What will you use Deckster for?', 'What is your role?', 'How big is your team?', 'Choose your starting point.'], `${label}: step titles`)
  deepEq(steps.map(s => s.description), ['Four quick questions, then you are in Studio.', 'Pick the kind of deck you make most.', 'Pick the one closest to your work.', 'Pick the size that fits.', 'Where would you like to begin?'], `${label}: step descriptions`)
  eq(steps.length - 1, 4, `${label}: "Four quick questions" is the number of questions`)
  deepEq(lib.STUDIO_ONBOARDING_EMPTY, EMPTY, `${label}: nothing chosen to start`)
  for (const [table, key] of [[USE_CASES, 'STUDIO_ONBOARDING_USE_CASES'], [ROLES, 'STUDIO_ONBOARDING_ROLES'], [TEAMS, 'STUDIO_ONBOARDING_TEAM_SIZES'], [STARTS, 'STUDIO_ONBOARDING_STARTS']]) {
    deepEq(plain(lib[key]).map(c => [c.id, c.label, ...(c.description ? [c.description] : [])]), table, `${label}: ${key}`)
  }
  const legacy = legacyLists()
  deepEq(plain(legacy.useCases).map(c => [c.id, c.label, c.description]), USE_CASES, `${label}: the use cases are the old page's`)
  deepEq(plain(legacy.roles).map(c => [c.id, c.label]), ROLES, `${label}: the roles are the old page's`)
  deepEq(plain(legacy.teamSizes).map(c => [c.id, c.label, c.description]), TEAMS, `${label}: the team sizes are the old page's`)
  for (const id of Object.keys(EXPECTED_PROMPTS)) deepEq(EXPECTED_PROMPTS[id].map(p => p.replace('next year', '2025')), plain(legacy.getPromptSuggestions(id)), `${label}: the ${id} prompts are the old page's (but for the year)`)
  deepEq(GENERIC, plain(legacy.getPromptSuggestions('')), `${label}: the generic prompts are the old page's`)
  deepEq(plain(lib.STUDIO_ONBOARDING_WELCOME_CARDS).map(c => [c.id, c.title, c.text]), [['director', 'The Director', 'Plans the deck with you in Chat.'], ['canvas', 'The canvas', 'Shows each slide as it is built, ready to refine.'], ['inspector', 'The Inspector', 'Edits what you select: the deck, a slide or an element.']], `${label}: the welcome cards`)
  // may continue
  deepEq([0, 1, 2, 3, 4].map(i => lib.studioOnboardingCanContinue(i, EMPTY)), [true, false, false, false, false], `${label}: only welcome continues with nothing chosen`)
  deepEq([0, 1, 2, 3, 4].map(i => lib.studioOnboardingCanContinue(i, FULL)), [true, true, true, true, true], `${label}: everything chosen continues`)
  for (let i = 1; i <= 4; i++) {
    const key = KEYS[i]
    for (const [id] of CHOICE_TABLE[key]) eq(lib.studioOnboardingCanContinue(i, { ...EMPTY, [key]: id }), true, `${label}: step ${i} continues on ${id}`)
    for (const wrong of ['x', ' ', 'SALES', 'toString', '__proto__', 'constructor']) eq(lib.studioOnboardingCanContinue(i, { ...EMPTY, [key]: wrong }), false, `${label}: step ${i} does not continue on ${JSON.stringify(wrong)}`)
    eq(lib.studioOnboardingCanContinue(i, { ...FULL, [key]: '' }), false, `${label}: step ${i} needs its own answer even when every other question is answered`)
  }
  eq(lib.studioOnboardingCanContinue(1, { ...EMPTY, useCase: 'scratch' }), false, `${label}: another question's choice is not a use case`)
  eq(lib.studioOnboardingCanContinue(4, { ...EMPTY, start: 'sales' }), false, `${label}: nor a starting point`)
  for (const i of [-1, 5, 99, NaN, 1.5]) eq(lib.studioOnboardingCanContinue(i, FULL), false, `${label}: no step ${i}`)
  // status line
  eq(lib.studioOnboardingStatus(0, EMPTY), 'You can skip this at any time.', `${label}: welcome status`)
  for (let i = 1; i <= 4; i++) {
    eq(lib.studioOnboardingStatus(i, EMPTY), 'Choose one to continue.', `${label}: step ${i} asks for a choice`)
    const [id, labelText] = CHOICE_TABLE[KEYS[i]][1]
    eq(lib.studioOnboardingStatus(i, { ...EMPTY, [KEYS[i]]: id }), `Selected: ${labelText}.`, `${label}: step ${i} names the choice`)
    eq(lib.studioOnboardingStatus(i, { ...EMPTY, [KEYS[i]]: 'x' }), 'Choose one to continue.', `${label}: step ${i}, an unknown value is not a choice`)
  }
  eq(lib.studioOnboardingStatus(9, FULL), '', `${label}: no status beyond the steps`)
  // prompts
  for (const [id, prompts] of Object.entries(EXPECTED_PROMPTS)) deepEq(lib.studioOnboardingPrompts(id), prompts, `${label}: prompts for ${id}`)
  for (const odd of ['', 'x', '__proto__', 'constructor', 'toString', 'hasOwnProperty', 'scratch']) deepEq(lib.studioOnboardingPrompts(odd), GENERIC, `${label}: generic prompts for ${JSON.stringify(odd)}`)
  nomatch(JSON.stringify([...Object.keys(EXPECTED_PROMPTS).map(id => lib.studioOnboardingPrompts(id)), lib.studioOnboardingPrompts('')]), /20\d\d/, `${label}: no year in a prompt`)
  // where the last button goes
  deepEq(lib.studioOnboardingDestination('template'), { href: '/studio/templates', label: 'Browse templates', text: 'The template library opens next. Pick a design to start from.' }, `${label}: template`)
  for (const start of ['scratch', '', 'x']) deepEq(lib.studioOnboardingDestination(start), { href: '/builder', label: 'Open Studio', text: 'Studio opens with the Director in Chat. Describe your deck to begin.' }, `${label}: Studio for ${JSON.stringify(start)}`)
  // recap
  deepEq(lib.studioOnboardingRecap(FULL), [{ label: 'Use', value: 'Sales Pitches' }, { label: 'Role', value: 'Founder/Entrepreneur' }, { label: 'Team', value: 'Just me' }, { label: 'Start', value: 'Create from scratch' }], `${label}: the recap, in the order asked`)
  deepEq(lib.studioOnboardingRecap({ useCase: 'startup', role: '', team: 'large', start: 'template' }), [{ label: 'Use', value: 'Startup Pitches' }, { label: 'Team', value: '50+ people' }, { label: 'Start', value: 'Use a template' }], `${label}: only what was chosen`)
  deepEq(lib.studioOnboardingRecap({ useCase: 'x', role: 'y', team: 'z', start: 'w' }), [], `${label}: nothing unknown`)
  eq(lib.studioOnboardingLabel('role', 'sales'), 'Sales Professional', `${label}: "sales" is a role too`)
  eq(lib.studioOnboardingLabel('useCase', 'sales'), 'Sales Pitches', `${label}: and a use case`)
  eq(lib.studioOnboardingLabel('start', 'sales'), '', `${label}: but not a starting point`)
  // words and links
  const words = plain(lib.STUDIO_ONBOARDING_WORDS)
  deepEq([words.next, words.back, words.finish, words.skip, words.openStudio, words.openTemplates, words.needChoice, words.doneTitle], ['Continue', 'Back', 'Finish', 'Skip to your decks', 'Open Studio', 'Browse templates', 'Choose one to continue.', 'You are ready.'], `${label}: the buttons' words`)
  eq(words.doneNote, 'Your answers are not saved to your account.', `${label}: the last screen says nothing is saved`)
  eq(words.promptsTitle, 'Prompts to try once you are in Studio', `${label}: the prompts are examples for Studio, not buttons`)
  eq(words.teamLarge, 'Teams of 50 or more: see the plans and pricing.', `${label}: the 50+ note points at the plans`)
  eq(lib.STUDIO_ONBOARDING_SKIP_HREF, '/dashboard', `${label}: skip goes to the decks`)
  eq(lib.STUDIO_ONBOARDING_PRICING_HREF, '/pricing', `${label}: plans are at /pricing`)
  nomatch(JSON.stringify([words, lib.STUDIO_ONBOARDING_STEPS, lib.STUDIO_ONBOARDING_WELCOME_CARDS]), /personaliz|recommend|SSO|Enterprise features|AI agents|Processing|Profile personalized|just 4|just a few|Scripter|Graphic Artist/i, `${label}: no sentence the page cannot keep`)
}
proveLib(SOURCES[LIB])

// ---------------------------------------------------------------- 2. the wizard
function mount(uiSource = SOURCES[UI], libSource = SOURCES[LIB]) {
  const react = makeReact()
  const lib = load(libSource, LIB)
  const mod = load(uiSource, UI, { deps: { react: react.api, '@/lib/studio-onboarding': lib } })
  const focus = []
  const view = {
    focus,
    render() { react.reset(); const tree = mod.StudioP2Onboarding(); const title = nodes(tree).find(n => n.type === 'h1'); if (title) title.props.ref.current ||= { focus: () => focus.push('title') }; react.flushEffects(); return tree },
    button(name) { const found = nodes(view.render()).filter(n => n.type === 'button' && text(n) === name); assert.equal(found.length, 1, `one button "${name}"`); return found[0] },
    click(name) { const button = view.button(name); if (!button.props.disabled) button.props.onClick() },
    pick(label) { const input = nodes(view.render()).filter(n => n.type === 'label' && text(n).startsWith(label)).flatMap(n => nodes(n).filter(m => m.type === 'input'))[0]; assert.ok(input, `a choice "${label}"`); input.props.onChange() },
  }
  return view
}
const links = tree => nodes(tree).filter(n => n.type === 'default')
const radios = tree => nodes(tree).filter(n => n.type === 'input' && n.props.type === 'radio')
const h1 = tree => text(nodes(tree).find(n => n.type === 'h1'))
const note = tree => text(nodes(tree).find(n => n.type === 'p' && /\bso-note\b/.test(n.props.className ?? '')))
async function proveUi(uiSource, libSource, label = 'wizard') {
  const view = mount(uiSource, libSource)
  const lib = load(libSource, LIB)
  // welcome
  let tree = view.render()
  const main = nodes(tree)[0]
  eq(main.type, 'main', `${label}: a main landmark`)
  eq(main.props['data-studio-p2-onboarding'], 'true', `${label}: carrying the page's marker`)
  eq(nodes(tree).filter(n => n.type === 'h1').length, 1, `${label}: one h1`)
  eq(h1(tree), 'Welcome to Deckster.', `${label}: welcome title`)
  eq(text(nodes(tree).find(n => n.props?.className === 'so-eyebrow')), 'Deckster / Studio · Step 1 of 5', `${label}: the step is named once, in the eyebrow`)
  eq(text(nodes(tree).find(n => n.type === 'header').props.children[2]), 'Four quick questions, then you are in Studio.', `${label}: welcome description`)
  const chapters = nodes(tree).filter(n => n.type === 'li')
  eq(chapters.length, 5, `${label}: five chapters`)
  deepEq(chapters.map(n => n.props['aria-current'] ?? null), ['step', null, null, null, null], `${label}: the first is current`)
  deepEq(chapters.map(text), ['1Welcome', '2Use', '3Role', '4Team', '5Start'], `${label}: chapter words`)
  eq(nodes(tree).find(n => n.type === 'ol').props['aria-label'], 'Setup steps', `${label}: the list has a name`)
  eq(nodes(tree).filter(n => n.type === 'article').length, 3, `${label}: three welcome cards`)
  deepEq(nodes(tree).filter(n => n.type === 'article').map(n => nodes(n)[1].type), ['MessageSquare', 'Layout', 'ListChecks'], `${label}: each welcome card has its icon`)
  deepEq(nodes(tree).filter(n => n.type === 'article').map(text), ['The DirectorPlans the deck with you in Chat.', 'The canvasShows each slide as it is built, ready to refine.', 'The InspectorEdits what you select: the deck, a slide or an element.'], `${label}: card words`)
  eq(radios(tree).length, 0, `${label}: no choices on welcome`)
  eq(note(tree), 'You can skip this at any time.', `${label}: welcome note`)
  eq(view.button('Continue').props.disabled, false, `${label}: welcome continues`)
  eq(nodes(tree).filter(n => n.type === 'button' && text(n) === 'Back').length, 0, `${label}: no Back on the first step`)
  const skip = links(tree).find(n => text(n) === 'Skip to your decks')
  eq(skip.props.href, '/dashboard', `${label}: skip goes to the decks`)
  eq(links(tree).length, 1, `${label}: the only link on welcome is skip`)
  eq(view.focus.length, 0, `${label}: the first paint does not move focus`)
  eq(nodes(tree).find(n => n.type === 'h1').props.tabIndex, -1, `${label}: the title can be focused`)
  eq(nodes(tree).find(n => n.type === 'h1').props['aria-live'], undefined, `${label}: and is not also announced as a live region`)
  eq(nodes(tree).find(n => n.type === 'section').props['aria-labelledby'], nodes(tree).find(n => n.type === 'h1').props.id, `${label}: the card is named by its title`)

  // every question step
  const stepWords = [['What will you use Deckster for?', 6, '2'], ['What is your role?', 8, '4'], ['How big is your team?', 4, '2'], ['Choose your starting point.', 2, '2']]
  const picks = ['Sales Pitches', 'Founder/Entrepreneur', 'Just me', 'Create from scratch']
  const names_ = new Set()
  for (let i = 0; i < 4; i++) {
    view.click('Continue')
    tree = view.render()
    eq(view.focus.length, i + 1, `${label}: step ${i + 2}: focus moved to the new title, once`)
    const [title, count_, columns] = stepWords[i]
    eq(h1(tree), title, `${label}: step ${i + 2} title`)
    eq(text(nodes(tree).find(n => n.props?.className === 'so-eyebrow')), `Deckster / Studio · Step ${i + 2} of 5`, `${label}: step ${i + 2} eyebrow`)
    deepEq(nodes(tree).filter(n => n.type === 'li').map(n => n.props['aria-current'] ?? null), [0, 1, 2, 3, 4].map(n => n === i + 1 ? 'step' : null), `${label}: step ${i + 2} is the current chapter`)
    deepEq(nodes(tree).filter(n => n.type === 'li').map(n => n.props['data-done'] ?? null), [0, 1, 2, 3, 4].map(n => n < i + 1 ? 'true' : null), `${label}: earlier chapters are marked done`)
    eq(radios(tree).length, count_, `${label}: step ${i + 2} choices`)
    const set = nodes(tree).find(n => n.type === 'fieldset')
    eq(set.props['data-columns'], columns, `${label}: step ${i + 2} columns`)
    eq(text(nodes(set).find(n => n.type === 'legend')), title, `${label}: the group is named by the question`)
    eq(nodes(set).find(n => n.type === 'legend').props.className, 'so-sr', `${label}: the name is for screen readers`)
    eq(new Set(radios(tree).map(n => n.props.name)).size, 1, `${label}: one radio group per step`)
    names_.add(radios(tree)[0].props.name)
    ok(radios(tree).every(n => n.props.checked === false), `${label}: nothing chosen yet`)
    ok(radios(tree).every(n => nodes(tree).some(l => l.type === 'label' && nodes(l).includes(n))), `${label}: every radio sits inside its label`)
    const go = i === 3 ? 'Finish' : 'Continue'
    eq(view.button(go).props.disabled, true, `${label}: step ${i + 2} cannot continue yet`)
    eq(note(tree), 'Choose one to continue.', `${label}: and says why`)
    view.click(go)
    view.button(go).props.onClick()
    eq(h1(view.render()), title, `${label}: a disabled ${go} does not move on, even when its handler is called`)
    eq(view.focus.length, i + 1, `${label}: and focus stays`)
    ok(nodes(tree).filter(n => n.type === 'button').every(n => n.props.type === 'button'), `${label}: every button is a plain button`)
    const labels = nodes(tree).filter(n => n.type === 'label')
    const iconTypes = labels.map(n => nodes(n).filter(m => m.props?.className === 'so-icon').flatMap(m => nodes(m).slice(1).map(x => x.type)))
    deepEq(iconTypes, [[['TrendingUp'], ['Palette'], ['GraduationCap'], ['BarChart3'], ['Sparkles'], ['Rocket']], Array(8).fill([]), Array(4).fill([]), [['FileText'], ['Layout']]][i], `${label}: step ${i + 2}: the icons each card has (none on a role: "sales" is a role too)`)
    ok(labels.every(n => nodes(n).some(m => m.type === 'Check')), `${label}: every card has its tick`)
    deepEq(labels.map(n => nodes(n).filter(m => m.type === 'wbr').length), i === 1 ? [0, 0, 0, 1, 0, 0, 0, 0] : labels.map(() => 0), `${label}: step ${i + 2}: a line may break after the slash in "Founder/Entrepreneur" and nowhere else`)
    if (i === 1) { const parts = nodes(labels[3]).find(m => m.type === 'b').props.children; deepEq([parts[0], parts[1].type, parts[2]], ['Founder/', 'wbr', 'Entrepreneur'], `${label}: the break comes right after the slash`) }
    deepEq(labels.map(n => nodes(n).filter(m => m.type === 'small').map(text).join('')), [CHOICE_TABLE[KEYS[i + 1]].map(c => c[2] ?? '')][0], `${label}: step ${i + 2}: the descriptions the cards show`)
    eq(nodes(tree).find(n => n.type === 'p' && /\bso-note\b/.test(n.props.className ?? '')).props.role, 'status', `${label}: the note is announced`)
    eq(nodes(tree).filter(n => n.type === 'button' && text(n) === 'Back').length, 1, `${label}: Back is there`)
    view.pick(picks[i])
    tree = view.render()
    eq(radios(tree).filter(n => n.props.checked).length, 1, `${label}: one choice is checked`)
    eq(view.button(go).props.disabled, false, `${label}: step ${i + 2} continues once chosen`)
    eq(note(tree), `Selected: ${picks[i]}.`, `${label}: and says what was chosen`)
  }
  eq(names_.size, 4, `${label}: every step has its own radio group`)
  // the starting-point step: prompts, finish
  tree = view.render()
  eq(nodes(tree).find(n => n.props?.className === 'so-prompts') !== undefined, true, `${label}: from scratch lists example prompts`)
  deepEq(nodes(tree).filter(n => n.type === 'li' && n.props.className === undefined && !n.props['aria-current'] && n.props['data-done'] === undefined).map(text), EXPECTED_PROMPTS.sales, `${label}: for the use case chosen`)
  eq(nodes(tree).filter(n => n.type === 'button' && /^→|Create a product/.test(text(n))).length, 0, `${label}: the prompts are not buttons that do nothing`)
  eq(text(nodes(tree).find(n => n.props?.className === 'so-prompts').props.children[0]), 'Prompts to try once you are in Studio', `${label}: prompts heading`)
  view.pick('Use a template')
  tree = view.render()
  eq(nodes(tree).some(n => n.props?.className === 'so-prompts'), false, `${label}: a template start has no prompts`)
  view.pick('Create from scratch')
  // Back keeps the choices
  view.click('Back')
  tree = view.render()
  eq(h1(tree), 'How big is your team?', `${label}: Back goes one step`)
  eq(radios(tree).find(n => n.props.checked)?.props.value, 'solo', `${label}: and keeps the choice`)
  view.click('Continue')
  // the large-team note
  view.click('Back'); view.pick('50+ people'); tree = view.render()
  const callout = nodes(tree).find(n => n.props?.className === 'so-callout')
  ok(callout, `${label}: 50+ shows the plans note`)
  eq(text(callout), 'Teams of 50 or more: see the plans and pricing. See plans', `${label}: its words`)
  eq(callout.props.role, 'status', `${label}: announced`)
  eq(links(callout)[0].props.href, '/pricing', `${label}: to the plans`)
  eq(text(links(callout)[0]), 'See plans', `${label}: link words`)
  for (const other of ['Just me', '2-10 people', '11-50 people']) { view.pick(other); eq(nodes(view.render()).some(n => n.props?.className === 'so-callout'), false, `${label}: no plans note for ${other}`) }
  view.pick('Just me'); view.click('Continue')
  // finish
  tree = view.render()
  eq(nodes(tree).filter(n => n.type === 'button' && text(n) === 'Continue').length, 0, `${label}: the last step does not say Continue`)
  const focusBefore = view.focus.length
  view.click('Finish')
  tree = view.render()
  eq(view.focus.length, focusBefore + 1, `${label}: focus moves to the last screen's title, once`)
  eq(h1(tree), 'You are ready.', `${label}: the last screen`)
  eq(text(nodes(tree).find(n => n.props?.className === 'so-eyebrow')), 'Deckster / Studio · All set', `${label}: its eyebrow`)
  eq(text(nodes(tree).find(n => n.type === 'header').props.children[2]), 'Studio opens with the Director in Chat. Describe your deck to begin.', `${label}: where it goes`)
  eq(nodes(tree).some(n => n.type === 'ol'), false, `${label}: no chapters on the last screen`)
  deepEq(nodes(tree).filter(n => n.type === 'div' && n.props.children?.[0]?.type === 'dt').map(text), ['UseSales Pitches', 'RoleFounder/Entrepreneur', 'TeamJust me', 'StartCreate from scratch'], `${label}: the recap`)
  eq(note(tree), 'Your answers are not saved to your account.', `${label}: nothing is saved, and it says so`)
  const open = links(tree).find(n => /Open Studio/.test(text(n)))
  eq(open.props.href, '/builder', `${label}: the last button is a link to Studio`)
  eq(open.props.className, 'so-next', `${label}: styled as the primary button`)
  eq(links(tree).find(n => text(n) === 'Skip to your decks').props.href, '/dashboard', `${label}: skip is still there`)
  eq(nodes(tree).filter(n => n.type === 'button').map(text).join('|'), 'Back', `${label}: only Back is a button`)
  eq(nodes(tree).find(n => n.type === 'dl').props.hidden, undefined, `${label}: the recap is shown`)
  eq(nodes(tree).filter(n => n.type === 'dt').length, 4, `${label}: all four rows`)
  eq(nodes(tree).find(n => n.props?.className === 'so-note').props.role, undefined, `${label}: the last screen's note is plain text`)
  // Back from the last screen
  const focusDone = view.focus.length
  view.click('Back')
  tree = view.render()
  eq(view.focus.length, focusDone + 1, `${label}: focus moves back to the step's title`)
  eq(h1(tree), 'Choose your starting point.', `${label}: Back from the last screen`)
  eq(radios(tree).find(n => n.props.checked)?.props.value, 'scratch', `${label}: keeps the choice`)
  view.pick('Use a template'); view.click('Finish'); tree = view.render()
  eq(links(tree).find(n => /Browse templates/.test(text(n))).props.href, '/studio/templates', `${label}: a template start opens the library in the shell`)
  eq(text(nodes(tree).find(n => n.type === 'header').props.children[2]), 'The template library opens next. Pick a design to start from.', `${label}: its words`)
  eq(nodes(tree).filter(n => n.type === 'div' && n.props.children?.[0]?.type === 'dt').map(text).at(-1), 'StartUse a template', `${label}: the recap follows the choice`)
  // Back at the first step does nothing below zero
  const fresh = mount(uiSource, libSource)
  fresh.render()
  fresh.click('Continue'); fresh.click('Back')
  eq(h1(fresh.render()), 'Welcome to Deckster.', `${label}: Back returns to welcome`)
  // a prompt list for each use case on the last step
  for (const [id, labelText] of USE_CASES.map(c => [c[0], c[1]])) {
    const run = mount(uiSource, libSource); run.render(); run.click('Continue'); run.pick(labelText); run.click('Continue'); run.pick('Marketer'); run.click('Continue'); run.pick('Just me'); run.click('Continue'); run.pick('Create from scratch')
    deepEq(nodes(run.render()).filter(n => n.type === 'li' && n.props.className === undefined && !n.props['aria-current'] && n.props['data-done'] === undefined).map(text), EXPECTED_PROMPTS[id], `${label}: prompts follow ${id}`)
  }
  // source: nothing but this component's own classes, no timer / network / storage
  const ui = uiSource
  nomatch(ui, /setTimeout|setInterval|fetch\(|localStorage|sessionStorage|router\.push|useRouter|Progress|Dialog|bg-|text-(?:purple|blue|pink|slate|gray)|from-|to-|dark:|border-(?:purple|border)/, `${label}: no timer, network, storage, dialog or utility class`)
  const classNames = [...ui.matchAll(/className="([^"]+)"/g)].map(m => m[1])
  ok(classNames.length > 20 && classNames.every(c => c.split(' ').every(part => /^so-[a-z-]+$/.test(part))), `${label}: every class is the wizard's own`)
  match(ui, /^"use client"/, `${label}: a client component`)
  void lib
}
await proveUi(SOURCES[UI], SOURCES[LIB])

// ---------------------------------------------------------------- 3. the wiring
const CHILD = { type: 'the-old-page', props: {} }
function proveLayout(source, label = 'layout') {
  const layout = env => load(source, LAYOUT, { env }).default({ children: CHILD })
  const on = layout({ [FLAG]: 'true', [SHELL]: 'true' })
  eq(on.type, 'StudioP2Onboarding', `${label}: flag + shell: the wizard`)
  eq(Object.keys(on.props).length, 0, `${label}: with no props`)
  for (const env of [{}, { [FLAG]: 'true' }, { [SHELL]: 'true' }, { [FLAG]: 'false', [SHELL]: 'true' }, { [FLAG]: '', [SHELL]: 'true' }, { [FLAG]: 'TRUE', [SHELL]: 'true' }, { [FLAG]: '1', [SHELL]: 'true' }, { [FLAG]: 'true ', [SHELL]: 'true' },
    { [FLAG]: 'true', [SHELL]: 'false' }, { [FLAG]: 'true', [SHELL]: 'TRUE' }, { [FLAG]: 'true', [SHELL]: '1' }, { [FLAG]: 'true', [SHELL]: '' }]) {
    eq(layout(env), CHILD, `${label}: ${JSON.stringify(env)}: the old page, handed through untouched`)
  }
  nomatch(source, /^"use client"|^'use client'/, `${label}: a server layout`)
  eq(source.split('\n').filter(line => line.startsWith('import ')).length, 2, `${label}: imports only the types and the wizard`)
}
proveLayout(SOURCES[LAYOUT])
function proveIdentity(label = 'identity') {
  eq(read(PAGE), baseSource(PAGE), `${label}: app/onboarding/page.tsx is the base commit's file, byte for byte`)
}
proveIdentity()

// ---------------------------------------------------------------- 4. the CSS
const selectorsOf = css => { const out = []; postcss.parse(css).walkRules(rule => out.push([rule.selector, rule])); return out }
const declsOf = css => { const out = []; postcss.parse(css).walkDecls(decl => out.push(decl)); return out }
const hexToLum = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const contrast = (a, b) => { const [hi, lo] = [hexToLum(a), hexToLum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05) }
const expandHex = v => /^#[0-9a-f]{3}$/i.test(v) ? `#${[...v.slice(1)].map(c => c + c).join('')}` : v
function tokens(css, selector) {
  const rule = selectorsOf(css).find(([sel]) => sel === selector)?.[1]
  return Object.fromEntries((rule?.nodes ?? []).filter(n => n.prop?.startsWith('--so-')).map(n => [n.prop, expandHex(n.value)]))
}
function proveCss(css, label = 'css') {
  const rules = selectorsOf(css)
  ok(rules.length > 60, `${label}: has its rules`)
  const ROOT = '[data-studio-p2-onboarding="true"]', DARK = '.dark [data-studio-p2-onboarding="true"]'
  for (const [selector, rule] of rules) {
    if (rule.parent?.type === 'atrule' && rule.parent.name === 'keyframes') continue
    for (const part of rule.selectors) ok(part.startsWith(`${ROOT} `) || part === ROOT || part === DARK, `${label}: scoped to the page's marker: ${part}`)
  }
  const light = tokens(css, ROOT), dark = tokens(css, DARK)
  const NAMES = ['--so-frame', '--so-panel', '--so-soft', '--so-active', '--so-line', '--so-text', '--so-muted', '--so-teal', '--so-on-teal', '--so-accent']
  deepEq(Object.keys(light), NAMES, `${label}: the light tokens`)
  deepEq(Object.keys(dark), NAMES, `${label}: every token has a dark value`)
  // the Studio introduction's own palette (studio-onboarding.css) is the source of the shared tokens
  const intro = read(CSS_INTRO)
  const introLight = tokens(intro, '[data-studio-v4-shell="true"][data-studio-onboarding="true"]'), introDark = tokens(intro, '.dark [data-studio-v4-shell="true"][data-studio-onboarding="true"]')
  for (const name of ['--so-panel', '--so-soft', '--so-line', '--so-text', '--so-muted', '--so-teal', '--so-accent']) {
    eq(light[name], introLight[name], `${label}: ${name} is the Studio introduction's (light)`)
    eq(dark[name], introDark[name], `${label}: ${name} is the Studio introduction's (dark)`)
  }
  eq(dark['--so-on-teal'], '#14221c', `${label}: dark text on the teal button is the introduction's`)
  eq(light['--so-frame'], '#e8f0ed', `${label}: the shell's frame colour (light)`)
  eq(dark['--so-frame'], '#1a2624', `${label}: the shell's frame colour (dark)`)
  for (const [mode, t] of [['light', light], ['dark', dark]]) {
    for (const [fg, bg, name] of [['--so-text', '--so-panel', 'text on the card'], ['--so-muted', '--so-panel', 'muted text on the card'], ['--so-muted', '--so-soft', 'muted text on a soft tile'], ['--so-text', '--so-soft', 'text on a soft tile'], ['--so-teal', '--so-panel', 'teal on the card'],
      ['--so-teal', '--so-soft', 'teal on a soft tile'], ['--so-teal', '--so-active', 'teal on a chosen tile'], ['--so-text', '--so-active', 'text on a chosen tile'], ['--so-on-teal', '--so-teal', 'the primary button'], ['--so-accent', '--so-soft', 'the current chapter'], ['--so-accent', '--so-panel', 'a link and a focus ring']]) {
      ok(contrast(t[fg], t[bg]) >= 4.5, `${label}: ${mode}: ${name} is at least 4.5:1 (${contrast(t[fg], t[bg]).toFixed(2)})`)
    }
  }
  for (const [mode, t] of [['light', light], ['dark', dark]]) { ok(t['--so-active'] !== t['--so-panel'] && t['--so-active'] !== t['--so-soft'], `${label}: ${mode}: a chosen card's tint is its own colour`); ok(contrast(t['--so-active'], t['--so-panel']) >= 1.08, `${label}: ${mode}: and shows against the card (${contrast(t['--so-active'], t['--so-panel']).toFixed(2)})`) }
  ok(contrast(light['--so-line'], light['--so-panel']) >= 1.1 && contrast(dark['--so-line'], dark['--so-panel']) >= 1.5, `${label}: the line is visible on the card`)
  for (const decl of declsOf(css)) {
    for (const [, name] of decl.value.matchAll(/var\((--[a-z-]+)/g)) ok(NAMES.includes(name), `${label}: ${decl.prop}: token ${name} exists`)
    if (decl.parent?.selector === ROOT || decl.parent?.selector === DARK) continue
    ok(!/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i.test(decl.value), `${label}: no literal colour outside the token blocks (${decl.prop}: ${decl.value})`)
  }
  const decl = (selector, prop, media) => rules.find(([sel, rule]) => sel === `${ROOT} ${selector}` && (media ? rule.parent?.type === 'atrule' && rule.parent.params === media : rule.parent?.type === 'root'))?.[1].nodes.find(node => node.prop === prop)?.value
  eq(decl('.so-card', 'border-radius'), '18px', `${label}: the Studio panel's radius`)
  eq(decl('.so-card', 'border'), '1px solid var(--so-line)', `${label}: and hairline`)
  eq(decl('.so-card', 'background'), 'var(--so-panel)', `${label}: on the panel colour`)
  eq(decl('.so-card', 'width'), 'min(740px, 100%)', `${label}: as wide as the Studio introduction`)
  eq(rules.find(([sel]) => sel === ROOT)[1].nodes.find(n => n.prop === 'background').value, 'var(--so-frame)', `${label}: the page is the frame colour`)
  eq(rules.find(([sel]) => sel === ROOT)[1].nodes.find(n => n.prop === 'min-height').value, '100dvh', `${label}: and fills the window`)
  eq(decl('.so-eyebrow', 'font-size'), '10px', `${label}: eyebrow size`)
  eq(decl('.so-eyebrow', 'letter-spacing'), '.12em', `${label}: eyebrow tracking`)
  eq(decl('.so-eyebrow', 'color'), 'var(--so-teal)', `${label}: eyebrow colour`)
  eq(decl('.so-header h1', 'font-size'), '27px', `${label}: title size`)
  eq(decl('.so-header h1', 'font-weight'), '600', `${label}: title weight`)
  eq(decl('.so-header h1', 'letter-spacing'), '-.025em', `${label}: title tracking`)
  eq(decl('.so-header p', 'color'), 'var(--so-muted)', `${label}: description colour`)
  eq(decl('.so-header p', 'font-size'), '13px', `${label}: description size`)
  eq(decl('.so-header h1:focus-visible', 'outline'), '2px solid var(--so-accent)', `${label}: keyboard focus on the title is visible`)
  eq(decl('.so-header h1:focus', 'outline'), 'none', `${label}: mouse focus on the title is not`)
  eq(decl('.so-choice input', 'opacity'), '0', `${label}: the real radio is invisible but covers the card`)
  eq(decl('.so-choice input', 'inset'), '0', `${label}: all of it`)
  eq(decl('.so-choice input:checked + .so-face', 'border-color'), 'var(--so-teal)', `${label}: a chosen card is teal`)
  eq(decl('.so-choice input:checked + .so-face', 'background'), 'var(--so-active)', `${label}: and tinted`)
  eq(decl('.so-choice input:focus-visible + .so-face', 'outline'), '2px solid var(--so-accent)', `${label}: a focused card has a visible ring`)
  eq(decl('.so-choice input:hover + .so-face', 'background'), 'var(--so-soft)', `${label}: a hovered card is soft`)
  eq(decl('.so-choice input:checked + .so-face .so-check', 'opacity'), '1', `${label}: a chosen card shows its tick`)
  eq(decl('.so-check', 'opacity'), '0', `${label}: others do not`)
  eq(decl('.so-choice input:checked + .so-face .so-icon', 'background'), 'var(--so-teal)', `${label}: a chosen card's icon is the teal tile`)
  eq(decl('.so-choices[data-columns="2"]', 'grid-template-columns'), 'repeat(2, minmax(0, 1fr))', `${label}: two columns`)
  eq(decl('.so-choices[data-columns="4"]', 'grid-template-columns'), 'repeat(4, minmax(0, 1fr))', `${label}: four columns`)
  eq(decl('.so-cards', 'grid-template-columns'), 'repeat(3, minmax(0, 1fr))', `${label}: three welcome cards`)
  eq(decl('.so-next', 'background'), 'var(--so-teal)', `${label}: the primary button is teal`)
  eq(decl('.so-next', 'color'), 'var(--so-on-teal)', `${label}: with its own ink`)
  eq(decl('.so-next:disabled', 'opacity'), '.45', `${label}: a disabled Continue is dimmed`)
  eq(decl('.so-next:disabled', 'cursor'), 'not-allowed', `${label}: and says so`)
  eq(decl(':is(.so-skip, .so-back, .so-next)', 'min-height'), '36px', `${label}: a comfortable target`)
  eq(decl(':is(.so-skip, .so-back, .so-next):focus-visible', 'outline'), '2px solid var(--so-accent)', `${label}: buttons and links show keyboard focus`)
  eq(decl('.so-prompts li', 'background'), 'var(--so-panel)', `${label}: prompts are plain rows`)
  eq(decl('.so-prompts li', 'cursor'), undefined, `${label}: and do not look clickable`)
  eq(decl('.so-note', 'color'), 'var(--so-muted)', `${label}: the note is muted`)
  eq(decl('.so-sr', 'clip'), 'rect(0 0 0 0)', `${label}: the group name is visually hidden`)
  eq(decl('.so-footer', 'flex-wrap'), 'wrap', `${label}: the footer wraps`)
  // short windows and phones
  eq(decl('.so-header h1', 'font-size', '(max-height: 650px)'), '23px', `${label}: a short window tightens the title`)
  eq(decl('.so-body', 'padding', '(max-height: 650px)'), '16px 22px', `${label}: and the body`)
  eq(rules.find(([sel, rule]) => sel === ROOT && rule.parent?.params === '(max-width: 620px)')?.[1].nodes.find(n => n.prop === 'padding')?.value, '12px 10px', `${label}: a phone gets a narrower frame`)
  eq(decl('.so-choices[data-columns="2"]', 'grid-template-columns', '(max-width: 620px)'), '1fr', `${label}: one column of choices on a phone`)
  eq(decl('.so-choices[data-columns="4"]', 'grid-template-columns', '(max-width: 620px)'), 'repeat(2, minmax(0, 1fr))', `${label}: two columns of roles on a phone`)
  eq(decl('.so-cards', 'grid-template-columns', '(max-width: 620px)'), '1fr', `${label}: the welcome cards stack on a phone`)
  eq(decl(':is(.so-skip, .so-back, .so-next)', 'min-height', '(max-width: 620px)'), '40px', `${label}: bigger targets on a phone`)
  eq(decl('.so-header h1', 'font-size', '(max-width: 620px)'), '23px', `${label}: a phone's title`)
  eq(decl('.so-face', 'transition', '(prefers-reduced-motion: reduce)'), 'none', `${label}: reduced motion`)
}
proveCss(SOURCES[CSS])

// ---------------------------------------------------------------- 5. env + package
// .env.example holds every flag's block, and later changes reuse this one's wording: the flag's OWN block is found by the flag, never by a phrase. It runs from the line after the previous variable's
// assignment to the end of this flag's own assignment line (the comment above it is inside), so no other flag's block can be read, or mutated, in its place.
function ownBlock(env) {
  const flagAt = env.indexOf(`${FLAG}=`)
  const before = env.slice(0, flagAt)
  const previous = [...before.matchAll(/^[A-Za-z_][A-Za-z0-9_]*=.*\n/gm)].pop()
  const start = previous ? previous.index + previous[0].length : 0
  const lineEnd = env.indexOf('\n', flagAt)
  return { start, end: lineEnd === -1 ? env.length : lineEnd + 1 }
}
function proveEnv(env, label = 'env') {
  match(env, new RegExp(`^${FLAG}="false"$`, 'm'), `${label}: documented, default off`)
  eq(env.split(`${FLAG}=`).length - 1, 1, `${label}: once`)
  const { start } = ownBlock(env)
  const block = env.slice(start, env.indexOf(`${FLAG}=`))
  match(block.trimStart(), /^# PASS2 ONBOARDING \(FRONTEND-1/, `${label}: under its own heading`)
  match(block, /exact "true"/, `${label}: says what turns it on`)
  match(block, /Needs the Studio shell \(NEXT_PUBLIC_STUDIO_V4_SHELL "true"/, `${label}: and that it needs the shell`)
  match(block, /READ AT BUILD TIME/, `${label}: and that it is read at build time`)
  match(block, /Nothing is sent or stored/, `${label}: and that nothing is sent or stored`)
  ok(start < env.indexOf(`${FLAG}=`), `${label}: with its comment above`)
}
function provePackage(pkg, label = 'package') {
  eq(JSON.parse(pkg).scripts['test:studio-p2-onboarding'], 'node scripts/test-studio-p2-onboarding.mjs', `${label}: registered`)
}
proveEnv(SOURCES[ENV]); provePackage(SOURCES[PKG])

// ---------------------------------------------------------------- 6. mutation check
const MUTANTS = []
const mutant = (file, name, from, to) => MUTANTS.push([file, name, from, to])
// lib
mutant(LIB, 'a fourth question word', "description: 'Four quick questions, then you are in Studio.'", "description: 'Three quick questions, then you are in Studio.'")
mutant(LIB, 'welcome title', "title: 'Welcome to Deckster.'", "title: 'Welcome to the Future of Presentations'")
mutant(LIB, 'step order', "{ id: 'role', chapter: 'Role', title: 'What is your role?', description: 'Pick the one closest to your work.' },\n  { id: 'team',", "{ id: 'team', chapter: 'Team', title: 'How big is your team?', description: 'Pick the size that fits.' },\n  { id: 'role',")
mutant(LIB, 'use-case title', "title: 'What will you use Deckster for?'", "title: 'What will you use it for?'")
mutant(LIB, 'role title', "title: 'What is your role?'", "title: 'Your role'")
mutant(LIB, 'team title', "title: 'How big is your team?'", "title: 'Team size?'")
mutant(LIB, 'start title', "title: 'Choose your starting point.'", "title: 'Choose your starting point'")
mutant(LIB, 'a use case dropped', "  { id: 'creative', label: 'Creative Projects', description: 'Portfolios and showcases' },\n", '')
mutant(LIB, 'a use case renamed', "label: 'Sales Pitches'", "label: 'Sales'")
mutant(LIB, 'a use case described differently', "description: 'Teach and train effectively'", "description: 'Teach well'")
mutant(LIB, 'a role dropped', "  { id: 'student', label: 'Student' },\n", '')
mutant(LIB, 'a role renamed', "label: 'Founder/Entrepreneur'", "label: 'Founder'")
mutant(LIB, 'a team size renamed', "label: '2-10 people'", "label: '2-9 people'")
mutant(LIB, 'a team size described differently', "description: 'Growing organization'", "description: 'Medium'")
mutant(LIB, 'scratch described as blank', "description: 'Open Studio and describe your deck to the Director'", "description: 'Start with a blank canvas'")
mutant(LIB, 'template start renamed', "label: 'Use a template'", "label: 'Templates'")
mutant(LIB, 'welcome card words', "text: 'Plans the deck with you in Chat.'", "text: 'Strategic planning'")
mutant(LIB, 'welcome card dropped', "  { id: 'inspector', title: 'The Inspector', text: 'Edits what you select: the deck, a slide or an element.' },\n", '')
mutant(LIB, 'empty answers', "{ useCase: '', role: '', team: '', start: '' }", "{ useCase: 'sales', role: '', team: '', start: '' }")
mutant(LIB, 'welcome needs a choice', "if (step.id === 'welcome') return true", "if (step.id === 'welcome') return false")
mutant(LIB, 'any text continues', "return studioOnboardingLabel(step.id, answers[step.id]) !== ''", "return answers[step.id] !== ''")
mutant(LIB, 'nothing continues', "return studioOnboardingLabel(step.id, answers[step.id]) !== ''", "return true")
mutant(LIB, 'unknown step continues', "const step = STUDIO_ONBOARDING_STEPS[stepIndex]\n  if (!step) return false\n  if (step.id === 'welcome') return true", "const step = STUDIO_ONBOARDING_STEPS[stepIndex]\n  if (!step) return true\n  if (step.id === 'welcome') return true")
mutant(LIB, 'a choice from another list continues', "return key === 'useCase' ? STUDIO_ONBOARDING_USE_CASES : key === 'role' ? STUDIO_ONBOARDING_ROLES : key === 'team' ? STUDIO_ONBOARDING_TEAM_SIZES : STUDIO_ONBOARDING_STARTS", "return [...STUDIO_ONBOARDING_USE_CASES, ...STUDIO_ONBOARDING_ROLES, ...STUDIO_ONBOARDING_TEAM_SIZES, ...STUDIO_ONBOARDING_STARTS]")
mutant(LIB, 'label of nothing', "?.label ?? ''", "?.label ?? 'None'")
mutant(LIB, 'welcome status', "if (step.id === 'welcome') return STUDIO_ONBOARDING_WORDS.welcomeNote", "if (step.id === 'welcome') return ''")
mutant(LIB, 'status without the label', "return label ? `${STUDIO_ONBOARDING_WORDS.chosen} ${label}.` : STUDIO_ONBOARDING_WORDS.needChoice", "return label ? STUDIO_ONBOARDING_WORDS.chosen : STUDIO_ONBOARDING_WORDS.needChoice")
mutant(LIB, 'status never asks', "return label ? `${STUDIO_ONBOARDING_WORDS.chosen} ${label}.` : STUDIO_ONBOARDING_WORDS.needChoice", "return `${STUDIO_ONBOARDING_WORDS.chosen} ${label}.`")
mutant(LIB, 'status beyond the steps', "if (!step) return ''\n  if (step.id === 'welcome') return STUDIO_ONBOARDING_WORDS.welcomeNote", "if (!step) return STUDIO_ONBOARDING_WORDS.needChoice\n  if (step.id === 'welcome') return STUDIO_ONBOARDING_WORDS.welcomeNote")
mutant(LIB, 'the year is back', "social media strategy deck for next year", "social media strategy deck for 2025")
mutant(LIB, 'the other year is back', "strategic planning presentation for next year", "strategic planning presentation for 2025")
mutant(LIB, 'a prompt changed', "'Make a brand positioning presentation'", "'Make a brand presentation'")
mutant(LIB, 'a prompt list dropped', "  creative: ['Create a creative portfolio showcasing recent work', 'Build a design case study presentation', 'Make an agency capabilities deck'],\n", '')
mutant(LIB, 'prototype keys are use cases', "return Object.prototype.hasOwnProperty.call(PROMPTS, useCase) ? PROMPTS[useCase] : GENERIC_PROMPTS", "return PROMPTS[useCase] ?? GENERIC_PROMPTS")
mutant(LIB, 'generic prompts changed', "'Build a compelling deck for...'", "'Build a deck for...'")
mutant(LIB, 'template goes to the public gallery', "const TEMPLATES_HREF = '/studio/templates'", "const TEMPLATES_HREF = '/templates'")
mutant(LIB, 'studio goes to the dashboard', "const STUDIO_HREF = '/builder'", "const STUDIO_HREF = '/dashboard'")
mutant(LIB, 'every start is a template', "return start === 'template'\n    ?", "return start !== 'x'\n    ?")
mutant(LIB, 'template words', "text: STUDIO_ONBOARDING_WORDS.doneTemplate }", "text: STUDIO_ONBOARDING_WORDS.doneScratch }")
mutant(LIB, 'scratch words', "text: STUDIO_ONBOARDING_WORDS.doneScratch }\n}", "text: STUDIO_ONBOARDING_WORDS.doneTemplate }\n}")
mutant(LIB, 'recap order', "{ label: 'Use', value: studioOnboardingLabel('useCase', answers.useCase) },\n    { label: 'Role',", "{ label: 'Role', value: studioOnboardingLabel('role', answers.role) },\n    { label: 'Use',")
mutant(LIB, 'recap keeps empty rows', ".filter(row => row.value)", ".filter(row => row)")
mutant(LIB, 'recap starts from the wrong list', "{ label: 'Start', value: studioOnboardingLabel('start', answers.start) },", "{ label: 'Start', value: studioOnboardingLabel('useCase', answers.start) },")
mutant(LIB, 'skip goes elsewhere', "export const STUDIO_ONBOARDING_SKIP_HREF = '/dashboard'", "export const STUDIO_ONBOARDING_SKIP_HREF = '/builder'")
mutant(LIB, 'plans elsewhere', "export const STUDIO_ONBOARDING_PRICING_HREF = '/pricing'", "export const STUDIO_ONBOARDING_PRICING_HREF = '/templates'")
mutant(LIB, 'skip words', "skip: 'Skip to your decks'", "skip: 'Skip to Dashboard'")
mutant(LIB, 'finish words', "finish: 'Finish'", "finish: \"Let's Go!\"")
mutant(LIB, 'done words', "doneTitle: 'You are ready.'", "doneTitle: \"You're All Set!\"")
mutant(LIB, 'a false promise is back', "doneNote: 'Your answers are not saved to your account.'", "doneNote: 'Profile personalized'")
mutant(LIB, 'enterprise claim is back', "teamLarge: 'Teams of 50 or more: see the plans and pricing.'", "teamLarge: 'Enterprise features available: Team collaboration, SSO, dedicated support, and more.'")
mutant(LIB, 'prompts are buttons again', "promptsTitle: 'Prompts to try once you are in Studio'", "promptsTitle: 'Try these prompts to get started:'")
mutant(LIB, 'need-a-choice words', "needChoice: 'Choose one to continue.'", "needChoice: ''")
mutant(LIB, 'lib imports', "export type StudioOnboardingKey", "import type { ReactNode } from 'react'\nexport type StudioOnboardingKey")
mutant(LIB, 'lib uses a timer', "export const STUDIO_ONBOARDING_SKIP_HREF", "export const later = (fn: () => void) => setTimeout(fn, 1000)\nexport const STUDIO_ONBOARDING_SKIP_HREF")
// the wizard
mutant(UI, 'not a client component', '"use client"\n', '')
mutant(UI, 'no main landmark', '<main data-studio-p2-onboarding="true">', '<div data-studio-p2-onboarding="true">')
mutant(UI, 'no marker', '<main data-studio-p2-onboarding="true">', '<main>')
mutant(UI, 'marker not true', '<main data-studio-p2-onboarding="true">', '<main data-studio-p2-onboarding="1">')
mutant(UI, 'card not named', 'aria-labelledby={`${baseId}-title`}', '')
mutant(UI, 'title not focusable', 'ref={titleRef} tabIndex={-1}>', 'ref={titleRef}>')
mutant(UI, 'title is live again', 'tabIndex={-1}>{title}', 'tabIndex={-1} aria-live="polite">{title}')
mutant(UI, 'title is not an h1', '<h1 id={`${baseId}-title`}', '<h2 id={`${baseId}-title`}')
mutant(UI, 'two h1s', '<article key={card.id}><Icon aria-hidden="true" /><h2>', '<article key={card.id}><Icon aria-hidden="true" /><h1>')
mutant(UI, 'step count is not the step list', 'Step ${stepIndex + 1} of ${STUDIO_ONBOARDING_STEPS.length}', 'Step ${stepIndex + 1} of 4')
mutant(UI, 'step not 1-based', 'Step ${stepIndex + 1} of', 'Step ${stepIndex} of')
mutant(UI, 'done eyebrow', '{done ? STUDIO_ONBOARDING_WORDS.eyebrowDone : `${STUDIO_ONBOARDING_WORDS.eyebrow}', '{done ? STUDIO_ONBOARDING_WORDS.eyebrow : `${STUDIO_ONBOARDING_WORDS.eyebrow}')
mutant(UI, 'done title', 'const title = done ? STUDIO_ONBOARDING_WORDS.doneTitle : step.title', 'const title = step.title')
mutant(UI, 'done description', 'const description = done ? destination.text : step.description', 'const description = step.description')
mutant(UI, 'chapters list unnamed', 'aria-label={STUDIO_ONBOARDING_WORDS.chapters}', '')
mutant(UI, 'chapters on the last screen', '{!done && <ol className="so-chapters"', '{true && <ol className="so-chapters"')
mutant(UI, 'current chapter not marked', 'aria-current={index === stepIndex ? "step" : undefined}', '')
mutant(UI, 'current chapter off by one', 'aria-current={index === stepIndex ? "step" : undefined}', 'aria-current={index === stepIndex + 1 ? "step" : undefined}')
mutant(UI, 'finished chapters not marked', 'data-done={index < stepIndex ? "true" : undefined}', '')
mutant(UI, 'chapter number', '<b>{index + 1}</b>', '<b>{index}</b>')
mutant(UI, 'welcome cards dropped', '{STUDIO_ONBOARDING_WELCOME_CARDS.map(card =>', '{[].map(card =>')
mutant(UI, 'welcome icons dropped', 'return <article key={card.id}><Icon aria-hidden="true" />', 'return <article key={card.id}>')
mutant(UI, 'welcome has choices', 'key === null ? <>', 'key === "x" ? <>')
mutant(UI, 'choices not a group', '<fieldset className="so-choices"', '<div className="so-choices"')
mutant(UI, 'group unnamed', '<legend className="so-sr">{step.title}</legend>', '')
mutant(UI, 'group name visible', '<legend className="so-sr">', '<legend>')
mutant(UI, 'choices not radios', 'type="radio" name', 'type="checkbox" name')
mutant(UI, 'one group for every step', 'name={`${baseId}-${key}`}', 'name={baseId}')
mutant(UI, 'radio outside its label', '<label key={choice.id} className="so-choice">', '<div key={choice.id} className="so-choice">')
mutant(UI, 'radio value', 'value={choice.id} checked', 'value={choice.label} checked')
mutant(UI, 'radio not controlled', 'checked={answers[key] === choice.id}', 'checked={false}')
mutant(UI, 'choice goes to the wrong question', 'onChange={() => choose(key, choice.id)}', 'onChange={() => choose("role", choice.id)}')
mutant(UI, 'choice replaces every answer', 'setAnswers(previous => ({ ...previous, [question]: id }))', 'setAnswers({ ...STUDIO_ONBOARDING_EMPTY, [question]: id })')
mutant(UI, 'choice icons dropped', '{Icon && <span className="so-icon">', '{false && <span className="so-icon">')
mutant(UI, 'no break after the slash', 'index < parts.length - 1 ? [`${part}/`, <wbr key={index} />] : [part])', 'index < parts.length - 1 ? [`${part}/`] : [part])')
mutant(UI, 'break before the slash', '[`${part}/`, <wbr key={index} />]', '[<wbr key={index} />, `${part}/`]')
mutant(UI, 'slash lost', '[`${part}/`, <wbr key={index} />]', '[part, <wbr key={index} />]')
mutant(UI, 'tick dropped', '<Check className="so-check" aria-hidden="true" />', '')
mutant(UI, 'description dropped', '{choice.description && <small>{choice.description}</small>}', '')
mutant(UI, 'roles in two columns', 'const TWO_COLUMN: readonly StudioOnboardingKey[] = ["useCase", "team", "start"]', 'const TWO_COLUMN: readonly StudioOnboardingKey[] = ["useCase", "role", "team", "start"]')
mutant(UI, 'team in four columns', 'const TWO_COLUMN: readonly StudioOnboardingKey[] = ["useCase", "team", "start"]', 'const TWO_COLUMN: readonly StudioOnboardingKey[] = ["useCase", "start"]')
mutant(UI, 'prompts for the wrong case', 'studioOnboardingPrompts(answers.useCase)', 'studioOnboardingPrompts(answers.role)')
mutant(UI, 'prompts for a template', '{key === "start" && answers.start === "scratch" && <div className="so-prompts">', '{key === "start" && <div className="so-prompts">')
mutant(UI, 'prompts never', '{key === "start" && answers.start === "scratch" && <div className="so-prompts">', '{false && <div className="so-prompts">')
mutant(UI, 'prompts are buttons', '<ul>{studioOnboardingPrompts(answers.useCase).map(prompt => <li key={prompt}>{prompt}</li>)}</ul>', '<ul>{studioOnboardingPrompts(answers.useCase).map(prompt => <li key={prompt}><button type="button">{prompt}</button></li>)}</ul>')
mutant(UI, 'prompts heading', '<h2>{STUDIO_ONBOARDING_WORDS.promptsTitle}</h2>', '')
mutant(UI, 'plans note for every team', '{key === "team" && answers.team === "large" &&', '{key === "team" &&')
mutant(UI, 'plans note never', '{key === "team" && answers.team === "large" &&', '{false &&')
mutant(UI, 'plans note not announced', '<p className="so-callout" role="status">', '<p className="so-callout">')
mutant(UI, 'plans link', '<Link href={STUDIO_ONBOARDING_PRICING_HREF}>{STUDIO_ONBOARDING_WORDS.teamLargeLink}</Link>', '<Link href="/templates">{STUDIO_ONBOARDING_WORDS.teamLargeLink}</Link>')
mutant(UI, 'note not announced', '<p className="so-note" role="status">{studioOnboardingStatus(stepIndex, answers)}</p>\n          </>}', '<p className="so-note">{studioOnboardingStatus(stepIndex, answers)}</p>\n          </>}')
mutant(UI, 'note missing on a question', '<p className="so-note" role="status">{studioOnboardingStatus(stepIndex, answers)}</p>\n          </>}', '</>}')
mutant(UI, 'welcome note missing', '</div>\n            <p className="so-note">{studioOnboardingStatus(stepIndex, answers)}</p>', '</div>')
mutant(UI, 'recap dropped', '<dl className="so-recap">', '<dl hidden className="so-recap">')
mutant(UI, 'recap row order', '<dt>{row.label}</dt><dd>{row.value}</dd>', '<dd>{row.value}</dd><dt>{row.label}</dt>')
mutant(UI, 'done note dropped', '<p className="so-note">{STUDIO_ONBOARDING_WORDS.doneNote}</p>', '')
mutant(UI, 'skip is a button', '<Link href={STUDIO_ONBOARDING_SKIP_HREF} className="so-skip">{STUDIO_ONBOARDING_WORDS.skip}</Link>', '<button type="button" className="so-skip">{STUDIO_ONBOARDING_WORDS.skip}</button>')
mutant(UI, 'skip goes elsewhere', 'href={STUDIO_ONBOARDING_SKIP_HREF}', 'href="/builder"')
mutant(UI, 'Back on the first step', '{stepIndex > 0 && <button', '{true && <button')
mutant(UI, 'Back is a submit', '<button type="button" className="so-back"', '<button className="so-back"')
mutant(UI, 'Back skips two', 'else setStepIndex(stepIndex - 1) }', 'else setStepIndex(stepIndex - 2) }')
mutant(UI, 'Back goes forward', 'else setStepIndex(stepIndex - 1) }', 'else setStepIndex(stepIndex + 1) }')
mutant(UI, 'Back from the last screen stays', 'const back = () => { if (done) setDone(false); else', 'const back = () => { if (done) setDone(true); else')
mutant(UI, 'Back from the last screen forgets', 'if (done) setDone(false); else', 'if (done) { setDone(false); setAnswers(STUDIO_ONBOARDING_EMPTY) } else')
mutant(UI, 'Continue ignores the rule', 'disabled={!canContinue} onClick={next}', 'onClick={next}')
mutant(UI, 'Continue always disabled', 'disabled={!canContinue} onClick={next}', 'disabled onClick={next}')
mutant(UI, 'next ignores the rule', 'const next = () => { if (!canContinue) return;', 'const next = () => {')
mutant(UI, 'next goes two steps', 'else setStepIndex(stepIndex + 1) }', 'else setStepIndex(stepIndex + 2) }')
mutant(UI, 'last step does not finish', 'if (last) setDone(true); else', 'if (last) setStepIndex(0); else')
mutant(UI, 'Finish words', '{last ? STUDIO_ONBOARDING_WORDS.finish : STUDIO_ONBOARDING_WORDS.next}', '{STUDIO_ONBOARDING_WORDS.next}')
mutant(UI, 'last step is not the last', 'const last = stepIndex === STUDIO_ONBOARDING_STEPS.length - 1', 'const last = stepIndex === STUDIO_ONBOARDING_STEPS.length')
mutant(UI, 'last button is a button', '<Link href={destination.href} className="so-next">', '<button type="button" className="so-next">')
mutant(UI, 'last button goes to Studio', '<Link href={destination.href} className="so-next">{destination.label}', '<Link href="/builder" className="so-next">{destination.label}')
mutant(UI, 'last button words', '{destination.label}<ArrowRight aria-hidden="true" /></Link>', 'Start<ArrowRight aria-hidden="true" /></Link>')
mutant(UI, 'destination from the wrong answer', 'studioOnboardingDestination(answers.start)', 'studioOnboardingDestination(answers.useCase)')
mutant(UI, 'focus never moves', 'titleRef.current?.focus()', '')
mutant(UI, 'focus moves on the first paint', 'if (shown.current.stepIndex === stepIndex && shown.current.done === done) return', 'if (false) return')
mutant(UI, 'focus ignores the last screen', '}, [stepIndex, done])', '}, [stepIndex])')
mutant(UI, 'focus effect without the last screen check', 'shown.current.stepIndex === stepIndex && shown.current.done === done', 'shown.current.stepIndex === stepIndex')
mutant(UI, 'a fake wait is back', 'const next = () => {', 'const next = () => { setTimeout(() => {}, 1000);')
mutant(UI, 'a dialog is back', 'import Link from "next/link"', 'import Link from "next/link"\nimport { Dialog } from "@/components/ui/dialog"')
mutant(UI, 'a utility class', '<main data-studio-p2-onboarding="true">\n      <section className="so-card"', '<main data-studio-p2-onboarding="true" className="bg-gradient-to-br">\n      <section className="so-card"')
mutant(UI, 'a foreign class', '<ol className="so-chapters"', '<ol className="chapters"')
mutant(UI, 'storage used', 'const choose = (question', 'const keep = () => localStorage.setItem("onboarding", "1")\n  const choose = (question')
// wiring
mutant(LAYOUT, 'flag ignored', 'process.env.NEXT_PUBLIC_STUDIO_P2_ONBOARDING === "true" && process.env', 'true && process.env')
mutant(LAYOUT, 'shell ignored', '&& process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true")', '&& true)')
mutant(LAYOUT, 'flag truthy', 'process.env.NEXT_PUBLIC_STUDIO_P2_ONBOARDING === "true"', 'process.env.NEXT_PUBLIC_STUDIO_P2_ONBOARDING')
mutant(LAYOUT, 'flag case-insensitive', 'process.env.NEXT_PUBLIC_STUDIO_P2_ONBOARDING === "true"', 'process.env.NEXT_PUBLIC_STUDIO_P2_ONBOARDING?.toLowerCase() === "true"')
mutant(LAYOUT, 'shell truthy', 'process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true"', 'process.env.NEXT_PUBLIC_STUDIO_V4_SHELL')
mutant(LAYOUT, 'flag or shell', '=== "true" && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL', '=== "true" || process.env.NEXT_PUBLIC_STUDIO_V4_SHELL')
mutant(LAYOUT, 'old page replaced', 'return children\n', 'return null\n')
mutant(LAYOUT, 'old page wrapped', 'return children\n', 'return <div>{children}</div>\n')
mutant(LAYOUT, 'children passed to the wizard', 'return <StudioP2Onboarding />', 'return <StudioP2Onboarding>{children}</StudioP2Onboarding>')
mutant(LAYOUT, 'client layout', 'import type { ReactNode } from "react"', '"use client"\nimport type { ReactNode } from "react"')
// css (the page's own rules)
mutant(CSS, 'an unscoped rule', '[data-studio-p2-onboarding="true"] .so-note {', '.so-note {')
mutant(CSS, 'a rule scoped to the shell', '[data-studio-p2-onboarding="true"] .so-recap {', '[data-studio-v4-shell="true"] .so-recap {')
mutant(CSS, 'teal differs from the introduction', '--so-teal: #276f65;', '--so-teal: #1f6f72;')
mutant(CSS, 'dark teal differs', '--so-teal: #8acbb9;', '--so-teal: #83c4bd;')
mutant(CSS, 'accent differs', '--so-accent: #7358ba;', '--so-accent: #6a4fc0;')
mutant(CSS, 'dark accent differs', '--so-accent: #bca5ee;', '--so-accent: #b4a0f2;')
mutant(CSS, 'line differs', '--so-line: #d5e2da;', '--so-line: #dde5e2;')
mutant(CSS, 'dark line differs', '--so-line: #3b4d47;', '--so-line: #334245;')
mutant(CSS, 'panel differs', '--so-panel: #fff;', '--so-panel: #fafafa;')
mutant(CSS, 'dark panel differs', '--so-panel: #1c292a;', '--so-panel: #1b2426;')
mutant(CSS, 'soft differs', '--so-soft: #f0f5f2;', '--so-soft: #edf2f0;')
mutant(CSS, 'text differs', '--so-text: #293c35;', '--so-text: #243438;')
mutant(CSS, 'muted too pale', '--so-muted: #5e7269;', '--so-muted: #8aa095;')
mutant(CSS, 'dark muted too dark', '--so-muted: #adc0b5;', '--so-muted: #5e7269;')
mutant(CSS, 'dark text on the button too pale', '--so-on-teal: #14221c;', '--so-on-teal: #8acbb9;')
mutant(CSS, 'frame differs', '--so-frame: #e8f0ed;', '--so-frame: #ffffff;')
mutant(CSS, 'dark frame differs', '--so-frame: #1a2624;', '--so-frame: #000000;')
mutant(CSS, 'no dark tokens', '.dark [data-studio-p2-onboarding="true"] {\n  --so-frame: #1a2624;', '.light [data-studio-p2-onboarding="true"] {\n  --so-frame: #1a2624;')
mutant(CSS, 'chosen tint invisible in dark', '--so-active: #1f3b39;', '--so-active: #1c292a;')
mutant(CSS, 'literal colour in a rule', 'border: 1px solid var(--so-line); border-radius: 18px; background: var(--so-panel);', 'border: 1px solid #d5e2da; border-radius: 18px; background: var(--so-panel);')
mutant(CSS, 'unknown token', 'color: var(--so-muted); }\n[data-studio-p2-onboarding="true"] .so-recap dd', 'color: var(--so-faint); }\n[data-studio-p2-onboarding="true"] .so-recap dd')
mutant(CSS, 'card radius', 'border-radius: 18px;', 'border-radius: 8px;')
mutant(CSS, 'card width', 'width: min(740px, 100%);', 'width: min(900px, 100%);')
mutant(CSS, 'page not the frame colour', 'background: var(--so-frame); color: var(--so-text);', 'background: var(--so-panel); color: var(--so-text);')
mutant(CSS, 'page does not fill the window', 'min-height: 100dvh;', 'min-height: 0;')
mutant(CSS, 'title size', 'font-size: 27px; font-weight: 600;', 'font-size: 30px; font-weight: 700;')
mutant(CSS, 'title tracking', 'letter-spacing: -.025em;', 'letter-spacing: 0;')
mutant(CSS, 'eyebrow size', 'font-size: 10px; letter-spacing: .12em;', 'font-size: 12px; letter-spacing: .12em;')
mutant(CSS, 'eyebrow colour', 'font-weight: 700; color: var(--so-teal); }', 'font-weight: 700; color: var(--so-muted); }')
mutant(CSS, 'description colour', 'font-size: 13px; line-height: 1.65; color: var(--so-muted); }\n[data-studio-p2-onboarding="true"] .so-body', 'font-size: 13px; line-height: 1.65; color: var(--so-text); }\n[data-studio-p2-onboarding="true"] .so-body')
mutant(CSS, 'title focus ring gone', '.so-header h1:focus-visible { outline: 2px solid var(--so-accent);', '.so-header h1:focus-visible { outline: 0;')
mutant(CSS, 'title mouse focus ring', '.so-header h1:focus { outline: none; }', '.so-header h1:focus { outline: 2px solid var(--so-accent); }')
mutant(CSS, 'radio visible', 'z-index: 1; width: 100%; height: 100%; margin: 0; opacity: 0;', 'z-index: 1; width: 100%; height: 100%; margin: 0; opacity: 1;')
mutant(CSS, 'radio does not cover the card', '.so-choice input { position: absolute; inset: 0;', '.so-choice input { position: absolute; inset: auto;')
mutant(CSS, 'chosen border', '.so-choice input:checked + .so-face { border-color: var(--so-teal);', '.so-choice input:checked + .so-face { border-color: var(--so-line);')
mutant(CSS, 'chosen tint', 'input:checked + .so-face { border-color: var(--so-teal); background: var(--so-active); }', 'input:checked + .so-face { border-color: var(--so-teal); background: var(--so-panel); }')
mutant(CSS, 'no focus ring on a card', '.so-choice input:focus-visible + .so-face { outline: 2px solid var(--so-accent);', '.so-choice input:focus-visible + .so-face { outline: 0;')
mutant(CSS, 'hover', '.so-choice input:hover + .so-face { background: var(--so-soft); }', '.so-choice input:hover + .so-face { background: var(--so-panel); }')
mutant(CSS, 'tick always shown', '.so-check { position: absolute; top: 10px; right: 10px; width: 15px; height: 15px; color: var(--so-teal); opacity: 0; }', '.so-check { position: absolute; top: 10px; right: 10px; width: 15px; height: 15px; color: var(--so-teal); opacity: 1; }')
mutant(CSS, 'tick never shown', '.so-face .so-check { opacity: 1; }', '.so-face .so-check { opacity: 0; }')
mutant(CSS, 'chosen icon', '.so-face .so-icon { background: var(--so-teal); color: var(--so-on-teal); }', '.so-face .so-icon { background: var(--so-soft); color: var(--so-teal); }')
mutant(CSS, 'two columns', 'grid-template-columns: repeat(2, minmax(0, 1fr)); }\n[data-studio-p2-onboarding="true"] .so-choices[data-columns="4"]', 'grid-template-columns: repeat(3, minmax(0, 1fr)); }\n[data-studio-p2-onboarding="true"] .so-choices[data-columns="4"]')
mutant(CSS, 'four columns', '.so-choices[data-columns="4"] { grid-template-columns: repeat(4, minmax(0, 1fr)); }', '.so-choices[data-columns="4"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }')
mutant(CSS, 'welcome columns', '.so-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));', '.so-cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));')
mutant(CSS, 'primary button colour', '.so-next { gap: 8px; padding: 0 14px; background: var(--so-teal);', '.so-next { gap: 8px; padding: 0 14px; background: var(--so-accent);')
mutant(CSS, 'primary button ink', 'color: var(--so-on-teal); font-weight: 600; }\n[data-studio-p2-onboarding="true"] .so-next:hover', 'color: var(--so-text); font-weight: 600; }\n[data-studio-p2-onboarding="true"] .so-next:hover')
mutant(CSS, 'disabled looks enabled', '.so-next:disabled { opacity: .45; cursor: not-allowed; }', '.so-next:disabled { opacity: 1; cursor: not-allowed; }')
mutant(CSS, 'disabled cursor', '.so-next:disabled { opacity: .45; cursor: not-allowed; }', '.so-next:disabled { opacity: .45; cursor: pointer; }')
mutant(CSS, 'small targets', 'min-height: 36px; padding: 0 12px;', 'min-height: 24px; padding: 0 12px;')
mutant(CSS, 'no focus ring on buttons', ':is(.so-skip, .so-back, .so-next):focus-visible { outline: 2px solid var(--so-accent);', ':is(.so-skip, .so-back, .so-next):focus-visible { outline: 0;')
mutant(CSS, 'prompts look clickable', '.so-prompts li { padding: 8px 12px;', '.so-prompts li { cursor: pointer; padding: 8px 12px;')
mutant(CSS, 'prompts on the soft tile', 'border-radius: 8px; background: var(--so-panel); font-size: 12px; line-height: 1.6; }', 'border-radius: 8px; background: var(--so-soft); font-size: 12px; line-height: 1.6; }')
mutant(CSS, 'note colour', 'border-top: 1px solid var(--so-line); font-size: 12px; line-height: 1.65; color: var(--so-muted); }', 'border-top: 1px solid var(--so-line); font-size: 12px; line-height: 1.65; color: var(--so-text); }')
mutant(CSS, 'group name visible', 'clip: rect(0 0 0 0);', 'clip: auto;')
mutant(CSS, 'footer does not wrap', 'flex-wrap: wrap; align-items: center; justify-content: space-between;', 'flex-wrap: nowrap; align-items: center; justify-content: space-between;')
mutant(CSS, 'short window title', '.so-header h1 { font-size: 23px; }\n  [data-studio-p2-onboarding="true"] .so-body { padding: 16px 22px; }', '.so-header h1 { font-size: 27px; }\n  [data-studio-p2-onboarding="true"] .so-body { padding: 16px 22px; }')
mutant(CSS, 'short window body', '.so-body { padding: 16px 22px; }', '.so-body { padding: 22px 26px; }')
mutant(CSS, 'phone frame', '[data-studio-p2-onboarding="true"] { padding: 12px 10px; }', '[data-studio-p2-onboarding="true"] { padding: 24px 16px; }')
mutant(CSS, 'phone choices', '.so-choices[data-columns="2"] { grid-template-columns: 1fr; gap: 9px; }', '.so-choices[data-columns="2"] { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }')
mutant(CSS, 'phone roles', '.so-choices[data-columns="4"] { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }', '.so-choices[data-columns="4"] { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 9px; }')
mutant(CSS, 'phone welcome cards', '.so-cards { grid-template-columns: 1fr; gap: 9px; }', '.so-cards { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; }')
mutant(CSS, 'phone targets', ':is(.so-skip, .so-back, .so-next) { min-height: 40px; }', ':is(.so-skip, .so-back, .so-next) { min-height: 36px; }')
mutant(CSS, 'phone title', '.so-header h1 { font-size: 23px; }\n  [data-studio-p2-onboarding="true"] .so-body { padding: 18px; }', '.so-header h1 { font-size: 27px; }\n  [data-studio-p2-onboarding="true"] .so-body { padding: 18px; }')
mutant(CSS, 'motion not reduced', '.so-face { transition: none; }', '.so-face { transition: background-color .12s; }')
// env + package
mutant(ENV, 'default on', `${FLAG}="false"`, `${FLAG}="true"`)
mutant(ENV, 'shell not mentioned', 'Needs the Studio shell (NEXT_PUBLIC_STUDIO_V4_SHELL "true"', 'Works anywhere (NEXT_PUBLIC_STUDIO_V4_SHELL "true"')
mutant(ENV, 'build time not mentioned', 'READ AT BUILD TIME: set it on Vercel, then redeploy. On, /onboarding', 'read whenever. On, /onboarding')
mutant(ENV, 'nothing-stored claim dropped', 'Nothing is sent or stored;', 'Everything is stored;')
mutant(ENV, 'exact true not said', 'exact "true" enables it', 'any value enables it')
mutant(PKG, 'test registered to another file', 'node scripts/test-studio-p2-onboarding.mjs', 'node scripts/test-studio-p2-details.mjs')

let killed = 0
const survivors = [], crashed = []
counting = false
for (const [file, name, from, to] of MUTANTS) {
  const source = SOURCES[file]
  assert.ok(source.includes(from), `mutant "${name}": the text it replaces exists in ${file}`)
  let at = source.indexOf(from)
  if (file === ENV) { // .env.example holds every flag's block: the text is replaced inside this flag's own block, wherever else its wording is used
    const { start, end } = ownBlock(source), inBlock = source.slice(start, end).indexOf(from)
    assert.ok(inBlock !== -1, `mutant "${name}": the text it replaces is in ${FLAG}'s own block`)
    at = start + inBlock
  }
  const mutated = source.slice(0, at) + to + source.slice(at + from.length)
  assert.notEqual(mutated, source, `mutant "${name}" changes the source`)
  let survived = false
  try {
    if (file === LIB) { proveLib(mutated, name); await proveUi(SOURCES[UI], mutated, name) }
    else if (file === UI) await proveUi(mutated, SOURCES[LIB], name)
    else if (file === LAYOUT) proveLayout(mutated, name)
    else if (file === CSS) proveCss(mutated, name)
    else if (file === ENV) proveEnv(mutated, name)
    else if (file === PKG) provePackage(mutated, name)
    survived = true
  } catch (error) { if (error?.code !== 'ERR_ASSERTION') crashed.push(name); killed++ } // a mutant the page cannot survive (it throws) is detected too; it is counted apart
  if (survived) survivors.push(name)
}
counting = true
assert.deepEqual(survivors, [], `mutants survived: ${survivors.join(', ')}`)
eq(killed, MUTANTS.length)

console.log(`Studio P2 onboarding: ${checks} checks passed, ${killed}/${MUTANTS.length} mutants killed (${killed - crashed.length} by an assertion, ${crashed.length} by the code throwing); no network.`)
