// PASS2 Profile page (FRONTEND-1): /settings/profile in the Studio shell's tokens, with every state spoken. There is no mockup for this page.
// Flag NEXT_PUBLIC_STUDIO_P2_PROFILE_PAGE (exact "true"), default off, and it also needs the Studio shell (NEXT_PUBLIC_STUDIO_V4_SHELL "true").
//   The same three things as before: display name, account photo, the way to Billing. No new action. The old page's code is untouched (renamed only).
//   Fixed: the upload control was a camera overlay that appeared on hover only (a phone could not find it); a refused or unreadable reply showed the server's raw words, a JSON parse error or "Failed to fetch";
//   no word after a save; "Loading…" as bare text; a signed-out visitor saw a blank page; the initials circle was a purple-to-blue gradient; Title Case labels; the card's own title never took its shell size.
//
// Run: node scripts/test-studio-p2-profile-page.mjs   (plain node: transpile + vm, no network, no browser, no env)
//   P2_PROFILE_BASE=<commit> overrides the base commit flag-off identity is checked against (default bcd8aed, the studio-v4-dev-preparation-code tip the work started from).
//
// Proven on the REAL sources:
//   1. lib/studio-p2-profile-page.ts: import-free; limits pinned to the profile routes' own; every word; initials, name and photo rules, the failure sentence per status, the saved sentence, the plan badge;
//   2. the component (executed): loading, signed out, ready (free / pro / max / no name), editing, every name outcome (saved, refused, signed out, server fault, unreadable, offline, session not refreshed),
//      every photo outcome (wrong type, empty, too big, saved, refused, server fault, unreadable, offline, no image back, session not refreshed), busy locks, one request per action;
//   3. the page wiring (executed against the base commit's file): flag off, shell off, or any spelling but "true" = the same tree as the base commit's; on = the new page; the old code is the base commit's, renamed only;
//   4. the CSS: every rule scoped to the page's own marker, every marker it names exists in the component, tokens only (each in the shell's light and dark set), reduced motion respected, readable in both themes;
//   5. the flag block in .env.example and the package script;
//   6. mutation check: every mutant of the sources is killed by sections 1-5.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import postcss from 'postcss'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const BASE_COMMIT = process.env.P2_PROFILE_BASE || 'bcd8aed0d0e8d202c8859c4fd45ccae06de8e307'
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

const LIB = 'lib/studio-p2-profile-page.ts'
const UI = 'components/settings/studio-p2-profile-page.tsx'
const CSS = 'components/settings/studio-p2-profile-page.css'
const PAGE = 'app/(app)/settings/profile/page.tsx'
const ROUTE_PROFILE = 'app/api/profile/route.ts'
const ROUTE_AVATAR = 'app/api/profile/avatar/route.ts'
const SHELL_CSS = 'components/layout/studio-shell.css'
const ENV = '.env.example'
const PKG = 'package.json'
const SOURCES = Object.fromEntries([LIB, UI, CSS, PAGE, ENV, PKG].map(rel => [rel, read(rel)]))
const FLAG = 'NEXT_PUBLIC_STUDIO_P2_PROFILE_PAGE'
const SHELL_ON = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }
const ON = { ...SHELL_ON, [FLAG]: 'true' }

// ---------------------------------------------------------------- loading
const jsx = (type, props, key) => ({ type, props: props ?? {}, ...(key === undefined ? {} : { key }) })
const JSX_RUNTIME = { jsx, jsxs: jsx, Fragment: 'Fragment' }
const names = new Proxy({}, { get: (_target, key) => key })
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : value && typeof value === 'object' ? [value, ...nodes(value.props?.children)] : []
const rawText = value => Array.isArray(value) ? value.map(rawText).join(value.every(x => x == null || typeof x !== 'object') ? '' : ' ') : value == null || typeof value === 'boolean' ? '' : typeof value === 'object' ? rawText(value.props?.children) : String(value)
const text = value => rawText(value).replace(/\s+/g, ' ').trim()
const rendered = value => JSON.stringify(value, (key, item) => key === 'children' && Array.isArray(item) ? item.filter(x => x !== false && x !== undefined && x !== null) : typeof item === 'function' ? '[fn]' : item)
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
  const slots = []; let cursor = 0
  return {
    reset() { cursor = 0 },
    api: {
      useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value }] },
      useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
    },
  }
}
const attempt = fn => { try { return fn() } catch (error) { return { threw: String(error) } } } // a mutant that crashes must fail an assertion, not the run
const tick = async () => { for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve)) }

// ---------------------------------------------------------------- 1. the lib
const WORDS = {
  title: 'Profile information',
  lede: 'Your personal details and account information',
  edit: 'Edit profile',
  cancel: 'Cancel',
  save: 'Save',
  saving: 'Saving…',
  changePhoto: 'Change photo',
  uploading: 'Uploading…',
  photoHint: 'JPEG, PNG, WebP, or GIF · up to 5 MB',
  nameLabel: 'Display name',
  nameHelp: 'Your account display name · up to 80 characters',
  namePlaceholder: 'Enter your display name',
  nameUnset: 'Not set',
  emailLabel: 'Email address',
  emailNote: 'Your email is linked to your Google account and cannot be changed here.',
  planTitle: 'Your plan',
  planNote: 'Plan, payment method, and invoices',
  planAction: 'Manage plan',
  loading: 'Loading your profile…',
  signedOutTitle: 'You are signed out',
  signedOutBody: 'Sign in to see and edit your profile.',
  signIn: 'Sign in',
  nameSaved: 'Display name saved.',
  photoSaved: 'Account photo saved.',
  reload: 'Reload to refresh your account session.',
}
const NAME_FAILED = 'Your display name could not be saved. Your edit is still here.'
const PHOTO_FAILED = 'Your account photo could not be uploaded. Try again.'
const SIGNED_OUT_REPLY = 'Your session has ended. Sign in again, then try once more.'
const TOO_BIG = 'Choose an account photo smaller than 5 MB.'
const NAME_PROBLEM = 'Use a display name between 1 and 80 characters.'
const WRONG_TYPE = 'Choose a JPEG, PNG, WebP, or GIF image.'
const EMPTY_IMAGE = 'This image is empty. Choose another file.'
const MB = 1024 * 1024
const routeConst = (source, name) => source.match(new RegExp(`const ${name} = ([^\\n]+)`))?.[1]
function proveLib(source, label = 'lib') {
  nomatch(source, /^\s*import\s/m, `${label}: import-free (the test runs it as plain code)`)
  const L = load(source, LIB)
  // the limits are the routes' own
  const avatarRoute = read(ROUTE_AVATAR), profileRoute = read(ROUTE_PROFILE)
  eq(routeConst(avatarRoute, 'MAX_FILE_SIZE'), '5 * 1024 * 1024 // 5 MB', `${label}: the route's size limit is still 5 MB`)
  deepEq(JSON.parse(routeConst(avatarRoute, 'ALLOWED_TYPES')), ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], `${label}: the route's allowed types`)
  eq(routeConst(profileRoute, 'MAX_NAME_LENGTH'), '80', `${label}: the route's name limit is still 80`)
  eq(L.STUDIO_PROFILE_NAME_MAX, 80, `${label}: name limit equals the route's`)
  eq(L.STUDIO_PROFILE_PHOTO_MAX_BYTES, 5 * MB, `${label}: photo limit equals the route's`)
  deepEq(L.STUDIO_PROFILE_PHOTO_TYPES, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], `${label}: photo types equal the route's (and the old page's file input)`)
  deepEq(L.STUDIO_PROFILE_WORDS, WORDS, `${label}: the words`)
  // initials: the old page's rule for ordinary names, "U" for none
  const legacyInitials = name => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'
  for (const name of ['Ada Morgan', 'ada', 'Ada Lovelace Byron', 'ada  morgan'.replace('  ', ' '), 'Åsa Öberg', 'x', '']) eq(L.studioProfileInitials(name), legacyInitials(name), `${label}: initials of ${JSON.stringify(name)} match the old page's`)
  for (const [name, expected] of [[' Ada  Morgan ', 'AM'], ['\tada\nmorgan', 'AM'], ['   ', 'U'], [null, 'U'], [undefined, 'U'], [42, 'U'], ['Ada Morgan Jr', 'AM'], ['🙂 Ada', '🙂A'], ['élan vital', 'ÉV']]) eq(L.studioProfileInitials(name), expected, `${label}: initials of ${JSON.stringify(name)}`)
  // name
  for (const name of ['A', 'Ada Morgan', '  Ada  ', 'x'.repeat(80), ` ${'x'.repeat(80)} `]) eq(L.studioProfileNameProblem(name), '', `${label}: ${JSON.stringify(name.slice(0, 12))} can be saved`)
  for (const name of ['', '   ', '\n', 'x'.repeat(81), ` ${'x'.repeat(81)} `, null, undefined, 7]) eq(L.studioProfileNameProblem(name), NAME_PROBLEM, `${label}: ${JSON.stringify(String(name).slice(0, 12))} cannot`)
  // photo
  for (const file of [{ type: 'image/png', size: 1 }, { type: 'image/jpeg', size: 5 * MB }, { type: 'image/webp', size: 1234 }, { type: 'image/gif', size: 2 * MB }]) eq(L.studioProfilePhotoProblem(file), '', `${label}: ${file.type} ${file.size} bytes is accepted`)
  eq(L.studioProfilePhotoProblem(null), '', `${label}: no file, no problem`)
  eq(L.studioProfilePhotoProblem(undefined), '', `${label}: no file (undefined), no problem`)
  for (const [file, expected] of [
    [{ type: 'application/pdf', size: 10 }, WRONG_TYPE], [{ type: '', size: 10 }, WRONG_TYPE], [{ size: 10 }, WRONG_TYPE], [{ type: 'image/svg+xml', size: 10 }, WRONG_TYPE], [{ type: 'IMAGE/PNG', size: 10 }, WRONG_TYPE],
    [{ type: 'image/png', size: 0 }, EMPTY_IMAGE], [{ type: 'image/png', size: -1 }, EMPTY_IMAGE], [{ type: 'image/png' }, EMPTY_IMAGE], [{ type: 'image/png', size: '10' }, EMPTY_IMAGE], [{ type: 'image/png', size: NaN }, EMPTY_IMAGE],
    [{ type: 'image/png', size: 5 * MB + 1 }, TOO_BIG], [{ type: 'image/gif', size: 50 * MB }, TOO_BIG],
    [{ type: 'application/pdf', size: 0 }, WRONG_TYPE], [{ type: 'application/pdf', size: 50 * MB }, WRONG_TYPE],
  ]) eq(L.studioProfilePhotoProblem(file), expected, `${label}: ${JSON.stringify(file)}`)
  // the sentence for a refused request
  const failure = L.studioProfileFailure
  for (const [kind, status, body, expected] of [
    ['name', 401, { error: 'Unauthorized' }, SIGNED_OUT_REPLY], ['photo', 401, { error: 'Unauthorized' }, SIGNED_OUT_REPLY], ['name', 401, null, SIGNED_OUT_REPLY],
    ['photo', 413, {}, TOO_BIG], ['photo', 413, { error: 'x' }, TOO_BIG], ['name', 413, {}, NAME_FAILED],
    ['name', 400, { error: 'Display name is required' }, 'Display name is required'], ['name', 400, { error: '  Display name must be 80 characters or fewer ' }, 'Display name must be 80 characters or fewer'],
    ['photo', 400, { error: 'Invalid file type. Accepted: JPEG, PNG, WebP, GIF' }, 'Invalid file type. Accepted: JPEG, PNG, WebP, GIF'], ['photo', 422, { error: 'Bad image' }, 'Bad image'],
    ['name', 400, {}, NAME_FAILED], ['name', 400, { error: '' }, NAME_FAILED], ['name', 400, { error: '   ' }, NAME_FAILED], ['name', 400, { error: 5 }, NAME_FAILED], ['photo', 404, null, PHOTO_FAILED], ['name', 499, { error: 'Teapot' }, 'Teapot'],
    ['name', 500, { error: 'Failed to update profile' }, NAME_FAILED], ['photo', 500, { error: 'Failed to upload avatar' }, PHOTO_FAILED], ['photo', 502, { error: 'Bad gateway' }, PHOTO_FAILED], ['name', 503, { error: 'Unavailable' }, NAME_FAILED],
    ['name', 0, null, NAME_FAILED], ['photo', 0, null, PHOTO_FAILED], ['photo', undefined, { error: 'x' }, PHOTO_FAILED], ['name', '400', { error: 'x' }, NAME_FAILED], ['name', 200, { error: 'odd' }, NAME_FAILED], ['photo', 399, { error: 'odd' }, PHOTO_FAILED],
    ['name', 400, 'oops', NAME_FAILED], ['photo', 400, undefined, PHOTO_FAILED],
  ]) eq(failure(kind, status, body), expected, `${label}: ${kind} ${JSON.stringify(status)} ${JSON.stringify(body)}`)
  // the saved sentence
  eq(L.studioProfileSaved('name', true), 'Display name saved.', `${label}: name saved`)
  eq(L.studioProfileSaved('name', false), 'Display name saved. Reload to refresh your account session.', `${label}: name saved, session not refreshed`)
  eq(L.studioProfileSaved('photo', true), 'Account photo saved.', `${label}: photo saved`)
  eq(L.studioProfileSaved('photo', false), 'Account photo saved. Reload to refresh your account session.', `${label}: photo saved, session not refreshed`)
  // the plan badge
  for (const tier of [undefined, null, '', '   ', 'free', 'FREE', ' Free ', 7, {}]) eq(L.studioProfileTier(tier), null, `${label}: no badge for ${JSON.stringify(tier)}`)
  for (const [tier, expected] of [['pro', { id: 'pro', label: 'Pro' }], ['PRO', { id: 'pro', label: 'Pro' }], [' pro ', { id: 'pro', label: 'Pro' }], ['starter', { id: 'starter', label: 'Starter' }], ['premium', { id: 'premium', label: 'Max' }], ['Premium', { id: 'premium', label: 'Max' }], ['enterprise', { id: 'enterprise', label: 'Enterprise' }], ['max', { id: 'max', label: 'Max' }]]) deepEq(L.studioProfileTier(tier), expected, `${label}: badge for ${JSON.stringify(tier)}`)
  return L
}
const lib = proveLib(SOURCES[LIB])

