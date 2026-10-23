// PASS2 ADMIN USERS + COUPONS (FRONTEND-1): /admin/users and /admin/coupons in the Studio shell's look, with what was broken on them fixed. Flag NEXT_PUBLIC_STUDIO_P2_ADMIN (exact "true"), default off.
//
// Run: node scripts/test-studio-p2-admin.mjs   (plain node: transpile + vm, no network, no browser, no env)
//   P2_ADMIN_BASE=<commit> overrides the base commit the flag-off identity and the old pages' own code are read from (default fae9620, the studio-v4-dev-preparation-code tip this stack sits on (#468's admin email guard and #460 #464 #465 #469 included)).
//
// Proven on the REAL sources:
//   1. lib/studio-p2-admin.ts: import-free; the routes, requests, bodies, filter, counts, totals and tier names are the OLD pages' own (their code is read from the base commit and executed, not retyped);
//      what a failed read or a failed action means; the words;
//   2. the two pages, executed with a hook stub, a stubbed session / router / fetch / clipboard: every state (loading, signed out, 403, 401, failed, ready, empty), every action, and the same requests the
//      old pages send for the same clicks (both are run and their fetch logs compared);
//   3. the wiring: flag off = the old page through its layout untouched (page.tsx, the admin routes and the middleware are the base commit's bytes), flag on = the new page;
//   4. the CSS: scoped to the page's own marker, tokens only, equal to the Studio shell's palette (light and dark), WCAG AA contrast of every text pair, every class used has a rule, the phone rules;
//   5. env + package registration;
//   6. mutation check: every mutant of the sources is killed by sections 1-5.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import postcss from 'postcss'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const requireFromRepo = createRequire(path.join(repoRoot, 'package.json'))
const { format: dateFnsFormat } = requireFromRepo('date-fns')
const BASE_COMMIT = process.env.P2_ADMIN_BASE || 'fae962006b080e26eb70c2add7066ca1edf8eca2'
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

// a promise nobody waits for that rejects is a defect of the page (a mutant may cause one; the real run must not)
let unhandledRejections = 0
process.on('unhandledRejection', () => { unhandledRejections++ })
const LIB = 'lib/studio-p2-admin.ts'
const UI = 'components/admin/studio-p2-admin.tsx'
const CSS = 'components/admin/studio-p2-admin.css'
const LAYOUT_USERS = 'app/admin/users/layout.tsx'
const LAYOUT_COUPONS = 'app/admin/coupons/layout.tsx'
const PAGE_USERS = 'app/admin/users/page.tsx'
const PAGE_COUPONS = 'app/admin/coupons/page.tsx'
const ENV = '.env.example'
const PKG = 'package.json'
const SHELL_CSS = 'components/layout/studio-shell.css'
const PROFILE_CSS = 'components/user-profile-studio-v4.css'
const SOURCES = Object.fromEntries([LIB, UI, CSS, LAYOUT_USERS, LAYOUT_COUPONS, ENV, PKG].map(rel => [rel, read(rel)]))
const FLAG = 'NEXT_PUBLIC_STUDIO_P2_ADMIN'
const NOW = Date.UTC(2026, 9, 22, 12, 0, 0)

// ---------------------------------------------------------------- loading
const jsx = (type, props, key) => ({ type, props: props ?? {}, ...(key === undefined ? {} : { key }) })
const JSX_RUNTIME = { jsx, jsxs: jsx, Fragment: 'Fragment' }
const names = new Proxy({}, { get: (_target, key) => key })
// a component defined in the file (a function) is drawn by calling it: the pieces are pure, only the page components own state
const expand = value => Array.isArray(value) ? value.map(expand) : value && typeof value === 'object' && 'props' in value ? (typeof value.type === 'function' ? expand(value.type(value.props)) : { ...value, props: { ...value.props, children: expand(value.props.children) } }) : value
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
class FixedDate extends Date { static now() { return NOW } }
function load(source, fileName, { deps = {}, env = {}, globals = {} } = {}) {
  const module = { exports: {} }
  vm.runInNewContext(compile(source, fileName), { module, exports: module.exports, process: { env }, Object, JSON, Array, String, Boolean, Math, Number, Promise, Date: FixedDate, Error, TypeError, DOMException, ...globals, require: name => {
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
  const self = {
    dirty: false, // a state setter ran since the last render: effects that set state need one more render to show it
    reset() { cursor = 0 },
    flushEffects() { while (effects.length) { const [i, fn] = effects.shift(); if (typeof slots[i].cleanup === 'function') slots[i].cleanup(); slots[i].cleanup = fn() } },
    unmount() { for (const slot of slots) if (slot && typeof slot.cleanup === 'function') slot.cleanup() },
    api: {
      useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; self.dirty = true }] },
      useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
      useId() { const i = cursor++; return slots[i] ||= `:r${i}:` },
      useEffect(fn, deps) { const i = cursor++, previous = slots[i]; if (!previous || !deps || deps.some((x, index) => x !== previous.deps[index])) { slots[i] = { deps, cleanup: previous?.cleanup }; effects.push([i, fn]) } },
    },
  }
  return self
}
// the code without its comments (a comment may say what the code never does)
const codeOf = (source, fileName) => ts.transpileModule(source, { fileName, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, removeComments: true } }).outputText
const attempt = fn => { try { return fn() } catch (error) { return { threw: String(error) } } } // a mutant that crashes must fail an assertion, not the run
const tick = async (times = 40) => { for (let i = 0; i < times; i++) await Promise.resolve() }
const evalCode = (code, scope = {}) => vm.runInNewContext(ts.transpileModule(`(${code})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText.trim().replace(/;$/, ''), vm.createContext({ ...scope }))

// ---------------------------------------------------------------- what the OLD pages do (read from the base commit and executed)
function legacy() {
  const users = baseSource(PAGE_USERS), coupons = baseSource(PAGE_COUPONS)
  const file = ts.createSourceFile('users.tsx', users, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let filterBody = null
  ts.forEachChild(file, function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(file) === 'useEffect' && node.arguments[0]?.body?.getText(file).includes('setFilteredUsers')) filterBody = node.arguments[0].body
    ts.forEachChild(node, visit)
  })
  assert.ok(filterBody, 'the old users page filters in an effect')
  const statements = filterBody.statements.filter(s => !s.getText(file).startsWith('setFilteredUsers')).map(s => s.getText(file)).join('\n')
  const filter = evalCode(`(users, filter, searchQuery) => { ${statements}\n return filtered }`)
  const cfile = ts.createSourceFile('coupons.tsx', coupons, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let createBody = null
  ts.forEachChild(cfile, function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(cfile) === 'JSON.stringify' && ts.isObjectLiteralExpression(node.arguments[0] ?? {}) && node.arguments[0].getText(cfile).includes('valueCents')) createBody = node.arguments[0].getText(cfile)
    ts.forEachChild(node, visit)
  })
  assert.ok(createBody, 'the old coupons page builds the create body')
  const line = (source, name) => { const m = source.match(new RegExp(`const ${name} = (.*)$`, 'm')); assert.ok(m, `${name} is in the old page`); return m[1] }
  const tier = coupons.match(/\{coupon\.tier === "premium" \? "Max" : coupon\.tier\.charAt\(0\)\.toUpperCase\(\) \+ coupon\.tier\.slice\(1\)\}/)
  assert.ok(tier, 'the old coupon row names the tier')
  return {
    users, coupons,
    filter,
    pendingCount: evalCode(`users => ${line(users, 'pendingCount')}`), approvedCount: evalCode(`users => ${line(users, 'approvedCount')}`),
    activeCoupons: evalCode(`coupons => ${line(coupons, 'activeCoupons')}`), totalRedemptions: evalCode(`coupons => ${line(coupons, 'totalRedemptions')}`), totalCreditedCents: evalCode(`coupons => ${line(coupons, 'totalCreditedCents')}`),
    tierLabel: evalCode(`coupon => ${tier[0].slice(1, -1)}`),
    createBody: evalCode(`(newCode, newValueDollars, newTier, newMaxRedemptions, newExpiresAt, newNote) => (${createBody})`),
    fetches: [...users.matchAll(/fetch\(\s*'([^']+)'/g), ...coupons.matchAll(/fetch\(\s*['`]([^'`]+)['`]/g)].map(m => m[1]),
    pushes: [...users.matchAll(/router\.push\('([^']+)'\)/g), ...coupons.matchAll(/router\.push\('([^']+)'\)/g)].map(m => m[1]),
  }
}
const LEGACY = legacy()

// ---------------------------------------------------------------- fixtures
const user = (id, email, name, approved, tier = 'free', extra = {}) => ({ id, email, name, image: null, approved, approvedAt: approved ? '2026-10-02T12:00:00.000Z' : null, approvedBy: approved ? 'admin@example.invalid' : null, createdAt: '2026-10-01T12:00:00.000Z', tier, ...extra })
const USERS = [
  user('u1', 'rowan.vale@example.invalid', 'Rowan Vale', false, 'free'),
  user('u2', 'imani.okafor@example.invalid', 'Imani Okafor', false, 'starter', { image: 'data:image/png;base64,AAAA', createdAt: '2026-10-20T12:00:00.000Z' }),
  user('u3', 'no-name-yet@example.invalid', null, false, 'free'),
  user('u4', 'ada@example.invalid', 'Ada Morgan', true, 'premium', { approvedAt: '2026-10-03T12:00:00.000Z' }),
  user('u5', 'sofia.lindqvist@example.invalid', 'Sofia Lindqvist', true, 'pro'),
  user('u6', 'boateng.k@example.invalid', 'Kwame Boateng', true, 'starter'),
]
const coupon = (id, code, valueCents, tier, maxRedemptions, timesRedeemed, expiresAt, active, note) => ({ id, code, valueCents, currency: 'usd', tier, maxRedemptions, timesRedeemed, perUserLimit: 1, expiresAt, active, note, createdBy: 'admin@example.invalid', createdAt: '2026-09-01T12:00:00.000Z', _count: { redemptions: timesRedeemed } })
const COUPONS = [
  coupon('c1', 'WELCOME50', 5000, 'starter', 100, 37, '2027-06-30T12:00:00.000Z', true, 'For the beta testers'),
  coupon('c2', 'LAUNCHWEEK', 2500, 'pro', null, 12, null, true, null),
  coupon('c3', 'FOUNDERS-MAX', 10000, 'premium', 5, 5, '2027-01-15T12:00:00.000Z', true, null),
  coupon('c4', 'SPRINGFLING', 1500, 'starter', 250, 88, '2026-03-01T12:00:00.000Z', true, 'Ended in March'),
  coupon('c5', 'PARTNER-DEMO', 7500, 'pro', 20, 3, null, false, 'Switched off after the demo'),
]

// ---------------------------------------------------------------- 1. the lib
function proveLib(source, label = 'lib') {
  const file = ts.createSourceFile(LIB, source, ts.ScriptTarget.Latest, true)
  ok(!file.statements.some(s => ts.isImportDeclaration(s) || (ts.isExportDeclaration(s) && s.moduleSpecifier)), `${label}: import-free`)
  nomatch(codeOf(source, LIB), /\brequire\(|\bimport\(|\bfetch\(|localStorage|sessionStorage|setTimeout|document\.|window\.|process\.env|@\//, `${label}: no browser, timer, network or env use`)
  nomatch(codeOf(source, LIB), /\bisAdmin\b|DEV_BYPASS|getServerSession|session\??\.user|\bemail\s*[!=]==?/, `${label}: not a permission rule`)
  const lib = load(source, LIB)
  // the flag
  eq(lib.studioP2AdminOn('true'), true, `${label}: exact "true" turns it on`)
  for (const off of [undefined, null, '', 'false', 'TRUE', 'True', ' true', 'true ', '1', 'yes', 'on', 'truee']) eq(lib.studioP2AdminOn(off), false, `${label}: ${JSON.stringify(off)} is off`)
  // routes and requests are the old pages' own
  eq(lib.STUDIO_P2_ADMIN_API.users, '/api/admin/users', `${label}: the users read`)
  eq(lib.STUDIO_P2_ADMIN_API.approve, '/api/admin/users/approve', `${label}: the approval`)
  eq(lib.STUDIO_P2_ADMIN_API.coupons, '/api/admin/coupons', `${label}: the coupon read and create`)
  eq(lib.STUDIO_P2_ADMIN_API.coupon('abc'), '/api/admin/coupons/abc', `${label}: the coupon update`)
  deepEq([...new Set(LEGACY.fetches.filter(url => !url.includes('${')))], ['/api/admin/users', '/api/admin/users/approve', '/api/admin/coupons'], `${label}: the old pages call exactly these routes (and /api/admin/coupons/\${id})`)
  ok(LEGACY.fetches.includes('/api/admin/coupons/${id}'), `${label}: and the per-coupon route`)
  eq(lib.STUDIO_P2_ADMIN_SIGN_IN.users, LEGACY.pushes.find(p => p.includes('/admin/users')), `${label}: the users sign-in redirect is the old page's`)
  eq(lib.STUDIO_P2_ADMIN_SIGN_IN.coupons, LEGACY.pushes.find(p => p.includes('/admin/coupons')), `${label}: the coupons sign-in redirect is the old page's`)
  eq(lib.STUDIO_P2_ADMIN_ROUTES.studio, '/builder', `${label}: Studio is /builder`)
  ok(LEGACY.pushes.filter(p => p === '/builder').length >= 2 && lib.STUDIO_P2_ADMIN_ROUTES.studio === '/builder', `${label}: where the old pages send an admin who may not stay`)
  deepEq([lib.STUDIO_P2_ADMIN_ROUTES.users, lib.STUDIO_P2_ADMIN_ROUTES.coupons], ['/admin/users', '/admin/coupons'], `${label}: the two pages`)
  deepEq(plain(lib.STUDIO_P2_ADMIN_NAV), [{ id: 'users', label: 'Users', href: '/admin/users' }, { id: 'coupons', label: 'Coupons', href: '/admin/coupons' }], `${label}: the nav is the two pages, in this order`)
  // the requests
  deepEq(lib.studioP2AdminApproveInit('u1', true), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'u1', approved: true }) }, `${label}: approve request`)
  deepEq(lib.studioP2AdminApproveInit('u1', false), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'u1', approved: false }) }, `${label}: revoke request`)
  deepEq(lib.studioP2AdminToggleInit(true), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: false }) }, `${label}: disabling an active coupon`)
  deepEq(lib.studioP2AdminToggleInit(false), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: true }) }, `${label}: enabling an inactive one`)
  const forms = [
    { code: 'AUTUMN-20', valueDollars: '20', tier: 'pro', maxRedemptions: '50', expiresAt: '2026-12-31T23:59', note: 'Autumn newsletter' },
    { code: 'X', valueDollars: '0.01', tier: 'starter', maxRedemptions: '', expiresAt: '', note: '' },
    { code: 'MAX', valueDollars: '49.999', tier: 'premium', maxRedemptions: '1', expiresAt: '', note: 'n' },
    { code: 'ODD', valueDollars: '12.345', tier: 'pro', maxRedemptions: '007', expiresAt: '2027-01-01T00:00', note: '' },
    { code: 'BAD', valueDollars: 'abc', tier: 'pro', maxRedemptions: 'x', expiresAt: '', note: '' },
    { code: 'SCI', valueDollars: '1', tier: 'pro', maxRedemptions: '1e3', expiresAt: '', note: '' },
    { code: 'TAIL', valueDollars: '1', tier: 'pro', maxRedemptions: '12abc', expiresAt: '', note: '' },
  ]
  for (const form of forms) {
    const expected = LEGACY.createBody(form.code, form.valueDollars, form.tier, form.maxRedemptions, form.expiresAt, form.note)
    deepEq(lib.studioP2AdminCouponBody(form), expected, `${label}: the create body for ${form.code} is the old page's`)
    deepEq(lib.studioP2AdminCreateInit(form), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(expected) }, `${label}: the create request for ${form.code}`)
  }
  deepEq(lib.STUDIO_P2_ADMIN_EMPTY_FORM, { code: '', valueDollars: '', tier: 'starter', maxRedemptions: '', expiresAt: '', note: '' }, `${label}: an empty form starts on Starter`)
  // what a read means
  const outcomes = { 200: 'ready', 201: 'ready', 204: 'ready', 299: 'ready', 401: 'signin', 403: 'forbidden', 400: 'failed', 404: 'failed', 500: 'failed', 502: 'failed', 503: 'failed', 301: 'failed', 199: 'failed', 300: 'failed' }
  for (const [status, expected] of Object.entries(outcomes)) eq(lib.studioP2AdminListOutcome(Number(status)), expected, `${label}: a ${status} read is ${expected}`)
  for (const odd of [null, undefined, NaN, Infinity, '200', {}]) eq(lib.studioP2AdminListOutcome(odd), 'failed', `${label}: no status (${String(odd)}) is a failed read`)
  deepEq(lib.studioP2AdminRows({ users: [1, 2] }, 'users'), [1, 2], `${label}: rows of a users reply`)
  deepEq(lib.studioP2AdminRows({ coupons: [3] }, 'coupons'), [3], `${label}: rows of a coupons reply`)
  for (const odd of [null, undefined, {}, { users: null }, { users: 'x' }, { users: {} }, [], 'users', 5, { coupons: [1] }]) deepEq(lib.studioP2AdminRows(odd, 'users'), [], `${label}: ${JSON.stringify(odd)} is no rows`)
  // what a failed action means
  const kinds = { 401: 'session', 403: 'forbidden', 400: 'rejected', 404: 'rejected', 409: 'rejected', 422: 'rejected', 499: 'rejected', 500: 'failed', 502: 'failed', 200: 'failed', 399: 'failed' }
  for (const [status, expected] of Object.entries(kinds)) eq(lib.studioP2AdminFailureKind(Number(status)), expected, `${label}: a ${status} action is ${expected}`)
  for (const odd of [null, undefined, NaN]) eq(lib.studioP2AdminFailureKind(odd), 'failed', `${label}: no status is a plain failure`)
  eq(lib.studioP2AdminFailureSentence(401, 'Unauthorized', 'FALLBACK'), 'Your session has ended. Sign in again, then try once more.', `${label}: 401`)
  eq(lib.studioP2AdminFailureSentence(403, 'Forbidden', 'FALLBACK'), 'This account is not allowed to do that.', `${label}: 403`)
  eq(lib.studioP2AdminFailureSentence(409, 'A coupon with this code already exists', 'FALLBACK'), 'A coupon with this code already exists', `${label}: the route's own reason for a refused input`)
  eq(lib.studioP2AdminFailureSentence(400, '  Code is required  ', 'FALLBACK'), 'Code is required', `${label}: trimmed`)
  for (const own of [undefined, null, '', '   ', 5, {}, '<html>x</html>', '1234', 'x'.repeat(201), '\n']) eq(lib.studioP2AdminFailureSentence(400, own, 'FALLBACK'), 'FALLBACK', `${label}: ${JSON.stringify(own)} is not a sentence worth showing`)
  for (const status of [500, 502, null, undefined]) eq(lib.studioP2AdminFailureSentence(status, 'Internal server error', 'FALLBACK'), 'FALLBACK', `${label}: a ${status} failure does not show the route's raw words`)
  eq(lib.studioP2AdminApproveFailure('Rowan Vale', true), 'Could not approve Rowan Vale. Try again.', `${label}: approve failure words`)
  eq(lib.studioP2AdminApproveFailure('Rowan Vale', false), 'Could not revoke Rowan Vale. Try again.', `${label}: revoke failure words`)
  eq(lib.studioP2AdminToggleFailure('WELCOME50', true), 'Could not disable WELCOME50. Try again.', `${label}: disable failure words`)
  eq(lib.studioP2AdminToggleFailure('WELCOME50', false), 'Could not enable WELCOME50. Try again.', `${label}: enable failure words`)
  eq(lib.STUDIO_P2_ADMIN_CREATE_FAILURE, 'The coupon could not be created. Try again.', `${label}: create failure words`)
  eq(lib.studioP2AdminCopyFailure('WELCOME50'), 'Could not copy WELCOME50. Select the code and copy it by hand.', `${label}: copy failure words`)
  // users: filter, search, counts (the old page's own code, executed)
  const people = [...USERS, user('u7', 'MixedCase@Example.invalid', 'Zoë  Marsh', false), user('u8', 'blank@example.invalid', null, true), user('u9', 'dotted.name@example.invalid', 'Dotted', false)]
  const queries = ['', 'a', 'A', 'rowan', 'ROWAN', 'okafor', 'example', '@example.invalid', 'zoë', 'mixedcase', 'no-name', 'nobody', 'o', 'sofia lind', 'dotted.', '.']
  for (const filter of ['all', 'pending', 'approved']) for (const query of queries) {
    deepEq(lib.studioP2AdminFilterUsers(people, filter, query).map(u => u.id), LEGACY.filter(people, filter, query).map(u => u.id), `${label}: filter ${filter} / search ${JSON.stringify(query)} is the old page's`)
  }
  deepEq(lib.studioP2AdminFilterUsers(people, 'all', 'rowan ').map(u => u.id), ['u1'], `${label}: a search padded with a space is trimmed`)
  deepEq(lib.studioP2AdminFilterUsers(people, 'all', '  ROWAN\t').map(u => u.id), ['u1'], `${label}: on both sides`)
  deepEq(lib.studioP2AdminFilterUsers(people, 'all', '   ').map(u => u.id), people.map(u => u.id), `${label}: spaces alone are no search`)
  deepEq(lib.studioP2AdminFilterUsers(people, 'bogus', '').map(u => u.id), people.map(u => u.id), `${label}: an unknown filter shows everyone`)
  const before = JSON.stringify(people); lib.studioP2AdminFilterUsers(people, 'pending', 'a'); eq(JSON.stringify(people), before, `${label}: the list is not changed`)
  deepEq(lib.studioP2AdminUserCounts(people), { total: people.length, pending: LEGACY.pendingCount(people), approved: LEGACY.approvedCount(people) }, `${label}: counts are the old page's`)
  deepEq(lib.studioP2AdminUserCounts([]), { total: 0, pending: 0, approved: 0 }, `${label}: counts of nobody`)
  deepEq([...lib.STUDIO_P2_ADMIN_USER_FILTERS], ['all', 'pending', 'approved'], `${label}: the three filters, in the old order`)
  eq(lib.STUDIO_P2_ADMIN_DEFAULT_FILTER, 'pending', `${label}: the page opens on Pending, as before`)
  deepEq(plain(lib.STUDIO_P2_ADMIN_FILTER_LABELS), { all: 'All', pending: 'Pending', approved: 'Approved' }, `${label}: filter names`)
  deepEq(lib.studioP2AdminUsersEmpty('pending', 'zzz', 9), { title: 'No users match “zzz”.', body: 'Check the spelling, or clear the search.' }, `${label}: a search with no match`)
  deepEq(lib.studioP2AdminUsersEmpty('all', ' zzz ', 9), { title: 'No users match “zzz”.', body: 'Check the spelling, or clear the search.' }, `${label}: names the trimmed search`)
  deepEq(lib.studioP2AdminUsersEmpty('all', '', 0), { title: 'No users have signed up yet.', body: 'People appear here as soon as they sign up.' }, `${label}: nobody has signed up`)
  deepEq(lib.studioP2AdminUsersEmpty('pending', '', 0), { title: 'No users have signed up yet.', body: 'People appear here as soon as they sign up.' }, `${label}: nobody has signed up (pending view)`)
  deepEq(lib.studioP2AdminUsersEmpty('pending', '', 5), { title: 'No one is waiting for approval.', body: 'Everyone who has signed up is approved.' }, `${label}: nobody pending`)
  deepEq(lib.studioP2AdminUsersEmpty('approved', '', 5), { title: 'No users have been approved yet.', body: 'Approve someone from the Pending list.' }, `${label}: nobody approved`)
  deepEq(lib.studioP2AdminUsersEmpty('all', '', 5), { title: 'No users to show.', body: '' }, `${label}: nothing else to say`)
  // shared
  for (const tier of ['starter', 'pro', 'premium', 'free', 'enterprise', 'a']) {
    if (tier !== 'free' && tier !== 'enterprise') eq(lib.studioP2AdminTierLabel(tier), LEGACY.tierLabel({ tier }), `${label}: the tier "${tier}" is named as the old coupons page names it`)
  }
  deepEq(['starter', 'pro', 'premium', 'free', 'enterprise', '', null, undefined].map(lib.studioP2AdminTierLabel), ['Starter', 'Pro', 'Max', 'Free', 'Enterprise', 'No plan', 'No plan', 'No plan'], `${label}: tier names`)
  deepEq([['Rowan', 'r@x'], [null, 'a@x'], ['', 'b@x'], ['  ', 'c@x'], ['élan', 'z@x'], [null, null], [undefined, ''], ['  zed', 'q']].map(([n, e]) => lib.studioP2AdminInitial(n, e)), ['R', 'A', 'B', 'C', 'É', '?', '?', 'Z'], `${label}: initials`)
  eq(lib.studioP2AdminDate('2026-10-21T12:00:00.000Z')?.toISOString(), '2026-10-21T12:00:00.000Z', `${label}: a date`)
  for (const bad of [null, undefined, '', 'not a date', '2026-13-45', 'Invalid']) eq(lib.studioP2AdminDate(bad), null, `${label}: ${JSON.stringify(bad)} is no date`)
  deepEq([0, 1, 5, 5000, 12345, 99, 100, -250, 1e9].map(lib.studioP2AdminMoney), [0, 1, 5, 5000, 12345, 99, 100, -250, 1e9].map(c => `$${(c / 100).toFixed(2)}`), `${label}: money is cents over 100, two decimals, as before`)
  deepEq([null, undefined, NaN, Infinity].map(lib.studioP2AdminMoney), ['$0.00', '$0.00', '$0.00', '$0.00'], `${label}: no amount is $0.00`)
  // coupons
  const sets = [COUPONS, [], [COUPONS[0]], [COUPONS[4]], [{ active: true, timesRedeemed: 3, valueCents: 250 }, { active: false, timesRedeemed: 0, valueCents: 100 }]]
  for (const set of sets) deepEq(lib.studioP2AdminCouponTotals(set), { total: set.length, active: LEGACY.activeCoupons(set).length, redemptions: LEGACY.totalRedemptions(set), creditedCents: LEGACY.totalCreditedCents(set) }, `${label}: totals of ${set.length} coupons are the old page's`)
  deepEq(lib.studioP2AdminCouponTotals(COUPONS), { total: 5, active: 4, redemptions: 145, creditedCents: 37 * 5000 + 12 * 2500 + 5 * 10000 + 88 * 1500 + 3 * 7500 }, `${label}: the fixture's totals`)
  const expiry = lib.studioP2AdminExpiry
  deepEq([expiry('2027-06-30T12:00:00.000Z', NOW), expiry('2026-03-01T12:00:00.000Z', NOW)].map(x => [x.expired, x.word]), [[false, 'Expires'], [true, 'Expired']], `${label}: expires / expired against the clock`)
  eq(expiry('2026-10-22T12:00:00.000Z', NOW).expired, false, `${label}: the moment of expiry is not yet expired`)
  eq(expiry('2026-10-22T11:59:59.999Z', NOW).expired, true, `${label}: a millisecond later it is`)
  for (const none of [null, undefined, '', 'nope']) eq(expiry(none, NOW), null, `${label}: ${JSON.stringify(none)} has no expiry`)
  eq(lib.studioP2AdminRedeemed(37, 100), '37 of 100 redeemed', `${label}: with a limit`)
  eq(lib.studioP2AdminRedeemed(12, null), '12 redeemed', `${label}: without one`)
  eq(lib.studioP2AdminRedeemed(0, undefined), '0 redeemed', `${label}: none yet`)
  eq(lib.studioP2AdminRedeemed(0, 0), '0 of 0 redeemed', `${label}: a limit of zero is still a limit`)
  eq(lib.STUDIO_P2_ADMIN_COPIED_MS, 2000, `${label}: "Copied" stays two seconds, as before`)
  // words
  const words = plain(lib.STUDIO_P2_ADMIN_WORDS)
  deepEq([words.usersTitle, words.couponsTitle, words.usersLead, words.couponsLead], ['User management', 'Coupon management', 'Approve or revoke access to Deckster.', 'Create access coupons and switch them on or off.'], `${label}: titles`)
  deepEq([words.deniedTitle, words.deniedBody, words.openStudio, words.retry, words.signIn], ['Access denied', 'This account does not have permission to open this page.', 'Open Studio', 'Try again', 'Sign in'], `${label}: denied words`)
  deepEq([words.failedUsersTitle, words.failedCouponsTitle], ['Users could not be loaded', 'Coupons could not be loaded'], `${label}: failed-read titles`)
  eq(words.failedBody, 'The request did not go through, so nothing is shown. Your access has not changed.', `${label}: a failed read does not say access was lost`)
  eq(words.refreshFailed, 'The list could not be refreshed. What is shown is the last list that loaded.', `${label}: a failed refresh says what is shown`)
  deepEq([words.signedOutTitle, words.signedOutBody], ['Your session has ended', 'Sign in again to see this page.'], `${label}: signed-out words`)
  deepEq([words.noName, words.approve, words.revoke, words.statusApproved, words.statusPending, words.statusActive, words.statusInactive], ['No name', 'Approve', 'Revoke', 'Approved', 'Pending', 'Active', 'Inactive'], `${label}: row words`)
  deepEq([words.newCoupon, words.createTitle, words.createSubmit, words.cancel, words.disable, words.enable, words.noCoupons], ['New coupon', 'Create a coupon', 'Create coupon', 'Cancel', 'Disable', 'Enable', 'No coupons yet. Create one to get started.'], `${label}: coupon words`)
  deepEq(plain(words.labels), { code: 'Code', value: 'Value (USD)', tier: 'Plan tier', max: 'Max redemptions (blank = unlimited)', expires: 'Expires at (optional)', note: 'Note (internal)' }, `${label}: the form's labels`)
  deepEq([words.refreshUsers, words.refreshCoupons, words.searchLabel, words.searchPlaceholder, words.loadingUsers, words.loadingCoupons], ['Refresh users', 'Refresh coupons', 'Search users', 'Search by email or name', 'Loading users…', 'Loading coupons…'], `${label}: control names`)
  nomatch(JSON.stringify(words), /reject|Access Denied|Go to Builder|Panel|deckster\b|\.\.\./, `${label}: no old wording (reject, Title Case, "deckster", three dots)`)
}
proveLib(SOURCES[LIB])

