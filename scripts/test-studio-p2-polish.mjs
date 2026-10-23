// PASS2 polish (FRONTEND-1): PP-1..PP-7 of ops/program/cards/FE-P2-POLISH-FROM-SHOTS.md, seven gaps seen in the mock | before | after shots of the merged Pass 2 pages, and PP-8 (PK's note on the account menu).
// ONE flag, NEXT_PUBLIC_STUDIO_P2_POLISH (exact "true", default off); every fix also needs its page's own Pass 2 flag.
//   PP-1 Publish        the wizard's "What viewers get" panel is not clipped under the sticky footer: the step body and the panel scroll on their own above it
//   PP-2 Publish        "View as a viewer" takes the shell's action colour (--ss-action), not the violet primary
//   PP-3 Publish        the manage view ends with the mock's Done button, which closes the dialog
//   PP-4 Landing        the open phone menu dims the page behind it (a press on it closes) and, at 520px and below, is a sheet under the header
//   PP-5 Intelligence   the comparison panel scrolls inside the window, so "Use this model" pins to its own bottom edge and the note above it is not cut mid-line
//   PP-6 Profile menu   a failed quota read keeps the plan badge (the session's tier) and says "Usage unavailable"
//   PP-7 Intelligence   "Managed by Deckster" is four columns from 1200px
//   PP-8 Profile menu   the vertical rhythm is tighter: 32px rows (were 38), 8px between sections with ONE hairline (were three), a tighter capacity card (the Appearance control is untouched)
//
// Run: node scripts/test-studio-p2-polish.mjs   (plain node: transpile + vm, no network, no browser, no env)
//   P2_POLISH_BASE=<commit> overrides the base commit flag-off identity is checked against (default: scripts/studio-p2-polish-strip.mjs's BASE_COMMIT, the studio-v4-dev-preparation-code
//   tip this change sits on; the clone needs that commit). P2_NO_MUTANTS=1 skips the mutants.
//
// Proven on the REAL sources lib/studio-p2-polish.ts, components/{publish-p2,publish-wizard,publish-dialog,user-profile-menu,user-profile-menu-p2}.tsx, components/marketing/v3/HeaderMenuP2.tsx,
// components/studio-personal/intelligence-p2.tsx, the five stylesheets, .env.example and package.json:
//   1. the helper is import-free; the flag parse, the tier labels, the usage states and the words are exact (and the tier labels equal lib/quota/quota.ts's);
//   2. the strip table (scripts/studio-p2-polish-strip.mjs): stripping the branch's files gives the base commit's files byte for byte, so nothing is changed that is not listed; every listed
//      change is found once, changes something, and any code it adds is guarded by the flag; the flag is read in the lib only; nothing but the listed files differs from the base;
//   3. flag off (unset, "false", "TRUE", " true", "1"), and the page's own flag off: the executed Pass 2 menu draws the SAME tree as the base's, the landing menu too, the publish dock and
//      done link add nothing;
//   4. flag on: PP-3 and PP-2 (executed publish-p2.tsx), PP-4 (the executed landing menu: scrim, its press closes, the rest unchanged), PP-6 (the executed Pass 2 menu: badge from the tier,
//      "Usage unavailable" for a failed or unreadable read, meters win, pending shows nothing) and the quota state in the parent menu;
//   5. the CSS: every rule of each appended block is scoped to a marker that exists only with the flag on; the declarations that carry each fix (and the two this work's browser runs showed
//      matter: the phone grid's `min-height: auto` and the panel's `grid-auto-rows: max-content`) are pinned; PP-8's geometry is added up from the rules (row, capacity card, section gaps)
//      and held equal to what Chromium measured on the real menu, and the Appearance control's own rules are held as they were;
//   6. the env block and the package script;
//   7. mutation check: every mutant of the sources (at least one per gap) is killed by sections 1, 3-6 (the identity checks of section 2 are switched off for it, so a mutant dies
//      of its own rule and not just of "this file is not the base's").
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import postcss from 'postcss'
import { BASE_COMMIT as STRIP_BASE, POLISH_APPENDED, POLISH_FILES, POLISH_NEW_FILES, POLISH_PAIRS, stripP2Polish } from './studio-p2-polish-strip.mjs'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const BASE_COMMIT = process.env.P2_POLISH_BASE || STRIP_BASE
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
const baseCache = new Map()
// .env.example and package.json are the two files every flag-gated change appends a line or a block to, so once other changes are stacked on this one they hold lines this change never wrote.
// For those two (and only those) the base's lines must all still be there, in order, with nothing of this change left, and any extra line must be a comment, a blank, an env line or a test
// script line (the rule scripts/test-studio-p2-publish.mjs uses). Every other file is held to the base byte for byte, as before.
const SHARED_APPEND_ONLY = ['.env.example', 'package.json']
function sameAsBase(rel, text, baseText) {
  if (text === baseText) return true
  if (!SHARED_APPEND_ONLY.includes(rel)) return false
  const norm = line => rel === 'package.json' ? line.replace(/,\s*$/, '') : line
  const want = baseText.split('\n').map(norm)
  const extras = []
  let next = 0
  for (const line of text.split('\n').map(norm)) {
    if (next < want.length && line === want[next]) next++
    else extras.push(line)
  }
  const kind = rel === 'package.json' ? /^\s*"test:[a-z0-9-]+": "node scripts\/test-[a-z0-9-]+\.mjs"$/ : /^\s*$|^\s*#|^[A-Z][A-Z0-9_]*=/
  return next === want.length && extras.every(line => line === '' || kind.test(line)) && !extras.some(line => /P2_POLISH|test:studio-p2-polish/.test(line))
}
const baseSource = rel => {
  if (!baseCache.has(rel)) {
    try { baseCache.set(rel, execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })) }
    catch (error) { throw new Error(`base commit ${BASE_COMMIT} is not in this clone (fetch the full history): ${error.message}`) }
  }
  return baseCache.get(rel)
}
let checks = 0
let counting = true
const tick = () => { if (counting) checks++ }
const count = fn => (...args) => { tick(); return fn(...args) }
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value)) // values built inside the vm carry its realm's prototypes
const eq = count(assert.equal), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch), deepEq = count((actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message))
const attempt = fn => { try { return fn() } catch (error) { return { threw: String(error) } } } // a mutant that crashes must fail an assertion, not the run

const LIB = 'lib/studio-p2-polish.ts'
const P2PUB = 'components/publish-p2.tsx'
const WIZARD = 'components/publish-wizard.tsx'
const DIALOG = 'components/publish-dialog.tsx'
const MENU = 'components/marketing/v3/HeaderMenuP2.tsx'
const CHOOSER = 'components/studio-personal/intelligence-p2.tsx'
const PARENT = 'components/user-profile-menu.tsx'
const PROFILE = 'components/user-profile-menu-p2.tsx'
const CSS = { publish: 'components/studio-publish.css', landing: 'styles/marketing-v3-p2.css', intelligence: 'components/studio-personal/intelligence-p2.css', profile: 'components/user-profile-menu-p2.css' }
const ENV = '.env.example'
const PKG = 'package.json'
const PUBLISH_LIB = 'lib/studio-p2-publish.ts'
const PROFILE_LIB = 'lib/studio-profile-menu.ts'
const QUOTA = 'lib/quota/quota.ts'
const FLAG = 'NEXT_PUBLIC_STUDIO_P2_POLISH'
const OWN = [LIB, P2PUB, WIZARD, DIALOG, MENU, CHOOSER, PARENT, PROFILE, ...Object.values(CSS), ENV, PKG]
const SOURCES = Object.fromEntries(OWN.map(rel => [rel, read(rel)]))
const EXTERNAL = [PUBLISH_LIB, PROFILE_LIB, QUOTA, 'lib/studio-p2-landing.ts'] // read from the tree, never mutated
const LIBS = Object.fromEntries(EXTERNAL.map(rel => [rel, read(rel)]))

// ---------------------------------------------------------------- the vm: a small hooks runtime and a module loader
const jsx = (type, props, key) => ({ type, props: props ?? {}, key: key ?? null })
const jsxRuntime = { jsx, jsxs: jsx, Fragment: 'Fragment' }
const names = new Proxy({}, { get: (_target, key) => (key === '__esModule' ? false : String(key)) })
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : value && typeof value === 'object' ? [value, ...nodes(value.props?.children)] : []
const text = value => Array.isArray(value) ? value.map(text).join('') : value == null || typeof value === 'boolean' ? '' : typeof value === 'object' ? text(value.props?.children) : String(value)
const norm = value => JSON.stringify(value, (key, item) => {
  if (key === 'children' && Array.isArray(item)) { const kept = item.filter(x => x !== false && x !== undefined && x !== null); return kept.length === 1 ? kept[0] : kept } // [x] and x are the same children
  return typeof item === 'function' ? '[fn]' : item === undefined ? '__undefined__' : item
})
const compile = (source, fileName) => {
  const out = ts.transpileModule(source, { fileName, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } })
  assert.equal((out.diagnostics ?? []).filter(x => x.category === ts.DiagnosticCategory.Error).length, 0, `${fileName} compiles`)
  return out.outputText
}
function createRuntime() {
  const cells = []
  let cursor = 0, dirty = false, ids = 0
  const effects = []
  const changed = (old, deps) => !old || !deps || deps.some((value, index) => !Object.is(value, old.deps?.[index]))
  const react = {
    useState(init) {
      const i = cursor++
      cells[i] ??= { value: typeof init === 'function' ? init() : init }
      const cell = cells[i]
      return [cell.value, value => { const next = typeof value === 'function' ? value(cell.value) : value; if (!Object.is(next, cell.value)) { cell.value = next; dirty = true } }]
    },
    useRef(init) { const i = cursor++; return cells[i] ??= { current: init } },
    useId() { const i = cursor++; return cells[i] ??= `:id${++ids}:` },
    useEffect(fn, deps) {
      const i = cursor++, old = cells[i]
      if (changed(old, deps)) { cells[i] = { deps, cleanup: old?.cleanup }; effects.push(() => { cells[i].cleanup?.(); cells[i].cleanup = fn() }) }
    },
    useMemo(fn) { cursor++; return fn() },
    useLayoutEffect() { cursor++ },
    Fragment: 'Fragment',
  }
  return {
    react,
    render(Component, props) {
      for (let pass = 0; pass < 12; pass++) {
        cursor = 0; dirty = false
        const tree = Component(props)
        while (effects.length) effects.shift()()
        if (!dirty) return tree
      }
      throw new Error('render did not settle')
    },
    unmount() { for (const cell of cells) if (cell && typeof cell.cleanup === 'function') { cell.cleanup(); cell.cleanup = undefined } },
  }
}
/** Runs one source in a vm: `files` maps a repo path to its source, `stubs` maps an import to its replacement; anything else is an assertion failure. */
function load(rel, source, { env = {}, react, stubs = {}, files = {}, globals = {} } = {}) {
  const cache = new Map()
  const run = (from, src) => {
    if (cache.has(from)) return cache.get(from)
    const mod = { exports: {} }
    cache.set(from, mod.exports)
    vm.runInNewContext(compile(src, from), {
      module: mod, exports: mod.exports, process: { env }, JSON, Math, Object, Array, Set, Map, ...globals,
      require: spec => {
        if (spec in stubs) return stubs[spec]
        if (spec === 'react') return react ?? createRuntime().react
        if (spec === 'react/jsx-runtime') return jsxRuntime
        if (spec.endsWith('.css')) return {}
        const own = spec.startsWith('@/') ? spec.slice(2) + '.ts' : null
        if (own && own in files) return run(own, files[own])
        if (spec === 'lucide-react' || spec.startsWith('@/components/') || spec === 'next/link') return names
        return assert.fail(`Unexpected import in ${from}: ${spec}`)
      },
    })
    cache.set(from, mod.exports)
    return mod.exports
  }
  return run(rel, source)
}
const envFor = (polish, extra = {}) => ({ ...(polish === undefined ? {} : { [FLAG]: polish }), ...extra })
const loadLib = (source, env = {}) => load(LIB, source, { env })
const ON = 'true'

