// PASS2 profile menu (FRONTEND-1): the Studio account menu as the accepted v4 mockup has it. Flag NEXT_PUBLIC_STUDIO_P2_PROFILE_MENU (exact "true"), default off,
// and only where the Studio account presentation is on (NEXT_PUBLIC_STUDIO_V4_SHELL "true" and the palette prop).
//   PRO-02 avatar disc in the identity row (the tier badge stays, still only after the quota read)
//   PRO-04 "Your details" row   PRO-07 "Workspace & billing" row   PRO-08 "Keyboard shortcuts" row
//   PRO-05 "Dashboard" and "Knowledge" are not in the menu (the rail beside it has both)
//   PRO-06 Appearance is a Light / Dark / Auto control; Auto stores next-themes' "system"
//   PRO-03 "Your creative capacity": the mockup's card, always open, with the REAL daily and weekly shares left (two thin meters + when each resets)
//   PRO-10 "Settings & preferences", sentence case ("Sign out"), trailing chevrons
//
// Run: node scripts/test-studio-p2-profile-menu.mjs   (plain node: transpile + vm, no network, no browser, no env)
//   PRO-09 (Version history) is NOT built: nothing in Studio opens the viewer's version panel and the panel's message envelope is one the viewer ignores (see the PR).
//   P2_PROFILE_BASE=<commit> overrides the base commit flag-off identity is checked against (default fbc77c0, the studio-v4-dev-preparation-code tip the work started from).
//
// Proven on the REAL sources lib/studio-profile-menu.ts, components/user-profile-menu-p2.tsx, components/user-profile-menu.tsx and components/user-profile-menu-p2.css:
//   1. the helper is import-free; the words, routes (each is a real route file), order and the theme mapping are exact;
//   2. the P2 menu body (executed): identity, the usage card, rows in order with chevrons and their routes, the Appearance control and what it stores, About, Sign out;
//   3. the wiring in the real component (executed): only the exact flag + shell + palette renders the P2 body, with the real handlers; every other combination
//      renders the same tree as the base commit's component, before and after the quota read;
//   4. the CSS: every rule is scoped to the P2 menu's markers; the segmented control, disc and chevron rules are there;
//   5. mutation check: every mutant of the five sources is killed by sections 1-4.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import postcss from 'postcss'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const BASE_COMMIT = process.env.P2_PROFILE_BASE || 'fbc77c0430099ec7e11a188307ee5521b6937719'
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
const baseSource = rel => {
  try { return execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }) }
  catch (error) { throw new Error(`base commit ${BASE_COMMIT} is not in this clone (fetch the full history): ${error.message}`) }
}
let checks = 0
let counting = true
const count = fn => (...args) => { if (counting) checks++; return fn(...args) }
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value)) // values built inside the vm carry its realm's prototypes
const eq = count(assert.equal), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch), deepEq = count((actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message))

const LIB = 'lib/studio-profile-menu.ts'
const P2 = 'components/user-profile-menu-p2.tsx'
const PARENT = 'components/user-profile-menu.tsx'
const CSS = 'components/user-profile-menu-p2.css'
const ENV = '.env.example'
const SOURCES = { [LIB]: read(LIB), [P2]: read(P2), [PARENT]: read(PARENT), [CSS]: read(CSS), [ENV]: read(ENV) }
const FLAG = 'NEXT_PUBLIC_STUDIO_P2_PROFILE_MENU'

