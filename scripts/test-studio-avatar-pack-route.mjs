// AVATAR-W5 Step A (server half): proof of the two same-origin routes of "my companions", GET /api/avatar/companions and GET /api/avatar/pack/<packId>/<path...>, their pure server modules
// lib/server/avatar-pack-link.ts (the link minter) and lib/server/avatar-pack-access.ts (flag, registry, path rules, the answers), and the two thin route files.
//   A. The modules, function by function (path safety table, registry parsing, ttl clamp and the redirect max-age, the signer's key shape, the dev stand-in, the minter choice, mintPackLink).
//   B. The handlers with fakes: every refusal (flag off, signed out, not the owner, unknown pack, erased pack, unsafe path, minter null, minter throws, a link that is not allowed, wrong method) is BYTE-IDENTICAL (status, every header, body);
//      flag off reads nothing but the two flags and never calls the session or the minter; the owner gets the 302 with its exact headers; the list shows an owner only their own entry and never the owner id.
//   C. The two real route files, run with stub next-auth / auth options / supabase: the session decides, the Supabase client is built only to sign for an owner, flag off is the one 404.
//   D. Flag-off identity and hygiene: no existing app file imports the new modules, no browser-side file names the new server variables, middleware does not match /api/avatar, no console calls, no credential-shaped literal.
//   E. MUTANTS: each is a one-line change to the real source and must be caught by A-C.
//   node scripts/test-studio-avatar-pack-route.mjs        Offline: global fetch throws; nothing reaches the network; no paid call.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'avatar-pack-'))
let checks = 0
const ok = (c, m) => { checks++; assert.ok(c, m) }
const eq = (a, b, m) => { checks++; assert.deepEqual(a, b, m) }
globalThis.fetch = () => { throw new Error('network is not allowed in this proof') }

let n = 0
async function load(source, replace = {}) {
  let js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  for (const [from, to] of Object.entries(replace)) js = js.split(`'${from}'`).join(`'${to}'`).split(`"${from}"`).join(`"${to}"`)
  const file = path.join(tmp, `m${n++}.mjs`)
  fs.writeFileSync(file, js)
  const url = pathToFileURL(file).href
  return { m: await import(url), url }
}
const stub = (name, body) => { const f = path.join(tmp, `${n++}-${name}`); fs.writeFileSync(f, body); return pathToFileURL(f).href }

const LINK_REL = 'lib/server/avatar-pack-link.ts'
const ACCESS_REL = 'lib/server/avatar-pack-access.ts'
const PACK_ROUTE_REL = 'app/api/avatar/pack/[packId]/[...path]/route.ts'
const COMPANIONS_ROUTE_REL = 'app/api/avatar/companions/route.ts'
const NEW_FILES = [LINK_REL, ACCESS_REL, PACK_ROUTE_REL, COMPANIONS_ROUTE_REL, 'scripts/test-studio-avatar-pack-route.mjs']
const SRC = { link: read(LINK_REL), access: read(ACCESS_REL), pack: read(PACK_ROUTE_REL), companions: read(COMPANIONS_ROUTE_REL) }

// Made-up values only: the ids are computed (a repeated letter), the users are user-a / user-b, the links are the fake db.test shape of Supabase's signed URL.
const ID = c => 'u-' + c.repeat(26)
const PACK_A = ID('a'), PACK_B = ID('b'), PACK_E = ID('e'), PACK_X = ID('x')
const USER_A = 'user-a', USER_B = 'user-b', USER_C = 'user-c'
const REGISTRY = JSON.stringify([
  { id: PACK_A, displayName: 'PK', owner: { userId: USER_A } },
  { id: PACK_B, displayName: 'Other', owner: { userId: USER_B } },
  { id: PACK_E, displayName: 'Gone', owner: { userId: USER_A }, erased: true },
])
const FLAG = 'NEXT_PUBLIC_STUDIO_MY_COMPANIONS'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const SERVICE_VAR = ['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_')
const DB = 'https://db.test'
const ENV_ON = { [SHELL]: 'true', [FLAG]: 'true', AVATAR_COMPANIONS_REGISTRY: REGISTRY, AVATAR_PACK_BUCKET: 'avatar-packs', NEXT_PUBLIC_SUPABASE_URL: DB }
const BASE = id => `/api/avatar/pack/${id}`
const MANIFEST = 'motion/manifest.json'
// A plain {method, url} stands in for the request: the handlers read nothing else, and a plain object keeps the URL exactly as written (a real Request would tidy "..", "%2e%2e" and backslashes away).
const reqFor = (id, rel, method = 'GET') => ({ method, url: `http://studio.test${BASE(id)}/${rel}` })
// Supabase's createSignedUrl shape: <project url>/storage/v1/object/sign/<bucket>/<packId>/<path>?token=...
const fakeLink = (i, origin = DB) => `${origin}/storage/v1/object/sign/avatar-packs/${i.packId}/${i.path}?token=fake-1`
function fakeMinter(answer) {
  const calls = []
  return { calls, async mint(input) { calls.push(input); return typeof answer === 'function' ? answer(input) : answer } }
}
const okMinter = () => fakeMinter(fakeLink)
const NOT_FOUND = JSON.stringify([404, [['cache-control', 'private, no-store'], ['content-type', 'application/json']], '{"error":"Not found"}'])
const sig = async res => JSON.stringify([res.status, [...res.headers].sort((a, b) => (a[0] < b[0] ? -1 : 1)), await res.text()])
const watched = env => { const reads = []; return { reads, env: new Proxy({ ...env }, { get: (t, k) => { reads.push(String(k)); return t[k] } }) } }

// ---------- path tables (one table through the link module, the access module and the route) ----------
const GOOD_PATHS = [
  'motion/manifest.json', 'portrait-512.webp', 'scene.webp', 'motion/celebrate_1.webp', 'motion/layers/brows_front_happy.webp', 'face/mouth_a.png',
  'a/b/c/d/e/f.webp', 'A_b-c.d.webp', '_x.png', '0.webp', 'x.webp.json', 'a'.repeat(128 - 5) + '.webp',
]
const BAD_PATHS = [
  '', '.', '..', '../a.webp', 'a/../b.webp', 'a/..', '%2e%2e/a.webp', 'a/%2e%2e/b.webp', '%2F', 'a%2Fb.webp', 'a%5Cb.webp', '%61.webp', 'a\\b.webp', '\\a.webp', 'a//b.webp', '/a.webp', 'a/', 'a.json/', '.hidden.webp', 'motion/.env.json',
  'a/.webp', '.webp', 'a/b/c/d/e/f/g.webp', 'a.gif', 'a.svg', 'a.webp.exe', 'a', 'a.WEBP', 'a.Json', ' a.webp', 'a b.webp', 'a\0.webp', 'a\n.webp', 'a\r.json', 'a\t.png', 'a\u2024\u2024/b.webp', '\uff0e\uff0e/a.webp', 'a\u2025b.webp',
  'caf\u00e9.webp', 'a.webp?x=1', 'a.webp#x', 'a:b.webp', 'a;b.json', 'a..b.webp', 'a/..b.webp', 'a../b.webp', '.a.webp', 'x'.repeat(129) + '.webp', 'a'.repeat(100) + '/' + 'a'.repeat(100) + '.webp', 'a/' + 'b'.repeat(200) + '.webp',
]