// ---------------------------------------------------------------- 2. the component (executed)
const ADA = { id: 'u1', name: 'Ada Morgan', email: 'ada@example.invalid', image: null, tier: 'pro' }
const reply = (status, body, { unreadable = false } = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => { if (unreadable) throw new SyntaxError('Unexpected token < in JSON'); return body } })
class FormDataStub { constructor() { this.entries = [] } append(key, value) { this.entries.push([key, value]) } }
const FILE = (overrides = {}) => ({ name: 'me.png', type: 'image/png', size: 4096, ...overrides })
function mount(source, options = {}) {
  const { isLoading = false, route = () => reply(200, {}), update = async () => ({}), libSource = null } = options
  const user = Object.hasOwn(options, 'user') ? options.user : ADA // `user: undefined` means signed out, not "use the default"
  const react = makeReact()
  const calls = [], updates = []
  const fetch = (url, init = {}) => { calls.push({ url: String(url), init }); return Promise.resolve(route(String(url), init)) }
  const auth = { user, isLoading }
  const L = libSource ? load(libSource, LIB) : lib
  const mod = load(source, UI, { deps: { react: react.api, '@/hooks/use-auth': { useAuth: () => auth }, 'next-auth/react': { useSession: () => ({ update: value => { updates.push(value); return update(value) } }) }, '@/lib/studio-p2-profile-page': L, 'next/link': { default: 'Link' } }, globals: { fetch, FormData: FormDataStub } })
  const draw = () => { react.reset(); return mod.StudioProfilePage() }
  let tree = draw()
  const by = (attr, value) => nodes(tree).find(node => node.props && attr in node.props && (value === undefined || node.props[attr] === value))
  const api = {
    calls, updates, auth,
    get tree() { return tree },
    redraw() { tree = draw(); return tree },
    all: () => nodes(tree),
    by,
    text: () => text(tree),
    root: () => tree,
    input: () => nodes(tree).find(node => node.type === 'input' && node.props.id === 'studio-p2-profile-name'),
    file: () => nodes(tree).find(node => node.type === 'input' && node.props.type === 'file'),
    errors: () => nodes(tree).filter(node => node.props?.['data-studio-p2-profile-error'] === 'true'),
    status: () => text(by('data-studio-p2-profile-status')),
    click(attr) { const node = by(attr); assert.ok(node, `${attr} exists`); node.props.onClick(); return api.redraw() },
    type(value) { api.input().props.onChange({ target: { value } }); return api.redraw() },
    async settle() { await tick(); return api.redraw() },
    async save() { by('data-studio-p2-profile-save').props.onClick(); await tick(); return api.redraw() },
    async choose(file) { const target = { value: file ? 'C:\\fakepath\\me.png' : '', get files() { return this.value && file ? [file] : [] } }; api.file().props.onChange({ target }); await tick(); api.redraw(); return target }, // as a browser does: clearing the value empties the files
  }
  return api
}
const buttonText = node => text(node)
async function proveComponent(source, label = 'component', libSource = null) {
  const open = (options = {}) => mount(source, { libSource, ...options })
  match(source, /import "\.\/studio-p2-profile-page\.css"/, `${label}: imports its own stylesheet`)
  // --- loading
  const loading = open({ isLoading: true })
  const loadingRoot = loading.root()
  eq(loadingRoot.type, 'section', `${label}: loading: a section`)
  eq(loadingRoot.props['data-studio-p2-profile-state'], 'loading', `${label}: loading: state`)
  eq(loadingRoot.props.role, 'status', `${label}: loading: a live status`)
  eq(loadingRoot.props['aria-busy'], 'true', `${label}: loading: busy`)
  eq(loading.text(), WORDS.loading, `${label}: loading: the words are read out (and only those)`)
  ok(nodes(loadingRoot).some(node => node.type === 'span' && node.props.className === 'sr-only' && text(node) === WORDS.loading), `${label}: loading: the words are screen-reader text`)
  eq(nodes(loadingRoot).filter(node => node.type === 'i').length, 7, `${label}: loading: the card's shape in seven bars`)
  eq(nodes(loadingRoot).filter(node => node.type === 'button' || node.type === 'Link' || node.type === 'input').length, 0, `${label}: loading: nothing to press`)
  eq(loading.calls.length, 0, `${label}: loading: no request`)
  // --- signed out
  const out = open({ user: undefined })
  const outRoot = out.root()
  eq(outRoot.props['data-studio-p2-profile-state'], 'signed-out', `${label}: signed out: state`)
  eq(outRoot.props['aria-labelledby'], 'studio-p2-profile-title', `${label}: signed out: named by its title`)
  eq(text(out.by('id', 'studio-p2-profile-title')), WORDS.signedOutTitle, `${label}: signed out: title`)
  eq(out.by('id', 'studio-p2-profile-title').type, 'h2', `${label}: signed out: the title is a heading`)
  ok(out.text().includes(WORDS.signedOutBody), `${label}: signed out: the way forward in words`)
  const signIn = out.all().find(node => node.type === 'Link')
  eq(signIn.props.href, '/auth/signin', `${label}: signed out: sign in goes to the sign-in page`)
  eq(text(signIn), WORDS.signIn, `${label}: signed out: the link's word`)
  eq(out.all().filter(node => node.type === 'Link').length, 1, `${label}: signed out: one link`)
  eq(out.all().filter(node => node.type === 'button' || node.type === 'input').length, 0, `${label}: signed out: nothing to edit`)
  eq(out.calls.length, 0, `${label}: signed out: no request`)
  const nobody = open({ user: null })
  eq(nobody.root().props['data-studio-p2-profile-state'], 'signed-out', `${label}: signed out: a null user too`)
  const stillLoading = open({ user: undefined, isLoading: true })
  eq(stillLoading.root().props['data-studio-p2-profile-state'], 'loading', `${label}: loading wins over signed out (the session is not known yet)`)

  // --- ready
  const page = open()
  const root = page.root()
  eq(root.type, 'section', `${label}: ready: a section`)
  eq(root.props['data-studio-p2-profile'], 'true', `${label}: ready: the page marker`)
  eq(root.props['data-studio-p2-profile-state'], 'ready', `${label}: ready: state`)
  eq(root.props['aria-labelledby'], 'studio-p2-profile-title', `${label}: ready: named by its title`)
  eq(root.props['aria-busy'], false, `${label}: ready: not busy`)
  const title = page.by('id', 'studio-p2-profile-title')
  eq(title.type, 'h2', `${label}: ready: the title is a heading`)
  eq(text(title), WORDS.title, `${label}: ready: title`)
  ok(page.text().includes(WORDS.lede), `${label}: ready: lede`)
  eq(text(page.by('data-studio-p2-profile-edit')), WORDS.edit, `${label}: ready: the Edit button`)
  eq(page.by('data-studio-p2-profile-edit').props.type, 'button', `${label}: ready: Edit never submits a form`)
  eq(page.by('data-studio-p2-profile-save'), undefined, `${label}: ready: no Save before editing`)
  eq(page.by('data-studio-p2-profile-cancel'), undefined, `${label}: ready: no Cancel before editing`)
  eq(page.input(), undefined, `${label}: ready: no name input before editing`)
  const avatar = page.by('data-studio-p2-profile-avatar')
  eq(avatar.type, 'Avatar', `${label}: ready: the shared avatar`)
  const avatarImage = nodes(avatar).find(node => node.type === 'AvatarImage')
  eq(avatarImage.props.src, undefined, `${label}: ready: no photo, no src`)
  eq(avatarImage.props.alt, 'Ada Morgan account photo', `${label}: ready: the photo's alt names the account`)
  eq(text(page.by('data-studio-p2-profile-initials')), 'AM', `${label}: ready: initials`)
  eq(page.by('data-studio-p2-profile-initials').type, 'AvatarFallback', `${label}: ready: the initials are the avatar's fallback`)
  ok(!JSON.stringify(rendered(root)).includes('gradient'), `${label}: ready: no gradient anywhere`)
  ok(!/(purple|blue|violet|indigo)-\d/.test(rendered(root)), `${label}: ready: no utility colour classes`)
  const who = page.by('data-studio-p2-profile-who')
  eq(text(page.by('data-studio-p2-profile-namerow')), 'Ada Morgan Pro', `${label}: ready: name, then the plan badge`)
  eq(page.by('data-studio-p2-profile-tier').props['data-studio-p2-profile-tier'], 'pro', `${label}: ready: the badge's plan`)
  ok(text(who).includes('ada@example.invalid'), `${label}: ready: email`)
  const photo = page.by('data-studio-p2-profile-photo')
  eq(photo.type, 'button', `${label}: ready: the photo control is a real button (always visible, not a hover overlay)`)
  eq(photo.props.type, 'button', `${label}: ready: it never submits`)
  eq(text(photo), WORDS.changePhoto, `${label}: ready: the photo button's word`)
  eq(photo.props.disabled, false, `${label}: ready: the photo button is on`)
  ok(text(who).includes(WORDS.photoHint), `${label}: ready: the accepted types and size are said`)
  eq(page.status(), '', `${label}: ready: the status line starts empty`)
  eq(page.by('data-studio-p2-profile-status').props.role, 'status', `${label}: ready: the status line is a live region`)
  eq(page.by('data-studio-p2-profile-status').type, 'p', `${label}: ready: the status line is always in the page (a live region must exist before it speaks)`)
  eq(page.errors().length, 0, `${label}: ready: no error`)
  const file = page.file()
  eq(file.props.hidden, true, `${label}: ready: the real file input stays out of the way`)
  eq(file.props.accept, 'image/jpeg,image/png,image/webp,image/gif', `${label}: ready: the file input's types`)
  eq(file.props['aria-label'], 'Upload account photo', `${label}: ready: the file input is named`)
  eq(file.props.disabled, false, `${label}: ready: the file input is on`)
  const nameField = page.by('data-studio-p2-profile-field', 'name')
  eq(text(nodes(nameField).find(node => node.type === 'span')), WORDS.nameLabel, `${label}: ready: the label is plain text before editing`)
  eq(nodes(nameField).some(node => node.type === 'label'), false, `${label}: ready: no label without a control`)
  eq(text(nodes(nameField).find(node => node.props?.['data-studio-p2-profile-value'] === 'true')), 'Ada Morgan', `${label}: ready: the name`)
  eq(nodes(nameField).find(node => node.props?.['data-studio-p2-profile-value'] === 'true').props['data-studio-p2-profile-unset'], undefined, `${label}: ready: a set name is not muted`)
  eq(text(nodes(nameField).find(node => node.props?.id === 'studio-p2-profile-name-help')), WORDS.nameHelp, `${label}: ready: the name's note`)
  const emailField = page.by('data-studio-p2-profile-field', 'email')
  eq(text(emailField), `${WORDS.emailLabel} ada@example.invalid ${WORDS.emailNote}`, `${label}: ready: email label, value, note`)
  eq(nodes(emailField).some(node => node.type === 'input'), false, `${label}: ready: the email is not editable`)
  const plan = page.by('data-studio-p2-profile-plan')
  eq(text(plan), `${WORDS.planTitle} ${WORDS.planNote} ${WORDS.planAction}`, `${label}: ready: the plan row`)
  const planLink = nodes(plan).find(node => node.type === 'Link')
  eq(planLink.props.href, '/billing', `${label}: ready: Manage plan goes to Billing`)
  eq(page.all().filter(node => node.type === 'Link').length, 1, `${label}: ready: one link on the page (no new action)`)
  eq(page.all().filter(node => node.type === 'button').length, 2, `${label}: ready: two buttons (Edit profile, Change photo)`)
  eq(page.calls.length, 0, `${label}: ready: no request on load`)
  // tiers and names
  eq(page.by('data-studio-p2-profile-tier').props['data-studio-p2-profile-tier'], 'pro', `${label}: pro`)
  for (const [tier, shown] of [['free', null], [undefined, null], ['starter', 'Starter'], ['premium', 'Max']]) {
    const t = open({ user: { ...ADA, tier } })
    eq(t.by('data-studio-p2-profile-tier') ? text(t.by('data-studio-p2-profile-tier')) : null, shown, `${label}: tier ${tier}: badge`)
    if (!shown) eq(text(t.by('data-studio-p2-profile-namerow')), 'Ada Morgan', `${label}: tier ${tier}: just the name`)
  }
  const photoUser = open({ user: { ...ADA, image: 'https://img.example.invalid/ada.png' } })
  eq(nodes(photoUser.by('data-studio-p2-profile-avatar')).find(node => node.type === 'AvatarImage').props.src, 'https://img.example.invalid/ada.png', `${label}: a saved photo is shown`)
  const noName = open({ user: { ...ADA, name: null } })
  eq(text(noName.by('data-studio-p2-profile-initials')), 'U', `${label}: no name: initials "U"`)
  eq(text(noName.by('data-studio-p2-profile-namerow')), `${WORDS.nameUnset} Pro`, `${label}: no name: "Not set" in the identity row`)
  const unset = nodes(noName.by('data-studio-p2-profile-field', 'name')).find(node => node.props?.['data-studio-p2-profile-value'] === 'true')
  eq(text(unset), WORDS.nameUnset, `${label}: no name: "Not set" in the field`)
  eq(unset.props['data-studio-p2-profile-unset'], 'true', `${label}: no name: muted`)
  eq(nodes(noName.by('data-studio-p2-profile-avatar')).find(node => node.type === 'AvatarImage').props.alt, 'Your account photo', `${label}: no name: the alt still names it`)
  const twoWords = open({ user: { ...ADA, name: 'Grace' } })
  eq(text(twoWords.by('data-studio-p2-profile-initials')), 'G', `${label}: one word: one letter`)

  // --- editing
  const ed = open()
  ed.click('data-studio-p2-profile-edit')
  eq(ed.by('data-studio-p2-profile-edit'), undefined, `${label}: editing: Edit is replaced`)
  eq(text(ed.by('data-studio-p2-profile-save')), WORDS.save, `${label}: editing: Save`)
  eq(text(ed.by('data-studio-p2-profile-cancel')), WORDS.cancel, `${label}: editing: Cancel`)
  eq(ed.by('data-studio-p2-profile-save').props.type, 'button', `${label}: editing: Save never submits a form`)
  eq(ed.by('data-studio-p2-profile-cancel').props.type, 'button', `${label}: editing: Cancel never submits a form`)
  eq(ed.by('data-studio-p2-profile-save').props.disabled, false, `${label}: editing: Save is on`)
  const input = ed.input()
  eq(input.props.value, 'Ada Morgan', `${label}: editing: the input starts with the current name`)
  eq(input.props.placeholder, WORDS.namePlaceholder, `${label}: editing: placeholder`)
  eq(input.props.maxLength, 80, `${label}: editing: 80 characters`)
  eq(input.props.autoComplete, 'name', `${label}: editing: autocomplete name`)
  eq(input.props.disabled, false, `${label}: editing: the input is on`)
  eq(input.props['aria-invalid'], false, `${label}: editing: valid to begin with`)
  eq(input.props['aria-describedby'], 'studio-p2-profile-name-help', `${label}: editing: described by the note`)
  const editLabel = nodes(ed.by('data-studio-p2-profile-field', 'name')).find(node => node.type === 'label')
  eq(editLabel.props.htmlFor, 'studio-p2-profile-name', `${label}: editing: the label is tied to the input`)
  eq(text(editLabel), WORDS.nameLabel, `${label}: editing: the label's words`)
  eq(nodes(ed.by('data-studio-p2-profile-field', 'name')).filter(node => node.type === 'span').length, 0, `${label}: editing: the plain label is replaced, not doubled`)
  eq(nodes(ed.by('data-studio-p2-profile-field', 'name')).some(node => node.props?.['data-studio-p2-profile-value'] === 'true'), false, `${label}: editing: the static value is replaced by the input`)
  ed.type('Ada M. Morgan')
  eq(ed.input().props.value, 'Ada M. Morgan', `${label}: editing: typing is kept`)
  ed.click('data-studio-p2-profile-cancel')
  eq(ed.input(), undefined, `${label}: cancel: back to reading`)
  ok(ed.by('data-studio-p2-profile-edit'), `${label}: cancel: Edit is back`)
  eq(ed.calls.length, 0, `${label}: cancel: nothing sent`)
  ed.click('data-studio-p2-profile-edit')
  eq(ed.input().props.value, 'Ada Morgan', `${label}: cancel: the discarded edit does not come back`)

  // --- name: refused before any request
  for (const bad of ['', '   ', 'x'.repeat(81)]) {
    const v = open(); v.click('data-studio-p2-profile-edit'); v.type(bad); await v.save()
    eq(v.calls.length, 0, `${label}: name ${JSON.stringify(bad.slice(0, 5))}: no request`)
    deepEq(v.errors().map(text), [NAME_PROBLEM], `${label}: name ${JSON.stringify(bad.slice(0, 5))}: said in words`)
    eq(v.errors()[0].props.role, 'alert', `${label}: name: the problem is announced`)
    eq(v.errors()[0].props.id, 'studio-p2-profile-name-error', `${label}: name: the problem has an id`)
    eq(v.input().props['aria-invalid'], true, `${label}: name: the input is marked invalid`)
    eq(v.input().props['aria-describedby'], 'studio-p2-profile-name-help studio-p2-profile-name-error', `${label}: name: the input is described by the note and the problem`)
    ok(v.input(), `${label}: name: still editing`)
    v.type('Ada'); eq(v.errors().length, 0, `${label}: name: typing clears the problem`); eq(v.input().props['aria-invalid'], false, `${label}: name: and the mark`)
  }
  // --- name: saved
  const saved = open({ route: () => reply(200, { name: 'Ada M. Morgan' }) })
  saved.click('data-studio-p2-profile-edit'); saved.type('  Ada M. Morgan  '); await saved.save()
  eq(saved.calls.length, 1, `${label}: saved: one request`)
  eq(saved.calls[0].url, '/api/profile', `${label}: saved: to the profile route`)
  eq(saved.calls[0].init.method, 'PATCH', `${label}: saved: a PATCH`)
  deepEq(saved.calls[0].init.headers, { 'Content-Type': 'application/json' }, `${label}: saved: JSON`)
  eq(saved.calls[0].init.body, JSON.stringify({ name: 'Ada M. Morgan' }), `${label}: saved: the trimmed name, nothing else`)
  deepEq(saved.updates, [{ name: 'Ada M. Morgan' }], `${label}: saved: the session is refreshed with the trimmed name`)
  eq(saved.input(), undefined, `${label}: saved: back to reading`)
  eq(saved.status(), WORDS.nameSaved, `${label}: saved: said in words`)
  eq(saved.errors().length, 0, `${label}: saved: no error`)
  eq(saved.root().props['aria-busy'], false, `${label}: saved: not busy`)
  eq(saved.by('data-studio-p2-profile-edit').props.disabled, false, `${label}: saved: Edit is on again`)
  saved.click('data-studio-p2-profile-edit'); eq(saved.status(), '', `${label}: saved: editing again clears the word`)
  // --- name: in flight
  let release
  const held = open({ route: () => new Promise(resolve => { release = () => resolve(reply(200, {})) }) })
  held.click('data-studio-p2-profile-edit'); held.type('Ada Q'); held.by('data-studio-p2-profile-save').props.onClick(); await tick(); held.redraw()
  eq(text(held.by('data-studio-p2-profile-save')), WORDS.saving, `${label}: in flight: Saving…`)
  eq(held.by('data-studio-p2-profile-save').props.disabled, true, `${label}: in flight: Save is off`)
  eq(held.by('data-studio-p2-profile-cancel').props.disabled, true, `${label}: in flight: Cancel is off`)
  eq(held.input().props.disabled, true, `${label}: in flight: the input is off`)
  eq(held.by('data-studio-p2-profile-photo').props.disabled, true, `${label}: in flight: the photo button is off`)
  eq(held.file().props.disabled, true, `${label}: in flight: the file input is off`)
  eq(held.root().props['aria-busy'], true, `${label}: in flight: busy`)
  held.by('data-studio-p2-profile-save').props.onClick(); await tick()
  eq(held.calls.length, 1, `${label}: in flight: a second press sends nothing`)
  await held.choose(FILE()); eq(held.calls.length, 1, `${label}: in flight: a photo cannot start meanwhile`)
  release(); await held.settle()
  eq(held.status(), WORDS.nameSaved, `${label}: in flight: saved after the reply`)
  eq(held.calls.length, 1, `${label}: in flight: still one request`)
  // --- name: every failure
  const nameCases = [
    ['refused 400 with a reason', () => reply(400, { error: 'Display name is required' }), 'Display name is required'],
    ['signed out', () => reply(401, { error: 'Unauthorized' }), SIGNED_OUT_REPLY],
    ['server fault', () => reply(500, { error: 'Failed to update profile' }), NAME_FAILED],
    ['unreadable server fault', () => reply(502, null, { unreadable: true }), NAME_FAILED],
    ['signed out, unreadable reply (a sign-in page)', () => reply(401, null, { unreadable: true }), SIGNED_OUT_REPLY],
    ['unreadable refusal', () => reply(400, null, { unreadable: true }), NAME_FAILED],
    ['offline', () => { throw new TypeError('Failed to fetch') }, NAME_FAILED],
  ]
  for (const [name, route, expected] of nameCases) {
    const v = open({ route }); v.click('data-studio-p2-profile-edit'); v.type('Ada Z'); await v.save()
    deepEq(v.errors().map(text), [expected], `${label}: name ${name}: said in words`)
    eq(v.errors()[0].props.role, 'alert', `${label}: name ${name}: announced`)
    eq(v.input().props.value, 'Ada Z', `${label}: name ${name}: the edit is still here`)
    eq(v.input().props['aria-invalid'], true, `${label}: name ${name}: the input is marked`)
    eq(v.updates.length, 0, `${label}: name ${name}: the session is not touched`)
    eq(v.status(), '', `${label}: name ${name}: no saved word`)
    eq(v.root().props['aria-busy'], false, `${label}: name ${name}: not busy afterwards`)
    eq(v.by('data-studio-p2-profile-save').props.disabled, false, `${label}: name ${name}: Save is on again (retry)`)
    ok(!v.text().includes('Failed to fetch') && !v.text().includes('Unexpected token') && !v.text().includes('Unauthorized') && !v.text().includes('Failed to update profile') && !v.text().includes('Network error'), `${label}: name ${name}: no raw words`)
    v.click('data-studio-p2-profile-cancel'); eq(v.errors().length, 0, `${label}: name ${name}: Cancel clears the problem`)
  }
  const staleSession = open({ route: () => reply(200, {}), update: async () => { throw new Error('session down') } })
  staleSession.click('data-studio-p2-profile-edit'); staleSession.type('Ada S'); await staleSession.save()
  eq(staleSession.status(), `${WORDS.nameSaved} ${WORDS.reload}`, `${label}: saved but the session did not refresh: said in words`)
  eq(staleSession.input(), undefined, `${label}: saved but the session did not refresh: the save stands (back to reading)`)
  eq(staleSession.errors().length, 0, `${label}: saved but the session did not refresh: not an error`)
  const reject = open({ route: () => reply(200, {}), update: () => Promise.reject(new Error('x')) })
  reject.click('data-studio-p2-profile-edit'); reject.type('Ada R'); await reject.save()
  eq(reject.status(), `${WORDS.nameSaved} ${WORDS.reload}`, `${label}: a rejected refresh reads the same`)

  // --- photo: refused before any request
  for (const [name, file, expected] of [['wrong type', FILE({ type: 'application/pdf', name: 'a.pdf' }), WRONG_TYPE], ['empty', FILE({ size: 0 }), EMPTY_IMAGE], ['too big', FILE({ size: 5 * MB + 1 }), TOO_BIG]]) {
    const v = open(); const target = await v.choose(file)
    eq(v.calls.length, 0, `${label}: photo ${name}: no request`)
    deepEq(v.errors().map(text), [expected], `${label}: photo ${name}: said in words`)
    eq(v.errors()[0].props.role, 'alert', `${label}: photo ${name}: announced`)
    eq(target.value, '', `${label}: photo ${name}: the file input is reset (the same file can be chosen again)`)
    eq(v.root().props['aria-busy'], false, `${label}: photo ${name}: not busy`)
    eq(v.updates.length, 0, `${label}: photo ${name}: session untouched`)
  }
  const none = open(); const noTarget = await none.choose(null)
  eq(none.calls.length, 0, `${label}: photo: no file chosen, no request`); eq(none.errors().length, 0, `${label}: photo: no file chosen, no error`); eq(noTarget.value, '', `${label}: photo: no file chosen, input reset`)
  // --- photo: saved
  const uploaded = open({ route: () => reply(200, { image: 'https://img.example.invalid/new.png' }) })
  const chosen = FILE(); const target = await uploaded.choose(chosen)
  eq(uploaded.calls.length, 1, `${label}: photo saved: one request`)
  eq(uploaded.calls[0].url, '/api/profile/avatar', `${label}: photo saved: to the avatar route`)
  eq(uploaded.calls[0].init.method, 'POST', `${label}: photo saved: a POST`)
  ok(uploaded.calls[0].init.body instanceof FormDataStub, `${label}: photo saved: a form`)
  deepEq(uploaded.calls[0].init.body.entries.map(([key]) => key), ['avatar'], `${label}: photo saved: one field, "avatar"`)
  ok(uploaded.calls[0].init.body.entries[0][1] === chosen, `${label}: photo saved: the chosen file itself`)
  eq(uploaded.calls[0].init.headers, undefined, `${label}: photo saved: no hand-set content type (the browser adds the boundary)`)
  deepEq(uploaded.updates, [{ image: 'https://img.example.invalid/new.png' }], `${label}: photo saved: the session is refreshed with the new image`)
  eq(uploaded.status(), WORDS.photoSaved, `${label}: photo saved: said in words`)
  eq(uploaded.errors().length, 0, `${label}: photo saved: no error`)
  eq(target.value, '', `${label}: photo saved: the file input is reset`)
  eq(uploaded.root().props['aria-busy'], false, `${label}: photo saved: not busy`)
  // the photo button opens the file chooser
  const clicks = []
  const opener = open(); opener.file().props.ref.current = { click: () => clicks.push('chooser') }
  opener.by('data-studio-p2-profile-photo').props.onClick()
  deepEq(clicks, ['chooser'], `${label}: photo button: pressing it opens the file chooser`)
  eq(opener.calls.length, 0, `${label}: photo button: and sends nothing yet`)
  // --- photo: in flight
  let releasePhoto
  const heldPhoto = open({ route: () => new Promise(resolve => { releasePhoto = () => resolve(reply(200, { image: 'https://img.example.invalid/x.png' })) }) })
  heldPhoto.choose(FILE()); await tick(); heldPhoto.redraw()
  eq(text(heldPhoto.by('data-studio-p2-profile-photo')), WORDS.uploading, `${label}: photo in flight: Uploading…`)
  ok(nodes(heldPhoto.by('data-studio-p2-profile-photo')).some(node => node.type === 'Loader2' && node.props['data-studio-p2-profile-spin'] === 'true'), `${label}: photo in flight: the spinner`)
  ok(!nodes(heldPhoto.by('data-studio-p2-profile-photo')).some(node => node.type === 'Camera'), `${label}: photo in flight: no camera meanwhile`)
  eq(heldPhoto.by('data-studio-p2-profile-photo').props.disabled, true, `${label}: photo in flight: the button is off`)
  eq(heldPhoto.by('data-studio-p2-profile-edit').props.disabled, true, `${label}: photo in flight: Edit is off`)
  eq(heldPhoto.root().props['aria-busy'], true, `${label}: photo in flight: busy`)
  await heldPhoto.choose(FILE()); eq(heldPhoto.calls.length, 1, `${label}: photo in flight: a second file sends nothing`)
  releasePhoto(); await heldPhoto.settle()
  eq(heldPhoto.status(), WORDS.photoSaved, `${label}: photo in flight: saved after the reply`)
  eq(text(heldPhoto.by('data-studio-p2-profile-photo')), WORDS.changePhoto, `${label}: photo in flight: the button is back`)
  ok(nodes(heldPhoto.by('data-studio-p2-profile-photo')).some(node => node.type === 'Camera'), `${label}: photo in flight: the camera is back`)
  // a photo upload while the name is being edited: Save does not say "Saving…" for it, and its word does not outlive the next save
  let releaseEditing
  const editingPhoto = open({ route: (url) => url === '/api/profile' ? reply(500, {}) : new Promise(resolve => { releaseEditing = () => resolve(reply(200, { image: 'https://img.example.invalid/e.png' })) }) })
  editingPhoto.click('data-studio-p2-profile-edit'); editingPhoto.choose(FILE()); await tick(); editingPhoto.redraw()
  eq(text(editingPhoto.by('data-studio-p2-profile-save')), WORDS.save, `${label}: photo in flight while editing: Save still says Save`)
  eq(editingPhoto.by('data-studio-p2-profile-save').props.disabled, true, `${label}: photo in flight while editing: Save is off`)
  eq(editingPhoto.by('data-studio-p2-profile-cancel').props.disabled, true, `${label}: photo in flight while editing: Cancel is off`)
  releaseEditing(); await editingPhoto.settle()
  eq(editingPhoto.status(), WORDS.photoSaved, `${label}: photo saved while editing: its word`)
  editingPhoto.type('Ada Q'); await editingPhoto.save()
  eq(editingPhoto.status(), '', `${label}: a failed name save drops the photo's old word`)
  deepEq(editingPhoto.errors().map(text), [NAME_FAILED], `${label}: and shows its own problem`)
  // --- photo: every failure
  const photoCases = [
    ['refused 400 with a reason', () => reply(400, { error: 'Invalid file type. Accepted: JPEG, PNG, WebP, GIF' }), 'Invalid file type. Accepted: JPEG, PNG, WebP, GIF'],
    ['too big at the proxy (413, no JSON)', () => reply(413, null, { unreadable: true }), TOO_BIG],
    ['signed out', () => reply(401, { error: 'Unauthorized' }), SIGNED_OUT_REPLY],
    ['server fault', () => reply(500, { error: 'Failed to upload avatar' }), PHOTO_FAILED],
    ['unreadable server fault (an HTML page)', () => reply(502, null, { unreadable: true }), PHOTO_FAILED],
    ['signed out, unreadable reply (a sign-in page)', () => reply(401, null, { unreadable: true }), SIGNED_OUT_REPLY],
    ['offline', () => { throw new TypeError('Failed to fetch') }, PHOTO_FAILED],
    ['no image back', () => reply(200, {}), PHOTO_FAILED],
    ['an image that is not text', () => reply(200, { image: 42 }), PHOTO_FAILED],
    ['an empty image', () => reply(200, { image: '' }), PHOTO_FAILED],
    ['an unreadable success', () => reply(200, null, { unreadable: true }), PHOTO_FAILED],
  ]
  for (const [name, route, expected] of photoCases) {
    const v = open({ route }); const t = await v.choose(FILE())
    deepEq(v.errors().map(text), [expected], `${label}: photo ${name}: said in words`)
    eq(v.errors()[0].props.role, 'alert', `${label}: photo ${name}: announced`)
    eq(v.updates.length, 0, `${label}: photo ${name}: session untouched`)
    eq(v.status(), '', `${label}: photo ${name}: no saved word`)
    eq(t.value, '', `${label}: photo ${name}: the file input is reset`)
    eq(v.root().props['aria-busy'], false, `${label}: photo ${name}: not busy afterwards`)
    eq(v.by('data-studio-p2-profile-photo').props.disabled, false, `${label}: photo ${name}: the button is on again (retry)`)
    ok(!v.text().includes('Failed to fetch') && !v.text().includes('Unexpected token') && !v.text().includes('Unauthorized') && !v.text().includes('Failed to upload avatar'), `${label}: photo ${name}: no raw words`)
    await v.choose(FILE({ type: 'application/pdf' })); deepEq(v.errors().map(text), [WRONG_TYPE], `${label}: photo ${name}: the next choice replaces the problem`)
  }
  let failNext = true
  const retried = open({ route: () => failNext ? reply(500, { error: 'Failed to upload avatar' }) : reply(200, { image: 'https://img.example.invalid/r.png' }) })
  await retried.choose(FILE()); deepEq(retried.errors().map(text), [PHOTO_FAILED], `${label}: retry: the first upload fails`)
  failNext = false; await retried.choose(FILE())
  eq(retried.errors().length, 0, `${label}: retry: a good upload clears the old problem`); eq(retried.status(), WORDS.photoSaved, `${label}: retry: and says it saved`)
  const stalePhoto = open({ route: () => reply(200, { image: 'https://img.example.invalid/y.png' }), update: async () => { throw new Error('session down') } }); await stalePhoto.choose(FILE())
  eq(stalePhoto.status(), `${WORDS.photoSaved} ${WORDS.reload}`, `${label}: photo saved but the session did not refresh: said in words`)
  eq(stalePhoto.errors().length, 0, `${label}: photo saved but the session did not refresh: not an error`)
  // a name problem and a photo problem are separate lines, and a new action clears the old word
  const both = open({ route: (url) => url === '/api/profile' ? reply(200, {}) : reply(500, {}) })
  await both.choose(FILE()); eq(both.errors().length, 1, `${label}: both: the photo problem`)
  both.click('data-studio-p2-profile-edit'); both.type('Ada B'); await both.save()
  eq(both.errors().length, 0, `${label}: both: saving the name clears the old photo problem`); eq(both.status(), WORDS.nameSaved, `${label}: both: and says it saved`)
  await both.choose(FILE()); eq(both.status(), '', `${label}: both: choosing a photo clears the old saved word`); eq(both.errors().length, 1, `${label}: both: and shows its own problem`)
  // the photo problem sits with the photo, the name problem with the name
  const placed = open({ route: () => reply(500, {}) }); await placed.choose(FILE({ size: 0 }))
  ok(nodes(placed.by('data-studio-p2-profile-who')).some(node => node.props?.['data-studio-p2-profile-error'] === 'true'), `${label}: the photo problem is shown beside the photo`)
  placed.click('data-studio-p2-profile-edit'); placed.type(''); await placed.save()
  ok(nodes(placed.by('data-studio-p2-profile-field', 'name')).some(node => node.props?.['data-studio-p2-profile-error'] === 'true'), `${label}: the name problem is shown beside the name`)
  return label
}
await proveComponent(SOURCES[UI])