// ---------------------------------------------------------------- loading
const jsx = (type, props) => ({ type, props: props ?? {} })
const names = new Proxy({}, { get: (_target, key) => key })
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : value && typeof value === 'object' ? [value, ...nodes(value.props?.children)] : []
const text = value => Array.isArray(value) ? value.map(text).join('') : value == null || typeof value === 'boolean' ? '' : typeof value === 'object' ? text(value.props?.children) : String(value)
const rendered = value => JSON.stringify(value, (key, item) => key === 'children' && Array.isArray(item) ? item.filter(x => x !== false && x !== undefined && x !== null) : item)
const compile = (source, fileName) => {
  const out = ts.transpileModule(source, { fileName, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } })
  assert.equal((out.diagnostics ?? []).filter(x => x.category === ts.DiagnosticCategory.Error).length, 0, `${fileName} compiles`)
  return out.outputText
}
function loadLib(source) {
  const module = { exports: {} }
  new Function('module', 'exports', compile(source, LIB))(module, module.exports)
  return module.exports
}
function loadP2(source, lib) {
  const module = { exports: {} }
  const dependencies = { 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' }, '@/lib/studio-profile-menu': lib, './user-profile-menu-p2.css': {} }
  vm.runInNewContext(compile(source, P2), { module, exports: module.exports, require: name => {
    if (name in dependencies) return dependencies[name]
    if (name === 'lucide-react' || name.startsWith('@/components/')) return names
    assert.fail(`Unexpected import ${name}`)
  } })
  return module.exports
}

// ---------------------------------------------------------------- 1. the helper
const ROUTE_FILES = { '/studio/details': 'app/(app)/studio/details/page.tsx', '/settings': 'app/(app)/settings/page.tsx', '/shortcuts': 'app/(app)/shortcuts/page.tsx', '/billing': 'app/(app)/billing/page.tsx', '/help': 'app/help/page.tsx' }
const EXPECTED_LAYOUT = [
  { kind: 'row', id: 'details', label: 'Your details', href: '/studio/details' },
  { kind: 'appearance' },
  { kind: 'row', id: 'settings', label: 'Settings & preferences', href: '/settings' },
  { kind: 'row', id: 'shortcuts', label: 'Keyboard shortcuts', href: '/shortcuts' },
  { kind: 'row', id: 'billing', label: 'Workspace & billing', href: '/billing' },
  { kind: 'separator' },
  { kind: 'row', id: 'help', label: 'Help', href: '/help' },
]
function proveLib(source, label = 'lib') {
  nomatch(source, /^\s*(?:import\b|export\s+\*?\s*from\b)|require\(/m, `${label}: import-free`)
  const lib = loadLib(source)
  deepEq(JSON.parse(JSON.stringify(lib.STUDIO_APPEARANCE_OPTIONS)), [
    { value: 'light', label: 'Light', hint: 'Always light' },
    { value: 'dark', label: 'Dark', hint: 'Always dark' },
    { value: 'system', label: 'Auto', hint: 'Follows your system' },
  ], `${label}: the three appearance choices, Auto is next-themes' system`)
  for (const [theme, want] of [['light', 'light'], ['dark', 'dark'], ['system', 'system'], [undefined, 'light'], [null, 'light'], ['', 'light'], ['Dark', 'light'], ['auto', 'light'], ['SYSTEM', 'light'], ['sepia', 'light']]) eq(lib.studioAppearanceChoice(theme), want, `${label}: selected value for ${JSON.stringify(theme)}`)
  for (const [value, want] of [['light', 'light'], ['dark', 'dark'], ['system', 'system'], ['auto', null], ['Light', null], ['', null], [undefined, null], [null, null], ['dark ', null]]) eq(lib.studioAppearanceFromValue(value), want, `${label}: stored value for ${JSON.stringify(value)}`)
  deepEq(JSON.parse(JSON.stringify(lib.STUDIO_PROFILE_LAYOUT)), EXPECTED_LAYOUT, `${label}: the body in the mockup's order`)
  ok(!lib.STUDIO_PROFILE_LAYOUT.some(entry => entry.kind === 'row' && /dashboard|knowledge/i.test(`${entry.id} ${entry.label} ${entry.href}`)), `${label}: no Dashboard or Knowledge row (the rail has both)`)
  deepEq({ ...lib.STUDIO_PROFILE_WORDS }, { appearance: 'Appearance', about: 'About Studio', signOut: 'Sign out' }, `${label}: the other words`)
  for (const entry of lib.STUDIO_PROFILE_LAYOUT) if (entry.kind === 'row') ok(fs.existsSync(path.join(repoRoot, ROUTE_FILES[entry.href] ?? '__missing__')), `${label}: ${entry.href} is a real route`)
  proveUsageHelpers(lib, label)
  return lib
}

// PRO-03: the usage meters
const attempt = fn => { try { return fn() } catch (error) { return { threw: String(error) } } } // a mutant that crashes must fail an assertion, not the run
const NOW = new Date('2099-01-01T00:00:00Z')
const AT = hours => new Date(NOW.getTime() + hours * 3_600_000).toISOString()
const stamp = date => `D:${date.toISOString()}`
function proveUsageHelpers(lib, label) {
  deepEq({ ...lib.STUDIO_USAGE_WORDS }, { title: 'Your creative capacity', left: 'left', upgrade: 'Upgrade for more usage', upgradeHref: '/billing' }, `${label}: the usage words`)
  ok(fs.existsSync(path.join(repoRoot, ROUTE_FILES[lib.STUDIO_USAGE_WORDS.upgradeHref] ?? '__missing__')), `${label}: the upgrade link goes to a real route`)
  for (const [share, want] of [[0, 0], [1, 100], [.37, 37], [.82, 82], [.29, 29], [.005, 1], [.004, 0], [.125, 13], [.375, 38], [1.5, 100], [-.2, 0], [NaN, null], [Infinity, null], [-Infinity, null], ['0.5', null], ['', null], [null, null], [undefined, null], [{}, null], [true, null]]) {
    eq(attempt(() => lib.studioUsagePercent(share)), want, `${label}: percent left for ${String(share)}`)
  }
  for (const [resetAt, want] of [
    [AT(5.5), 'Resets in 5h'], [AT(1), 'Resets in 1h'], [AT(23.999), 'Resets in 23h'], [AT(.5), 'Resets in under 1h'], [AT(.999), 'Resets in under 1h'],
    [AT(24), `Resets ${stamp(new Date(AT(24)))}`], [AT(24 * 7), `Resets ${stamp(new Date(AT(24 * 7)))}`], [AT(0), 'Resets now'], [AT(-3), 'Resets now'],
    ['not a date', ''], ['', ''], [undefined, ''], [null, ''], [42, ''], [{}, ''],
  ]) eq(attempt(() => lib.studioUsageResetText(resetAt, NOW, stamp)), want, `${label}: reset text for ${String(resetAt)}`)
  match(attempt(() => lib.studioUsageResetText(AT(24 * 7 + 12), NOW)), /^Resets [A-Za-z]{3,4}\.? \d{1,2}$/, `${label}: the default date is a short month and day`)
  const quota = { remainingPct: { daily: .37, weekly: .82 }, resetAt: { daily: AT(5.5), weekly: AT(24 * 7) } }
  const meters = attempt(() => lib.studioUsageMeters(quota, NOW, stamp))
  deepEq(meters, [{ id: 'daily', label: 'Daily', percent: 37, reset: 'Resets in 5h' }, { id: 'weekly', label: 'Weekly', percent: 82, reset: `Resets ${stamp(new Date(AT(24 * 7)))}` }], `${label}: daily then weekly, real shares and reset times`)
  deepEq(attempt(() => lib.studioUsageMeters({ resetAt: quota.resetAt, remainingPct: { weekly: .82, daily: .37 } }, NOW, stamp)).map(m => m.id), ['daily', 'weekly'], `${label}: the order does not follow the read's key order`)
  deepEq(attempt(() => lib.studioUsageMeters({ remainingPct: { daily: .37, weekly: .82 } }, NOW, stamp)).map(m => m.reset), ['', ''], `${label}: no reset times in the read: no reset text`)
  deepEq(attempt(() => lib.studioUsageMeters({ remainingPct: { daily: .37, weekly: .82 }, resetAt: { daily: 'x' } }, NOW, stamp)).map(m => m.reset), ['', ''], `${label}: an unreadable or missing reset time: no reset text`)
  deepEq(attempt(() => lib.studioUsageMeters({ remainingPct: { daily: NaN, weekly: .5 }, resetAt: quota.resetAt }, NOW, stamp)).map(m => [m.id, m.percent]), [['weekly', 50]], `${label}: an unreadable share leaves its meter out`)
  deepEq(attempt(() => lib.studioUsageMeters({ remainingPct: { daily: .5, weekly: 'x' } }, NOW, stamp)).map(m => [m.id, m.percent]), [['daily', 50]], `${label}: an unreadable weekly share leaves its meter out`)
  for (const empty of [null, undefined, {}, { remainingPct: null }, { remainingPct: {} }, { remainingPct: { daily: 'a', weekly: null } }]) deepEq(attempt(() => lib.studioUsageMeters(empty, NOW, stamp)), [], `${label}: no meters for ${JSON.stringify(empty)}`)
  deepEq(attempt(() => lib.studioUsageMeters(quota)).map(m => m.id), ['daily', 'weekly'], `${label}: the clock and formatter are optional`)
}

// ---------------------------------------------------------------- 2. the P2 menu body
const account = { name: 'Ada Morgan', email: 'owned@example.invalid', image: null }
function proveBody(source, lib, label = 'body') {
  match(source, /^import "\.\/user-profile-menu-p2\.css"$/m, `${label}: the P2 body imports its own stylesheet`)
  const { StudioProfileMenuP2 } = loadP2(source, lib)
  const events = []
  const props = (extra = {}) => ({ ...account, initials: 'AM', tierLabel: undefined, theme: 'light', sessionUsage: undefined, quota: undefined, onTheme: v => events.push(['theme', v]), onNavigate: p => events.push(['navigate', p]), onAbout: () => events.push(['about']), onLogout: () => events.push(['logout']), ...extra })
  const tree = StudioProfileMenuP2(props())
  const all = nodes(tree)
  eq(tree.type, 'DropdownMenuContent', `${label}: root`)
  for (const [key, value] of Object.entries({ 'data-studio-v4-profile': 'true', 'data-studio-profile-fidelity': 'true', 'data-studio-p2-profile': 'true', side: 'right', sideOffset: 8, align: 'end', className: 'w-64' })) eq(tree.props[key], value, `${label}: root ${key}`)
  // identity: disc, name, email, no badge before the quota read
  const identity = all.find(x => x.type === 'DropdownMenuLabel' && x.props['data-studio-p2-identity'])
  ok(identity, `${label}: identity row`)
  eq(identity.props['data-studio-profile-identity'], 'true', `${label}: keeps the identity marker the 295px block styles`)
  const disc = nodes(identity).find(x => x.type === 'Avatar')
  ok(disc && disc.props['data-studio-p2-disc'] === 'true', `${label}: avatar disc`)
  eq(text(nodes(identity).find(x => x.type === 'AvatarFallback')), 'AM', `${label}: initials in the disc`)
  eq(nodes(identity).find(x => x.type === 'AvatarImage').props.src, undefined, `${label}: no photo, no src`)
  eq(nodes(identity).find(x => x.type === 'AvatarImage').props.alt, 'Ada Morgan', `${label}: photo alt is the name`)
  eq(text(nodes(identity).find(x => x.props?.['data-studio-profile-name'])), 'Ada Morgan', `${label}: name`)
  eq(text(nodes(identity).find(x => x.props?.['data-studio-profile-email'])), 'owned@example.invalid', `${label}: email`)
  ok(!nodes(identity).some(x => x.type === 'Badge'), `${label}: no badge before the quota read`)
  const withTier = nodes(StudioProfileMenuP2(props({ tierLabel: 'Pro', image: '/owned.png', name: null }))).filter(x => x.type === 'Badge' || x.type === 'AvatarImage')
  eq(withTier.find(x => x.type === 'Badge').props['data-studio-v4-profile-role'], 'tier', `${label}: badge keeps the tier role the palette styles`)
  eq(text(withTier.find(x => x.type === 'Badge')), 'Pro', `${label}: badge is the real tier label`)
  eq(withTier.find(x => x.type === 'AvatarImage').props.src, '/owned.png', `${label}: the account photo`)
  eq(withTier.find(x => x.type === 'AvatarImage').props.alt, 'User avatar', `${label}: alt without a name`)
  // rows in order
  const rows = all.filter(x => x.type === 'DropdownMenuItem')
  deepEq(rows.map(x => x.props['data-studio-p2-row']), ['details', 'settings', 'shortcuts', 'billing', 'help', 'about', undefined], `${label}: rows in order (last is Sign out)`)
  deepEq(rows.map(x => text(x)), ['Your details', 'Settings & preferences', 'Keyboard shortcuts', 'Workspace & billing', 'Help', 'About Studio', 'Sign out'], `${label}: row words`)
  for (const row of rows.slice(0, 6)) eq(row.props['data-studio-v4-profile-role'], 'item', `${label}: ${row.props['data-studio-p2-row']} keeps the item role the palette styles`)
  deepEq(rows.map(row => nodes(row).find(x => x.props?.className === 'mr-2 h-4 w-4')?.type), ['UserRound', 'SlidersHorizontal', 'Command', 'CreditCard', 'HelpCircle', 'Info', 'LogOut'], `${label}: row icons`)
  for (const row of rows.slice(0, 6)) ok(nodes(row).some(x => x.type === 'ChevronRight' && x.props['data-studio-p2-chevron'] === 'true'), `${label}: ${row.props['data-studio-p2-row']} has a trailing chevron`)
  ok(!nodes(rows[6]).some(x => x.type === 'ChevronRight'), `${label}: Sign out has no chevron`)
  for (const [id, href] of [['details', '/studio/details'], ['settings', '/settings'], ['shortcuts', '/shortcuts'], ['billing', '/billing'], ['help', '/help']]) {
    const before = events.length
    rows.find(x => x.props['data-studio-p2-row'] === id).props.onClick()
    deepEq(events.slice(before), [['navigate', href]], `${label}: ${id} goes to ${href}`)
  }
  for (const row of rows.slice(0, 5)) eq(row.props.onSelect, undefined, `${label}: ${row.props['data-studio-p2-row']} closes the menu like any item (no onSelect override)`)
  const about = rows[5]
  let prevented = 0
  about.props.onSelect({ preventDefault() { prevented++ } })
  eq(prevented, 1, `${label}: About keeps the menu from closing itself`)
  eq(events.at(-1)[0], 'about', `${label}: About calls the parent`)
  const signOut = rows[6]
  eq(signOut.props['data-studio-v4-profile-role'], 'danger', `${label}: Sign out keeps its danger role`)
  ok(/text-red-600/.test(signOut.props.className) && /dark:text-red-400/.test(signOut.props.className), `${label}: Sign out stays red`)
  const logoutProps = props()
  eq(nodes(StudioProfileMenuP2(logoutProps)).filter(x => x.type === 'DropdownMenuItem').at(-1).props.onClick, logoutProps.onLogout, `${label}: Sign out is the parent's logout`)
  for (const word of ['Dashboard', 'Knowledge', 'Dark Mode', 'Light Mode', 'Sign Out', 'Settings']) ok(!rows.some(x => text(x) === word), `${label}: no "${word}" row`)
  // order against the separators, the appearance block and the groups
  const order = tree.props.children.flat(Infinity).filter(x => x && typeof x === 'object')
  const orderOf = x => (x.type === 'DropdownMenuSeparator' ? 'sep' : x.type === 'DropdownMenuLabel' ? 'identity' : x.type === 'div' && x.props['data-studio-p2-appearance-block'] ? 'appearance' : x.type === 'div' && x.props['data-studio-p2-usage'] ? 'usage' : x.type === 'div' ? 'session' : x.type === 'DropdownMenuItem' ? (x.props['data-studio-p2-row'] ?? 'signout') : String(x.type))
  deepEq(order.map(orderOf), ['identity', 'sep', 'details', 'appearance', 'settings', 'shortcuts', 'billing', 'sep', 'help', 'about', 'sep', 'signout'], `${label}: the body's order`)
  const fullOrder = StudioProfileMenuP2(props({ quota: usageQuota(), sessionUsage: { type: 'S', props: {} } })).props.children.flat(Infinity).filter(x => x && typeof x === 'object')
  deepEq(fullOrder.map(orderOf), ['identity', 'usage', 'session', 'sep', 'details', 'appearance', 'settings', 'shortcuts', 'billing', 'sep', 'help', 'about', 'sep', 'signout'], `${label}: with the usage card and the session strip: card under the identity, strip under the card`)
  // appearance
  const group = all.find(x => x.type === 'DropdownMenuRadioGroup')
  ok(group && group.props['data-studio-p2-appearance'] === 'true', `${label}: appearance group`)
  eq(group.props['aria-labelledby'], 'studio-p2-appearance-label', `${label}: group is named by the eyebrow`)
  const eyebrow = all.find(x => x.props?.['data-studio-p2-eyebrow'])
  eq(eyebrow.props.id, 'studio-p2-appearance-label', `${label}: eyebrow id`)
  eq(text(eyebrow), 'Appearance', `${label}: eyebrow word`)
  const options = nodes(group).filter(x => x.type === 'DropdownMenuRadioItem')
  deepEq(options.map(x => [x.props.value, text(x), x.props.title]), [['light', 'Light', 'Always light'], ['dark', 'Dark', 'Always dark'], ['system', 'Auto', 'Follows your system']], `${label}: Light / Dark / Auto`)
  deepEq(options.map(x => nodes(x).find(n => n.props?.['aria-hidden'])?.type), ['Sun', 'Moon', 'Monitor'], `${label}: icons`)
  for (const option of options) {
    eq(option.props['data-studio-v4-profile-role'], 'item', `${label}: ${option.props.value} keeps the item role`)
    eq(option.props['data-studio-p2-appearance-option'], option.props.value, `${label}: ${option.props.value} marker`)
    let stop = 0
    option.props.onSelect({ preventDefault() { stop++ } })
    eq(stop, 1, `${label}: choosing ${option.props.value} keeps the menu open`)
  }
  for (const [theme, want] of [['light', 'light'], ['dark', 'dark'], ['system', 'system'], [undefined, 'light'], ['sepia', 'light']]) eq(nodes(StudioProfileMenuP2(props({ theme }))).find(x => x.type === 'DropdownMenuRadioGroup').props.value, want, `${label}: selected ${JSON.stringify(theme)}`)
  const changed = []
  const radio = nodes(StudioProfileMenuP2(props({ onTheme: v => changed.push(v) }))).find(x => x.type === 'DropdownMenuRadioGroup')
  for (const value of ['dark', 'system', 'light', 'auto', '', 'Dark']) radio.props.onValueChange(value)
  deepEq(changed, ['dark', 'system', 'light'], `${label}: only the three real values reach the theme`)
  // usage and session usage
  const plain = StudioProfileMenuP2(props()).props.children.flat(Infinity).filter(x => x && typeof x === 'object')
  ok(!plain.some(x => x.props?.['data-studio-session-usage']), `${label}: no session strip unless supplied`)
  const supplied = { type: 'SuppliedUsage', props: { children: 'Exact supplied session total' } }
  const strip = StudioProfileMenuP2(props({ sessionUsage: supplied })).props.children.flat(Infinity).find(x => x?.props?.['data-studio-session-usage'])
  ok(strip && strip.props.role === 'group' && strip.props['aria-label'] === 'Current session token usage' && strip.props.children === supplied, `${label}: the session strip is the supplied node, same wrapper`)
  proveUsageCard(StudioProfileMenuP2, props, label)
  eq(nodes(StudioProfileMenuP2(props())).filter(x => x.type === 'DropdownMenuSeparator').length, 3, `${label}: three separators without the card`)
  eq(nodes(StudioProfileMenuP2(props({ quota: usageQuota() }))).filter(x => x.type === 'DropdownMenuSeparator').length, 3, `${label}: the card adds no separator`)
}

// PRO-03: the card in the body
const usageQuota = () => ({ tierLabel: 'Actual supplied plan', remainingPct: { daily: .37, weekly: .82 }, resetAt: { daily: new Date(Date.now() + 5.5 * 3_600_000).toISOString(), weekly: new Date(Date.now() + (24 * 7 + 12) * 3_600_000).toISOString() }, flags: {}, caps: {}, spent: {} }) // the component reads the real clock
function proveUsageCard(StudioProfileMenuP2, props, label) {
  const find = (tree, marker) => nodes(tree).filter(x => x.props?.[marker] !== undefined)
  const first = (tree, marker, what) => { const [found] = find(tree, marker); ok(found, `${label}: ${what} exists`); return found }
  for (const quota of [undefined, null, {}, { remainingPct: null }, { remainingPct: { daily: 'x', weekly: NaN } }]) {
    const tree = StudioProfileMenuP2(props({ quota }))
    eq(find(tree, 'data-studio-p2-usage').length, 0, `${label}: no card for ${JSON.stringify(quota)}`)
    eq(find(tree, 'data-studio-p2-upgrade').length, 0, `${label}: no upgrade item without a card`)
  }
  const events = []
  const tree = StudioProfileMenuP2(props({ quota: usageQuota(), onNavigate: p => events.push(p) }))
  const [card, ...more] = find(tree, 'data-studio-p2-usage')
  ok(card && more.length === 0 && card.type === 'div', `${label}: one card, always open (no disclosure button)`)
  eq(card.props.role, 'group', `${label}: card is a group`)
  eq(card.props['aria-label'], 'Your creative capacity', `${label}: card is named`)
  eq(text(first(card, 'data-studio-p2-usage-title', 'card title')), 'Your creative capacity', `${label}: card title`)
  const meters = find(card, 'data-studio-p2-meter')
  deepEq(meters.map(x => x.props['data-studio-p2-meter']), ['daily', 'weekly'], `${label}: daily then weekly`)
  const wantMeters = [['Daily', '37% left', 37, 'Resets in 5h'], ['Weekly', '82% left', 82, null]]
  meters.forEach((meter, index) => {
    const [name, share, percent, reset] = wantMeters[index]
    const head = first(meter, 'data-studio-p2-meter-head', `${name} head`)
    deepEq([].concat(head.props.children).map(x => text(x)), [name, share], `${label}: ${name} head`)
    const bar = first(meter, 'data-studio-p2-meter-bar', `${name} bar`)
    eq(bar.props.role, 'progressbar', `${label}: ${name} bar is a progressbar`)
    eq(bar.props['aria-valuemin'], 0, `${label}: ${name} min`)
    eq(bar.props['aria-valuemax'], 100, `${label}: ${name} max`)
    eq(bar.props['aria-valuenow'], percent, `${label}: ${name} now`)
    eq(bar.props['aria-label'], `${name} usage left`, `${label}: ${name} bar name`)
    const fill = nodes(bar).find(x => x.type === 'i')
    ok(fill, `${label}: ${name} fill exists`)
    eq(fill.props.style.width, `${percent}%`, `${label}: ${name} fill width is the share left`)
    const small = nodes(meter).find(x => x.type === 'small')
    ok(small, `${label}: ${name} reset caption exists`)
    if (reset) eq(text(small), reset, `${label}: ${name} reset text`)
    else match(text(small), /^Resets /, `${label}: ${name} reset text starts with Resets`)
  })
  const upgrade = first(card, 'data-studio-p2-upgrade', 'the upgrade item')
  eq(upgrade.type, 'DropdownMenuItem', `${label}: the upgrade link is a real menu item (keyboard reachable)`)
  eq(upgrade.props['data-studio-v4-profile-role'], 'upgrade', `${label}: upgrade keeps the role the palette styles`)
  eq(text(upgrade), 'Upgrade for more usage', `${label}: upgrade word`)
  ok(nodes(upgrade).some(x => x.type === 'ChevronRight' && x.props['data-studio-p2-chevron'] === 'true'), `${label}: upgrade has the trailing chevron`)
  upgrade.props.onClick()
  deepEq(events, ['/billing'], `${label}: upgrade goes to billing through the parent`)
  // a single readable share: one meter, the card stays
  const one = StudioProfileMenuP2(props({ quota: { remainingPct: { daily: 'x', weekly: 0 } } }))
  deepEq(find(one, 'data-studio-p2-meter').map(x => x.props['data-studio-p2-meter']), ['weekly'], `${label}: an unreadable share has no meter`)
  ok(find(one, 'data-studio-p2-meter').length === 1 && nodes(find(one, 'data-studio-p2-meter')[0]).some(x => x.type === 'i'), `${label}: the 0 percent meter is there`)
  eq(nodes(find(one, 'data-studio-p2-meter')[0]).find(x => x.type === 'i').props.style.width, '0%', `${label}: 0 percent left is an empty meter, still shown`)
  eq([].concat(find(one, 'data-studio-p2-meter')[0].props.children).filter(Boolean).length, 2, `${label}: no reset text, no empty caption`)
}
// ---------------------------------------------------------------- 3. the wiring in the real component
const user = { id: 'owned', name: 'Ada Morgan', email: 'owned@example.invalid', image: '/owned-avatar.png' }
const quotaBody = { tierLabel: 'Actual supplied plan', remainingPct: { daily: .37, weekly: .82 }, flags: { dailyNear: true, dailyAt: false, weeklyNear: false, weeklyAt: false }, resetAt: { daily: '2099-01-01T00:00:00Z', weekly: '2099-01-08T00:00:00Z' }, caps: { dailyCents: 10, weeklyCents: 20 }, spent: { dailyCents: 6, weeklyCents: 3 } }
function harness({ code, shell = 'true', flag = 'true', palette = true, labels = true, theme = 'light', sessionUsage = { type: 'SuppliedSessionUsage', props: { children: 'Exact supplied session total' } } }) {
  const slots = [], effects = [], events = []; let cursor = 0, tree
  const environment = { theme }
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value }] },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
    useCallback: fn => fn,
    useEffect(fn, deps) { const i = cursor++, previous = slots[i]; if (!previous || deps.some((x, index) => x !== previous.deps[index])) { slots[i] = { deps }; effects.push(fn) } },
  }
  const dependencies = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' }, 'next/navigation': { useRouter: () => ({ push: path => events.push(['navigate', path]) }) },
    '@/hooks/use-auth': { useAuth: () => ({ user, isLoading: false, logout: async () => events.push(['logout']) }) },
    'next-themes': { useTheme: () => ({ theme: environment.theme, setTheme: next => { events.push(['theme', next]); environment.theme = next } }) },
    '@/lib/utils': { cn: (...args) => args.filter(Boolean).join(' ') }, './user-profile-studio-v4.css': {},
    '@/components/builder/studio-introduction': { useStudioAboutReplay: () => ({ onCloseAutoFocus: undefined, intro: null, requestFromAbout: undefined }) },
  }
  const mod = { exports: {} }
  const env = { NEXT_PUBLIC_STUDIO_V4_SHELL: shell === '__absent__' ? undefined : shell, NEXT_PUBLIC_STUDIO_P2_PROFILE_MENU: flag === '__absent__' ? undefined : flag }
  vm.runInNewContext(compile(code, PARENT), { module: mod, exports: mod.exports, Date, process: { env }, require: name => {
    if (name in dependencies) return dependencies[name]
    if (name === 'lucide-react' || name.startsWith('@/components/')) return names
    assert.fail(`Unexpected import ${name}`)
  }, fetch: async (url, options) => { events.push(['read', url, options]); return { ok: true, json: async () => quotaBody } } })
  const h = {
    events, environment,
    render() { cursor = 0; tree = mod.exports.UserProfileMenu({ studioLabels: labels, studioPalette: palette, sessionUsage }); return tree },
    get tree() { return tree },
    get content() { return nodes(tree).find(x => x.type === 'DropdownMenuContent') },
    get p2() { return nodes(tree).find(x => x.type === 'StudioProfileMenuP2') },
    get menu() { return nodes(tree).find(x => x.type === 'DropdownMenu') },
    async flush() { while (effects.length) effects.shift()(); for (let i = 0; i < 40; i++) await Promise.resolve(); h.render() },
    open(value) { h.menu.props.onOpenChange(value); return h.render() },
  }
  h.render(); return h
}
const NOT_ON = [['true', '__absent__'], ['true', ''], ['true', 'false'], ['true', 'TRUE'], ['true', '1'], ['true', ' true'], ['true', 'true ']]
async function proveWiring(parentSource, label = 'wiring') {
  const prior = baseSource(PARENT)
  // on: exact flag + literal shell + palette
  const on = harness({ code: parentSource })
  ok(on.p2 && !on.content, `${label}: on renders the P2 body and not the original content`)
  eq(on.p2.type, 'StudioProfileMenuP2', `${label}: P2 element`)
  for (const [key, want] of [['name', user.name], ['email', user.email], ['image', user.image], ['initials', 'AM'], ['theme', 'light'], ['tierLabel', undefined], ['quota', null]]) eq(on.p2.props[key], want, `${label}: prop ${key} before the quota read`)
  eq(on.p2.props.sessionUsage?.props?.children, 'Exact supplied session total', `${label}: the session usage node is passed through`)
  ok(!nodes(on.tree).some(x => x.props?.['data-studio-session-usage']), `${label}: the original session wrapper is not rendered twice`)
  on.open(true); await on.flush()
  deepEq(on.events.map(e => e.slice(0, 2)), [['read', '/api/usage/quota']], `${label}: the same single quota read on open`)
  eq(on.p2.props.tierLabel, 'Actual supplied plan', `${label}: tier label from the quota read`)
  deepEq(on.p2.props.quota?.remainingPct, quotaBody.remainingPct, `${label}: the card gets the real shares left`)
  deepEq(on.p2.props.quota?.resetAt, quotaBody.resetAt, `${label}: the card gets the real reset times`)
  eq(on.p2.props.usage, undefined, `${label}: no collapsed disclosure is passed (the card is always open)`)
  on.events.length = 0
  on.p2.props.onNavigate('/billing'); on.render()
  deepEq(on.events, [['navigate', '/billing']], `${label}: navigation goes through the router`)
  eq(on.menu.props.open, false, `${label}: navigation closes the menu`)
  on.open(true); on.events.length = 0
  on.p2.props.onTheme('system'); on.render()
  deepEq(on.events, [['theme', 'system']], `${label}: Auto stores system`)
  eq(on.p2.props.theme, 'system', `${label}: the control follows the stored theme`)
  eq(on.menu.props.open, true, `${label}: choosing a theme leaves the menu open`)
  on.p2.props.onAbout(); on.render()
  eq(on.menu.props.open, false, `${label}: About closes the menu`)
  eq(nodes(on.tree).find(x => x.type === 'StudioAboutDialog').props.open, true, `${label}: About opens the dialog`)
  on.open(true); on.events.length = 0
  await on.p2.props.onLogout(); on.render()
  deepEq(on.events, [['logout']], `${label}: sign out logs out`)
  eq(on.menu.props.open, false, `${label}: sign out closes the menu`)
  // every other combination is the base commit's component
  const combos = [...NOT_ON.map(([shell, flag]) => ({ shell, flag, palette: true })), { shell: 'true', flag: 'true', palette: false }, { shell: '__absent__', flag: 'true', palette: true }, { shell: 'false', flag: 'true', palette: true }, { shell: 'TRUE', flag: 'true', palette: true }, { shell: '', flag: 'true', palette: true }, { shell: 'true', flag: 'true', palette: null }]
  for (const combo of combos) {
    const tag = `${label}: shell ${JSON.stringify(combo.shell)} flag ${JSON.stringify(combo.flag)} palette ${combo.palette}`
    const h = harness({ code: parentSource, ...combo }), old = harness({ code: prior, ...combo })
    ok(!h.p2 && h.content, `${tag}: original content, no P2 body`)
    eq(rendered(h.tree), rendered(old.tree), `${tag}: tree equals the base commit's`)
    h.open(true); old.open(true); await h.flush(); await old.flush()
    eq(rendered(h.tree), rendered(old.tree), `${tag}: tree equals the base commit's after the quota read`)
    eq(JSON.stringify(h.events), JSON.stringify(old.events), `${tag}: same requests`)
  }
  // the original menu still has its rows (flag off keeps Dashboard / Knowledge / Dark Mode / Sign Out)
  const off = harness({ code: parentSource, flag: '__absent__' })
  const offRows = nodes(off.tree).filter(x => x.type === 'DropdownMenuItem').map(x => text(x))
  deepEq(offRows, ['Dashboard', 'Knowledge', 'Settings', 'Dark Mode', 'Help', 'About Studio', 'Sign Out'], `${label}: flag off keeps the original rows`)
  nomatch(parentSource, /user-profile-menu-p2\.css/, `${label}: the original component imports no P2 css (the palette file is untouched)`)
  match(parentSource, /import \{ StudioProfileMenuP2 \} from "@\/components\/user-profile-menu-p2"/, `${label}: imports the P2 body`)
  match(parentSource, /const p2Menu = studioProfile && process\.env\.NEXT_PUBLIC_STUDIO_P2_PROFILE_MENU === 'true'/, `${label}: flag read inline (Next inlines NEXT_PUBLIC at build), exact true, only inside the Studio account presentation`)
}