// ---------------------------------------------------------------- 2. the pages
// A fake backend: the six admin routes, answering from state (so an Approve is seen by the next read) unless a reply is set for it. A reply is 'ok', 'offline', [status, body],
// ['html', status] (a body that is not JSON), 'hold' (answers when released), or a function of the call number.
function makeServer(replies = {}) {
  const state = { users: JSON.parse(JSON.stringify(USERS)), coupons: JSON.parse(JSON.stringify(COUPONS)) }
  const log = [], held = [], calls = {}
  const respond = (status, body, jsonOk = true) => ({ ok: status >= 200 && status < 300, status, json: async () => { if (!jsonOk) throw new SyntaxError('Unexpected token <'); return JSON.parse(JSON.stringify(body)) } })
  const fetch = async (url, init) => {
    const method = init?.method ?? 'GET'
    const key = `${method} ${url.startsWith('/api/admin/coupons/') ? '/api/admin/coupons/:id' : url}`
    log.push({ method, url, init })
    calls[key] = (calls[key] ?? 0) + 1
    let spec = replies[key] ?? 'ok'
    if (typeof spec === 'function') spec = spec(calls[key])
    if (spec === 'offline') throw new TypeError('Failed to fetch')
    if (spec === 'hold') return new Promise(resolve => held.push(() => resolve(respondOk())))
    if (Array.isArray(spec)) return spec[0] === 'html' ? respond(spec[1], null, false) : respond(spec[0], spec[1])
    return respondOk()
    function respondOk() {
      if (key === 'GET /api/admin/users') return respond(200, { users: state.users })
      if (key === 'GET /api/admin/coupons') return respond(200, { coupons: state.coupons })
      if (key === 'POST /api/admin/users/approve') {
        const body = JSON.parse(init.body); const target = state.users.find(u => u.id === body.userId)
        if (target) { target.approved = body.approved; target.approvedAt = body.approved ? '2026-10-22T12:00:00.000Z' : null }
        return respond(200, { success: true })
      }
      if (key === 'POST /api/admin/coupons') { const body = JSON.parse(init.body); state.coupons.unshift(coupon('c99', body.code, body.valueCents, body.tier, body.maxRedemptions, 0, body.expiresAt, true, body.note)); return respond(201, { coupon: { id: 'c99' } }) }
      if (key === 'PATCH /api/admin/coupons/:id') { const target = state.coupons.find(c => url.endsWith(c.id)); if (target) target.active = JSON.parse(init.body).active; return respond(200, { coupon: {} }) }
      return respond(404, {})
    }
  }
  return { state, log, fetch, release() { while (held.length) held.shift()() }, calls }
}

function mount(which, { server = makeServer(), status = 'authenticated', clipboard = 'ok', uiSource, libSource = SOURCES[LIB] } = {}) {
  const react = makeReact()
  const pushes = [], timers = []
  const router = { push: to => pushes.push(to) }
  const session = { status }
  const written = []
  const clip = { mode: clipboard }
  const navigator = { get clipboard() { return clip.mode === 'missing' ? undefined : { writeText: async code => { if (clip.mode === 'denied') throw new DOMException('Write permission denied.', 'NotAllowedError'); written.push(code) } } } }
  const lib = load(libSource, LIB)
  const isLegacy = which.startsWith('legacy-')
  const source = isLegacy ? (which === 'legacy-users' ? baseSource(PAGE_USERS) : baseSource(PAGE_COUPONS)) : (uiSource ?? SOURCES[UI])
  const mod = load(source, isLegacy ? PAGE_USERS : UI, {
    deps: { react: react.api, '@/lib/studio-p2-admin': lib, 'next/navigation': { useRouter: () => router }, 'next-auth/react': { useSession: () => session }, 'date-fns': { format: dateFnsFormat } },
    globals: { fetch: server.fetch, navigator, setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length }, clearTimeout: id => { if (timers[id - 1]) timers[id - 1].cleared = true }, console: { error() {}, log() {} }, parseFloat, parseInt, Date: FixedDate },
  })
  const Component = isLegacy ? mod.default : mod[which === 'users' ? 'StudioP2AdminUsers' : 'StudioP2AdminCoupons']
  const view = {
    react, router, pushes, timers, written, server, session, clip,
    focusLog: [],
    render() {
      let tree
      for (let pass = 0; pass < 6; pass++) { // the old pages filter in an effect: draw again until no state moved
        react.dirty = false; react.reset(); tree = expand(Component())
        for (const n of nodes(tree)) { const r = n.props?.ref; if (r && typeof r === 'object' && 'current' in r && !r.current) r.current = { focus: () => view.focusLog.push(n.props.id ?? n.type) } } // a ref that would hold the element holds a stand-in
        react.flushEffects()
        if (!react.dirty) break
      }
      return tree
    },
    async settle() { view.render(); await tick(); return view.render() },
    unmount() { react.unmount() },
  }
  return view
}
const ofType = (tree, ...types) => nodes(tree).filter(n => types.includes(n.type))
const buttonsOf = tree => ofType(tree, 'button', 'Button')
const button = (tree, pattern) => { const found = buttonsOf(tree).filter(n => pattern.test(text(n))); assert.equal(found.length, 1, `exactly one button ${pattern} (found ${found.map(text)})`); return found[0] }
const label = n => n.props['aria-label']
const states = tree => { const root = nodes(tree)[0]; assert.equal(root.props['data-studio-p2-admin'], 'true', 'every state carries the page marker'); assert.ok(['users', 'coupons'].includes(root.props['data-page']), 'and its page'); return root.props['data-state'] }
const rowsOf = tree => ofType(tree, 'li').filter(n => /\bsa-row\b/.test(n.props.className ?? ''))
const names_of = tree => rowsOf(tree).map(n => text(nodes(n).find(m => m.props?.className === 'sa-name')))
const codes_of = tree => ofType(tree, 'button').filter(n => n.props.className === 'sa-code').map(text)
const alerts = tree => ofType(tree, 'p').filter(n => n.props.role === 'alert').map(text)
const linkTo = (tree, href) => ofType(tree, 'default').filter(n => n.props.href === href)
const input = (tree, id) => { const found = ofType(tree, 'input', 'select', 'Input').filter(n => n.props.id === id); assert.equal(found.length, 1, `one field #${id}`); return found[0] }
const typeInto = (tree, id, value) => input(tree, id).props.onChange({ target: { value } })