function sectionA(link, access, src) {
  const L = link, X = access
  // ---------- A1. ids and paths ----------
  const spawnPattern = read('lib/studio-avatar-spawn.ts').match(/export const PACK_ID_PATTERN = (\/.*\/)\n/)?.[1]
  eq(String(L.PACK_ID_PATTERN), spawnPattern, 'A id: the link module writes out lib/studio-avatar-spawn.ts\'s pack id pattern exactly')
  ok(src.access.includes(`const PACK_ID_PATTERN = ${spawnPattern}`), 'A id: and so does the access module')
  ok(src.access.includes(`const SEGMENT_PATTERN = ${String(L.PACK_SEGMENT_PATTERN)}`) && src.access.includes("const FILE_EXTENSIONS: readonly string[] = ['.json', '.webp', '.png']") && src.access.includes('const PATH_MAX_SEGMENTS = 6') && src.access.includes('const PATH_MAX_LENGTH = 200'), 'A path: both modules carry the same segment pattern, extensions and limits')
  eq([...L.PACK_FILE_EXTENSIONS], ['.json', '.webp', '.png'], 'A path: the extensions the player fetches')
  ok([PACK_A, PACK_B, PACK_X, 'u-' + '0'.repeat(26), 'u-' + 'a1'.repeat(13)].every(id => L.validPackId(id)), 'A id: made-up ids are valid')
  for (const bad of ['u-' + 'a'.repeat(25), 'u-' + 'a'.repeat(27), 'U-' + 'a'.repeat(26), 'u-' + 'A'.repeat(26), 'x-' + 'a'.repeat(26), 'u-' + 'a'.repeat(25) + '-', 'u-' + 'a'.repeat(25) + '.', PACK_A + '\n', '../' + PACK_A, '', null, undefined, 5, [PACK_A]]) ok(!L.validPackId(bad), `A id: ${JSON.stringify(bad)} refused`)
  for (const good of GOOD_PATHS) eq(L.safePackPath(good), good, `A path: ${good} allowed, unchanged`)
  for (const bad of BAD_PATHS) eq(L.safePackPath(bad), null, `A path: ${JSON.stringify(bad)} refused`)
  for (const bad of [null, undefined, 5, {}, ['a.webp']]) eq(L.safePackPath(bad), null, `A path: ${JSON.stringify(bad)} (not a string) refused`)
  eq(L.safePackPath('a'.repeat(100) + '/' + 'a'.repeat(94) + '.webp'), 'a'.repeat(100) + '/' + 'a'.repeat(94) + '.webp', 'A path: 200 characters exactly passes')
  eq(L.safePackPath('a'.repeat(100) + '/' + 'a'.repeat(95) + '.webp'), null, 'A path: 201 characters refused')

  // ---------- A2. the ttl and the redirect's max-age ----------
  for (const [input, want] of [[undefined, 300], ['', 300], ['abc', 300], ['12.5', 300], ['1e3', 300], ['0x10', 300], ['9999999999', 300], [NaN, 300], [Infinity, 300], [12.5, 300], [null, 300], [{}, 300],
    ['59', 60], ['0', 60], ['-5', 60], ['60', 60], ['61', 61], ['300', 300], [' 450 ', 450], ['900', 900], ['901', 900], ['99999', 900], [120, 120], [5, 60], [5000, 900]]) eq(L.clampTtlSeconds(input), want, `A ttl: ${JSON.stringify(input)} -> ${want}`)
  eq([L.linkTtlSeconds({}), L.linkTtlSeconds({ AVATAR_PACK_LINK_TTL_SECONDS: '120' }), L.linkTtlSeconds({ AVATAR_PACK_LINK_TTL_SECONDS: 'soon' }), L.linkTtlSeconds({ AVATAR_PACK_LINK_TTL_SECONDS: '5000' })], [300, 120, 300, 900], 'A ttl: from AVATAR_PACK_LINK_TTL_SECONDS')
  eq([L.redirectMaxAge(300), L.redirectMaxAge(60), L.redirectMaxAge(120), L.redirectMaxAge(900), L.redirectMaxAge(0), L.redirectMaxAge(-5), L.redirectMaxAge(NaN)], [60, 12, 24, 60, 0, 0, 0], 'A max-age: the redirect is kept at most 60 s and at most a fifth of the link')
  for (let ttl = 60; ttl <= 900; ttl++) {
    const age = L.redirectMaxAge(ttl)
    if (!(age === Math.min(60, Math.floor(ttl / 5)) && age <= 60 && age * 5 <= ttl && age < ttl)) throw new Error(`max-age ${age} is not well under the link life ${ttl}`)
  }
  checks++

  // ---------- A3. which links a browser may be sent to ----------
  for (const good of ['https://storage.test/sign/avatar-packs/u-x/motion/manifest.json?token=fake-1', 'https://storage.test/a', '/companions/maya/motion/manifest.json']) eq(L.safeLink(good), good, `A link: ${good} ok`)
  for (const bad of ['', 'http://storage.test/a', 'ftp://storage.test/a', 'javascript:alert(1)', 'data:text/plain,hi', '//evil.test/x', '/\\evil.test/x', '\\\\evil.test\\x', 'https://', 'https://someone@storage.test/a', 'https://storage.test/a b', 'https://storage.test/a\nSet-Cookie: x=1', 'https://storage.test/\u00e9', 'relative/path', 'https://storage.test/' + 'a'.repeat(2100), null, undefined, 5, {}]) eq(L.safeLink(bad), null, `A link: ${String(JSON.stringify(bad)).slice(0, 60)} refused`)
  eq(L.safeLink('/companions/maya/x.json', false), null, 'A link: a same-origin path is refused when only https is allowed')

  // ---------- A4. the Supabase signer ----------
  const signCalls = []
  const storage = answer => ({ async createSignedUrl(bucket, key, expiresIn) { signCalls.push({ bucket, key, expiresIn }); if (typeof answer === 'function') return answer(); return answer } })
  const good = { data: { signedUrl: 'https://storage.test/sign/avatar-packs/x/y.json?token=fake-1' }, error: null }
  const sm = L.supabasePackLinkMinter({ storage: storage(good), bucket: 'avatar-packs' })
  return (async () => {
    eq(await sm.mint({ packId: PACK_A, path: MANIFEST, ttlSeconds: 300 }), good.data.signedUrl, 'A signer: the signed link is the answer')
    eq(signCalls[0], { bucket: 'avatar-packs', key: `${PACK_A}/${MANIFEST}`, expiresIn: 300 }, 'A signer: the object key is <packId>/<path> in the named bucket')
    await sm.mint({ packId: PACK_A, path: 'portrait-512.webp', ttlSeconds: 5 })
    await sm.mint({ packId: PACK_A, path: 'portrait-512.webp', ttlSeconds: 99999 })
    eq([signCalls[1].expiresIn, signCalls[2].expiresIn], [60, 900], 'A signer: the life asked for is clamped to 60..900')
    const before = signCalls.length
    for (const [label, input] of [['bad pack id', { packId: 'u-short', path: MANIFEST, ttlSeconds: 300 }], ['dot-dot', { packId: PACK_A, path: '../x.json', ttlSeconds: 300 }], ['bad extension', { packId: PACK_A, path: 'a.gif', ttlSeconds: 300 }], ['absolute', { packId: PACK_A, path: '/a.json', ttlSeconds: 300 }], ['encoded', { packId: PACK_A, path: '%2e%2e/a.json', ttlSeconds: 300 }]]) {
      eq(await sm.mint(input), null, `A signer: ${label} -> null`)
    }
    eq(signCalls.length, before, 'A signer: a refused pack or path never reaches storage')
    for (const [label, answer] of [['an error', { data: null, error: { message: 'Object not found' } }], ['an error with data', { data: good.data, error: { message: 'x' } }], ['no data', { data: null, error: null }], ['an empty link', { data: { signedUrl: '' }, error: null }], ['an http link', { data: { signedUrl: 'http://storage.test/a.json' }, error: null }],
      ['a relative link', { data: { signedUrl: '/companions/maya/a.json' }, error: null }], ['a link with a user in it', { data: { signedUrl: 'https://someone@storage.test/a.json' }, error: null }], ['a throw', () => { throw new Error('boom') }], ['a rejection', () => Promise.reject(new Error('boom'))]]) {
      eq(await L.supabasePackLinkMinter({ storage: storage(answer), bucket: 'avatar-packs' }).mint({ packId: PACK_A, path: MANIFEST, ttlSeconds: 300 }), null, `A signer: ${label} -> null`)
    }
    for (const bucket of ['', 'a/b', '../x', 'a b', 'x'.repeat(101), undefined, 5]) {
      const b = signCalls.length
      eq(await L.supabasePackLinkMinter({ storage: storage(good), bucket }).mint({ packId: PACK_A, path: MANIFEST, ttlSeconds: 300 }), null, `A signer: bucket ${JSON.stringify(bucket)} -> null`)
      eq(signCalls.length, b, `A signer: bucket ${JSON.stringify(bucket)} never reaches storage`)
    }

    // ---------- A5. the dev stand-in ----------
    const asked = []
    const fileExists = rel => { asked.push(rel); return true }
    const dev = { NODE_ENV: 'development', AVATAR_PACK_DEV_STANDIN: 'true' }
    const stand = L.devStandInMinter({ env: dev, fileExists })
    eq([stand.active(), stand.active(dev), L.devStandInActive(dev)], [true, true, true], 'A stand-in: active in development with the variable "true"')
    eq(await stand.mint({ packId: PACK_A, path: MANIFEST, ttlSeconds: 300 }), '/companions/maya/motion/manifest.json', 'A stand-in: serves Maya\'s committed pack under the pack id')
    eq(asked, ['public/companions/maya/motion/manifest.json'], 'A stand-in: it looked for the file under public/companions/maya/')
    eq(await L.devStandInMinter({ env: dev, fileExists: () => false }).mint({ packId: PACK_A, path: MANIFEST, ttlSeconds: 300 }), null, 'A stand-in: a file that does not exist -> null')
    eq(await L.devStandInMinter({ env: dev, fileExists: () => { throw new Error('boom') } }).mint({ packId: PACK_A, path: MANIFEST, ttlSeconds: 300 }), null, 'A stand-in: a throwing file check -> null')
    eq(await L.devStandInMinter({ env: dev, fileExists: async () => true }).mint({ packId: PACK_A, path: MANIFEST, ttlSeconds: 300 }), '/companions/maya/motion/manifest.json', 'A stand-in: an async file check works')
    asked.length = 0
    for (const bad of ['../x.json', 'a.gif', '/a.json', '%2e%2e/a.json', 'a\\b.json']) eq(await stand.mint({ packId: PACK_A, path: bad, ttlSeconds: 300 }), null, `A stand-in: ${bad} -> null`)
    eq(await stand.mint({ packId: 'u-short', path: MANIFEST, ttlSeconds: 300 }), null, 'A stand-in: a bad pack id -> null')
    eq(asked, [], 'A stand-in: a refused pack or path never touches the disk')
    for (const env of [{ NODE_ENV: 'production', AVATAR_PACK_DEV_STANDIN: 'true' }, { NODE_ENV: 'test', AVATAR_PACK_DEV_STANDIN: 'true' }, { AVATAR_PACK_DEV_STANDIN: 'true' }, { NODE_ENV: 'Development', AVATAR_PACK_DEV_STANDIN: 'true' }, { NODE_ENV: 'development' }, { NODE_ENV: 'development', AVATAR_PACK_DEV_STANDIN: 'TRUE' }, { NODE_ENV: 'development', AVATAR_PACK_DEV_STANDIN: '1' }, { NODE_ENV: 'development', AVATAR_PACK_DEV_STANDIN: 'false' }]) {
      const m2 = L.devStandInMinter({ env, fileExists })
      eq([m2.active(), L.devStandInActive(env), await m2.mint({ packId: PACK_A, path: MANIFEST, ttlSeconds: 300 })], [false, false, null], `A stand-in: ${JSON.stringify(env)} does nothing`)
    }
    eq(asked, [], 'A stand-in: outside development it never touches the disk')

    // ---------- A6. which minter an environment gets ----------
    const mk = (env, deps) => L.selectMinter(env, deps)
    const st = storage(good)
    eq(await mk(dev, { storage: st, fileExists }).mint({ packId: PACK_A, path: MANIFEST, ttlSeconds: 300 }), '/companions/maya/motion/manifest.json', 'A select: the stand-in when it is active (even with a bucket and storage)')
    eq(await mk({ ...dev, AVATAR_PACK_BUCKET: 'avatar-packs' }, { storage: st }).mint({ packId: PACK_A, path: MANIFEST, ttlSeconds: 300 }), null, 'A select: the stand-in with no file check finds nothing (fail closed)')
    const c0 = signCalls.length
    eq(await mk({ NODE_ENV: 'production', AVATAR_PACK_DEV_STANDIN: 'true', AVATAR_PACK_BUCKET: 'avatar-packs' }, { storage: st, fileExists }).mint({ packId: PACK_A, path: MANIFEST, ttlSeconds: 300 }), good.data.signedUrl, 'A select: production with the stand-in variable "true" still signs for real')
    eq(signCalls.length, c0 + 1, 'A select: and it asked storage')
    eq(await mk({ AVATAR_PACK_BUCKET: 'avatar-packs' }, { storage: st }).mint({ packId: PACK_A, path: MANIFEST, ttlSeconds: 300 }), good.data.signedUrl, 'A select: the bucket and storage give the signer')
    const c1 = signCalls.length
    for (const [label, env, deps] of [['no bucket', {}, { storage: st }], ['an empty bucket', { AVATAR_PACK_BUCKET: '' }, { storage: st }], ['no storage', { AVATAR_PACK_BUCKET: 'avatar-packs' }, {}], ['nothing', {}, {}]]) {
      eq(await mk(env, deps).mint({ packId: PACK_A, path: MANIFEST, ttlSeconds: 300 }), null, `A select: ${label} -> the closed minter, null`)
    }
    eq(signCalls.length, c1, 'A select: the closed minter never reaches storage')
    eq(await L.closedMinter.mint({ packId: PACK_A, path: MANIFEST, ttlSeconds: 300 }), null, 'A select: closedMinter')

    // ---------- A7. mintPackLink ----------
    const owner = { app: 'deckster', tenantId: 'deckster', userId: USER_A }
    const m1 = okMinter()
    eq(await L.mintPackLink(owner, PACK_A, MANIFEST, { minter: m1 }), { url: fakeLink({ packId: PACK_A, path: MANIFEST }), ttlSeconds: 300 }, 'A mint: a link and the life it was asked for (default 300)')
    eq(m1.calls, [{ owner, packId: PACK_A, path: MANIFEST, ttlSeconds: 300 }], 'A mint: the minter is asked for exactly the owner, the pack, the path and the life (the owner goes on for the spawn service; it never authorises here)')
    eq((await L.mintPackLink(owner, PACK_A, MANIFEST, { minter: okMinter(), ttlSeconds: 120 })).ttlSeconds, 120, 'A mint: a life of 120')
    eq([(await L.mintPackLink(owner, PACK_A, MANIFEST, { minter: okMinter(), ttlSeconds: 5 })).ttlSeconds, (await L.mintPackLink(owner, PACK_A, MANIFEST, { minter: okMinter(), ttlSeconds: 5000 })).ttlSeconds], [60, 900], 'A mint: the life is clamped')
    eq(await L.mintPackLink({ app: 'x', tenantId: 'y', userId: USER_B }, PACK_A, MANIFEST, { minter: okMinter() }), await L.mintPackLink(owner, PACK_A, MANIFEST, { minter: okMinter() }), 'A mint: the owner does not authorise (a different owner changes nothing here; the route checks it)')
    eq((await L.mintPackLink(undefined, PACK_A, MANIFEST, { minter: fakeMinter('/companions/maya/motion/manifest.json') })).url, '/companions/maya/motion/manifest.json', 'A mint: a same-origin path is fine (the dev stand-in)')
    const never = okMinter()
    for (const [label, id, p] of [['bad pack id', 'u-short', MANIFEST], ['dot-dot', PACK_A, '../x.json'], ['bad extension', PACK_A, 'a.gif'], ['encoded', PACK_A, '%2e%2e/a.json'], ['absolute', PACK_A, '/a.json'], ['backslash', PACK_A, 'a\\b.json'], ['empty', PACK_A, '']]) {
      eq(await L.mintPackLink(owner, id, p, { minter: never }), null, `A mint: ${label} -> null`)
    }
    eq(never.calls, [], 'A mint: a bad pack or path never reaches the minter')
    for (const [label, answer] of [['null', null], ['a throw', () => { throw new Error('boom') }], ['a rejection', () => Promise.reject(new Error('boom'))], ['javascript:', 'javascript:alert(1)'], ['http', 'http://storage.test/a.json'], ['protocol-relative', '//evil.test/a.json'], ['a user in it', 'https://someone@storage.test/a.json'], ['empty', ''], ['not a string', 5], ['a newline', 'https://storage.test/a\nX: y']]) {
      eq(await L.mintPackLink(owner, PACK_A, MANIFEST, { minter: fakeMinter(answer) }), null, `A mint: a minter answer of ${label} -> null`)
    }
    eq(await L.mintPackLink(owner, PACK_A, MANIFEST, {}), null, 'A mint: no minter -> null')
    eq(await L.mintPackLink(owner, PACK_A, MANIFEST, undefined), null, 'A mint: no deps -> null')

    // ---------- A8. the flag and the registry ----------
    ok(X.studioMyCompanionsOn({ [SHELL]: 'true', [FLAG]: 'true' }), 'A flag: both "true"')
    for (const env of [{}, { [SHELL]: 'true' }, { [FLAG]: 'true' }, { [SHELL]: 'true', [FLAG]: 'TRUE' }, { [SHELL]: 'true', [FLAG]: '1' }, { [SHELL]: 'true', [FLAG]: ' true' }, { [SHELL]: 'TRUE', [FLAG]: 'true' }, { [SHELL]: 'false', [FLAG]: 'true' }, { [SHELL]: 'true', [FLAG]: 'false' }]) ok(!X.studioMyCompanionsOn(env), `A flag: ${JSON.stringify(env)} is off`)
    eq([X.MY_COMPANIONS_FLAG, X.STUDIO_SHELL_FLAG], [FLAG, SHELL], 'A flag: the names')
    const entry = (over = {}) => ({ id: PACK_A, displayName: 'PK', owner: { userId: USER_A }, ...over })
    eq(X.parseRegistry(JSON.stringify([entry()])), [{ id: PACK_A, displayName: 'PK', packBaseUrl: BASE(PACK_A), owner: { app: 'deckster', tenantId: 'deckster', userId: USER_A }, erased: false }], 'A registry: one entry, the base derived, the owner stamped deckster/deckster')
    eq(X.parseRegistry([entry()]).length, 1, 'A registry: an already parsed array works')
    eq(X.parseRegistry([entry({ packBaseUrl: BASE(PACK_A) })]).length, 1, 'A registry: a given packBaseUrl that equals the derived one is kept')
    for (const [label, bad] of [['a different packBaseUrl', entry({ packBaseUrl: '/api/avatar/pack/' + PACK_B })], ['an external packBaseUrl', entry({ packBaseUrl: 'https://evil.test/p' })], ['a non-string packBaseUrl', entry({ packBaseUrl: 5 })], ['a null packBaseUrl', entry({ packBaseUrl: null })],
      ['a short id', entry({ id: 'u-short' })], ['an upper-case id', entry({ id: PACK_A.toUpperCase() })], ['no id', entry({ id: undefined })], ['a numeric id', entry({ id: 5 })],
      ['no name', entry({ displayName: undefined })], ['an empty name', entry({ displayName: '' })], ['a blank name', entry({ displayName: ' \t\n ' })], ['a 41-character name', entry({ displayName: 'n'.repeat(41) })], ['a numeric name', entry({ displayName: 5 })],
      ['no owner', entry({ owner: undefined })], ['a null owner', entry({ owner: null })], ['a string owner', entry({ owner: USER_A })], ['an owner with no userId', entry({ owner: {} })], ['an empty userId', entry({ owner: { userId: '' } })], ['a numeric userId', entry({ owner: { userId: 5 } })], ['a 201-character userId', entry({ owner: { userId: 'u'.repeat(201) } })],
      ['null', null], ['a number', 5], ['a string', 'x'], ['an array', []]]) {
      eq(X.parseRegistry([bad]), [], `A registry: ${label} is dropped`)
    }
    eq(X.parseRegistry([entry({ displayName: 'n'.repeat(40) })])[0].displayName.length, 40, 'A registry: a 40-character name is kept')
    eq(X.parseRegistry([entry({ owner: { userId: 'u'.repeat(200) } })]).length, 1, 'A registry: a 200-character userId is kept')
    eq(X.parseRegistry([entry({ displayName: '  Pk\u0000\n\u202e  Studio\t ' })])[0].displayName, 'Pk Studio', 'A registry: control and bidi characters become spaces, spaces collapse, the ends are trimmed')
    eq(X.parseRegistry([entry({ owner: { userId: USER_A, role: 'admin', app: 'x', tenantId: 'y' }, extra: 1 })])[0].owner, { app: 'deckster', tenantId: 'deckster', userId: USER_A }, 'A registry: nothing but the userId is taken from the owner')
    eq(X.parseRegistry([null, 5, 'x', entry(), [], { id: 1 }, entry({ id: PACK_B })]).map(e => e.id), [PACK_A, PACK_B], 'A registry: a bad entry is dropped and the others stay')
    eq(X.parseRegistry([entry(), entry({ owner: { userId: USER_B }, displayName: 'Second' })]).map(e => [e.id, e.owner.userId]), [[PACK_A, USER_A]], 'A registry: a duplicate id, the first wins')
    eq(X.parseRegistry([entry({ erased: true })])[0].erased, true, 'A registry: erased true')
    eq([entry(), entry({ erased: false })].map(e => X.parseRegistry([e])[0].erased), [false, false], 'A registry: erased absent or false is live')
    for (const odd of ['yes', 'true', 1, null, {}, 0, '']) eq(X.parseRegistry([entry({ erased: odd })])[0].erased, true, `A registry: erased ${JSON.stringify(odd)} counts as erased (fail closed)`)
    const many = Array.from({ length: 25 }, (_, i) => entry({ id: 'u-' + String(i).padStart(26, '0') }))
    eq(X.parseRegistry(many).map(e => e.id), many.slice(0, 20).map(e => e.id), 'A registry: at most 20 entries, the first 20')
    eq(X.parseRegistry(JSON.stringify(many)).length, 20, 'A registry: at most 20 entries from JSON too')
    for (const bad of ['not json', '{"a":1}', '[', '', '{}', 'null', '"x"', '5', 'true', null, undefined, 5, {}, 'x'.repeat(100_001), JSON.stringify([entry()]) + ' '.repeat(100_001)]) eq(X.parseRegistry(bad), [], `A registry: ${JSON.stringify(bad)?.slice(0, 30)} is an empty registry`)
    eq(X.parseRegistry(JSON.stringify([entry(), { id: 5 }])).length, 1, 'A registry: a bad entry in a JSON text is dropped, never an error')
    eq([X.registryFromEnv({}).length, X.registryFromEnv({ AVATAR_COMPANIONS_REGISTRY: 'bad' }).length, X.registryFromEnv(ENV_ON).length], [0, 0, 3], 'A registry: read from AVATAR_COMPANIONS_REGISTRY, empty when missing or bad')
    const reg = X.registryFromEnv(ENV_ON)
    eq(X.companionsFor(reg, USER_A), [{ id: PACK_A, displayName: 'PK', packBaseUrl: BASE(PACK_A) }], 'A companions: the owner sees their live entry only (the erased one is gone)')
    eq(X.companionsFor(reg, USER_B).map(c => c.id), [PACK_B], 'A companions: another user sees theirs')
    eq(X.companionsFor(reg, USER_C), [], 'A companions: a stranger sees none')
    for (const who of ['', null, undefined, 5, {}, ['user-a'], USER_A.toUpperCase(), USER_A + ' ']) eq(X.companionsFor(reg, who), [], `A companions: ${JSON.stringify(who)} sees none`)
    eq(Object.keys(X.companionsFor(reg, USER_A)[0]), ['id', 'displayName', 'packBaseUrl'], 'A companions: exactly three fields, never the owner')

    // ---------- A9. the one 404 ----------
    const a = X.refuse(), b = X.refuse()
    eq([await sig(a), await sig(b)], [NOT_FOUND, NOT_FOUND], 'A refuse: 404, exactly content-type and cache-control, the body {"error":"Not found"}, a fresh response each time')
  })()
}