// ---------------------------------------------------------------- 3. the page wiring
const LEGACY_IMPORT = 'import { StudioProfilePage } from "@/components/settings/studio-p2-profile-page"\n'
const LEGACY_FLAG = '// PASS2 Profile page (NEXT_PUBLIC_STUDIO_P2_PROFILE_PAGE, default off, Studio shell only): the profile card in the shell\'s tokens with every state spoken. Anything else: the page below, untouched.\nconst STUDIO_P2_PROFILE_PAGE = STUDIO_SHELL && process.env.NEXT_PUBLIC_STUDIO_P2_PROFILE_PAGE === "true"\n'
const LEGACY_WRAPPER = 'export default function ProfileSettingsPage() {\n  return STUDIO_P2_PROFILE_PAGE ? <StudioProfilePage /> : <LegacyProfileSettingsPage />\n}\n\nfunction LegacyProfileSettingsPage() {'
function proveWiring(code, label = 'page') {
  const prior = baseSource(PAGE)
  const run = (source, env) => {
    const react = makeReact()
    const deps = { react: react.api, '@/hooks/use-auth': { useAuth: () => ({ user: { id: 'owned', name: 'Ada Morgan', email: 'owned@example.invalid', tier: 'pro', image: null }, isLoading: false }) }, 'next-auth/react': { useSession: () => ({ update: async () => undefined }) } }
    const mod = load(source, PAGE, { deps, env, globals: { fetch: async () => ({ ok: true, json: async () => ({}) }) } })
    return mod.default()
  }
  // flag off (or not exactly "true", or no shell): the same tree as the base commit's, down to the last prop
  const FAMILY = [{ NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_STUDIO_P2_ACCOUNT: 'true' }, { NEXT_PUBLIC_STUDIO_P2_ACCOUNT: 'true' }]
  for (const env of [{}, SHELL_ON, { ...SHELL_ON, [FLAG]: 'false' }, { ...SHELL_ON, [FLAG]: 'TRUE' }, { ...SHELL_ON, [FLAG]: '1' }, { ...SHELL_ON, [FLAG]: ' true' }, { ...SHELL_ON, [FLAG]: 'true ' }, { ...SHELL_ON, [FLAG]: '' }, { [FLAG]: 'true' }, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'false', [FLAG]: 'true' }, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'TRUE', [FLAG]: 'true' }, ...FAMILY.map(f => ({ ...f, [FLAG]: 'false' })), ...FAMILY.map(f => ({ ...f, [FLAG]: 'TRUE' }))]) {
    eq(rendered(expand(run(code, env))), rendered(expand(run(prior, env))), `${label}: env ${JSON.stringify(env)}: the tree equals the base commit's`)
  }
  // flag on: the new page, with no props
  for (const env of [ON, { ...ON, NEXT_PUBLIC_STUDIO_P2_ACCOUNT: 'true' }]) {
    const top = run(code, env)
    eq(top.type, 'StudioProfilePage', `${label}: on ${JSON.stringify(env)}: the new page`)
    eq(Object.keys(top.props).length, 0, `${label}: on: no props`)
    ok(!rendered(expand(top)).includes('data-studio-settings-profile'), `${label}: on: none of the old card's markers`)
  }
  // the old code is the base commit's, with three additions and one rename
  const restored = code.replace(LEGACY_IMPORT, '').replace(LEGACY_FLAG, '').replace(LEGACY_WRAPPER, 'export default function ProfileSettingsPage() {')
  eq(restored, prior, `${label}: removing the three additions gives back the base commit's page byte for byte`)
  eq(code.length - restored.length, LEGACY_IMPORT.length + LEGACY_FLAG.length + LEGACY_WRAPPER.length - 'export default function ProfileSettingsPage() {'.length, `${label}: and nothing else was added`)
  match(code, /const STUDIO_P2_PROFILE_PAGE = STUDIO_SHELL && process\.env\.NEXT_PUBLIC_STUDIO_P2_PROFILE_PAGE === "true"/, `${label}: flag read inline (Next inlines NEXT_PUBLIC at build), exact true, only with the Studio shell`)
  match(code, /return STUDIO_P2_PROFILE_PAGE \? <StudioProfilePage \/> : <LegacyProfileSettingsPage \/>/, `${label}: the wrapper picks by the flag`)
  match(code, /^"use client"/, `${label}: still a client page`)
  match(code, /export const dynamic = "force-dynamic"/, `${label}: still dynamic`)
}
proveWiring(SOURCES[PAGE])