// ---------------------------------------------------------------- 4. the CSS
const SCOPE = '[data-studio-p2-profile="true"][data-studio-v4-profile="true"]'
function proveCss(css, label = 'css') {
  const rules = []
  postcss.parse(css).walkRules(rule => rules.push(rule))
  ok(rules.length >= 20, `${label}: has its rules`)
  const tokenRules = [SCOPE, `.dark ${SCOPE}`]
  for (const rule of rules) for (const selector of rule.selectors) {
    if (tokenRules.includes(selector)) deepEq(rule.nodes.map(n => n.prop), ['--sp-meter'], `${label}: ${selector} declares the meter colour and nothing else`)
    else ok(selector.startsWith(`${SCOPE} `), `${label}: scoped to the P2 menu: ${selector}`)
  }
  const decls = selector => { const rule = rules.find(r => r.selectors.includes(selector.startsWith('.dark') ? selector : `${SCOPE} ${selector}`)); ok(rule, `${label}: rule ${selector}`); return Object.fromEntries(rule.nodes.filter(n => n.type === 'decl').map(n => [n.prop, n.value])) }
  const disc = decls('[data-studio-p2-disc="true"]'); eq(disc.width, '34px', `${label}: disc width`); eq(disc.height, '34px', `${label}: disc height`)
  eq(decls('[data-studio-p2-identity="true"]').display, 'flex', `${label}: identity is a row`)
  eq(decls('[data-studio-p2-appearance="true"]').display, 'grid', `${label}: the control is a grid`)
  eq(decls('[data-studio-p2-appearance="true"]')['grid-template-columns'], 'repeat(3, minmax(0, 1fr))', `${label}: three equal segments`)
  eq(decls('[data-studio-p2-appearance="true"] [role="menuitemradio"] > span:first-child').display, 'none', `${label}: the radio's own dot is hidden (the segment is the indicator)`)
  eq(decls('[data-studio-p2-appearance="true"] [role="menuitemradio"][data-state="checked"]')['background-color'], 'var(--sp-panel)', `${label}: the selected segment is the raised panel`)
  eq(decls('[data-studio-p2-eyebrow="true"]')['text-transform'], 'uppercase', `${label}: eyebrow`)
  eq(decls('[data-studio-p2-chevron="true"]')['margin-left'], 'auto', `${label}: chevron at the end`)
  // PRO-03: the card (the mockup's: soft panel, 1px line, 8px radius, 4px meter)
  const card = decls('[data-studio-p2-usage="true"]')
  eq(card.border, '1px solid var(--sp-line)', `${label}: card border`); eq(card['border-radius'], '8px', `${label}: card radius`); eq(card['background-color'], 'var(--sp-soft)', `${label}: card surface`); eq(card.padding, '12px', `${label}: card padding`)
  const bar = decls('[data-studio-p2-meter-bar="true"]')
  eq(bar.height, '4px', `${label}: thin meter`); eq(bar['border-radius'], '5px', `${label}: meter radius`); eq(bar['background-color'], 'var(--sp-line)', `${label}: meter track`); eq(bar.overflow, 'hidden', `${label}: the fill is clipped to the track`)
  const fill = decls('[data-studio-p2-meter-bar="true"] > i')
  eq(fill['background-color'], 'var(--sp-meter)', `${label}: meter fill`); eq(fill.height, '100%', `${label}: fill height`); eq(fill.display, 'block', `${label}: fill is a block`)
  const head = decls('[data-studio-p2-meter-head="true"]'); eq(head.display, 'flex', `${label}: meter head is a row`); eq(head['justify-content'], 'space-between', `${label}: label left, share right`)
  eq(decls('[data-studio-p2-usage="true"] [data-studio-p2-meter] + [data-studio-p2-meter]')['margin-top'], '10px', `${label}: space between the meters`)
  eq(decls('[data-studio-p2-meter] > small').color, 'var(--sp-muted)', `${label}: reset text is muted`)
  const upgradeHover = decls('[data-studio-p2-upgrade="true"]:is(:hover, :focus, [data-highlighted])')
  eq(upgradeHover['background-color'], 'var(--sp-panel)', `${label}: the upgrade item lifts onto the panel inside the soft card, not the shadcn accent`); eq(upgradeHover.color, 'var(--sp-text)', `${label}: upgrade item text on hover`)
  eq(decls(SCOPE.length ? `.dark ${SCOPE}` : '')['--sp-meter'], '#7fb7aa', `${label}: dark meter colour`)
  eq(Object.fromEntries(rules.find(r => r.selectors.includes(SCOPE)).nodes.map(n => [n.prop, n.value]))['--sp-meter'], '#34857b', `${label}: light meter colour`)
  postcss.parse(css).walkDecls(decl => { if (decl.prop !== '--sp-meter') nomatch(decl.value, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, `${label}: palette tokens only in ${decl.prop} (dark mode comes from the --sp-* variables)`) })
}