async function proveUsers(uiSource, libSource, tag = 'users') {
  const lib = load(libSource, LIB)
  const make = (opts = {}) => mount('users', { uiSource, libSource, ...opts })
  // loading: the session is still being read; nothing is asked yet
  let view = make({ status: 'loading' })
  let tree = view.render()
  eq(states(tree), 'loading', `${tag}: loading while the session is read`)
  eq(text(ofType(tree, 'div').find(n => n.props.role === 'status')), 'Loading users…', `${tag}: and says so`)
  eq(view.server.log.length, 0, `${tag}: nothing is requested before the session is known`)
  eq(ofType(tree, 'header', 'nav').length, 0, `${tag}: no admin chrome while loading`)
  eq(nodes(tree)[0].props['data-studio-p2-admin'], 'true', `${tag}: carrying the page's marker`)
  // signed out: back to sign-in, as the old page does
  view = make({ status: 'unauthenticated' }); tree = view.render(); await tick(); view.render()
  deepEq(view.pushes, ['/auth/signin?callbackUrl=/admin/users'], `${tag}: signed out goes to sign-in and comes back here`)
  eq(view.server.log.length, 0, `${tag}: and asks for nothing`)
  eq(states(tree), 'loading', `${tag}: the page stays neutral meanwhile`)
  // the first read
  view = make(); tree = view.render()
  eq(view.server.log.length, 1, `${tag}: one read at the start`)
  eq(view.server.log[0].url, '/api/admin/users', `${tag}: of the users route`)
  eq(view.server.log[0].init, undefined, `${tag}: a plain GET, as before`)
  eq(states(tree), 'loading', `${tag}: loading until it answers`)
  tree = await view.settle()
  eq(view.server.log.length, 1, `${tag}: and no second read on its own`)
  eq(states(tree), 'ready', `${tag}: ready`)
  view.session.status = 'loading'; tree = view.render()
  eq(states(tree), 'loading', `${tag}: a session that is read again shows the neutral page`)
  view.session.status = 'authenticated'; tree = await view.settle()
  eq(view.server.log.length, 1, `${tag}: and does not read the list again`)
  eq(states(tree), 'ready', `${tag}: and the page is back`)
  eq(nodes(tree).filter(n => n.type === 'h1').length, 1, `${tag}: one h1`)
  eq(text(nodes(tree).find(n => n.type === 'h1')), 'User management', `${tag}: its title`)
  deepEq(ofType(tree, 'dt').map(text), ['Total users', 'Pending approval', 'Approved'], `${tag}: the three counts`)
  deepEq(ofType(tree, 'dd').map(text), ['6', '3', '3'], `${tag}: their numbers`)
  const filters = ofType(tree, 'button').filter(n => n.props.className === 'sa-filter')
  deepEq(filters.map(text), ['All (6)', 'Pending (3)', 'Approved (3)'], `${tag}: filters, in the old order, with counts`)
  deepEq(filters.map(n => n.props['aria-pressed']), [false, true, false], `${tag}: it opens on Pending, and says which is pressed`)
  deepEq(names_of(tree), ['Rowan Vale', 'Imani Okafor', 'No name'], `${tag}: the pending people, in the order the route sent them`)
  const rows = rowsOf(tree)
  deepEq(rows.map(r => text(nodes(r).find(n => n.props?.className === 'sa-line'))), ['Rowan Vale Pending Free', 'Imani Okafor Pending Starter', 'No name Pending Free'], `${tag}: name, status, tier (a plain word, not the raw value)`)
  deepEq(rows.map(r => text(nodes(r).find(n => n.props?.className === 'sa-email'))), ['rowan.vale@example.invalid', 'imani.okafor@example.invalid', 'no-name-yet@example.invalid'], `${tag}: emails`)
  deepEq(rows.map(r => text(nodes(r).find(n => n.props?.className === 'sa-meta'))), ['Signed up Oct 1, 2026', 'Signed up Oct 20, 2026', 'Signed up Oct 1, 2026'], `${tag}: dates, as the old page formats them`)
  deepEq(rows.map(r => text(nodes(r).find(n => n.props?.className === 'sa-avatar'))), ['R', '', 'N'], `${tag}: initials, or the photo`)
  eq(nodes(rows[1]).find(n => n.type === 'img').props.src, 'data:image/png;base64,AAAA', `${tag}: a photo is shown`)
  eq(nodes(rows[1]).find(n => n.type === 'img').props.alt, '', `${tag}: as decoration (the name is beside it)`)
  eq(nodes(rows[0]).find(n => n.props?.className === 'sa-avatar').props['aria-hidden'], 'true', `${tag}: hidden from a screen reader`)
  deepEq(rows.map(r => label(nodes(r).find(n => n.type === 'button'))), ['Approve Rowan Vale', 'Approve Imani Okafor', 'Approve no-name-yet@example.invalid'], `${tag}: each action names its person (the email when there is no name)`)
  deepEq(rows.map(r => nodes(r).filter(n => n.props?.className === 'sa-chip').map(n => n.props['data-tone'] ?? null)), [['wait', null], ['wait', null], ['wait', null]], `${tag}: a pending person is marked pending`)
  deepEq(rows.map(r => { const b = nodes(r).find(n => n.type === 'button'); return [b.props['data-primary'] ?? null, b.props['data-tone'] ?? null] }), [['true', null], ['true', null], ['true', null]], `${tag}: Approve is the primary action`)
  // chrome appears only now
  eq(nodes(tree).find(n => n.type === 'nav').props['aria-label'], 'Admin pages', `${tag}: the admin nav, named`)
  deepEq(ofType(tree, 'default').filter(n => /sa-nav-link/.test(n.props.className ?? '')).map(n => [text(n), n.props.href, n.props['aria-current'] ?? null]), [['Users', '/admin/users', 'page'], ['Coupons', '/admin/coupons', null]], `${tag}: Users (current) and Coupons: the pages link to each other`)
  eq(linkTo(tree, '/builder').length, 1, `${tag}: and to Studio`)
  eq(text(linkTo(tree, '/builder')[0]), 'Open Studio', `${tag}: in Studio's words`)
  eq(linkTo(tree, '/')[0].props['aria-label'], 'Deckster home', `${tag}: the brand tile goes home, named`)
  eq(view.pushes.length, 0, `${tag}: nothing redirects an admin`)
  // filters and search
  tree = (filters[0].props.onClick(), view.render())
  eq(names_of(tree).length, 6, `${tag}: All shows everyone`)
  deepEq(ofType(tree, 'button').filter(n => n.props.className === 'sa-filter').map(n => n.props['aria-pressed']), [true, false, false], `${tag}: and All is pressed`)
  tree = (ofType(tree, 'button').filter(n => n.props.className === 'sa-filter')[2].props.onClick(), view.render())
  deepEq(names_of(tree), ['Ada Morgan', 'Sofia Lindqvist', 'Kwame Boateng'], `${tag}: Approved shows the approved`)
  deepEq(rowsOf(tree).map(r => text(nodes(r).find(n => n.props?.className === 'sa-line'))), ['Ada Morgan Approved Max', 'Sofia Lindqvist Approved Pro', 'Kwame Boateng Approved Starter'], `${tag}: with their status, and "premium" named Max`)
  deepEq(rowsOf(tree).map(r => text(nodes(r).find(n => n.props?.className === 'sa-meta'))), ['Signed up Oct 1, 2026 · Approved Oct 3, 2026', 'Signed up Oct 1, 2026 · Approved Oct 2, 2026', 'Signed up Oct 1, 2026 · Approved Oct 2, 2026'], `${tag}: and the approval date`)
  deepEq(rowsOf(tree).map(r => label(nodes(r).find(n => n.type === 'button'))), ['Revoke Ada Morgan', 'Revoke Sofia Lindqvist', 'Revoke Kwame Boateng'], `${tag}: each offers Revoke`)
  deepEq(rowsOf(tree).map(r => nodes(r).filter(n => n.props?.className === 'sa-chip').map(n => n.props['data-tone'] ?? null)), [['ok', null], ['ok', null], ['ok', null]], `${tag}: an approved person is marked approved`)
  deepEq(rowsOf(tree).map(r => { const b = nodes(r).find(n => n.type === 'button'); return [b.props['data-primary'] ?? null, b.props['data-tone'] ?? null] }), [[null, 'danger'], [null, 'danger'], [null, 'danger']], `${tag}: Revoke is a quiet danger button, not the primary one`)
  deepEq(rowsOf(tree).map(r => text(nodes(r).find(n => n.props?.className === 'sa-avatar'))), ['A', 'S', 'K'], `${tag}: the avatar letter is the name's, not the email's`)
  const search = value => { const field = ofType(view.render(), 'input').find(n => n.props.type === 'search'); field.props.onChange({ target: { value } }); return view.render() }
  tree = search('ROWAN ')
  eq(ofType(tree, 'input').find(n => n.props.type === 'search').props.value, 'ROWAN ', `${tag}: the search box shows what was typed`)
  deepEq(names_of(tree), [], `${tag}: Approved + "rowan" finds nobody (Rowan is pending)`)
  eq(text(ofType(tree, 'div').find(n => /sa-empty/.test(n.props.className ?? ''))), 'No users match “ROWAN”. Check the spelling, or clear the search.', `${tag}: and says it is the search`)
  eq(ofType(tree, 'div').find(n => /sa-empty/.test(n.props.className ?? '')).props.role, 'status', `${tag}: announced`)
  ofType(tree, 'button').filter(n => n.props.className === 'sa-filter')[0].props.onClick(); tree = view.render()
  deepEq(names_of(tree), ['Rowan Vale'], `${tag}: All + "ROWAN " (case and a trailing space ignored) finds Rowan`)
  eq(ofType(tree, 'input').find(n => n.props.type === 'search').props['aria-label'], 'Search users', `${tag}: the search box is named`)
  eq(ofType(tree, 'input').find(n => n.props.type === 'search').props.placeholder, 'Search by email or name', `${tag}: and says what it searches`)
  tree = search('')
  eq(names_of(tree).length, 6, `${tag}: clearing the search shows everyone`)
  // uneven counts: the three figures and the filter labels are the whole list's, whatever is shown
  view = make(); view.server.state.users = [USERS[0], USERS[1], USERS[2], USERS[3]]; await view.settle(); tree = view.render()
  deepEq(ofType(tree, 'button').filter(n => n.props.className === 'sa-filter').map(text), ['All (4)', 'Pending (3)', 'Approved (1)'], `${tag}: uneven: filter counts`)
  deepEq(ofType(tree, 'dd').map(text), ['4', '3', '1'], `${tag}: uneven: the figures`)
  ofType(tree, 'button').filter(n => n.props.className === 'sa-filter')[2].props.onClick(); tree = view.render()
  deepEq(names_of(tree), ['Ada Morgan'], `${tag}: uneven: Approved shows one`)
  deepEq(ofType(tree, 'dd').map(text), ['4', '3', '1'], `${tag}: uneven: and the figures do not follow the filter`)
  // approving: the same request, then a fresh read
  view = make(); await view.settle()
  tree = view.render()
  const firstApprove = buttonsOf(tree).find(n => label(n) === 'Approve Rowan Vale')
  const pending = firstApprove.props.onClick()
  tree = view.render()
  const busy = buttonsOf(tree).find(n => label(n) === 'Approve Rowan Vale')
  eq(busy.props.disabled, true, `${tag}: the button is off while it works`)
  eq(busy.props['aria-busy'], true, `${tag}: and says it is busy`)
  eq(ofType(busy, 'RefreshCw').length, 1, `${tag}: with a spinner`)
  eq(buttonsOf(tree).filter(n => n.props.disabled).length, 1, `${tag}: only that button`)
  await pending; tree = await view.settle()
  deepEq(view.server.log.slice(1).map(c => [c.method, c.url, c.init && c.init.body]), [['POST', '/api/admin/users/approve', JSON.stringify({ userId: 'u1', approved: true })], ['GET', '/api/admin/users', undefined]], `${tag}: approve posts the old body, then reads the list again`)
  deepEq(view.server.log[1].init.headers, { 'Content-Type': 'application/json' }, `${tag}: with the old header`)
  deepEq(names_of(tree), ['Imani Okafor', 'No name'], `${tag}: Rowan has left Pending`)
  deepEq(ofType(tree, 'dd').map(text), ['6', '2', '4'], `${tag}: and the counts moved`)
  eq(ofType(tree, 'button').filter(n => n.props.disabled).length, 0, `${tag}: nothing is left disabled`)
  eq(alerts(tree).length, 0, `${tag}: and no message`)
  // revoking
  ofType(tree, 'button').filter(n => n.props.className === 'sa-filter')[2].props.onClick()
  tree = view.render()
  await buttonsOf(tree).find(n => label(n) === 'Revoke Sofia Lindqvist').props.onClick(); tree = await view.settle()
  deepEq(view.server.log.slice(-2).map(c => [c.method, c.url, c.init && c.init.body]), [['POST', '/api/admin/users/approve', JSON.stringify({ userId: 'u5', approved: false })], ['GET', '/api/admin/users', undefined]], `${tag}: revoke posts approved:false, then reads again`)
  eq(names_of(tree).includes('Sofia Lindqvist'), false, `${tag}: Sofia is no longer approved`)
  // a failed approval says so, keeps the list, and does not read again
  for (const [reply, expected] of [
    [[500, { error: 'Internal server error' }], 'Could not approve Rowan Vale. Try again.'], [['html', 502], 'Could not approve Rowan Vale. Try again.'], ['offline', 'Could not approve Rowan Vale. Try again.'],
    [[401, { error: 'Unauthorized' }], 'Your session has ended. Sign in again, then try once more.'], [[403, { error: 'Forbidden - Admin access required' }], 'This account is not allowed to do that.'],
    [[400, { error: 'Invalid request body' }], 'Invalid request body'], [['html', 401], 'Your session has ended. Sign in again, then try once more.'], [['html', 400], 'Could not approve Rowan Vale. Try again.'],
  ]) {
    view = make({ server: makeServer({ 'POST /api/admin/users/approve': reply }) }); await view.settle()
    await buttonsOf(view.render()).find(n => label(n) === 'Approve Rowan Vale').props.onClick(); tree = await view.settle()
    deepEq(alerts(tree), [expected], `${tag}: a failed approval (${JSON.stringify(reply)}) says: ${expected}`)
    eq(view.server.log.length, 2, `${tag}: and the list is not read again`)
    deepEq(names_of(tree), ['Rowan Vale', 'Imani Okafor', 'No name'], `${tag}: nor emptied`)
    eq(ofType(tree, 'button').filter(n => n.props.disabled).length, 0, `${tag}: the button is back`)
    eq(states(tree), 'ready', `${tag}: and the page is still the page`)
    eq(view.pushes.length, 0, `${tag}: no redirect`)
  }
  view = make({ server: makeServer({ 'POST /api/admin/users/approve': [500, {}] }) }); await view.settle()
  await buttonsOf(view.render()).find(n => label(n) === 'Approve Rowan Vale').props.onClick(); await view.settle()
  view.server.log.length = 0
  await buttonsOf(view.render()).find(n => label(n) === 'Approve Imani Okafor').props.onClick(); tree = await view.settle()
  deepEq(alerts(tree), ['Could not approve Imani Okafor. Try again.'], `${tag}: the next failure names its own person`)
  view = make({ server: makeServer({ 'POST /api/admin/users/approve': n => n === 1 ? [500, {}] : 'hold' }) }); await view.settle()
  await buttonsOf(view.render()).find(n => label(n) === 'Approve Rowan Vale').props.onClick(); tree = await view.settle()
  eq(alerts(tree).length, 1, `${tag}: a failure is shown`)
  const second = buttonsOf(view.render()).find(n => label(n) === 'Approve Rowan Vale').props.onClick(); tree = view.render()
  deepEq(alerts(tree), [], `${tag}: and a new action clears it at once, not when it is done`)
  view.server.release(); await second; await view.settle()
  const okView = make({ server: makeServer({ 'POST /api/admin/users/approve': n => n === 1 ? [500, {}] : 'ok' }) }); await okView.settle()
  await buttonsOf(okView.render()).find(n => label(n) === 'Approve Rowan Vale').props.onClick(); await okView.settle()
  await buttonsOf(okView.render()).find(n => label(n) === 'Approve Rowan Vale').props.onClick(); tree = await okView.settle()
  deepEq(alerts(tree), [], `${tag}: a later success clears the message`)
  // a refresh keeps the page; its failure keeps the list
  view = make({ server: makeServer({ 'GET /api/admin/users': n => n === 2 ? 'hold' : 'ok' }) }); await view.settle()
  const refreshButton = tree => buttonsOf(tree).find(n => n.props['aria-label'] === 'Refresh users')
  tree = view.render()
  eq(refreshButton(tree).props.disabled, false, `${tag}: Refresh is on at rest`)
  const refreshing = refreshButton(tree).props.onClick(); tree = view.render()
  eq(states(tree), 'ready', `${tag}: refreshing keeps the page (the old one swapped it for a spinner)`)
  deepEq(names_of(tree), ['Rowan Vale', 'Imani Okafor', 'No name'], `${tag}: and the list`)
  eq(refreshButton(tree).props.disabled, true, `${tag}: Refresh is off while it works`)
  eq(ofType(refreshButton(tree), 'RefreshCw')[0].props.className, 'sa-spinning', `${tag}: and spins`)
  eq(view.pushes.length, 0, `${tag}: no redirect`)
  view.server.release(); await refreshing; tree = await view.settle()
  eq(refreshButton(tree).props.disabled, false, `${tag}: Refresh comes back`)
  eq(ofType(refreshButton(tree), 'RefreshCw')[0].props.className, undefined, `${tag}: and stops spinning`)
  view = make({ server: makeServer({ 'GET /api/admin/users': n => n === 2 ? [500, {}] : 'ok' }) }); await view.settle()
  await refreshButton(view.render()).props.onClick(); tree = await view.settle()
  eq(alerts(tree).length, 1, `${tag}: a failed refresh is said`)
  await refreshButton(view.render()).props.onClick(); tree = await view.settle()
  deepEq(alerts(tree), [], `${tag}: and the next good read clears it`)
  for (const reply of [[500, {}], ['html', 502], 'offline']) {
    view = make({ server: makeServer({ 'GET /api/admin/users': n => n === 1 ? 'ok' : reply }) }); await view.settle()
    await refreshButton(view.render()).props.onClick(); tree = await view.settle()
    eq(states(tree), 'ready', `${tag}: a failed refresh (${JSON.stringify(reply)}) leaves the page`)
    deepEq(names_of(tree), ['Rowan Vale', 'Imani Okafor', 'No name'], `${tag}: and the last list`)
    deepEq(alerts(tree), ['The list could not be refreshed. What is shown is the last list that loaded.'], `${tag}: and says it is the last list`)
    eq(view.pushes.length, 0, `${tag}: no redirect`)
  }
  view = make({ server: makeServer({ 'GET /api/admin/users': n => n === 1 ? 'ok' : [403, {}] }) }); await view.settle()
  await refreshButton(view.render()).props.onClick(); tree = await view.settle()
  eq(states(tree), 'forbidden', `${tag}: a refresh that is refused is access denied`)
  deepEq(view.pushes, ['/builder'], `${tag}: and sends the person to Studio, as before`)
  // a 403: denied, the way out, and the redirect the old page made
  view = make({ server: makeServer({ 'GET /api/admin/users': [403, { error: 'Forbidden - Admin access required' }] }) }); await view.settle(); tree = await view.settle()
  eq(states(tree), 'forbidden', `${tag}: 403: denied`)
  eq(text(nodes(tree).find(n => n.type === 'h1')), 'Access denied', `${tag}: 403: the title`)
  eq(text(ofType(tree, 'p')[0]), 'This account does not have permission to open this page.', `${tag}: 403: the words`)
  eq(linkTo(tree, '/builder').length, 1, `${tag}: 403: a way to Studio`)
  eq(text(linkTo(tree, '/builder')[0]), 'Open Studio', `${tag}: 403: its words`)
  deepEq([linkTo(tree, '/builder')[0].props.className, linkTo(tree, '/builder')[0].props['data-primary'], linkTo(tree, '/builder')[0].props.hidden], ['sa-btn', 'true', undefined], `${tag}: 403: drawn as the card's one button, and shown`)
  deepEq(view.pushes, ['/builder'], `${tag}: 403: sent to Studio once, as before`)
  eq(ofType(tree, 'header', 'nav', 'dl', 'ul').length, 0, `${tag}: 403: no admin chrome and no data`)
  eq(view.server.log.length, 1, `${tag}: 403: one read`)
  // a 401: sign in again, no redirect to Studio
  view = make({ server: makeServer({ 'GET /api/admin/users': [401, { error: 'Unauthorized' }] }) }); await view.settle(); tree = await view.settle()
  eq(states(tree), 'signin', `${tag}: 401: the session ended`)
  eq(text(nodes(tree).find(n => n.type === 'h1')), 'Your session has ended', `${tag}: 401: its title`)
  eq(linkTo(tree, '/auth/signin?callbackUrl=/admin/users').length, 1, `${tag}: 401: a way to sign in that comes back here`)
  eq(text(linkTo(tree, '/auth/signin?callbackUrl=/admin/users')[0]), 'Sign in', `${tag}: 401: its words`)
  deepEq(view.pushes, [], `${tag}: 401: no redirect to Studio`)
  // a failed read: not "access denied", no redirect, retry works
  for (const reply of [[500, { error: 'Internal server error' }], [502, null], ['html', 502], [404, {}], 'offline']) {
    view = make({ server: makeServer({ 'GET /api/admin/users': n => n === 1 ? reply : 'ok' }) }); await view.settle(); tree = await view.settle()
    eq(states(tree), 'failed', `${tag}: ${JSON.stringify(reply)}: a failed read`)
    eq(text(nodes(tree).find(n => n.type === 'h1')), 'Users could not be loaded', `${tag}: ${JSON.stringify(reply)}: says so`)
    eq(text(ofType(tree, 'p')[0]), 'The request did not go through, so nothing is shown. Your access has not changed.', `${tag}: ${JSON.stringify(reply)}: and that access has not changed`)
    nomatch(text(tree), /Access denied|permission/, `${tag}: ${JSON.stringify(reply)}: never "access denied"`)
    deepEq(view.pushes, [], `${tag}: ${JSON.stringify(reply)}: no redirect (the old page sent the admin to Studio)`)
    eq(ofType(tree, 'header', 'nav', 'dl', 'ul').length, 0, `${tag}: ${JSON.stringify(reply)}: no chrome`)
    const retry = button(tree, /^Try again$/)
    eq(retry.props.disabled, false, `${tag}: ${JSON.stringify(reply)}: Try again is on`)
    await retry.props.onClick(); tree = await view.settle()
    eq(states(tree), 'ready', `${tag}: ${JSON.stringify(reply)}: Try again reads again and the page loads`)
    eq(view.server.log.length, 2, `${tag}: ${JSON.stringify(reply)}: exactly one more read`)
  }
  // empty and odd data
  view = make({ server: makeServer() }); view.server.state.users = []; await view.settle(); tree = await view.settle()
  eq(states(tree), 'ready', `${tag}: nobody yet: still the page`)
  eq(text(ofType(tree, 'div').find(n => /sa-empty/.test(n.props.className ?? ''))), 'No users have signed up yet. People appear here as soon as they sign up.', `${tag}: nobody yet: the words`)
  deepEq(ofType(tree, 'dd').map(text), ['0', '0', '0'], `${tag}: nobody yet: zero counts`)
  view = make({ server: makeServer() }); view.server.state.users = USERS.map(u => ({ ...u, approved: true })); await view.settle(); tree = await view.settle()
  eq(text(ofType(tree, 'div').find(n => /sa-empty/.test(n.props.className ?? ''))), 'No one is waiting for approval. Everyone who has signed up is approved.', `${tag}: everyone approved: the Pending list says so (the old page said "No users found")`)
  view = make({ server: makeServer({ 'GET /api/admin/users': [200, { users: 'nope' }] }) }); await view.settle(); tree = await view.settle()
  eq(states(tree), 'ready', `${tag}: a reply with no list is an empty list`)
  view = make(); view.server.state.users = [user('x1', 'odd@example.invalid', null, false, 'free', { createdAt: 'not a date', approvedAt: 'also not' }), user('x2', '', '', true, null)]; await view.settle(); tree = await view.settle()
  deepEq(rowsOf(tree).map(r => text(nodes(r).find(n => n.props?.className === 'sa-meta'))), [''], `${tag}: an unreadable date is left out, not a crash`)
  ofType(tree, 'button').filter(n => n.props.className === 'sa-filter')[0].props.onClick(); tree = view.render()
  deepEq(rowsOf(tree).map(r => text(nodes(r).find(n => n.props?.className === 'sa-line'))), ['No name Pending Free', 'No name Approved No plan'], `${tag}: no name and no tier are named, not crashed on`)
  deepEq(rowsOf(tree).map(r => text(nodes(r).find(n => n.props?.className === 'sa-avatar'))), ['O', '?'], `${tag}: and the avatar has a letter or a mark`)
  // source hygiene
  const ui = codeOf(uiSource ?? SOURCES[UI], UI)
  nomatch(ui, /console\.|localStorage|sessionStorage|alert\(|confirm\(|window\./, `${tag}: no console, storage or dialog`)
  nomatch(uiSource ?? SOURCES[UI], /bg-|text-(?:purple|blue|green|orange|red|gray|slate)|border-(?:purple|border)|from-|to-|dark:|animate-spin/, `${tag}: no utility class`)
  match(uiSource ?? SOURCES[UI], /^"use client"/, `${tag}: a client component`)
}
await proveUsers(SOURCES[UI], SOURCES[LIB])

async function proveCoupons(uiSource, libSource, tag = 'coupons') {
  const make = (opts = {}) => mount('coupons', { uiSource, libSource, ...opts })
  const refreshButton = tree => buttonsOf(tree).find(n => n.props['aria-label'] === 'Refresh coupons')
  const lineOf = r => text(nodes(r).find(n => n.props?.className === 'sa-line'))
  const metaOf = r => text(nodes(r).find(n => n.props?.className === 'sa-meta'))
  // loading, signed out
  let view = make({ status: 'loading' })
  let tree = view.render()
  eq(states(tree), 'loading', `${tag}: loading while the session is read`)
  eq(text(ofType(tree, 'div').find(n => n.props.role === 'status')), 'Loading coupons…', `${tag}: and says so`)
  eq(view.server.log.length, 0, `${tag}: nothing is requested before the session is known`)
  eq(ofType(tree, 'header', 'nav').length, 0, `${tag}: no admin chrome while loading`)
  view = make({ status: 'unauthenticated' }); view.render(); await tick(); tree = view.render()
  deepEq(view.pushes, ['/auth/signin?callbackUrl=/admin/coupons'], `${tag}: signed out goes to sign-in and comes back here`)
  eq(view.server.log.length, 0, `${tag}: and asks for nothing`)
  // the first read
  view = make(); tree = view.render()
  eq(view.server.log.length, 1, `${tag}: one read at the start`)
  eq(view.server.log[0].url, '/api/admin/coupons', `${tag}: of the coupons route`)
  eq(view.server.log[0].init, undefined, `${tag}: a plain GET, as before`)
  tree = await view.settle()
  eq(view.server.log.length, 1, `${tag}: and no second read on its own`)
  eq(states(tree), 'ready', `${tag}: ready`)
  view.session.status = 'loading'; tree = view.render()
  eq(states(tree), 'loading', `${tag}: a session that is read again shows the neutral page`)
  view.session.status = 'authenticated'; tree = await view.settle()
  eq(view.server.log.length, 1, `${tag}: and does not read the list again`)
  eq(text(nodes(tree).find(n => n.type === 'h1')), 'Coupon management', `${tag}: its title`)
  deepEq(ofType(tree, 'dt').map(text), ['Total coupons', 'Active', 'Redemptions'], `${tag}: the three figures`)
  deepEq(ofType(tree, 'dd').map(text), ['5', '4', '145'], `${tag}: their numbers`)
  eq(text(ofType(tree, 'small')[0]), '$4195.00 credited', `${tag}: what the redemptions credited, as the old page computes it`)
  deepEq(codes_of(tree), ['WELCOME50', 'LAUNCHWEEK', 'FOUNDERS-MAX', 'SPRINGFLING', 'PARTNER-DEMO'], `${tag}: the coupons, in the order the route sent them`)
  const rows = rowsOf(tree)
  deepEq(rows.map(lineOf), ['WELCOME50 Active $50.00 Starter', 'LAUNCHWEEK Active $25.00 Pro', 'FOUNDERS-MAX Active $100.00 Max', 'SPRINGFLING Active $15.00 Starter', 'PARTNER-DEMO Inactive $75.00 Pro'], `${tag}: code, status, value, tier ("premium" is Max)`)
  deepEq(rows.map(metaOf), ['37 of 100 redeemed · Expires Jun 30, 2027 · Created Sep 1, 2026', '12 redeemed · Created Sep 1, 2026', '5 of 5 redeemed · Expires Jan 15, 2027 · Created Sep 1, 2026', '88 of 250 redeemed · Expired Mar 1, 2026 · Created Sep 1, 2026', '3 of 20 redeemed · Created Sep 1, 2026'], `${tag}: redemptions, expiry (an ended one says Expired), created`)
  deepEq(rows.map(r => nodes(r).filter(n => n.props?.['data-expired']).length), [0, 0, 0, 1, 0], `${tag}: only the ended expiry is marked`)
  deepEq(rows.map(r => text(nodes(r).find(n => n.props?.className === 'sa-note') ?? '')), ['For the beta testers', '', '', 'Ended in March', 'Switched off after the demo'], `${tag}: notes`)
  deepEq(rows.map(r => r.props['data-active']), ['true', 'true', 'true', 'true', 'false'], `${tag}: an inactive row is marked`)
  deepEq(rows.map(r => nodes(r).filter(n => n.props?.className === 'sa-chip').map(n => n.props['data-tone'] ?? null)), [['ok', null, null], ['ok', null, null], ['ok', null, null], ['ok', null, null], [null, null, null]], `${tag}: only an active coupon's status chip is marked`)
  deepEq(rows.map(r => { const b = nodes(r).filter(n => n.type === 'button').at(-1); return [text(b), label(b)] }), [['Disable', 'Disable WELCOME50'], ['Disable', 'Disable LAUNCHWEEK'], ['Disable', 'Disable FOUNDERS-MAX'], ['Disable', 'Disable SPRINGFLING'], ['Enable', 'Enable PARTNER-DEMO']], `${tag}: each row's switch, named`)
  deepEq(ofType(tree, 'button').filter(n => n.props.className === 'sa-code').map(n => [n.props.title, label(n)]), codes_of(tree).map(code => ['Copy the code', `Copy ${code}`]), `${tag}: the code is a button that copies, named`)
  eq(nodes(tree).find(n => n.type === 'nav').props['aria-label'], 'Admin pages', `${tag}: the admin nav, named`)
  deepEq(ofType(tree, 'default').filter(n => /sa-nav-link/.test(n.props.className ?? '')).map(n => [text(n), n.props.href, n.props['aria-current'] ?? null]), [['Users', '/admin/users', null], ['Coupons', '/admin/coupons', 'page']], `${tag}: Users and Coupons (current)`)
  eq(text(linkTo(tree, '/builder')[0]), 'Open Studio', `${tag}: Open Studio`)
  eq(view.pushes.length, 0, `${tag}: nothing redirects an admin`)
  eq(ofType(tree, 'form').length, 0, `${tag}: no form until asked`)
  const newButton = tree => buttonsOf(tree).find(n => text(n) === 'New coupon')
  eq(newButton(tree).props['aria-expanded'], false, `${tag}: New coupon says it is closed`)
  eq(newButton(tree).props['aria-controls'], 'sa-create', `${tag}: and what it opens`)
  // the form
  newButton(tree).props.onClick(); tree = view.render()
  eq(ofType(tree, 'form').length, 1, `${tag}: New coupon opens the form`)
  eq(newButton(tree).props['aria-expanded'], true, `${tag}: and says it is open`)
  deepEq(view.focusLog, ['code'], `${tag}: the keyboard moves to the first field, once`)
  eq(nodes(tree).find(n => n.props?.id === 'sa-create').props['aria-labelledby'], 'sa-create-title', `${tag}: the form is named`)
  eq(text(nodes(tree).find(n => n.props?.id === 'sa-create-title')), 'Create a coupon', `${tag}: by its title`)
  const labels = ofType(tree, 'label').map(n => [n.props.htmlFor, text(n)])
  deepEq(labels, [['code', 'Code'], ['value', 'Value (USD)'], ['tier', 'Plan tier'], ['maxRedemptions', 'Max redemptions (blank = unlimited)'], ['expiresAt', 'Expires at (optional)'], ['note', 'Note (internal)']], `${tag}: every field has its label`)
  deepEq(['code', 'value', 'maxRedemptions', 'expiresAt', 'note'].map(id => [id, input(tree, id).props.type ?? 'text', Boolean(input(tree, id).props.required)]), [['code', 'text', true], ['value', 'number', true], ['maxRedemptions', 'number', false], ['expiresAt', 'datetime-local', false], ['note', 'text', false]], `${tag}: the same field types and required marks as before`)
  deepEq([input(tree, 'value').props.step, input(tree, 'value').props.min, input(tree, 'maxRedemptions').props.min], ['0.01', '0.01', '1'], `${tag}: and limits`)
  deepEq(nodes(input(tree, 'tier')).filter(n => n.type === 'option').map(n => [n.props.value, text(n)]), [['starter', 'Starter'], ['pro', 'Pro'], ['premium', 'Max']], `${tag}: the plan tiers, the last named Max`)
  eq(input(tree, 'tier').props.value, 'starter', `${tag}: Starter first`)
  eq(input(tree, 'code').props.className, 'sa-mono', `${tag}: the code is set in mono`)
  eq(ofType(tree, 'button').filter(n => n.props.type === 'submit').length, 1, `${tag}: one submit`)
  eq(text(button(tree, /^Create coupon$/)), 'Create coupon', `${tag}: its words`)
  typeInto(tree, 'code', 'autumn-20'); tree = view.render()
  eq(input(tree, 'code').props.value, 'AUTUMN-20', `${tag}: a typed code is upper-cased, as before`)
  for (const [id, value] of [['value', '20'], ['tier', 'pro'], ['maxRedemptions', '50'], ['expiresAt', '2026-12-31T23:59'], ['note', 'Autumn newsletter']]) { typeInto(view.render(), id, value) }
  tree = view.render()
  const submit = tree => nodes(tree).find(n => n.type === 'form').props.onSubmit({ preventDefault() { submit.prevented = true } })
  submit.prevented = false
  const creating = submit(tree)
  eq(submit.prevented, true, `${tag}: the form does not reload the page`)
  tree = view.render()
  eq(button(tree, /^Create coupon$/).props.disabled, true, `${tag}: Create is off while it works`)
  eq(ofType(button(tree, /^Create coupon$/), 'RefreshCw').length, 1, `${tag}: with a spinner`)
  await creating; tree = await view.settle()
  deepEq(view.server.log.slice(1).map(c => [c.method, c.url, c.init && c.init.body, c.init && c.init.headers]), [['POST', '/api/admin/coupons', JSON.stringify(LEGACY.createBody('AUTUMN-20', '20', 'pro', '50', '2026-12-31T23:59', 'Autumn newsletter')), { 'Content-Type': 'application/json' }], ['GET', '/api/admin/coupons', undefined, undefined]], `${tag}: create sends the old body, then reads the list again`)
  eq(ofType(tree, 'form').length, 0, `${tag}: the form closes`)
  eq(codes_of(tree)[0], 'AUTUMN-20', `${tag}: and the new coupon is listed`)
  deepEq(ofType(tree, 'dd').map(text), ['6', '5', '145'], `${tag}: the figures moved`)
  newButton(tree).props.onClick(); tree = view.render()
  deepEq(['code', 'value', 'maxRedemptions', 'expiresAt', 'note'].map(id => input(tree, id).props.value), ['', '', '', '', ''], `${tag}: a new form starts empty`)
  eq(input(tree, 'tier').props.value, 'starter', `${tag}: on Starter`)
  typeInto(tree, 'code', 'keep'); tree = view.render()
  eq(view.focusLog.length, 2, `${tag}: the keyboard went to the first field each time the form opened`)
  button(tree, /^Cancel$/).props.onClick(); tree = view.render()
  eq(ofType(tree, 'form').length, 0, `${tag}: Cancel closes it`)
  eq(view.focusLog.length, 2, `${tag}: and closing it does not move the keyboard`)
  newButton(tree).props.onClick(); tree = view.render()
  eq(input(tree, 'code').props.value, 'KEEP', `${tag}: and keeps what was typed, as before`)
  newButton(tree).props.onClick(); tree = view.render()
  eq(ofType(tree, 'form').length, 0, `${tag}: New coupon closes it again`)
  // a failed create keeps the form and says why
  for (const [reply, expected] of [
    [[409, { error: 'A coupon with this code already exists' }], 'A coupon with this code already exists'], [[400, { error: 'Value (cents) must be a positive number' }], 'Value (cents) must be a positive number'],
    [[500, { error: 'Internal server error' }], 'The coupon could not be created. Try again.'], [['html', 502], 'The coupon could not be created. Try again.'], ['offline', 'The coupon could not be created. Try again.'],
    [[401, { error: 'Forbidden' }], 'Your session has ended. Sign in again, then try once more.'], [[403, { error: 'Forbidden' }], 'This account is not allowed to do that.'],
    [['html', 401], 'Your session has ended. Sign in again, then try once more.'], [['html', 400], 'The coupon could not be created. Try again.'],
  ]) {
    view = make({ server: makeServer({ 'POST /api/admin/coupons': reply }) }); await view.settle()
    newButton(view.render()).props.onClick(); tree = view.render()
    typeInto(tree, 'code', 'dupe'); typeInto(view.render(), 'value', '5'); tree = view.render()
    await submit(tree); tree = await view.settle()
    deepEq(alerts(tree), [expected], `${tag}: a failed create (${JSON.stringify(reply)}) says: ${expected}`)
    eq(ofType(tree, 'form').length, 1, `${tag}: and the form stays`)
    eq(input(tree, 'code').props.value, 'DUPE', `${tag}: with what was typed`)
    eq(button(tree, /^Create coupon$/).props.disabled, false, `${tag}: Create is back`)
    eq(view.server.log.length, 2, `${tag}: and the list is not read again`)
    eq(view.pushes.length, 0, `${tag}: no redirect`)
    eq(alerts(tree).length, 1, `${tag}: one message`)
    eq(nodes(tree).find(n => n.type === 'p' && n.props.role === 'alert').props.className, 'sa-error', `${tag}: in the form's error style`)
  }
  view = make({ server: makeServer({ 'POST /api/admin/coupons': n => n === 1 ? [409, { error: 'A coupon with this code already exists' }] : 'hold' }) }); await view.settle()
  newButton(view.render()).props.onClick(); tree = view.render(); typeInto(tree, 'code', 'twice'); typeInto(view.render(), 'value', '5'); await submit(view.render()); tree = await view.settle()
  eq(alerts(tree).length, 1, `${tag}: a refused create is shown`)
  const retrying = submit(view.render()); tree = view.render()
  deepEq(alerts(tree), [], `${tag}: and a new try clears it at once, not when it is done`)
  view.server.release(); await retrying; await view.settle()
  view = make({ server: makeServer({ 'POST /api/admin/coupons': n => n === 1 ? [409, { error: 'A coupon with this code already exists' }] : 'ok' }) }); await view.settle()
  newButton(view.render()).props.onClick(); tree = view.render(); typeInto(tree, 'code', 'twice'); typeInto(view.render(), 'value', '5'); await submit(view.render()); await view.settle(); await submit(view.render()); tree = await view.settle()
  deepEq(alerts(tree), [], `${tag}: a second try clears the old message`)
  eq(ofType(tree, 'form').length, 0, `${tag}: and works`)
  // switching a coupon on or off
  view = make(); await view.settle()
  tree = view.render()
  const flip = buttonsOf(tree).find(n => label(n) === 'Disable WELCOME50').props.onClick()
  tree = view.render()
  const switching = buttonsOf(tree).find(n => label(n) === 'Disable WELCOME50')
  eq(switching.props.disabled, true, `${tag}: the switch is off while it works`)
  eq(switching.props['aria-busy'], true, `${tag}: and busy`)
  eq(buttonsOf(tree).filter(n => n.props.disabled).length, 1, `${tag}: only that one`)
  await flip; tree = await view.settle()
  deepEq(view.server.log.slice(1).map(c => [c.method, c.url, c.init && c.init.body, c.init && c.init.headers]), [['PATCH', '/api/admin/coupons/c1', JSON.stringify({ active: false }), { 'Content-Type': 'application/json' }], ['GET', '/api/admin/coupons', undefined, undefined]], `${tag}: Disable patches {active:false}, then reads again`)
  eq(lineOf(rowsOf(tree)[0]), 'WELCOME50 Inactive $50.00 Starter', `${tag}: the row is inactive`)
  deepEq(ofType(tree, 'dd').map(text), ['5', '3', '145'], `${tag}: and the active count fell`)
  await buttonsOf(tree).find(n => label(n) === 'Enable PARTNER-DEMO').props.onClick(); tree = await view.settle()
  deepEq(view.server.log.slice(-2).map(c => [c.method, c.url, c.init && c.init.body]), [['PATCH', '/api/admin/coupons/c5', JSON.stringify({ active: true })], ['GET', '/api/admin/coupons', undefined]], `${tag}: Enable patches {active:true}`)
  for (const [reply, expected] of [
    [[500, { error: 'Internal server error' }], 'Could not disable WELCOME50. Try again.'], [['html', 502], 'Could not disable WELCOME50. Try again.'], ['offline', 'Could not disable WELCOME50. Try again.'],
    [[404, { error: 'Coupon not found' }], 'Coupon not found'], [[401, {}], 'Your session has ended. Sign in again, then try once more.'], [[403, { error: 'Forbidden' }], 'This account is not allowed to do that.'],
    [['html', 401], 'Your session has ended. Sign in again, then try once more.'], [['html', 404], 'Could not disable WELCOME50. Try again.'],
  ]) {
    view = make({ server: makeServer({ 'PATCH /api/admin/coupons/:id': reply }) }); await view.settle()
    await buttonsOf(view.render()).find(n => label(n) === 'Disable WELCOME50').props.onClick(); tree = await view.settle()
    deepEq(alerts(tree), [expected], `${tag}: a failed switch (${JSON.stringify(reply)}) says: ${expected}`)
    eq(view.server.log.length, 2, `${tag}: and the list is not read again`)
    eq(lineOf(rowsOf(tree)[0]), 'WELCOME50 Active $50.00 Starter', `${tag}: the row is as it was`)
    eq(ofType(tree, 'button').filter(n => n.props.disabled).length, 0, `${tag}: the switch is back`)
    eq(states(tree), 'ready', `${tag}: and the page is still the page`)
  }
  view = make({ server: makeServer({ 'PATCH /api/admin/coupons/:id': n => n === 1 ? [500, {}] : 'hold' }) }); await view.settle()
  await buttonsOf(view.render()).find(n => label(n) === 'Disable WELCOME50').props.onClick(); tree = await view.settle()
  eq(alerts(tree).length, 1, `${tag}: a failed switch is shown`)
  const flipping = buttonsOf(view.render()).find(n => label(n) === 'Disable WELCOME50').props.onClick(); tree = view.render()
  deepEq(alerts(tree), [], `${tag}: and a new try clears it at once, not when it is done`)
  view.server.release(); await flipping; await view.settle()
  view = make({ server: makeServer({ 'PATCH /api/admin/coupons/:id': n => n === 1 ? [500, {}] : 'ok' }) }); await view.settle()
  await buttonsOf(view.render()).find(n => label(n) === 'Disable WELCOME50').props.onClick(); await view.settle()
  await buttonsOf(view.render()).find(n => label(n) === 'Disable WELCOME50').props.onClick(); tree = await view.settle()
  deepEq(alerts(tree), [], `${tag}: a later success clears the message`)
  // copying
  view = make(); tree = await view.settle()
  const copying = buttonsOf(tree).find(n => label(n) === 'Copy WELCOME50').props.onClick()
  await copying; tree = view.render()
  deepEq(view.written, ['WELCOME50'], `${tag}: the code is copied`)
  deepEq(ofType(tree, 'span').filter(n => n.props.className === 'sa-copied').map(text), ['Copied'], `${tag}: and the row says Copied`)
  eq(ofType(tree, 'span').find(n => n.props.className === 'sa-copied').props.role, 'status', `${tag}: announced`)
  eq(ofType(buttonsOf(tree).find(n => label(n) === 'Copy WELCOME50'), 'Check').length, 1, `${tag}: with a tick`)
  eq(ofType(buttonsOf(tree).find(n => label(n) === 'Copy LAUNCHWEEK'), 'Copy').length, 1, `${tag}: only on that row`)
  deepEq(view.timers.map(t => t.ms), [2000], `${tag}: for two seconds`)
  view.timers[0].fn(); tree = view.render()
  eq(ofType(tree, 'span').filter(n => n.props.className === 'sa-copied').length, 0, `${tag}: then it goes`)
  await buttonsOf(tree).find(n => label(n) === 'Copy WELCOME50').props.onClick(); await buttonsOf(view.render()).find(n => label(n) === 'Copy LAUNCHWEEK').props.onClick(); tree = view.render()
  deepEq(ofType(tree, 'span').filter(n => n.props.className === 'sa-copied').length, 1, `${tag}: one Copied at a time`)
  eq(view.timers[1].cleared, true, `${tag}: a second copy cancels the first timer`)
  view.unmount()
  eq(view.timers.at(-1).cleared, true, `${tag}: leaving the page cancels the timer`)
  for (const mode of ['denied', 'missing']) {
    view = make({ clipboard: mode }); tree = await view.settle()
    await buttonsOf(tree).find(n => label(n) === 'Copy WELCOME50').props.onClick(); tree = view.render()
    deepEq(alerts(tree), ['Could not copy WELCOME50. Select the code and copy it by hand.'], `${tag}: ${mode} clipboard: says so`)
    eq(ofType(tree, 'span').filter(n => n.props.className === 'sa-copied').length, 0, `${tag}: ${mode} clipboard: no Copied`)
    eq(view.timers.length, 0, `${tag}: ${mode} clipboard: no timer`)
  }
  view = make({ clipboard: 'denied' }); tree = await view.settle()
  await buttonsOf(tree).find(n => label(n) === 'Copy WELCOME50').props.onClick(); tree = view.render()
  eq(alerts(tree).length, 1, `${tag}: a failed copy is shown`)
  view.clip.mode = 'ok'
  await buttonsOf(tree).find(n => label(n) === 'Copy WELCOME50').props.onClick(); tree = view.render()
  eq(alerts(tree).length, 0, `${tag}: and a copy that works clears it`)
  eq(ofType(tree, 'span').filter(n => n.props.className === 'sa-copied').length, 1, `${tag}: and says Copied`)
  view = make(); tree = await view.settle()
  await buttonsOf(tree).find(n => label(n) === 'Copy WELCOME50').props.onClick(); tree = view.render()
  eq(alerts(tree).length, 0, `${tag}: a copy that works shows no message`)
  // refresh
  view = make({ server: makeServer({ 'GET /api/admin/coupons': n => n === 2 ? 'hold' : 'ok' }) }); tree = await view.settle()
  eq(refreshButton(tree).props.disabled, false, `${tag}: Refresh is on at rest`)
  const refreshing = refreshButton(tree).props.onClick(); tree = view.render()
  eq(states(tree), 'ready', `${tag}: refreshing keeps the page (the old one swapped it for a spinner)`)
  eq(codes_of(tree).length, 5, `${tag}: and the list`)
  eq(refreshButton(tree).props.disabled, true, `${tag}: Refresh is off while it works`)
  eq(ofType(refreshButton(tree), 'RefreshCw')[0].props.className, 'sa-spinning', `${tag}: and spins`)
  view.server.release(); await refreshing; tree = await view.settle()
  eq(ofType(refreshButton(tree), 'RefreshCw')[0].props.className, undefined, `${tag}: and stops`)
  view = make({ server: makeServer({ 'GET /api/admin/coupons': n => n === 2 ? [500, {}] : 'ok' }) }); await view.settle()
  await refreshButton(view.render()).props.onClick(); tree = await view.settle()
  eq(alerts(tree).length, 1, `${tag}: a failed refresh is said`)
  await refreshButton(view.render()).props.onClick(); tree = await view.settle()
  deepEq(alerts(tree), [], `${tag}: and the next good read clears it`)
  for (const reply of [[500, {}], ['html', 502], 'offline']) {
    view = make({ server: makeServer({ 'GET /api/admin/coupons': n => n === 1 ? 'ok' : reply }) }); await view.settle()
    await refreshButton(view.render()).props.onClick(); tree = await view.settle()
    eq(states(tree), 'ready', `${tag}: a failed refresh (${JSON.stringify(reply)}) leaves the page`)
    eq(codes_of(tree).length, 5, `${tag}: and the last list`)
    deepEq(alerts(tree), ['The list could not be refreshed. What is shown is the last list that loaded.'], `${tag}: and says so`)
  }
  view = make({ server: makeServer({ 'GET /api/admin/coupons': n => n === 1 ? 'ok' : [403, {}] }) }); await view.settle()
  await refreshButton(view.render()).props.onClick(); tree = await view.settle()
  eq(states(tree), 'forbidden', `${tag}: a refresh that is refused is access denied`)
  deepEq(view.pushes, ['/builder'], `${tag}: and sends the person to Studio, as before`)
  // 403, 401, failed
  view = make({ server: makeServer({ 'GET /api/admin/coupons': [403, { error: 'Forbidden' }] }) }); await view.settle(); tree = await view.settle()
  eq(states(tree), 'forbidden', `${tag}: 403: denied`)
  eq(text(nodes(tree).find(n => n.type === 'h1')), 'Access denied', `${tag}: 403: the title`)
  eq(text(linkTo(tree, '/builder')[0]), 'Open Studio', `${tag}: 403: a way to Studio`)
  deepEq(view.pushes, ['/builder'], `${tag}: 403: sent to Studio once, as before`)
  eq(ofType(tree, 'header', 'nav', 'dl', 'ul', 'form').length, 0, `${tag}: 403: no chrome and no data`)
  view = make({ server: makeServer({ 'GET /api/admin/coupons': [401, {}] }) }); await view.settle(); tree = await view.settle()
  eq(states(tree), 'signin', `${tag}: 401: the session ended`)
  eq(linkTo(tree, '/auth/signin?callbackUrl=/admin/coupons').length, 1, `${tag}: 401: a way to sign in that comes back here`)
  deepEq(view.pushes, [], `${tag}: 401: no redirect to Studio`)
  for (const reply of [[500, { error: 'Internal server error' }], [502, null], ['html', 502], [404, {}], 'offline']) {
    view = make({ server: makeServer({ 'GET /api/admin/coupons': n => n === 1 ? reply : 'ok' }) }); await view.settle(); tree = await view.settle()
    eq(states(tree), 'failed', `${tag}: ${JSON.stringify(reply)}: a failed read is a state, not a spinner that never ends`)
    eq(text(nodes(tree).find(n => n.type === 'h1')), 'Coupons could not be loaded', `${tag}: ${JSON.stringify(reply)}: says so`)
    nomatch(text(tree), /Access denied|permission|Loading/, `${tag}: ${JSON.stringify(reply)}: neither "access denied" nor loading`)
    deepEq(view.pushes, [], `${tag}: ${JSON.stringify(reply)}: no redirect`)
    await button(tree, /^Try again$/).props.onClick(); tree = await view.settle()
    eq(states(tree), 'ready', `${tag}: ${JSON.stringify(reply)}: Try again reads again and the page loads`)
    eq(view.server.log.length, 2, `${tag}: ${JSON.stringify(reply)}: exactly one more read`)
  }
  // empty and odd data
  view = make(); view.server.state.coupons = []; tree = await view.settle()
  eq(states(tree), 'ready', `${tag}: no coupons: still the page`)
  eq(text(ofType(tree, 'div').find(n => /sa-empty/.test(n.props.className ?? ''))), 'No coupons yet. Create one to get started.', `${tag}: no coupons: the old words`)
  deepEq(ofType(tree, 'dd').map(text), ['0', '0', '0'], `${tag}: no coupons: zero figures`)
  eq(text(ofType(tree, 'small')[0]), '$0.00 credited', `${tag}: and nothing credited`)
  eq(newButton(tree) !== undefined, true, `${tag}: and New coupon is there`)
  view = make({ server: makeServer({ 'GET /api/admin/coupons': [200, { coupons: null }] }) }); tree = await view.settle()
  eq(states(tree), 'ready', `${tag}: a reply with no list is an empty list`)
  view = make(); view.server.state.coupons = [{ ...coupon('z1', 'ODD', 100, null, null, 0, 'not a date', true, null), createdAt: 'nope' }]; tree = await view.settle()
  deepEq(rowsOf(tree).map(lineOf), ['ODD Active $1.00 No plan'], `${tag}: no tier is named, not crashed on`)
  deepEq(rowsOf(tree).map(metaOf), ['0 redeemed'], `${tag}: an unreadable date is left out, not a crash`)
  // source hygiene
  const ui = codeOf(uiSource ?? SOURCES[UI], UI)
  nomatch(ui, /console\.|localStorage|sessionStorage|alert\(|confirm\(|window\./, `${tag}: no console, storage or dialog`)
}
await proveCoupons(SOURCES[UI], SOURCES[LIB])

// the same clicks send the same requests: the old pages and the new ones run side by side against the same fake backend
function norm(entry) { return [entry.method, entry.url, entry.init?.method ?? null, entry.init?.headers ? JSON.stringify(entry.init.headers) : null, entry.init?.body ?? null] }
async function proveSameRequests(uiSource, libSource, tag = 'requests') {
  const flow = async which => {
    const view = mount(which, { uiSource, libSource })
    let tree = await view.settle()
    if (which.endsWith('users')) {
      await buttonsOf(tree).find(n => text(n) === 'Approve').props.onClick(); tree = await view.settle()
      buttonsOf(tree).find(n => /^Approved/.test(text(n))).props.onClick(); tree = view.render()
      await buttonsOf(tree).find(n => text(n) === 'Revoke').props.onClick(); tree = await view.settle()
    } else {
      buttonsOf(tree).find(n => /^new coupon$/i.test(text(n))).props.onClick(); tree = view.render()
      for (const [id, value] of [['code', 'autumn-20'], ['value', '20'], ['tier', 'pro'], ['maxRedemptions', '50'], ['expiresAt', '2026-12-31T23:59'], ['note', 'Autumn newsletter']]) { typeInto(tree, id, value); tree = view.render() }
      await nodes(tree).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} }); tree = await view.settle()
      await buttonsOf(tree).find(n => text(n) === 'Disable').props.onClick(); tree = await view.settle()
      await buttonsOf(tree).find(n => text(n) === 'Enable').props.onClick(); tree = await view.settle()
    }
    return view.server.log.map(norm)
  }
  for (const page of ['users', 'coupons']) {
    const before = await flow(`legacy-${page}`), after = await flow(page)
    ok(before.length >= 5, `${tag}: the old ${page} page made its requests (${before.length})`)
    deepEq(after, before, `${tag}: the new ${page} page sends the old page's requests, in the same order, with the same bodies`)
  }
}
await proveSameRequests(SOURCES[UI], SOURCES[LIB])

// ---------------------------------------------------------------- 3. the wiring and flag-off identity
const CHILD = { type: 'the-old-page', props: {} }
function proveLayout(source, fileName, page, { element, title }, label = 'layout') {
  const lib = load(SOURCES[LIB], LIB)
  const mod = env => load(source, fileName, { env, deps: { '@/lib/studio-p2-admin': lib } })
  const on = mod({ [FLAG]: 'true' }).default({ children: CHILD })
  eq(on.type, element, `${label} (${page}): the flag on: the new page`)
  eq(Object.keys(on.props).length, 0, `${label} (${page}): with no props`)
  for (const env of [{}, { [FLAG]: 'false' }, { [FLAG]: '' }, { [FLAG]: 'TRUE' }, { [FLAG]: 'True' }, { [FLAG]: '1' }, { [FLAG]: 'true ' }, { [FLAG]: ' true' }, { [FLAG]: 'yes' }, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }]) {
    eq(mod(env).default({ children: CHILD }), CHILD, `${label} (${page}): ${JSON.stringify(env)}: the old page, handed through untouched`)
    deepEq(mod(env).generateMetadata(), {}, `${label} (${page}): ${JSON.stringify(env)}: no title of its own`)
  }
  deepEq(mod({ [FLAG]: 'true' }).generateMetadata(), { title }, `${label} (${page}): the flag on: the page is titled`)
  eq(on === CHILD, false, `${label} (${page}): and it is not the old page`)
  eq(mod({ [FLAG]: 'true' }).default({ children: CHILD }).type !== 'the-old-page', true, `${label} (${page}): the old page is not drawn under it`)
  nomatch(source, /^"use client"|^'use client'/, `${label} (${page}): a server layout`)
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true)
  deepEq(file.statements.filter(ts.isImportDeclaration).map(s => s.moduleSpecifier.text).sort(), ['@/components/admin/studio-p2-admin', '@/lib/studio-p2-admin', 'next', 'react'], `${label} (${page}): imports only the new page, its words and two types`)
  eq(file.statements.filter(ts.isImportDeclaration).filter(s => s.importClause.isTypeOnly).length, 2, `${label} (${page}): two of them type-only`)
  deepEq(file.statements.filter(s => s.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)).map(s => s.name?.text), ['generateMetadata', page === 'users' ? 'AdminUsersLayout' : 'AdminCouponsLayout'], `${label} (${page}): exports its metadata and its layout`)
  const code = codeOf(source, fileName)
  eq((code.match(new RegExp(`process\\.env\\.${FLAG} === "true"`, 'g')) ?? []).length, 2, `${label} (${page}): the flag is read twice (the title and the page), each time for an exact "true"`)
  deepEq([...new Set([...code.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map(m => m[1]))], [FLAG], `${label} (${page}): and no other variable`)
}
const LAYOUTS = [[LAYOUT_USERS, 'users', { element: 'StudioP2AdminUsers', title: 'User management' }], [LAYOUT_COUPONS, 'coupons', { element: 'StudioP2AdminCoupons', title: 'Coupon management' }]]
for (const [file, page, expected] of LAYOUTS) proveLayout(SOURCES[file], file, page, expected)
function proveIdentity(label = 'identity') {
  // nothing the admin pages call or are guarded by is changed: the pages, the admin and redeem routes, the middleware, the session options, the root layout
  for (const rel of [PAGE_USERS, PAGE_COUPONS, 'app/api/admin/users/route.ts', 'app/api/admin/users/approve/route.ts', 'app/api/admin/coupons/route.ts', 'app/api/admin/coupons/[id]/route.ts', 'app/api/admin/cleanup-sessions/route.ts', 'app/api/coupons/redeem/route.ts', 'middleware.ts', 'lib/auth-options.ts', 'app/layout.tsx']) {
    eq(read(rel), baseSource(rel), `${label}: ${rel} is the base commit's file, byte for byte`)
  }
  deepEq(fs.readdirSync(path.join(repoRoot, 'app/admin/users')).sort(), ['layout.tsx', 'page.tsx'], `${label}: app/admin/users holds the page and the layout`)
  deepEq(fs.readdirSync(path.join(repoRoot, 'app/admin/coupons')).sort(), ['layout.tsx', 'page.tsx'], `${label}: app/admin/coupons holds the page and the layout`)
  deepEq(fs.readdirSync(path.join(repoRoot, 'app/admin')).sort(), ['coupons', 'users'], `${label}: and there is no admin layout above them`)
  // the admin guard is still the routes': the middleware matcher does not cover /admin, the routes check the session email
  match(baseSource('middleware.ts'), /matcher: \[/, `${label}: (the base middleware's matcher is read, not changed)`)
  for (const rel of ['app/api/admin/users/route.ts', 'app/api/admin/coupons/route.ts']) match(read(rel), /DEV_BYPASS_EMAIL/, `${label}: ${rel} still checks the signed-in email`)
}
proveIdentity()

// ---------------------------------------------------------------- 4. the CSS
const selectorsOf = css => { const out = []; postcss.parse(css).walkRules(rule => out.push([rule.selector, rule])); return out }
const declsOf = css => { const out = []; postcss.parse(css).walkDecls(decl => out.push(decl)); return out }
const hexToRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
const lum = ([r, g, b]) => { const [x, y, z] = [r, g, b].map(v => v / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); return 0.2126 * x + 0.7152 * y + 0.0722 * z }
const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05) }
const mixBlack = (rgb, pct) => rgb.map(c => Math.round(c * pct / 100)) // color-mix(in srgb, X pct%, #000)
function tokenMap(css, selector, prefix) {
  const rule = selectorsOf(css).find(([sel]) => sel === selector)?.[1]
  return Object.fromEntries((rule?.nodes ?? []).filter(n => n.prop?.startsWith(prefix)).map(n => [n.prop, n.value]))
}
const MARK = '[data-studio-p2-admin="true"]', DARK = '.dark [data-studio-p2-admin="true"]'
const NAMES = ['--sa-frame', '--sa-panel', '--sa-line', '--sa-text', '--sa-muted', '--sa-accent', '--sa-field', '--sa-soft', '--sa-action', '--sa-action-hover', '--sa-on-action', '--sa-active', '--sa-teal', '--sa-brand', '--sa-on-brand', '--sa-danger', '--sa-danger-soft']
function proveCss(css, label = 'css', ui = SOURCES[UI]) {
  const rules = selectorsOf(css)
  ok(rules.length > 90, `${label}: has its rules (${rules.length})`)
  for (const [, rule] of rules) {
    if (rule.parent?.type === 'atrule' && rule.parent.name === 'keyframes') continue
    for (const part of rule.selectors) ok(part.startsWith(`${MARK} `) || part.startsWith(`${MARK}[`) || part === MARK || part === DARK, `${label}: scoped to the page's marker: ${part}`)
  }
  const light = tokenMap(css, MARK, '--sa-'), dark = tokenMap(css, DARK, '--sa-')
  deepEq(Object.keys(light), NAMES, `${label}: the light tokens`)
  deepEq(Object.keys(dark), NAMES, `${label}: every token has a dark value`)
  // the shell's own palette is the source of the shared tokens
  const shell = read(SHELL_CSS), shellLight = tokenMap(shell, '[data-studio-v4-shell="true"]', '--ss-'), shellDark = tokenMap(shell, '.dark [data-studio-v4-shell="true"]', '--ss-')
  for (const name of ['frame', 'panel', 'line', 'text', 'muted', 'accent', 'field', 'soft', 'action', 'action-hover', 'on-action', 'active', 'teal']) {
    ok(`--ss-${name}` in shellLight, `${label}: the shell has --ss-${name}`)
    eq(light[`--sa-${name}`], shellLight[`--ss-${name}`], `${label}: --sa-${name} is the shell's (light)`)
    eq(dark[`--sa-${name}`], shellDark[`--ss-${name}`], `${label}: --sa-${name} is the shell's (dark)`)
  }
  const profile = read(PROFILE_CSS), profLight = tokenMap(profile, '[data-studio-v4-profile="true"]', '--sp-'), profDark = tokenMap(profile, '.dark [data-studio-v4-profile="true"]', '--sp-')
  eq(light['--sa-danger'], profLight['--sp-danger'], `${label}: danger is the account menu's (light)`)
  eq(light['--sa-danger-soft'], profLight['--sp-danger-soft'], `${label}: and its tint`)
  eq(dark['--sa-danger'], profDark['--sp-danger'], `${label}: danger is the account menu's (dark)`)
  eq(dark['--sa-danger-soft'], profDark['--sp-danger-soft'], `${label}: and its tint`)
  const brand = selectorsOf(shell).filter(([sel]) => sel === '[data-studio-v4-rail] .studio-rail-brand').flatMap(([, rule]) => rule.nodes)
  eq(brand.find(n => n.prop === 'background')?.value, light['--sa-brand'], `${label}: the brand tile is the rail's (light)`)
  eq(brand.find(n => n.prop === 'color')?.value, light['--sa-on-brand'], `${label}: with the rail's ink`)
  eq(dark['--sa-brand'], light['--sa-brand'], `${label}: the rail's tile does not change in dark`)
  eq(dark['--sa-on-brand'], light['--sa-on-brand'], `${label}: nor its ink`)
  const rgb = value => hexToRgb(value.startsWith('color-mix') ? '#' + mixBlack(hexToRgb(value.match(/#[0-9a-f]{6}/i)[0]), 86).map(c => c.toString(16).padStart(2, '0')).join('') : value)
  for (const [mode, t] of [['light', light], ['dark', dark]]) {
    for (const [fg, bg, name, min] of [
      ['--sa-text', '--sa-panel', 'text on a panel', 4.5], ['--sa-text', '--sa-frame', 'text on the frame', 4.5], ['--sa-text', '--sa-soft', 'text on a soft tile', 4.5], ['--sa-text', '--sa-active', 'text on a hovered control', 4.5],
      ['--sa-muted', '--sa-panel', 'muted text on a panel', 4.5], ['--sa-muted', '--sa-frame', 'muted text on the frame (the nav)', 4.5], ['--sa-muted', '--sa-soft', 'muted text on a chip', 4.5],
      ['--sa-muted', '--sa-field', 'a placeholder on a field', 4.5], ['--sa-muted', '--sa-active', 'muted text on a hovered row', 4.5],
      ['--sa-teal', '--sa-panel', 'teal on a panel', 4.5], ['--sa-teal', '--sa-frame', 'the eyebrow on the frame', 4.5], ['--sa-teal', '--sa-active', 'teal on a chosen tint', 4.5], ['--sa-teal', '--sa-soft', 'teal on a soft tile', 4.5],
      ['--sa-on-action', '--sa-action', 'the primary button', 4.5], ['--sa-on-action', '--sa-action-hover', 'the primary button on hover', 4.5],
      ['--sa-danger', '--sa-panel', 'danger text on a panel', 4.5], ['--sa-danger', '--sa-danger-soft', 'a failure message', 4.5],
      ['--sa-accent', '--sa-panel', 'the focus ring on a panel', 3], ['--sa-accent', '--sa-frame', 'the focus ring on the frame', 3], ['--sa-accent', '--sa-field', 'the focus ring on a field', 3],
      ['--sa-on-brand', '--sa-brand', 'the brand tile', 3],
    ]) ok(contrast(rgb(t[fg]), rgb(t[bg])) >= min, `${label}: ${mode}: ${name} is at least ${min}:1 (${contrast(rgb(t[fg]), rgb(t[bg])).toFixed(2)})`)
    ok(contrast(rgb(t['--sa-line']), rgb(t['--sa-panel'])) >= 1.1, `${label}: ${mode}: a panel's hairline shows (${contrast(rgb(t['--sa-line']), rgb(t['--sa-panel'])).toFixed(2)})`)
    ok(contrast(rgb(t['--sa-active']), rgb(t['--sa-panel'])) >= 1.03, `${label}: ${mode}: a pressed filter's tint shows against the panel (${contrast(rgb(t['--sa-active']), rgb(t['--sa-panel'])).toFixed(2)})`)
  }
  eq(light['--sa-frame'], '#e8f0ed', `${label}: the shell's frame colour (light)`)
  eq(dark['--sa-frame'], '#1a2624', `${label}: and dark`)
  for (const decl of declsOf(css)) {
    for (const [, name] of decl.value.matchAll(/var\((--[a-z-]+)/g)) ok(NAMES.includes(name), `${label}: ${decl.prop}: token ${name} exists`)
    if (decl.parent?.selector === MARK || decl.parent?.selector === DARK) continue
    ok(!/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i.test(decl.value), `${label}: no literal colour outside the token blocks (${decl.prop}: ${decl.value})`)
  }
  // every class the page uses has a rule, and every class a rule names is used
  const used = new Set([...ui.matchAll(/\bsa-[a-z-]+/g)].map(m => m[0]).filter(name => name !== 'sa-create-title')) // (the form's title id is not a class)
  const styled = new Set([...css.matchAll(/\.(sa-[a-z-]+)/g)].map(m => m[1]))
  ok(used.size > 40, `${label}: the page uses its classes (${used.size})`)
  for (const name of used) ok(styled.has(name), `${label}: the page's class ${name} has a rule`)
  for (const name of styled) ok(used.has(name), `${label}: the rule for .${name} is for a class the page uses`)
  ok([...ui.matchAll(/className="([^"]+)"/g)].every(m => m[1].split(' ').every(part => /^sa-[a-z-]+$/.test(part))), `${label}: every literal class is the page's own`)
  const decl = (selector, prop, media) => rules.find(([sel, rule]) => sel === `${MARK} ${selector}` && (media ? rule.parent?.type === 'atrule' && rule.parent.params === media : rule.parent?.type === 'root'))?.[1].nodes.find(node => node.prop === prop)?.value
  const rootDecl = (prop, sel = MARK) => rules.find(([s, rule]) => s === sel && rule.parent?.type === 'root')?.[1].nodes.find(n => n.prop === prop)?.value
  eq(rootDecl('min-height'), '100dvh', `${label}: the page fills the window`)
  eq(rootDecl('background'), 'var(--sa-frame)', `${label}: on the frame colour`)
  eq(rootDecl('color'), 'var(--sa-text)', `${label}: in the text colour`)
  eq(rootDecl('font-size'), '13px', `${label}: at the shell's body size`)
  eq(rootDecl('color-scheme'), 'light', `${label}: native controls are light`)
  eq(rootDecl('color-scheme', DARK), 'dark', `${label}: and dark in dark mode (the date picker, the select)`)
  eq(decl('.sa-bar', 'position'), 'sticky', `${label}: the bar stays`)
  eq(decl('.sa-bar', 'background'), 'var(--sa-frame)', `${label}: on the frame colour`)
  eq(decl('.sa-bar-in', 'width'), 'min(1040px, 100%)', `${label}: the content is 1040px at most`)
  eq(decl('.sa-main', 'width'), 'min(1040px, 100%)', `${label}: in the bar and the page`)
  eq(decl('.sa-brand', 'background'), 'var(--sa-brand)', `${label}: the brand tile`)
  eq(decl('.sa-brand', 'width'), '32px', `${label}: is the rail's 32px`)
  eq(decl('.sa-eyebrow', 'font-size'), '10px', `${label}: eyebrow size`)
  eq(decl('.sa-eyebrow', 'letter-spacing'), '.12em', `${label}: eyebrow tracking`)
  eq(decl('.sa-eyebrow', 'color'), 'var(--sa-teal)', `${label}: eyebrow colour`)
  eq(decl('.sa-nav-link[aria-current="page"]', 'color'), 'var(--sa-teal)', `${label}: the current page is teal`)
  eq(decl('.sa-nav-link[aria-current="page"]', 'background'), 'var(--sa-panel)', `${label}: on a panel`)
  eq(decl('.sa-studio', 'height'), '34px', `${label}: Open Studio is the shell's bordered 34px button`)
  eq(decl('.sa-head h1', 'font-size'), '24px', `${label}: title size`)
  eq(decl('.sa-head h1', 'font-weight'), '600', `${label}: title weight`)
  eq(decl('.sa-head h1', 'letter-spacing'), '-.025em', `${label}: title tracking`)
  eq(decl('.sa-head p', 'color'), 'var(--sa-muted)', `${label}: lead colour`)
  eq(decl('.sa-stats', 'grid-template-columns'), 'repeat(3, minmax(0, 1fr))', `${label}: three figures across`)
  eq(decl('.sa-stats > div', 'border-radius'), '12px', `${label}: a tile's radius`)
  eq(decl('.sa-stats dd', 'font-size'), '24px', `${label}: a figure's size`)
  eq(decl('.sa-stats dd', 'font-variant-numeric'), 'tabular-nums', `${label}: figures keep their width`)
  eq(decl('.sa-panel', 'border-radius'), '14px', `${label}: the shell's panel radius`)
  eq(decl('.sa-panel', 'border'), '1px solid var(--sa-line)', `${label}: and hairline`)
  eq(decl('.sa-panel', 'background'), 'var(--sa-panel)', `${label}: on the panel colour`)
  eq(decl('.sa-row + .sa-row', 'border-top'), '1px solid var(--sa-line)', `${label}: rows are separated by a hairline`)
  eq(decl('.sa-avatar', 'border-radius'), '50%', `${label}: a round avatar`)
  eq(decl('.sa-avatar', 'background'), 'var(--sa-soft)', `${label}: on the soft tile (no gradient)`)
  eq(decl('.sa-avatar', 'color'), 'var(--sa-teal)', `${label}: its letter is teal`)
  eq(decl('.sa-chip', 'border-radius'), '999px', `${label}: chips are pills`)
  eq(decl('.sa-chip', 'height'), '20px', `${label}: of one height`)
  eq(decl('.sa-chip[data-tone="ok"]', 'color'), 'var(--sa-teal)', `${label}: an approved / active chip is teal`)
  eq(decl('.sa-chip[data-tone="ok"]', 'background'), 'var(--sa-active)', `${label}: on the tint`)
  eq(decl('.sa-chip[data-tone="wait"]', 'color'), 'var(--sa-text)', `${label}: a pending chip is plain ink`)
  eq(decl('.sa-meta [data-expired="true"]', 'color'), 'var(--sa-danger)', `${label}: an ended expiry is marked`)
  eq(decl('.sa-filter[aria-pressed="true"]', 'background'), 'var(--sa-active)', `${label}: the pressed filter is tinted`)
  eq(decl('.sa-filter[aria-pressed="true"]', 'color'), 'var(--sa-teal)', `${label}: and teal`)
  eq(decl('.sa-btn', 'height'), '34px', `${label}: buttons are 34px`)
  eq(decl('.sa-btn', 'border-radius'), '8px', `${label}: with the shell's 8px radius`)
  eq(decl('.sa-btn[data-primary="true"]', 'background'), 'var(--sa-action)', `${label}: the primary button is ink`)
  eq(decl('.sa-btn[data-primary="true"]', 'color'), 'var(--sa-on-action)', `${label}: with its own ink`)
  eq(decl('.sa-btn[data-primary="true"]:hover:not(:disabled)', 'background'), 'var(--sa-action-hover)', `${label}: and its hover`)
  eq(decl('.sa-btn[data-tone="danger"]', 'color'), 'var(--sa-danger)', `${label}: Revoke is a danger outline, not a solid red`)
  eq(decl('.sa-btn[data-tone="danger"]', 'background'), undefined, `${label}: with no fill`)
  eq(decl('.sa-btn:hover:not(:disabled)', 'background'), 'var(--sa-active)', `${label}: an enabled button has a hover`)
  eq(decl(':is(.sa-btn, .sa-icon-btn):disabled', 'opacity'), '.55', `${label}: a disabled button is dimmed`)
  eq(decl(':is(.sa-btn, .sa-icon-btn):disabled', 'cursor'), 'not-allowed', `${label}: and says so`)
  eq(decl('.sa-icon-btn', 'width'), '34px', `${label}: an icon button is a 34px square`)
  eq(decl(':is(.sa-brand, .sa-nav-link, .sa-studio, .sa-filter, .sa-btn, .sa-icon-btn, .sa-code):focus-visible', 'outline'), '2px solid var(--sa-accent)', `${label}: every control shows keyboard focus`)
  eq(decl(':is(.sa-search input, .sa-field input, .sa-field select):focus-visible', 'outline'), '2px solid var(--sa-accent)', `${label}: and every field`)
  eq(decl('.sa-search input', 'background'), 'var(--sa-field)', `${label}: fields are the field colour`)
  eq(decl('.sa-field :is(input, select)', 'height'), '36px', `${label}: form fields are 36px`)
  eq(decl('.sa-field :is(input, select)', 'border-radius'), '8px', `${label}: with 8px corners`)
  eq(decl('.sa-form', 'grid-template-columns'), 'repeat(2, minmax(0, 1fr))', `${label}: the form has two columns`)
  eq(rules.find(([sel]) => sel === `${MARK} .sa-search input::placeholder, ${MARK} .sa-field input::placeholder`)?.[1].nodes.find(n => n.prop === 'color')?.value, 'var(--sa-muted)', `${label}: a placeholder is muted`)
  eq(rules.find(([sel]) => sel === `${MARK} .sa-search input::placeholder, ${MARK} .sa-field input::placeholder`)?.[1].nodes.find(n => n.prop === 'opacity')?.value, '1', `${label}: at full strength (the browser dims it otherwise)`)
  eq(decl(':is(.sa-notice, .sa-error)', 'color'), 'var(--sa-danger)', `${label}: a failure message is danger ink`)
  eq(decl(':is(.sa-notice, .sa-error)', 'background'), 'var(--sa-danger-soft)', `${label}: on its tint`)
  eq(decl('.sa-empty', 'padding'), '48px 16px', `${label}: an empty list has room`)
  eq(decl('.sa-card', 'border-radius'), '18px', `${label}: the neutral card is the Studio dialog's 18px`)
  eq(decl('.sa-card', 'width'), 'min(420px, 100%)', `${label}: and narrow`)
  eq(decl('.sa-card svg', 'color'), 'var(--sa-danger)', `${label}: its icon is danger`)
  eq(rules.find(([sel]) => sel === `${MARK}[data-state="signin"] .sa-card svg`)?.[1].nodes.find(n => n.prop === 'color')?.value, 'var(--sa-muted)', `${label}: but muted when the session ended`)
  eq(decl('.sa-spin', 'border-top-color'), 'var(--sa-teal)', `${label}: the loader is teal`)
  eq(decl('.sa-spin', 'animation'), 'sa-spin .8s linear infinite', `${label}: and turns`)
  eq(decl('.sa-spinning', 'animation'), 'sa-spin .9s linear infinite', `${label}: a working button's icon turns`)
  match(css, /@keyframes sa-spin \{ to \{ transform: rotate\(360deg\); \} \}/, `${label}: the keyframes exist`)
  match(decl('.sa-code', 'font'), /^700 14px\/1\.4 ui-monospace/, `${label}: the code is set in mono, bold`)
  eq(decl('.sa-row[data-active="false"] .sa-code', 'color'), 'var(--sa-muted)', `${label}: an inactive coupon's code is muted`)
  // the phone
  const PHONE = '(max-width: 640px)'
  eq(decl('.sa-bar-in', 'flex-wrap', PHONE), 'wrap', `${label}: the bar wraps on a phone`)
  eq(decl('.sa-nav', 'order', PHONE), '3', `${label}: the nav takes its own line`)
  eq(decl('.sa-nav', 'width', PHONE), '100%', `${label}: the whole width`)
  eq(decl('.sa-main', 'padding', PHONE), '20px 14px 36px', `${label}: the page's phone padding`)
  eq(decl('.sa-stats', 'grid-template-columns', PHONE), '1fr', `${label}: the figures stack on a phone`)
  eq(decl('.sa-stats > div', 'grid-template-columns', PHONE), '1fr auto', `${label}: label left, number right`)
  eq(decl('.sa-row', 'flex-wrap', PHONE), 'wrap', `${label}: a row wraps on a phone`)
  eq(decl('.sa-row > .sa-btn', 'flex', PHONE), '1 0 100%', `${label}: its action takes the full width below`)
  eq(decl('.sa-tools', 'width', PHONE), '100%', `${label}: the search row is full width`)
  eq(decl('.sa-form', 'grid-template-columns', PHONE), '1fr', `${label}: the form is one column`)
  eq(decl(':is(.sa-btn, .sa-icon-btn, .sa-filter, .sa-nav-link, .sa-studio)', 'min-height', PHONE), '40px', `${label}: bigger targets on a phone`)
  eq(decl('.sa-filter', 'padding', '(max-width: 380px)'), '0 8px', `${label}: the three filters fit a 320px screen`)
  eq(decl(':is(.sa-spinning, .sa-spin)', 'animation', '(prefers-reduced-motion: reduce)'), 'none', `${label}: reduced motion`)
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
  match(block.trimStart(), /^# PASS2 ADMIN \(FRONTEND-1/, `${label}: under its own heading`)
  match(block, /an exact "true" turns it on/, `${label}: says what turns it on`)
  nomatch(block, /exact "true" enables it/, `${label}: without the phrase the onboarding test keys on`)
  match(block, /READ AT BUILD TIME/, `${label}: and that it is read at build time`)
  match(block, /It needs no other flag/, `${label}: and that it needs no other flag`)
  match(block, /nothing here is a\n# permission rule/, `${label}: and that it is not a permission rule`)
  match(block, /Nothing is added that an admin could not do before/, `${label}: and that nothing is added`)
  ok(start < env.indexOf(`${FLAG}=`), `${label}: with its comment above`)
  ok(start > env.indexOf('NEXT_PUBLIC_STUDIO_P2_ONBOARDING='), `${label}: after the onboarding block`)
  eq(env.slice(env.indexOf(`${FLAG}=`)).split('\n')[0], `${FLAG}="false"`, `${label}: the value line`)
}
function provePackage(pkg, label = 'package') {
  eq(JSON.parse(pkg).scripts['test:studio-p2-admin'], 'node scripts/test-studio-p2-admin.mjs', `${label}: registered`)
}
proveEnv(SOURCES[ENV]); provePackage(SOURCES[PKG])

// ---------------------------------------------------------------- 6. mutation check
const MUTANTS = []
const mutant = (file, name, from, to) => MUTANTS.push([file, name, from, to])
// lib: the flag, routes, requests
mutant(LIB, 'any truthy value turns it on', "return value === 'true'", "return Boolean(value)")
mutant(LIB, 'TRUE turns it on', "return value === 'true'", "return value === 'true' || value === 'TRUE'")
mutant(LIB, 'Studio is the dashboard', "studio: '/builder'", "studio: '/dashboard'")
mutant(LIB, 'users sign-in comes back to coupons', "users: '/auth/signin?callbackUrl=/admin/users'", "users: '/auth/signin?callbackUrl=/admin/coupons'")
mutant(LIB, 'coupons sign-in without a way back', "coupons: '/auth/signin?callbackUrl=/admin/coupons'", "coupons: '/auth/signin'")
mutant(LIB, 'users route', "users: '/api/admin/users',\n  approve", "users: '/api/admin/user',\n  approve")
mutant(LIB, 'approve route', "approve: '/api/admin/users/approve'", "approve: '/api/admin/users/approval'")
mutant(LIB, 'coupons route', "coupons: '/api/admin/coupons',\n  coupon:", "coupons: '/api/admin/coupon',\n  coupon:")
mutant(LIB, 'coupon route', "coupon: (id: string) => `/api/admin/coupons/${id}`", "coupon: (id: string) => `/api/admin/coupons?id=${id}`")
mutant(LIB, 'nav order', "{ id: 'users', label: 'Users', href: STUDIO_P2_ADMIN_ROUTES.users },\n  { id: 'coupons', label: 'Coupons', href: STUDIO_P2_ADMIN_ROUTES.coupons },", "{ id: 'coupons', label: 'Coupons', href: STUDIO_P2_ADMIN_ROUTES.coupons },\n  { id: 'users', label: 'Users', href: STUDIO_P2_ADMIN_ROUTES.users },")
mutant(LIB, 'nav word', "label: 'Coupons', href: STUDIO_P2_ADMIN_ROUTES.coupons }", "label: 'Coupon', href: STUDIO_P2_ADMIN_ROUTES.coupons }")
mutant(LIB, 'approve is a PUT', "return { method: 'POST', headers: { ...JSON_HEADERS }, body: JSON.stringify({ userId, approved }) }", "return { method: 'PUT', headers: { ...JSON_HEADERS }, body: JSON.stringify({ userId, approved }) }")
mutant(LIB, 'approve sends the opposite', "body: JSON.stringify({ userId, approved }) }", "body: JSON.stringify({ userId, approved: !approved }) }")
mutant(LIB, 'approve sends no user', "body: JSON.stringify({ userId, approved }) }", "body: JSON.stringify({ approved }) }")
mutant(LIB, 'headers dropped', "const JSON_HEADERS = { 'Content-Type': 'application/json' }", "const JSON_HEADERS = {}")
mutant(LIB, 'toggle is a PUT', "return { method: 'PATCH', headers: { ...JSON_HEADERS }, body: JSON.stringify({ active: !active }) }", "return { method: 'PUT', headers: { ...JSON_HEADERS }, body: JSON.stringify({ active: !active }) }")
mutant(LIB, 'toggle does not flip', "body: JSON.stringify({ active: !active }) }", "body: JSON.stringify({ active }) }")
mutant(LIB, 'value rounds down', "valueCents: Math.round(parseFloat(form.valueDollars) * 100),", "valueCents: Math.floor(parseFloat(form.valueDollars) * 100),")
mutant(LIB, 'value in dollars', "valueCents: Math.round(parseFloat(form.valueDollars) * 100),", "valueCents: parseFloat(form.valueDollars),")
mutant(LIB, 'max as Number', "maxRedemptions: form.maxRedemptions ? parseInt(form.maxRedemptions) : null,", "maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,")
mutant(LIB, 'blank max is zero', "maxRedemptions: form.maxRedemptions ? parseInt(form.maxRedemptions) : null,", "maxRedemptions: parseInt(form.maxRedemptions) || 0,")
mutant(LIB, 'blank expiry is empty text', "expiresAt: form.expiresAt || null,", "expiresAt: form.expiresAt,")
mutant(LIB, 'blank note is empty text', "note: form.note || null,", "note: form.note,")
mutant(LIB, 'tier dropped from the body', "    tier: form.tier,\n    maxRedemptions", "    maxRedemptions")
mutant(LIB, 'code lower-cased', "code: form.code,\n    valueCents", "code: form.code.toLowerCase(),\n    valueCents")
mutant(LIB, 'create is a PUT', "return { method: 'POST', headers: { ...JSON_HEADERS }, body: JSON.stringify(studioP2AdminCouponBody(form)) }", "return { method: 'PUT', headers: { ...JSON_HEADERS }, body: JSON.stringify(studioP2AdminCouponBody(form)) }")
mutant(LIB, 'a new form starts on Pro', "tier: 'starter', maxRedemptions: '', expiresAt: '', note: '' }", "tier: 'pro', maxRedemptions: '', expiresAt: '', note: '' }")
// lib: what a read and a failure mean
mutant(LIB, '3xx is a good read', "if (status >= 200 && status < 300) return 'ready'", "if (status >= 200 && status < 400) return 'ready'")
mutant(LIB, '299 is not a good read', "if (status >= 200 && status < 300) return 'ready'", "if (status >= 200 && status < 299) return 'ready'")
mutant(LIB, '401 is access denied', "if (status === 401) return 'signin'", "if (status === 401) return 'forbidden'")
mutant(LIB, 'every 4xx is access denied', "if (status === 403) return 'forbidden'\n  return 'failed'\n}\n\n/** The rows", "if (status >= 400 && status < 500) return 'forbidden'\n  return 'failed'\n}\n\n/** The rows")
mutant(LIB, 'every failure is access denied (the old users page)', "if (status === 403) return 'forbidden'\n  return 'failed'\n}\n\n/** The rows", "return 'forbidden'\n}\n\n/** The rows")
mutant(LIB, 'a 403 read is a failed read', "if (status === 403) return 'forbidden'\n  return 'failed'\n}\n\n/** The rows", "return 'failed'\n}\n\n/** The rows")
mutant(LIB, 'no status is ready', "if (typeof status !== 'number' || !Number.isFinite(status)) return 'failed'\n  if (status >= 200", "if (typeof status !== 'number' || !Number.isFinite(status)) return 'ready'\n  if (status >= 200")
mutant(LIB, 'a non-array is rows', "return Array.isArray(rows) ? (rows as T[]) : []", "return (rows as T[]) ?? []")
mutant(LIB, 'the wrong key is read', "const rows = data && typeof data === 'object' ? (data as Record<string, unknown>)[key] : undefined", "const rows = data && typeof data === 'object' ? (data as Record<string, unknown>)['users'] : undefined")
mutant(LIB, 'a 5xx is a refusal', "if (status >= 400 && status < 500) return 'rejected'", "if (status >= 400 && status < 600) return 'rejected'")
mutant(LIB, '401 is forbidden', "if (status === 401) return 'session'", "if (status === 401) return 'forbidden'")
mutant(LIB, '403 is a session end', "if (status === 403) return 'forbidden'\n  if (status >= 400 && status < 500)", "if (status === 403) return 'session'\n  if (status >= 400 && status < 500)")
mutant(LIB, 'session words', "session: 'Your session has ended. Sign in again, then try once more.'", "session: 'Unauthorized'")
mutant(LIB, 'forbidden words', "forbidden: 'This account is not allowed to do that.'", "forbidden: 'Forbidden'")
mutant(LIB, 'the raw 5xx words are shown', "if (kind === 'rejected' && typeof own === 'string') {", "if (kind !== 'session' && kind !== 'forbidden' && typeof own === 'string') {")
mutant(LIB, 'a long reply is shown', "said.length <= 200", "said.length <= 20000")
mutant(LIB, 'a reply with no letters is shown', " && /[A-Za-z]/.test(said)", "")
mutant(LIB, 'html is shown', " && !said.startsWith('<')", "")
mutant(LIB, 'the reply is not trimmed', "const said = own.trim()", "const said = own")
mutant(LIB, 'approve failure words', "${approved ? 'Could not approve' : 'Could not revoke'} ${name}. Try again.", "${approved ? 'Could not approve' : 'Could not approve'} ${name}. Try again.")
mutant(LIB, 'toggle failure words', "Could not ${active ? 'disable' : 'enable'} ${code}. Try again.", "Could not ${active ? 'enable' : 'disable'} ${code}. Try again.")
mutant(LIB, 'create failure words', "'The coupon could not be created. Try again.'", "'Failed to create coupon'")
mutant(LIB, 'copy failure words', "Could not copy ${code}. Select the code and copy it by hand.", "Copy failed")
// lib: users
mutant(LIB, 'filters order', "['all', 'pending', 'approved']", "['pending', 'approved', 'all']")
mutant(LIB, 'the default filter', "STUDIO_P2_ADMIN_DEFAULT_FILTER: StudioP2AdminUserFilter = 'pending'", "STUDIO_P2_ADMIN_DEFAULT_FILTER: StudioP2AdminUserFilter = 'all'")
mutant(LIB, 'filter names', "{ all: 'All', pending: 'Pending', approved: 'Approved' }", "{ all: 'Everyone', pending: 'Pending', approved: 'Approved' }")
mutant(LIB, 'pending shows the approved', "if (filter === 'pending') rows = rows.filter(user => !user.approved)", "if (filter === 'pending') rows = rows.filter(user => user.approved)")
mutant(LIB, 'approved shows the pending', "else if (filter === 'approved') rows = rows.filter(user => user.approved)", "else if (filter === 'approved') rows = rows.filter(user => !user.approved)")
mutant(LIB, 'the search is not trimmed', "const needle = query.trim().toLowerCase()\n  if (needle) rows", "const needle = query.toLowerCase()\n  if (needle) rows")
mutant(LIB, 'the search is case-sensitive', "const needle = query.trim().toLowerCase()\n  if (needle) rows", "const needle = query.trim()\n  if (needle) rows")
mutant(LIB, 'the search skips emails', "(user.email ?? '').toLowerCase().includes(needle) || (user.name ?? '')", "(user.name ?? '')")
mutant(LIB, 'the search skips names', "|| (user.name ?? '').toLowerCase().includes(needle))", ")")
mutant(LIB, 'the search matches the start only', "(user.email ?? '').toLowerCase().includes(needle)", "(user.email ?? '').toLowerCase().startsWith(needle)")
mutant(LIB, 'the list is sorted in place', "let rows = users.slice()", "let rows = users as T[]; rows.reverse()")
mutant(LIB, 'pending count', "return { total: users.length, pending: users.length - approved, approved }", "return { total: users.length, pending: users.length - approved + 1, approved }")
mutant(LIB, 'approved count', "const approved = users.filter(user => user.approved).length", "const approved = users.filter(user => !user.approved).length")
mutant(LIB, 'a search with no match', "title: `No users match “${needle}”.`", "title: 'No users found'")
mutant(LIB, 'the search hint', "body: 'Check the spelling, or clear the search.'", "body: ''")
mutant(LIB, 'nobody signed up', "'No users have signed up yet.'", "'No users found'")
mutant(LIB, 'nobody pending', "'No one is waiting for approval.'", "'No users found'")
mutant(LIB, 'nobody pending hint', "'Everyone who has signed up is approved.'", "''")
mutant(LIB, 'nobody approved', "'No users have been approved yet.'", "'No users found'")
mutant(LIB, 'the empty rule order', "if (needle) return { title: `No users match “${needle}”.`, body: 'Check the spelling, or clear the search.' }\n  if (total === 0)", "if (total === 0)")
mutant(LIB, 'nobody at all, filtered', "if (total === 0) return { title: 'No users have signed up yet.'", "if (total === 1) return { title: 'No users have signed up yet.'")
// lib: shared
mutant(LIB, 'premium is called Premium', "return tier === 'premium' ? 'Max' : tier.charAt(0).toUpperCase() + tier.slice(1)", "return tier.charAt(0).toUpperCase() + tier.slice(1)")
mutant(LIB, 'no capital', "tier.charAt(0).toUpperCase() + tier.slice(1)", "tier")
mutant(LIB, 'no plan is Free', "if (typeof tier !== 'string' || tier === '') return 'No plan'", "if (typeof tier !== 'string' || tier === '') return 'Free'")
mutant(LIB, 'initials are lower case', "return source ? source.charAt(0).toUpperCase() : '?'", "return source ? source.charAt(0) : '?'")
mutant(LIB, 'no initial is blank', "return source ? source.charAt(0).toUpperCase() : '?'", "return source ? source.charAt(0).toUpperCase() : ''")
mutant(LIB, 'a blank name wins', "const source = (name && name.trim()) || (email && email.trim()) || ''", "const source = name || email || ''")
mutant(LIB, 'a bad date is a date', "return Number.isNaN(date.getTime()) ? null : date", "return date")
mutant(LIB, 'no date is a date', "if (!value) return null\n  const date", "const date")
mutant(LIB, 'money in dollars', "(typeof cents === 'number' && Number.isFinite(cents) ? cents : 0) / 100).toFixed(2)", "(typeof cents === 'number' && Number.isFinite(cents) ? cents : 0) / 10).toFixed(2)")
mutant(LIB, 'money decimals', ").toFixed(2)}`\n}\n\n// ----", ").toFixed(0)}`\n}\n\n// ----")
mutant(LIB, 'no amount is NaN', "typeof cents === 'number' && Number.isFinite(cents) ? cents : 0", "cents as number")
// lib: coupons
mutant(LIB, 'total of coupons', "total: coupons.length,", "total: coupons.length + 1,")
mutant(LIB, 'active coupons', "active: coupons.filter(coupon => coupon.active).length,", "active: coupons.filter(coupon => !coupon.active).length,")
mutant(LIB, 'redemptions', "redemptions: coupons.reduce((sum, coupon) => sum + coupon.timesRedeemed, 0),", "redemptions: coupons.reduce((sum, coupon) => sum + 1, 0),")
mutant(LIB, 'credited', "creditedCents: coupons.reduce((sum, coupon) => sum + coupon.timesRedeemed * coupon.valueCents, 0),", "creditedCents: coupons.reduce((sum, coupon) => sum + coupon.valueCents, 0),")
mutant(LIB, 'the expiry moment is expired', "const expired = date.getTime() < nowMs", "const expired = date.getTime() <= nowMs")
mutant(LIB, 'everything is expired', "const expired = date.getTime() < nowMs", "const expired = date.getTime() > nowMs - 1e15")
mutant(LIB, 'nothing is expired', "const expired = date.getTime() < nowMs", "const expired = false")
mutant(LIB, 'expiry words', "word: expired ? 'Expired' : 'Expires'", "word: 'Expires'")
mutant(LIB, 'no expiry is a date', "const date = studioP2AdminDate(expiresAt)\n  if (!date) return null", "const date = studioP2AdminDate(expiresAt) ?? new Date(0)")
mutant(LIB, 'redeemed with a limit', "`${times} of ${max} redeemed`", "`${times}/${max}`")
mutant(LIB, 'redeemed without one', ": `${times} redeemed`", ": `${times}`")
mutant(LIB, 'a zero limit is no limit', "typeof max === 'number' ? ", "max ? ")
mutant(LIB, 'copied lasts three seconds', "STUDIO_P2_ADMIN_COPIED_MS = 2000", "STUDIO_P2_ADMIN_COPIED_MS = 3000")
// lib: words
mutant(LIB, 'users title', "usersTitle: 'User management'", "usersTitle: 'User Management'")
mutant(LIB, 'users lead', "usersLead: 'Approve or revoke access to Deckster.'", "usersLead: 'Approve or reject user access to deckster'")
mutant(LIB, 'coupons lead', "couponsLead: 'Create access coupons and switch them on or off.'", "couponsLead: 'Create and manage access coupons'")
mutant(LIB, 'denied title', "deniedTitle: 'Access denied'", "deniedTitle: 'Access Denied'")
mutant(LIB, 'denied body', "deniedBody: 'This account does not have permission to open this page.'", "deniedBody: \"You don't have permission to access this page\"")
mutant(LIB, 'failed body claims access was lost', "failedBody: 'The request did not go through, so nothing is shown. Your access has not changed.'", "failedBody: 'You do not have access.'")
mutant(LIB, 'failed users title', "failedUsersTitle: 'Users could not be loaded'", "failedUsersTitle: 'Access denied'")
mutant(LIB, 'failed coupons title', "failedCouponsTitle: 'Coupons could not be loaded'", "failedCouponsTitle: 'Loading...'")
mutant(LIB, 'refresh failed words', "refreshFailed: 'The list could not be refreshed. What is shown is the last list that loaded.'", "refreshFailed: 'Error'")
mutant(LIB, 'signed out title', "signedOutTitle: 'Your session has ended'", "signedOutTitle: 'Access denied'")
mutant(LIB, 'open Studio words', "openStudio: 'Open Studio'", "openStudio: 'Go to Builder'")
mutant(LIB, 'no name words', "noName: 'No name'", "noName: 'Unknown'")
mutant(LIB, 'retry words', "retry: 'Try again'", "retry: 'Retry'")
mutant(LIB, 'new coupon words', "newCoupon: 'New coupon'", "newCoupon: 'New Coupon'")
mutant(LIB, 'max label', "max: 'Max redemptions (blank = unlimited)'", "max: 'Max Redemptions'")
mutant(LIB, 'search placeholder', "searchPlaceholder: 'Search by email or name'", "searchPlaceholder: 'Search by email or name...'")
mutant(LIB, 'loading words', "loadingUsers: 'Loading users…'", "loadingUsers: 'Loading...'")
mutant(LIB, 'a permission rule slips in', "export function studioP2AdminOn(", "export function isAdmin(email: string) { return email === 'x' }\nexport function studioP2AdminOn(")
mutant(LIB, 'an import slips in', "export function studioP2AdminOn(", "import type { ReactNode } from 'react'\nexport function studioP2AdminOn(")
mutant(LIB, 'a fetch slips in', "export function studioP2AdminOn(", "export const probe = () => fetch('/api/admin/users')\nexport function studioP2AdminOn(")
// ui: the shared state
mutant(UI, 'signed out does not redirect', `if (status === "unauthenticated") router.push(STUDIO_P2_ADMIN_SIGN_IN[page])`, `if (status === "unauthenticated") void 0`)
mutant(UI, 'signed out goes to Studio', `if (status === "unauthenticated") router.push(STUDIO_P2_ADMIN_SIGN_IN[page])`, `if (status === "unauthenticated") router.push(STUDIO_P2_ADMIN_ROUTES.studio)`)
mutant(UI, 'reads before the session is known', `if (status === "authenticated" && !started.current)`, `if (status !== "never" && !started.current)`)
mutant(UI, 'reads on every render', `if (status === "authenticated" && !started.current) { started.current = true; void read() }`, `if (status === "authenticated") { started.current = true; void read() }`)
mutant(UI, 'the first read is a POST', `const response = await fetch(url)\n`, `const response = await fetch(url, { method: "POST" })\n`)
mutant(UI, 'the read is not checked', `outcome = studioP2AdminListOutcome(response.status)`, `outcome = "ready"`)
mutant(UI, 'a failed read is access denied', `catch { outcome = "failed" }`, `catch { outcome = "forbidden" }`)
mutant(UI, 'every failure is access denied', `outcome = studioP2AdminListOutcome(response.status)`, `outcome = studioP2AdminListOutcome(response.status) === "ready" ? "ready" : "forbidden"`)
mutant(UI, 'a failed refresh drops the list', `else if (outcome === "failed" && hasRows.current) setNotice(WORDS.refreshFailed)`, `else if (outcome === "failed" && false) setNotice(WORDS.refreshFailed)`)
mutant(UI, 'a failed refresh says nothing', `else if (outcome === "failed" && hasRows.current) setNotice(WORDS.refreshFailed)`, `else if (outcome === "failed" && hasRows.current) void 0`)
mutant(UI, 'a good read keeps the old message', `setRows(next); setLoad("ready"); setNotice(null) }`, `setRows(next); setLoad("ready") }`)
mutant(UI, 'a good read keeps the old list', `setRows(next); setLoad("ready")`, `setLoad("ready")`)
mutant(UI, 'rows are read from the wrong key', `studioP2AdminRows<Row>(await response.json(), key)`, `studioP2AdminRows<Row>(await response.json(), "users")`)
mutant(UI, 'refreshing never clears', `    setRefreshing(false)\n  }\n\n  useEffect`, `  }\n\n  useEffect`)
mutant(UI, 'refreshing never starts', `    setRefreshing(true)\n    let outcome`, `    let outcome`)
mutant(UI, 'a refused read stays on a spinner', `else setLoad(outcome)\n    setRefreshing(false)`, `else void 0\n    setRefreshing(false)`)
mutant(UI, 'forbidden does not leave', `if (load === "forbidden") router.push(STUDIO_P2_ADMIN_ROUTES.studio)`, `if (load === "forbidden") void 0`)
mutant(UI, 'a failed read leaves', `if (load === "forbidden") router.push(STUDIO_P2_ADMIN_ROUTES.studio)`, `if (load === "forbidden" || load === "failed") router.push(STUDIO_P2_ADMIN_ROUTES.studio)`)
mutant(UI, 'forbidden leaves for the wrong place', `if (load === "forbidden") router.push(STUDIO_P2_ADMIN_ROUTES.studio)`, `if (load === "forbidden") router.push(STUDIO_P2_ADMIN_ROUTES.users)`)
mutant(UI, 'a session ended leaves for Studio', `if (load === "forbidden") router.push(STUDIO_P2_ADMIN_ROUTES.studio)`, `if (load === "forbidden" || load === "signin") router.push(STUDIO_P2_ADMIN_ROUTES.studio)`)
mutant(UI, 'loading shows once the session is known', `if (status === "loading" || load === "loading") return`, `if (status === "loading") return`)
mutant(UI, 'a failed read shows the page', `if (load === "failed") return <Bare`, `if (load === "never") return <Bare`)
mutant(UI, 'the denied card has no way out', `className="sa-btn" data-primary="true">{WORDS.openStudio}</Link></Bare>`, `className="sa-btn" data-primary="true" hidden>{WORDS.openStudio}</Link></Bare>`)
mutant(UI, 'the denied card names the wrong state', `<Bare page={page} state="forbidden"`, `<Bare page={page} state="failed"`)
mutant(UI, 'the denied card is not denied', `state="forbidden" title={WORDS.deniedTitle} body={WORDS.deniedBody}`, `state="forbidden" title={WORDS.failedBody} body={WORDS.deniedBody}`)
mutant(UI, 'the sign-in link goes home', `<Link href={STUDIO_P2_ADMIN_SIGN_IN[page]} className="sa-btn" data-primary="true">{WORDS.signIn}</Link>`, `<Link href="/" className="sa-btn" data-primary="true">{WORDS.signIn}</Link>`)
mutant(UI, 'the failed card says access is denied', `title={failedTitle} body={WORDS.failedBody}`, `title={WORDS.deniedTitle} body={WORDS.failedBody}`)
mutant(UI, 'Try again does nothing', `data-primary="true" disabled={refreshing} onClick={read}>{WORDS.retry}`, `data-primary="true" disabled={refreshing}>{WORDS.retry}`)
mutant(UI, 'Try again is always off', `data-primary="true" disabled={refreshing} onClick={read}>{WORDS.retry}`, `data-primary="true" disabled onClick={read}>{WORDS.retry}`)
mutant(UI, 'the chrome shows while loading', `<Bare page={page} state="loading" body={loadingWords} />`, `<Frame page={page} state="loading"><div className="sa-loading" role="status"><span>{loadingWords}</span></div></Frame>`)
mutant(UI, 'loading has no status role', `<div className="sa-loading" role="status">`, `<div className="sa-loading">`)
mutant(UI, 'the marker is gone', `<div data-studio-p2-admin="true" data-page={page} data-state={state}>\n      <header`, `<div data-page={page} data-state={state}>\n      <header`)
mutant(UI, 'the state is not recorded', `<div data-studio-p2-admin="true" data-page={page} data-state={state}>\n      <header`, `<div data-studio-p2-admin="true" data-page={page}>\n      <header`)
mutant(UI, 'the brand tile is not named', `className="sa-brand" aria-label={WORDS.home}`, `className="sa-brand"`)
mutant(UI, 'the brand goes to Studio', `<Link href="/" className="sa-brand"`, `<Link href="/builder" className="sa-brand"`)
mutant(UI, 'the nav is not named', `<nav className="sa-nav" aria-label={WORDS.navLabel}>`, `<nav className="sa-nav">`)
mutant(UI, 'the current page is not marked', `aria-current={item.id === page ? "page" : undefined}`, `aria-current={undefined}`)
mutant(UI, 'every page is current', `aria-current={item.id === page ? "page" : undefined}`, `aria-current="page"`)
mutant(UI, 'Studio link is missing', `<Link href={STUDIO_P2_ADMIN_ROUTES.studio} className="sa-studio">{WORDS.openStudio}</Link>`, ``)
mutant(UI, 'the nav is not the shared list', `{STUDIO_P2_ADMIN_NAV.map(item =>`, `{STUDIO_P2_ADMIN_NAV.slice(0, 1).map(item =>`)
mutant(UI, 'a stat is dropped', `{item.hint && <small>{item.hint}</small>}`, ``)
mutant(UI, 'the empty state is not announced', `<div className="sa-empty" role="status">`, `<div className="sa-empty">`)
mutant(UI, 'the empty state has no hint', `{body && <> <span>{body}</span></>}`, ``)
// ui: users
mutant(UI, 'users read the coupons route', `useAdminList<StudioP2AdminUser>("users", STUDIO_P2_ADMIN_API.users, "users")`, `useAdminList<StudioP2AdminUser>("users", STUDIO_P2_ADMIN_API.coupons, "users")`)
mutant(UI, 'users page is signed-out for coupons', `useAdminList<StudioP2AdminUser>("users",`, `useAdminList<StudioP2AdminUser>("coupons",`)
mutant(UI, 'the page opens on All', `useState<StudioP2AdminUserFilter>(STUDIO_P2_ADMIN_DEFAULT_FILTER)`, `useState<StudioP2AdminUserFilter>("all")`)
mutant(UI, 'approve posts to the wrong route', `fetch(STUDIO_P2_ADMIN_API.approve, studioP2AdminApproveInit(user.id, approved))`, `fetch(STUDIO_P2_ADMIN_API.users, studioP2AdminApproveInit(user.id, approved))`)
mutant(UI, 'approve always approves', `studioP2AdminApproveInit(user.id, approved))`, `studioP2AdminApproveInit(user.id, true))`)
mutant(UI, 'approve posts the wrong person', `studioP2AdminApproveInit(user.id, approved))`, `studioP2AdminApproveInit(user.email, approved))`)
mutant(UI, 'approve does not read again', `if (response.ok) await list.read()\n      else list.setNotice(studioP2AdminFailureSentence(response.status, await readError(response), studioP2AdminApproveFailure`, `if (response.ok) void 0\n      else list.setNotice(studioP2AdminFailureSentence(response.status, await readError(response), studioP2AdminApproveFailure`)
mutant(UI, 'approve reads again even when it failed', `if (response.ok) await list.read()\n      else list.setNotice(studioP2AdminFailureSentence(response.status, await readError(response), studioP2AdminApproveFailure(user.name || user.email, approved)))`, `await list.read()`)
mutant(UI, 'approve failure is silent', `else list.setNotice(studioP2AdminFailureSentence(response.status, await readError(response), studioP2AdminApproveFailure(user.name || user.email, approved)))`, `else void 0`)
mutant(UI, 'approve failure shows the raw reply', `studioP2AdminFailureSentence(response.status, await readError(response), studioP2AdminApproveFailure(user.name || user.email, approved))`, `String(await readError(response))`)
mutant(UI, 'approve failure names the wrong person', `studioP2AdminApproveFailure(user.name || user.email, approved)))\n    } catch`, `studioP2AdminApproveFailure('someone', approved)))\n    } catch`)
mutant(UI, 'a network failure is silent', `    } catch {\n      list.setNotice(studioP2AdminApproveFailure(user.name || user.email, approved))\n    } finally {\n      setBusyId(null)`, `    } catch {\n    } finally {\n      setBusyId(null)`)
mutant(UI, 'the busy mark stays', `    } finally {\n      setBusyId(null)\n    }`, `    } finally {\n    }`)
mutant(UI, 'a new action keeps the old message', `    setBusyId(user.id)\n    list.setNotice(null)`, `    setBusyId(user.id)`)
mutant(UI, 'the busy mark is never set', `    setBusyId(user.id)\n    list.setNotice(null)`, `    list.setNotice(null)`)
mutant(UI, 'every button is busy', `const busy = busyId === user.id`, `const busy = busyId !== null`)
mutant(UI, 'the busy button is not disabled', `disabled={busy} aria-busy={busy || undefined} aria-label={\`\${user.approved ? WORDS.revoke`, `aria-busy={busy || undefined} aria-label={\`\${user.approved ? WORDS.revoke`)
mutant(UI, 'the busy button is not marked', `disabled={busy} aria-busy={busy || undefined} aria-label={\`\${user.approved ? WORDS.revoke`, `disabled={busy} aria-label={\`\${user.approved ? WORDS.revoke`)
mutant(UI, 'the busy button has no spinner', `{busy ? <RefreshCw className="sa-spinning" aria-hidden="true" /> : user.approved ? <X aria-hidden="true" /> : <Check aria-hidden="true" />}`, `{user.approved ? <X aria-hidden="true" /> : <Check aria-hidden="true" />}`)
mutant(UI, 'the action button is not named', `aria-label={\`\${user.approved ? WORDS.revoke : WORDS.approve} \${user.name || user.email}\`}`, ``)
mutant(UI, 'the action button names the wrong action', `aria-label={\`\${user.approved ? WORDS.revoke : WORDS.approve} \${user.name || user.email}\`}`, `aria-label={\`\${user.approved ? WORDS.approve : WORDS.revoke} \${user.name || user.email}\`}`)
mutant(UI, 'the action flips the wrong way', `onClick={() => decide(user, !user.approved)}`, `onClick={() => decide(user, user.approved)}`)
mutant(UI, 'a pending row shows Revoke', `{user.approved ? WORDS.revoke : WORDS.approve}\n                    </button>`, `{user.approved ? WORDS.approve : WORDS.revoke}\n                    </button>`)
mutant(UI, 'Revoke is a primary button', `data-primary={user.approved ? undefined : "true"} data-tone={user.approved ? "danger" : undefined}`, `data-primary="true" data-tone={user.approved ? "danger" : undefined}`)
mutant(UI, 'Revoke is not a danger button', `data-tone={user.approved ? "danger" : undefined}`, `data-tone={undefined}`)
mutant(UI, 'the filters are not buttons that say so', `type="button" className="sa-filter" aria-pressed={filter === option}`, `type="button" className="sa-filter"`)
mutant(UI, 'the filter does nothing', `onClick={() => setFilter(option)}`, `onClick={() => void 0}`)
mutant(UI, 'the filter counts are wrong', `option === "all" ? counts.total : option === "pending" ? counts.pending : counts.approved`, `option === "all" ? counts.total : option === "pending" ? counts.approved : counts.pending`)
mutant(UI, 'the filter is ignored', `studioP2AdminFilterUsers(list.rows, filter, query)`, `studioP2AdminFilterUsers(list.rows, "all", query)`)
mutant(UI, 'the search is ignored', `studioP2AdminFilterUsers(list.rows, filter, query)`, `studioP2AdminFilterUsers(list.rows, filter, "")`)
mutant(UI, 'the search box does not take typing', `value={query} onChange={event => setQuery(event.target.value)}`, `value={query} onChange={event => void event}`)
mutant(UI, 'the search box is not named', `type="search" aria-label={WORDS.searchLabel} placeholder`, `type="search" placeholder`)
mutant(UI, 'the search box says nothing', `placeholder={WORDS.searchPlaceholder}`, `placeholder=""`)
mutant(UI, 'the refresh is not named', `aria-label={WORDS.refreshUsers} title={WORDS.refreshUsers} disabled={list.refreshing} onClick={list.read}`, `title={WORDS.refreshUsers} disabled={list.refreshing} onClick={list.read}`)
mutant(UI, 'the refresh does nothing', `disabled={list.refreshing} onClick={list.read}><RefreshCw className={list.refreshing ? "sa-spinning" : undefined} aria-hidden="true" /></button>\n          </div>\n        </div>\n        {shown`, `disabled={list.refreshing}><RefreshCw className={list.refreshing ? "sa-spinning" : undefined} aria-hidden="true" /></button>\n          </div>\n        </div>\n        {shown`)
mutant(UI, 'the refresh stays on', `disabled={list.refreshing} onClick={list.read}><RefreshCw className={list.refreshing ? "sa-spinning" : undefined} aria-hidden="true" /></button>\n          </div>\n        </div>\n        {shown`, `onClick={list.read}><RefreshCw className={list.refreshing ? "sa-spinning" : undefined} aria-hidden="true" /></button>\n          </div>\n        </div>\n        {shown`)
mutant(UI, 'the refresh does not spin', `<RefreshCw className={list.refreshing ? "sa-spinning" : undefined} aria-hidden="true" /></button>\n          </div>\n        </div>\n        {shown`, `<RefreshCw aria-hidden="true" /></button>\n          </div>\n        </div>\n        {shown`)
mutant(UI, 'the notice is not announced', `{list.notice && <p className="sa-notice" role="alert">{list.notice}</p>}\n      <Stats items={[{ label: WORDS.statTotalUsers`, `{list.notice && <p className="sa-notice">{list.notice}</p>}\n      <Stats items={[{ label: WORDS.statTotalUsers`)
mutant(UI, 'the notice is never shown', `{list.notice && <p className="sa-notice" role="alert">{list.notice}</p>}\n      <Stats items={[{ label: WORDS.statTotalUsers`, `<Stats items={[{ label: WORDS.statTotalUsers`)
mutant(UI, 'the counts are not the filter-free totals', `{ label: WORDS.statPending, value: counts.pending }, { label: WORDS.statApproved, value: counts.approved }`, `{ label: WORDS.statPending, value: shown.length }, { label: WORDS.statApproved, value: counts.approved }`)
mutant(UI, 'the empty state is the old one', `<Empty title={empty.title} body={empty.body} />\n          : <ul className="sa-rows">\n              {shown.map`, `<Empty title="No users found" body="" />\n          : <ul className="sa-rows">\n              {shown.map`)
mutant(UI, 'a missing name is blank', `const name = user.name || WORDS.noName`, `const name = user.name ?? ""`)
mutant(UI, 'the avatar photo has a name as alt', `<img src={user.image} alt="" />`, `<img src={user.image} alt={user.name ?? ""} />`)
mutant(UI, 'the avatar is not hidden', `<span className="sa-avatar" aria-hidden="true">`, `<span className="sa-avatar">`)
mutant(UI, 'the photo is not shown', `{user.image ? <img src={user.image} alt="" /> : studioP2AdminInitial(user.name, user.email)}`, `{studioP2AdminInitial(user.name, user.email)}`)
mutant(UI, 'the initial is the email', `studioP2AdminInitial(user.name, user.email)}</span>`, `studioP2AdminInitial(user.email, user.email)}</span>`)
mutant(UI, 'the tier is raw', `<span className="sa-chip">{studioP2AdminTierLabel(user.tier)}</span>\n                      </div>\n                      <span className="sa-email">`, `<span className="sa-chip">{user.tier}</span>\n                      </div>\n                      <span className="sa-email">`)
mutant(UI, 'every user looks approved', `data-tone={user.approved ? "ok" : "wait"}>{user.approved && <Check aria-hidden="true" />}{user.approved ? WORDS.statusApproved : WORDS.statusPending}`, `data-tone="ok">{user.approved && <Check aria-hidden="true" />}{user.approved ? WORDS.statusApproved : WORDS.statusPending}`)
mutant(UI, 'the status is not worded', `{user.approved ? WORDS.statusApproved : WORDS.statusPending}</span>{" "}`, `{user.approved ? WORDS.statusApproved : WORDS.statusApproved}</span>{" "}`)
mutant(UI, 'the signup date is dropped', `{signedUp && \`Signed up \${signedUp}\`}`, ``)
mutant(UI, 'the approval date is dropped', `{approvedOn && \` · Approved \${approvedOn}\`}`, ``)
mutant(UI, 'a bad date throws', `const day = (value: string | null | undefined) => { const date = studioP2AdminDate(value); return date ? format(date, "MMM d, yyyy") : "" }`, `const day = (value: string | null | undefined) => format(new Date(value as string), "MMM d, yyyy")`)
mutant(UI, 'dates are formatted the new way', `format(date, "MMM d, yyyy") : "" }`, `format(date, "yyyy-MM-dd") : "" }`)
mutant(UI, 'the email is dropped', `<span className="sa-email">{user.email}</span>`, `<span className="sa-email"></span>`)
mutant(UI, 'a failed message is read from the wrong place', `const readError = async (response: Response) => { try { return ((await response.json()) as { error?: unknown } | null)?.error } catch { return undefined } }`, `const readError = async (response: Response) => { return await response.json() }`)
mutant(UI, 'an unreadable reply crashes', `catch { return undefined } }`, `catch (error) { throw error } }`)
// ui: coupons
mutant(UI, 'coupons read the users route', `useAdminList<StudioP2AdminCoupon>("coupons", STUDIO_P2_ADMIN_API.coupons, "coupons")`, `useAdminList<StudioP2AdminCoupon>("coupons", STUDIO_P2_ADMIN_API.users, "coupons")`)
mutant(UI, 'create posts to the wrong route', `fetch(STUDIO_P2_ADMIN_API.coupons, studioP2AdminCreateInit(form))`, `fetch(STUDIO_P2_ADMIN_API.users, studioP2AdminCreateInit(form))`)
mutant(UI, 'create sends the empty form', `studioP2AdminCreateInit(form))`, `studioP2AdminCreateInit(STUDIO_P2_ADMIN_EMPTY_FORM))`)
mutant(UI, 'the form reloads the page', `    event.preventDefault()\n    setCreating(true)`, `    setCreating(true)`)
mutant(UI, 'create is not marked busy', `    setCreating(true)\n    setCreateError(null)`, `    setCreateError(null)`)
mutant(UI, 'create keeps the old error', `    setCreating(true)\n    setCreateError(null)`, `    setCreating(true)`)
mutant(UI, 'create never finishes', `    } finally {\n      setCreating(false)\n    }`, `    } finally {\n    }`)
mutant(UI, 'a refused create is silent', `if (!response.ok) { setCreateError(studioP2AdminFailureSentence(response.status, await readError(response), STUDIO_P2_ADMIN_CREATE_FAILURE)); return }`, `if (!response.ok) { return }`)
mutant(UI, 'a refused create closes the form', `if (!response.ok) { setCreateError(studioP2AdminFailureSentence(response.status, await readError(response), STUDIO_P2_ADMIN_CREATE_FAILURE)); return }`, `if (!response.ok) { setCreateError(studioP2AdminFailureSentence(response.status, await readError(response), STUDIO_P2_ADMIN_CREATE_FAILURE)); setShowCreate(false); return }`)
mutant(UI, 'a refused create reads again', `if (!response.ok) { setCreateError(studioP2AdminFailureSentence(response.status, await readError(response), STUDIO_P2_ADMIN_CREATE_FAILURE)); return }`, `if (!response.ok) { setCreateError(studioP2AdminFailureSentence(response.status, await readError(response), STUDIO_P2_ADMIN_CREATE_FAILURE)) }`)
mutant(UI, 'a refused create shows the raw reply', `studioP2AdminFailureSentence(response.status, await readError(response), STUDIO_P2_ADMIN_CREATE_FAILURE)`, `String(await readError(response))`)
mutant(UI, 'a created coupon keeps the form', `      setForm(STUDIO_P2_ADMIN_EMPTY_FORM)\n      setShowCreate(false)\n      await list.read()`, `      await list.read()`)
mutant(UI, 'a created coupon keeps the typing', `      setForm(STUDIO_P2_ADMIN_EMPTY_FORM)\n      setShowCreate(false)`, `      setShowCreate(false)`)
mutant(UI, 'a created coupon does not close the form', `      setForm(STUDIO_P2_ADMIN_EMPTY_FORM)\n      setShowCreate(false)`, `      setForm(STUDIO_P2_ADMIN_EMPTY_FORM)`)
mutant(UI, 'a created coupon is not listed', `      setShowCreate(false)\n      await list.read()`, `      setShowCreate(false)`)
mutant(UI, 'a network failure on create is silent', `    } catch {\n      setCreateError(STUDIO_P2_ADMIN_CREATE_FAILURE)\n    }`, `    } catch {\n    }`)
mutant(UI, 'toggle patches the wrong route', `fetch(STUDIO_P2_ADMIN_API.coupon(coupon.id), studioP2AdminToggleInit(coupon.active))`, `fetch(STUDIO_P2_ADMIN_API.coupons, studioP2AdminToggleInit(coupon.active))`)
mutant(UI, 'toggle patches the wrong coupon', `STUDIO_P2_ADMIN_API.coupon(coupon.id)`, `STUDIO_P2_ADMIN_API.coupon(coupon.code)`)
mutant(UI, 'toggle sends the wrong state', `studioP2AdminToggleInit(coupon.active))`, `studioP2AdminToggleInit(!coupon.active))`)
mutant(UI, 'toggle does not read again', `if (response.ok) await list.read()\n      else list.setNotice(studioP2AdminFailureSentence(response.status, await readError(response), studioP2AdminToggleFailure`, `if (response.ok) void 0\n      else list.setNotice(studioP2AdminFailureSentence(response.status, await readError(response), studioP2AdminToggleFailure`)
mutant(UI, 'toggle failure is silent', `else list.setNotice(studioP2AdminFailureSentence(response.status, await readError(response), studioP2AdminToggleFailure(coupon.code, coupon.active)))`, `else void 0`)
mutant(UI, 'toggle failure names the other word', `studioP2AdminToggleFailure(coupon.code, coupon.active)))\n    } catch`, `studioP2AdminToggleFailure(coupon.code, !coupon.active)))\n    } catch`)
mutant(UI, 'a network failure on toggle is silent', `    } catch {\n      list.setNotice(studioP2AdminToggleFailure(coupon.code, coupon.active))\n    } finally {\n      setTogglingId(null)`, `    } catch {\n    } finally {\n      setTogglingId(null)`)
mutant(UI, 'toggle never finishes', `      setTogglingId(null)\n    }`, `    }`)
mutant(UI, 'toggle keeps the old message', `    setTogglingId(coupon.id)\n    list.setNotice(null)`, `    setTogglingId(coupon.id)`)
mutant(UI, 'every switch is busy', `const busy = togglingId === coupon.id`, `const busy = togglingId !== null`)
mutant(UI, 'the busy switch is not disabled', `<button type="button" className="sa-btn" disabled={busy} aria-busy={busy || undefined} aria-label={\`\${coupon.active ? WORDS.disable`, `<button type="button" className="sa-btn" aria-busy={busy || undefined} aria-label={\`\${coupon.active ? WORDS.disable`)
mutant(UI, 'the switch is not named', `aria-label={\`\${coupon.active ? WORDS.disable : WORDS.enable} \${coupon.code}\`}`, ``)
mutant(UI, 'the switch has the wrong word', `{coupon.active ? WORDS.disable : WORDS.enable}\n                    </button>`, `{coupon.active ? WORDS.enable : WORDS.disable}\n                    </button>`)
mutant(UI, 'copy writes the wrong text', `await navigator.clipboard.writeText(coupon.code)`, `await navigator.clipboard.writeText(coupon.id)`)
mutant(UI, 'copy is not awaited', `await navigator.clipboard.writeText(coupon.code)`, `void navigator.clipboard.writeText(coupon.code)`)
mutant(UI, 'a failed copy says Copied', `      setCopiedId(null)\n      list.setNotice(studioP2AdminCopyFailure(coupon.code))\n      return`, `      setCopiedId(coupon.id)\n      return`)
mutant(UI, 'a failed copy is silent', `      list.setNotice(studioP2AdminCopyFailure(coupon.code))\n      return`, `      return`)
mutant(UI, 'a copy keeps the old message', `  const copy = async (coupon: StudioP2AdminCoupon) => {\n    list.setNotice(null)`, `  const copy = async (coupon: StudioP2AdminCoupon) => {`)
mutant(UI, 'Copied never shows', `    setCopiedId(coupon.id)\n    if (copiedTimer`, `    if (copiedTimer`)
mutant(UI, 'Copied never goes', `copiedTimer.current = setTimeout(() => setCopiedId(null), STUDIO_P2_ADMIN_COPIED_MS)`, `copiedTimer.current = setTimeout(() => void 0, STUDIO_P2_ADMIN_COPIED_MS)`)
mutant(UI, 'Copied goes at once', `setTimeout(() => setCopiedId(null), STUDIO_P2_ADMIN_COPIED_MS)`, `setTimeout(() => setCopiedId(null), 0)`)
mutant(UI, 'the first timer is not cancelled', `    if (copiedTimer.current) clearTimeout(copiedTimer.current)\n    copiedTimer.current = setTimeout`, `    copiedTimer.current = setTimeout`)
mutant(UI, 'the timer outlives the page', `useEffect(() => () => { if (copiedTimer.current) clearTimeout(copiedTimer.current) }, [])`, `useEffect(() => () => {}, [])`)
mutant(UI, 'Copied is not announced', `<span className="sa-copied" role="status">`, `<span className="sa-copied">`)
mutant(UI, 'Copied has no word', `{copied && <><span className="sa-copied" role="status">{WORDS.copied}</span>{" "}</>}`, ``)
mutant(UI, 'every row says Copied', `const copied = copiedId === coupon.id`, `const copied = copiedId !== null`)
mutant(UI, 'the code is not a button that copies', `title={WORDS.copyTitle} aria-label={\`Copy \${coupon.code}\`} onClick={() => copy(coupon)}`, `title={WORDS.copyTitle} aria-label={\`Copy \${coupon.code}\`}`)
mutant(UI, 'the code button is not named', `title={WORDS.copyTitle} aria-label={\`Copy \${coupon.code}\`}`, `title={WORDS.copyTitle}`)
mutant(UI, 'New coupon does nothing', `onClick={() => setShowCreate(!showCreate)}`, `onClick={() => void 0}`)
mutant(UI, 'New coupon only opens', `onClick={() => setShowCreate(!showCreate)}`, `onClick={() => setShowCreate(true)}`)
mutant(UI, 'New coupon does not say it is open', `aria-expanded={showCreate} aria-controls="sa-create"`, `aria-controls="sa-create"`)
mutant(UI, 'New coupon does not say what it opens', `aria-expanded={showCreate} aria-controls="sa-create"`, `aria-expanded={showCreate}`)
mutant(UI, 'the form does not take the keyboard', `useEffect(() => { if (showCreate) codeField.current?.focus() }, [showCreate])`, `useEffect(() => {}, [showCreate])`)
mutant(UI, 'the form takes the keyboard when closed', `if (showCreate) codeField.current?.focus()`, `codeField.current?.focus()`)
mutant(UI, 'the form is not named', `aria-labelledby="sa-create-title"`, ``)
mutant(UI, 'Cancel does nothing', `onClick={() => setShowCreate(false)}>{WORDS.cancel}`, `onClick={() => void 0}>{WORDS.cancel}`)
mutant(UI, 'Cancel clears what was typed', `onClick={() => setShowCreate(false)}>{WORDS.cancel}`, `onClick={() => { setForm(STUDIO_P2_ADMIN_EMPTY_FORM); setShowCreate(false) }}>{WORDS.cancel}`)
mutant(UI, 'the code is not upper-cased', `set("code", event.target.value.toUpperCase())`, `set("code", event.target.value)`)
mutant(UI, 'the code field is not required', `placeholder={WORDS.placeholders.code} required />`, `placeholder={WORDS.placeholders.code} />`)
mutant(UI, 'the value field is not required', `placeholder={WORDS.placeholders.value} required />`, `placeholder={WORDS.placeholders.value} />`)
mutant(UI, 'the value may be zero', `step="0.01" min="0.01"`, `step="0.01" min="0"`)
mutant(UI, 'the value has whole steps', `step="0.01" min="0.01"`, `step="1" min="0.01"`)
mutant(UI, 'the limit may be zero', `id="maxRedemptions" type="number" min="1"`, `id="maxRedemptions" type="number" min="0"`)
mutant(UI, 'the expiry is plain text', `id="expiresAt" type="datetime-local"`, `id="expiresAt" type="text"`)
mutant(UI, 'a field is not wired', `value={form.maxRedemptions} onChange={event => set("maxRedemptions", event.target.value)}`, `value={form.maxRedemptions} onChange={event => set("expiresAt", event.target.value)}`)
mutant(UI, 'the note field is not wired', `onChange={event => set("note", event.target.value)}`, `onChange={event => set("code", event.target.value)}`)
mutant(UI, 'the tier is not wired', `onChange={event => set("tier", event.target.value)}`, `onChange={event => set("note", event.target.value)}`)
mutant(UI, 'a label points nowhere', `<label htmlFor="expiresAt">`, `<label htmlFor="expires">`)
mutant(UI, 'Max is called Premium', `<option value="premium">Max</option>`, `<option value="premium">Premium</option>`)
mutant(UI, 'a tier is missing', `                <option value="pro">Pro</option>\n`, ``)
mutant(UI, 'the form error is not announced', `<p className="sa-error" role="alert">{createError}</p>`, `<p className="sa-error">{createError}</p>`)
mutant(UI, 'the form error is not shown', `{createError && <p className="sa-error" role="alert">{createError}</p>}`, ``)
mutant(UI, 'Create is not disabled while it works', `<button type="submit" className="sa-btn" data-primary="true" disabled={creating}>`, `<button type="submit" className="sa-btn" data-primary="true">`)
mutant(UI, 'Create is not a submit', `<button type="submit" className="sa-btn" data-primary="true" disabled={creating}>`, `<button type="button" className="sa-btn" data-primary="true" disabled={creating}>`)
mutant(UI, 'Create has no spinner', `{creating ? <RefreshCw className="sa-spinning" aria-hidden="true" /> : <Ticket aria-hidden="true" />}`, `<Ticket aria-hidden="true" />`)
mutant(UI, 'the coupon refresh is not named', `aria-label={WORDS.refreshCoupons} title={WORDS.refreshCoupons} disabled={list.refreshing} onClick={list.read}`, `title={WORDS.refreshCoupons} disabled={list.refreshing} onClick={list.read}`)
mutant(UI, 'the coupon refresh does nothing', `disabled={list.refreshing} onClick={list.read}><RefreshCw className={list.refreshing ? "sa-spinning" : undefined} aria-hidden="true" /></button>\n          <button type="button" className="sa-btn"`, `disabled={list.refreshing}><RefreshCw className={list.refreshing ? "sa-spinning" : undefined} aria-hidden="true" /></button>\n          <button type="button" className="sa-btn"`)
mutant(UI, 'the coupon refresh does not spin', `<RefreshCw className={list.refreshing ? "sa-spinning" : undefined} aria-hidden="true" /></button>\n          <button type="button" className="sa-btn"`, `<RefreshCw aria-hidden="true" /></button>\n          <button type="button" className="sa-btn"`)
mutant(UI, 'the credited figure is dropped', `hint: \`\${studioP2AdminMoney(totals.creditedCents)} credited\``, `hint: ""`)
mutant(UI, 'the figures are wrong', `{ label: WORDS.statActive, value: totals.active }`, `{ label: WORDS.statActive, value: totals.total }`)
mutant(UI, 'the empty state is wrong', `<Empty title={WORDS.noCoupons} body="" />`, `<Empty title="" body="" />`)
mutant(UI, 'the tier is raw on a coupon', `<span className="sa-chip">{studioP2AdminTierLabel(coupon.tier)}</span>\n                      </div>`, `<span className="sa-chip">{coupon.tier}</span>\n                      </div>`)
mutant(UI, 'the value is in cents', `<span className="sa-chip">{studioP2AdminMoney(coupon.valueCents)}</span>{" "}`, `<span className="sa-chip">{coupon.valueCents}</span>{" "}`)
mutant(UI, 'an inactive coupon looks active', `data-tone={coupon.active ? "ok" : undefined}>{coupon.active ? WORDS.statusActive : WORDS.statusInactive}`, `data-tone="ok">{coupon.active ? WORDS.statusActive : WORDS.statusInactive}`)
mutant(UI, 'an inactive row is not marked', `data-active={coupon.active ? "true" : "false"}`, `data-active="true"`)
mutant(UI, 'an ended expiry is not marked', `data-expired={expiry.expired ? "true" : undefined}`, `data-expired={undefined}`)
mutant(UI, 'the expiry says Expires', `{expiry.word} {format(expiry.date, "MMM d, yyyy")}`, `Expires {format(expiry.date, "MMM d, yyyy")}`)
mutant(UI, 'the expiry is the creation date', `format(expiry.date, "MMM d, yyyy")}</span>}`, `format(new Date(coupon.createdAt), "MMM d, yyyy")}</span>}`)
mutant(UI, 'the clock is not the clock', `const now = Date.now()`, `const now = 0`)
mutant(UI, 'the note is dropped', `{coupon.note && <span className="sa-note">{coupon.note}</span>}`, ``)
mutant(UI, 'redemptions are dropped', `{studioP2AdminRedeemed(coupon.timesRedeemed, coupon.maxRedemptions)}`, ``)
mutant(UI, 'the creation date is dropped', `{created && \` · Created \${created}\`}`, ``)
// ui: hygiene
mutant(UI, 'a console call', `const day = (value`, `console.log("x")\nconst day = (value`)
mutant(UI, 'a utility class', `<main className="sa-main">`, `<main className="sa-main bg-white">`)
mutant(UI, 'a foreign class', `<span className="sa-eyebrow">`, `<span className="sa-eyebrow text-xs">`)
mutant(UI, 'not a client component', `"use client"\n`, ``)
mutant(UI, 'a dialog', `const day = (value`, `window.alert("x")\nconst day = (value`)
// layouts
const LAYOUT_RULES = [[LAYOUT_USERS, 'users', 'StudioP2AdminUsers', 'usersDocumentTitle', 'AdminUsersLayout'], [LAYOUT_COUPONS, 'coupons', 'StudioP2AdminCoupons', 'couponsDocumentTitle', 'AdminCouponsLayout']]
for (const [file, page, element, titleKey, name] of LAYOUT_RULES) {
  mutant(file, `${page}: any value of the flag turns it on`, `if (process.env.NEXT_PUBLIC_STUDIO_P2_ADMIN === "true") return <${element} />`, `if (process.env.NEXT_PUBLIC_STUDIO_P2_ADMIN !== "false") return <${element} />`)
  mutant(file, `${page}: the flag is never on`, `if (process.env.NEXT_PUBLIC_STUDIO_P2_ADMIN === "true") return <${element} />`, `if (false) return <${element} />`)
  mutant(file, `${page}: the flag is always on`, `if (process.env.NEXT_PUBLIC_STUDIO_P2_ADMIN === "true") return <${element} />`, `if (true) return <${element} />`)
  mutant(file, `${page}: the other flag`, `if (process.env.NEXT_PUBLIC_STUDIO_P2_ADMIN === "true") return <${element} />`, `if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true") return <${element} />`)
  mutant(file, `${page}: the old page is dropped`, `  return children\n}`, `  return null\n}`)
  mutant(file, `${page}: the old page is wrapped`, `  return children\n}`, `  return <div>{children}</div>\n}`)
  mutant(file, `${page}: the new page gets the old one`, `return <${element} />`, `return <${element}>{children}</${element}>`)
  mutant(file, `${page}: a title with the flag off`, `? { title: STUDIO_P2_ADMIN_WORDS.${titleKey} } : {}`, `? { title: STUDIO_P2_ADMIN_WORDS.${titleKey} } : { title: "x" }`)
  mutant(file, `${page}: no title with the flag on`, `? { title: STUDIO_P2_ADMIN_WORDS.${titleKey} } : {}`, `? {} : {}`)
  mutant(file, `${page}: a client layout`, `import type { Metadata } from "next"`, `"use client"\nimport type { Metadata } from "next"`)
  mutant(file, `${page}: a second variable`, `export default function ${name}`, `const probe = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL\nexport default function ${name}`)
}
mutant(LAYOUT_USERS, 'users layout shows the coupons page', `return <StudioP2AdminUsers />`, `return <StudioP2AdminCoupons />`)
mutant(LAYOUT_COUPONS, 'coupons layout shows the users page', `return <StudioP2AdminCoupons />`, `return <StudioP2AdminUsers />`)
mutant(LAYOUT_USERS, 'users title is the coupons one', `STUDIO_P2_ADMIN_WORDS.usersDocumentTitle`, `STUDIO_P2_ADMIN_WORDS.couponsDocumentTitle`)
// css: the tokens
const M = '[data-studio-p2-admin="true"]'
mutant(CSS, 'a token is not the shell\'s: frame', '--sa-frame: #e8f0ed;', '--sa-frame: #eef0ed;')
mutant(CSS, 'a token is not the shell\'s: panel (dark)', '--sa-panel: #1b2426;', '--sa-panel: #1c2527;')
mutant(CSS, 'a token is not the shell\'s: line', '--sa-line: #dde5e2;', '--sa-line: #d0d8d5;')
mutant(CSS, 'a token is not the shell\'s: text (dark)', '--sa-text: #e2ebe8;', '--sa-text: #ffffff;')
mutant(CSS, 'a token is not the shell\'s: accent', '--sa-accent: #6a4fc0;', '--sa-accent: #7a5fd0;')
mutant(CSS, 'a token is not the shell\'s: field', '--sa-field: #f5f7f6;', '--sa-field: #ffffff;')
mutant(CSS, 'a token is not the shell\'s: soft (dark)', '--sa-soft: #243034;', '--sa-soft: #263236;')
mutant(CSS, 'a token is not the shell\'s: action', '--sa-action: #223a3f;', '--sa-action: #203a3f;')
mutant(CSS, 'a token is not the shell\'s: action hover', '--sa-action-hover: color-mix(in srgb, #223a3f 86%, #000);', '--sa-action-hover: color-mix(in srgb, #223a3f 80%, #000);')
mutant(CSS, 'a token is not the shell\'s: active', '--sa-active: #e8f2f0;', '--sa-active: #e8f2f1;')
mutant(CSS, 'a token is not the shell\'s: teal (dark)', '--sa-teal: #83c4bd;', '--sa-teal: #80c4bd;')
mutant(CSS, 'a token is not the account menu\'s: danger', '--sa-danger: #b03f35;', '--sa-danger: #c0392b;')
mutant(CSS, 'a token is not the account menu\'s: danger (dark)', '--sa-danger: #ef9a8f;', '--sa-danger: #ff9a8f;')
mutant(CSS, 'a token is not the account menu\'s: danger tint', '--sa-danger-soft: #fbefed;', '--sa-danger-soft: #fff0ed;')
mutant(CSS, 'the brand tile is not the rail\'s', '--sa-brand: #6a4fc0; --sa-on-brand: #ffffff; --sa-danger: #b03f35;', '--sa-brand: #5a3fb0; --sa-on-brand: #ffffff; --sa-danger: #b03f35;')
mutant(CSS, 'the brand tile changes in dark', '--sa-brand: #6a4fc0; --sa-on-brand: #ffffff; --sa-danger: #ef9a8f;', '--sa-brand: #b4a0f2; --sa-on-brand: #ffffff; --sa-danger: #ef9a8f;')
mutant(CSS, 'a token is missing (dark)', ' --sa-danger-soft: #3b2927;\n', '\n')
mutant(CSS, 'a token is missing (light)', ' --sa-on-brand: #ffffff; --sa-danger: #b03f35;', ' --sa-danger: #b03f35;')
mutant(CSS, 'muted text too faint (light)', '--sa-muted: #566965;', '--sa-muted: #8a9a96;')
mutant(CSS, 'native controls stay light in dark', 'color-scheme: dark;', 'color-scheme: light;')
mutant(CSS, 'native controls are not light', 'color-scheme: light;', 'color-scheme: normal;')
mutant(CSS, 'the page does not fill the window', 'min-height: 100dvh; background: var(--sa-frame); color: var(--sa-text);', 'min-height: 0; background: var(--sa-frame); color: var(--sa-text);')
mutant(CSS, 'the page is not the frame colour', 'min-height: 100dvh; background: var(--sa-frame);', 'min-height: 100dvh; background: var(--sa-panel);')
mutant(CSS, 'the body size', 'color-scheme: light; font-size: 13px; line-height: 1.5;', 'color-scheme: light; font-size: 14px; line-height: 1.5;')
// css: scope and colours
mutant(CSS, 'a rule escapes its scope', `${M} .sa-rows { margin: 0;`, '.sa-rows { margin: 0;')
mutant(CSS, 'a dark rule escapes its scope', `.dark ${M} {\n  --sa-frame`, '.dark body {\n  --sa-frame')
mutant(CSS, 'a literal colour in a rule', `${M} .sa-card h1 { margin: 0;`, `${M} .sa-card h1 { color: #123456; margin: 0;`)
mutant(CSS, 'a literal rgb in a rule', `${M} .sa-empty b { color: var(--sa-text);`, `${M} .sa-empty b { color: rgb(1, 2, 3);`)
mutant(CSS, 'an unknown token', `${M} .sa-empty b { color: var(--sa-text);`, `${M} .sa-empty b { color: var(--sa-ink);`)
mutant(CSS, 'a rule for a class nobody uses', `${M} .sa-rows { margin: 0;`, `${M} .sa-ghost { display: none; }\n${M} .sa-rows { margin: 0;`)
mutant(CSS, 'a used class with no rule', `${M} .sa-copied { font-size: 11px; font-weight: 600; color: var(--sa-teal); }\n`, '')
mutant(CSS, 'the loader has no rule', `${M} .sa-loading { display: flex; align-items: center; gap: 10px; color: var(--sa-muted); font-size: 13px; }\n`, '')
// css: the frame and type
mutant(CSS, 'the bar does not stay', 'position: sticky; top: 0; z-index: 10;', 'position: static; top: 0; z-index: 10;')
mutant(CSS, 'the bar is white', `${M} .sa-bar { position: sticky; top: 0; z-index: 10; border-bottom: 1px solid var(--sa-line); background: var(--sa-frame); }`, `${M} .sa-bar { position: sticky; top: 0; z-index: 10; border-bottom: 1px solid var(--sa-line); background: var(--sa-panel); }`)
mutant(CSS, 'the bar is wide', 'width: min(1040px, 100%); min-height: 52px;', 'width: min(1400px, 100%); min-height: 52px;')
mutant(CSS, 'the page is wide', 'width: min(1040px, 100%); margin: 0 auto; padding: 28px 20px 48px;', 'width: min(1400px, 100%); margin: 0 auto; padding: 28px 20px 48px;')
mutant(CSS, 'the brand tile colour', `${M} .sa-brand { display: grid; flex: none; place-items: center; width: 32px; height: 32px; border-radius: 9px; background: var(--sa-brand);`, `${M} .sa-brand { display: grid; flex: none; place-items: center; width: 32px; height: 32px; border-radius: 9px; background: var(--sa-accent);`)
mutant(CSS, 'the brand tile size', 'place-items: center; width: 32px; height: 32px; border-radius: 9px;', 'place-items: center; width: 40px; height: 32px; border-radius: 9px;')
mutant(CSS, 'eyebrow size', 'font-size: 10px; letter-spacing: .12em;', 'font-size: 12px; letter-spacing: .12em;')
mutant(CSS, 'eyebrow tracking', 'letter-spacing: .12em; text-transform: uppercase; font-weight: 700; color: var(--sa-teal);', 'letter-spacing: 0; text-transform: uppercase; font-weight: 700; color: var(--sa-teal);')
mutant(CSS, 'eyebrow colour', 'font-weight: 700; color: var(--sa-teal); }', 'font-weight: 700; color: var(--sa-muted); }')
mutant(CSS, 'the current page colour', `${M} .sa-nav-link[aria-current="page"] { background: var(--sa-panel); box-shadow: inset 0 0 0 1px var(--sa-line); color: var(--sa-teal); }`, `${M} .sa-nav-link[aria-current="page"] { background: var(--sa-panel); box-shadow: inset 0 0 0 1px var(--sa-line); color: var(--sa-text); }`)
mutant(CSS, 'the current page background', `${M} .sa-nav-link[aria-current="page"] { background: var(--sa-panel);`, `${M} .sa-nav-link[aria-current="page"] { background: var(--sa-soft);`)
mutant(CSS, 'Open Studio height', 'display: inline-flex; align-items: center; height: 34px; margin-left: auto;', 'display: inline-flex; align-items: center; height: 28px; margin-left: auto;')
mutant(CSS, 'title size', `${M} .sa-head h1 { margin: 0; font-size: 24px;`, `${M} .sa-head h1 { margin: 0; font-size: 32px;`)
mutant(CSS, 'title weight', 'font-size: 24px; font-weight: 600; line-height: 1.25; letter-spacing: -.025em; }', 'font-size: 24px; font-weight: 800; line-height: 1.25; letter-spacing: -.025em; }')
mutant(CSS, 'title tracking', 'font-size: 24px; font-weight: 600; line-height: 1.25; letter-spacing: -.025em; }', 'font-size: 24px; font-weight: 600; line-height: 1.25; letter-spacing: 0; }')
mutant(CSS, 'lead colour', `${M} .sa-head p { margin: 4px 0 0; color: var(--sa-muted);`, `${M} .sa-head p { margin: 4px 0 0; color: var(--sa-text);`)
mutant(CSS, 'figures across', 'grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 0; }', 'grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 0; }')
mutant(CSS, 'tile radius', 'padding: 14px 16px; border: 1px solid var(--sa-line); border-radius: 12px;', 'padding: 14px 16px; border: 1px solid var(--sa-line); border-radius: 4px;')
mutant(CSS, 'figure size', `${M} .sa-stats dd { margin: 4px 0 0; font-size: 24px;`, `${M} .sa-stats dd { margin: 4px 0 0; font-size: 16px;`)
mutant(CSS, 'figures jump', 'letter-spacing: -.025em; font-variant-numeric: tabular-nums; }', 'letter-spacing: -.025em; font-variant-numeric: normal; }')
mutant(CSS, 'panel radius', `${M} .sa-panel { overflow: hidden; border: 1px solid var(--sa-line); border-radius: 14px;`, `${M} .sa-panel { overflow: hidden; border: 1px solid var(--sa-line); border-radius: 6px;`)
mutant(CSS, 'panel hairline', `${M} .sa-panel { overflow: hidden; border: 1px solid var(--sa-line);`, `${M} .sa-panel { overflow: hidden; border: 0;`)
mutant(CSS, 'panel colour', 'border-radius: 14px; background: var(--sa-panel); }', 'border-radius: 14px; background: var(--sa-soft); }')
mutant(CSS, 'rows run together', `${M} .sa-row + .sa-row { border-top: 1px solid var(--sa-line); }`, `${M} .sa-row + .sa-row { border-top: 0; }`)
mutant(CSS, 'avatar shape', 'overflow: hidden; border-radius: 50%; background: var(--sa-soft); color: var(--sa-teal);', 'overflow: hidden; border-radius: 6px; background: var(--sa-soft); color: var(--sa-teal);')
mutant(CSS, 'avatar fill', 'overflow: hidden; border-radius: 50%; background: var(--sa-soft); color: var(--sa-teal);', 'overflow: hidden; border-radius: 50%; background: var(--sa-accent); color: var(--sa-teal);')
mutant(CSS, 'avatar letter colour', 'border-radius: 50%; background: var(--sa-soft); color: var(--sa-teal);', 'border-radius: 50%; background: var(--sa-soft); color: var(--sa-accent);')
mutant(CSS, 'chip shape', 'height: 20px; padding: 0 8px; border-radius: 999px;', 'height: 20px; padding: 0 8px; border-radius: 3px;')
mutant(CSS, 'chip height', 'gap: 4px; height: 20px;', 'gap: 4px; height: 26px;')
mutant(CSS, 'ok chip colour', `${M} .sa-chip[data-tone="ok"] { background: var(--sa-active); color: var(--sa-teal); }`, `${M} .sa-chip[data-tone="ok"] { background: var(--sa-active); color: var(--sa-danger); }`)
mutant(CSS, 'ok chip tint', `${M} .sa-chip[data-tone="ok"] { background: var(--sa-active);`, `${M} .sa-chip[data-tone="ok"] { background: var(--sa-soft);`)
mutant(CSS, 'pending chip colour', `${M} .sa-chip[data-tone="wait"] { box-shadow: inset 0 0 0 1px var(--sa-line); color: var(--sa-text); }`, `${M} .sa-chip[data-tone="wait"] { box-shadow: inset 0 0 0 1px var(--sa-line); color: var(--sa-accent); }`)
mutant(CSS, 'ended expiry colour', `${M} .sa-meta [data-expired="true"] { color: var(--sa-danger); }`, `${M} .sa-meta [data-expired="true"] { color: var(--sa-muted); }`)
mutant(CSS, 'pressed filter tint', `${M} .sa-filter[aria-pressed="true"] { border-color: var(--sa-line); background: var(--sa-active); color: var(--sa-teal); }`, `${M} .sa-filter[aria-pressed="true"] { border-color: var(--sa-line); background: var(--sa-soft); color: var(--sa-teal); }`)
mutant(CSS, 'pressed filter colour', `background: var(--sa-active); color: var(--sa-teal); }\n${M} .sa-tools`, `background: var(--sa-active); color: var(--sa-muted); }\n${M} .sa-tools`)
mutant(CSS, 'button height', `${M} .sa-btn { display: inline-flex; flex: none; align-items: center; justify-content: center; gap: 6px; height: 34px;`, `${M} .sa-btn { display: inline-flex; flex: none; align-items: center; justify-content: center; gap: 6px; height: 28px;`)
mutant(CSS, 'button radius', 'height: 34px; padding: 0 12px; border: 1px solid var(--sa-line); border-radius: 8px; background: transparent; color: var(--sa-text); font: inherit;', 'height: 34px; padding: 0 12px; border: 1px solid var(--sa-line); border-radius: 20px; background: transparent; color: var(--sa-text); font: inherit;')
mutant(CSS, 'primary button colour', `${M} .sa-btn[data-primary="true"] { border-color: var(--sa-action); background: var(--sa-action);`, `${M} .sa-btn[data-primary="true"] { border-color: var(--sa-action); background: var(--sa-accent);`)
mutant(CSS, 'primary button ink', 'background: var(--sa-action); color: var(--sa-on-action); }\n', 'background: var(--sa-action); color: var(--sa-text); }\n')
mutant(CSS, 'primary button hover', `${M} .sa-btn[data-primary="true"]:hover:not(:disabled) { background: var(--sa-action-hover); }`, `${M} .sa-btn[data-primary="true"]:hover:not(:disabled) { background: var(--sa-active); }`)
mutant(CSS, 'Revoke colour', `${M} .sa-btn[data-tone="danger"] { color: var(--sa-danger); }`, `${M} .sa-btn[data-tone="danger"] { color: var(--sa-text); }`)
mutant(CSS, 'Revoke is solid red', `${M} .sa-btn[data-tone="danger"] { color: var(--sa-danger); }`, `${M} .sa-btn[data-tone="danger"] { color: var(--sa-danger); background: var(--sa-danger); }`)
mutant(CSS, 'button hover', `${M} .sa-btn:hover:not(:disabled) { background: var(--sa-active); }`, `${M} .sa-btn:hover:not(:disabled) { background: var(--sa-panel); }`)
mutant(CSS, 'disabled look', `${M} :is(.sa-btn, .sa-icon-btn):disabled { opacity: .55; cursor: not-allowed; }`, `${M} :is(.sa-btn, .sa-icon-btn):disabled { opacity: 1; cursor: not-allowed; }`)
mutant(CSS, 'disabled cursor', `${M} :is(.sa-btn, .sa-icon-btn):disabled { opacity: .55; cursor: not-allowed; }`, `${M} :is(.sa-btn, .sa-icon-btn):disabled { opacity: .55; cursor: pointer; }`)
mutant(CSS, 'icon button size', `display: inline-grid; flex: none; place-items: center; width: 34px; height: 34px;`, `display: inline-grid; flex: none; place-items: center; width: 24px; height: 34px;`)
mutant(CSS, 'no focus ring on controls', `.sa-code):focus-visible { outline: 2px solid var(--sa-accent); outline-offset: 2px; }`, `.sa-code):focus-visible { outline: 0; outline-offset: 2px; }`)
mutant(CSS, 'no focus ring on fields', `.sa-field select):focus-visible { outline: 2px solid var(--sa-accent); outline-offset: 1px; }`, `.sa-field select):focus-visible { outline: 0; outline-offset: 1px; }`)
mutant(CSS, 'search field colour', 'padding: 0 12px 0 32px; border: 1px solid var(--sa-line); border-radius: 8px; background: var(--sa-field);', 'padding: 0 12px 0 32px; border: 1px solid var(--sa-line); border-radius: 8px; background: var(--sa-panel);')
mutant(CSS, 'placeholder colour', `${M} .sa-search input::placeholder, ${M} .sa-field input::placeholder { color: var(--sa-muted); opacity: 1; }`, `${M} .sa-search input::placeholder, ${M} .sa-field input::placeholder { color: var(--sa-soft); opacity: 1; }`)
mutant(CSS, 'placeholder strength', `${M} .sa-search input::placeholder, ${M} .sa-field input::placeholder { color: var(--sa-muted); opacity: 1; }`, `${M} .sa-search input::placeholder, ${M} .sa-field input::placeholder { color: var(--sa-muted); opacity: .5; }`)
mutant(CSS, 'failure colour', `${M} :is(.sa-notice, .sa-error) { margin: 0; padding: 10px 14px; border: 1px solid var(--sa-danger); border-radius: 10px; background: var(--sa-danger-soft); color: var(--sa-danger);`, `${M} :is(.sa-notice, .sa-error) { margin: 0; padding: 10px 14px; border: 1px solid var(--sa-danger); border-radius: 10px; background: var(--sa-danger-soft); color: var(--sa-muted);`)
mutant(CSS, 'failure tint', 'border-radius: 10px; background: var(--sa-danger-soft);', 'border-radius: 10px; background: var(--sa-panel);')
mutant(CSS, 'empty room', `${M} .sa-empty { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 48px 16px;`, `${M} .sa-empty { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 4px 16px;`)
mutant(CSS, 'form field height', `${M} .sa-field :is(input, select) { box-sizing: border-box; width: 100%; height: 36px;`, `${M} .sa-field :is(input, select) { box-sizing: border-box; width: 100%; height: 28px;`)
mutant(CSS, 'form field radius', 'height: 36px; padding: 0 12px; border: 1px solid var(--sa-line); border-radius: 8px;', 'height: 36px; padding: 0 12px; border: 1px solid var(--sa-line); border-radius: 0;')
mutant(CSS, 'form columns', `${M} .sa-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));`, `${M} .sa-form { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));`)
mutant(CSS, 'card radius', 'padding: 28px 24px; border: 1px solid var(--sa-line); border-radius: 18px;', 'padding: 28px 24px; border: 1px solid var(--sa-line); border-radius: 4px;')
mutant(CSS, 'card width', 'box-sizing: border-box; width: min(420px, 100%); padding: 28px 24px;', 'box-sizing: border-box; width: min(900px, 100%); padding: 28px 24px;')
mutant(CSS, 'card icon colour', `${M} .sa-card svg { width: 28px; height: 28px; color: var(--sa-danger);`, `${M} .sa-card svg { width: 28px; height: 28px; color: var(--sa-accent);`)
mutant(CSS, 'signed-out icon colour', `${M}[data-state="signin"] .sa-card svg { color: var(--sa-muted); }`, `${M}[data-state="signin"] .sa-card svg { color: var(--sa-danger); }`)
mutant(CSS, 'loader colour', 'border-top-color: var(--sa-teal); border-radius: 50%; animation: sa-spin .8s linear infinite; }', 'border-top-color: var(--sa-accent); border-radius: 50%; animation: sa-spin .8s linear infinite; }')
mutant(CSS, 'loader does not turn', 'border-top-color: var(--sa-teal); border-radius: 50%; animation: sa-spin .8s linear infinite; }', 'border-top-color: var(--sa-teal); border-radius: 50%; }')
mutant(CSS, 'working icon does not turn', `${M} .sa-spinning { animation: sa-spin .9s linear infinite; }`, `${M} .sa-spinning { animation: none; }`)
mutant(CSS, 'keyframes gone', '@keyframes sa-spin { to { transform: rotate(360deg); } }', '@keyframes sa-other { to { transform: rotate(360deg); } }')
mutant(CSS, 'code is not mono', 'font: 700 14px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;', 'font: 700 14px/1.4 system-ui, sans-serif;')
mutant(CSS, 'inactive code is not muted', `${M} .sa-row[data-active="false"] .sa-code { color: var(--sa-muted); }`, `${M} .sa-row[data-active="false"] .sa-code { color: var(--sa-text); }`)
// css: the phone
mutant(CSS, 'the bar does not wrap on a phone', '  [data-studio-p2-admin="true"] .sa-bar-in { flex-wrap: wrap;', '  [data-studio-p2-admin="true"] .sa-bar-in { flex-wrap: nowrap;')
mutant(CSS, 'the nav is not on its own line', '.sa-nav { order: 3; width: 100%; margin-left: 0; }', '.sa-nav { order: 0; width: 100%; margin-left: 0; }')
mutant(CSS, 'the nav is not full width', '.sa-nav { order: 3; width: 100%; margin-left: 0; }', '.sa-nav { order: 3; width: auto; margin-left: 0; }')
mutant(CSS, 'phone page padding', '.sa-main { padding: 20px 14px 36px; }', '.sa-main { padding: 28px 20px 48px; }')
mutant(CSS, 'figures do not stack', '.sa-stats { grid-template-columns: 1fr; gap: 8px; }', '.sa-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }')
mutant(CSS, 'figure tile is not a row', 'display: grid; grid-template-columns: 1fr auto; align-items: baseline;', 'display: grid; grid-template-columns: 1fr; align-items: baseline;')
mutant(CSS, 'rows do not wrap', '.sa-row { flex-wrap: wrap; align-items: flex-start;', '.sa-row { flex-wrap: nowrap; align-items: flex-start;')
mutant(CSS, 'the action is not full width', '.sa-row > .sa-btn { flex: 1 0 100%; }', '.sa-row > .sa-btn { flex: none; }')
mutant(CSS, 'the search row is not full width', '.sa-tools { width: 100%; }', '.sa-tools { width: auto; }')
mutant(CSS, 'the form does not stack', '.sa-form { grid-template-columns: 1fr; }', '.sa-form { grid-template-columns: repeat(2, minmax(0, 1fr)); }')
mutant(CSS, 'phone targets', ':is(.sa-btn, .sa-icon-btn, .sa-filter, .sa-nav-link, .sa-studio) { min-height: 40px; }', ':is(.sa-btn, .sa-icon-btn, .sa-filter, .sa-nav-link, .sa-studio) { min-height: 30px; }')
mutant(CSS, 'narrow filters', '.sa-filter { padding: 0 8px; }', '.sa-filter { padding: 0 12px; }')
mutant(CSS, 'motion is not reduced', ':is(.sa-spinning, .sa-spin) { animation: none; }', ':is(.sa-spinning, .sa-spin) { animation: sa-spin .8s linear infinite; }')
// env + package
mutant(ENV, 'default on', `${FLAG}="false"`, `${FLAG}="true"`)
mutant(ENV, 'the flag is documented twice', `${FLAG}="false"`, `${FLAG}="false"\n${FLAG}="false"`)
mutant(ENV, 'the phrase onboarding keys on', 'an exact "true" turns it on', 'exact "true" enables it')
mutant(ENV, 'exact true not said', 'an exact "true" turns it on', 'any value turns it on')
mutant(ENV, 'build time not mentioned', 'READ AT BUILD TIME: set it on Vercel', 'read whenever: set it on Vercel')
mutant(ENV, 'another flag is required', 'It needs no other flag', 'It needs the Studio shell flag')
mutant(ENV, 'a permission rule is claimed', 'nothing here is a\n# permission rule', 'it is a\n# permission rule')
mutant(ENV, 'a new ability is claimed', 'Nothing is added that an admin could not do before.', 'It adds new admin abilities.')
mutant(ENV, 'the block lost its heading', '# PASS2 ADMIN (FRONTEND-1', '# ADMIN PAGES (FRONTEND-1')
mutant(PKG, 'test registered to another file', 'node scripts/test-studio-p2-admin.mjs', 'node scripts/test-studio-p2-onboarding.mjs')
mutant(PKG, 'test not registered', '"test:studio-p2-admin"', '"test:studio-p2-adminx"')

await new Promise(resolve => setImmediate(resolve))
eq(unhandledRejections, 0, 'the pages leave no rejected promise unhandled')
const missing = MUTANTS.filter(([file, , from]) => !SOURCES[file].includes(from)).map(([file, name]) => `${file}: ${name}`)
assert.deepEqual(missing, [], `the text these mutants replace does not exist:\n  ${missing.join('\n  ')}`)
let killed = 0
const survivors = [], crashed = []
counting = false
const seen = new Set()
for (const [file, name, from, to] of MUTANTS) {
  assert.ok(!seen.has(`${file}\0${name}`), `mutant name "${name}" is unique for ${file}`); seen.add(`${file}\0${name}`)
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
    if (file === LIB) { proveLib(mutated, name); await proveUsers(SOURCES[UI], mutated, name); await proveCoupons(SOURCES[UI], mutated, name); await proveSameRequests(SOURCES[UI], mutated, name) }
    else if (file === UI) { await proveUsers(mutated, SOURCES[LIB], name); await proveCoupons(mutated, SOURCES[LIB], name); await proveSameRequests(mutated, SOURCES[LIB], name); proveCss(SOURCES[CSS], name, mutated) }
    else if (file === LAYOUT_USERS || file === LAYOUT_COUPONS) { const [, page, expected] = LAYOUTS.find(([f]) => f === file); proveLayout(mutated, file, page, expected, name) }
    else if (file === CSS) proveCss(mutated, name)
    else if (file === ENV) proveEnv(mutated, name)
    else if (file === PKG) provePackage(mutated, name)
    survived = true
  } catch (error) { if (error?.code !== 'ERR_ASSERTION') crashed.push(name); killed++ } // a mutant the page cannot survive (it throws) is detected too; it is counted apart
  if (survived) survivors.push(`${file}: ${name}`)
}
counting = true
assert.deepEqual(survivors, [], `mutants survived:\n  ${survivors.join('\n  ')}`)
eq(killed, MUTANTS.length)

console.log(`Studio P2 admin: ${checks} checks passed, ${killed}/${MUTANTS.length} mutants killed (${killed - crashed.length} by an assertion, ${crashed.length} by the code throwing); no network.`)