// ---------------------------------------------------------------- 4. the CSS
const rulesOf = css => { const rules = []; postcss.parse(css).walkRules(rule => rules.push(rule)); return rules }
const hex = value => { const m = /^#([0-9a-f]{6})$/i.exec(value.trim()); assert.ok(m, `${value} is a 6-digit hex`); return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)) }
const luminance = rgb => { const [r, g, b] = rgb.map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const contrast = (a, b) => { const [hi, lo] = [luminance(hex(a)), luminance(hex(b))].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05) }
function shellTokens() {
  const rules = rulesOf(read(SHELL_CSS))
  const set = selector => Object.fromEntries(rules.find(r => r.selectors.includes(selector)).nodes.filter(n => n.type === 'decl').map(n => [n.prop, n.value]))
  return { light: set('[data-studio-v4-shell="true"]'), dark: set('.dark [data-studio-v4-shell="true"]') }
}
const ERROR = { light: '#ad4248', dark: '#ef9a8f' }
// CSS specificity (a, b, c) of one selector: attributes, classes and pseudo-classes count as b, elements as c, :where() as nothing, :is() and :not() as their strongest argument
function selectorSpecificity(selector) {
  const argsOf = (text, open) => { let depth = 1, i = open; while (depth && i < text.length) { i++; if (text[i] === '(') depth++; else if (text[i] === ')') depth-- } return [text.slice(open + 1, i), i] }
  const splitTop = text => { const out = []; let depth = 0, from = 0; for (let i = 0; i < text.length; i++) { if (text[i] === '(' || text[i] === '[') depth++; else if (text[i] === ')' || text[i] === ']') depth--; else if (text[i] === ',' && !depth) { out.push(text.slice(from, i)); from = i + 1 } } out.push(text.slice(from)); return out }
  let a = 0, b = 0, c = 0, rest = selector
  for (;;) {
    const m = /:(where|is|not)\(/.exec(rest)
    if (!m) break
    const open = m.index + m[0].length - 1, [inner, end] = argsOf(rest, open)
    if (m[1] !== 'where') { const strongest = splitTop(inner).map(selectorSpecificity).reduce((x, y) => { for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? x : y; return x }, [0, 0, 0]); a += strongest[0]; b += strongest[1]; c += strongest[2] }
    rest = rest.slice(0, m.index) + rest.slice(end + 1)
  }
  rest = rest.replace(/\[[^\]]*\]/g, () => { b++; return ' ' })
  rest = rest.replace(/::[\w-]+/g, () => { c++; return ' ' })
  rest = rest.replace(/:[\w-]+/g, () => { b++; return ' ' })
  rest = rest.replace(/\.[\w-]+/g, () => { b++; return ' ' })
  rest = rest.replace(/#[\w-]+/g, () => { a++; return ' ' })
  for (const token of rest.split(/[\s>+~]+/).filter(Boolean)) if (token !== '*') c++
  return [a, b, c]
}
// the calculator itself, proved on known selectors
for (const [selector, expected] of [['a', [0, 0, 1]], ['.x', [0, 1, 0]], ['[x="y"] p', [0, 1, 1]], [':where(h2, p)', [0, 0, 0]], [':is(button, [x])', [0, 1, 0]], ['a:hover:not(:disabled)', [0, 2, 1]], ['.dark [x] [y] > p', [0, 3, 1]], ['[x] :where(button, [y]):hover', [0, 2, 0]], ['#i .c', [1, 1, 0]]]) deepEq(selectorSpecificity(selector), expected, `specificity of ${selector}`)
function proveCss(css, uiSource = SOURCES[UI], label = 'css') {
  const root = postcss.parse(css)
  const rules = rulesOf(css)
  ok(rules.length > 40, `${label}: a real stylesheet`)
  // 1. scope: every selector names the page's marker or is the dark prefix of one; nothing touches another page
  for (const rule of rules) {
    if (rule.parent?.type === 'atrule' && rule.parent.name === 'keyframes') continue
    for (const selector of rule.selectors) {
      match(selector, /^(\.dark )?\[data-studio-v4-shell="true"\] /, `${label}: ${selector}: only under the Studio shell (light or dark)`)
      match(selector, /\[data-studio-p2-profile/, `${label}: ${selector}: scoped to the page's own marker`)
      nomatch(selector, /data-studio-settings|data-studio-p2-account|data-studio-p2-details|^body|\s(html|body)\b|:root|\.sp-/, `${label}: ${selector}: touches no other page's marker`)
    }
  }
  // 2. every marker the CSS names exists in the component
  const markers = new Set([...css.matchAll(/\[(data-studio-p2-profile[\w-]*)/g)].map(m => m[1]))
  ok(markers.size >= 18, `${label}: names its markers (${markers.size})`)
  for (const marker of markers) ok(uiSource.includes(marker), `${label}: the component carries ${marker}`)
  // 3. tokens: every var() exists in the shell's light and dark set; the only literals are the error pair
  const { light, dark } = shellTokens()
  const used = new Set(); root.walkDecls(d => { for (const m of d.value.matchAll(/var\((--[\w-]+)/g)) used.add(m[1]) })
  for (const token of used) { ok(token in light, `${label}: ${token} is in the shell's light set`); ok(token in dark, `${label}: ${token} is in the shell's dark set`) }
  const literals = new Set(); root.walkDecls(d => { for (const m of d.value.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g)) literals.add(m[0].toLowerCase()) })
  deepEq([...literals].sort(), [ERROR.dark, ERROR.light].sort(), `${label}: the only literal colours are the error pair`)
  // 4. the error red is the dark one under .dark and the light one otherwise
  const errorColors = []
  root.walkRules(rule => rule.walkDecls(d => { if (/#[0-9a-f]{6}/i.test(d.value)) errorColors.push([rule.selector.startsWith('.dark ') ? 'dark' : 'light', d.prop, d.value.toLowerCase()]) }))
  deepEq(errorColors.sort(), [['dark', 'border-color', ERROR.dark], ['dark', 'color', ERROR.dark], ['light', 'border-color', ERROR.light], ['light', 'color', ERROR.light]].sort(), `${label}: the error red: light for light, dark for dark, on the colour and the input's border`)
  // 5. readable in both themes (WCAG AA 4.5:1 for text)
  for (const [theme, tokens] of [['light', light], ['dark', dark]]) {
    for (const [fg, bg] of [['--ss-text', '--ss-panel'], ['--ss-muted', '--ss-panel'], ['--ss-teal', '--ss-panel'], ['--ss-teal', '--ss-active'], ['--ss-text', '--ss-surface'], ['--ss-text', '--ss-field'], ['--ss-on-action', '--ss-action']]) ok(contrast(tokens[fg], tokens[bg]) >= 4.5, `${label}: ${theme}: ${fg} on ${bg} is at least 4.5:1 (${contrast(tokens[fg], tokens[bg]).toFixed(2)})`)
    ok(contrast(ERROR[theme], tokens['--ss-panel']) >= 4.5, `${label}: ${theme}: the error red on the panel is at least 4.5:1 (${contrast(ERROR[theme], tokens['--ss-panel']).toFixed(2)})`)
  }
  // 6. type scale: nothing under 10px; the title is 17px; fields 13px; body 12px
  root.walkDecls('font-size', d => ok(parseFloat(d.value) >= 10, `${label}: font-size ${d.value} is at least 10px`))
  const decl = (selectorPart, prop) => { const rule = rules.find(r => r.selectors.some(s => s.includes(selectorPart) && !s.startsWith('.dark') && r.parent?.type === 'root')); ok(rule, `${label}: a rule for ${selectorPart}`); return rule.nodes.find(n => n.type === 'decl' && n.prop === prop)?.value }
  eq(decl('[data-studio-p2-profile-header="true"] h2', 'font-size'), '17px', `${label}: the card title is 17px (the shell's section-title size)`)
  eq(decl('[data-studio-p2-profile-header="true"] h2', 'font-weight'), '600', `${label}: the card title is 600`)
  eq(decl('[data-studio-p2-profile-field] > input', 'font-size'), '13px', `${label}: the name input is 13px`)
  eq(decl('[data-studio-p2-profile-field] > input', 'height'), '36px', `${label}: the name input is 36px high`)
  eq(decl('[data-studio-p2-profile-field] > input', 'border-radius'), '7px', `${label}: the name input has the shell's 7px corners`)
  const card = rules.find(r => r.selectors.includes('[data-studio-v4-shell="true"] [data-studio-p2-profile="true"]'))
  ok(card, `${label}: a rule for the card`)
  eq(card.nodes.find(n => n.prop === 'border-radius')?.value, '12px', `${label}: the card has the shell's 12px corners`)
  eq(card.nodes.find(n => n.prop === 'background')?.value, 'var(--ss-panel)', `${label}: the card is the panel colour`)
  eq(decl('[data-studio-p2-profile-save="true"]', 'background'), 'var(--ss-action)', `${label}: Save is the ink action colour (violet stays for AI)`)
  eq(decl('[data-studio-p2-profile-save="true"]', 'color'), 'var(--ss-on-action)', `${label}: Save's text is the on-action token`)
  eq(decl('[data-studio-p2-profile-avatar="true"]', 'width'), '72px', `${label}: the avatar is 72px`)
  eq(decl('[data-studio-p2-profile-initials="true"]', 'background'), 'var(--ss-active)', `${label}: the initials circle is the active tint, not a gradient`)
  eq(decl('[data-studio-p2-profile-initials="true"]', 'color'), 'var(--ss-teal)', `${label}: the initials are teal`)
  eq(decl('[data-studio-p2-profile="true"] :where(button', 'min-height'), '32px', `${label}: buttons are 32px high`)
  nomatch(css, /gradient/, `${label}: no gradient`)
  nomatch(css, /!important/, `${label}: no !important (the page fights nothing)`)
  // 7. controls: hover only when on, a visible focus ring, a disabled look
  for (const rule of rules) for (const selector of rule.selectors) if (selector.includes(':hover')) match(selector, /:hover:not\(:disabled\)/, `${label}: ${selector}: hover never lights a disabled control`)
  ok(rules.some(r => r.selectors.some(s => s.includes(':focus-visible')) && r.nodes.some(n => n.prop === 'outline' && n.value === '2px solid var(--ss-accent)')), `${label}: a 2px accent focus ring`)
  ok(rules.some(r => r.selectors.some(s => s.includes('button:disabled')) && r.nodes.some(n => n.prop === 'cursor' && n.value === 'not-allowed')), `${label}: disabled controls look and feel off`)
  ok(rules.some(r => r.selectors.some(s => s.includes('[data-studio-p2-profile-status="true"]:empty')) && r.nodes.some(n => n.prop === 'display' && n.value === 'none')), `${label}: the empty status line takes no room`)
  // 8. motion: every animation runs only where the person has not asked for less
  root.walkDecls('animation', d => { const at = d.parent.parent; ok(at?.type === 'atrule' && at.name === 'media' && at.params === '(prefers-reduced-motion: no-preference)', `${label}: ${d.value} runs only with no reduced-motion preference`) })
  const keyframes = []; root.walkAtRules('keyframes', a => keyframes.push(a.params)); deepEq(keyframes.sort(), ['studio-p2-profile-pulse', 'studio-p2-profile-spin'], `${label}: two keyframes`)
  // 9. narrow screens and short windows
  const media = []; root.walkAtRules('media', a => media.push(a.params))
  for (const query of ['(max-width: 767px)', '(max-width: 420px)', '(min-width: 768px) and (max-height: 760px)', '(prefers-reduced-motion: no-preference)']) ok(media.includes(query), `${label}: a ${query} block`)
  const phone = rules.filter(r => r.parent?.type === 'atrule' && r.parent.params === '(max-width: 767px)')
  ok(phone.some(r => r.selectors.some(s => s.includes('[data-studio-p2-profile-plan="true"]')) && r.nodes.some(n => n.prop === 'flex-wrap' && n.value === 'wrap')), `${label}: phone: the plan row wraps`)
  ok(phone.some(r => r.nodes.some(n => n.prop === 'padding' && n.value === '16px')), `${label}: phone: 16px gutters`)
  const tiny = rules.filter(r => r.parent?.type === 'atrule' && r.parent.params === '(max-width: 420px)')
  ok(tiny.some(r => r.selectors.some(s => s.includes('[data-studio-p2-profile-actions="true"]')) && r.nodes.some(n => n.prop === 'width' && n.value === '100%')), `${label}: 420px: the actions take the full row`)
  // 10. specificity (computed): a rule meant to win over a generic one beside it does
  const spec = selectorSpecificity
  const byExact = selector => { const rule = rules.find(r => r.selectors.includes(selector)); ok(rule, `${label}: a rule for ${selector}`); return rule }
  const SH = '[data-studio-v4-shell="true"] [data-studio-p2-profile="true"]'
  const gt = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]; return false }
  const generic = `${SH} :where(button, [data-studio-p2-profile-link])`
  ok(gt(spec(`${SH} [data-studio-p2-profile-save="true"]`), spec(generic)), `${label}: Save's ink outranks the generic control look`)
  ok(gt(spec(`${SH} [data-studio-p2-profile-save="true"]:hover:not(:disabled)`), spec(`${generic}:hover:not(:disabled)`)), `${label}: Save's ink hover outranks the generic hover`)
  const declsOfRule = rule => Object.fromEntries(rule.nodes.filter(n => n.type === 'decl').map(n => [n.prop, n.value]))
  deepEq(declsOfRule(byExact(`${SH} [data-studio-p2-profile-save="true"]`)), { 'border-color': 'var(--ss-action)', background: 'var(--ss-action)', color: 'var(--ss-on-action)' }, `${label}: Save is the ink action: border, fill and text`)
  deepEq(declsOfRule(byExact(`${SH} [data-studio-p2-profile-save="true"]:hover:not(:disabled)`)), { background: 'var(--ss-action-hover)' }, `${label}: Save's hover is the ink hover token`)
  const emptyLink = `${SH} [data-studio-p2-profile-empty="true"] [data-studio-p2-profile-link]`
  deepEq(declsOfRule(byExact(emptyLink)), { 'margin-top': '10px', 'border-color': 'var(--ss-action)', background: 'var(--ss-action)', color: 'var(--ss-on-action)' }, `${label}: the signed-out "Sign in" is the ink action`)
  deepEq(declsOfRule(byExact(`${emptyLink}:hover:not(:disabled)`)), { background: 'var(--ss-action-hover)' }, `${label}: "Sign in" hover is the ink hover token`)
  byExact(`${SH} [data-studio-p2-profile-error="true"]`); byExact(`.dark ${SH} [data-studio-p2-profile-error="true"]`); byExact('[data-studio-v4-shell="true"] [data-studio-p2-profile-who="true"] > p'); byExact(generic); byExact(`${generic}:hover:not(:disabled)`)
  ok(gt(spec(emptyLink), spec(generic)) && gt(spec(`${emptyLink}:hover:not(:disabled)`), spec(`${generic}:hover:not(:disabled)`)), `${label}: the signed-out "Sign in" is the ink action and outranks the generic look, hover included`)
  ok(gt(spec(`${SH} [data-studio-p2-profile-error="true"]`), spec('[data-studio-v4-shell="true"] [data-studio-p2-profile-who="true"] > p')), `${label}: the error rule outranks "who > p" (a direct child p, so red wins over muted)`)
  ok(gt(spec(`.dark ${SH} [data-studio-p2-profile-error="true"]`), spec(`${SH} [data-studio-p2-profile-error="true"]`)), `${label}: the dark error red outranks the light one`)
  for (const rule of rules) for (const selector of rule.selectors) { if (rule.parent?.type === 'atrule' && rule.parent.name === 'keyframes') continue; ok(!gt([0, 2, 0], spec(selector)), `${label}: ${selector} is at least (0,2,0), so it beats any single utility class (Avatar's h-10 w-10, bg-muted)`) }
  ok(rules.some(r => r.selectors.some(s => s.includes(':where(h2, p, strong, small)'))), `${label}: the margin reset is :where (adds no specificity, so a later margin wins)`)
}
proveCss(SOURCES[CSS])

// ---------------------------------------------------------------- 5. env and package
function proveEnv(env, label = 'env') {
  const lines = env.split('\n')
  eq(lines.filter(l => l.startsWith(`${FLAG}=`)).length, 1, `${label}: the flag is declared once`)
  eq(lines.find(l => l.startsWith(`${FLAG}=`)), `${FLAG}="false"`, `${label}: default off`)
  const index = lines.findIndex(l => l.startsWith(`${FLAG}=`))
  match(lines[index - 1], /^# /, `${label}: the flag follows its comment`)
  const block = lines.slice(0, index).reverse().findIndex(l => l.trim() === '')
  const comment = lines.slice(index - block, index).join('\n')
  match(comment, /PASS2 Profile page/, `${label}: the comment names the page`)
  match(comment, /exact "true"/, `${label}: the comment says exact "true"`)
  match(comment, /NEXT_PUBLIC_STUDIO_V4_SHELL/, `${label}: the comment says it needs the shell`)
  match(comment, /READ AT BUILD TIME/, `${label}: the comment says build time`)
  match(comment, /no mockup/, `${label}: the comment says there is no mockup`)
  match(comment, /no new action/, `${label}: the comment says no new action`)
  match(env, new RegExp(`\\n${FLAG}="false"\\n(?:$|\\n)`), `${label}: the flag ends its own block (a later change's block may follow)`)
  // .env.example is a file every flag-gated change appends to: the base's lines must all still be there, in order, and what is added must be comments, blanks and env lines
  const want = baseSource(ENV).split('\n'), extras = []
  let next = 0
  for (const line of env.split('\n')) { if (next < want.length && line === want[next]) next++; else extras.push(line) }
  eq(next, want.length, `${label}: every line of the base commit's .env.example is still there, in order`)
  ok(extras.every(line => /^\s*$|^\s*#|^[A-Z][A-Z0-9_]*=/.test(line)), `${label}: what is added is comments, blanks and env lines`)
  ok(extras.includes(`${FLAG}="false"`), `${label}: the flag's line is among them`)
}
proveEnv(SOURCES[ENV])
function provePackage(pkg, label = 'package') {
  const json = JSON.parse(pkg)
  eq(json.scripts['test:studio-p2-profile-page'], 'node scripts/test-studio-p2-profile-page.mjs', `${label}: the test script`)
  const base = JSON.parse(baseSource(PKG))
  const added = Object.keys(json.scripts).filter(key => !(key in base.scripts))
  ok(added.includes('test:studio-p2-profile-page'), `${label}: the test script is new`)
  ok(added.every(key => /^test:[a-z0-9-]+$/.test(key) && /^node scripts\/test-[a-z0-9-]+\.mjs$/.test(json.scripts[key])), `${label}: what is added (here and by later stacked changes) is test scripts only`)
  for (const key of Object.keys(base.scripts)) eq(json.scripts[key], base.scripts[key], `${label}: ${key} is unchanged`)
  deepEq({ ...json, scripts: null }, { ...base, scripts: null }, `${label}: nothing but the scripts changed`)
}
provePackage(SOURCES[PKG])

// ---------------------------------------------------------------- 6. mutation check
const MUTANTS = []
const mutant = (file, name, from, to) => MUTANTS.push([file, name, from, to])
// lib: limits and words
mutant(LIB, 'name limit', 'STUDIO_PROFILE_NAME_MAX = 80', 'STUDIO_PROFILE_NAME_MAX = 100')
mutant(LIB, 'photo limit', 'STUDIO_PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024', 'STUDIO_PROFILE_PHOTO_MAX_BYTES = 10 * 1024 * 1024')
mutant(LIB, 'a photo type dropped', "'image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const", "'image/jpeg', 'image/png', 'image/webp'] as const")
mutant(LIB, 'a photo type added', "'image/gif'] as const", "'image/gif', 'image/svg+xml'] as const")
for (const [key, value] of Object.entries(WORDS)) mutant(LIB, `word ${key}`, `${key}: '${value.replace(/'/g, "\\'")}'`, `${key}: '${value.replace(/'/g, "\\'")} '`)
mutant(LIB, 'an import added', 'export const STUDIO_PROFILE_NAME_MAX', "import { cn } from '@/lib/utils'\nexport const STUDIO_PROFILE_NAME_MAX")
mutant(LIB, 'initials: not a string is read', "if (typeof name !== 'string') return 'U'", '')
mutant(LIB, 'initials: split on one space only', 'name.split(/\\s+/)', "name.split(' ')")
mutant(LIB, 'initials: empty words kept', '.filter(Boolean)', '')
mutant(LIB, 'initials: three letters', '.filter(Boolean).slice(0, 2)', '.filter(Boolean).slice(0, 3)')
mutant(LIB, 'initials: one letter', '.filter(Boolean).slice(0, 2)', '.filter(Boolean).slice(0, 1)')
mutant(LIB, 'initials: every word', '.filter(Boolean).slice(0, 2)', '.filter(Boolean)')
mutant(LIB, 'initials: lower case', ".join('').toUpperCase()", ".join('')")
mutant(LIB, 'initials: UTF-16 halves', 'Array.from(word)[0]', 'word[0]')
mutant(LIB, 'initials: no fallback', "return letters || 'U'", 'return letters')
mutant(LIB, 'initials: fallback word', "return letters || 'U'", "return letters || '?'")
mutant(LIB, 'name: not trimmed', "typeof name === 'string' ? name.trim() : ''", "typeof name === 'string' ? name : ''")
mutant(LIB, 'name: empty allowed', 'return trimmed && trimmed.length <= STUDIO_PROFILE_NAME_MAX ?', 'return trimmed.length <= STUDIO_PROFILE_NAME_MAX ?')
mutant(LIB, 'name: limit exclusive', 'trimmed.length <= STUDIO_PROFILE_NAME_MAX', 'trimmed.length < STUDIO_PROFILE_NAME_MAX')
mutant(LIB, 'name: no limit', 'trimmed && trimmed.length <= STUDIO_PROFILE_NAME_MAX ?', 'trimmed ?')
mutant(LIB, 'name: non-text accepted', "typeof name === 'string' ? name.trim() : ''", "typeof name === 'string' ? name.trim() : String(name ?? 'x')")
mutant(LIB, 'name: the problem sentence', "'Use a display name between 1 and 80 characters.'", "'Display name is required'")
mutant(LIB, 'photo: no file is a problem', "if (!file) return ''", "if (!file) return 'Choose a JPEG, PNG, WebP, or GIF image.'")
mutant(LIB, 'photo: no type check', "if (!(STUDIO_PROFILE_PHOTO_TYPES as readonly unknown[]).includes(file.type)) return 'Choose a JPEG, PNG, WebP, or GIF image.'", '')
mutant(LIB, 'photo: type sentence', "'Choose a JPEG, PNG, WebP, or GIF image.'", "'Invalid file type.'")
mutant(LIB, 'photo: empty allowed', "if (typeof file.size !== 'number' || !(file.size > 0)) return 'This image is empty. Choose another file.'", "if (typeof file.size !== 'number') return 'This image is empty. Choose another file.'")
mutant(LIB, 'photo: a text size accepted', "typeof file.size !== 'number' || !(file.size > 0)", '!(file.size > 0)')
mutant(LIB, 'photo: empty sentence', "'This image is empty. Choose another file.'", "'Empty.'")
mutant(LIB, 'photo: limit inclusive', 'file.size > STUDIO_PROFILE_PHOTO_MAX_BYTES', 'file.size >= STUDIO_PROFILE_PHOTO_MAX_BYTES')
mutant(LIB, 'photo: no size check', "if (file.size > STUDIO_PROFILE_PHOTO_MAX_BYTES) return 'Choose an account photo smaller than 5 MB.'", '')
mutant(LIB, 'photo: size sentence', "return 'Choose an account photo smaller than 5 MB.'\n  return ''", "return 'Too big.'\n  return ''")
mutant(LIB, 'photo: size before type', "  if (!(STUDIO_PROFILE_PHOTO_TYPES as readonly unknown[]).includes(file.type)) return 'Choose a JPEG, PNG, WebP, or GIF image.'\n", "  if (file.size > STUDIO_PROFILE_PHOTO_MAX_BYTES) return 'Choose an account photo smaller than 5 MB.'\n  if (!(STUDIO_PROFILE_PHOTO_TYPES as readonly unknown[]).includes(file.type)) return 'Choose a JPEG, PNG, WebP, or GIF image.'\n")
mutant(LIB, 'failure: name fallback', "name: 'Your display name could not be saved. Your edit is still here.'", "name: 'Failed to update profile'")
mutant(LIB, 'failure: photo fallback', "photo: 'Your account photo could not be uploaded. Try again.'", "photo: 'Failed to upload avatar'")
mutant(LIB, 'failure: no signed-out sentence', "if (code === 401) return 'Your session has ended. Sign in again, then try once more.'", '')
mutant(LIB, 'failure: signed-out sentence', "'Your session has ended. Sign in again, then try once more.'", "'Unauthorized'")
mutant(LIB, 'failure: signed out only on photo', 'if (code === 401)', "if (code === 401 && kind === 'photo')")
mutant(LIB, 'failure: no 413 sentence', "if (code === 413) return kind === 'photo' ? 'Choose an account photo smaller than 5 MB.' : FAILURE[kind]", '')
mutant(LIB, 'failure: 413 for names too', "return kind === 'photo' ? 'Choose an account photo smaller than 5 MB.' : FAILURE[kind]", "return 'Choose an account photo smaller than 5 MB.'")
mutant(LIB, 'failure: 413 sentence', "return kind === 'photo' ? 'Choose an account photo smaller than 5 MB.'", "return kind === 'photo' ? 'Too big.'")
mutant(LIB, 'failure: any status passes the reason on', 'code >= 400 && code < 500 && typeof reason', 'typeof reason')
mutant(LIB, 'failure: 5xx passes the reason on', 'code >= 400 && code < 500 &&', 'code >= 400 &&')
mutant(LIB, 'failure: 3xx passes the reason on', 'code >= 400 && code < 500 &&', 'code >= 300 && code < 500 &&')
mutant(LIB, 'failure: 4xx stops at 498', 'code < 500 &&', 'code < 499 &&')
mutant(LIB, 'failure: a non-text reason passed on', "typeof reason === 'string' && reason.trim()", 'reason')
mutant(LIB, 'failure: a blank reason passed on', "typeof reason === 'string' && reason.trim()", "typeof reason === 'string'")
mutant(LIB, 'failure: reason not trimmed', 'return reason.trim()', 'return reason')
mutant(LIB, 'failure: a text status is read', "typeof status === 'number' ? status : 0", 'Number(status) || 0')
mutant(LIB, 'failure: a missing body crashes', "body && typeof body === 'object' ? (body as { error?: unknown }).error : undefined", '(body as { error?: unknown }).error')
mutant(LIB, 'saved: refreshed sentence', "return refreshed ? saved : `${saved} ${STUDIO_PROFILE_WORDS.reload}`", 'return saved')
mutant(LIB, 'saved: always reload', "return refreshed ? saved : `${saved} ${STUDIO_PROFILE_WORDS.reload}`", 'return `${saved} ${STUDIO_PROFILE_WORDS.reload}`')
mutant(LIB, 'saved: kinds swapped', "kind === 'name' ? STUDIO_PROFILE_WORDS.nameSaved : STUDIO_PROFILE_WORDS.photoSaved", "kind === 'name' ? STUDIO_PROFILE_WORDS.photoSaved : STUDIO_PROFILE_WORDS.nameSaved")
mutant(LIB, 'tier: non-text read', "if (typeof tier !== 'string') return null", '')
mutant(LIB, 'tier: free shows', "if (!id || id === 'free') return null", "if (!id) return null")
mutant(LIB, 'tier: blank shows', "if (!id || id === 'free') return null", "if (id === 'free') return null")
mutant(LIB, 'tier: free is case-sensitive', "const id = tier.trim().toLowerCase()", "const id = tier.trim()")
mutant(LIB, 'tier: not trimmed', "const id = tier.trim().toLowerCase()", "const id = tier.toLowerCase()")
mutant(LIB, 'tier: premium is not Max', "{ id, label: 'Max' }", "{ id, label: 'Premium' }")
mutant(LIB, 'tier: label not capitalised', "label: id.charAt(0).toUpperCase() + id.slice(1)", "label: id")
mutant(LIB, 'tier: label shouts', "label: id.charAt(0).toUpperCase() + id.slice(1)", "label: id.toUpperCase()")
mutant(LIB, 'tier: premium id lost', "if (id === 'premium') return { id, label: 'Max' }", "if (id === 'premium') return { id: 'max', label: 'Max' }")
// component
mutant(UI, 'loading ignored', 'if (isLoading) {', 'if (false) {')
mutant(UI, 'loading is not a status', '<section data-studio-p2-profile="true" data-studio-p2-profile-state="loading" role="status" aria-busy="true">', '<section data-studio-p2-profile="true" data-studio-p2-profile-state="loading" aria-busy="true">')
mutant(UI, 'loading is not busy', 'role="status" aria-busy="true">', 'role="status">')
mutant(UI, 'loading is silent', '<span className="sr-only">{W.loading}</span>', '')
mutant(UI, 'loading is not screen-reader only', '<span className="sr-only">{W.loading}</span>', '<span>{W.loading}</span>')
mutant(UI, 'loading has fewer bars', '<i data-studio-p2-profile-bar="field" />\n          <i data-studio-p2-profile-bar="field" />', '<i data-studio-p2-profile-bar="field" />')
mutant(UI, 'loading shows controls', '<span className="sr-only">{W.loading}</span>', '<button type="button">x</button>')
mutant(UI, 'signed out is blank', 'if (!user) {', 'if (false) {')
mutant(UI, 'signed out wins over loading', 'if (isLoading) {', 'if (isLoading && user) {')
mutant(UI, 'signed out link target', 'href="/auth/signin"', 'href="/"')
mutant(UI, 'signed out link word', '{W.signIn}</Link>', '{W.planAction}</Link>')
mutant(UI, 'signed out body missing', '<p>{W.signedOutBody}</p>', '')
mutant(UI, 'signed out title missing', '<h2 id="studio-p2-profile-title">{W.signedOutTitle}</h2>', '<h2 id="studio-p2-profile-title">{W.title}</h2>')
mutant(UI, 'signed out state name', 'data-studio-p2-profile-state="signed-out"', 'data-studio-p2-profile-state="empty"')
mutant(UI, 'signed out unlabelled', '<section data-studio-p2-profile="true" data-studio-p2-profile-state="signed-out" aria-labelledby="studio-p2-profile-title">', '<section data-studio-p2-profile="true" data-studio-p2-profile-state="signed-out">')
mutant(UI, 'page marker lost', '<section data-studio-p2-profile="true" data-studio-p2-profile-state="ready"', '<section data-studio-p2-profile-x="true" data-studio-p2-profile-state="ready"')
mutant(UI, 'ready state name', 'data-studio-p2-profile-state="ready"', 'data-studio-p2-profile-state="loaded"')
mutant(UI, 'ready unlabelled', 'data-studio-p2-profile-state="ready" aria-labelledby="studio-p2-profile-title"', 'data-studio-p2-profile-state="ready"')
mutant(UI, 'busy never shown', 'aria-busy={busy}>', '>')
mutant(UI, 'busy only for names', 'const busy = operation !== null', 'const busy = operation === "name"')
mutant(UI, 'title not a heading', '<h2 id="studio-p2-profile-title">{W.title}</h2>', '<div id="studio-p2-profile-title">{W.title}</div>')
mutant(UI, 'title word', '<h2 id="studio-p2-profile-title">{W.title}</h2>', '<h2 id="studio-p2-profile-title">{W.nameLabel}</h2>')
mutant(UI, 'lede missing', '<p>{W.lede}</p>', '')
mutant(UI, 'edit word', '{W.edit}</button>', '{W.cancel}</button>')
mutant(UI, 'edit never disabled', 'onClick={startEditing} disabled={busy}', 'onClick={startEditing}')
mutant(UI, 'edit does not open', 'const startEditing = () => {\n    setName(user.name || "")\n    setNotice("")\n    setEditing(true)\n  }', 'const startEditing = () => {\n    setName(user.name || "")\n    setNotice("")\n  }')
mutant(UI, 'edit starts empty', 'setName(user.name || "")', 'setName("")')
mutant(UI, 'edit keeps the old word', 'setName(user.name || "")\n    setNotice("")\n    setEditing(true)', 'setName(user.name || "")\n    setEditing(true)')
mutant(UI, 'cancel keeps editing', 'const cancelEditing = () => {\n    setEditing(false)\n    setNameError("")\n  }', 'const cancelEditing = () => {\n    setNameError("")\n  }')
mutant(UI, 'cancel keeps the problem', 'setEditing(false)\n    setNameError("")\n  }', 'setEditing(false)\n  }')
mutant(UI, 'cancel word', '{W.cancel}</button>', '{W.save}</button>')
mutant(UI, 'cancel can submit', 'data-studio-p2-profile-cancel="true" onClick', 'type="submit" data-studio-p2-profile-cancel="true" onClick')
mutant(UI, 'cancel enabled in flight', 'onClick={cancelEditing} disabled={busy}', 'onClick={cancelEditing}')
mutant(UI, 'save enabled in flight', 'onClick={() => void saveName()} disabled={busy}', 'onClick={() => void saveName()}')
mutant(UI, 'save word', '{operation === "name" ? W.saving : W.save}', '{operation === "name" ? W.uploading : W.save}')
mutant(UI, 'saving word missing', '{operation === "name" ? W.saving : W.save}', '{W.save}')
mutant(UI, 'save button type', '<button type="button" data-studio-p2-profile-save="true"', '<button type="submit" data-studio-p2-profile-save="true"')
mutant(UI, 'saving by photo', '{operation === "name" ? W.saving : W.save}', '{operation ? W.saving : W.save}')
mutant(UI, 'edit button type', '<button type="button" data-studio-p2-profile-edit="true"', '<button data-studio-p2-profile-edit="true"')
mutant(UI, 'avatar not shared', '<Avatar data-studio-p2-profile-avatar="true">', '<div data-studio-p2-profile-avatar="true">')
mutant(UI, 'avatar src dropped', 'src={user.image || undefined}', 'src={undefined}')
mutant(UI, 'avatar alt', 'alt={`${user.name || "Your"} account photo`}', 'alt="User avatar"')
mutant(UI, 'avatar alt fallback', '${user.name || "Your"}', '${user.name || "My"}')
mutant(UI, 'avatar alt for no name', '${user.name || "Your"}', '${user.name}')
mutant(UI, 'initials lost', '{studioProfileInitials(user.name)}', 'U')
mutant(UI, 'initials from email', '{studioProfileInitials(user.name)}', '{studioProfileInitials(user.email)}')
mutant(UI, 'fallback has a gradient', '<AvatarFallback data-studio-p2-profile-initials="true">', '<AvatarFallback data-studio-p2-profile-initials="true" className="bg-gradient-to-br from-purple-500 to-blue-500">')
mutant(UI, 'fallback has a colour class', '<AvatarFallback data-studio-p2-profile-initials="true">', '<AvatarFallback data-studio-p2-profile-initials="true" className="text-purple-700">')
mutant(UI, 'name row lost', '<strong>{user.name || W.nameUnset}</strong>', '')
mutant(UI, 'name row unset word', '<strong>{user.name || W.nameUnset}</strong>', '<strong>{user.name}</strong>')
mutant(UI, 'badge always', '{tier && <span data-studio-p2-profile-tier={tier.id}>{tier.label}</span>}', '<span data-studio-p2-profile-tier={tier?.id}>{tier?.label}</span>')
mutant(UI, 'badge never', '{tier && <span data-studio-p2-profile-tier={tier.id}>{tier.label}</span>}', '')
mutant(UI, 'badge id lost', '<span data-studio-p2-profile-tier={tier.id}>', '<span data-studio-p2-profile-tier="x">')
mutant(UI, 'badge label lost', '{tier.label}</span>', '{tier.id}</span>')
mutant(UI, 'badge from another field', 'const tier = studioProfileTier(user.tier)', 'const tier = studioProfileTier(user.email)')
mutant(UI, 'email missing in identity', '<p>{user.email}</p>', '')
mutant(UI, 'photo button is a div', '<button type="button" data-studio-p2-profile-photo="true"', '<div data-studio-p2-profile-photo="true"')
mutant(UI, 'photo button can submit', '<button type="button" data-studio-p2-profile-photo="true"', '<button type="submit" data-studio-p2-profile-photo="true"')
mutant(UI, 'photo button never disabled', 'onClick={() => fileInput.current?.click()} disabled={busy}', 'onClick={() => fileInput.current?.click()}')
mutant(UI, 'photo button does not open the chooser', 'onClick={() => fileInput.current?.click()}', 'onClick={() => undefined}')
mutant(UI, 'photo button word', '{operation === "photo" ? W.uploading : W.changePhoto}', '{W.changePhoto}')
mutant(UI, 'photo button uploading word', '{operation === "photo" ? W.uploading : W.changePhoto}', '{operation === "photo" ? W.saving : W.changePhoto}')
mutant(UI, 'photo button idle word', '{operation === "photo" ? W.uploading : W.changePhoto}', '{operation === "photo" ? W.uploading : W.edit}')
mutant(UI, 'photo button spinner lost', '{operation === "photo" ? <Loader2 size={14} aria-hidden="true" data-studio-p2-profile-spin="true" /> : <Camera size={14} aria-hidden="true" />}', '<Camera size={14} aria-hidden="true" />')
mutant(UI, 'photo button camera lost', '{operation === "photo" ? <Loader2 size={14} aria-hidden="true" data-studio-p2-profile-spin="true" /> : <Camera size={14} aria-hidden="true" />}', '{operation === "photo" ? <Loader2 size={14} aria-hidden="true" data-studio-p2-profile-spin="true" /> : null}')
mutant(UI, 'spinner marker lost', 'aria-hidden="true" data-studio-p2-profile-spin="true" />', 'aria-hidden="true" />')
mutant(UI, 'photo hint missing', '<small>{W.photoHint}</small>', '')
mutant(UI, 'photo error elsewhere', '{photoError && <p data-studio-p2-profile-error="true" role="alert">{photoError}</p>}', '')
mutant(UI, 'photo error not announced', '<p data-studio-p2-profile-error="true" role="alert">{photoError}</p>', '<p data-studio-p2-profile-error="true">{photoError}</p>')
mutant(UI, 'photo error text', '{photoError}</p>', '{nameError}</p>')
mutant(UI, 'file input visible', 'type="file" hidden aria-label', 'type="file" aria-label')
mutant(UI, 'file input unnamed', ' aria-label="Upload account photo"', '')
mutant(UI, 'file input accepts anything', 'accept={STUDIO_PROFILE_PHOTO_TYPES.join(",")}', 'accept="image/*"')
mutant(UI, 'file input never disabled', 'accept={STUDIO_PROFILE_PHOTO_TYPES.join(",")} disabled={busy}', 'accept={STUDIO_PROFILE_PHOTO_TYPES.join(",")}')
mutant(UI, 'file input not reset', 'event.target.value = ""', '')
mutant(UI, 'file input reset before the read', 'onChange={(event) => { void uploadPhoto(event.target.files?.[0]); event.target.value = "" }}', 'onChange={(event) => { event.target.value = ""; void uploadPhoto(event.target.files?.[0]) }}')
mutant(UI, 'file input reads the wrong file', 'event.target.files?.[0]', 'event.target.files?.[1]')
mutant(UI, 'status line not live', '<p data-studio-p2-profile-status="true" role="status">{notice}</p>', '<p data-studio-p2-profile-status="true">{notice}</p>')
mutant(UI, 'status line only when there is a word', '<p data-studio-p2-profile-status="true" role="status">{notice}</p>', '{notice && <p data-studio-p2-profile-status="true" role="status">{notice}</p>}')
mutant(UI, 'status line shows the error', '<p data-studio-p2-profile-status="true" role="status">{notice}</p>', '<p data-studio-p2-profile-status="true" role="status">{notice || nameError}</p>')
mutant(UI, 'label always plain', '{editing ? <label htmlFor="studio-p2-profile-name">{W.nameLabel}</label> : <span>{W.nameLabel}</span>}', '<span>{W.nameLabel}</span>')
mutant(UI, 'label always a label', '{editing ? <label htmlFor="studio-p2-profile-name">{W.nameLabel}</label> : <span>{W.nameLabel}</span>}', '<label htmlFor="studio-p2-profile-name">{W.nameLabel}</label>')
mutant(UI, 'label not tied', '<label htmlFor="studio-p2-profile-name">', '<label>')
mutant(UI, 'label word', '<label htmlFor="studio-p2-profile-name">{W.nameLabel}</label>', '<label htmlFor="studio-p2-profile-name">{W.emailLabel}</label>')
mutant(UI, 'input id', 'id="studio-p2-profile-name"\n              value', 'id="x"\n              value')
mutant(UI, 'input value', 'value={name}', 'value={user.name}')
mutant(UI, 'input does not type', 'onChange={(event) => { setName(event.target.value); setNameError("") }}', 'onChange={(event) => { setNameError("") }}')
mutant(UI, 'input keeps the problem', 'onChange={(event) => { setName(event.target.value); setNameError("") }}', 'onChange={(event) => { setName(event.target.value) }}')
mutant(UI, 'input placeholder', 'placeholder={W.namePlaceholder}', 'placeholder=""')
mutant(UI, 'input limit', 'maxLength={STUDIO_PROFILE_NAME_MAX}', 'maxLength={120}')
mutant(UI, 'input autocomplete', 'autoComplete="name"', 'autoComplete="off"')
mutant(UI, 'input never disabled', 'autoComplete="name"\n              disabled={busy}', 'autoComplete="name"')
mutant(UI, 'input never invalid', 'aria-invalid={Boolean(nameError)}', 'aria-invalid={false}')
mutant(UI, 'input always invalid', 'aria-invalid={Boolean(nameError)}', 'aria-invalid={true}')
mutant(UI, 'input not described', 'aria-describedby={`studio-p2-profile-name-help${nameError ? " studio-p2-profile-name-error" : ""}`}', '')
mutant(UI, 'input never points at the problem', '${nameError ? " studio-p2-profile-name-error" : ""}', '')
mutant(UI, 'input always points at the problem', '${nameError ? " studio-p2-profile-name-error" : ""}', ' studio-p2-profile-name-error')
mutant(UI, 'static value always', '{editing ? (\n            <input', '{false ? (\n            <input')
mutant(UI, 'static value unset mark', 'data-studio-p2-profile-unset={user.name ? undefined : "true"}', 'data-studio-p2-profile-unset={undefined}')
mutant(UI, 'static value unset word', '>{user.name || W.nameUnset}</strong>\n          )}', '>{user.name}</strong>\n          )}')
mutant(UI, 'name problem not announced', '<p id="studio-p2-profile-name-error" data-studio-p2-profile-error="true" role="alert">', '<p id="studio-p2-profile-name-error" data-studio-p2-profile-error="true">')
mutant(UI, 'name problem id', 'id="studio-p2-profile-name-error"', 'id="x"')
mutant(UI, 'name problem hidden', '{nameError && <p id="studio-p2-profile-name-error"', '{false && <p id="studio-p2-profile-name-error"')
mutant(UI, 'name note id', '<small id="studio-p2-profile-name-help">', '<small id="x">')
mutant(UI, 'name note word', '{W.nameHelp}</small>', '{W.photoHint}</small>')
mutant(UI, 'email editable', '<strong data-studio-p2-profile-value="true">{user.email}</strong>', '<input data-studio-p2-profile-value="true" value={user.email} />')
mutant(UI, 'email note missing', '<small>{W.emailNote}</small>', '')
mutant(UI, 'email label word', '<span>{W.emailLabel}</span>', '<span>{W.nameLabel}</span>')
mutant(UI, 'plan link target', 'href="/billing"', 'href="/pricing"')
mutant(UI, 'plan word', '<strong>{W.planTitle}</strong>', '<strong>{W.nameLabel}</strong>')
mutant(UI, 'plan note missing', '<p>{W.planNote}</p>', '')
mutant(UI, 'plan action word', '{W.planAction}</Link>', '{W.edit}</Link>')
mutant(UI, 'a new link', '<small>{W.photoHint}</small>', '<small>{W.photoHint}</small><Link href="/studio/details">Your details</Link>')
mutant(UI, 'a new button', '<small>{W.photoHint}</small>', '<small>{W.photoHint}</small><button type="button">Remove photo</button>')
// component: the name request
mutant(UI, 'save: no guard when busy', 'async function saveName() {\n    if (busy) return', 'async function saveName() {')
mutant(UI, 'save: problem not checked', 'if (problem) { setNameError(problem); return }', '')
mutant(UI, 'save: problem not shown', 'if (problem) { setNameError(problem); return }', 'if (problem) return')
mutant(UI, 'save: problem sent anyway', 'if (problem) { setNameError(problem); return }', 'if (problem) { setNameError(problem) }')
mutant(UI, 'save: untrimmed', 'const trimmed = name.trim()', 'const trimmed = name')
mutant(UI, 'save: not busy', 'setOperation("name"); setNameError(""); setPhotoError(""); setNotice("")', 'setNameError(""); setPhotoError(""); setNotice("")')
mutant(UI, 'save: keeps the photo problem', 'setOperation("name"); setNameError(""); setPhotoError(""); setNotice("")', 'setOperation("name"); setNameError(""); setNotice("")')
mutant(UI, 'save: keeps the old word', 'setOperation("name"); setNameError(""); setPhotoError(""); setNotice("")', 'setOperation("name"); setNameError(""); setPhotoError("")')
mutant(UI, 'save: url', 'fetch("/api/profile", { method: "PATCH"', 'fetch("/api/account", { method: "PATCH"')
mutant(UI, 'save: method', 'method: "PATCH"', 'method: "PUT"')
mutant(UI, 'save: header', '"Content-Type": "application/json"', '"Content-Type": "text/plain"')
mutant(UI, 'save: body', 'body: JSON.stringify({ name: trimmed })', 'body: JSON.stringify({ name })')
mutant(UI, 'save: body extra field', 'body: JSON.stringify({ name: trimmed })', 'body: JSON.stringify({ name: trimmed, tier: "premium" })')
mutant(UI, 'save: unreadable reply crashes', 'const body = await response.json().catch(() => ({}))\n      if (!response.ok) { setNameError', 'const body = await response.json()\n      if (!response.ok) { setNameError')
mutant(UI, 'save: refusal not checked', 'if (!response.ok) { setNameError(studioProfileFailure("name", response.status, body)); return }', '')
mutant(UI, 'save: refusal not shown', 'setNameError(studioProfileFailure("name", response.status, body)); return }', 'return }')
mutant(UI, 'save: refusal status dropped', 'studioProfileFailure("name", response.status, body)', 'studioProfileFailure("name", 0, body)')
mutant(UI, 'save: refusal body dropped', 'studioProfileFailure("name", response.status, body)', 'studioProfileFailure("name", response.status, null)')
mutant(UI, 'save: refusal as photo', 'studioProfileFailure("name", response.status, body)', 'studioProfileFailure("photo", response.status, body)')
mutant(UI, 'save: refusal closes the form', 'if (!response.ok) { setNameError(studioProfileFailure("name", response.status, body)); return }', 'if (!response.ok) { setNameError(studioProfileFailure("name", response.status, body)); setEditing(false); return }')
mutant(UI, 'save: session not refreshed', 'const refreshed = await update({ name: trimmed }).then(() => true, () => false)', 'const refreshed = true')
mutant(UI, 'save: session refreshed with the raw name', 'update({ name: trimmed })', 'update({ name })')
mutant(UI, 'save: session refresh failure is an error', 'const refreshed = await update({ name: trimmed }).then(() => true, () => false)', 'const refreshed = await update({ name: trimmed }).then(() => true)')
mutant(UI, 'save: refresh failure unseen', '.then(() => true, () => false)\n      setEditing(false)\n      setNotice(studioProfileSaved("name", refreshed))', '.then(() => true, () => false)\n      setEditing(false)\n      setNotice(studioProfileSaved("name", true))')
mutant(UI, 'save: stays editing', 'setEditing(false)\n      setNotice(studioProfileSaved("name", refreshed))', 'setNotice(studioProfileSaved("name", refreshed))')
mutant(UI, 'save: no word', 'setNotice(studioProfileSaved("name", refreshed))', '')
mutant(UI, 'save: word of the other kind', 'setNotice(studioProfileSaved("name", refreshed))', 'setNotice(studioProfileSaved("photo", refreshed))')
mutant(UI, 'save: offline unsaid', 'setNameError(studioProfileFailure("name", 0, null))\n    } finally', 'void 0\n    } finally')
mutant(UI, 'save: offline words', 'setNameError(studioProfileFailure("name", 0, null))\n    } finally', 'setNameError("Network error. Please try again.")\n    } finally')
mutant(UI, 'save: stays busy', 'setOperation(null)\n    }\n  }\n\n  async function uploadPhoto', 'void 0\n    }\n  }\n\n  async function uploadPhoto')
// component: the photo request
mutant(UI, 'photo: no file is a request', 'if (!file || busy) return', 'if (busy) return')
mutant(UI, 'photo: no guard when busy', 'if (!file || busy) return', 'if (!file) return')
mutant(UI, 'photo: old problem kept', 'setPhotoError(""); setNotice("")\n    const problem', 'setNotice("")\n    const problem')
mutant(UI, 'photo: old word kept', 'setPhotoError(""); setNotice("")\n    const problem', 'setPhotoError("")\n    const problem')
mutant(UI, 'photo: problem not checked', 'if (problem) { setPhotoError(problem); return }', '')
mutant(UI, 'photo: problem not shown', 'if (problem) { setPhotoError(problem); return }', 'if (problem) return')
mutant(UI, 'photo: problem sent anyway', 'if (problem) { setPhotoError(problem); return }', 'if (problem) { setPhotoError(problem) }')
mutant(UI, 'photo: not busy', 'setOperation("photo")\n    try', 'try')
mutant(UI, 'photo: field name', 'form.append("avatar", file)', 'form.append("file", file)')
mutant(UI, 'photo: not the file', 'form.append("avatar", file)', 'form.append("avatar", file.name)')
mutant(UI, 'photo: url', 'fetch("/api/profile/avatar"', 'fetch("/api/profile"')
mutant(UI, 'photo: method', 'method: "POST", body: form', 'method: "PUT", body: form')
mutant(UI, 'photo: body', 'method: "POST", body: form', 'method: "POST", body: file')
mutant(UI, 'photo: a hand-set content type', 'method: "POST", body: form', 'method: "POST", headers: { "Content-Type": "multipart/form-data" }, body: form')
mutant(UI, 'photo: unreadable reply crashes', 'const body = await response.json().catch(() => ({}))\n      if (!response.ok) { setPhotoError', 'const body = await response.json()\n      if (!response.ok) { setPhotoError')
mutant(UI, 'photo: refusal not checked', 'if (!response.ok) { setPhotoError(studioProfileFailure("photo", response.status, body)); return }', '')
mutant(UI, 'photo: refusal not shown', 'setPhotoError(studioProfileFailure("photo", response.status, body)); return }', 'return }')
mutant(UI, 'photo: refusal status dropped', 'studioProfileFailure("photo", response.status, body)', 'studioProfileFailure("photo", 0, body)')
mutant(UI, 'photo: refusal body dropped', 'studioProfileFailure("photo", response.status, body)', 'studioProfileFailure("photo", response.status, null)')
mutant(UI, 'photo: refusal as name', 'studioProfileFailure("photo", response.status, body)', 'studioProfileFailure("name", response.status, body)')
mutant(UI, 'photo: image not read', 'const image = body && typeof body.image === "string" ? body.image : ""', 'const image = body.image')
mutant(UI, 'photo: non-text image accepted', 'typeof body.image === "string" ? body.image : ""', 'body.image ? body.image : ""')
mutant(UI, 'photo: no image is a success', 'if (!image) { setPhotoError(studioProfileFailure("photo", 0, null)); return }', '')
mutant(UI, 'photo: no image unsaid', 'if (!image) { setPhotoError(studioProfileFailure("photo", 0, null)); return }', 'if (!image) return')
mutant(UI, 'photo: session not refreshed', 'const refreshed = await update({ image }).then(() => true, () => false)', 'const refreshed = true')
mutant(UI, 'photo: session refreshed with nothing', 'update({ image })', 'update({})')
mutant(UI, 'photo: session refreshed with the name', 'update({ image })', 'update({ name: image })')
mutant(UI, 'photo: refresh failure is an error', 'const refreshed = await update({ image }).then(() => true, () => false)', 'const refreshed = await update({ image }).then(() => true)')
mutant(UI, 'photo: refresh failure unseen', 'setNotice(studioProfileSaved("photo", refreshed))', 'setNotice(studioProfileSaved("photo", true))')
mutant(UI, 'photo: no word', 'setNotice(studioProfileSaved("photo", refreshed))', '')
mutant(UI, 'photo: word of the other kind', 'setNotice(studioProfileSaved("photo", refreshed))', 'setNotice(studioProfileSaved("name", refreshed))')
mutant(UI, 'photo: offline unsaid', 'setPhotoError(studioProfileFailure("photo", 0, null))\n    } finally', 'void 0\n    } finally')
mutant(UI, 'photo: offline words', 'setPhotoError(studioProfileFailure("photo", 0, null))\n    } finally', 'setPhotoError("Upload failed")\n    } finally')
mutant(UI, 'photo: stays busy', 'setOperation(null)\n    }\n  }\n\n  return (', 'void 0\n    }\n  }\n\n  return (')
// the old page's marker and the shared avatar import
mutant(UI, 'avatar import', 'import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"', '')
mutant(UI, 'stylesheet import', 'import "./studio-p2-profile-page.css"', '')
// page wiring
mutant(PAGE, 'wrapper: always the new page', 'return STUDIO_P2_PROFILE_PAGE ? <StudioProfilePage /> : <LegacyProfileSettingsPage />', 'return <StudioProfilePage />')
mutant(PAGE, 'wrapper: never the new page', 'return STUDIO_P2_PROFILE_PAGE ? <StudioProfilePage /> : <LegacyProfileSettingsPage />', 'return <LegacyProfileSettingsPage />')
mutant(PAGE, 'wrapper: swapped', 'return STUDIO_P2_PROFILE_PAGE ? <StudioProfilePage /> : <LegacyProfileSettingsPage />', 'return STUDIO_P2_PROFILE_PAGE ? <LegacyProfileSettingsPage /> : <StudioProfilePage />')
mutant(PAGE, 'flag: no shell needed', 'STUDIO_SHELL && process.env.NEXT_PUBLIC_STUDIO_P2_PROFILE_PAGE === "true"', 'process.env.NEXT_PUBLIC_STUDIO_P2_PROFILE_PAGE === "true"')
mutant(PAGE, 'flag: any value', 'process.env.NEXT_PUBLIC_STUDIO_P2_PROFILE_PAGE === "true"', 'Boolean(process.env.NEXT_PUBLIC_STUDIO_P2_PROFILE_PAGE)')
mutant(PAGE, 'flag: loose case', 'process.env.NEXT_PUBLIC_STUDIO_P2_PROFILE_PAGE === "true"', 'process.env.NEXT_PUBLIC_STUDIO_P2_PROFILE_PAGE?.toLowerCase() === "true"')
mutant(PAGE, 'flag: the account flag', 'process.env.NEXT_PUBLIC_STUDIO_P2_PROFILE_PAGE === "true"', 'process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true"')
mutant(PAGE, 'flag: or the account flag', 'process.env.NEXT_PUBLIC_STUDIO_P2_PROFILE_PAGE === "true"', 'process.env.NEXT_PUBLIC_STUDIO_P2_PROFILE_PAGE === "true" || process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true"')
mutant(PAGE, 'import dropped', 'import { StudioProfilePage } from "@/components/settings/studio-p2-profile-page"\n', '')
mutant(PAGE, 'old page: the loading words changed', 'Loading…</div>', 'Loading your profile…</div>')
mutant(PAGE, 'old page: the title changed', '<CardTitle>Profile Information</CardTitle>', '<CardTitle>Profile information</CardTitle>')
mutant(PAGE, 'old page: the gradient dropped', 'bg-gradient-to-br from-purple-500 to-blue-500', 'bg-muted')
mutant(PAGE, 'old page: the error words changed', '"Network error. Please try again."', '"Could not save."')
mutant(PAGE, 'old page: the marker dropped', 'data-studio-p2-account={STUDIO_P2_ACCOUNT ? "true" : undefined}', '')
mutant(PAGE, 'old page: the dynamic export dropped', 'export const dynamic = "force-dynamic"\n', '')
// css
mutant(CSS, 'header: unscoped', '[data-studio-v4-shell="true"] [data-studio-p2-profile-header="true"] h2 {', '[data-studio-p2-profile-header="true"] h2 {')
mutant(CSS, 'title: 24px', 'h2 { font-size: 17px; line-height: 24px; font-weight: 600; letter-spacing: -.01em; }', 'h2 { font-size: 24px; line-height: 24px; font-weight: 600; letter-spacing: -.01em; }')
mutant(CSS, 'title: weight', 'h2 { font-size: 17px; line-height: 24px; font-weight: 600; letter-spacing: -.01em; }', 'h2 { font-size: 17px; line-height: 24px; font-weight: 700; letter-spacing: -.01em; }')
mutant(CSS, 'save: violet', '[data-studio-p2-profile-save="true"] { border-color: var(--ss-action); background: var(--ss-action); color: var(--ss-on-action); }', '[data-studio-p2-profile-save="true"] { border-color: var(--ss-accent); background: var(--ss-accent); color: var(--ss-on-action); }')
mutant(CSS, 'save: text colour', '[data-studio-p2-profile-save="true"] { border-color: var(--ss-action); background: var(--ss-action); color: var(--ss-on-action); }', '[data-studio-p2-profile-save="true"] { border-color: var(--ss-action); background: var(--ss-action); color: var(--ss-text); }')
mutant(CSS, 'save: outranked by the generic look', '[data-studio-v4-shell="true"] [data-studio-p2-profile="true"] [data-studio-p2-profile-save="true"] { border-color', '[data-studio-v4-shell="true"] [data-studio-p2-profile-save="true"] { border-color')
mutant(CSS, 'save hover: outranked by the generic hover', '[data-studio-v4-shell="true"] [data-studio-p2-profile="true"] [data-studio-p2-profile-save="true"]:hover:not(:disabled)', '[data-studio-v4-shell="true"] [data-studio-p2-profile-save="true"]:hover:not(:disabled)')
mutant(CSS, 'save hover: colour', '[data-studio-p2-profile-save="true"]:hover:not(:disabled) { background: var(--ss-action-hover); }', '[data-studio-p2-profile-save="true"]:hover:not(:disabled) { background: var(--ss-surface); }')
mutant(CSS, 'generic look: is() outranks', ':where(button, [data-studio-p2-profile-link]) { display', ':is(button, [data-studio-p2-profile-link]) { display')
mutant(CSS, 'sign in: not ink', '[data-studio-p2-profile-empty="true"] [data-studio-p2-profile-link] { margin-top: 10px; border-color: var(--ss-action); background: var(--ss-action); color: var(--ss-on-action); }', '[data-studio-p2-profile-empty="true"] [data-studio-p2-profile-link] { margin-top: 10px; }')
mutant(CSS, 'sign in: violet', '[data-studio-p2-profile-empty="true"] [data-studio-p2-profile-link] { margin-top: 10px; border-color: var(--ss-action); background: var(--ss-action);', '[data-studio-p2-profile-empty="true"] [data-studio-p2-profile-link] { margin-top: 10px; border-color: var(--ss-accent); background: var(--ss-accent);')
mutant(CSS, 'sign in: outranked', '[data-studio-v4-shell="true"] [data-studio-p2-profile="true"] [data-studio-p2-profile-empty="true"] [data-studio-p2-profile-link] {', '[data-studio-v4-shell="true"] [data-studio-p2-profile-empty="true"] [data-studio-p2-profile-link] {')
mutant(CSS, 'initials: gradient', 'background: var(--ss-active); color: var(--ss-teal); font-size: 22px;', 'background: linear-gradient(135deg, #a855f7, #3b82f6); color: var(--ss-teal); font-size: 22px;')
mutant(CSS, 'initials: colour', 'color: var(--ss-teal); font-size: 22px;', 'color: var(--ss-muted); font-size: 22px;')
mutant(CSS, 'avatar: size', 'width: 72px; height: 72px; flex-shrink: 0; border: 1px solid var(--ss-line); background: var(--ss-active); }', 'width: 64px; height: 72px; flex-shrink: 0; border: 1px solid var(--ss-line); background: var(--ss-active); }')
mutant(CSS, 'token: not in the shell', 'color: var(--ss-teal); font-size: 10px;', 'color: var(--ss-violet); font-size: 10px;')
mutant(CSS, 'token: literal colour', 'background: var(--ss-field); color: var(--ss-text); font-size: 13px; }', 'background: #f5f7f6; color: var(--ss-text); font-size: 13px; }')
mutant(CSS, 'input: font size', 'color: var(--ss-text); font-size: 13px; }', 'color: var(--ss-text); font-size: 16px; }')
mutant(CSS, 'input: height', 'height: 36px; padding: 0 10px;', 'height: 40px; padding: 0 10px;')
mutant(CSS, 'input: corners', 'padding: 0 10px; border: 1px solid var(--ss-line); border-radius: 7px;', 'padding: 0 10px; border: 1px solid var(--ss-line); border-radius: 4px;')
mutant(CSS, 'card: corners', 'border: 1px solid var(--ss-line); border-radius: 12px; overflow: hidden; }', 'border: 1px solid var(--ss-line); border-radius: 8px; overflow: hidden; }')
mutant(CSS, 'buttons: height', 'min-height: 32px; padding: 0 12px;', 'min-height: 28px; padding: 0 12px;')
mutant(CSS, 'error: light red', 'font-size: 12px; line-height: 18px; color: #ad4248; }', 'font-size: 12px; line-height: 18px; color: #e57373; }')
mutant(CSS, 'error: dark red', '[data-studio-p2-profile-error="true"] { color: #ef9a8f; }', '[data-studio-p2-profile-error="true"] { color: #8b1a1a; }')
mutant(CSS, 'error: dark rule dropped', '.dark [data-studio-v4-shell="true"] [data-studio-p2-profile="true"] [data-studio-p2-profile-error="true"] { color: #ef9a8f; }\n', '')
mutant(CSS, 'error: border dark dropped', '.dark [data-studio-v4-shell="true"] [data-studio-p2-profile-field] > input[aria-invalid="true"] { border-color: #ef9a8f; }\n', '')
mutant(CSS, 'error: border light dropped', '[data-studio-v4-shell="true"] [data-studio-p2-profile-field] > input[aria-invalid="true"] { border-color: #ad4248; }\n', '')
mutant(CSS, 'error: outranked', '[data-studio-v4-shell="true"] [data-studio-p2-profile="true"] [data-studio-p2-profile-error="true"] { margin-top: 6px;', '[data-studio-v4-shell="true"] [data-studio-p2-profile-error="true"] { margin-top: 6px;')
mutant(CSS, 'reset: outranks', ':where(h2, p, strong, small) { margin: 0; }', ':is(h2, p, strong, small) { margin: 0; }')
mutant(CSS, 'muted: faint', '[data-studio-p2-profile-header="true"] p { margin-top: 3px; font-size: 12px; line-height: 20px; color: var(--ss-muted); }', '[data-studio-p2-profile-header="true"] p { margin-top: 3px; font-size: 9px; line-height: 20px; color: var(--ss-muted); }')
mutant(CSS, 'important', '[data-studio-p2-profile-status="true"]:empty { display: none; }', '[data-studio-p2-profile-status="true"]:empty { display: none !important; }')
mutant(CSS, 'hover: lights disabled', ':where(button, [data-studio-p2-profile-link]):hover:not(:disabled) {', ':where(button, [data-studio-p2-profile-link]):hover {')
mutant(CSS, 'save hover: lights disabled', '[data-studio-p2-profile-save="true"]:hover:not(:disabled) {', '[data-studio-p2-profile-save="true"]:hover {')
mutant(CSS, 'focus ring: gone', 'outline: 2px solid var(--ss-accent); outline-offset: 2px; box-shadow: none; }', 'outline: none; }')
mutant(CSS, 'focus ring: thin', 'outline: 2px solid var(--ss-accent);', 'outline: 1px solid var(--ss-accent);')
mutant(CSS, 'disabled: cursor', 'button:disabled { opacity: .55; cursor: not-allowed; }', 'button:disabled { opacity: .55; }')
mutant(CSS, 'status: takes room when empty', '[data-studio-p2-profile-status="true"]:empty { display: none; }', '')
mutant(CSS, 'motion: pulse always', '@media (prefers-reduced-motion: no-preference) {\n  [data-studio-v4-shell="true"] [data-studio-p2-profile-bar] { animation: studio-p2-profile-pulse 1.4s ease-in-out infinite; }', '[data-studio-v4-shell="true"] [data-studio-p2-profile-bar] { animation: studio-p2-profile-pulse 1.4s ease-in-out infinite; }\n@media (prefers-reduced-motion: no-preference) {')
mutant(CSS, 'motion: spin always', '  [data-studio-v4-shell="true"] [data-studio-p2-profile-spin="true"] { animation: studio-p2-profile-spin 1s linear infinite; }\n}', '}\n[data-studio-v4-shell="true"] [data-studio-p2-profile-spin="true"] { animation: studio-p2-profile-spin 1s linear infinite; }')
mutant(CSS, 'motion: keyframes renamed', '@keyframes studio-p2-profile-spin', '@keyframes studio-p2-profile-spun')
mutant(CSS, 'phone: block dropped', '@media (max-width: 767px) {', '@media (max-width: 700px) {')
mutant(CSS, 'phone: plan does not wrap', '[data-studio-p2-profile-plan="true"] { flex-wrap: wrap; }', '[data-studio-p2-profile-plan="true"] { flex-wrap: nowrap; }')
mutant(CSS, 'phone: gutters', 'padding: 16px; }\n  [data-studio-v4-shell="true"] [data-studio-p2-profile-plan="true"] { flex-wrap', 'padding: 20px; }\n  [data-studio-v4-shell="true"] [data-studio-p2-profile-plan="true"] { flex-wrap')
mutant(CSS, 'narrow: actions', '[data-studio-p2-profile-actions="true"] { width: 100%; }', '[data-studio-p2-profile-actions="true"] { width: auto; }')
mutant(CSS, 'short window: block dropped', '@media (min-width: 768px) and (max-height: 760px) {', '@media (min-width: 768px) and (max-height: 700px) {')
mutant(CSS, 'marker: a name the component lacks', '[data-studio-p2-profile-namerow="true"] > strong', '[data-studio-p2-profile-nameline="true"] > strong')
mutant(CSS, 'scope: another page', '[data-studio-v4-shell="true"] [data-studio-p2-profile-header="true"] { display: flex;', '[data-studio-v4-shell="true"] [data-studio-p2-profile-header="true"], [data-studio-settings-heading] { display: flex;')
mutant(CSS, 'scope: the whole body', '[data-studio-v4-shell="true"] [data-studio-p2-profile="true"] :where(h2, p, strong, small) { margin: 0; }', 'h2 { margin: 0; }\n[data-studio-v4-shell="true"] [data-studio-p2-profile="true"] :where(h2, p, strong, small) { margin: 0; }')
mutant(CSS, 'bars: gradient', '[data-studio-p2-profile-bar] { display: block; border-radius: 6px; background: var(--ss-soft); }', '[data-studio-p2-profile-bar] { display: block; border-radius: 6px; background: linear-gradient(var(--ss-soft), var(--ss-line)); }')
// env and package
mutant(ENV, 'env: default on', `${FLAG}="false"`, `${FLAG}="true"`)
mutant(ENV, 'env: renamed', `${FLAG}="false"`, `NEXT_PUBLIC_STUDIO_P2_PROFILE="false"`)
mutant(ENV, 'env: declared twice', `${FLAG}="false"\n`, `${FLAG}="false"\n${FLAG}="false"\n`)
mutant(ENV, 'env: build time unsaid', 'READ AT BUILD TIME: set it on Vercel, then redeploy. On: the profile card', 'READ AT RUN TIME: set it on Vercel, then redeploy. On: the profile card')
mutant(ENV, 'env: shell unsaid', '# (NEXT_PUBLIC_STUDIO_V4_SHELL "true"); without it the classic page renders untouched. READ AT BUILD TIME: set it on Vercel, then redeploy. On: the profile card', '# (the shell); without it the classic page renders untouched. READ AT BUILD TIME: set it on Vercel, then redeploy. On: the profile card')
mutant(ENV, 'env: exact true unsaid', 'there is no mockup for it): an exact "true" turns it on', 'there is no mockup for it): any value turns it on')
mutant(ENV, 'env: no mockup unsaid', 'there is no mockup for it', 'there is a mockup for it')
mutant(ENV, 'env: new action unsaid', 'the way to Billing; no new action.', 'the way to Billing; one new action.')
mutant(ENV, 'env: the base changed', 'NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN="false"', 'NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN="true"')
mutant(PKG, 'package: script missing', ',\n    "test:studio-p2-profile-page": "node scripts/test-studio-p2-profile-page.mjs"', '')
mutant(PKG, 'package: script target', 'node scripts/test-studio-p2-profile-page.mjs', 'node scripts/test-studio-p2-profile.mjs')
mutant(PKG, 'package: another script changed', '"test:studio-p2-landing": "node scripts/test-studio-p2-landing.mjs"', '"test:studio-p2-landing": "node scripts/test-studio-p2-landing.mjs --x"')
mutant(PKG, 'package: a non-test script added', '"test:studio-p2-profile-page": "node scripts/test-studio-p2-profile-page.mjs"', '"test:studio-p2-profile-page": "node scripts/test-studio-p2-profile-page.mjs",\n    "postinstall": "node scripts/x.mjs"')

let killed = 0, byAssertion = 0, byCrash = 0
const survivors = [], invalid = []
counting = false
for (const [file, name, from, to] of MUTANTS) {
  const source = SOURCES[file]
  if (source.split(from).length - 1 !== 1) { invalid.push(`${name} (${source.split(from).length - 1} matches in ${file})`); continue }
  const mutated = source.replace(from, () => to)
  assert.notEqual(mutated, source, `mutant "${name}" changes the source`)
  let survived = false
  try {
    if (file === LIB) { const L = proveLib(mutated, 'mutant'); await proveComponent(SOURCES[UI], 'mutant', mutated); void L }
    else if (file === UI) await proveComponent(mutated, name)
    else if (file === PAGE) proveWiring(mutated, name)
    else if (file === CSS) proveCss(mutated, SOURCES[UI], name)
    else if (file === ENV) proveEnv(mutated, name)
    else if (file === PKG) provePackage(mutated, name)
    survived = true
  } catch (error) {
    if (error?.code === 'ERR_ASSERTION') byAssertion++
    else { byCrash++; assert.ok(/^(TypeError|ReferenceError|SyntaxError)/.test(String(error)), `mutant "${name}": a crash, not a harness fault: ${error}`) }
    killed++
  }
  if (survived) survivors.push(name)
}
counting = true
assert.deepEqual(invalid, [], `mutants whose text is missing or not unique: ${invalid.join('; ')}`)
assert.deepEqual(survivors, [], `mutants survived: ${survivors.join(', ')}`)
eq(killed, MUTANTS.length, 'every mutant is killed')

console.log(`Studio P2 profile page: ${checks} checks passed, ${killed}/${MUTANTS.length} mutants killed (${byAssertion} by an assertion, ${byCrash} by the code throwing); no network.`)