// ---------------------------------------------------------------- 1. the helper
function proveLib(S, label = 'lib') {
  nomatch(S[LIB], /^\s*(?:import\b|export\s+\*?\s*from\b)|require\(/m, `${label}: import-free`)
  deepEq(S[LIB].match(/process\.env\.[A-Z0-9_]+/g), ['process.env.NEXT_PUBLIC_STUDIO_P2_POLISH'], `${label}: the one flag is the only thing it reads from the environment`)
  for (const [value, want] of [['true', true], ['false', false], ['', false], [undefined, false], [null, false], ['TRUE', false], ['True', false], [' true', false], ['true ', false], ['1', false], ['yes', false], ['on', false]]) {
    eq(attempt(() => loadLib(S[LIB], envFor(value)).STUDIO_P2_POLISH_ENABLED), want, `${label}: flag ${JSON.stringify(value)} is ${want ? 'on' : 'off'}`)
  }
  const l = loadLib(S[LIB], envFor(ON))
  eq(l.STUDIO_P2_POLISH_ATTR, 'data-p2-polish', `${label}: the marker attribute`)
  // PP-6: the tier labels are the quota module's own
  const quotaLabels = Object.fromEntries([...LIBS[QUOTA].match(/export const TIER_LABELS[^{]*\{([^}]*)\}/)[1].matchAll(/(\w+):\s*"([^"]+)"/g)].map(m => [m[1], m[2]]))
  deepEq({ ...l.POLISH_TIER_LABELS }, quotaLabels, `${label}: the tier labels equal lib/quota/quota.ts TIER_LABELS`)
  deepEq({ ...l.POLISH_TIER_LABELS }, { free: 'Free', starter: 'Starter', pro: 'Pro', premium: 'Max' }, `${label}: the four plans' names`)
  for (const [quotaLabel, tier, want] of [
    ['Pro', 'pro', 'Pro'], ['Max', 'pro', 'Max'], ['Pro', undefined, 'Pro'], ['Pro', 'weird', 'Pro'], // the read's own label wins
    [undefined, 'free', 'Free'], [null, 'starter', 'Starter'], ['', 'pro', 'Pro'], ['   ', 'premium', 'Max'], [42, 'pro', 'Pro'], [{}, 'free', 'Free'], // else the session's tier
    [undefined, undefined, undefined], [undefined, null, undefined], [undefined, '', undefined], [undefined, 'enterprise', undefined], [undefined, 'PRO', undefined], [undefined, 'Pro', undefined],
    [undefined, 'constructor', undefined], [undefined, '__proto__', undefined], [undefined, 'toString', undefined], [undefined, 'hasOwnProperty', undefined], [undefined, 3, undefined], [undefined, { pro: 1 }, undefined],
  ]) eq(attempt(() => l.polishTierLabel(quotaLabel, tier)), want, `${label}: badge for read ${JSON.stringify(quotaLabel)} and tier ${JSON.stringify(tier)}`)
  deepEq({ ...l.POLISH_USAGE_UNAVAILABLE }, { line: 'Usage unavailable', hint: 'We could not read your usage just now. Open this menu again to retry.' }, `${label}: the unavailable words`)
  for (const [meters, hasQuota, failed, want] of [
    [2, true, false, 'meters'], [1, true, false, 'meters'], [2, true, true, 'meters'], [1, false, true, 'meters'], [2, false, false, 'meters'], // a readable share always wins (a stale read is still shown)
    [0, false, false, 'pending'], // no read yet: nothing, as the menu has always done while it waits
    [0, true, false, 'unavailable'], [0, false, true, 'unavailable'], [0, true, true, 'unavailable'], // a read that gave nothing to show, or failed
  ]) eq(attempt(() => l.polishUsageState({ meters, hasQuota, failed })), want, `${label}: usage state for ${meters} meters, quota ${hasQuota}, failed ${failed}`)
  return l
}

// ---------------------------------------------------------------- 2. the strip table: nothing is changed that is not listed
const MARKERS = ['STUDIO_P2_POLISH', 'quotaFailed', 'sessionTier', 'badgeLabel', 'PublishManageDock', 'polishUsageState', 'polishTierLabel', 'POLISH_USAGE_UNAVAILABLE', 'usageUnavailable']
// the one kind of change a line-level guard cannot see: state that only a flag-guarded line sets, proved inert by flag-off identity of the executed menu (section 3)
const UNGUARDED_BUT_INERT = ['  const [quotaFailed, setQuotaFailed] = useState(false)']
const walk = dir => fs.readdirSync(path.join(repoRoot, dir), { withFileTypes: true }).flatMap(entry => {
  const rel = path.posix.join(dir, entry.name)
  return entry.isDirectory() ? (entry.name === 'node_modules' || entry.name === '.next' ? [] : walk(rel)) : [rel]
})
const git = (...args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
function proveStrip(S) {
  const changedFiles = POLISH_FILES
  for (const rel of changedFiles) {
    const stripped = stripP2Polish(rel, S[rel])
    ok(sameAsBase(rel, stripped, baseSource(rel)), `${rel}: stripping this change gives back the base's file, byte for byte`)
    let textNow = S[rel]
    for (const [from, to] of POLISH_PAIRS[rel] ?? []) {
      eq(textNow.split(from).length - 1, 1, `${rel}: one place for ${JSON.stringify(from.slice(0, 70))}`)
      assert.notEqual(from, to); tick()
      textNow = textNow.replace(from, () => to)
    }
    const marker = POLISH_APPENDED[rel]
    if (marker !== undefined) {
      eq(S[rel].split(marker).length - 1, 1, `${rel}: the appended block starts once`)
      ok(S[rel].indexOf(marker) > 0 && baseSource(rel) === S[rel].slice(0, S[rel].indexOf(marker)), `${rel}: everything before the appended block is the base's file`)
    } else ok(sameAsBase(rel, textNow, baseSource(rel)), `${rel}: the listed changes, put back one by one, give back the base's file`)
    // each pair that adds code mentions the flag (or a state it guards), unless it adds only imports, comments, JSX closers or optional type members
    for (const [from, to] of POLISH_PAIRS[rel] ?? []) {
      const had = new Map()
      for (const line of to.split('\n')) had.set(line, (had.get(line) ?? 0) + 1)
      const added = []
      for (const line of from.split('\n')) { if ((had.get(line) ?? 0) > 0) had.set(line, had.get(line) - 1); else added.push(line) }
      const code = added.filter(line => line.trim() && !UNGUARDED_BUT_INERT.includes(line) && !/^\s*(\/\/|\/\*|\*|\{\/\*)/.test(line) && !/^\s*import\b/.test(line) && !/^\s*\}?\s*from '/.test(line) && !/^\s*[A-Za-z_]+\?: [^=]+$/.test(line) && !/^\s*(<\/[A-Za-z.]*>|[)}\]]+)[;,)]*\s*$/.test(line) && !/^\s*"test:studio-p2-polish"/.test(line) && !/^\s*"test:studio-p2-second-brain"/.test(line))
      if (code.length && rel !== PKG) ok(MARKERS.some(marker => added.some(line => line.includes(marker))), `${rel}: guarded by the flag: ${added.join(' / ').slice(0, 140)}`)
    }
  }
  // the flag is read in the lib only; the lib is imported by the changed files only and the base has never heard of it
  const scanned = ['components', 'app', 'lib', 'hooks'].flatMap(walk).filter(rel => /\.(tsx?|css)$/.test(rel))
  const users = scanned.filter(rel => rel !== LIB && new RegExp(`process\\.env\\.${FLAG}(?![A-Za-z0-9_])`).test(fs.readFileSync(path.join(repoRoot, rel), 'utf8')))
  deepEq(users, [], `${FLAG} is read in the lib only`)
  for (const rel of scanned) {
    if (rel === LIB) continue
    if (fs.readFileSync(path.join(repoRoot, rel), 'utf8').includes('studio-p2-polish')) ok(changedFiles.includes(rel) || POLISH_NEW_FILES.includes(rel), `${rel} mentions the polish lib and is in the strip table`)
  }
  eq(attempt(() => git('ls-tree', '-r', '--name-only', BASE_COMMIT, '--', LIB)), '', `${LIB} does not exist in the base`)
  // the earlier tests that hold these files read them with this change put back out first (one import, one read(), nothing else of theirs is touched here)
  for (const rel of ['scripts/test-studio-p2-landing.mjs', 'scripts/test-studio-p2-profile-menu.mjs', 'scripts/test-studio-p2-intelligence.mjs', 'scripts/test-studio-p2-publish.mjs', 'scripts/test-studio-version-history-v2.mjs']) {
    const test = read(rel)
    eq(test.split("import { stripP2Polish } from './studio-p2-polish-strip.mjs'\n").length - 1, 1, `${rel}: imports the strip once`)
    eq(test.split("const read = rel => stripP2Polish(rel, fs.readFileSync(").length - 1, 1, `${rel}: its read() puts this change back out first`)
    eq(test.split('stripP2Polish(').length - 1, 1, `${rel}: and uses it nowhere else`)
  }
}

// ---------------------------------------------------------------- 3 + 4. executed components
const NAV = [{ label: 'Build', href: '/#zoom' }, { label: 'Bring', href: '/bring' }, { label: 'Present', href: '/present' }, { label: 'Experts', href: '/experts' }, { label: 'Pricing', href: '/pricing' }]
const FLAG_COMBOS = [undefined, 'false', 'TRUE', ' true', 'true ', '1', '']

// the profile menu (PP-6): the executed Pass 2 body
function loadProfile(source, env, polishSource) {
  return load(PROFILE, source, { env, files: { [PROFILE_LIB]: LIBS[PROFILE_LIB], ...(polishSource ? { [LIB]: polishSource } : {}) } }).StudioProfileMenuP2
}
const account = { name: 'Ada Morgan', email: 'ada@example.invalid', image: null, initials: 'AM', theme: 'light', onTheme() {}, onNavigate() {}, onAbout() {}, onLogout() {} }
const GOOD = { remainingPct: { daily: .37, weekly: .82 }, resetAt: { daily: '2099-01-01T05:00:00Z', weekly: '2099-01-08T00:00:00Z' } }
const UNREADABLE = { remainingPct: { daily: 'x', weekly: null } }
const PROFILE_CASES = [
  { name: 'no read yet', quota: null, quotaFailed: false, tierLabel: undefined, sessionTier: 'pro' },
  { name: 'read failed', quota: null, quotaFailed: true, tierLabel: undefined, sessionTier: 'pro' },
  { name: 'read failed, free tier', quota: null, quotaFailed: true, tierLabel: undefined, sessionTier: 'free' },
  { name: 'read failed, unknown tier', quota: null, quotaFailed: true, tierLabel: undefined, sessionTier: 'enterprise' },
  { name: 'read failed, no tier', quota: null, quotaFailed: true, tierLabel: undefined, sessionTier: undefined },
  { name: 'good read', quota: GOOD, quotaFailed: false, tierLabel: 'Pro', sessionTier: 'pro' },
  { name: 'good read, the quota names Max, the session says pro', quota: GOOD, quotaFailed: false, tierLabel: 'Max', sessionTier: 'pro' },
  { name: 'stale read, then a failure', quota: GOOD, quotaFailed: true, tierLabel: 'Pro', sessionTier: 'pro' },
  { name: 'a read with no readable share', quota: UNREADABLE, quotaFailed: false, tierLabel: 'Pro', sessionTier: 'pro' },
  { name: 'a read with an empty label and no shares', quota: UNREADABLE, quotaFailed: false, tierLabel: '', sessionTier: 'premium' },
]
const find = (tree, pred) => nodes(tree).filter(pred)
const badges = tree => find(tree, n => n.props?.['data-studio-v4-profile-role'] === 'tier')
const usageCards = tree => find(tree, n => n.props?.['data-studio-p2-usage'] === 'true')
function proveProfile(S, label = 'profile menu') {
  const polishOn = loadProfile(S[PROFILE], envFor(ON), S[LIB])
  const baseMenu = loadProfile(baseSource(PROFILE), {}, null)
  for (const c of PROFILE_CASES) {
    const props = { ...account, quota: c.quota, quotaFailed: c.quotaFailed, tierLabel: c.tierLabel, sessionTier: c.sessionTier }
    // flag off: every cell draws the base's tree (extra props are ignored)
    for (const value of FLAG_COMBOS) {
      const off = loadProfile(S[PROFILE], envFor(value), S[LIB])
      eq(norm(off(props)), norm(baseMenu(props)), `${label}: flag ${JSON.stringify(value)} draws the base's tree (${c.name})`)
    }
    const tree = polishOn(props)
    const cards = usageCards(tree), bs = badges(tree)
    const unavailable = find(tree, n => n.props?.['data-studio-p2-usage-unavailable'] !== undefined)
    const meters = find(tree, n => n.props?.['data-studio-p2-meter'] !== undefined)
    // PP-6a: the badge is the quota's own label, else the session's tier, else none
    const wantBadge = c.tierLabel && c.tierLabel.trim() !== '' ? c.tierLabel : ({ free: 'Free', starter: 'Starter', pro: 'Pro', premium: 'Max' })[c.sessionTier]
    deepEq(bs.map(n => text(n)), wantBadge ? [wantBadge] : [], `${label}: on, the badge for ${c.name}`)
    // PP-6b: meters when there are readable shares; "Usage unavailable" when the read failed or gave none; nothing while pending
    const readable = c.quota === GOOD
    if (readable) { eq(meters.length, 2, `${label}: on, two meters for ${c.name}`); eq(unavailable.length, 0, `${label}: on, no unavailable card for ${c.name}`) }
    else if (c.quotaFailed || c.quota) {
      eq(meters.length, 0, `${label}: on, no meters for ${c.name}`)
      eq(unavailable.length, 1, `${label}: on, one unavailable card for ${c.name}`)
      eq(cards.length, 1, `${label}: on, and it is the capacity card for ${c.name}`)
      eq(unavailable[0].props['data-p2-polish'], 'true', `${label}: the unavailable card carries the marker for ${c.name}`)
      eq(unavailable[0].props.role, 'group', `${label}: a labelled group for ${c.name}`)
      eq(unavailable[0].props['aria-label'], 'Your creative capacity', `${label}: named like the capacity card for ${c.name}`)
      const sentence = find(unavailable[0], n => n.props?.['data-studio-p2-usage-unavailable-line'] !== undefined)
      eq(sentence.length, 1, `${label}: one line for ${c.name}`)
      eq(sentence[0].props.role, 'status', `${label}: announced politely for ${c.name}`)
      eq(text(sentence[0]), 'Usage unavailable' + 'We could not read your usage just now. Open this menu again to retry.', `${label}: the words for ${c.name}`)
      eq(find(unavailable[0], n => n.props?.['data-studio-p2-upgrade'] !== undefined).length, 0, `${label}: no upgrade row without usage for ${c.name}`)
    } else { eq(cards.length, 0, `${label}: on, nothing while the read is pending (${c.name})`) }
    if (readable) eq(norm(find(tree, n => n.props?.['data-studio-p2-usage'] === 'true')), norm(find(baseMenu(props), n => n.props?.['data-studio-p2-usage'] === 'true')), `${label}: on, the meters card is the base's own (${c.name})`)
    // nothing else of the menu moves
    const stripUsage = t => norm(find(t, n => n.props?.['data-studio-p2-appearance-block'] !== undefined || n.props?.['data-studio-p2-row'] !== undefined || n.props?.['data-studio-v4-profile-role'] === 'danger'))
    eq(stripUsage(tree), stripUsage(baseMenu(props)), `${label}: on, the rows, appearance and sign-out are the base's (${c.name})`)
  }
  // the parent menu keeps the read's failure only with the flag on, and only reads the session's tier from the session
  const parent = S[PARENT]
  eq((parent.match(/setQuotaFailed\(true\)/g) ?? []).length, 2, `${label}: parent: a failed read (an error status, a throw) is recorded twice`)
  eq((parent.match(/setQuotaFailed\(false\)/g) ?? []).length, 1, `${label}: parent: a good read clears it`)
  eq((parent.match(/if \(STUDIO_P2_POLISH_ENABLED\) setQuotaFailed\(false\)/g) ?? []).length, 1, `${label}: parent: clearing is behind the flag`)
  match(parent, /\} else if \(STUDIO_P2_POLISH_ENABLED\) setQuotaFailed\(true\)\n/, `${label}: parent: an error status is behind the flag`)
  match(parent, /catch \{\n\s*\/\/ Non-fatal[^\n]*\n\s*if \(STUDIO_P2_POLISH_ENABLED\) setQuotaFailed\(true\)\n/, `${label}: parent: a throw is behind the flag`)
  match(parent, /<StudioProfileMenuP2 [^>]*tierLabel=\{quota\?\.tierLabel\} sessionTier=\{user\.tier\} quotaFailed=\{quotaFailed\} /, `${label}: parent: the Pass 2 body gets the session's tier and the failure`)
  match(parent, /import \{ STUDIO_P2_POLISH_ENABLED \} from "@\/lib\/studio-p2-polish"/, `${label}: parent: imports the flag only`)
  match(S[PROFILE], /const badgeLabel = STUDIO_P2_POLISH_ENABLED \? polishTierLabel\(tierLabel, sessionTier\) : tierLabel/, `${label}: the badge follows the flag`)
  match(S[PROFILE], /if \(STUDIO_P2_POLISH_ENABLED && polishUsageState\(\{ meters: meters\.length, hasQuota: Boolean\(quota\), failed: Boolean\(failed\) \}\) === "unavailable"\)/, `${label}: the unavailable card follows the flag and the state`)
}

// the landing menu (PP-4): executed under the hooks runtime
function mountMenu(source, env, polishSource) {
  const runtime = createRuntime()
  const listeners = new Map()
  const document = {
    addEventListener: (type, fn) => listeners.set(type, [...(listeners.get(type) ?? []), fn]),
    removeEventListener: (type, fn) => listeners.set(type, (listeners.get(type) ?? []).filter(item => item !== fn)),
  }
  const { HeaderMenuP2 } = load(MENU, source, {
    env, react: runtime.react, globals: { document },
    stubs: { 'next/link': { default: 'Link' }, 'next/navigation': { usePathname: () => '/' }, '@/lib/marketing/v3-content': { V3_CONTENT: { nav: NAV } } },
    files: { 'lib/studio-p2-landing.ts': LIBS['lib/studio-p2-landing.ts'], ...(polishSource ? { [LIB]: polishSource } : {}) },
  })
  const inside = new Set(), focus = []
  const wrapNode = { contains: node => node === wrapNode || inside.has(node) }
  const buttonNode = { focus: () => focus.push('button') }
  return {
    focus, inside, listeners,
    view() {
      const tree = runtime.render(HeaderMenuP2, {})
      const all = nodes(tree)
      const wrap = all.find(n => n.props?.['data-p2-landing-menu'] !== undefined)
      const button = all.find(n => n.type === 'button')
      if (wrap) wrap.props.ref.current = wrapNode
      if (button) button.props.ref.current = buttonNode
      return { tree, wrap, button, panel: all.find(n => n.type === 'nav'), scrim: all.find(n => n.props?.className === 'p2-menu__scrim'), links: all.filter(n => n.type === 'Link') }
    },
    fire(type, event) { for (const fn of [...(listeners.get(type) ?? [])]) fn(event) },
    unmount() { runtime.unmount() },
  }
}
function proveMenu(S, label = 'landing menu') {
  // flag off: the same tree as the base's, closed and open, for every spelling of "off"
  const baseMenu = mountMenu(baseSource(MENU), envFor(ON, { NEXT_PUBLIC_STUDIO_P2_LANDING: 'true' }), null)
  const baseClosed = norm(baseMenu.view().tree)
  baseMenu.view().button.props.onClick()
  const baseOpen = norm(baseMenu.view().tree)
  for (const value of FLAG_COMBOS) {
    const w = mountMenu(S[MENU], envFor(value), S[LIB])
    eq(norm(w.view().tree), baseClosed, `${label}: flag ${JSON.stringify(value)}, closed, draws the base's tree`)
    w.view().button.props.onClick()
    eq(norm(w.view().tree), baseOpen, `${label}: flag ${JSON.stringify(value)}, open, draws the base's tree`)
    eq(w.view().scrim, undefined, `${label}: flag ${JSON.stringify(value)}: no scrim`)
    w.unmount()
  }
  baseMenu.unmount()
  // flag on
  const w = mountMenu(S[MENU], envFor(ON), S[LIB])
  const innerNode = { inner: true }
  w.inside.add(innerNode)
  let v = w.view()
  eq(v.wrap.props['data-p2-polish'], 'true', `${label}: on, the wrapper carries the marker`)
  eq(v.wrap.props['data-p2-landing-menu'], 'true', `${label}: and the landing marker`)
  ok(v.scrim, `${label}: on, there is a scrim`)
  eq(v.scrim.type, 'span', `${label}: a plain span (no new element kind)`)
  eq(v.scrim.props['aria-hidden'], 'true', `${label}: hidden from assistive technology`)
  eq(v.scrim.props.hidden, true, `${label}: closed, the scrim is hidden`)
  ok(nodes(v.wrap).indexOf(v.scrim) > nodes(v.wrap).indexOf(v.panel), `${label}: the scrim follows the panel`)
  eq(typeof v.scrim.props.onClick, 'function', `${label}: the scrim takes a press`)
  deepEq(v.links.map(n => [text(n), n.props.href]), [['Bring', '/bring'], ['Present', '/present'], ['Experts', '/experts'], ['Pricing', '/pricing']], `${label}: on, the same four links`)
  v.button.props.onClick(); v = w.view()
  eq(v.wrap.props['data-open'], 'true', `${label}: on, the button opens`)
  eq(v.scrim.props.hidden, false, `${label}: open, the scrim is shown`)
  eq(v.panel.props.hidden, false, `${label}: open, the panel is shown`)
  w.inside.add(v.scrim) // the scrim is a child of the wrapper, as in the DOM
  w.fire('pointerdown', { target: v.scrim }); v = w.view()
  eq(v.wrap.props['data-open'], 'true', `${label}: a press inside the wrapper (the scrim is inside it) alone does not close`)
  v.scrim.props.onClick(); v = w.view()
  eq(v.wrap.props['data-open'], 'false', `${label}: the scrim's click closes the menu`)
  eq(v.scrim.props.hidden, true, `${label}: and the scrim goes`)
  eq(v.panel.props.hidden, true, `${label}: and the panel`)
  deepEq(w.focus, [], `${label}: a press on the scrim does not move the focus (the press went elsewhere)`)
  // everything else is unchanged: outside press, Escape (focus back), a chosen link, the toggle
  v.button.props.onClick(); v = w.view()
  w.fire('pointerdown', { target: { outside: true } }); v = w.view()
  eq(v.wrap.props['data-open'], 'false', `${label}: on, a press outside still closes`)
  v.button.props.onClick(); v = w.view()
  w.fire('keydown', { key: 'Escape' }); v = w.view()
  eq(v.wrap.props['data-open'], 'false', `${label}: on, Escape still closes`)
  deepEq(w.focus, ['button'], `${label}: on, Escape still gives the focus back`)
  v.button.props.onClick(); v = w.view()
  v.links[1].props.onClick(); v = w.view()
  eq(v.wrap.props['data-open'], 'false', `${label}: on, a chosen link still closes`)
  w.unmount()
  eq((w.listeners.get('keydown') ?? []).length + (w.listeners.get('pointerdown') ?? []).length, 0, `${label}: no listener is left behind`)
  // the page's own flag: the menu is mounted by HeaderV3 only with it on (unchanged by this work), so with it off none of this exists
  const header = baseSource('components/marketing/v3/HeaderV3.tsx')
  match(header, /\{STUDIO_P2_LANDING && <HeaderMenuP2 \/>\}/, `${label}: the header mounts the menu only with NEXT_PUBLIC_STUDIO_P2_LANDING`)
  ok(read('components/marketing/v3/HeaderV3.tsx') === header, `${label}: and HeaderV3 is the base's, byte for byte`)
}

// publish (PP-1 / PP-2 / PP-3): the executed publish-p2.tsx, and the wizard / dialog wiring
function loadPublishP2(source, env, polishSource) {
  const state = { copies: 0 }
  const mod = load(P2PUB, source, {
    env, files: { [PUBLISH_LIB]: LIBS[PUBLISH_LIB], ...(polishSource ? { [LIB]: polishSource } : {}) },
    stubs: {
      '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
      '@/hooks/use-copy-to-clipboard': { useCopyToClipboard: () => ({ copied: false, copy: async () => { state.copies++; return true } }) },
    },
  })
  return { mod, state }
}
const POLISH_EVAL = (name, source, vars) => { // the one `const STUDIO_P2_POLISH = ...` line of a file, evaluated
  const line = source.match(new RegExp(`^const STUDIO_P2_POLISH = ([^\\n]+)$`, 'm'))
  assert.ok(line, `${name} has the polish constant`); tick()
  return vm.runInNewContext(line[1], vars)
}
function provePublish(S, label = 'publish') {
    const flagsOf = (polish, pub, shell) => envFor(polish, { ...(pub === undefined ? {} : { NEXT_PUBLIC_STUDIO_P2_PUBLISH: pub }), ...(shell === null ? {} : { NEXT_PUBLIC_STUDIO_V4_SHELL: shell }) }) // null: the shell flag unset
  const children = jsx('footer', { className: 'studio-publish-management-actions' })
  // PP-3: the dock
  for (const [polish, pub, shell, want] of [
    [ON, 'true', 'true', true], [undefined, 'true', 'true', false], ['false', 'true', 'true', false], ['TRUE', 'true', 'true', false], [' true', 'true', 'true', false], ['1', 'true', 'true', false],
    [ON, undefined, 'true', false], [ON, 'false', 'true', false], [ON, 'TRUE', 'true', false], [ON, 'true', null, false], [ON, 'true', 'false', false],
  ]) {
    const { mod } = loadPublishP2(S[P2PUB], flagsOf(polish, pub, shell), S[LIB])
    let done = 0
    const tree = mod.PublishManageDock({ children, onDone: () => { done++ } })
    const tag = `polish ${JSON.stringify(polish)}, page flag ${JSON.stringify(pub)}, shell ${JSON.stringify(shell)}`
    if (!want) {
      eq(tree.type, 'Fragment', `${label}: ${tag}: the dock is just the footer (a fragment)`)
      eq(norm(tree.props.children), norm(children), `${label}: ${tag}: with nothing added`)
      eq(nodes(tree).length, 2, `${label}: ${tag}: one node besides the fragment`)
      continue
    }
    eq(tree.type, 'div', `${label}: ${tag}: a dock`)
    eq(tree.props.className, 'studio-publish-dock', `${label}: ${tag}: its class`)
    eq(tree.props['data-p2-polish'], 'true', `${label}: ${tag}: its marker`)
    const kids = tree.props.children
    eq(kids[0], children, `${label}: ${tag}: the footer first, untouched`)
    eq(kids[1].props.className, 'studio-publish-done-row', `${label}: ${tag}: then the done row`)
    const button = nodes(kids[1]).find(n => n.type === 'Button')
    ok(button, `${label}: ${tag}: a Button`)
    eq(text(button), 'Done', `${label}: ${tag}: it says Done`)
    eq(button.props.type, 'button', `${label}: ${tag}: it does not submit`)
    eq(button.props.size, 'sm', `${label}: ${tag}: the dialog's small size`)
    eq(done, 0, `${label}: ${tag}: nothing closes before the press`)
    button.props.onClick()
    eq(done, 1, `${label}: ${tag}: Done closes (once)`)
  }
  // PP-2: the anchor carries the marker only with both flags on
  for (const [polish, pub, shell, want] of [[ON, 'true', 'true', true], [undefined, 'true', 'true', false], ['false', 'true', 'true', false], [ON, 'false', 'true', false], [ON, 'true', 'false', false]]) {
    const { mod } = loadPublishP2(S[P2PUB], flagsOf(polish, pub, shell), S[LIB])
    const tree = mod.PublishDoneLink({ url: 'https://example.invalid/p/x' })
    const button = nodes(tree).find(n => n.type === 'Button' && n.props.className === 'studio-publish-view-as-viewer')
    ok(button, `${label}: the done link has its "View as a viewer" button`)
    eq(button.props['data-p2-polish'], want ? 'true' : undefined, `${label}: PP-2 marker with polish ${JSON.stringify(polish)}, page ${JSON.stringify(pub)}, shell ${JSON.stringify(shell)}: ${want}`)
    eq(button.props.asChild, true, `${label}: still an anchor (asChild)`)
    eq(find(button, n => n.type === 'a').length, 1, `${label}: with its link`)
  }
  // PP-1: the wizard marker's gate is the page flag AND this one
  const truth = (name, source, pageName) => {
    for (const [polish, page, want] of [[true, true, true], [true, false, false], [false, true, false], [false, false, false]]) eq(POLISH_EVAL(name, source, { [pageName]: page, STUDIO_P2_POLISH_ENABLED: polish }), want, `${label}: ${name}: page ${page} AND polish ${polish} is ${want}`)
  }
  truth(WIZARD, S[WIZARD], 'STUDIO_P2_PUBLISH')
  truth(P2PUB, S[P2PUB], 'STUDIO_P2_PUBLISH_ENABLED')
  match(S[WIZARD], /<div className="space-y-4 studio-publish-wizard" data-studio-publish-wizard=\{STUDIO_PUBLISH\} \{\.\.\.\(STUDIO_P2_POLISH \? \{ \[STUDIO_P2_POLISH_ATTR\]: 'true' \} : \{\}\)\}>/, `${label}: the wizard root carries the marker with the gate`)
  match(S[WIZARD], /if \(STUDIO_P2_POLISH && stepBody\.parentElement\) for \(const pane of \[stepBody\.parentElement, \.\.\.Array\.from\(stepBody\.parentElement\.children\)\]\) \(pane as HTMLElement\)\.scrollTop = 0/, `${label}: the grid and both panes go back to the top on each step, with the gate`)
  match(S[WIZARD], /const scrollBody = stepBody\.closest<HTMLElement>\('\.studio-publish-body'\)\n\s*if \(scrollBody\) scrollBody\.scrollTop = 0\n/, `${label}: and the dialog body's own reset is still there`)
  eq((S[WIZARD].match(/data-p2-polish|STUDIO_P2_POLISH_ATTR/g) ?? []).length, 2, `${label}: the wizard names the marker once (import + one use)`)
  // PP-3: the dialog puts the footer inside the dock and Done closes the dialog the way the X does
  match(S[DIALOG], /<PublishManageDock onDone=\{\(\) => onOpenChange\(false\)\}>\n\s*<DialogFooter className="sm:justify-between studio-publish-management-actions">/, `${label}: the dialog's footer sits in the dock, Done calls onOpenChange(false)`)
  match(S[DIALOG], /<\/DialogFooter>\n\s*<\/PublishManageDock>\n\s*<\/div>\n\s*\)\}\n\s*<\/PublishDialogBody>/, `${label}: and only the manage footer is inside it`)
  eq((S[DIALOG].match(/PublishManageDock/g) ?? []).length, 3, `${label}: the dialog names the dock three times (import, open, close)`)
  match(S[DIALOG], /import \{ PublishManageDock, PublishPasscodeCounter,/, `${label}: imported from publish-p2`)
}

// ---------------------------------------------------------------- 5. the CSS
const ruleKey = rule => rule.selector.replace(/\s+/g, ' ').trim()
function blocks(S) {
  const out = {}
  for (const [name, rel] of Object.entries(CSS)) {
    const at = S[rel].indexOf(POLISH_APPENDED[rel])
    assert.ok(at > 0, `${rel}: the appended block exists`); tick()
    out[name] = postcss.parse(S[rel].slice(at))
  }
  return out
}
function proveCss(S, label = 'css') {
  const roots = blocks(S)
  const decl = (rule, prop) => { let v = null; rule?.walkDecls(prop, d => { v = d.value.replace(/\s+/g, ' ') }); return v }
  const rulesOf = (root, within) => { const found = []; (within ?? root).walkRules(rule => { if (!within || rule.parent === within) found.push(rule) }); return found }
  const at = (root, params) => { let found = null; root.walkAtRules('media', rule => { if (rule.params.replace(/\s+/g, ' ') === params) found = rule }); return found }
  const top = root => root.nodes.filter(n => n.type === 'rule')
  const find = (root, selector, within) => (within ? rulesOf(root, within) : top(root)).find(rule => ruleKey(rule) === selector)
  const FLAG_ONLY = { 'data-p2-polish': 1, 'data-studio-p2-usage-unavailable': 1, 'data-studio-p2-usage-unavailable-line': 1 }
  // every rule of every appended block is scoped to markup that exists only with the flag on
  for (const [name, root] of Object.entries(roots)) {
    let n = 0
    root.walkRules(rule => { for (const selector of rule.selectors) { n++; ok(Object.keys(FLAG_ONLY).some(attr => selector.includes(`[${attr}="true"]`)), `${label}: ${name}: "${selector}" is scoped to a flag-only marker`) } })
    ok(n > 0, `${label}: ${name} has rules`)
    root.walkAtRules(rule => ok(rule.name === 'media', `${label}: ${name}: only media rules`))
  }
  // the markers the flag-only rules rely on do not exist in the base's markup
  for (const attr of ['data-p2-polish', 'data-studio-p2-usage-unavailable', 'p2-menu__scrim', 'studio-publish-dock', 'studio-publish-done-row']) {
    const inBase = ['components', 'app', 'lib', 'hooks', 'styles'].some(dir => { try { return git('grep', '-l', '-F', attr, BASE_COMMIT, '--', dir) !== '' } catch { return false } })
    ok(!inBase, `${label}: ${attr} is nowhere in the base`)
  }
  const W = '[data-studio-publish="true"] .studio-publish-wizard[data-p2-polish="true"]'
  // PP-1
  const pub = roots.publish
  const body = find(pub, '[data-studio-publish="true"] .studio-publish-body:has(> .studio-publish-wizard[data-p2-polish="true"])')
  eq(decl(body, 'display'), 'flex', `${label}: PP-1: the body is a flex column while the wizard is in it`)
  eq(decl(body, 'flex-direction'), 'column', `${label}: PP-1: column`)
  eq(decl(body, 'overflow'), 'hidden', `${label}: PP-1: it stops being the one scroller`)
  const wizard = find(pub, W)
  eq(decl(wizard, 'display'), 'flex', `${label}: PP-1: the wizard is a flex column`)
  eq(decl(wizard, 'flex-direction'), 'column', `${label}: PP-1: column`)
  eq(decl(wizard, 'flex'), '1 1 auto', `${label}: PP-1: it takes the room the dialog gives`)
  eq(decl(wizard, 'min-height'), '0', `${label}: PP-1: and may shrink below its content`)
  const chrome = find(pub, `${W} > :is(.studio-publish-steps, .studio-publish-wizard-actions)`)
  eq(decl(chrome, 'position'), 'static', `${label}: PP-1: the steps and the footer stop overlaying the content`)
  eq(decl(chrome, 'flex-shrink'), '0', `${label}: PP-1: and keep their size`)
  const grid = find(pub, `${W} > .studio-publish-setup-grid`)
  eq(decl(grid, 'flex'), '1 1 auto', `${label}: PP-1: the grid fills between them`)
  eq(decl(grid, 'min-height'), '0', `${label}: PP-1: shrinking`)
  eq(decl(grid, 'grid-template-rows'), 'minmax(0, 1fr)', `${label}: PP-1: one row as tall as the grid`)
  eq(decl(grid, 'align-items'), 'stretch', `${label}: PP-1: both panes as tall as the row`)
  const panes = find(pub, `${W} > .studio-publish-setup-grid > :is(.studio-publish-step-body, .studio-publish-viewer-summary)`)
  eq(decl(panes, 'min-height'), '0', `${label}: PP-1: the panes may be shorter than their content`)
  eq(decl(panes, 'overflow-y'), 'auto', `${label}: PP-1: and scroll`)
  eq(decl(panes, 'overscroll-behavior'), 'contain', `${label}: PP-1: without chaining`)
  const aside = find(pub, `${W} > .studio-publish-setup-grid > .studio-publish-viewer-summary`)
  eq(decl(aside, 'align-content'), 'start', `${label}: PP-1: the panel's rows do not stretch`)
  eq(decl(aside, 'grid-auto-rows'), 'max-content', `${label}: PP-1: the panel's rows do not shrink (the thumbnail was squeezed without this)`)
  const stepPane = find(pub, `${W} > .studio-publish-setup-grid > .studio-publish-step-body`)
  eq(decl(stepPane, 'padding'), '4px', `${label}: PP-1: the step pane leaves room for a focus ring (it clips at its edge now)`)
  eq(decl(stepPane, 'margin'), '-4px', `${label}: PP-1: and takes it back, so the content stays where it was`)
  const phone = at(pub, '(max-width: 700px)')
  ok(phone, `${label}: PP-1: a phone rule`)
  const phoneGrid = find(pub, `${W} > .studio-publish-setup-grid`, phone)
  eq(decl(phoneGrid, 'grid-template-rows'), 'none', `${label}: PP-1: phone: the two stack, no fixed row`)
  eq(decl(phoneGrid, 'align-items'), 'start', `${label}: PP-1: phone: start`)
  eq(decl(phoneGrid, 'overflow-y'), 'auto', `${label}: PP-1: phone: the grid is the one scroller`)
  const phonePanes = find(pub, `${W} > .studio-publish-setup-grid > :is(.studio-publish-step-body, .studio-publish-viewer-summary)`, phone)
  eq(decl(phonePanes, 'overflow'), 'visible', `${label}: PP-1: phone: the panes do not scroll`)
  eq(decl(phonePanes, 'min-height'), 'auto', `${label}: PP-1: phone: and are not shrinkable (a 0 here squeezed both rows into the grid's height)`)
  // PP-2
  const link = find(pub, '[data-studio-publish="true"] a.studio-publish-view-as-viewer[data-p2-polish="true"]')
  eq(decl(link, 'background'), 'var(--ss-action, var(--sp-primary))', `${label}: PP-2: the shell's action colour`)
  eq(decl(link, 'color'), 'var(--ss-on-action, var(--sp-primary-text))', `${label}: PP-2: and its text colour`)
  eq(decl(find(pub, '[data-studio-publish="true"] a.studio-publish-view-as-viewer[data-p2-polish="true"]:hover'), 'background'), 'var(--ss-action-hover, var(--sp-primary))', `${label}: PP-2: hover`)
  nomatch(decl(link, 'background') ?? '', /accent|violet|indigo|purple/, `${label}: PP-2: not the violet`)
  // PP-3
  const dock = find(pub, '[data-studio-publish="true"] .studio-publish-dock[data-p2-polish="true"]')
  eq(decl(dock, 'position'), 'sticky', `${label}: PP-3: the dock sticks where the footer did`)
  eq(decl(dock, 'bottom'), '0', `${label}: PP-3: to the bottom`)
  eq(decl(dock, 'z-index'), '12', `${label}: PP-3: at the footer's layer`)
  eq(decl(dock, 'display'), 'grid', `${label}: PP-3: the footer, then the done row`)
  eq(decl(dock, 'background'), 'var(--sp-panel)', `${label}: PP-3: opaque, so content never shows through`)
  const inner = find(pub, '[data-studio-publish="true"] .studio-publish-dock[data-p2-polish="true"] > .studio-publish-management-actions')
  eq(decl(inner, 'position'), 'static', `${label}: PP-3: the footer inside stops sticking on its own`)
  eq(decl(inner, 'box-shadow'), 'none', `${label}: PP-3: and drops its fade (the dock has it)`)
  const row = find(pub, '[data-studio-publish="true"] .studio-publish-dock[data-p2-polish="true"] > .studio-publish-done-row')
  eq(decl(row, 'display'), 'flex', `${label}: PP-3: the done row`)
  eq(decl(row, 'justify-content'), 'flex-end', `${label}: PP-3: Done at the right, as in the mock`)
  ok(/solid var\(--sp-line\)/.test(decl(row, 'border-top') ?? ''), `${label}: PP-3: under a hairline, as in the mock`)
  // PP-4
  const land = roots.landing
  const M = '.mv3 [data-p2-landing-menu][data-p2-polish="true"]'
  const m900 = at(land, '(max-width: 900px)'), m520 = at(land, '(max-width: 520px)')
  ok(m900 && m520, `${label}: PP-4: a 900px and a 520px rule`)
  eq(decl(find(land, M, m900), 'position'), 'static', `${label}: PP-4: the wrapper stops being the anchor, so the panel and scrim hang from the header`)
  eq(decl(find(land, `${M} .p2-menu__panel`, m900), 'right'), '28px', `${label}: PP-4: the dropdown keeps the header's right margin`)
  const scrim = find(land, `${M} .p2-menu__scrim`, m900)
  eq(decl(scrim, 'position'), 'absolute', `${label}: PP-4: the scrim hangs from the header (no fixed: the header's backdrop-filter would be its box)`)
  eq(decl(scrim, 'top'), '100%', `${label}: PP-4: it starts under the header`)
  eq(decl(scrim, 'left'), '0', `${label}: PP-4: edge to edge`)
  eq(decl(scrim, 'right'), '0', `${label}: PP-4: edge to edge`)
  eq(decl(scrim, 'cursor'), 'pointer', `${label}: PP-4: a press target on touch screens`)
  match(decl(scrim, 'background') ?? '', /^rgba\(8, 9, 14, \.\d+\)$/, `${label}: PP-4: it dims with the night colour`)
  ok(/100(vh|dvh)/.test(decl(scrim, 'height') ?? ''), `${label}: PP-4: down the window`)
  eq(decl(find(land, `${M} .p2-menu__scrim[hidden]`, m900), 'display'), 'none', `${label}: PP-4: [hidden] stays hidden`)
  const sheet = find(land, `${M} .p2-menu__panel`, m520)
  eq(decl(sheet, 'left'), '12px', `${label}: PP-4: at 520px and below the panel is a sheet: the header's content width`)
  eq(decl(sheet, 'right'), '12px', `${label}: PP-4: both sides`)
  eq(decl(sheet, 'min-width'), '0', `${label}: PP-4: no 220px floor`)
  eq(land.nodes.filter(n => n.type === 'atrule').length, 2, `${label}: PP-4: two media rules`)
  // PP-5 / PP-7
  const intel = roots.intelligence
  const m851 = at(intel, '(min-width: 851px)'), m1200 = at(intel, '(min-width: 1200px)')
  ok(m851 && m1200, `${label}: PP-5/7: an 851px and a 1200px rule`)
  const insp = find(intel, '[data-intelligence-p2] .sp-p2-inspector[data-p2-polish="true"]', m851)
  eq(decl(insp, 'overflow-y'), 'auto', `${label}: PP-5: the comparison panel scrolls on its own`)
  eq(decl(insp, 'max-height'), 'calc(100dvh - 262px)', `${label}: PP-5: within the window less what sits above the panel at rest and a gap, so the button is in the window`)
  eq(decl(insp, 'overscroll-behavior'), 'contain', `${label}: PP-5: without chaining`)
  const managed = find(intel, '[data-intelligence-p2] .sp-p2-main[data-p2-polish="true"] .sp-ip-managed-grid', m1200)
  eq(decl(managed, 'grid-template-columns'), 'repeat(4, minmax(0, 1fr))', `${label}: PP-7: four columns from 1200px`)
  eq(intel.nodes.filter(n => n.type === 'atrule').length, 2, `${label}: PP-5/7: two media rules`)
  // PP-6
  const prof = roots.profile
  const U = '[data-studio-p2-profile="true"][data-studio-v4-profile="true"]'
  const line = find(prof, `${U} [data-studio-p2-usage-unavailable-line="true"]`)
  eq(decl(line, 'display'), 'grid', `${label}: PP-6: the words stack`)
  eq(decl(find(prof, `${U} [data-studio-p2-usage-unavailable-line="true"] > strong`), 'color'), 'var(--sp-text)', `${label}: PP-6: the line in the text colour`)
  eq(decl(find(prof, `${U} [data-studio-p2-usage-unavailable-line="true"] > small`), 'color') ?? 'inherit', 'inherit', `${label}: PP-6: the hint inherits the muted colour`)
  eq(decl(line, 'color'), 'var(--sp-muted)', `${label}: PP-6: muted`)
}

// ---------------------------------------------------------------- 5b. PP-8: the account menu's vertical rhythm
/** What Chromium measured on the real menu (next dev of this tree, 1x, light and dark, at 1440 and at 390 wide, a good quota read; Playwright getBoundingClientRect) with the flag off, then on.
 *  The CSS of PP-8 is added up below and must give these on-numbers. Before (flag off): rows 38 (9px padding on a 20px line), the capacity card 174 (meters 42, 10px between them, 6px label to
 *  meter, 5px meter to Resets, a 26px upgrade row), 12px either side of the card, three hairlines, the menu 640px tall. */
const RHYTHM_MEASURED = { row: 32, rowBefore: 38, upgrade: 32, meter: 37, card: 152, cardBefore: 174, gap: 8, hairlinesVisible: 1, hairlinesBefore: 3, identity: 35, menu: 540, menuBefore: 640 }
const px = value => { const m = /^(-?\d+(?:\.\d+)?)(?:px)?$/.exec(String(value).trim()); assert.ok(m && (m[0].endsWith('px') || Number(m[1]) === 0), `a px value: ${value}`); tick(); return Number(m[1]) }
const box = value => { const v = String(value).trim().split(/\s+/).map(px); return { top: v[0], right: v[1] ?? v[0], bottom: v[2] ?? v[0], left: v[3] ?? v[1] ?? v[0] } }
function proveRhythm(S, label = 'PP-8') {
  const css = S[CSS.profile]
  const at = css.indexOf('/* PP-8 vertical rhythm')
  ok(at > css.indexOf(POLISH_APPENDED[CSS.profile]), `${label}: the rhythm block is inside the appended polish block`)
  eq(css.split('/* PP-8 vertical rhythm').length - 1, 1, `${label}: and starts once`)
  const baseRules = postcss.parse(css.slice(0, css.indexOf(POLISH_APPENDED[CSS.profile]))).nodes.filter(n => n.type === 'rule')
  const rhythm = postcss.parse(css.slice(at)).nodes.filter(n => n.type === 'rule')
  const P = '[data-studio-p2-profile="true"][data-studio-v4-profile="true"]'
  const R = `${P}[data-p2-polish="true"]`
  const rule = (rules, selector) => rules.find(r => ruleKey(r) === selector)
  const declOf = (r, prop) => { let v = null; r?.walkDecls(prop, d => { v = d.value.replace(/\s+/g, ' ') }); return v }
  const pp8 = (suffix, prop) => declOf(rule(rhythm, suffix ? `${R} ${suffix}` : R), prop)
  const base = (suffix, prop) => declOf(rule(baseRules, `${P} ${suffix}`), prop)
  const eff = (suffix, prop) => pp8(suffix, prop) ?? base(suffix, prop) // PP-8's rule has the higher specificity wherever both name the property
  const ROWS = ':is([data-studio-p2-row], [data-studio-v4-profile-role="danger"])'
  const SEP = '[data-studio-v4-profile-role="separator"]'
  const DANGER = '[data-studio-v4-profile-role="danger"]'
  // every rule of the block: on the root's marker, no colour, background, border or type size of its own (the same tokens, the same text sizes), and nothing for the Appearance control
  eq(rhythm.length, 13, `${label}: thirteen rules`)
  for (const r of rhythm) {
    ok(ruleKey(r).startsWith(`${R} `) || ruleKey(r) === R, `${label}: "${ruleKey(r).slice(R.length)}" hangs on the root's marker`)
    r.walkDecls(d => ok(/^(padding|padding-top|padding-bottom|margin|margin-top|margin-bottom|min-height|line-height|display)$/.test(d.prop), `${label}: ${ruleKey(r).slice(R.length)}: ${d.prop} is geometry only`))
    nomatch(ruleKey(r), /appearance(-option)?="true"\]|appearance-option|menuitemradio/, `${label}: ${ruleKey(r).slice(R.length)} does not touch the Appearance control`)
  }
  // the root: 12px above and below (the sides stay the fidelity block's 18px)
  eq(pp8('', 'padding-top'), '12px', `${label}: 12px above the header`)
  eq(pp8('', 'padding-bottom'), '12px', `${label}: and below the last row`)
  eq(pp8('', 'padding'), null, `${label}: the sides are not touched`)
  // header
  eq(pp8('[data-studio-p2-identity="true"]', 'padding'), '0', `${label}: the header carries no padding of its own`)
  eq(pp8('[data-studio-p2-identity="true"]', 'margin-bottom'), `${RHYTHM_MEASURED.gap}px`, `${label}: and 8px under it`)
  // rows: 32px, 8px above and below a 16px line, the touch-target floor
  const rowRule = rule(rhythm, `${R} ${ROWS}`)
  ok(rowRule, `${label}: one rule for the rows and Sign out`)
  eq(declOf(rowRule, 'min-height'), '32px', `${label}: rows are at least 32px`)
  eq(declOf(rowRule, 'padding'), '8px 4px', `${label}: 8px above and below`)
  eq(declOf(rowRule, 'line-height'), '16px', `${label}: on a 16px line (the type stays 11px: the fidelity block's)`)
  const rowPad = box(declOf(rowRule, 'padding'))
  const rowHeight = Math.max(px(declOf(rowRule, 'min-height')), rowPad.top + rowPad.bottom + px(declOf(rowRule, 'line-height')))
  eq(rowHeight, RHYTHM_MEASURED.row, `${label}: a row adds up to the measured ${RHYTHM_MEASURED.row}px`)
  ok(rowHeight >= 32, `${label}: a touch target of 32px or more`)
  ok(rowHeight < RHYTHM_MEASURED.rowBefore, `${label}: and shorter than the ${RHYTHM_MEASURED.rowBefore}px it was`)
  nomatch(css.slice(at), /font-size/, `${label}: no type size is set by the block`)
  eq(/min-height:\s*36px;\s*padding:\s*9px 4px/.test(read('components/user-profile-studio-v4.css')), true, `${label}: the 36px rows it replaces are the fidelity block's (9px padding on a 20px line is ${9 + 9 + 20}px)`)
  // sections: eight apart, one hairline, and it is the one above Sign out
  const hide = rule(rhythm, `${R} ${SEP}:not(:has(+ ${DANGER}))`)
  ok(hide, `${label}: every hairline but the one before Sign out is taken out`)
  eq(declOf(hide, 'display'), 'none', `${label}: removed (and from the accessibility tree), not just made invisible`)
  eq(rhythm.filter(r => ruleKey(r).includes(SEP)).map(ruleKey).filter(k => !k.includes(':has(+ ')).length, 1, `${label}: only the separator that follows a hairline gets a gap rule`)
  eq(pp8(`${SEP} + [data-studio-p2-row]`, 'margin-top'), `${RHYTHM_MEASURED.gap}px`, `${label}: a row that follows a taken-out hairline starts 8px below the section above`)
  eq(pp8('[data-studio-p2-eyebrow="true"]', 'padding'), '8px 4px 4px', `${label}: the APPEARANCE label: 8px above (a section gap), 4px to its control`)
  eq(pp8('[data-studio-p2-appearance-block="true"]', 'padding-bottom'), '2px', `${label}: with the control's own 6px bottom margin, 8px under the control`)
  eq(box(base('[data-studio-p2-appearance="true"]', 'margin')).bottom + px(pp8('[data-studio-p2-appearance-block="true"]', 'padding-bottom')), RHYTHM_MEASURED.gap, `${label}: the control, then 8px`)
  // capacity card
  const cardPad = box(pp8('[data-studio-p2-usage="true"]', 'padding'))
  eq(pp8('[data-studio-p2-usage="true"]', 'padding'), '10px 12px', `${label}: the card's padding`)
  eq(pp8('[data-studio-p2-usage="true"]', 'margin'), '0 0 8px', `${label}: 8px under the card (the header's own 8px is above it)`)
  eq(pp8('[data-studio-p2-usage-title="true"]', 'margin-bottom'), '6px', `${label}: the card's title, 6px to the first meter`)
  eq(pp8('[data-studio-p2-usage="true"] [data-studio-p2-meter] + [data-studio-p2-meter]', 'margin-top'), `${RHYTHM_MEASURED.gap}px`, `${label}: 8px between Daily and Weekly`)
  eq(pp8('[data-studio-p2-meter-bar="true"]', 'margin'), '4px 0 2px', `${label}: 4px from the label to the meter, 2px from the meter to "Resets"`)
  const bar = box(eff('[data-studio-p2-meter-bar="true"]', 'margin'))
  eq(bar.top, 4, `${label}: label to meter`); eq(bar.bottom, 2, `${label}: meter to Resets`)
  const meter = px(eff('[data-studio-p2-meter-head="true"]', 'line-height')) + bar.top + px(base('[data-studio-p2-meter-bar="true"]', 'height')) + bar.bottom + px(base('[data-studio-p2-meter] > small', 'line-height'))
  eq(meter, RHYTHM_MEASURED.meter, `${label}: a meter adds up to the measured ${RHYTHM_MEASURED.meter}px`)
  const upPad = box(pp8('[data-studio-p2-upgrade="true"]', 'padding')), upMargin = box(pp8('[data-studio-p2-upgrade="true"]', 'margin'))
  const upgrade = Math.max(px(pp8('[data-studio-p2-upgrade="true"]', 'min-height')), upPad.top + upPad.bottom + px(base('[data-studio-p2-upgrade="true"]', 'line-height')))
  eq(upgrade, RHYTHM_MEASURED.upgrade, `${label}: the upgrade row is the measured ${RHYTHM_MEASURED.upgrade}px (a touch target)`)
  eq(pp8('[data-studio-p2-upgrade="true"]', 'padding'), '9px 4px', `${label}: the upgrade row's padding`)
  eq(pp8('[data-studio-p2-upgrade="true"]', 'margin'), '2px -4px -6px', `${label}: and its margin`)
  const border = px(String(base('[data-studio-p2-usage="true"]', 'border')).split(' ')[0])
  const card = 2 * border + cardPad.top + cardPad.bottom + px(base('[data-studio-p2-usage-title="true"]', 'line-height')) + px(pp8('[data-studio-p2-usage-title="true"]', 'margin-bottom')) + 2 * meter + RHYTHM_MEASURED.gap + upMargin.top + upgrade + upMargin.bottom
  eq(card, RHYTHM_MEASURED.card, `${label}: the capacity card adds up to the measured ${RHYTHM_MEASURED.card}px`)
  eq(pp8('[data-studio-session-usage="true"]', 'margin'), '0 0 8px', `${label}: the session usage block is 8px from what follows`)
  ok(card < RHYTHM_MEASURED.cardBefore, `${label}: the card is shorter than the ${RHYTHM_MEASURED.cardBefore}px it was`)
  // the whole menu: border, 12px, the header, 8px, the card, 8px, seven 32px rows, the label and the control, one 8px section gap, the one hairline (1px between two 4px margins)
  const menuCss = read('components/ui/dropdown-menu.tsx')
  match(menuCss, /"z-50 min-w-\[8rem\] overflow-hidden rounded-md border bg-popover p-1 /, `${label}: the menu's own border is the shadcn 1px`)
  match(menuCss, /cn\("-mx-1 my-1 h-px bg-muted", className\)/, `${label}: and its hairline is 1px between two 4px margins`)
  const root = box(`${pp8('', 'padding-top')} 0 ${pp8('', 'padding-bottom')}`)
  const label14 = px(base('[data-studio-p2-eyebrow="true"]', 'line-height'))
  const eyebrow = box(pp8('[data-studio-p2-eyebrow="true"]', 'padding')).top + label14 + box(pp8('[data-studio-p2-eyebrow="true"]', 'padding')).bottom
  const control = box(base('[data-studio-p2-appearance="true"]', 'padding')).top * 2 + px(base('[data-studio-p2-appearance="true"] [role="menuitemradio"]', 'min-height')) + box(base('[data-studio-p2-appearance="true"]', 'margin')).bottom + px(pp8('[data-studio-p2-appearance-block="true"]', 'padding-bottom'))
  const menu = 2 + root.top + root.bottom + RHYTHM_MEASURED.identity + px(pp8('[data-studio-p2-identity="true"]', 'margin-bottom')) + card + box(pp8('[data-studio-p2-usage="true"]', 'margin')).bottom + 7 * rowHeight + eyebrow + control + px(pp8(`${SEP} + [data-studio-p2-row]`, 'margin-top')) + (1 + 4 + 4)
  eq(menu, RHYTHM_MEASURED.menu, `${label}: the whole menu adds up to the measured ${RHYTHM_MEASURED.menu}px (it was ${RHYTHM_MEASURED.menuBefore}px)`)
  // the Appearance control is exactly as it was: its own rules are pinned (they are the base's, which section 2 holds byte for byte)
  const ctl = '[data-studio-p2-appearance="true"]'
  for (const [suffix, prop, want] of [
    [ctl, 'display', 'grid'], [ctl, 'grid-template-columns', 'repeat(3, minmax(0, 1fr))'], [ctl, 'gap', '2px'], [ctl, 'margin', '0 0 6px'], [ctl, 'padding', '3px'], [ctl, 'border-radius', '9px'],
    [`${ctl} [role="menuitemradio"]`, 'min-height', '30px'], [`${ctl} [role="menuitemradio"]`, 'padding', '5px 4px'], [`${ctl} [role="menuitemradio"]`, 'border-radius', '7px'],
    [`${ctl} [role="menuitemradio"]`, 'font-size', '11px'], [`${ctl} [role="menuitemradio"]`, 'line-height', '16px'], [`${ctl} [role="menuitemradio"]`, 'gap', '6px'],
  ]) eq(base(suffix, prop), want, `${label}: the Appearance control keeps ${prop} ${want}`)
  eq(rhythm.filter(r => /appearance/.test(ruleKey(r).replace('[data-studio-p2-appearance-block="true"]', ''))).length, 0, `${label}: and no rhythm rule names it`)
  // the root carries the marker only with the flag on; flag off the menu root is the base's
  const polishOn = loadProfile(S[PROFILE], envFor(ON), S[LIB])
  eq(polishOn({ ...account }).props['data-p2-polish'], 'true', `${label}: on, the menu root carries the marker`)
  eq(polishOn({ ...account }).props['data-studio-p2-profile'], 'true', `${label}: and is still the Pass 2 menu`)
  for (const value of FLAG_COMBOS) eq(loadProfile(S[PROFILE], envFor(value), S[LIB])({ ...account }).props['data-p2-polish'], undefined, `${label}: polish ${JSON.stringify(value)}: the menu root has no marker`)
  eq((S[PROFILE].match(/STUDIO_P2_POLISH_ATTR/g) ?? []).length, 3, `${label}: the profile body names the marker three times (import, the root, the unavailable card)`)
  match(S[PROFILE], /<DropdownMenuContent data-studio-v4-profile="true" data-studio-profile-fidelity="true" data-studio-p2-profile="true" \{\.\.\.\(STUDIO_P2_POLISH_ENABLED \? \{ \[STUDIO_P2_POLISH_ATTR\]: "true" \} : \{\}\)\} side="right"/, `${label}: the root's marker follows the flag`)
}

// ---------------------------------------------------------------- 6. env + package
function proveEnv(S, label = 'env') {
  const env = S[ENV]
  eq(env.split(`${FLAG}=`).length - 1, 1, `${label}: the flag is documented once`)
  match(env, new RegExp(`\\n${FLAG}="false"\\n(?:$|\\n)`), `${label}: default off, the last line of its own block (a later change's block may follow)`)
  const block = env.slice(env.indexOf('# PASS2 POLISH PP-1..PP-8'), env.indexOf(`${FLAG}=`) + FLAG.length + '="false"'.length)
  for (const id of ['PP-1/2/3', 'PP-4', 'PP-5/PP-7', 'PP-6', 'PP-8']) ok(block.includes(id), `${label}: the block says what ${id} does`)
  for (const page of ['NEXT_PUBLIC_STUDIO_P2_PUBLISH', 'NEXT_PUBLIC_STUDIO_P2_LANDING', 'NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE', 'NEXT_PUBLIC_STUDIO_P2_PROFILE_MENU']) ok(block.includes(page), `${label}: the block names ${page}`)
  match(block, /READ AT BUILD TIME/, `${label}: and says it is read at build time`)
  eq(JSON.parse(S[PKG]).scripts['test:studio-p2-polish'], 'node scripts/test-studio-p2-polish.mjs', `${label}: the package script`)
}

// ---------------------------------------------------------------- 7. the run
function proveAll(S, { identity = true } = {}) {
  proveLib(S)
  if (identity) proveStrip(S)
  proveProfile(S)
  proveMenu(S)
  provePublish(S)
  proveCss(S)
  proveRhythm(S)
  proveEnv(S)
}

counting = true
proveAll(SOURCES)
// the intelligence chooser: the marker is on the two nodes the stylesheet names, only with the flag (the page mounts the chooser only with NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE, unchanged)
function proveChooser(S, label = 'chooser') {
  match(S[CHOOSER], /<div className="sp-p2-main" \{\.\.\.\(STUDIO_P2_POLISH_ENABLED \? \{ \[STUDIO_P2_POLISH_ATTR\]: "true" \} : \{\}\)\}>/, `${label}: PP-7: the main column carries the marker with the flag`)
  match(S[CHOOSER], /<aside className="sp-model-inspector sp-p2-inspector" aria-labelledby="sp-comparison-heading" data-p2-inspector=\{activeTask\} \{\.\.\.\(STUDIO_P2_POLISH_ENABLED \? \{ \[STUDIO_P2_POLISH_ATTR\]: "true" \} : \{\}\)\}>/, `${label}: PP-5: the comparison panel carries it`)
  eq((S[CHOOSER].match(/STUDIO_P2_POLISH_ATTR\]/g) ?? []).length, 2, `${label}: exactly those two`)
  match(S[CHOOSER], /import \{ STUDIO_P2_POLISH_ATTR, STUDIO_P2_POLISH_ENABLED \} from "@\/lib\/studio-p2-polish"/, `${label}: imports the flag and the marker name only`)
  const page = read('app/(app)/studio/intelligence/page.tsx')
  match(page, /process\.env\.NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE === "true" \? <IntelligenceChooser \/> : undefined/, `${label}: the page mounts the chooser only with NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE`)
  ok(page === baseSource('app/(app)/studio/intelligence/page.tsx') && read('components/studio-personal/intelligence-workspace.tsx') === baseSource('components/studio-personal/intelligence-workspace.tsx'), `${label}: and the page and the workspace are the base's, byte for byte`)
}
proveChooser(SOURCES)
const mainChecks = checks

// ---------------------------------------------------------------- 8. mutants: every one must be killed with the identity checks off
const MUTANTS = [
  // the lib
  [LIB, 'flag read loosely', "process.env.NEXT_PUBLIC_STUDIO_P2_POLISH === 'true'", "process.env.NEXT_PUBLIC_STUDIO_P2_POLISH !== 'false'"],
  [LIB, 'flag truthy', "process.env.NEXT_PUBLIC_STUDIO_P2_POLISH === 'true'", 'Boolean(process.env.NEXT_PUBLIC_STUDIO_P2_POLISH)'],
  [LIB, 'a tier label is wrong', "premium: 'Max'", "premium: 'Premium'"],
  [LIB, 'the session tier is not looked up safely', 'Object.prototype.hasOwnProperty.call(POLISH_TIER_LABELS, sessionTier)', 'sessionTier in POLISH_TIER_LABELS'],
  [LIB, 'the quota label does not win', "if (typeof quotaLabel === 'string' && quotaLabel.trim() !== '') return quotaLabel", ''],
  [LIB, 'a blank quota label wins', "typeof quotaLabel === 'string' && quotaLabel.trim() !== ''", "typeof quotaLabel === 'string'"],
  [LIB, 'a failed read is pending', "return input.hasQuota || input.failed ? 'unavailable' : 'pending'", "return input.hasQuota ? 'unavailable' : 'pending'"],
  [LIB, 'a read with no shares is pending', "return input.hasQuota || input.failed ? 'unavailable' : 'pending'", "return input.failed ? 'unavailable' : 'pending'"],
  [LIB, 'meters do not win', "if (input.meters > 0) return 'meters'", ''],
  [LIB, 'the unavailable words change', "line: 'Usage unavailable'", "line: 'Unavailable'"],
  // PP-1
  [WIZARD, 'PP-1 the wizard marker is always on', "{...(STUDIO_P2_POLISH ? { [STUDIO_P2_POLISH_ATTR]: 'true' } : {})}", "{...({ [STUDIO_P2_POLISH_ATTR]: 'true' })}"],
  [WIZARD, 'PP-1 the wizard gate ignores the page flag', 'const STUDIO_P2_POLISH = STUDIO_P2_PUBLISH && STUDIO_P2_POLISH_ENABLED', 'const STUDIO_P2_POLISH = STUDIO_P2_POLISH_ENABLED'],
  [WIZARD, 'PP-1 the wizard gate is an OR', 'const STUDIO_P2_POLISH = STUDIO_P2_PUBLISH && STUDIO_P2_POLISH_ENABLED', 'const STUDIO_P2_POLISH = STUDIO_P2_PUBLISH || STUDIO_P2_POLISH_ENABLED'],
  [WIZARD, 'PP-1 the panes keep their scroll position between steps', 'if (STUDIO_P2_POLISH && stepBody.parentElement) for (const pane of [stepBody.parentElement, ...Array.from(stepBody.parentElement.children)]) (pane as HTMLElement).scrollTop = 0', ''],
  [CSS.publish, 'PP-1 the body keeps scrolling under the footer', '.studio-publish-body:has(> .studio-publish-wizard[data-p2-polish="true"]) { display: flex; flex-direction: column; overflow: hidden; }', '.studio-publish-body:has(> .studio-publish-wizard[data-p2-polish="true"]) { display: flex; flex-direction: column; overflow: auto; }'],
  [CSS.publish, 'PP-1 the footer still overlays', '> :is(.studio-publish-steps, .studio-publish-wizard-actions) { position: static; flex-shrink: 0; }', '> :is(.studio-publish-steps, .studio-publish-wizard-actions) { position: sticky; flex-shrink: 0; }'],
  [CSS.publish, 'PP-1 the panes do not scroll', 'min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--sp-line) transparent; }\n[data-studio-publish="true"] .studio-publish-wizard[data-p2-polish="true"] > .studio-publish-setup-grid > .studio-publish-viewer-summary', 'min-height: 0; overflow-y: visible; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--sp-line) transparent; }\n[data-studio-publish="true"] .studio-publish-wizard[data-p2-polish="true"] > .studio-publish-setup-grid > .studio-publish-viewer-summary'],
  [CSS.publish, 'PP-1 the panel is squeezed again', 'align-content: start; grid-auto-rows: max-content; }', 'align-content: start; }'],
  [CSS.publish, 'PP-1 the step pane clips the focus ring', '.studio-publish-step-body { padding: 4px; margin: -4px; }', '.studio-publish-step-body { padding: 0; margin: 0; }'],
  [CSS.publish, 'PP-1 the phone panes are shrinkable again', 'overflow: visible; min-height: auto; }', 'overflow: visible; min-height: 0; }'],
  [CSS.publish, 'PP-1 a rule leaks to the flag-off wizard', '[data-studio-publish="true"] .studio-publish-wizard[data-p2-polish="true"] { display: flex;', '[data-studio-publish="true"] .studio-publish-wizard { display: flex;'],
  // PP-2
  [CSS.publish, 'PP-2 the link is violet', 'background: var(--ss-action, var(--sp-primary)); color: var(--ss-on-action, var(--sp-primary-text)); }', 'background: var(--sp-accent); color: var(--ss-on-action, var(--sp-primary-text)); }'],
  [CSS.publish, 'PP-2 the link text is unreadable', 'color: var(--ss-on-action, var(--sp-primary-text)); }\n[data-studio-publish="true"] a.studio-publish-view-as-viewer[data-p2-polish="true"]:hover', 'color: var(--sp-primary); }\n[data-studio-publish="true"] a.studio-publish-view-as-viewer[data-p2-polish="true"]:hover'],
  [P2PUB, 'PP-2 the anchor never carries the marker', "{...(STUDIO_P2_POLISH ? { [STUDIO_P2_POLISH_ATTR]: 'true' } : {})}>\n        <a href", '>\n        <a href'],
  [P2PUB, 'PP-2 the anchor marker ignores the flag', "{...(STUDIO_P2_POLISH ? { [STUDIO_P2_POLISH_ATTR]: 'true' } : {})}>\n        <a href", "{...({ [STUDIO_P2_POLISH_ATTR]: 'true' })}>\n        <a href"],
  // PP-3
  [P2PUB, 'PP-3 the dock is always on', 'if (!STUDIO_P2_POLISH) return <>{children}</>', 'if (false) return <>{children}</>'],
  [P2PUB, 'PP-3 the dock ignores the page flag', 'const STUDIO_P2_POLISH = STUDIO_P2_PUBLISH_ENABLED && STUDIO_P2_POLISH_ENABLED', 'const STUDIO_P2_POLISH = STUDIO_P2_POLISH_ENABLED'],
  [P2PUB, 'PP-3 there is no Done button', '<Button type="button" size="sm" onClick={onDone}>Done</Button>', ''],
  [P2PUB, 'PP-3 Done does nothing', 'onClick={onDone}>Done', 'onClick={() => {}}>Done'],
  [P2PUB, 'PP-3 Done is called twice', 'onClick={onDone}>Done', 'onClick={() => { onDone(); onDone() }}>Done'],
  [P2PUB, 'PP-3 the Done button says something else', '>Done</Button>', '>Close</Button>'],
  [DIALOG, 'PP-3 the dialog hands the dock a no-op', '<PublishManageDock onDone={() => onOpenChange(false)}>', '<PublishManageDock onDone={() => {}}>'],
  [CSS.publish, 'PP-3 the dock does not stick', '.studio-publish-dock[data-p2-polish="true"] { position: sticky;', '.studio-publish-dock[data-p2-polish="true"] { position: relative;'],
  [CSS.publish, 'PP-3 Done at the left', 'display: flex; justify-content: flex-end; padding-top: 12px;', 'display: flex; justify-content: flex-start; padding-top: 12px;'],
  // PP-4
  [MENU, 'PP-4 the scrim is always shown', 'hidden={!open} onClick={() => send("outside")}', 'hidden={false} onClick={() => send("outside")}'],
  [MENU, 'PP-4 the scrim does not close', 'hidden={!open} onClick={() => send("outside")}', 'hidden={!open}'],
  [MENU, 'PP-4 the scrim closes like Escape (and pulls the focus)', 'onClick={() => send("outside")} />}', 'onClick={() => send("escape")} />}'],
  [MENU, 'PP-4 the scrim is always rendered', '{STUDIO_P2_POLISH_ENABLED && <span className="p2-menu__scrim"', '{true && <span className="p2-menu__scrim"'],
  [MENU, 'PP-4 the wrapper marker is always on', '{...(STUDIO_P2_POLISH_ENABLED ? { [STUDIO_P2_POLISH_ATTR]: "true" } : {})}', '{...({ [STUDIO_P2_POLISH_ATTR]: "true" })}'],
  [CSS.landing, 'PP-4 the sheet keeps a left edge of the dropdown', '.p2-menu__panel { left: 12px; right: 12px; min-width: 0; }', '.p2-menu__panel { right: 12px; min-width: 0; }'],
  [CSS.landing, 'PP-4 the scrim is below the header', '.p2-menu__scrim { position: absolute; top: 100%;', '.p2-menu__scrim { position: absolute; top: 0;'],
  [CSS.landing, 'PP-4 the wrapper stays the anchor', '[data-p2-polish="true"] { position: static; }', '[data-p2-polish="true"] { position: relative; }'],
  [CSS.landing, 'PP-4 a hidden scrim shows', '.p2-menu__scrim[hidden] { display: none; }', '.p2-menu__scrim[hidden] { display: block; }'],
  // PP-5
  [CHOOSER, 'PP-5 the inspector marker is always on', '{...(STUDIO_P2_POLISH_ENABLED ? { [STUDIO_P2_POLISH_ATTR]: "true" } : {})}>\n        <div className="sp-inspector-top">', '{...({ [STUDIO_P2_POLISH_ATTR]: "true" })}>\n        <div className="sp-inspector-top">'],
  [CSS.intelligence, 'PP-5 the panel does not scroll', 'max-height: calc(100dvh - 262px); overflow-y: auto;', 'max-height: calc(100dvh - 104px); overflow-y: visible;'],
  [CSS.intelligence, 'PP-5 the panel has no cap', 'max-height: calc(100dvh - 262px); overflow-y: auto;', 'overflow-y: auto;'],
  [CSS.intelligence, 'PP-5 the panel rule leaks to the flag-off page', '[data-intelligence-p2] .sp-p2-inspector[data-p2-polish="true"] { max-height', '[data-intelligence-p2] .sp-p2-inspector { max-height'],
  // PP-6
  [PROFILE, 'PP-6 the badge waits for the read', 'const badgeLabel = STUDIO_P2_POLISH_ENABLED ? polishTierLabel(tierLabel, sessionTier) : tierLabel', 'const badgeLabel = tierLabel'],
  [PROFILE, 'PP-6 the badge changes with the flag off', 'const badgeLabel = STUDIO_P2_POLISH_ENABLED ? polishTierLabel(tierLabel, sessionTier) : tierLabel', 'const badgeLabel = polishTierLabel(tierLabel, sessionTier)'],
  [PROFILE, 'PP-6 a failed read still shows nothing', 'if (STUDIO_P2_POLISH_ENABLED && polishUsageState({ meters: meters.length, hasQuota: Boolean(quota), failed: Boolean(failed) }) === "unavailable") {', 'if (false) {'],
  [PROFILE, 'PP-6 the unavailable card ignores the flag', 'if (STUDIO_P2_POLISH_ENABLED && polishUsageState(', 'if (polishUsageState('],
  [PROFILE, 'PP-6 the failed read is not passed on', 'usageCard(quota, onNavigate, quotaFailed)', 'usageCard(quota, onNavigate)'],
  [PROFILE, 'PP-6 meters are replaced by the unavailable card', '=== "unavailable") {', '!== "pending") {'],
  [PROFILE, 'PP-6 the unavailable card has no marker', '<div data-studio-p2-usage="true" data-studio-p2-usage-unavailable="true" {...{ [STUDIO_P2_POLISH_ATTR]: "true" }} role="group"', '<div data-studio-p2-usage="true" data-studio-p2-usage-unavailable="true" role="group"'],
  [PROFILE, 'PP-6 the unavailable line is not announced', '<p data-studio-p2-usage-unavailable-line="true" role="status">', '<p data-studio-p2-usage-unavailable-line="true">'],
  [PARENT, 'PP-6 an error status is not recorded', '} else if (STUDIO_P2_POLISH_ENABLED) setQuotaFailed(true)', '}'],
  [PARENT, 'PP-6 a throw is not recorded', "// Non-fatal — dropdown still works without bars\n      if (STUDIO_P2_POLISH_ENABLED) setQuotaFailed(true)", '// Non-fatal — dropdown still works without bars'],
  [PARENT, 'PP-6 a recorded failure is never cleared', 'if (STUDIO_P2_POLISH_ENABLED) setQuotaFailed(false)', ''],
  [PARENT, 'PP-6 the failure is recorded with the flag off', '} else if (STUDIO_P2_POLISH_ENABLED) setQuotaFailed(true)', '} else setQuotaFailed(true)'],
  [PARENT, 'PP-6 the session tier is not passed', ' sessionTier={user.tier}', ''],
  [CSS.profile, 'PP-6 the unavailable words are not muted', '[data-studio-p2-usage-unavailable-line="true"] { display: grid; gap: 2px; margin: 0; font-size: 10px; line-height: 14px; color: var(--sp-muted); }', '[data-studio-p2-usage-unavailable-line="true"] { display: grid; gap: 2px; margin: 0; font-size: 10px; line-height: 14px; }'],
  // PP-7
  [CSS.intelligence, 'PP-7 two columns', 'grid-template-columns: repeat(4, minmax(0, 1fr))', 'grid-template-columns: repeat(2, minmax(0, 1fr))'],
  [CSS.intelligence, 'PP-7 four columns from 900px', '@media (min-width: 1200px) {\n  [data-intelligence-p2] .sp-p2-main', '@media (min-width: 900px) {\n  [data-intelligence-p2] .sp-p2-main'],
  [CSS.intelligence, 'PP-7 four columns everywhere (the rule leaks)', '[data-intelligence-p2] .sp-p2-main[data-p2-polish="true"] .sp-ip-managed-grid', '[data-intelligence-p2] .sp-p2-main .sp-ip-managed-grid'],
  [CHOOSER, 'PP-7 the main column marker is always on', '<div className="sp-p2-main" {...(STUDIO_P2_POLISH_ENABLED ? { [STUDIO_P2_POLISH_ATTR]: "true" } : {})}>', '<div className="sp-p2-main" {...({ [STUDIO_P2_POLISH_ATTR]: "true" })}>'],
  // PP-8
  [CSS.profile, 'PP-8 rows are 36px again', 'min-height: 32px; padding: 8px 4px; line-height: 16px; }', 'min-height: 36px; padding: 8px 4px; line-height: 16px; }'],
  [CSS.profile, 'PP-8 rows fall under the touch floor', 'min-height: 32px; padding: 8px 4px; line-height: 16px; }', 'min-height: 28px; padding: 6px 4px; line-height: 16px; }'],
  [CSS.profile, 'PP-8 rows keep 9px of padding', 'min-height: 32px; padding: 8px 4px; line-height: 16px; }', 'min-height: 32px; padding: 9px 4px; line-height: 16px; }'],
  [CSS.profile, 'PP-8 rows keep the 20px line', 'padding: 8px 4px; line-height: 16px; }', 'padding: 8px 4px; line-height: 20px; }'],
  [CSS.profile, 'PP-8 rows set a type size', 'padding: 8px 4px; line-height: 16px; }', 'padding: 8px 4px; line-height: 16px; font-size: 14px; }'],
  [CSS.profile, 'PP-8 every hairline stays', '[data-studio-v4-profile-role="separator"]:not(:has(+ [data-studio-v4-profile-role="danger"])) { display: none; }', '[data-studio-v4-profile-role="separator"]:not(:has(+ [data-studio-v4-profile-role="danger"])) { display: block; }'],
  [CSS.profile, 'PP-8 every hairline goes, the one above Sign out too', '[data-studio-v4-profile-role="separator"]:not(:has(+ [data-studio-v4-profile-role="danger"])) { display: none; }', '[data-studio-v4-profile-role="separator"] { display: none; }'],
  [CSS.profile, 'PP-8 the gap after a taken-out hairline is 12px', '[data-studio-v4-profile-role="separator"] + [data-studio-p2-row] { margin-top: 8px; }', '[data-studio-v4-profile-role="separator"] + [data-studio-p2-row] { margin-top: 12px; }'],
  [CSS.profile, 'PP-8 no gap after a taken-out hairline', '[data-studio-v4-profile-role="separator"] + [data-studio-p2-row] { margin-top: 8px; }', '[data-studio-v4-profile-role="separator"] + [data-studio-p2-row] { margin-top: 0; }'],
  [CSS.profile, 'PP-8 the APPEARANCE label is as loose as before', '[data-p2-polish="true"] [data-studio-p2-eyebrow="true"] { padding: 8px 4px 4px; }', '[data-p2-polish="true"] [data-studio-p2-eyebrow="true"] { padding: 12px 4px 6px; }'],
  [CSS.profile, 'PP-8 the APPEARANCE label sets a colour', '[data-p2-polish="true"] [data-studio-p2-eyebrow="true"] { padding: 8px 4px 4px; }', '[data-p2-polish="true"] [data-studio-p2-eyebrow="true"] { padding: 8px 4px 4px; color: var(--sp-text); }'],
  [CSS.profile, 'PP-8 the APPEARANCE label leaks to the flag-off menu', '[data-p2-polish="true"] [data-studio-p2-eyebrow="true"] { padding: 8px 4px 4px; }', '[data-studio-p2-eyebrow="true"] { padding: 8px 4px 4px; }'],
  [CSS.profile, 'PP-8 nothing under the Appearance control', '[data-studio-p2-appearance-block="true"] { padding-bottom: 2px; }', '[data-studio-p2-appearance-block="true"] { padding-bottom: 0; }'],
  [CSS.profile, 'PP-8 the Appearance control gets a rule of its own', '[data-studio-p2-appearance-block="true"] { padding-bottom: 2px; }', '[data-studio-p2-appearance="true"] { margin-bottom: 8px; }'],
  [CSS.profile, 'PP-8 the Appearance options are 32px', '[data-studio-p2-appearance="true"] [role="menuitemradio"] { min-height: 30px;', '[data-studio-p2-appearance="true"] [role="menuitemradio"] { min-height: 32px;'],
  [CSS.profile, 'PP-8 the Appearance control is padded 4px', 'gap: 2px; margin: 0 0 6px; padding: 3px;', 'gap: 2px; margin: 0 0 6px; padding: 4px;'],
  [CSS.profile, 'PP-8 the capacity card keeps 12px of padding', '[data-studio-p2-usage="true"] { margin: 0 0 8px; padding: 10px 12px; }', '[data-studio-p2-usage="true"] { margin: 0 0 8px; padding: 12px; }'],
  [CSS.profile, 'PP-8 the capacity card keeps its 12px margins', '[data-studio-p2-usage="true"] { margin: 0 0 8px; padding: 10px 12px; }', '[data-studio-p2-usage="true"] { margin: 12px 0; padding: 10px 12px; }'],
  [CSS.profile, 'PP-8 the capacity card title keeps its 10px', '[data-p2-polish="true"] [data-studio-p2-usage-title="true"] { margin-bottom: 6px; }', '[data-p2-polish="true"] [data-studio-p2-usage-title="true"] { margin-bottom: 10px; }'],
  [CSS.profile, 'PP-8 Daily and Weekly are 10px apart', '[data-studio-p2-meter] + [data-studio-p2-meter] { margin-top: 8px; }', '[data-studio-p2-meter] + [data-studio-p2-meter] { margin-top: 10px; }'],
  [CSS.profile, 'PP-8 the meter is 6px from its label and 5px from Resets', '[data-studio-p2-meter-bar="true"] { margin: 4px 0 2px; }', '[data-studio-p2-meter-bar="true"] { margin: 6px 0 5px; }'],
  [CSS.profile, 'PP-8 the meter is flush with Resets', '[data-studio-p2-meter-bar="true"] { margin: 4px 0 2px; }', '[data-studio-p2-meter-bar="true"] { margin: 4px 0 0; }'],
  [CSS.profile, 'PP-8 the upgrade row falls under the touch floor', '{ min-height: 32px; margin: 2px -4px -6px; padding: 9px 4px; }', '{ min-height: 0; margin: 2px -4px -6px; padding: 6px 4px; }'],
  [CSS.profile, 'PP-8 the upgrade row is 10px from Resets', '{ min-height: 32px; margin: 2px -4px -6px; padding: 9px 4px; }', '{ min-height: 32px; margin: 10px -4px -6px; padding: 9px 4px; }'],
  [CSS.profile, 'PP-8 the session usage block keeps its 12px margins', '[data-studio-session-usage="true"] { margin: 0 0 8px; }', '[data-studio-session-usage="true"] { margin: 12px 0; }'],
  [CSS.profile, 'PP-8 the menu keeps its 18px top and bottom', '[data-p2-polish="true"] { padding-top: 12px; padding-bottom: 12px; }', '[data-p2-polish="true"] { padding-top: 18px; padding-bottom: 18px; }'],
  [CSS.profile, 'PP-8 the menu padding takes the sides too', '[data-p2-polish="true"] { padding-top: 12px; padding-bottom: 12px; }', '[data-p2-polish="true"] { padding: 12px; }'],
  [CSS.profile, 'PP-8 the header keeps its 6px of padding', '[data-studio-p2-identity="true"] { margin-bottom: 8px; padding: 0; }', '[data-studio-p2-identity="true"] { margin-bottom: 8px; padding: 0 0 6px; }'],
  [CSS.profile, 'PP-8 the header is 12px from what follows', '[data-studio-p2-identity="true"] { margin-bottom: 8px; padding: 0; }', '[data-studio-p2-identity="true"] { margin-bottom: 12px; padding: 0; }'],
  [PROFILE, 'PP-8 the menu root carries the marker with the flag off', '{...(STUDIO_P2_POLISH_ENABLED ? { [STUDIO_P2_POLISH_ATTR]: "true" } : {})} side="right"', '{...({ [STUDIO_P2_POLISH_ATTR]: "true" })} side="right"'],
  [PROFILE, 'PP-8 the menu root never carries the marker', '{...(STUDIO_P2_POLISH_ENABLED ? { [STUDIO_P2_POLISH_ATTR]: "true" } : {})} side="right"', 'side="right"'],
  // the env block and the package script
  [ENV, 'the flag defaults on', `${FLAG}="false"`, `${FLAG}="true"`],
  [PKG, 'no package script', '"test:studio-p2-polish": "node scripts/test-studio-p2-polish.mjs"', '"test:studio-p2-polish-x": "node scripts/test-studio-p2-polish.mjs"'],
]

function mutate(rel, from, to) {
  const S = { ...SOURCES }
  const at = S[rel].indexOf(from)
  assert.ok(at !== -1, `a mutant's target is in ${rel}: ${JSON.stringify(from.slice(0, 80))}`)
  assert.equal(S[rel].indexOf(from, at + 1), -1, `a mutant's target is one place in ${rel}: ${JSON.stringify(from.slice(0, 80))}`)
  S[rel] = S[rel].slice(0, at) + to + S[rel].slice(at + from.length)
  return S
}
function killedBy(S) {
  const saved = counting
  counting = false
  try { proveAll(S, { identity: false }); proveChooser(S); return null } catch (error) { return String(error?.message ?? error).split('\n')[0].slice(0, 160) } finally { counting = saved }
}
let killed = 0
const survivors = []
if (process.env.P2_NO_MUTANTS === '1') console.log('mutants skipped (P2_NO_MUTANTS=1)')
else {
  for (const [rel, name, from, to] of MUTANTS) {
    const reason = killedBy(mutate(rel, from, to))
    if (reason === null) survivors.push(`${name} (${rel})`); else killed++
  }
  // control: the unmutated sources pass the same reduced checks, so a kill above is a mutant's own doing
  eq(killedBy(SOURCES), null, 'control: the unmutated sources pass the checks the mutants ran against')
  const perGap = ['PP-1', 'PP-2', 'PP-3', 'PP-4', 'PP-5', 'PP-6', 'PP-7', 'PP-8']
  for (const gap of perGap) ok(MUTANTS.some(([, name]) => name.startsWith(gap)), `every gap has a mutant: ${gap}`)
  assert.deepEqual(survivors, [], `mutants that survived: ${survivors.join('; ')}`)
  assert.equal(killed, MUTANTS.length)
}
console.log(`${checks} checks (${mainChecks} on the real sources), ${process.env.P2_NO_MUTANTS === '1' ? 'no mutants run' : `${killed}/${MUTANTS.length} mutants killed`}`)