async function sectionB(link, access) {
  const X = access
  const own = (over = {}, rel = MANIFEST, id = PACK_A) => X.handlePack(over.request ?? reqFor(id, rel, over.method), id, ('segments' in over ? over.segments : rel.split('/')), { env: ENV_ON, userId: async () => USER_A, minter: okMinter(), ...over })
  const redirect = await own()
  // ---------- B1. the owner ----------
  eq([redirect.status, redirect.headers.get('location'), redirect.headers.get('cache-control'), redirect.headers.get('referrer-policy'), redirect.headers.get('vary')], [302, fakeLink({ packId: PACK_A, path: MANIFEST }), 'private, max-age=60', 'no-referrer', 'Cookie'], 'B owner: 302 to the minted link, private max-age=60, no-referrer, Vary: Cookie (a cached redirect is never served to the next person on the same browser)')
  eq([...redirect.headers].map(([k]) => k).sort(), ['cache-control', 'location', 'referrer-policy', 'vary'], 'B owner: exactly those four headers')
  eq(await redirect.text(), '', 'B owner: no body')
  const m = okMinter()
  await own({ minter: m })
  eq(m.calls, [{ owner: { app: 'deckster', tenantId: 'deckster', userId: USER_A }, packId: PACK_A, path: MANIFEST, ttlSeconds: 300 }], 'B owner: the minter is asked for the one file at the default life, with the registry owner')
  const head = await own({ method: 'HEAD' })
  eq([head.status, head.headers.get('location')], [302, fakeLink({ packId: PACK_A, path: MANIFEST })], 'B owner: HEAD answers as GET')
  eq((await own({ method: 'get' })).status, 302, 'B owner: the method is case-insensitive')
  for (const rel of GOOD_PATHS) eq((await own({}, rel)).headers.get('location'), fakeLink({ packId: PACK_A, path: rel }), `B owner: ${rel} -> 302`)
  const built = []
  const viaFunction = await own({ minter: env => { built.push(env); return okMinter() } })
  eq([viaFunction.status, built.length, built[0] === ENV_ON], [302, 1, true], 'B owner: a minter given as a function of the environment is built once, from this environment')
  for (const [ttl, minterTtl, age] of [['120', 120, 24], ['60', 60, 12], ['5', 60, 12], ['900', 900, 60], ['99999', 900, 60], ['soon', 300, 60], ['', 300, 60], ['301', 301, 60], ['150', 150, 30]]) {
    const mm = okMinter()
    const res = await own({ minter: mm, env: { ...ENV_ON, AVATAR_PACK_LINK_TTL_SECONDS: ttl } })
    eq([mm.calls[0].ttlSeconds, res.headers.get('cache-control')], [minterTtl, `private, max-age=${age}`], `B owner: link life ${JSON.stringify(ttl)} -> ${minterTtl} s, redirect max-age ${age}`)
    ok(age < minterTtl, `B owner: max-age ${age} is well under the link life ${minterTtl}`)
  }
  eq((await own({ request: { method: 'GET', url: `${BASE(PACK_A)}/${MANIFEST}` } })).status, 302, 'B owner: a URL with no origin works')
  eq((await own({ request: { method: 'GET', url: `http://studio.test${BASE(PACK_A)}/${MANIFEST}?v=1&x=2#frag` } })).status, 302, 'B owner: a query or fragment is not part of the path')
  const real = await X.handlePack(new Request(`http://studio.test${BASE(PACK_A)}/${MANIFEST}`), PACK_A, MANIFEST.split('/'), { env: ENV_ON, userId: async () => USER_A, minter: okMinter() })
  eq(real.status, 302, 'B owner: a real Request works')

  // ---------- B2. every refusal is the same 404, byte for byte ----------
  const refusals = []
  const add = (label, promise) => { promise.catch(() => {}); refusals.push([label, promise]) }
  for (const [label, env] of [['the shell flag missing', { ...ENV_ON, [SHELL]: undefined }], ['the shell flag false', { ...ENV_ON, [SHELL]: 'false' }], ['the companions flag missing', { ...ENV_ON, [FLAG]: undefined }], ['the companions flag TRUE', { ...ENV_ON, [FLAG]: 'TRUE' }], ['the companions flag 1', { ...ENV_ON, [FLAG]: '1' }], ['both flags missing', { AVATAR_COMPANIONS_REGISTRY: REGISTRY }]]) add(`flag off: ${label}`, own({ env }))
  for (const [label, who] of [['null', async () => null], ['empty', async () => ''], ['undefined', async () => undefined], ['a number', async () => 5], ['an object', async () => ({ id: USER_A })], ['a throw', async () => { throw new Error('session store down') }], ['a rejection', () => Promise.reject(new Error('x'))]]) add(`signed out: ${label}`, own({ userId: who }))
  add('not the owner', own({ userId: async () => USER_B }))
  add('a stranger', own({ userId: async () => USER_C }))
  add('the owner id with a different case', own({ userId: async () => USER_A.toUpperCase() }))
  add('the owner id with a trailing space', own({ userId: async () => USER_A + ' ' }))
  add('the owner id of another pack', own({}, MANIFEST, PACK_B))
  add('an unknown pack', own({}, MANIFEST, PACK_X))
  add('an erased pack (its owner)', own({}, MANIFEST, PACK_E))
  add('no registry', own({ env: { ...ENV_ON, AVATAR_COMPANIONS_REGISTRY: undefined } }))
  add('a broken registry', own({ env: { ...ENV_ON, AVATAR_COMPANIONS_REGISTRY: '[{' } }))
  add('an erased pack by an odd erased value', own({ env: { ...ENV_ON, AVATAR_COMPANIONS_REGISTRY: JSON.stringify([{ id: PACK_A, displayName: 'PK', owner: { userId: USER_A }, erased: 'yes' }]) } }))
  add('a numeric session id for a numeric owner id', own({ userId: async () => 5, env: { ...ENV_ON, AVATAR_COMPANIONS_REGISTRY: JSON.stringify([{ id: PACK_A, displayName: 'PK', owner: { userId: '5' } }]) } }))
  for (const bad of ['u-short', PACK_A.toUpperCase(), '..', '', 5, undefined, null, PACK_A + '/x', '../' + PACK_A]) add(`a bad pack id ${JSON.stringify(bad)}`, X.handlePack(reqFor(PACK_A, MANIFEST), bad, MANIFEST.split('/'), { env: ENV_ON, userId: async () => USER_A, minter: okMinter() }))
  for (const bad of BAD_PATHS) add(`an unsafe path ${JSON.stringify(bad)}`, own({ request: { method: 'GET', url: `http://studio.test${BASE(PACK_A)}/${bad}` }, segments: bad.split('/') }))
  for (const bad of [undefined, null, 'motion/manifest.json', [], [''], ['motion', 5], ['motion', null], [['motion'], 'manifest.json'], ['..', 'manifest.json'], ['motion', '..'], ['%2e%2e', 'a.json']]) add(`odd segments ${JSON.stringify(bad)}`, own({ segments: bad }))
  for (const [label, url, segments] of [
    ['a percent escape the router decoded', `http://studio.test${BASE(PACK_A)}/motion/%61.json`, ['motion', 'a.json']],
    ['an encoded dot-dot the router lost', `http://studio.test${BASE(PACK_A)}/motion/%2e%2e/a.json`, ['motion', 'a.json']],
    ['an encoded slash', `http://studio.test${BASE(PACK_A)}/motion%2Fa.json`, ['motion', 'a.json']],
    ['a dot-dot in the raw path', `http://studio.test${BASE(PACK_A)}/motion/../motion/a.json`, ['motion', 'a.json']],
    ['a backslash in the raw path', `http://studio.test${BASE(PACK_A)}/motion\\a.json`, ['motion', 'a.json']],
    ['a double slash in the raw path', `http://studio.test${BASE(PACK_A)}/motion//a.json`, ['motion', 'a.json']],
    ['a trailing slash', `http://studio.test${BASE(PACK_A)}/motion/a.json/`, ['motion', 'a.json']],
    ['a different file than the segments name', `http://studio.test${BASE(PACK_A)}/motion/b.json`, ['motion', 'a.json']],
    ['a different pack in the URL', `http://studio.test${BASE(PACK_B)}/motion/a.json`, ['motion', 'a.json']],
    ['a path outside the pack route', 'http://studio.test/api/avatar/companions/motion/a.json', ['motion', 'a.json']],
    ['a URL with nothing after the pack', `http://studio.test${BASE(PACK_A)}/`, ['motion', 'a.json']],
    ['no URL', undefined, ['motion', 'a.json']],
    ['a URL that is not a string', 5, ['motion', 'a.json']],
  ]) add(`raw URL: ${label}`, own({ request: { method: 'GET', url }, segments }))
  add('no request at all', X.handlePack(undefined, PACK_A, MANIFEST.split('/'), { env: ENV_ON, userId: async () => USER_A, minter: okMinter() }))
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'TRACE', '', undefined]) add(`method ${method}`, own({ request: { method, url: `http://studio.test${BASE(PACK_A)}/${MANIFEST}` } }))
  const nm = fakeMinter(null)
  add('the minter answers null', own({ minter: nm }))
  add('the minter throws', own({ minter: fakeMinter(() => { throw new Error('storage down https://storage.test/x?token=fake-1') }) }))
  add('the minter rejects', own({ minter: fakeMinter(() => Promise.reject(new Error('storage down'))) }))
  add('the minter builder throws', own({ minter: () => { throw new Error('no signer') } }))
  add('the minter is missing', own({ minter: undefined }))
  const goodLink = fakeLink({ packId: PACK_A, path: MANIFEST })
  for (const answer of ['', 'javascript:alert(1)', goodLink.replace('https://', 'http://'), '//evil.test/a.json', '/\\evil.test/a.json', goodLink.replace('https://', 'https://someone@'), goodLink + '\nSet-Cookie: x=1', 'data:text/plain,hi', 'relative.json', 5, {}, undefined, goodLink + 'a'.repeat(2100)]) add(`the minter answers ${JSON.stringify(answer)?.slice(0, 40)}`, own({ minter: fakeMinter(answer) }))
  const seen = new Set()
  for (const [label, promise] of refusals) {
    const got = await sig(await promise)
    eq(got, NOT_FOUND, `B refusal (${label}): the one 404`)
    seen.add(got)
  }
  eq(seen.size, 1, `B refusals: ${refusals.length} different reasons, ONE byte-identical answer`)

  // ---------- B3. an unsafe or foreign request does no work ----------
  const noWork = []
  const spy = { env: ENV_ON, userId: async () => { noWork.push('session'); return USER_A }, minter: { async mint() { noWork.push('minter'); return null } } }
  await X.handlePack(reqFor(PACK_A, '../x.json'), PACK_A, ['..', 'x.json'], spy)
  await X.handlePack(reqFor(PACK_A, MANIFEST), PACK_A, MANIFEST.split('/'), { ...spy, userId: async () => { noWork.push('session'); return USER_B } })
  eq(noWork, ['session'], 'B work: an unsafe path never reaches the session; a non-owner never reaches the minter')
  const buildCalls = []
  await own({ userId: async () => USER_B, minter: () => { buildCalls.push('built'); return okMinter() } })
  await own({ userId: async () => null, minter: () => { buildCalls.push('built'); return okMinter() } })
  await own({ minter: () => { buildCalls.push('built'); return okMinter() } }, MANIFEST, PACK_E)
  eq(buildCalls, [], 'B work: a signer is built only for the owner of a live pack')

  // ---------- B4. flag off reads nothing else ----------
  for (const env of [{ ...ENV_ON, [SHELL]: undefined }, { ...ENV_ON, [FLAG]: undefined }, { ...ENV_ON, [FLAG]: 'false' }]) {
    const { env: proxied, reads } = watched(env)
    const calls = []
    const res = await X.handlePack(reqFor(PACK_A, MANIFEST), PACK_A, MANIFEST.split('/'), { env: proxied, userId: async () => { calls.push('session'); return USER_A }, minter: () => { calls.push('minter'); return okMinter() } })
    eq([await sig(res), calls, reads.filter(k => k !== SHELL && k !== FLAG)], [NOT_FOUND, [], []], 'B flag off (pack): the one 404; the session and the minter are never called; no variable but the two flags is read')
    const list = await X.handleCompanions(reqFor(PACK_A, MANIFEST), { env: proxied, userId: async () => { calls.push('session'); return USER_A } })
    eq([await sig(list), calls, reads.filter(k => k !== SHELL && k !== FLAG)], [NOT_FOUND, [], []], 'B flag off (list): the same')
  }
  const signedOut = watched(ENV_ON)
  await X.handlePack(reqFor(PACK_A, MANIFEST), PACK_A, MANIFEST.split('/'), { env: signedOut.env, userId: async () => null, minter: okMinter() })
  ok(!signedOut.reads.includes('AVATAR_COMPANIONS_REGISTRY') && !signedOut.reads.includes('AVATAR_PACK_BUCKET'), 'B signed out: the registry and the bucket are not read for a caller with no session')
  const unsafe = watched(ENV_ON)
  await X.handlePack(reqFor(PACK_A, '../x.json'), PACK_A, ['..', 'x.json'], { env: unsafe.env, userId: async () => USER_A, minter: okMinter() })
  ok(!unsafe.reads.includes('AVATAR_COMPANIONS_REGISTRY'), 'B unsafe path: the registry is not read')

  // ---------- B5. the list ----------
  const list = (userId, env = ENV_ON, request = reqFor(PACK_A, MANIFEST)) => X.handleCompanions(request, { env, userId })
  const a = await list(async () => USER_A)
  const aText = await a.clone().text()
  eq([a.status, a.headers.get('content-type'), a.headers.get('cache-control'), [...a.headers].map(([k]) => k).sort()], [200, 'application/json', 'private, no-store', ['cache-control', 'content-type']], 'B list: 200 JSON, private no-store, no other header')
  eq(JSON.parse(aText), { companions: [{ id: PACK_A, displayName: 'PK', packBaseUrl: BASE(PACK_A) }] }, 'B list: the owner sees their own live entry only')
  ok(!/owner|userId|user-a|user-b|erased|Gone|Other|"app"|tenant/.test(aText), 'B list: never the owner, the erased flag or anyone else\'s entry')
  eq(JSON.parse(await (await list(async () => USER_B)).text()), { companions: [{ id: PACK_B, displayName: 'Other', packBaseUrl: BASE(PACK_B) }] }, 'B list: a second user sees only theirs')
  eq(JSON.parse(await (await list(async () => USER_C)).text()), { companions: [] }, 'B list: a user with none sees an empty list (no pack named)')
  eq((await list(async () => USER_A, ENV_ON, reqFor(PACK_A, MANIFEST, 'HEAD'))).status, 200, 'B list: HEAD answers as GET')
  eq((await list(async () => USER_A, { ...ENV_ON, AVATAR_COMPANIONS_REGISTRY: undefined })).status, 200, 'B list: no registry is an empty list for a signed-in user')
  const listRefusals = [
    list(async () => USER_A, { ...ENV_ON, [SHELL]: undefined }), list(async () => USER_A, { ...ENV_ON, [FLAG]: undefined }), list(async () => USER_A, { ...ENV_ON, [FLAG]: 'TRUE' }),
    list(async () => null), list(async () => ''), list(async () => undefined), list(async () => { throw new Error('session store down') }),
    ...['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].map(method => list(async () => USER_A, ENV_ON, reqFor(PACK_A, MANIFEST, method))), list(async () => USER_A, ENV_ON, null),
  ]
  for (const res of listRefusals) res.catch(() => {})
  for (const res of listRefusals) eq(await sig(await res), NOT_FOUND, 'B list refusal: the same one 404 as the pack route')
}