// ---------------------------------------------------------------- .env.example
function proveEnv(source, label = 'env') {
  match(source, new RegExp(`^${FLAG}="false"$`, 'm'), `${label}: documented, default off`)
  eq(source.split(`${FLAG}=`).length, 2, `${label}: once`)
}

// ---------------------------------------------------------------- run on the real sources
const lib = proveLib(SOURCES[LIB])
proveBody(SOURCES[P2], lib)
await proveWiring(SOURCES[PARENT])
proveCss(SOURCES[CSS])
proveEnv(SOURCES[ENV])

// ---------------------------------------------------------------- 5. mutation check
const MUTANTS = [
  [LIB, 'light label', "label: 'Light'", "label: 'Day'"],
  [LIB, 'dark label', "label: 'Dark'", "label: 'Night'"],
  [LIB, 'auto label', "label: 'Auto'", "label: 'System'"],
  [LIB, 'auto stores auto', "{ value: 'system', label: 'Auto'", "{ value: 'auto', label: 'Auto'"],
  [LIB, 'hint changed', "hint: 'Follows your system'", "hint: 'Follows the clock'"],
  [LIB, 'options reordered', "{ value: 'light', label: 'Light', hint: 'Always light' },\n  { value: 'dark', label: 'Dark', hint: 'Always dark' },", "{ value: 'dark', label: 'Dark', hint: 'Always dark' },\n  { value: 'light', label: 'Light', hint: 'Always light' },"],
  [LIB, 'choice: system reads light', "return theme === 'dark' || theme === 'system' ? theme : 'light'", "return theme === 'dark' ? theme : 'light'"],
  [LIB, 'choice: unknown reads dark', "return theme === 'dark' || theme === 'system' ? theme : 'light'", "return theme === 'dark' || theme === 'system' ? theme : 'dark'"],
  [LIB, 'choice: loose', "return theme === 'dark' || theme === 'system' ? theme : 'light'", "return theme ? theme as StudioAppearance : 'light'"],
  [LIB, 'from value: loose', "return value === 'light' || value === 'dark' || value === 'system' ? value : null", "return (value as StudioAppearance) ?? null"],
  [LIB, 'from value: light dropped', "value === 'light' || value === 'dark' || value === 'system' ? value : null", "value === 'dark' || value === 'system' ? value : null"],
  [LIB, 'from value: auto accepted', "value === 'light' || value === 'dark' || value === 'system' ? value : null", "value === 'light' || value === 'dark' || value === 'system' || value === 'auto' ? value as StudioAppearance : null"],
  [LIB, 'details label', "label: 'Your details'", "label: 'Details'"],
  [LIB, 'details route', "href: '/studio/details'", "href: '/profile'"],
  [LIB, 'settings label', "label: 'Settings & preferences'", "label: 'Settings'"],
  [LIB, 'settings route', "href: '/settings' }", "href: '/settings/profile' }"],
  [LIB, 'shortcuts label', "label: 'Keyboard shortcuts'", "label: 'Shortcuts'"],
  [LIB, 'shortcuts route', "href: '/shortcuts'", "href: '/help'"],
  [LIB, 'billing label', "label: 'Workspace & billing'", "label: 'Billing'"],
  [LIB, 'billing route', "href: '/billing'", "href: '/pricing'"],
  [LIB, 'help label', "label: 'Help'", "label: 'Help centre'"],
  [LIB, 'dashboard row added', "  { kind: 'row', id: 'details', label: 'Your details', href: '/studio/details' },", "  { kind: 'row', id: 'details', label: 'Your details', href: '/studio/details' },\n  { kind: 'row', id: 'help', label: 'Dashboard', href: '/dashboard' },"],
  [LIB, 'appearance moved', "  { kind: 'appearance' },\n  { kind: 'row', id: 'settings'", "  { kind: 'row', id: 'settings'"],
  [LIB, 'separator dropped', "  { kind: 'separator' },\n", ''],
  [LIB, 'sign out word', "signOut: 'Sign out'", "signOut: 'Sign Out'"],
  [LIB, 'about word', "about: 'About Studio'", "about: 'About'"],
  [LIB, 'appearance word', "appearance: 'Appearance'", "appearance: 'Theme'"],
  [LIB, 'usage title', "title: 'Your creative capacity'", "title: 'Usage remaining'"],
  [LIB, 'usage left word', "left: 'left'", "left: 'used'"],
  [LIB, 'usage upgrade word', "upgrade: 'Upgrade for more usage'", "upgrade: 'Upgrade'"],
  [LIB, 'usage upgrade route', "upgradeHref: '/billing'", "upgradeHref: '/pricing'"],
  [LIB, 'percent not clamped high', 'Math.max(0, Math.min(1, share))', 'Math.max(0, share)'],
  [LIB, 'percent not clamped low', 'Math.max(0, Math.min(1, share))', 'Math.min(1, share)'],
  [LIB, 'percent floored', 'Math.round(Math.max(0', 'Math.floor(Math.max(0'],
  [LIB, 'percent as a fraction', 'Math.min(1, share)) * 100)', 'Math.min(1, share)) * 10)'],
  [LIB, 'percent takes NaN', "typeof share === 'number' && Number.isFinite(share)", "typeof share === 'number'"],
  [LIB, 'percent takes strings', "typeof share === 'number' && Number.isFinite(share)", 'Number.isFinite(Number(share))'],
  [LIB, 'reset: equal time is not now', 'if (ms <= 0)', 'if (ms < 0)'],
  [LIB, 'reset: past is not now', "return 'Resets now'", "return ''"],
  [LIB, 'reset: hours rounded up', 'Math.floor(ms / HOUR_MS)', 'Math.ceil(ms / HOUR_MS)'],
  [LIB, 'reset: hour unit', 'const HOUR_MS = 3_600_000', 'const HOUR_MS = 60_000'],
  [LIB, 'reset: under an hour', 'if (hours < 1)', 'if (hours < 2)'],
  [LIB, 'reset: under an hour word', "'Resets in under 1h'", "'Resets soon'"],
  [LIB, 'reset: a day is hours', 'hours < 24 ?', 'hours <= 24 ?'],
  [LIB, 'reset: two days are hours', 'hours < 24 ?', 'hours < 48 ?'],
  [LIB, 'reset: hours word', '`Resets in ${hours}h`', '`In ${hours}h`'],
  [LIB, 'reset: date word', '`Resets ${formatDate(at)}`', '`${formatDate(at)}`'],
  [LIB, 'reset: unreadable time kept', "if (Number.isNaN(ms)) return ''", ''],
  [LIB, 'reset: non-text accepted', "if (typeof resetAt !== 'string') return ''", "if (resetAt == null) return ''"],
  [LIB, 'reset: default date long month', "{ month: 'short', day: 'numeric' }", "{ month: 'long', day: 'numeric' }"],
  [LIB, 'reset: default date has a year', "{ month: 'short', day: 'numeric' }", "{ month: 'short', day: 'numeric', year: 'numeric' }"],
  [LIB, 'meters: weekly first', "  { id: 'daily', label: 'Daily' },\n  { id: 'weekly', label: 'Weekly' },", "  { id: 'weekly', label: 'Weekly' },\n  { id: 'daily', label: 'Daily' },"],
  [LIB, 'meters: daily word', "label: 'Daily'", "label: 'Today'"],
  [LIB, 'meters: weekly word', "label: 'Weekly'", "label: 'Week'"],
  [LIB, 'meters: unreadable share kept', 'if (percent === null) continue', ''],
  [LIB, 'meters: unreadable share read as 0', 'const percent = studioUsagePercent(quota.remainingPct?.[id])', 'const percent = studioUsagePercent(quota.remainingPct?.[id]) ?? 0'],
  [LIB, 'meters: no quota is a crash', 'if (!quota) return []', ''],
  [LIB, 'meters: reset from the wrong window', 'quota.resetAt?.[id]', "quota.resetAt?.['daily']"],
  [LIB, 'meters: share from the wrong window', 'quota.remainingPct?.[id]', "quota.remainingPct?.['daily']"],
  [LIB, 'meters: reset text dropped', "reset: studioUsageResetText(quota.resetAt?.[id], now, formatDate) })", "reset: '' })"],
  [LIB, 'meters: formatter ignored', 'studioUsageResetText(quota.resetAt?.[id], now, formatDate)', 'studioUsageResetText(quota.resetAt?.[id], now)'],
  [LIB, 'meters: clock ignored', 'studioUsageResetText(quota.resetAt?.[id], now, formatDate)', 'studioUsageResetText(quota.resetAt?.[id], new Date(), formatDate)'],
  [LIB, 'an import added', "export type StudioAppearance", "import { cn } from '@/lib/utils'\nexport type StudioAppearance"],
  [P2, 'root flag marker dropped', ' data-studio-p2-profile="true"', ''],
  [P2, 'palette marker dropped', 'data-studio-v4-profile="true" data-studio-profile-fidelity', 'data-studio-profile-fidelity'],
  [P2, 'opens below', 'side="right" sideOffset={8}', 'side="bottom" sideOffset={8}'],
  [P2, 'width changed', 'className="w-64">', 'className="w-80">'],
  [P2, 'identity marker dropped', 'data-studio-profile-identity="true" data-studio-p2-identity', 'data-studio-p2-identity'],
  [P2, 'disc dropped', '<Avatar data-studio-p2-disc="true" className="h-9 w-9">', '<span>'],
  [P2, 'initials dropped', '<AvatarFallback data-studio-p2-disc-fallback="true">{initials}</AvatarFallback>', '<AvatarFallback data-studio-p2-disc-fallback="true">{name}</AvatarFallback>'],
  [P2, 'photo ignored', 'src={image || undefined}', 'src={undefined}'],
  [P2, 'alt changed', 'alt={name || "User avatar"}', 'alt="Avatar"'],
  [P2, 'name dropped', '<p data-studio-profile-name="true" className="text-sm font-medium leading-none">{name}</p>', '<p data-studio-profile-name="true" className="text-sm font-medium leading-none">{email}</p>'],
  [P2, 'email dropped', 'leading-none text-muted-foreground">{email}</p>', 'leading-none text-muted-foreground">{name}</p>'],
  [P2, 'badge always', '{tierLabel && (', '{(tierLabel || true) && ('],
  [P2, 'badge role dropped', 'data-studio-v4-profile-role="tier"', 'data-studio-v4-profile-role="item"'],
  [P2, 'badge text', '            {tierLabel}\n', '            Max\n'],
  [P2, 'session strip dropped', '{sessionUsage && <div', '{false && <div'],
  [P2, 'session strip label', 'aria-label="Current session token usage"', 'aria-label="Usage"'],
  [P2, 'first separator dropped', '      <DropdownMenuSeparator data-studio-v4-profile-role="separator" />\n\n      {STUDIO_PROFILE_LAYOUT', '      {STUDIO_PROFILE_LAYOUT'],
  [P2, 'layout separator dropped', 'if (entry.kind === "separator") return <DropdownMenuSeparator key={`separator-${index}`} data-studio-v4-profile-role="separator" />', 'if (entry.kind === "separator") return null'],
  [P2, 'appearance block dropped', 'if (entry.kind === "appearance") {', 'if (entry.kind === "appearance" && false) {'],
  [P2, 'eyebrow id dropped', 'id="studio-p2-appearance-label" ', ''],
  [P2, 'group unlabelled', '                aria-labelledby="studio-p2-appearance-label"\n', ''],
  [P2, 'selected ignores theme', 'value={studioAppearanceChoice(theme)}', 'value="light"'],
  [P2, 'selected raw theme', 'value={studioAppearanceChoice(theme)}', 'value={theme}'],
  [P2, 'any value stored', 'if (next) onTheme(next)', 'onTheme(value as StudioAppearance)'],
  [P2, 'nothing stored', 'if (next) onTheme(next)', 'if (next) void 0'],
  [P2, 'light stored for everything', 'const next = studioAppearanceFromValue(value)', 'const next = studioAppearanceFromValue("light")'],
  [P2, 'option closes the menu', 'onSelect={(event) => event.preventDefault()}', 'onSelect={() => undefined}'],
  [P2, 'option value swapped', '                      value={option.value}\n', '                      value={option.label}\n'],
  [P2, 'option hint dropped', '                      title={option.hint}\n', ''],
  [P2, 'option role dropped', '                      data-studio-v4-profile-role="item"\n                      data-studio-p2-appearance-option', '                      data-studio-p2-appearance-option'],
  [P2, 'option marker dropped', '                      data-studio-p2-appearance-option={option.value}\n', ''],
  [P2, 'icons swapped', 'light: Sun, dark: Moon, system: Monitor', 'light: Moon, dark: Sun, system: Monitor'],
  [P2, 'auto icon', 'light: Sun, dark: Moon, system: Monitor', 'light: Sun, dark: Moon, system: Sun'],
  [P2, 'row click dropped', 'onClick={() => onNavigate(entry.href)}', 'onClick={() => undefined}'],
  [P2, 'row goes to the wrong place', 'onClick={() => onNavigate(entry.href)}', 'onClick={() => onNavigate("/dashboard")}'],
  [P2, 'row role dropped', 'data-studio-v4-profile-role="item" data-studio-p2-row={entry.id}', 'data-studio-p2-row={entry.id}'],
  [P2, 'chevron dropped (rows)', '            <span>{entry.label}</span>\n            <ChevronRight data-studio-p2-chevron="true" />', '            <span>{entry.label}</span>'],
  [P2, 'chevron dropped (about)', '        <span>{STUDIO_PROFILE_WORDS.about}</span>\n        <ChevronRight data-studio-p2-chevron="true" />', '        <span>{STUDIO_PROFILE_WORDS.about}</span>'],
  [P2, 'chevron on sign out', '        <span>{STUDIO_PROFILE_WORDS.signOut}</span>', '        <span>{STUDIO_PROFILE_WORDS.signOut}</span><ChevronRight />'],
  [P2, 'help icon', 'help: HelpCircle', 'help: Info'],
  [P2, 'about closes by itself', 'onSelect={(event) => { event.preventDefault(); onAbout() }}', 'onSelect={() => onAbout()}'],
  [P2, 'about does nothing', 'onSelect={(event) => { event.preventDefault(); onAbout() }}', 'onSelect={(event) => { event.preventDefault() }}'],
  [P2, 'about word', '<span>{STUDIO_PROFILE_WORDS.about}</span>', '<span>About</span>'],
  [P2, 'last separator dropped', '      <DropdownMenuSeparator data-studio-v4-profile-role="separator" />\n\n      <DropdownMenuItem data-studio-v4-profile-role="danger"', '      <DropdownMenuItem data-studio-v4-profile-role="danger"'],
  [P2, 'sign out role dropped', 'data-studio-v4-profile-role="danger" onClick={onLogout}', 'data-studio-v4-profile-role="item" onClick={onLogout}'],
  [P2, 'sign out not red', 'className="text-red-600 dark:text-red-400"', 'className=""'],
  [P2, 'sign out does nothing', 'onClick={onLogout}', 'onClick={() => undefined}'],
  [P2, 'sign out word', '<span>{STUDIO_PROFILE_WORDS.signOut}</span>', '<span>Sign Out</span>'],
  [P2, 'card dropped', '      {usageCard(quota, onNavigate)}\n', ''],
  [P2, 'card above the identity', '      {usageCard(quota, onNavigate)}\n      {sessionUsage', '      {sessionUsage'],
  [P2, 'card after the session strip', '      {usageCard(quota, onNavigate)}\n      {sessionUsage && <div data-studio-session-usage="true" role="group" aria-label="Current session token usage">{sessionUsage}</div>}', '      {sessionUsage && <div data-studio-session-usage="true" role="group" aria-label="Current session token usage">{sessionUsage}</div>}\n      {usageCard(quota, onNavigate)}'],
  [P2, 'card without a read', 'if (meters.length === 0) return null', ''],
  [P2, 'card from no quota', 'const meters = studioUsageMeters(quota)', 'const meters = studioUsageMeters(null)'],
  [P2, 'card marker dropped', 'data-studio-p2-usage="true" role="group"', 'role="group"'],
  [P2, 'card not a group', '<div data-studio-p2-usage="true" role="group" aria-label={STUDIO_USAGE_WORDS.title}>', '<div data-studio-p2-usage="true" aria-label={STUDIO_USAGE_WORDS.title}>'],
  [P2, 'card unnamed', 'role="group" aria-label={STUDIO_USAGE_WORDS.title}>', 'role="group">'],
  [P2, 'card title dropped', '<p data-studio-p2-usage-title="true">{STUDIO_USAGE_WORDS.title}</p>', ''],
  [P2, 'card title word', '<p data-studio-p2-usage-title="true">{STUDIO_USAGE_WORDS.title}</p>', '<p data-studio-p2-usage-title="true">Usage</p>'],
  [P2, 'meter marker dropped', '<div key={meter.id} data-studio-p2-meter={meter.id}>', '<div key={meter.id}>'],
  [P2, 'meter head dropped', '          <div data-studio-p2-meter-head="true">', '          <div>'],
  [P2, 'meter label dropped', '            <span>{meter.label}</span>\n', ''],
  [P2, 'meter share word', '<span>{meter.percent}% {STUDIO_USAGE_WORDS.left}</span>', '<span>{meter.percent}%</span>'],
  [P2, 'meter share used', '<span>{meter.percent}% {STUDIO_USAGE_WORDS.left}</span>', '<span>{100 - meter.percent}% used</span>'],
  [P2, 'bar not a progressbar', 'role="progressbar"', 'role="presentation"'],
  [P2, 'bar value dropped', 'aria-valuenow={meter.percent}', ''],
  [P2, 'bar max changed', 'aria-valuemax={100}', 'aria-valuemax={1}'],
  [P2, 'bar min changed', 'aria-valuemin={0}', 'aria-valuemin={1}'],
  [P2, 'bar unnamed', 'aria-label={`${meter.label} usage left`}', 'aria-label="Usage"'],
  [P2, 'bar marker dropped', '<div data-studio-p2-meter-bar="true" role="progressbar"', '<div role="progressbar"'],
  [P2, 'fill ignores the share', 'style={{ width: `${meter.percent}%` }}', 'style={{ width: "100%" }}'],
  [P2, 'fill inverted', 'style={{ width: `${meter.percent}%` }}', 'style={{ width: `${100 - meter.percent}%` }}'],
  [P2, 'reset always rendered', '{meter.reset && <small>', '{true && <small>'],
  [P2, 'reset dropped', '          {meter.reset && <small>{meter.reset}</small>}\n', ''],
  [P2, 'upgrade not an item', '<DropdownMenuItem data-studio-v4-profile-role="upgrade" data-studio-p2-upgrade="true"', '<div data-studio-v4-profile-role="upgrade" data-studio-p2-upgrade="true"'],
  [P2, 'upgrade role dropped', 'data-studio-v4-profile-role="upgrade" data-studio-p2-upgrade="true"', 'data-studio-p2-upgrade="true"'],
  [P2, 'upgrade goes elsewhere', 'onClick={() => onNavigate(STUDIO_USAGE_WORDS.upgradeHref)}', 'onClick={() => onNavigate("/dashboard")}'],
  [P2, 'upgrade does nothing', 'onClick={() => onNavigate(STUDIO_USAGE_WORDS.upgradeHref)}', 'onClick={() => undefined}'],
  [P2, 'upgrade word', '<span>{STUDIO_USAGE_WORDS.upgrade}</span>', '<span>Upgrade</span>'],
  [P2, 'upgrade chevron dropped', '        <span>{STUDIO_USAGE_WORDS.upgrade}</span>\n        <ChevronRight data-studio-p2-chevron="true" />', '        <span>{STUDIO_USAGE_WORDS.upgrade}</span>'],
  [P2, 'stylesheet not imported', 'import "./user-profile-menu-p2.css"', '// import "./user-profile-menu-p2.css"'],
  [P2, 'an unexpected import', 'import { Badge } from "@/components/ui/badge"', 'import { Badge } from "@/components/ui/badge"\nconst unexpected = require("@/lib/utils")'],
  [PARENT, 'flag read loosely', "process.env.NEXT_PUBLIC_STUDIO_P2_PROFILE_MENU === 'true'", "process.env.NEXT_PUBLIC_STUDIO_P2_PROFILE_MENU !== 'false'"],
  [PARENT, 'flag truthy', "process.env.NEXT_PUBLIC_STUDIO_P2_PROFILE_MENU === 'true'", "Boolean(process.env.NEXT_PUBLIC_STUDIO_P2_PROFILE_MENU)"],
  [PARENT, 'flag ignored', "const p2Menu = studioProfile && process.env.NEXT_PUBLIC_STUDIO_P2_PROFILE_MENU === 'true'", 'const p2Menu = studioProfile'],
  [PARENT, 'outside the Studio presentation', "const p2Menu = studioProfile && process.env.NEXT_PUBLIC_STUDIO_P2_PROFILE_MENU === 'true'", "const p2Menu = process.env.NEXT_PUBLIC_STUDIO_P2_PROFILE_MENU === 'true'"],
  [PARENT, 'palette not required', "const p2Menu = studioProfile && process.env", "const p2Menu = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env"],
  [PARENT, 'always p2', "const p2Menu = studioProfile && process.env.NEXT_PUBLIC_STUDIO_P2_PROFILE_MENU === 'true'", 'const p2Menu = true'],
  [PARENT, 'never p2', "const p2Menu = studioProfile && process.env.NEXT_PUBLIC_STUDIO_P2_PROFILE_MENU === 'true'", 'const p2Menu = false'],
  [PARENT, 'name not passed', 'name={user.name} email', 'name={user.email} email'],
  [PARENT, 'email not passed', 'email={user.email} image', 'email={user.name} image'],
  [PARENT, 'photo not passed', 'image={user.image} initials', 'image={null} initials'],
  [PARENT, 'initials not passed', 'initials={userInitials} tierLabel', 'initials="U" tierLabel'],
  [PARENT, 'tier not passed', 'tierLabel={quota?.tierLabel}', 'tierLabel="Pro"'],
  [PARENT, 'session usage not passed', 'sessionUsage={sessionUsage} quota=', 'sessionUsage={undefined} quota='],
  [PARENT, 'quota not passed', 'quota={quota} theme', 'quota={null} theme'],
  [PARENT, 'quota shares wrong', 'quota={quota} theme', 'quota={quota && { ...quota, remainingPct: { daily: 0, weekly: 0 } }} theme'],
  [PARENT, 'quota reset times wrong', 'quota={quota} theme', 'quota={quota && { ...quota, resetAt: undefined }} theme'],
  [PARENT, 'collapsed disclosure passed again', 'quota={quota} theme', 'quota={quota} usage={quota && <UsageRemaining data={quota} isExpanded={isUsageExpanded} onToggle={() => setIsUsageExpanded(v => !v)} />} theme'],
  [PARENT, 'theme not passed', 'theme={theme} onTheme', 'theme="light" onTheme'],
  [PARENT, 'setTheme not wired', 'onTheme={setTheme}', 'onTheme={() => undefined}'],
  [PARENT, 'theme toggles instead', 'onTheme={setTheme}', 'onTheme={() => toggleTheme()}'],
  [PARENT, 'navigation not wired', 'onNavigate={handleNavigation}', 'onNavigate={() => undefined}'],
  [PARENT, 'navigation leaves the menu open', 'onNavigate={handleNavigation}', 'onNavigate={path => router.push(path)}'],
  [PARENT, 'about leaves the menu open', 'onAbout={() => { setIsOpen(false); setAboutOpen(true) }}', 'onAbout={() => { setAboutOpen(true) }}'],
  [PARENT, 'about does not open', 'onAbout={() => { setIsOpen(false); setAboutOpen(true) }}', 'onAbout={() => { setIsOpen(false) }}'],
  [PARENT, 'logout not wired', 'onLogout={handleLogout}', 'onLogout={() => undefined}'],
  [PARENT, 'original content always rendered', '{p2Menu ? <StudioProfileMenuP2', '{false ? <StudioProfileMenuP2'],
  [PARENT, 'original content dropped', '/> : (\n      <DropdownMenuContent', '/> : null && (\n      <DropdownMenuContent'],
  [PARENT, 'original rows changed', '<span>Dashboard</span>', '<span>Home</span>'],
  [PARENT, 'original sign out changed', '<span>Sign Out</span>', '<span>Sign out</span>'],
  [PARENT, 'original theme toggle changed', '<span>Dark Mode</span>', '<span>Night mode</span>'],
  [PARENT, 'original side changed', 'side={studioProfile ? "right" : undefined}', 'side={undefined}'],
  [CSS, 'scope loosened', '[data-studio-p2-profile="true"][data-studio-v4-profile="true"] [data-studio-p2-disc="true"] {', '[data-studio-p2-disc="true"] {'],
  [CSS, 'a menu-wide rule', '[data-studio-p2-profile="true"][data-studio-v4-profile="true"] [data-studio-p2-chevron="true"] {', '[data-studio-v4-profile="true"] [data-studio-p2-chevron="true"] {'],
  [CSS, 'disc size', 'width: 34px; height: 34px;', 'width: 30px; height: 30px;'],
  [CSS, 'identity not a row', '[data-studio-p2-identity="true"] { display: flex;', '[data-studio-p2-identity="true"] { display: block;'],
  [CSS, 'control not a grid', 'display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));', 'display: flex; grid-template-columns: repeat(3, minmax(0, 1fr));'],
  [CSS, 'two segments', 'repeat(3, minmax(0, 1fr))', 'repeat(2, minmax(0, 1fr))'],
  [CSS, 'dot shown', '[role="menuitemradio"] > span:first-child { display: none; }', '[role="menuitemradio"] > span:first-child { display: block; }'],
  [CSS, 'selected not raised', 'font-weight: 600; background-color: var(--sp-panel);', 'font-weight: 600; background-color: var(--sp-soft);'],
  [CSS, 'eyebrow not uppercase', 'text-transform: uppercase;', 'text-transform: none;'],
  [CSS, 'chevron not at the end', '[data-studio-p2-chevron="true"] { margin-left: auto;', '[data-studio-p2-chevron="true"] { margin-left: 0;'],
  [CSS, 'meter colour not scoped', '[data-studio-p2-profile="true"][data-studio-v4-profile="true"] { --sp-meter: #34857b; }', '[data-studio-v4-profile="true"] { --sp-meter: #34857b; }'],
  [CSS, 'meter colour light', '--sp-meter: #34857b;', '--sp-meter: #6a4fc0;'],
  [CSS, 'meter colour dark', '--sp-meter: #7fb7aa;', '--sp-meter: #34857b;'],
  [CSS, 'meter colour rule widened', '{ --sp-meter: #34857b; }', '{ --sp-meter: #34857b; color: red; }'],
  [CSS, 'card has no border', 'border: 1px solid var(--sp-line); border-radius: 8px; background-color: var(--sp-soft);', 'border: 0; border-radius: 8px; background-color: var(--sp-soft);'],
  [CSS, 'card radius', 'border: 1px solid var(--sp-line); border-radius: 8px;', 'border: 1px solid var(--sp-line); border-radius: 4px;'],
  [CSS, 'card surface', 'border-radius: 8px; background-color: var(--sp-soft); }', 'border-radius: 8px; background-color: var(--sp-panel); }'],
  [CSS, 'card padding', 'margin: 12px 0; padding: 12px; border: 1px solid', 'margin: 12px 0; padding: 4px; border: 1px solid'],
  [CSS, 'meter thick', 'height: 4px; margin: 6px 0 5px;', 'height: 8px; margin: 6px 0 5px;'],
  [CSS, 'meter square', 'margin: 6px 0 5px; border-radius: 5px;', 'margin: 6px 0 5px; border-radius: 0;'],
  [CSS, 'meter track', 'border-radius: 5px; background-color: var(--sp-line); overflow: hidden;', 'border-radius: 5px; background-color: var(--sp-panel); overflow: hidden;'],
  [CSS, 'meter not clipped', 'background-color: var(--sp-line); overflow: hidden;', 'background-color: var(--sp-line);'],
  [CSS, 'fill colour', 'height: 100%; border-radius: 5px; background-color: var(--sp-meter);', 'height: 100%; border-radius: 5px; background-color: var(--sp-accent);'],
  [CSS, 'fill height', 'display: block; height: 100%;', 'display: block; height: 50%;'],
  [CSS, 'fill inline', 'display: block; height: 100%;', 'display: inline; height: 100%;'],
  [CSS, 'head not a row', 'display: flex; align-items: baseline; justify-content: space-between;', 'display: block; align-items: baseline; justify-content: space-between;'],
  [CSS, 'head not spread', 'justify-content: space-between; gap: 8px;', 'justify-content: flex-start; gap: 8px;'],
  [CSS, 'meters touch', '[data-studio-p2-meter] + [data-studio-p2-meter] { margin-top: 10px; }', '[data-studio-p2-meter] + [data-studio-p2-meter] { margin-top: 0; }'],
  [CSS, 'reset not muted', '[data-studio-p2-meter] > small { display: block; font-size: 9px; line-height: 13px; color: var(--sp-muted); }', '[data-studio-p2-meter] > small { display: block; font-size: 9px; line-height: 13px; color: var(--sp-text); }'],
  [CSS, 'usage rule not scoped', '[data-studio-p2-profile="true"][data-studio-v4-profile="true"] [data-studio-p2-usage-title="true"] {', '[data-studio-p2-usage-title="true"] {'],
  [CSS, 'upgrade hover surface', '[data-highlighted]) { background-color: var(--sp-panel); color: var(--sp-text); }', '[data-highlighted]) { background-color: var(--sp-accent); color: var(--sp-text); }'],
  [CSS, 'upgrade hover text', '[data-highlighted]) { background-color: var(--sp-panel); color: var(--sp-text); }', '[data-highlighted]) { background-color: var(--sp-panel); color: var(--sp-muted); }'],
  [CSS, 'upgrade hover keyboard dropped', ':is(:hover, :focus, [data-highlighted]) { background-color: var(--sp-panel);', ':is(:hover) { background-color: var(--sp-panel);'],
  [CSS, 'literal colour in the card', 'background-color: var(--sp-soft); }\n[data-studio-p2-profile="true"][data-studio-v4-profile="true"] [data-studio-p2-usage-title', 'background-color: #edf2f0; }\n[data-studio-p2-profile="true"][data-studio-v4-profile="true"] [data-studio-p2-usage-title'],
  [CSS, 'literal colour', 'color: var(--sp-muted); font-size: 11px; font-weight: 600; }', 'color: #566965; font-size: 11px; font-weight: 600; }'],
  [ENV, 'default on', `${FLAG}="false"`, `${FLAG}="true"`],
  [ENV, 'not documented', `${FLAG}="false"\n`, ''],
]
let killed = 0
const survivors = []
counting = false
for (const [file, name, from, to] of MUTANTS) {
  const source = SOURCES[file]
  assert.ok(source.includes(from), `mutant "${name}": the text it replaces exists in ${file}`)
  const mutated = source.replace(from, () => to)
  assert.notEqual(mutated, source, `mutant "${name}" changes the source`)
  let survived = false
  try {
    if (file === LIB) { const mutantLib = proveLib(mutated, name); proveBody(SOURCES[P2], mutantLib, name) }
    else if (file === P2) proveBody(mutated, lib, name)
    else if (file === PARENT) await proveWiring(mutated, name)
    else if (file === CSS) proveCss(mutated, name)
    else if (file === ENV) proveEnv(mutated, name)
    survived = true
  } catch (error) { assert.equal(error?.code, 'ERR_ASSERTION', `mutant "${name}" must be killed by an assertion, not a crash: ${error}`); killed++ }
  if (survived) survivors.push(name)
}
counting = true
assert.deepEqual(survivors, [], `mutants survived: ${survivors.join(', ')}`)
eq(killed, MUTANTS.length)

console.log(`Studio P2 profile menu (PRO-02/03/04/05/06/07/08/10): ${checks} checks passed, ${killed}/${MUTANTS.length} mutants killed; no network.`)