// ---------- O. no open redirect: the Location is the configured storage origin + the minted signing path for THIS file, and nothing in the request can reach it ----------
async function sectionO(access) {
  const X = access
  const GOOD = fakeLink({ packId: PACK_A, path: MANIFEST })
  const SIGN = `/storage/v1/object/sign/avatar-packs/${PACK_A}/${MANIFEST}`
  const DEV = { NODE_ENV: 'development', AVATAR_PACK_DEV_STANDIN: 'true' }
  const DEV_LINK = `/companions/maya/${MANIFEST}`
  const ask = (answer, { env = {}, request = reqFor(PACK_A, MANIFEST), minter } = {}) => X.handlePack(request, PACK_A, MANIFEST.split('/'), { env: { ...ENV_ON, ...env }, userId: async () => USER_A, minter: minter ?? fakeMinter(answer) })
  const swap = origin => GOOD.replace(DB, origin)
  const refused = async (label, answer, over) => {
    const res = await ask(answer, over)
    ok(res.status === 404 && res.headers.get('location') === null, `O ${label}: the 404 carries no Location`)
    eq(await sig(res), NOT_FOUND, `O ${label}: the one 404, same body`)
  }
  const accepted = async (label, answer, over) => {
    const res = await ask(answer, over)
    eq([res.status, res.headers.get('location')], [302, answer], `O ${label}: accepted, the Location is exactly the link`)
  }

  // what is accepted
  await accepted('the configured origin and this pack\'s signing path', GOOD)
  await accepted('a configured project URL with a trailing slash', GOOD, { env: { NEXT_PUBLIC_SUPABASE_URL: `${DB}/` } })
  await accepted('another configured origin, link on that origin', fakeLink({ packId: PACK_A, path: MANIFEST }, 'https://db-two.test'), { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://db-two.test' } })
  await accepted('the dev stand-in\'s own path while the stand-in is on', DEV_LINK, { env: DEV })
  await accepted('the signed link while the stand-in is on', GOOD, { env: DEV })

  // a link on the wrong origin
  const links = [
    ['another origin', swap('https://evil.test')],
    ['a subdomain of the origin', swap('https://x.db.test')],
    ['the origin as a subdomain of another host', swap('https://db.test.evil.test')],
    ['a host that starts like the origin', swap('https://db.testing')],
    ['a host that ends like the origin', swap('https://evil-db.test')],
    ['the origin as the user of another host', swap('https://db.test@evil.test')],
    ['the origin as an encoded user of another host', swap('https://db.test%40evil.test')],
    ['a backslash before an @', swap('https://evil.test\\@db.test')],
    ['a backslash after the origin', swap('https://db.test\\@evil.test')],
    ['a different port', swap('https://db.test:8443')],
    ['port 444', swap('https://db.test:444')],
    ['a user on the right host', swap('https://someone@db.test')],
    ['http on the right host', GOOD.replace('https://', 'http://')],
    ['an upper-case scheme', GOOD.replace('https://', 'HTTPS://')],
    ['ftp', GOOD.replace('https://', 'ftp://')],
    ['javascript:', 'javascript:alert(1)'],
    ['a data: link', 'data:text/plain,hi'],
    ['a protocol-relative link on the right host', `//db.test${SIGN}?token=fake-1`],
    ['a protocol-relative link on another host', `//evil.test${SIGN}?token=fake-1`],
    ['a backslash start', `/\\evil.test${SIGN}`],
    ['a same-origin path of this site (the signing path)', `${SIGN}?token=fake-1`],
    ['a same-origin path of this site (the pack route)', `/api/avatar/pack/${PACK_A}/${MANIFEST}`],
    ['a same-origin path of this site (Maya\'s pack) while the stand-in is off', DEV_LINK],
    ['a relative path', `companions/maya/${MANIFEST}`],
    // the right origin, the wrong file
    ['another pack id', GOOD.replace(PACK_A, PACK_B)],
    ['another file of the pack', GOOD.replace(MANIFEST, 'motion/other.json')],
    ['another file of the pack (the portrait)', GOOD.replace(MANIFEST, 'portrait-512.webp')],
    ['a longer file name', GOOD.replace('?token', '.json?token')],
    ['the pack and file only in the query', `${DB}/storage/v1/object/sign/avatar-packs/` + `other.json?x=/${PACK_A}/${MANIFEST}`],
    ['the public endpoint', GOOD.replace('/object/sign/', '/object/public/')],
    ['the authenticated endpoint', GOOD.replace('/object/sign/', '/object/authenticated/')],
    ['no signing prefix', `${DB}/${PACK_A}/${MANIFEST}?token=fake-1`],
    ['a signing prefix without its slash', `${DB}/storage/v1/object/sign${PACK_A}/${MANIFEST}`],
    ['a path with no file', `${DB}?token=fake-1`],
    ['only the origin', DB],
    // traversal and tricks in the path
    ['a dot-dot', GOOD.replace('/avatar-packs/', '/avatar-packs/../avatar-packs/')],
    ['an encoded dot-dot', GOOD.replace('/avatar-packs/', '/avatar-packs/%2e%2e/avatar-packs/')],
    ['an encoded dot-dot climbing out of the signing path', `${DB}/storage/v1/object/sign/%2e%2e/%2e%2e/sign/avatar-packs/${PACK_A}/${MANIFEST}`],
    ['an encoded slash', GOOD.replace('/avatar-packs/', '/avatar-packs%2F..%2F')],
    ['an encoded letter', GOOD.replace('avatar-packs', 'avatar-%70acks')],
    ['a dot-segment', GOOD.replace('/avatar-packs/', '/./avatar-packs/')],
    ['a double slash', GOOD.replace('/sign/avatar-packs', '/sign//avatar-packs')],
    ['a backslash in the path', GOOD.replace('/avatar-packs/', '/avatar-packs\\')],
    ['a fragment', GOOD + '#frag'],
    ['a space', GOOD.replace('avatar-packs', 'avatar packs')],
    ['a newline', GOOD + '\nSet-Cookie: x=1'],
    ['a tab', GOOD.replace('?token', '\t?token')],
    ['a non-ASCII letter', GOOD.replace('avatar-packs', 'avatar-p\u00e4cks')],
    ['over 2048 characters', GOOD + 'a'.repeat(2100)],
    ['an empty answer', ''],
    ['not a string', 5],
    ['null', null],
    ['an object with an href', { href: GOOD }],
    ['an array holding the link', [GOOD]],
    ['no answer', undefined],
  ]
  for (const [label, link] of links) await refused(label, link)
  // the dev stand-in's path is exact: this file, no query, no fragment, no detour
  for (const [label, link] of [['another file of Maya\'s pack', '/companions/maya/motion/other.webp'], ['another bird', `/companions/felix/${MANIFEST}`], ['a query', `${DEV_LINK}?x=1`], ['a fragment', `${DEV_LINK}#x`], ['a trailing slash', `${DEV_LINK}/`],
    ['a dot-dot', `/companions/maya/../felix/${MANIFEST}`], ['a protocol-relative link', `//evil.test${DEV_LINK}`], ['a backslash start', `/\\evil.test${DEV_LINK}`], ['another origin', `https://evil.test${DEV_LINK}`], ['the storage origin with the maya path', `${DB}${DEV_LINK}`], ['a path outside companions', `/api/avatar/pack/${PACK_A}/${MANIFEST}`]]) await refused(`stand-in on, ${label}`, link, { env: DEV })
  // the stand-in is only on in development with the variable "true"
  for (const env of [{ NODE_ENV: 'production', AVATAR_PACK_DEV_STANDIN: 'true' }, { NODE_ENV: 'test', AVATAR_PACK_DEV_STANDIN: 'true' }, { NODE_ENV: undefined, AVATAR_PACK_DEV_STANDIN: 'true' }, { NODE_ENV: 'development', AVATAR_PACK_DEV_STANDIN: undefined }, { NODE_ENV: 'development', AVATAR_PACK_DEV_STANDIN: 'false' },
    { NODE_ENV: 'Development', AVATAR_PACK_DEV_STANDIN: 'true' }, { NODE_ENV: 'development', AVATAR_PACK_DEV_STANDIN: 'TRUE' }, { NODE_ENV: 'development', AVATAR_PACK_DEV_STANDIN: '1' }]) await refused(`stand-in path with ${JSON.stringify(env)}`, DEV_LINK, { env })
  // the configured project URL is the whole anchor: unset or unusable means no link is accepted
  for (const value of [undefined, '', 'not a url', 'db.test', 'http://db.test', 'ftp://db.test', 'https://someone@db.test', 'https://', 'https://' + 'a'.repeat(2100), 'javascript:alert(1)', '//db.test']) await refused(`NEXT_PUBLIC_SUPABASE_URL ${JSON.stringify(value)?.slice(0, 30)}`, GOOD, { env: { NEXT_PUBLIC_SUPABASE_URL: value } })
  for (const value of ['https://db-two.test', 'https://db.test:8443', 'https://evil.test']) await refused(`a link on ${DB} while the project URL is ${value}`, GOOD, { env: { NEXT_PUBLIC_SUPABASE_URL: value } })

  // nothing in the request reaches the Location
  const PATH = `${BASE(PACK_A)}/${MANIFEST}`
  const plainMinter = fakeMinter(fakeLink)
  const plain = await ask(null, { request: new Request(`http://studio.test${PATH}`), minter: plainMinter })
  const plainSig = await sig(plain)
  eq([plain.status, plain.headers.get('location')], [302, GOOD], 'O request: the plain request gets the configured-origin link')
  const EVIL = 'https://evil.test'
  const QUERIES = ['?next=https://evil.test&redirect=//evil.test&url=https://evil.test/x', '?Location=https://evil.test', '?returnTo=%2F%2Fevil.test', '?host=evil.test&origin=https://evil.test&proto=http', '?token=fake-2&bucket=evil&path=../../x', `?redirect=${DEV_LINK}`, '?' + 'x=1&'.repeat(60), '?']
  const HEADERS = [{ Host: 'evil.test' }, { 'X-Forwarded-Host': 'evil.test' }, { 'X-Forwarded-Proto': 'http' }, { 'X-Forwarded-Port': '8443' }, { Origin: EVIL }, { Referer: `${EVIL}/page?next=${EVIL}` }, { Forwarded: 'host=evil.test;proto=http' }, { 'X-Original-URL': EVIL }, { 'X-Rewrite-URL': '//evil.test' }, { 'X-Forwarded-Prefix': '//evil.test' }, { Location: EVIL }, { 'X-Forwarded-For': '203.0.113.9' },
    { Host: 'evil.test', 'X-Forwarded-Host': 'evil.test', 'X-Forwarded-Proto': 'http', 'X-Forwarded-Port': '8443', Origin: EVIL, Referer: `${EVIL}/page`, Forwarded: 'host=evil.test', 'X-Original-URL': EVIL, 'X-Rewrite-URL': '//evil.test', 'X-Forwarded-Prefix': '//evil.test', Location: EVIL }]
  const HOSTS = [`http://evil.test${PATH}`, `https://evil.test${PATH}`, `https://evil.test:8443${PATH}`, `http://[::1]:3000${PATH}`, `http://studio.test:3000${PATH}`, `http://db.test${PATH}`, `https://db.test.evil.test${PATH}`, `http://someone@evil.test${PATH}`]
  let variants = 0
  const same = async (label, request) => {
    const m = fakeMinter(fakeLink)
    const res = await ask(null, { request, minter: m })
    eq([await sig(res), m.calls], [plainSig, plainMinter.calls], `O request: ${label} changes nothing (the 302 and what the minter is asked)`)
    variants++
  }
  for (const query of QUERIES) await same(`the query ${query.slice(0, 40)}`, new Request(`http://studio.test${PATH}${query}`))
  for (const headers of HEADERS) await same(`the headers ${Object.keys(headers).join(', ')}`, new Request(`http://studio.test${PATH}`, { headers }))
  for (const host of HOSTS) await same(`the request host ${host.slice(0, host.indexOf(PATH))}`, host.includes('@') ? { method: 'GET', url: host } : new Request(host))
  await same('every one of them at once', new Request(`${HOSTS[2]}${QUERIES[0]}`, { headers: HEADERS[HEADERS.length - 1] }))
  await same('a plain object request carrying headers and a host', { method: 'GET', url: `${HOSTS[1]}${QUERIES[0]}`, headers: HEADERS[HEADERS.length - 1], nextUrl: new URL(EVIL) })
  ok(variants >= 25, `O request: ${variants} request variants, one Location`)
  // a minter that reflects the request (a bug, or an attack through a header) is refused
  for (const host of [`https://evil.test${PATH}`, `http://evil.test${PATH}`, `https://db.test.evil.test${PATH}`]) {
    const request = new Request(host, { headers: { 'X-Forwarded-Host': 'evil.test' } })
    await refused(`a minter that builds the link from the request host (${new URL(host).origin})`, null, { request, minter: fakeMinter(() => `${new URL(host).origin}${SIGN}?token=fake-1`) })
  }
  await refused('a minter that builds the link from X-Forwarded-Host', null, { request: new Request(`http://studio.test${PATH}`, { headers: { 'X-Forwarded-Host': 'evil.test' } }), minter: fakeMinter(() => `https://evil.test${SIGN}?token=fake-1`) })
}

async function sectionC(src, accessUrl, linkUrl) {
  const saved = { ...process.env }
  const g = globalThis
  const reset = () => { g.__avSession = null; g.__avSessionCalls = 0; g.__avSbCreate = []; g.__avSbSign = []; g.__avSbFail = false; g.__avFetch = []; g.__avServe = false }
  const setEnv = extra => {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
    Object.assign(process.env, saved)
    for (const k of ['AVATAR_PACK_DEV_STANDIN', 'AVATAR_PACK_LINK_TTL_SECONDS', 'AVATAR_PACK_BUCKET', 'NEXT_PUBLIC_SUPABASE_URL', SERVICE_VAR, 'AVATAR_COMPANIONS_REGISTRY']) delete process.env[k]
    Object.assign(process.env, { ...ENV_ON, NODE_ENV: 'test', NEXT_PUBLIC_SUPABASE_URL: 'https://db.test', [SERVICE_VAR]: 'present', ...extra })
    for (const [k, v] of Object.entries(extra)) if (v === undefined) delete process.env[k]
  }
  try {
    reset()
    // The dev stand-in asks the dev server whether a committed file is served (HEAD of public/): a fake answers from the real public/ folder, and records what was asked. Anywhere else the network is not allowed.
    globalThis.fetch = async (url, init) => {
      g.__avFetch.push({ url: String(url), cache: init?.cache, method: init?.method, deadline: init?.signal instanceof AbortSignal })
      if (!g.__avServe) throw new Error('network is not allowed in this proof')
      const file = path.join(root, 'public', new URL(String(url)).pathname)
      return fs.existsSync(file) && fs.statSync(file).isFile() ? new Response('x', { status: 200 }) : new Response('no', { status: 404 })
    }
    const nextAuth = stub('next-auth.mjs', 'export async function getServerSession() { globalThis.__avSessionCalls = (globalThis.__avSessionCalls || 0) + 1; return globalThis.__avSession }')
    const authOptions = stub('auth-options.mjs', 'export const authOptions = {}')
    const supabase = stub('supabase.mjs', `export function createClient(url, serviceValue, options) {
  (globalThis.__avSbCreate ||= []).push({ url, usedEnvValue: serviceValue === process.env[${JSON.stringify(SERVICE_VAR)}], options })
  return { storage: { from(bucket) { return { async createSignedUrl(key, ttl) {
    (globalThis.__avSbSign ||= []).push({ bucket, key, ttl })
    if (globalThis.__avSbFail) return { data: null, error: { message: 'no' } }
    return { data: { signedUrl: url + '/storage/v1/object/sign/' + bucket + '/' + key + '?token=fake-1' }, error: null }
  } } } } }
}`)
    const replace = { 'next-auth': nextAuth, '@/lib/auth-options': authOptions, '@supabase/supabase-js': supabase, '@/lib/server/avatar-pack-access': accessUrl, '@/lib/server/avatar-pack-link': linkUrl }
    const { m: packRoute } = await load(src.pack, replace)
    const { m: listRoute } = await load(src.companions, replace)
    eq(g.__avSbCreate, [], 'C: importing the pack route builds no Supabase client')
    for (const [name, route] of [['pack', packRoute], ['companions', listRoute]]) {
      eq([route.dynamic, route.runtime, ...['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].map(method => typeof route[method])], ['force-dynamic', 'nodejs', ...Array(7).fill('function')], `C ${name}: dynamic, node runtime, every method answered by the route (Next's own 405 would tell a caller the route exists)`)
    }
    for (const [name, text] of [['pack', src.pack], ['companions', src.companions]]) ok(text.includes('getServerSession(authOptions)'), `C ${name}: the route does its own session check`)
    ok(!/user\?*\.email|\.email\b/.test(src.pack + src.companions), 'C: no email is required for the session user')

    const ctx = (id, rel) => ({ params: Promise.resolve({ packId: id, path: rel.split('/') }) })
    const packReq = (id, rel, init) => new Request(`http://studio.test${BASE(id)}/${rel}`, init)
    const go = (id, rel, init) => packRoute.GET(packReq(id, rel, init), ctx(id, rel))
    const listGo = init => listRoute.GET(new Request('http://studio.test/api/avatar/companions', init))

    // flag off: both routes are the one 404, before the session
    for (const extra of [{ [FLAG]: undefined }, { [SHELL]: undefined }, { [FLAG]: 'false' }]) {
      setEnv(extra); reset(); g.__avSession = { user: { id: USER_A } }
      eq([await sig(await go(PACK_A, MANIFEST)), await sig(await listGo()), g.__avSessionCalls, g.__avSbCreate.length], [NOT_FOUND, NOT_FOUND, 0, 0], `C flag off (${Object.keys(extra)[0]}): both routes answer the one 404; the session is never read; no client is built`)
    }
    // signed out
    setEnv({}); reset()
    for (const session of [null, undefined, { user: {} }, { user: { email: 'x@example.test' } }, { user: { id: '' } }, { user: { id: 5 } }]) {
      g.__avSession = session
      eq([await sig(await go(PACK_A, MANIFEST)), await sig(await listGo())], [NOT_FOUND, NOT_FOUND], `C signed out (${JSON.stringify(session)}): both routes answer the one 404`)
    }
    eq(g.__avSbCreate.length, 0, 'C signed out: no client built')
    // every other method: the one 404 too (flag on and off, signed in and out), never Next's own 405
    for (const extra of [{}, { [FLAG]: undefined }]) for (const session of [null, { user: { id: USER_A } }]) {
      setEnv(extra); reset(); g.__avSession = session
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) eq([await sig(await packRoute[method](packReq(PACK_A, MANIFEST, { method }), ctx(PACK_A, MANIFEST))), await sig(await listRoute[method](new Request('http://studio.test/api/avatar/companions', { method })))], [NOT_FOUND, NOT_FOUND], `C ${method} (${Object.keys(extra).length ? 'flag off' : 'flag on'}, ${session ? 'owner' : 'signed out'}): the one 404 from both routes`)
      eq(g.__avSbSign.length, 0, 'C other methods: nothing signed')
    }
    // the owner: an id is enough, no email
    setEnv({}); reset(); g.__avSession = { user: { id: USER_A } }
    const own = await go(PACK_A, MANIFEST)
    eq([own.status, own.headers.get('location'), own.headers.get('cache-control'), own.headers.get('referrer-policy'), own.headers.get('vary')], [302, fakeLink({ packId: PACK_A, path: MANIFEST }), 'private, max-age=60', 'no-referrer', 'Cookie'], 'C owner: 302 to the signed link, short max-age, no-referrer (a session with an id and no email)')
    eq(g.__avSbSign, [{ bucket: 'avatar-packs', key: `${PACK_A}/${MANIFEST}`, ttl: 300 }], 'C owner: the private bucket signs <packId>/<path> for 300 s')
    eq(g.__avSbCreate, [{ url: 'https://db.test', usedEnvValue: true, options: { auth: { persistSession: false } } }], 'C owner: the client is built from the project URL and the server-side service variable, without persisting a session')
    eq((await packRoute.HEAD(packReq(PACK_A, MANIFEST, { method: 'HEAD' }), ctx(PACK_A, MANIFEST))).status, 302, 'C owner: HEAD is as GET')
    eq(g.__avSbCreate.length, 1, 'C owner: the client is kept for the next request while the variables do not change')
    const wanted = [302, fakeLink({ packId: PACK_A, path: MANIFEST })]
    for (const [label, request] of [
      ['a foreign host, forwarded headers, origin and referer', new Request(`https://evil.test:8443${BASE(PACK_A)}/${MANIFEST}`, { headers: { Host: 'evil.test', 'X-Forwarded-Host': 'evil.test', 'X-Forwarded-Proto': 'http', Origin: 'https://evil.test', Referer: 'https://evil.test/p' } })],
      ['a redirect query', new Request(`http://studio.test${BASE(PACK_A)}/${MANIFEST}?next=https://evil.test&redirect=//evil.test&url=https://evil.test/x`)],
    ]) {
      const res = await packRoute.GET(request, ctx(PACK_A, MANIFEST))
      eq([res.status, res.headers.get('location')], wanted, `C open redirect: ${label} cannot change the Location`)
    }
    const l = await listGo()
    eq([l.status, l.headers.get('cache-control'), await l.json()], [200, 'private, no-store', { companions: [{ id: PACK_A, displayName: 'PK', packBaseUrl: BASE(PACK_A) }] }], 'C list: the owner sees their own entry')
    eq(g.__avSbSign.length, 4, 'C list: the list route signs nothing (4 signings so far: the four owner requests above)')
    // the same request for someone else
    reset(); g.__avSession = { user: { id: USER_B } }
    eq([await sig(await go(PACK_A, MANIFEST)), g.__avSbCreate.length, g.__avSbSign.length], [NOT_FOUND, 0, 0], 'C not the owner: the one 404, nothing signed, no client built')
    eq((await (await listGo()).json()).companions.map(c => c.id), [PACK_B], 'C list: a second user sees only theirs')
    g.__avSession = { user: { id: USER_A } }
    eq([await sig(await go(PACK_E, MANIFEST)), await sig(await go(PACK_X, MANIFEST)), g.__avSbSign.length], [NOT_FOUND, NOT_FOUND, 0], 'C erased and unknown packs: the one 404, nothing signed')
    // unsafe paths through the real routers' params
    for (const bad of ['..', 'a.gif', '.env.json', '%2e%2e']) {
      eq(await sig(await packRoute.GET(packReq(PACK_A, MANIFEST), { params: Promise.resolve({ packId: PACK_A, path: ['motion', bad] }) })), NOT_FOUND, `C unsafe segment ${bad}: the one 404`)
    }
    eq(await sig(await packRoute.GET(new Request(`http://studio.test${BASE(PACK_A)}/motion/%2e%2e/manifest.json`), ctx(PACK_A, MANIFEST))), NOT_FOUND, 'C: a request whose URL does not match the segments: the one 404')
    eq(g.__avSbSign.length, 0, 'C unsafe paths: nothing signed')
    // signer failures and missing configuration
    reset(); g.__avSession = { user: { id: USER_A } }; g.__avSbFail = true
    eq(await sig(await go(PACK_A, MANIFEST)), NOT_FOUND, 'C: a signer that fails -> the one 404')
    for (const extra of [{ AVATAR_PACK_BUCKET: undefined }, { NEXT_PUBLIC_SUPABASE_URL: undefined }, { [SERVICE_VAR]: undefined }, { AVATAR_PACK_BUCKET: 'a/b' }]) {
      setEnv(extra); reset(); g.__avSession = { user: { id: USER_A } }
      eq([await sig(await go(PACK_A, MANIFEST)), g.__avSbSign.length], [NOT_FOUND, 0], `C missing configuration (${JSON.stringify(Object.keys(extra))}): the one 404, nothing signed`)
    }
    setEnv({ NEXT_PUBLIC_SUPABASE_URL: 'https://db-two.test' }); reset(); g.__avSession = { user: { id: USER_A } }
    await go(PACK_A, MANIFEST)
    eq(g.__avSbCreate.map(c => c.url), ['https://db-two.test'], 'C: a changed project URL builds a new client')
    setEnv({ AVATAR_PACK_LINK_TTL_SECONDS: '120' }); reset(); g.__avSession = { user: { id: USER_A } }
    const ttl = await go(PACK_A, MANIFEST)
    eq([g.__avSbSign[0].ttl, ttl.headers.get('cache-control')], [120, 'private, max-age=24'], 'C: AVATAR_PACK_LINK_TTL_SECONDS sets the link life and a fifth of it the redirect max-age')
    // the dev stand-in
    eq(g.__avFetch, [], 'C: nothing before the dev stand-in asked the network anything')
    setEnv({ NODE_ENV: 'development', AVATAR_PACK_DEV_STANDIN: 'true' }); reset(); g.__avSession = { user: { id: USER_A } }; g.__avServe = true
    const stand = await go(PACK_A, MANIFEST)
    eq([stand.status, stand.headers.get('location'), g.__avSbSign.length, g.__avSbCreate.length], [302, '/companions/maya/motion/manifest.json', 0, 0], 'C dev stand-in: in development, Maya\'s committed pack under the pack id, nothing signed')
    eq(g.__avFetch, [{ url: 'http://studio.test/companions/maya/motion/manifest.json', cache: 'no-store', method: 'HEAD', deadline: true }], 'C dev stand-in: it asked this same server, and only for that one committed file')
    eq(await sig(await go(PACK_A, 'motion/not-a-real-file.webp')), NOT_FOUND, 'C dev stand-in: a file that is not in the committed pack -> the one 404')
    eq(await sig(await go(PACK_A, 'motion')), NOT_FOUND, 'C dev stand-in: a folder is not a file (and has no extension) -> the one 404')
    g.__avSession = { user: { id: USER_B } }
    eq(await sig(await go(PACK_A, MANIFEST)), NOT_FOUND, 'C dev stand-in: still only for the owner')
    for (const nodeEnv of ['production', 'test', undefined]) {
      setEnv({ NODE_ENV: nodeEnv, AVATAR_PACK_DEV_STANDIN: 'true' }); reset(); g.__avSession = { user: { id: USER_A } }; g.__avServe = true
      const res = await go(PACK_A, MANIFEST)
      eq([res.headers.get('location'), g.__avSbSign.length, g.__avFetch.length], [fakeLink({ packId: PACK_A, path: MANIFEST }), 1, 0], `C dev stand-in: NODE_ENV ${nodeEnv} with the variable "true" signs for real instead, and asks nobody`)
    }
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
    Object.assign(process.env, saved)
    if (saved.NODE_ENV === undefined) delete process.env.NODE_ENV
    globalThis.fetch = () => { throw new Error('network is not allowed in this proof') }
    for (const k of ['__avSession', '__avSessionCalls', '__avSbCreate', '__avSbSign', '__avSbFail', '__avFetch', '__avServe']) delete g[k]
  }
}

async function proof(src) {
  const { m: link, url: linkUrl } = await load(src.link)
  const { m: access, url: accessUrl } = await load(src.access)
  await sectionA(link, access, src)
  await sectionB(link, access)
  await sectionO(access)
  await sectionC(src, accessUrl, linkUrl)
}

await proof(SRC)
const afterABC = checks

// ---------- D. flag-off identity and hygiene ----------
for (const rel of [LINK_REL, ACCESS_REL]) ok(!/^import /m.test(SRC[rel === LINK_REL ? 'link' : 'access']) && !/^export .* from /m.test(SRC[rel === LINK_REL ? 'link' : 'access']), `D: ${rel} is import-free`)
for (const [rel, text] of [[LINK_REL, SRC.link], [ACCESS_REL, SRC.access], [PACK_ROUTE_REL, SRC.pack], [COMPANIONS_ROUTE_REL, SRC.companions]]) ok(!/\bconsole\s*\./.test(text), `D: ${rel} makes no console call (a log line could carry an id or a link)`)
ok(!/\bprocess\s*\./.test(SRC.link) && !/\bprocess\s*\./.test(SRC.access) && !/\bfetch\s*\(/.test(SRC.link + SRC.access), 'D: the two modules read no environment themselves and make no network call')
ok(!/node:fs|from 'fs'|process\s*\.\s*cwd/.test(SRC.pack), 'D: the pack route builds no file path from a request (no fs, no cwd)')
const target = /function redirectTarget[\s\S]*?\n}\n/.exec(SRC.access)?.[0] ?? ''
ok(target.length > 400 && !/request|headers|\.url\b|Host/i.test(target.replace(/\/\*\*[\s\S]*?\*\//, '')), 'D: the Location check reads only the environment, the pack, the file and the minter\'s answer, never the request')
ok(SRC.pack.includes("from '@/lib/server/avatar-pack-access'") && SRC.pack.includes("from '@/lib/server/avatar-pack-link'") && SRC.companions.includes("from '@/lib/server/avatar-pack-access'"), 'D: the route files import the server modules')
ok(SRC.pack.split('\n').filter(l => l.includes('createClient(')).every(l => /^\s/.test(l)) && /^let cached: .* = null$/m.test(SRC.pack), 'D: the Supabase client is built inside a function (and the cache starts empty), never at module load')
const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(e => e.isDirectory() ? (['node_modules', '.next'].includes(e.name) ? [] : walk(path.join(dir, e.name))) : [path.join(dir, e.name)])
const appFiles = ['app', 'lib', 'hooks', 'components'].flatMap(walk).filter(f => /\.(ts|tsx)$/.test(f))
const others = appFiles.filter(f => !NEW_FILES.includes(f))
eq(others.filter(f => /(?:from|import|require)\s*\(?\s*['"][^'"]*server\/avatar-pack-(?:link|access)/.test(read(f))), [], 'D: no existing app file imports the new server modules (flag off, the rest of Studio is untouched)')
eq(others.filter(f => /AVATAR_COMPANIONS_REGISTRY|AVATAR_PACK_BUCKET|AVATAR_PACK_LINK_TTL_SECONDS|AVATAR_PACK_DEV_STANDIN/.test(read(f))), [], 'D: no other file names the new server variables')
const browserSide = others.filter(f => f.startsWith('components/') || f.startsWith('hooks/') || (f.startsWith('app/') && !f.startsWith('app/api/')) || /^lib\/(?:studio-|avatar|companion)/.test(f) || /avatar|companion/i.test(f))
eq(browserSide.filter(f => /SUPABASE_SERVICE_ROLE_KEY/.test(read(f))), [], 'D: no browser-side file names the service-role variable')
ok(!/api\/avatar/.test(read('middleware.ts')), 'D: middleware does not match /api/avatar (each route does its own session and owner check)')
for (const [rel, text] of [[LINK_REL, SRC.link], [ACCESS_REL, SRC.access], [PACK_ROUTE_REL, SRC.pack], [COMPANIONS_ROUTE_REL, SRC.companions], ['scripts/test-studio-avatar-pack-route.mjs', read('scripts/test-studio-avatar-pack-route.mjs')]]) {
  ok(!/sk-[A-Za-z0-9]/.test(text) && !/eyJ[A-Za-z0-9]/.test(text), `D key scan: ${rel} has no sk- or JWT-shaped literal`)
  ok(!/[A-Za-z0-9+/_-]{40,}/.test(text.replace(/(^|\s)\/\/[^\n]*/g, '$1').replace(/https?:\/\/\S+/g, '')), `D key scan: ${rel} has no long random-looking token`)
  ok(!/\b(?:password|passwd|secret|api[_-]?key|service[_-]?role[_-]?key|private[_-]?key)\b['"]?\s*[:=]\s*['"][^'"\s]{4,}['"]/i.test(text), `D key scan: ${rel} has no secret-looking assignment`)
  ok(!/:\/\/[^\s/@:'"]+:[^\s/@'"]+@/.test(text), `D key scan: ${rel} has no user:password@ URL`)
}
const plainD = checks

// ---------- E. mutants ----------
const MUTANTS = [
  // the flag
  ['access', "export async function handlePack(request: RequestLike, packId: string, segments: string[], deps: PackDeps): Promise<Response> {\n  if (!studioMyCompanionsOn(deps.env)) return refuse()\n", "export async function handlePack(request: RequestLike, packId: string, segments: string[], deps: PackDeps): Promise<Response> {\n"],
  ['access', "export async function handleCompanions(request: RequestLike, deps: AccessDeps): Promise<Response> {\n  if (!studioMyCompanionsOn(deps.env)) return refuse()\n", "export async function handleCompanions(request: RequestLike, deps: AccessDeps): Promise<Response> {\n"],
  ['access', "return env[STUDIO_SHELL_FLAG] === 'true' && env[MY_COMPANIONS_FLAG] === 'true'", "return env[MY_COMPANIONS_FLAG] === 'true'"],
  ['access', "return env[STUDIO_SHELL_FLAG] === 'true' && env[MY_COMPANIONS_FLAG] === 'true'", "return env[STUDIO_SHELL_FLAG] === 'true' && !!env[MY_COMPANIONS_FLAG]"],
  ['access', "return env[STUDIO_SHELL_FLAG] === 'true' && env[MY_COMPANIONS_FLAG] === 'true'", "return env[STUDIO_SHELL_FLAG] === 'true' && env[MY_COMPANIONS_FLAG] === 'true' && !!env[REGISTRY_VAR]"],
  // the owner
  ['access', 'entry.owner.userId !== userId) return refuse()', 'entry.owner.userId === userId) return refuse()'],
  ['access', "if (!entry || entry.erased || entry.owner.userId !== userId) return refuse()", "if (!entry || entry.owner.userId !== userId) return refuse()"],
  ['access', "if (!entry || entry.erased || entry.owner.userId !== userId) return refuse()", "if (!entry || entry.erased || entry.owner.userId !== userId) return new Response('{\"error\":\"Forbidden\"}', { status: 403, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } })"],
  ['access', "if (!entry || entry.erased || entry.owner.userId !== userId) return refuse()", "if (!entry) return refuse()"],
  ['access', "return typeof id === 'string' && id.length > 0 ? id : null", "return id == null ? null : String(id)"],
  ['access', "  if (userId === null) return refuse()\n  const entry", "  const entry"],
  // one refusal that differs
  ['access', "  if (userId === null) return refuse()\n  const entry", "  if (userId === null) { const r = refuse(); r.headers.set('X-Why', 'signed-out'); return r }\n  const entry"],
  ['access', "  if (!isReadMethod(request)) return refuse()\n  if (typeof packId", "  if (!isReadMethod(request)) return new Response(null, { status: 405 })\n  if (typeof packId"],
  ['access', "{ status: 404, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } }", "{ status: 404, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }"],
  ['access', "JSON.stringify({ error: 'Not found' })", "JSON.stringify({ error: 'Not found', hint: 'pack' })"],
  ['access', "  if (link === null) return refuse()", "  if (link === null) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })"],
  ['access', "return method === 'GET' || method === 'HEAD'", "return true"],
  // the path
  ['access', "const raw = rawPackPath(request?.url, packId)\n  if (raw === null || raw.includes('%') || raw.includes('\\\\') || raw.includes('//') || raw.includes('..') || raw !== path) return refuse()", "const raw = rawPackPath(request?.url, packId)\n  if (raw === null) return refuse()"],
  ['access', "|| raw.includes('..') || raw !== path) return refuse()", "|| raw.includes('..')) return refuse()"],
  ['access', "const SEGMENT_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/", "const SEGMENT_PATTERN = /^[A-Za-z0-9_.][A-Za-z0-9_.-]{0,127}$/"],
  ['access', "['.json', '.webp', '.png']", "['.json', '.webp', '.png', '.gif']"],
  ['access', "const PATH_MAX_SEGMENTS = 6", "const PATH_MAX_SEGMENTS = 7"],
  ['access', "const PATH_MAX_LENGTH = 200", "const PATH_MAX_LENGTH = 2000"],
  ['access', "if (dot < 1 || !FILE_EXTENSIONS.includes(last.slice(dot))) return null", "if (dot < 1) return null"],
  ['access', "for (const segment of segments) if (typeof segment !== 'string' || !SEGMENT_PATTERN.test(segment)) return null", "for (const segment of segments) if (typeof segment !== 'string') return null"],
  // the answer
  ['access', "max-age=${maxAge(ttlSeconds)}", "max-age=${ttlSeconds + 1}"],
  ['access', "return Math.min(60, Math.floor(ttlSeconds / 5))", "return Math.min(60, ttlSeconds)"],
  ['access', "return Math.min(60, Math.floor(ttlSeconds / 5))", "return Math.min(60, Math.floor(ttlSeconds / 2))"],
  ['access', ", 'Referrer-Policy': 'no-referrer' }", " }"],
  ['access', "Vary: 'Cookie', ", ""],
  ['access', "status: 302", "status: 307"],
  ['access', "return Math.min(900, Math.max(60, n))", "return n"],
  ['access', "if (!Number.isInteger(n)) return 300", "if (!Number.isInteger(n)) return 900"],
  ['access', "    link = redirectTarget(await minter.mint({ owner: entry.owner, packId, path, ttlSeconds }), deps.env, packId, path)\n  } catch {\n    return refuse()\n  }", "    link = redirectTarget(await minter.mint({ owner: entry.owner, packId, path, ttlSeconds }), deps.env, packId, path)\n  } catch {\n    throw new Error('mint failed')\n  }"],
  // no open redirect: the Location is the configured storage origin + this file's signing path (or the dev stand-in's exact path)
  ['access', "if (parsed.origin !== origin || parsed.username || parsed.password) return null", "if (parsed.username || parsed.password) return null"],
  ['access', "if (parsed.origin !== origin || parsed.username || parsed.password) return null", "if (!parsed.origin.startsWith(origin) || parsed.username || parsed.password) return null"],
  ['access', "if (parsed.origin !== origin || parsed.username || parsed.password) return null", "if (!link.startsWith(origin) || parsed.username || parsed.password) return null"],
  ['access', "if (parsed.origin !== origin || parsed.username || parsed.password) return null", "if (parsed.hostname !== new URL(origin).hostname || parsed.username || parsed.password) return null"],
  ['access', "if (parsed.origin !== origin || parsed.username || parsed.password) return null", "if (parsed.origin !== origin) return null"],
  ['access', "const origin = storageOrigin(env)\n  if (origin === null) return null\n", "const origin = storageOrigin(env) ?? new URL(link).origin\n"],
  ['access', "if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null", "if (url.protocol !== 'https:' || !url.hostname) return null"],
  ['access', " || !rawPath.endsWith(`/${packId}/${path}`)) return null", ") return null"],
  ['access', "!rawPath.endsWith(`/${packId}/${path}`)", "!link.endsWith(`/${packId}/${path}`)"],
  ['access', "!rawPath.endsWith(`/${packId}/${path}`)", "!rawPath.endsWith(`/${path}`)"],
  ['access', "!rawPath.endsWith(`/${packId}/${path}`)", "!rawPath.includes(`/${packId}/`)"],
  ['access', "if (!rawPath.startsWith(SIGN_PREFIX) || ", "if ("],
  ['access', "rawPath !== parsed.pathname || rawPath.includes('%')", "rawPath.includes('%')"],
  ['access', "|| rawPath.includes('%') || rawPath.includes('//')", "|| rawPath.includes('//')"],
  ['access', "|| rawPath.includes('//') || rawPath.includes('..')) return null", "|| rawPath.includes('..')) return null"],
  ['access', "(?:\\?[^#]*)?$/.exec(link)", "(?:\\?[^#]*)?/.exec(link)"],
  ['access', "link.length === 0 || link.length > 2048 || ", "link.length === 0 || "],
  ['access', "devStandInOn(env) && link === `${DEV_STAND_IN_PATH}${path}` ? link : null", "link === `${DEV_STAND_IN_PATH}${path}` ? link : null"],
  ['access', "devStandInOn(env) && link === `${DEV_STAND_IN_PATH}${path}` ? link : null", "link.startsWith('/') ? link : null"],
  ['access', "devStandInOn(env) && link === `${DEV_STAND_IN_PATH}${path}` ? link : null", "devStandInOn(env) && link.startsWith(DEV_STAND_IN_PATH) ? link : null"],
  ['access', "return env.NODE_ENV === 'development' && env[DEV_STAND_IN_VAR] === 'true'", "return env[DEV_STAND_IN_VAR] === 'true'"],
  // the registry and the list
  ['access', "if (entry.packBaseUrl !== undefined && entry.packBaseUrl !== packBaseUrl) continue", ""],
  ['access', "|| seen.has(entry.id)) continue", ") continue"],
  ['access', "const REGISTRY_MAX_ENTRIES = 20", "const REGISTRY_MAX_ENTRIES = 200"],
  ['access', "erased: entry.erased !== undefined && entry.erased !== false", "erased: entry.erased === true"],
  ['access', ".filter(entry => !entry.erased && entry.owner.userId === userId)", ".filter(entry => entry.owner.userId === userId)"],
  ['access', ".filter(entry => !entry.erased && entry.owner.userId === userId)", ".filter(entry => !entry.erased)"],
  ['access', ".map(entry => ({ id: entry.id, displayName: entry.displayName, packBaseUrl: entry.packBaseUrl }))", ".map(entry => entry as unknown as CompanionView)"],
  ['access', "JSON.stringify({ companions }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } }", "JSON.stringify({ companions }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } }"],
  ['access', "return name.length >= 1 && name.length <= NAME_MAX ? name : null", "return name.length <= NAME_MAX ? name : null"],
  ['access', ".replace(/\\s+/g, ' ').trim()", ".trim()"],
  ['access', "owner: { app: OWNER_APP, tenantId: OWNER_TENANT, userId: owner.userId }", "owner: { ...(owner as object), app: OWNER_APP, tenantId: OWNER_TENANT, userId: owner.userId } as PackOwner"],
  ['access', "if (raw.length === 0 || raw.length > REGISTRY_MAX_CHARS) return []", "if (raw.length === 0) return []"],
  // the minter
  ['link', "`${packId}/${clean}`", "clean"],
  ['link', "return env.NODE_ENV === 'development' && env[PACK_DEV_STANDIN_VAR] === 'true'", "return env[PACK_DEV_STANDIN_VAR] === 'true'"],
  ['link', "return env.NODE_ENV === 'development' && env[PACK_DEV_STANDIN_VAR] === 'true'", "return env.NODE_ENV !== 'production' && env[PACK_DEV_STANDIN_VAR] === 'true'"],
  ['link', "return env.NODE_ENV === 'development' && env[PACK_DEV_STANDIN_VAR] === 'true'", "return env.NODE_ENV === 'development' && !!env[PACK_DEV_STANDIN_VAR]"],
  ['link', "        if (!devStandInActive(options.env)) return null\n", ""],
  ['link', "if (!(await options.fileExists(DEV_STAND_IN_ROOT + clean))) return null", ""],
  ['link', "if (error || !data) return null", "if (!data) return null"],
  ['link', "return safeLink(data.signedUrl, false)", "return data.signedUrl"],
  ['link', "if (allowSameOrigin && /^\\/(?![/\\\\])/.test(url)) return url", "if (/^\\/(?![/\\\\])/.test(url)) return url"],
  ['link', "if (typeof options.bucket !== 'string' || !BUCKET_PATTERN.test(options.bucket)) return null", ""],
  ['link', "return Math.min(LINK_TTL_MAX, Math.max(LINK_TTL_MIN, n))", "return n"],
  ['link', "clampTtlSeconds(ttlSeconds))\n        if (error", "ttlSeconds)\n        if (error"],
  ['link', "return Math.min(REDIRECT_MAX_AGE_CAP, Math.floor(ttlSeconds / 5))", "return REDIRECT_MAX_AGE_CAP"],
  ['link', "if (typeof bucket === 'string' && bucket.length > 0 && deps.storage) return supabasePackLinkMinter({ storage: deps.storage, bucket })", "if (deps.storage) return supabasePackLinkMinter({ storage: deps.storage, bucket: bucket ?? 'avatars' })"],
  ['link', "if (devStandInActive(env)) return devStandInMinter({ env, fileExists: deps.fileExists ?? (() => false) })", "if (devStandInActive(env)) return devStandInMinter({ env, fileExists: deps.fileExists ?? (() => true) })"],
  ['link', "    if (!clean || !deps || !deps.minter || typeof deps.minter.mint !== 'function') return null", "    if (!deps || !deps.minter || typeof deps.minter.mint !== 'function') return null"],
  ['link', "    if (!validPackId(packId)) return null\n    const clean = safePackPath(path)\n    if (!clean || !deps", "    const clean = safePackPath(path)\n    if (!clean || !deps"],
  ['link', "const url = safeLink(await deps.minter.mint({ owner, packId, path: clean, ttlSeconds }))", "const url = await deps.minter.mint({ owner, packId, path: clean, ttlSeconds })"],
  ['link', "await deps.minter.mint({ owner, packId, path: clean, ttlSeconds })", "await deps.minter.mint({ packId, path: clean, ttlSeconds } as never)"],
  ['link', "export const PACK_ID_PATTERN = /^u-[a-z0-9]{26}$/", "export const PACK_ID_PATTERN = /^u-[a-z0-9]{26,}$/"],
  ['link', "if (path.includes('..')) return null", ""],
  ['link', "export const PACK_PATH_MAX_SEGMENTS = 6", "export const PACK_PATH_MAX_SEGMENTS = 7"],
  ['link', "if (dot < 1 || !PACK_FILE_EXTENSIONS.includes(last.slice(dot))) return null", "if (dot < 1) return null"],
  ['link', "if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) return null", "if (parsed.protocol !== 'https:' || !parsed.hostname) return null"],
  ['link', "export const LINK_TTL_DEFAULT = 300", "export const LINK_TTL_DEFAULT = 900"],
  // the route files
  ['pack', "{ storage: signer, fileExists: relativePath => servedHere(request, relativePath) }", "{ storage: signer }"],
  ['pack', "    return response.ok\n", "    return true\n"],
  ['pack', "new URL(relativePath.replace(/^public\\//, '/'), request.url)", "new URL('/companions/maya/motion/manifest.json', request.url)"],
  ['pack', "{ method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(3000) }", "{ cache: 'no-store', signal: AbortSignal.timeout(3000) }"],
  ['pack', "{ method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(3000) }", "{ method: 'HEAD', cache: 'no-store' }"],
  ['pack', "{ method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(3000) }", "{ method: 'HEAD', signal: AbortSignal.timeout(3000) }"],
  ['pack', "client: createClient(url, serviceKey, { auth: { persistSession: false } }) }", "client: createClient(url, serviceKey) }"],
  ['pack', "if (!cached || cached.url !== url || cached.serviceKey !== serviceKey)", "if (!cached || cached.serviceKey !== serviceKey)"],
  ['pack', "if (!cached || cached.url !== url || cached.serviceKey !== serviceKey)", "if (true)"],
  ['pack', "if (!url || !serviceKey) throw new Error('storage is not configured')", "if (!url) throw new Error('storage is not configured')"],
  ['pack', "      const session = await getServerSession(authOptions)\n", "      const session = { user: { id: 'user-a' } }\n"],
  ['companions', "      const session = await getServerSession(authOptions)\n", "      const session = { user: { id: 'user-a' } }\n"],
  ['pack', "return typeof user?.id === 'string' && user.id ? user.id : null", "return user?.email && typeof user.id === 'string' && user.id ? user.id : null"],
  ['pack', "const { packId, path } = await context.params\n  return handlePack(request, packId, path, {", "const { packId, path } = await context.params\n  return handlePack(request, packId, path.slice(0, 1), {"],
  ['pack', "export async function POST(request: Request, context: Context) {\n  return GET(request, context)\n}\n", ""],
  ['companions', "export async function OPTIONS(request: Request) {\n  return GET(request)\n}\n", ""],
]
let caught = 0
for (const [target, from, to] of MUTANTS) {
  if (!SRC[target].includes(from)) throw new Error(`mutant anchor missing in ${target}: ${from}`)
  let died = false
  try { await proof({ ...SRC, [target]: SRC[target].replace(from, () => to) }) } catch (error) { if (error?.name === 'SyntaxError') throw new Error(`mutant does not even parse: ${from}`); died = true; if (process.env.PROOF_VERBOSE) console.log(`  caught (${target}) ${String(error?.message).split('\n')[0].slice(0, 110)}`) }
  if (!died) throw new Error(`mutant survived (${target}): ${from}`)
  caught++
}
fs.rmSync(tmp, { recursive: true, force: true })
console.log(`${afterABC} checks A-C, ${plainD - afterABC} checks D`)
console.log(`${plainD} passed, 0 failed; mutants ${caught} caught, ${MUTANTS.length - caught} missed`)
