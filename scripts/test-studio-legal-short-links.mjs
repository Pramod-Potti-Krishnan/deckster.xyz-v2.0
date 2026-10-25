// FRONTEND-2 (PROGRAM-1 decision D16 a, 25 Oct): proof for the flag NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS (exact "true", default off, build-time). `uat`'s next.config.mjs has two short legal links (/terms -> /legal/terms,
// /privacy -> /legal/privacy, permanent: false) and a cache header on /marketing/v3/slides/:path* that the Studio dev tree lacks; carried into `uat`, the dev tree's next.config.mjs would drop all three. They are ported
// as two new pages (the redirects, behind the flag) and one vercel.json entry (the header: a deploy config file cannot read an environment variable, so it is not behind the flag). NOT ported: `uat`'s /docs/api -> /docs and
// /shortcuts -> /learn (the dev tree has real, newer pages there).
// Run: node scripts/test-studio-legal-short-links.mjs   (plain node: the pages are transpiled and EXECUTED against Next's own redirect() and notFound(), `git show` reads the base and `uat` commits; no network, no browser, no build)
//
//   1. pages      flag off (9 spellings, and another flag set alone): both pages throw Next's not-found (404) and never a redirect; flag on: a redirect to the exact destination, HTTP 307 (temporary), replace; the destinations are
//                 `uat`'s (read from `uat`'s next.config.mjs); server components, the flag read inline once, `dynamic = 'force-dynamic'`
//   2. header     vercel.json: one new entry, the source and the Cache-Control value byte equal to `uat`'s headers() entry (read from `uat`'s next.config.mjs); every other byte of vercel.json is the base's
//   3. not ported /docs/api and /shortcuts: `uat` has them, the dev pages exist, nothing here redirects them
//   4. untouched  next.config.mjs, middleware.ts, the root layout, the not-found page, both legal pages, sign-in/up and legal-links are the base commit's, byte for byte (flag off = today)
//   5. routes     the route set grows by exactly /terms and /privacy (the flags-off build's route list: +2)
//   6. env        .env.example: the flag's block, default "false", registered; without the registered blocks the file is the base's
//   7. registry   two lines (its files and its block), no strip
//   8. scope      the COMMITTED diff only (BASE..HEAD); the working tree is never consulted for scope; no older test is edited; no secret
//   9. mutants    each one must make sections 1-8 fail
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import {
  BASE_COMMIT, LEGAL_SHORT_LINKS_BULK_EDIT_PROOF, LEGAL_SHORT_LINKS_COMMIT_SUBJECT, LEGAL_SHORT_LINKS_OLDER_PROOFS, LEGAL_SHORT_LINKS_POLISH_F_PROOF, LEGAL_SHORT_LINKS_ENV_BLOCK, LEGAL_SHORT_LINKS_FLAG, LEGAL_SHORT_LINKS_NEW_FILES, LEGAL_SHORT_LINKS_OWN_EDITS, LEGAL_SHORT_LINKS_SCOPE_FILES, UAT_COMMIT,
} from './studio-legal-short-links-strip.mjs'
import { LATER_CHANGE_FILES, LATER_ENV_BLOCKS, LATER_STRIPS, stripLaterEnvBlocks } from './studio-later-changes.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeRequire = createRequire(import.meta.url)
const { redirect, permanentRedirect } = nodeRequire('next/dist/client/components/redirect')
const { notFound } = nodeRequire('next/dist/client/components/not-found')
const BASE = process.env.LEGAL_SHORT_LINKS_BASE || BASE_COMMIT
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
const showCache = new Map()
const showOf = (commit, rel) => { const ref = `${commit}:${rel}`; if (!showCache.has(ref)) showCache.set(ref, git('show', ref)); return showCache.get(ref) }
const baseOf = rel => showOf(BASE, rel)
let overrides = {} // in-memory mutations: every proof reads its sources through read()
const read = rel => (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))
const sha = value => crypto.createHash('sha256').update(value).digest('hex')

let checks = 0
const count = fn => (...args) => { checks++; return fn(...args) }
const eq = count(assert.equal), deep = count(assert.deepEqual), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch)

const FLAG = LEGAL_SHORT_LINKS_FLAG
const HELPER = 'lib/studio-legal-short-links.ts', TERMS = 'app/terms/page.tsx', PRIVACY = 'app/privacy/page.tsx'
const BULK_EDIT_PROOF = LEGAL_SHORT_LINKS_BULK_EDIT_PROOF, POLISH_F_PROOF = LEGAL_SHORT_LINKS_POLISH_F_PROOF
const VERCEL = 'vercel.json', ENV = '.env.example', REGISTRY = 'scripts/studio-later-changes.mjs', STRIP_MODULE = 'scripts/studio-legal-short-links-strip.mjs', THIS_TEST = 'scripts/test-studio-legal-short-links.mjs'
const PAGES = { terms: { file: TERMS, from: '/terms', to: '/legal/terms', fn: 'TermsShortLink' }, privacy: { file: PRIVACY, from: '/privacy', to: '/legal/privacy', fn: 'PrivacyShortLink' } }
const OLDER_PROOF_EDITS = {
  [BULK_EDIT_PROOF]: { removed: /^-  eq\(envText, `\$\{baseOf\(ENV\)\}/, added: 4, about: /LATER_ENV_BLOCKS|\bown\b|\blater\b|envText/, topic: 'the registered later .env.example blocks' },
  [POLISH_F_PROOF]: { removed: /^-    nomatch\(git\('diff', '--name-status'/, added: 3, about: /LATER_CHANGE_FILES|modified|later/, topic: 'the files of a later registered change' },
}
const HEADER_SOURCE = '/marketing/v3/slides/:path*'
const HEADER_SOURCE_UAT_COPY = '/marketing/v3-uat/slides/:path*' // where NEXT_PUBLIC_STUDIO_UAT_MARKETING serves its stills
const HEADER_VALUE = 'public, max-age=86400, stale-while-revalidate=604800'
const NOT_FOUND = 'NEXT_HTTP_ERROR_FALLBACK;404'
const OFF_SPELLINGS = [undefined, '', 'false', '0', '1', 'TRUE', 'True', ' true', 'true '] // nine spellings that are not the exact value "true"

const headerOf = (name, value) => ({ key: name, value }) // one HTTP header the way next.config.mjs and vercel.json write it
// `uat`'s own values, copied. The proof checks the dev tree against uat's next.config.mjs when this clone has the commit, and these literals always.
const UAT_LITERAL = {
  redirects: [{ source: '/terms', destination: '/legal/terms', permanent: false }, { source: '/privacy', destination: '/legal/privacy', permanent: false }],
  header: { source: HEADER_SOURCE, headers: [headerOf('Cache-Control', HEADER_VALUE)] },
  notPorted: [{ source: '/docs/api', destination: '/docs', permanent: false }, { source: '/shortcuts', destination: '/learn', permanent: false }],
}

// ---------------------------------------------------------------- uat's next.config.mjs, executed
async function loadConfig(text, label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legal-short-links-'))
  try {
    const file = path.join(dir, 'next.config.mjs')
    fs.writeFileSync(file, text)
    const config = (await import(`${pathToFileURL(file).href}?${label}`)).default
    return { redirects: await config.redirects(), headers: await config.headers() }
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
let uatSource = null
try { uatSource = showOf(UAT_COMMIT, 'next.config.mjs') } catch { uatSource = null }
const UAT = uatSource === null ? null : await loadConfig(uatSource, 'uat')
const UAT_MUTANT = uatSource === null ? null : await loadConfig(uatSource.replace('max-age=86400', 'max-age=3600'), 'uat-mutant')

// ---------------------------------------------------------------- loading the pages (TypeScript transpiled, run in a vm with the framework's own redirect() and notFound())
const compileCache = new Map()
function compile(rel, text) {
  const cacheId = `${rel}\0${text}`
  if (!compileCache.has(cacheId)) compileCache.set(cacheId, ts.transpileModule(text, { fileName: rel, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compileCache.get(cacheId)
}
function loadHelper(text) {
  const module = { exports: {} }
  vm.runInNewContext(compile(HELPER, text), { module, exports: module.exports, require: spec => { throw new Error(`unexpected import ${spec} in ${HELPER}`) }, process: { env: {} }, URLSearchParams }, { filename: HELPER })
  return module.exports
}
function loadPage(rel, text, helper, env, redirectFn = redirect) {
  const module = { exports: {} }
  const req = spec => {
    if (spec === 'next/navigation') return { notFound, redirect: redirectFn, permanentRedirect }
    if (spec === '@/lib/studio-legal-short-links') return helper
    throw new Error(`unexpected import ${spec} in ${rel}`)
  }
  vm.runInNewContext(compile(rel, text), { module, exports: module.exports, require: req, process: { env } }, { filename: rel })
  return module.exports
}
/** What a visit does: the digest Next's redirect() / notFound() throws ("NEXT_REDIRECT;replace;<url>;307;" / "NEXT_HTTP_ERROR_FALLBACK;404"), or what the page returned. */
async function visit(rel, text, helper, env, searchParams = {}) {
  const mod = loadPage(rel, text, helper, env)
  try { return { returned: await mod.default({ searchParams: Promise.resolve(searchParams) }) } } catch (error) { return { digest: error?.digest ?? `threw ${String(error?.message ?? error)}` } }
}
/** The query string cases: what a request carries, and the query string the redirect must carry (the request's OWN search parameters, percent-encoded, nothing else). */
const INHERITED = Object.assign(Object.create({ inherited: 'x' }), { x: '1' })
const QUERY_CASES = [
  [{ x: '1' }, '?x=1'],
  [{ a: '1', b: '2' }, '?a=1&b=2'],
  [{ b: '2', a: '1' }, '?b=2&a=1'],
  [{ tag: ['a', 'b'] }, '?tag=a&tag=b'],
  [{ q: 'a b' }, '?q=a+b'],
  [{ q: 'a&b=c#d' }, '?q=a%26b%3Dc%23d'],
  [{ q: 'a;b' }, '?q=a%3Bb'],
  [{ next: '//evil.example/x' }, '?next=%2F%2Fevil.example%2Fx'],
  [{ next: 'https://evil.example' }, '?next=https%3A%2F%2Fevil.example'],
  [{ next: '/legal/../../admin' }, '?next=%2Flegal%2F..%2F..%2Fadmin'],
  [{ 'a=b': '1' }, '?a%3Db=1'],
  [{ 'x y': 'z' }, '?x+y=z'],
  [{ x: '' }, '?x='],
  [{ q: '\r\nSet-Cookie: a=b' }, '?q=%0D%0ASet-Cookie%3A+a%3Db'],
  [{ q: '\u00e9' }, '?q=%C3%A9'],
  [{ q: '%2e%2e' }, '?q=%252e%252e'],
  [{ x: undefined }, ''],
  [{ n: 5 }, ''],
  [{ a: ['1', 2] }, '?a=1'],
  [{}, ''],
  [INHERITED, '?x=1'], // a parameter the request did not carry is never echoed
]
const pairsOf = params => Object.entries(params).flatMap(([name, value]) => (typeof value === 'string' ? [[name, value]] : Array.isArray(value) ? value.filter(item => typeof item === 'string').map(item => [name, item]) : []))
/** The text without comments (a comment may talk about process.env and imports). */
const codeOf = text => text.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(line => !line.trim().startsWith('//')).join('\n')
const envOf = value => (value === undefined ? {} : { [FLAG]: value })

// ---------------------------------------------------------------- 1. the pages
async function provePages(at = '', ctx = {}) {
  const a = message => (at ? `${at}: pages: ${message}` : `pages: ${message}`)
  const helperText = read(HELPER), helper = loadHelper(helperText)
  const outcomes = []
  for (const [name, page] of Object.entries(PAGES)) {
    const text = read(page.file)
    for (const spelling of OFF_SPELLINGS) {
      const out = await visit(page.file, text, helper, envOf(spelling))
      eq(out.digest, NOT_FOUND, a(`${page.from}: the flag ${JSON.stringify(spelling)} is off: the not-found page (404), no redirect`))
      outcomes.push(out.digest)
      const withQuery = await visit(page.file, text, helper, envOf(spelling), { x: '1', tag: ['a', 'b'] })
      eq(withQuery.digest, NOT_FOUND, a(`${page.from}: the flag ${JSON.stringify(spelling)} is off: a query string changes nothing, still the not-found page`))
      outcomes.push(withQuery.digest)
    }
    // another flag set alone does not turn it on (the sign-in links' own flag, the legal pages' title flag)
    for (const other of ['NEXT_PUBLIC_LEGAL_LINKS_FIXED_ENABLED', 'NEXT_PUBLIC_STUDIO_P2_DOCS', 'NEXT_PUBLIC_STUDIO_V4_SHELL']) {
      const out = await visit(page.file, text, helper, { [other]: 'true' }, { x: '1' })
      eq(out.digest, NOT_FOUND, a(`${page.from}: ${other} alone does not turn it on`))
      outcomes.push(out.digest)
    }
    const on = await visit(page.file, text, helper, envOf('true'))
    eq(on.digest, `NEXT_REDIRECT;replace;${page.to};307;`, a(`${page.from}: the flag "true": a redirect to ${page.to}, HTTP 307 (temporary, as uat's permanent: false), replace`))
    eq(helper.studioLegalShortLinkTarget(name, 'true'), page.to, a(`${page.from}: the helper's target with the flag on`))
    eq(helper.studioLegalShortLinkTarget(name, 'true', {}), page.to, a(`${page.from}: the helper's target with the flag on and no query`))
    eq(helper.studioLegalShortLinkTarget(name, undefined), null, a(`${page.from}: the helper's target with the flag unset`))
    eq(helper.studioLegalShortLinkTarget(name, undefined, { x: '1' }), null, a(`${page.from}: the helper's target with the flag unset and a query`))
    // the query string: the request's own search parameters, percent-encoded, and nothing else
    for (const [params, query] of QUERY_CASES) {
      const carried = await visit(page.file, text, helper, envOf('true'), params)
      eq(carried.digest, `NEXT_REDIRECT;replace;${page.to}${query};307;`, a(`${page.from}: ?${JSON.stringify(params)} is carried as ${JSON.stringify(query)} (HTTP 307, to ${page.to} and nowhere else)`))
      eq(helper.studioLegalShortLinkQuery(params), query, a(`${page.from}: the helper's query for ${JSON.stringify(params)}`))
      deep([...new URLSearchParams(query.slice(1)).entries()], pairsOf(params), a(`${page.from}: the carried query parses back to exactly the request's own parameters, in order (${JSON.stringify(params)})`))
      nomatch(query, /[\r\n#\s;]|\/\/|^\?.*\?/, a(`${page.from}: the carried query has no raw whitespace, line break, fragment, semicolon, second query mark or protocol-relative path`))
      ok(carried.digest.startsWith(`NEXT_REDIRECT;replace;${page.to}`) && /^(\?|;)/.test(carried.digest.slice(`NEXT_REDIRECT;replace;${page.to}`.length)), a(`${page.from}: the path part is ${page.to}, whatever the query`))
    }
    eq(await visit(page.file, text, helper, envOf('true'), null).then(out => out.digest), `NEXT_REDIRECT;replace;${page.to};307;`, a(`${page.from}: no search parameters object at all is no query`))
    // the page's structure
    nomatch(text, /use client/, a(`${page.file}: a server component`))
    eq((codeOf(text).match(/process\.env/g) || []).length, 1, a(`${page.file}: reads the environment once`))
    eq((codeOf(text).match(/process\.env\.NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS\b/g) || []).length, 1, a(`${page.file}: and that read is the flag, written inline (Next inlines NEXT_PUBLIC_ values at build time)`))
    match(text, /export const dynamic = 'force-dynamic'/, a(`${page.file}: dynamic: the redirect / not-found is decided per request, not prerendered`))
    match(text, new RegExp(`export default async function ${page.fn}\\(\\{ searchParams \\}: \\{ searchParams: Promise<StudioLegalShortLinkSearchParams> \\}\\) \\{`), a(`${page.file}: an async function component taking searchParams as a Promise (Next 15) and nothing else (no params)`))
    eq((codeOf(text).match(/searchParams/g) || []).length, 3, a(`${page.file}: searchParams is destructured once, typed once and awaited once`))
    match(text, /studioLegalShortLinkTarget\('(terms|privacy)', process\.env\.NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS, await searchParams\)/, a(`${page.file}: the awaited search parameters go to the helper, and to nothing else`))
    match(text, /import \{ notFound, redirect \} from 'next\/navigation'/, a(`${page.file}: the framework's notFound and redirect (a temporary redirect, not permanentRedirect)`))
    nomatch(text, /permanentRedirect|NextResponse|headers\(\)|cookies\(\)|getServerSession|fetch\(/, a(`${page.file}: no permanent redirect, no request, no session`))
    ok(fs.existsSync(path.join(root, name === 'terms' ? 'app/legal/terms/page.tsx' : 'app/legal/privacy/page.tsx')), a(`${page.to} is a page that exists`))
  }
  // the helper
  deep(JSON.parse(JSON.stringify(helper.STUDIO_LEGAL_SHORT_LINKS)), { terms: { source: '/terms', destination: '/legal/terms' }, privacy: { source: '/privacy', destination: '/legal/privacy' } }, a('the helper holds the two pairs and nothing else'))
  for (const spelling of OFF_SPELLINGS) eq(helper.studioLegalShortLinksOn(spelling), false, a(`the helper: ${JSON.stringify(spelling)} is off`))
  eq(helper.studioLegalShortLinksOn('true'), true, a('the helper: exactly "true" is on'))
  eq(helper.studioLegalShortLinksOn(null), false, a('the helper: null is off'))
  nomatch(codeOf(helperText), /process\.env|^import |\bimport\(|\brequire\(|\bwindow\b|\bdocument\b|\blocation\b|\bnavigator\b|\bcookies\b|\bheaders\b/m, a('the helper is import-free and reads no environment, no browser global, no cookie, no header (the callers pass the value and the search parameters)'))
  // uat's own redirects: the same two pairs, temporary
  const uatRedirects = (ctx.uat ?? UAT)?.redirects ?? UAT_LITERAL.redirects
  for (const page of Object.values(PAGES)) {
    const entry = uatRedirects.find(r => r.source === page.from)
    ok(entry, a(`uat has a redirect for ${page.from}`))
    eq(entry.destination, page.to, a(`${page.from}: the destination is uat's`))
    eq(entry.permanent, false, a(`${page.from}: uat's redirect is not permanent (a 307), as this page's`))
  }
  deep(uatRedirects.filter(r => r.source === '/terms' || r.source === '/privacy'), UAT_LITERAL.redirects, a('uat\'s two short-link redirects are the literals this proof carries'))
  // what 307 means: Next's own status for permanent: false is 307, for true 308 (the framework's functions, not a guess)
  let permanent = null
  try { permanentRedirect('/x') } catch (error) { permanent = error.digest }
  eq(permanent, 'NEXT_REDIRECT;replace;/x;308;', a('the framework: a permanent redirect is 308, so 307 is the non-permanent one'))
  return { states: outcomes.length, sha: sha(outcomes.join('\n')) }
}

// ---------------------------------------------------------------- 2. the header
const parseJson = (rel, text) => { try { return JSON.parse(text) } catch (error) { throw new Error(`${rel} is not valid JSON: ${error.message}`) } }
function proveHeader(at = '', ctx = {}) {
  const a = message => (at ? `${at}: header: ${message}` : `header: ${message}`)
  const text = read(VERCEL), json = parseJson(VERCEL, text), base = parseJson(VERCEL, baseOf(VERCEL))
  const mine = json.headers.filter(h => h.source === HEADER_SOURCE)
  eq(mine.length, 1, a(`exactly one entry for ${HEADER_SOURCE}`))
  deep(mine[0], UAT_LITERAL.header, a('it is the literal this proof carries: the source, and one Cache-Control header, nothing else'))
  eq(mine[0].headers[0].value, HEADER_VALUE, a('the value'))
  const uatEntry = ((ctx.uat ?? UAT)?.headers ?? [UAT_LITERAL.header]).find(h => h.source === HEADER_SOURCE)
  ok(uatEntry, a('uat has the entry'))
  deep(mine[0], uatEntry, a('byte equal to uat\'s headers() entry (read from uat\'s next.config.mjs): the same source, the same key, the same value'))
  eq(JSON.stringify(mine[0].headers), JSON.stringify(uatEntry.headers), a('and the same serialisation'))
  // the same header for the UAT marketing copy of the stills (NEXT_PUBLIC_STUDIO_UAT_MARKETING on: that is where UAT's design reads them): same value, unflagged
  const copy = json.headers.filter(h => h.source === HEADER_SOURCE_UAT_COPY)
  eq(copy.length, 1, a(`exactly one entry for ${HEADER_SOURCE_UAT_COPY}`))
  deep(copy[0], { source: HEADER_SOURCE_UAT_COPY, headers: UAT_LITERAL.header.headers }, a('it is the same single Cache-Control header, nothing else'))
  eq(JSON.stringify(copy[0].headers), JSON.stringify(uatEntry.headers), a('and byte equal to uat\'s header list (the same key and value, serialised alike)'))
  eq(copy[0].headers[0].value, HEADER_VALUE, a('the same value'))
  ok(fs.existsSync(path.join(root, 'public/marketing/v3-uat/slides/deck-01.jpg')) && fs.existsSync(path.join(root, 'public/marketing/v3/slides/deck-01.jpg')), a('both stills folders exist in public/'))
  match(read('components/marketing/v3-uat/home/Gallery.tsx'), /\/marketing\/v3-uat\/slides\/deck-/, a('and the UAT marketing components read their stills from /marketing/v3-uat/slides/'))
  eq(json.headers.length, base.headers.length + 2, a('two entries more than the base'))
  deep(json.headers.filter(h => h.source !== HEADER_SOURCE && h.source !== HEADER_SOURCE_UAT_COPY), base.headers, a('every other headers entry (the /api CORS entry) is the base\'s'))
  deep(Object.fromEntries(Object.entries(json).filter(([key]) => key !== 'headers')), Object.fromEntries(Object.entries(base).filter(([key]) => key !== 'headers')), a('and every other key of vercel.json (redirects, crons, functions, git ...) is the base\'s'))
  eq(JSON.stringify(json.headers.slice(0, base.headers.length)), JSON.stringify(base.headers), a('the new entries come after the base\'s, so the base entries keep their order'))
  deep(json.headers.slice(base.headers.length).map(h => h.source), [HEADER_SOURCE, HEADER_SOURCE_UAT_COPY], a('in this order: the stills uat sets it on, then the UAT marketing copy'))
  eq((text.match(/v3-uat/g) || []).length, 1, a('/marketing/v3-uat is named once, in that entry, and no other marketing path is'))
  nomatch(text, /STUDIO_LEGAL_SHORT_LINKS/, a('vercel.json does not name the flag (a deploy config cannot read it)'))
}

// ---------------------------------------------------------------- 3. what is NOT ported
function proveNotPorted(at = '', ctx = {}) {
  const a = message => (at ? `${at}: not ported: ${message}` : `not ported: ${message}`)
  const uatRedirects = (ctx.uat ?? UAT)?.redirects ?? UAT_LITERAL.redirects
  for (const entry of UAT_LITERAL.notPorted) {
    deep(uatRedirects.find(r => r.source === entry.source), entry, a(`uat redirects ${entry.source} to ${entry.destination} (so leaving it out is a decision, not an oversight)`))
  }
  ok(fs.existsSync(path.join(root, 'app/docs/api/page.tsx')), a('the dev tree has a real /docs/api page (FRONTEND-1\'s)'))
  ok(fs.existsSync(path.join(root, 'app/(app)/shortcuts/page.tsx')), a('the dev tree has a real /shortcuts page (FRONTEND-1\'s)'))
  const json = parseJson(VERCEL, read(VERCEL))
  nomatch(JSON.stringify(json.redirects ?? []), /docs\/api|shortcuts|"\/docs"|\/learn/, a('vercel.json redirects neither'))
  nomatch(read(HELPER) + read(TERMS) + read(PRIVACY), /docs\/api|shortcuts|\/learn/, a('neither the helper nor a page names them'))
  const config = read('next.config.mjs')
  nomatch(config, /source: '\/docs\/api'|source: '\/shortcuts'|source: '\/terms'|source: '\/privacy'/, a('next.config.mjs redirects none of them (it is unchanged)'))
}

// ---------------------------------------------------------------- 4. untouched: flag off = today
const UNTOUCHED = [
  'next.config.mjs', 'middleware.ts', 'app/layout.tsx', 'app/not-found.tsx', 'app/legal/terms/page.tsx', 'app/legal/terms/layout.tsx', 'app/legal/privacy/page.tsx', 'app/legal/privacy/layout.tsx', 'app/legal/layout.tsx',
  'app/auth/signin/page.tsx', 'app/auth/signup/page.tsx', 'lib/legal-links.ts', 'app/sitemap.ts', 'vercel.dev.json', 'package.json', 'pnpm-lock.yaml', 'components/layout/Footer.tsx',
]
function proveUntouched(at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  for (const rel of UNTOUCHED) eq(sha(read(rel)), sha(baseOf(rel)), a(`${rel} is the base commit's, byte for byte`))
  for (const rel of [TERMS, PRIVACY, HELPER]) {
    let found = true
    try { git('cat-file', '-e', `${BASE}:${rel}`) } catch { found = false }
    eq(found, false, a(`${rel} is new: the base commit has none`))
  }
}

// ---------------------------------------------------------------- 5. the route set
const routesOf = files => [...new Set(files
  .filter(file => /^app\/(.*\/)?(page|route)\.(tsx|ts|jsx|js)$/.test(file))
  .map(file => '/' + file.replace(/^app\//, '').replace(/(^|\/)(page|route)\.\w+$/, '').split('/').filter(segment => segment && !/^\(.*\)$/.test(segment)).join('/')))].sort()
let routeFilesFake = null
const headRouteFiles = () => (routeFilesFake ?? git('ls-files', '-co', '--exclude-standard', '--', 'app').split('\n').filter(Boolean))
function proveRoutes(at = '') {
  const a = message => (at ? `${at}: routes: ${message}` : `routes: ${message}`)
  const before = routesOf(git('ls-tree', '-r', '--name-only', BASE, '--', 'app').split('\n').filter(Boolean)), after = routesOf(headRouteFiles())
  deep(after.filter(route => !before.includes(route)), ['/privacy', '/terms'], a('the flags-off build\'s route list gains exactly /privacy and /terms (+2)'))
  deep(before.filter(route => !after.includes(route)), [], a('and loses none'))
  eq(after.length, before.length + 2, a(`${before.length} routes become ${before.length + 2}`))
  ok(before.includes('/docs/api') && after.includes('/docs/api') && after.includes('/shortcuts'), a('/docs/api and /shortcuts are still the dev pages'))
  return { before: before.length, after: after.length }
}

// ---------------------------------------------------------------- 6. .env.example
function proveEnv(text, at = '') {
  const a = message => (at ? `${at}: env: ${message}` : `env: ${message}`)
  eq(text.split(LEGAL_SHORT_LINKS_ENV_BLOCK).length - 1, 1, a('the block is there once, whole'))
  deep(text.split('\n').filter(line => line.includes(FLAG)).filter(line => /^[A-Z]/.test(line)), [`${FLAG}="false"`], a('one assignment, default "false"'))
  match(LEGAL_SHORT_LINKS_ENV_BLOCK, /^# STUDIO LEGAL SHORT LINKS \(FRONTEND-2; PROGRAM-1 decision D16 a, 25 Oct\)\. On for the exact value "true"; default off/, a('the comment says exact "true", default off'))
  match(LEGAL_SHORT_LINKS_ENV_BLOCK, /Set it to "true" on UAT and on production for parity with `uat`/, a('the comment says where to set it'))
  match(LEGAL_SHORT_LINKS_ENV_BLOCK, /Build-time value: change it on Vercel and redeploy/, a('and that it is a build-time value'))
  match(LEGAL_SHORT_LINKS_ENV_BLOCK, /the request's own query string is carried to the legal page/, a('and that the query string is carried'))
  nomatch(LEGAL_SHORT_LINKS_ENV_BLOCK, /UAT_MARKETING|P2_(?:LANDING|DOCS|ACCOUNT|POLISH)/, a('the block names no other flag (the UAT marketing proof refuses a later line that names its flag)'))
  match(LEGAL_SHORT_LINKS_ENV_BLOCK, /\/marketing\/v3\/slides\/\* and on \/marketing\/v3-uat\/slides\/\*/, a('and that the header is on both stills folders'))
  ok(LEGAL_SHORT_LINKS_ENV_BLOCK.endsWith(`${FLAG}="false"\n`), a('the block ends with the assignment'))
  eq(stripLaterEnvBlocks(ENV, text), stripLaterEnvBlocks(ENV, baseOf(ENV)), a('without the registered blocks the file is the base commit\'s .env.example'))
  ok(text.startsWith(baseOf(ENV).replace(/\n+$/, '\n')), a('and the base\'s lines are all still there, in order, ahead of this block'))
}

// ---------------------------------------------------------------- 7. the registry
function proveRegistry(registryText, at = '') {
  const a = message => (at ? `${at}: registry: ${message}` : `registry: ${message}`)
  const lines = registryText.split('\n').filter(line => line.includes("'./studio-legal-short-links-strip.mjs'"))
  eq(lines.length, 2, a('exactly two lines for this change: its files and its .env.example block (no strip: no existing app file gets a line)'))
  ok(lines.every(line => line.includes('// LATER-CHANGE: FRONTEND-2, legal short links and the marketing-slide cache header from uat, D16 a (NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS)')), a('each carries the LATER-CHANGE marker'))
  match(lines[0], /^ {2}\.\.\.\(await import\('\.\/studio-legal-short-links-strip\.mjs'\)\)\.LEGAL_SHORT_LINKS_SCOPE_FILES,/, a('line 1: the files'))
  match(lines[1], /^ {2}\(await import\('\.\/studio-legal-short-links-strip\.mjs'\)\)\.LEGAL_SHORT_LINKS_ENV_BLOCK,/, a('line 2: the block'))
  const files = registryText.indexOf('export const LATER_CHANGE_FILES'), blocks = registryText.indexOf('export const LATER_ENV_BLOCKS'), strips = registryText.indexOf('export const LATER_STRIPS')
  const at1 = registryText.indexOf(lines[0]), at2 = registryText.indexOf(lines[1])
  ok(files < at1 && at1 < blocks, a('the files line is in LATER_CHANGE_FILES'))
  ok(blocks < at2 && at2 < strips, a('the block line is in LATER_ENV_BLOCKS'))
  ok(!registryText.slice(strips).includes('studio-legal-short-links-strip'), a('nothing of this change is in LATER_STRIPS'))
  ok([...LEGAL_SHORT_LINKS_SCOPE_FILES].every(rel => LATER_CHANGE_FILES.has(rel)), a('the registry names every file of this change'))
  ok(LATER_ENV_BLOCKS.includes(LEGAL_SHORT_LINKS_ENV_BLOCK), a('the registry holds the block'))
  ok(!LATER_STRIPS.some(fn => /LegalShortLinks/.test(fn?.name ?? '')), a('and no strip'))
}

// ---------------------------------------------------------------- 8. scope: the COMMITTED diff only, and no secret
let committedFake = null
function committedInfo() {
  if (committedFake) return committedFake
  // this change's OWN commits: the non-merge commits in BASE..HEAD whose subject is "Legal short links: ...". Anything else in the range (a later merge onto the branch) is foreign. The working tree is never consulted.
  const own = new Set(), foreign = []
  for (const block of git('log', '--no-merges', '--name-only', '--format=%x01%s', `${BASE}..HEAD`).split('\x01').filter(Boolean)) {
    const [subject, ...names] = block.split('\n')
    if (LEGAL_SHORT_LINKS_COMMIT_SUBJECT.test(subject)) { for (const name of names) if (name) own.add(name) } else foreign.push(subject)
  }
  return { own: [...own], foreign, nameStatus: git('diff', '--name-status', `${BASE}..HEAD`), proofDiffs: Object.fromEntries(LEGAL_SHORT_LINKS_OLDER_PROOFS.map(rel => [rel, git('diff', '-U0', `${BASE}..HEAD`, '--', rel)])) }
}
function proveScope(at = '') {
  const a = message => (at ? `${at}: scope: ${message}` : `scope: ${message}`)
  ok([...LEGAL_SHORT_LINKS_SCOPE_FILES].every(rel => fs.existsSync(path.join(root, rel))), a('every file listed exists'))
  eq(LEGAL_SHORT_LINKS_SCOPE_FILES.size, LEGAL_SHORT_LINKS_NEW_FILES.length + LEGAL_SHORT_LINKS_OWN_EDITS.length, a('the list is the new files and the edits, with no overlap'))
  deep([...LEGAL_SHORT_LINKS_OWN_EDITS].sort(), ['.env.example', BULK_EDIT_PROOF, POLISH_F_PROOF, 'scripts/studio-later-changes.mjs', 'vercel.json'].sort(), a('the existing files this change edits: .env.example (its block), vercel.json (one entry), the registry (two lines) and one assertion each of FRONTEND-2\'s own bulk edit prompt text and Pass 3 polish F proofs'))
  const { own, foreign, nameStatus, proofDiffs } = committedInfo()
  deep(own.filter(rel => !LEGAL_SHORT_LINKS_SCOPE_FILES.has(rel)), [], a(`every file in this change's committed diff (${BASE.slice(0, 8)}..HEAD) is its own`))
  if (own.length) {
    deep([...LEGAL_SHORT_LINKS_SCOPE_FILES].filter(rel => !own.includes(rel)), [], a('and every file of this change is in the committed diff'))
    deep(own.filter(rel => /^scripts\/test-/.test(rel)).sort(), [BULK_EDIT_PROOF, POLISH_F_PROOF, THIS_TEST].sort(), a('the tests it adds or edits: its own, and FRONTEND-2\'s bulk edit prompt text and Pass 3 polish F proofs (one assertion each); no FRONTEND-1 test'))
    deep(own.filter(rel => /^(app|lib|components|hooks|contexts|types|prisma|public|styles|migrations|content)\//.test(rel)).sort(), [PRIVACY, TERMS, HELPER].sort(), a('the app files: the two pages and the helper (no existing app file)'))
    nomatch(own.join('\n'), /^(next\.config\.mjs|middleware\.ts|package\.json|pnpm-lock\.yaml|vercel\.dev\.json|app\/layout\.tsx|app\/not-found\.tsx|app\/legal\/)/m, a('next.config.mjs, middleware, package files, the root layout, the not-found page and the legal pages are not in it'))
  }
  if (own.length && foreign.length === 0) {
    // the two older proofs this change edits: one hunk each, one line out (the assertion that cannot see a later change), and only lines about that
    for (const [rel, expect] of Object.entries(OLDER_PROOF_EDITS)) {
      const lines = (proofDiffs[rel] ?? '').split('\n')
      eq(lines.filter(line => line.startsWith('@@')).length, 1, a(`${rel}: one hunk`))
      const out = lines.filter(line => line.startsWith('-') && !line.startsWith('---')), into = lines.filter(line => line.startsWith('+') && !line.startsWith('+++'))
      eq(out.length, 1, a(`${rel}: one line removed`))
      match(out[0], expect.removed, a(`${rel}: and it is the assertion this change must get past`))
      ok(baseOf(rel).split('\n').includes(out[0].slice(1)), a(`${rel}: and it is a line of the base commit's file`))
      eq(into.length, expect.added, a(`${rel}: ${expect.added} lines added`))
      ok(into.every(line => expect.about.test(line)), a(`${rel}: and each is about ${expect.topic}`))
    }
    const entries = nameStatus.split('\n').filter(Boolean).map(line => line.split('\t'))
    deep(entries.map(entry => entry[entry.length - 1]).sort(), [...LEGAL_SHORT_LINKS_SCOPE_FILES].sort(), a('every commit in the range is this change\'s, so the whole BASE..HEAD diff is exactly the list: no other file changed'))
    deep(entries.filter(entry => entry[0] !== 'A').map(entry => `${entry[0]}\t${entry[1]}`).sort(), LEGAL_SHORT_LINKS_OWN_EDITS.map(rel => `M\t${rel}`).sort(), a('and only the three edits modify an existing file; everything else is added'))
  }
}
function proveSecretScan(at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const added = [TERMS, PRIVACY, HELPER, STRIP_MODULE, THIS_TEST, VERCEL].map(read).join('\n')
  nomatch(added, /\b(api[_-]?key|secret|token|passw(or)?d)\w*\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/i, a('no credential-shaped literal in the added files'))
  nomatch(added, /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@'"`]+:[^@\s'"`]+@/i, a('no user:pass@ in an added URL'))
}

// ---------------------------------------------------------------- run everything
async function proveAll(at = '', ctx = {}) {
  const pages = await provePages(at, ctx)
  proveHeader(at, ctx)
  proveNotPorted(at, ctx)
  proveUntouched(at)
  const routes = proveRoutes(at)
  proveEnv(read(ENV), at)
  proveRegistry(read(REGISTRY), at)
  proveScope(at)
  proveSecretScan(at)
  return { pages, routes }
}
ok(git('merge-base', '--is-ancestor', BASE, 'HEAD') === '', 'the base commit is an ancestor of HEAD')
const { pages, routes } = await proveAll()
console.log(`flag off: both pages are the not-found page (404) in ${pages.states} runs (9 spellings x 2 pages, each with and without a query string, and 3 other flags set alone x 2; sha256 ${pages.sha.slice(0, 16)}); flag "true": a 307 to /legal/terms and /legal/privacy`)
console.log(`routes: ${routes.before} -> ${routes.after} (+/terms, +/privacy); uat's next.config.mjs ${UAT ? `read at ${UAT_COMMIT.slice(0, 8)} via git show` : `NOT in this clone: only the literals were compared`}`)
console.log(`PASS pages, header, not ported, untouched, routes, env, registry, scope: ${checks} checks`)

// =========================================================== 9. mutants
const killed = [], survived = []
async function mutant(name, edits, { ctx = {}, committed = null, routeFiles = null } = {}) {
  const before = overrides
  committedFake = committed; routeFilesFake = routeFiles
  try {
    overrides = { ...before }
    for (const [rel, from, to, mode] of edits) {
      const source = read(rel), n = source.split(from).length - 1
      assert.ok(mode ? n >= 1 : n === 1, `mutant "${name}" no longer applies to ${rel}: ${from.slice(0, 70)}`)
      if (mode === 'last') { const at = source.lastIndexOf(from); overrides[rel] = source.slice(0, at) + to + source.slice(at + from.length) } else overrides[rel] = mode === 'all' ? source.split(from).join(to) : source.replace(from, () => to)
    }
    await proveAll(name, ctx)
  } catch (error) {
    if (/no longer applies/.test(String(error.message))) throw error
    killed.push(name); if (process.env.LEGAL_SHORT_LINKS_VERBOSE) console.log(`  killed: ${name}\n    by: ${String(error.message).split('\n')[0].slice(0, 170)}`); return
  } finally { overrides = before; committedFake = null; routeFilesFake = null }
  survived.push(name)
}
const page = (rel, from, to, mode) => [rel, from, to, mode]
const NOTFOUND_LINE = '  if (target === null) notFound()'
// the pages
await mutant('terms: flag off redirects anyway', [page(TERMS, NOTFOUND_LINE, "  if (target === null) redirect('/legal/terms')")])
await mutant('privacy: flag off redirects anyway', [page(PRIVACY, NOTFOUND_LINE, "  if (target === null) redirect('/legal/privacy')")])
await mutant('terms: flag off is a 200 (returns nothing)', [page(TERMS, NOTFOUND_LINE, '  if (target === null) return null')])
await mutant('privacy: flag off is a 200 (returns nothing)', [page(PRIVACY, NOTFOUND_LINE, '  if (target === null) return null')])
await mutant('terms: the redirect is permanent (308)', [page(TERMS, "import { notFound, redirect } from 'next/navigation'", "import { notFound, permanentRedirect as redirect } from 'next/navigation'")])
await mutant('privacy: the redirect is permanent (308)', [page(PRIVACY, "import { notFound, redirect } from 'next/navigation'", "import { notFound, permanentRedirect as redirect } from 'next/navigation'")])
await mutant('terms: goes to /legal/privacy', [page(HELPER, "terms: { source: '/terms', destination: '/legal/terms' }", "terms: { source: '/terms', destination: '/legal/privacy' }")])
await mutant('privacy: goes to /legal/terms', [page(HELPER, "privacy: { source: '/privacy', destination: '/legal/privacy' }", "privacy: { source: '/privacy', destination: '/legal/terms' }")])
await mutant('terms: destination has a trailing slash', [page(HELPER, "terms: { source: '/terms', destination: '/legal/terms' }", "terms: { source: '/terms', destination: '/legal/terms/' }")])
await mutant('privacy: destination has a hash', [page(HELPER, "privacy: { source: '/privacy', destination: '/legal/privacy' }", "privacy: { source: '/privacy', destination: '/legal/privacy#top' }")])
await mutant('terms: the page asks for the privacy target', [page(TERMS, "studioLegalShortLinkTarget('terms'", "studioLegalShortLinkTarget('privacy'")])
await mutant('privacy: the page asks for the terms target', [page(PRIVACY, "studioLegalShortLinkTarget('privacy'", "studioLegalShortLinkTarget('terms'")])
await mutant('helper: anything but "false" is on', [page(HELPER, "return value === 'true'", "return value !== 'false'")])
await mutant('helper: any non-empty value is on', [page(HELPER, "return value === 'true'", 'return Boolean(value)')])
await mutant('helper: case-insensitive', [page(HELPER, "return value === 'true'", "return value?.toLowerCase() === 'true'")])
await mutant('helper: trims the value', [page(HELPER, "return value === 'true'", "return value?.trim() === 'true'")])
await mutant('helper: "1" is on', [page(HELPER, "return value === 'true'", "return value === 'true' || value === '1'")])
await mutant('helper: default on', [page(HELPER, "return value === 'true'", "return value === undefined || value === 'true'")])
await mutant('helper: always on', [page(HELPER, "return value === 'true'", 'return true')])
await mutant('helper: reads the environment itself', [page(HELPER, "return value === 'true'", "return (value ?? process.env.NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS) === 'true'")])
await mutant('helper: imports something', [page(HELPER, '/** Exact "true" turns it on.', "import { x } from 'y'\n/** Exact \"true\" turns it on.")])
await mutant('helper: the null case is on', [page(HELPER, '(searchParams)}` : null', "(searchParams)}` : '/legal/terms'")])
await mutant('terms page: reads the sign-in links flag instead', [page(TERMS, 'process.env.NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS,', 'process.env.NEXT_PUBLIC_LEGAL_LINKS_FIXED_ENABLED,')])
await mutant('privacy page: reads the environment through a variable (not inlined at build)', [page(PRIVACY, 'process.env.NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS, await searchParams)', "(process.env as Record<string, string | undefined>)['NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS'], await searchParams)")])
await mutant('terms page: becomes a client component', [page(TERMS, "import { notFound, redirect }", "'use client'\nimport { notFound, redirect }")])
await mutant('privacy page: loses force-dynamic', [page(PRIVACY, "export const dynamic = 'force-dynamic'\n\n", '')])
await mutant('terms page: takes params', [page(TERMS, '{ searchParams }: { searchParams: Promise<StudioLegalShortLinkSearchParams> }', '{ searchParams, params }: { searchParams: Promise<StudioLegalShortLinkSearchParams>; params: Promise<{ x: string }> }')])
await mutant('terms page: reads a second variable', [page(TERMS, "  if (target === null) notFound()", "  if (target === null || process.env.NODE_ENV === 'x') notFound()")])
await mutant('privacy page: checks the session', [page(PRIVACY, "import { notFound, redirect } from 'next/navigation'", "import { notFound, redirect } from 'next/navigation'\nimport { getServerSession } from 'next-auth'")])
// the query string
const HQ = "const text = query.toString()\n  return text === '' ? '' : `?${text}`"
await mutant('query: terms ignores the request\'s parameters', [page(TERMS, ', await searchParams)', ')')])
await mutant('query: privacy ignores the request\'s parameters', [page(PRIVACY, ', await searchParams)', ')')])
await mutant('query: terms passes the promise un-awaited', [page(TERMS, ', await searchParams)', ', searchParams as unknown as StudioLegalShortLinkSearchParams)')])
await mutant('query: privacy reads a different prop', [page(PRIVACY, '({ searchParams }: { searchParams: Promise<', '({ params }: { params: Promise<')])
await mutant('query: the page is not async', [page(TERMS, 'export default async function', 'export default function')])
await mutant('query: raw concatenation (no encoding)', [page(HELPER, HQ, "const text = Object.entries(searchParams ?? {}).map(([name, value]) => `${name}=${value}`).join('&')\n  return text === '' ? '' : `?${text}`")])
await mutant('query: encodeURI instead of URLSearchParams', [page(HELPER, HQ, "const text = Object.entries(searchParams ?? {}).map(([name, value]) => encodeURI(`${name}=${value}`)).join('&')\n  return text === '' ? '' : `?${text}`")])
await mutant('query: a repeated parameter keeps only its first value', [page(HELPER, 'for (const item of value) if (typeof item === \'string\') query.append(name, item)', 'if (typeof value[0] === \'string\') query.append(name, value[0])')])
await mutant('query: a repeated parameter is dropped', [page(HELPER, '    else if (Array.isArray(value)) for (const item of value) if (typeof item === \'string\') query.append(name, item)\n', '')])
await mutant('query: a non-string value is echoed', [page(HELPER, "if (typeof value === 'string') query.append(name, value)", "if (typeof value === 'string' || typeof value === 'number') query.append(name, String(value))")])
await mutant('query: an extra parameter is added', [page(HELPER, HQ, "query.append('from', 'short')\n  const text = query.toString()\n  return `?${text}`")])
await mutant('query: inherited parameters are echoed (for in)', [page(HELPER, 'for (const [name, value] of Object.entries(searchParams)) {', 'for (const name in searchParams) {\n    const value = searchParams[name]')])
await mutant('query: a bare question mark when there is no query', [page(HELPER, "return text === '' ? '' : `?${text}`", 'return `?${text}`')])
await mutant('query: the query is put into the path', [page(HELPER, '`${STUDIO_LEGAL_SHORT_LINKS[page].destination}${studioLegalShortLinkQuery(searchParams)}`', '`${STUDIO_LEGAL_SHORT_LINKS[page].destination}${studioLegalShortLinkQuery(searchParams).replace(\'?\', \'/\')}`')])
await mutant('query: a fragment is added', [page(HELPER, "return text === '' ? '' : `?${text}`", "return text === '' ? '' : `?${text}#top`")])
await mutant('query: the flag off with a query still redirects', [page(HELPER, 'return studioLegalShortLinksOn(value) ? `', 'return studioLegalShortLinksOn(value) || searchParams ? `')])
await mutant('query: the destination comes from the request', [page(HELPER, '`${STUDIO_LEGAL_SHORT_LINKS[page].destination}${studioLegalShortLinkQuery(searchParams)}`', '`${(searchParams as any)?.next ?? STUDIO_LEGAL_SHORT_LINKS[page].destination}${studioLegalShortLinkQuery(searchParams)}`')])
await mutant('query: the helper reads the request itself', [page(HELPER, 'const query = new URLSearchParams()', "const query = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)")])
await mutant('uat parity: uat redirects /terms elsewhere', [], { ctx: { uat: { redirects: [{ source: '/terms', destination: '/legal/privacy', permanent: false }, UAT_LITERAL.redirects[1]], headers: [UAT_LITERAL.header] } } })
await mutant('uat parity: uat\'s redirect is permanent', [], { ctx: { uat: { redirects: UAT_LITERAL.redirects.map(r => ({ ...r, permanent: true })), headers: [UAT_LITERAL.header] } } })
// the header
const V = read(VERCEL)
// the stills uat sets it on (the first occurrence in vercel.json) and the UAT marketing copy (the last): each value is mutated on its own
for (const [which, mode] of [['v3 entry', 'first'], ['UAT copy', 'last']]) {
  await mutant(`header: ${which}: one hour, not one day`, [[VERCEL, 'max-age=86400', 'max-age=3600', mode]])
  await mutant(`header: ${which}: a day of stale-while-revalidate, not a week`, [[VERCEL, 'stale-while-revalidate=604800', 'stale-while-revalidate=86400', mode]])
  await mutant(`header: ${which}: no stale-while-revalidate`, [[VERCEL, ', stale-while-revalidate=604800', '', mode]])
  await mutant(`header: ${which}: private, not public`, [[VERCEL, '"public, max-age=86400', '"private, max-age=86400', mode]])
  await mutant(`header: ${which}: immutable`, [[VERCEL, 'stale-while-revalidate=604800"', 'stale-while-revalidate=604800, immutable"', mode]])
  await mutant(`header: ${which}: the key is lower-case`, [[VERCEL, '"key":\n            "Cache-Control"', '"key":\n            "cache-control"', mode]])
  await mutant(`header: ${which}: a second header on the entry`, [[VERCEL, '"value": "public, max-age=86400, stale-while-revalidate=604800"\n        }', '"value": "public, max-age=86400, stale-while-revalidate=604800"\n        },\n        { "key": "X-Extra", "value": "1" }', mode]])
}
await mutant('header: the source is a prefix pattern', [page(VERCEL, '"/marketing/v3/slides/:path*"', '"/marketing/v3/slides/(.*)"')])
await mutant('header: the source covers all of /marketing', [page(VERCEL, '"/marketing/v3/slides/:path*"', '"/marketing/:path*"')])
await mutant('header: the source is the UAT marketing copy', [page(VERCEL, '"/marketing/v3/slides/:path*"', '"/marketing/v3-uat/slides/:path*"')])
await mutant('header: the /api CORS entry is changed', [page(VERCEL, '"value": "*"', '"value": "https://deckster.xyz"')])
await mutant('header: the git block (dev deploys off) is dropped', [page(VERCEL, '  "git": {\n    "deploymentEnabled": {\n      "studio-v4-dev": false\n    }\n  }', '  "git": {}')])
await mutant('header: a region is changed', [page(VERCEL, '"iad1"', '"sfo1"')])
await mutant('header: vercel.json names the flag', [page(VERCEL, '"framework": "nextjs",', '"framework": "nextjs", "env": { "NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS": "true" },')])
await mutant('header: vercel.json is not JSON', [page(VERCEL, '"framework": "nextjs",', '"framework": "nextjs"')])
await mutant('header: a third entry (a second UAT copy)', [page(VERCEL, '    {\n      "source": "/marketing/v3-uat/slides/:path*"', `    ${JSON.stringify({ source: HEADER_SOURCE_UAT_COPY, headers: [headerOf('Cache-Control', HEADER_VALUE)] })},\n    {\n      "source": "/marketing/v3-uat/slides/:path*"`)])
await mutant('header: the UAT copy is gone', [page(VERCEL, V.slice(V.indexOf('    },\n    {\n      "source": "/marketing/v3-uat/slides'), V.indexOf('  ],\n  "git"')), '    }\n')])
await mutant('header: both new entries are gone', [page(VERCEL, V.slice(V.indexOf('    },\n    {\n      "source": "/marketing/v3/slides'), V.indexOf('  ],\n  "git"')), '    }\n')])
await mutant('header: the v3 entry is gone', [page(VERCEL, V.slice(V.indexOf('    },\n    {\n      "source": "/marketing/v3/slides'), V.indexOf('    },\n    {\n      "source": "/marketing/v3-uat/slides')), '')])
await mutant('header: the UAT copy covers the whole v3-uat folder', [page(VERCEL, '"/marketing/v3-uat/slides/:path*"', '"/marketing/v3-uat/:path*"')])
await mutant('header: the UAT copy names the wrong folder', [page(VERCEL, '"/marketing/v3-uat/slides/:path*"', '"/marketing/v3-uat/slide/:path*"')])
await mutant('header: the UAT copy is a prefix pattern', [page(VERCEL, '"/marketing/v3-uat/slides/:path*"', '"/marketing/v3-uat/slides/(.*)"')])
await mutant('header: a third marketing folder is covered', [page(VERCEL, '  ],\n  "git"', `,\n    ${JSON.stringify({ source: '/marketing/v3/:path*', headers: [headerOf('Cache-Control', HEADER_VALUE)] })}\n  ],\n  "git"`)])
{ // the entries in another order (JSON round trip; the text differs, the data is what is read)
  const J = JSON.parse(V)
  const swap = order => JSON.stringify({ ...J, headers: order.map(i => J.headers[i]) }, null, 2) + '\n'
  await mutant('header: the UAT copy comes before the v3 entry', [page(VERCEL, V, swap([0, 2, 1]))])
  await mutant('header: the new entries come before the /api entry', [page(VERCEL, V, swap([1, 2, 0]))])
}
await mutant('header: uat\'s header value differs (the proof reads uat)', [], { ctx: { uat: UAT_MUTANT ?? { redirects: UAT_LITERAL.redirects, headers: [{ source: HEADER_SOURCE, headers: [headerOf('Cache-Control', 'public, max-age=3600, stale-while-revalidate=604800')] }] } } })
// not ported
await mutant('not ported: vercel.json redirects /shortcuts', [page(VERCEL, '"source": "/slides",', '"source": "/shortcuts",')])
await mutant('not ported: vercel.json redirects /docs/api', [page(VERCEL, '"source": "/slides",\n      "destination": "/dashboard"', '"source": "/docs/api",\n      "destination": "/docs"')])
await mutant('not ported: next.config.mjs takes the short links', [page('next.config.mjs', "{ source: '/agents', destination: '/experts', permanent: false },", "{ source: '/agents', destination: '/experts', permanent: false },\n      { source: '/terms', destination: '/legal/terms', permanent: false },")])
await mutant('not ported: next.config.mjs takes /shortcuts', [page('next.config.mjs', "{ source: '/agents', destination: '/experts', permanent: false },", "{ source: '/agents', destination: '/experts', permanent: false },\n      { source: '/shortcuts', destination: '/learn', permanent: false },")])
await mutant('not ported: the helper names /shortcuts', [page(HELPER, '// FRONTEND-2 (PROGRAM-1', '// /shortcuts -> /learn\n// FRONTEND-2 (PROGRAM-1')])
// untouched
await mutant('untouched: next.config.mjs gains the header', [page('next.config.mjs', "      {\n        source: '/:path*',", `      {\n        source: '/marketing/v3/slides/:path*',\n        headers: [${JSON.stringify(headerOf('Cache-Control', HEADER_VALUE))}],\n      },\n      {\n        source: '/:path*',`)])
await mutant('untouched: middleware.ts matches the short links', [page('middleware.ts', '    "/redeem",\n    "/admin/:path*",', '    "/redeem",\n    "/terms",\n    "/admin/:path*",')])
await mutant('untouched: the not-found page changes', [page('app/not-found.tsx', 'export default async function NotFound() {', 'export default async function NotFound() {\n  // changed')])
await mutant('untouched: a legal page changes', [page('app/legal/terms/page.tsx', 'export', '// changed\nexport', 'all')])
await mutant('untouched: sign-in links move', [page('app/auth/signin/page.tsx', "legalHref('terms')", "'/legal/terms'")])
await mutant('untouched: the legal-links helper changes', [page('lib/legal-links.ts', "off: '/terms'", "off: '/legal/terms'")])
await mutant('untouched: package.json changes', [page('package.json', '"scripts": {', '"scripts": {\n    "test:legal-short-links": "node scripts/test-studio-legal-short-links.mjs",')])
// routes
const headFiles = git('ls-files', '-co', '--exclude-standard', '--', 'app').split('\n').filter(Boolean)
await mutant('routes: a third route (/cookies)', [], { routeFiles: [...headFiles, 'app/cookies/page.tsx'] })
await mutant('routes: a route inside a group counts too (/privacy-policy)', [], { routeFiles: [...headFiles, 'app/(app)/privacy-policy/page.tsx'] })
await mutant('routes: an API route counts too (/api/legal)', [], { routeFiles: [...headFiles, 'app/api/legal/route.ts'] })
await mutant('routes: /terms is not a route', [], { routeFiles: headFiles.filter(file => file !== TERMS) })
await mutant('routes: an existing route is gone (/legal/terms)', [], { routeFiles: headFiles.filter(file => file !== 'app/legal/terms/page.tsx') })
await mutant('routes: /terms/[x] instead of /terms', [], { routeFiles: headFiles.map(file => (file === TERMS ? 'app/terms/[x]/page.tsx' : file)) })
// env
await mutant('env: the default is "true"', [page(ENV, `${FLAG}="false"`, `${FLAG}="true"`)])
await mutant('env: the block is gone', [page(ENV, LEGAL_SHORT_LINKS_ENV_BLOCK, '')])
await mutant('env: the block is there twice', [page(ENV, LEGAL_SHORT_LINKS_ENV_BLOCK, `${LEGAL_SHORT_LINKS_ENV_BLOCK}\n${LEGAL_SHORT_LINKS_ENV_BLOCK}`)])
await mutant('env: a base line is changed', [page(ENV, 'NEXT_PUBLIC_LEGAL_LINKS_FIXED_ENABLED="false"', 'NEXT_PUBLIC_LEGAL_LINKS_FIXED_ENABLED="true"')])
await mutant('env: another flag is added', [page(ENV, LEGAL_SHORT_LINKS_ENV_BLOCK, `${LEGAL_SHORT_LINKS_ENV_BLOCK}NEXT_PUBLIC_STUDIO_SOMETHING_ELSE="false"\n`)])
await mutant('env: the comment names the UAT marketing flag', [page(ENV, 'the stills the UAT marketing copy serves', 'the stills NEXT_PUBLIC_STUDIO_UAT_MARKETING serves')])
await mutant('env: the comment says the default is on', [page(ENV, 'default off, and then /terms and /privacy are the not-found page', 'default on, and then /terms and /privacy are the not-found page')])
// registry
await mutant('registry: the files line is gone', [page(REGISTRY, "  ...(await import('./studio-legal-short-links-strip.mjs')).LEGAL_SHORT_LINKS_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, legal short links and the marketing-slide cache header from uat, D16 a (NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS)\n", '')])
await mutant('registry: the block line is gone', [page(REGISTRY, "  (await import('./studio-legal-short-links-strip.mjs')).LEGAL_SHORT_LINKS_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, legal short links and the marketing-slide cache header from uat, D16 a (NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS)\n", '')])
await mutant('registry: a marker is missing', [page(REGISTRY, "LEGAL_SHORT_LINKS_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, legal short links and the marketing-slide cache header from uat, D16 a (NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS)", 'LEGAL_SHORT_LINKS_ENV_BLOCK, // legal short links')])
await mutant('registry: the block line is in LATER_STRIPS, not LATER_ENV_BLOCKS', [page(REGISTRY, "  (await import('./studio-legal-short-links-strip.mjs')).LEGAL_SHORT_LINKS_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, legal short links and the marketing-slide cache header from uat, D16 a (NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS)\n", ''), page(REGISTRY, "export const LATER_STRIPS = [\n", "export const LATER_STRIPS = [\n  (await import('./studio-legal-short-links-strip.mjs')).LEGAL_SHORT_LINKS_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, legal short links and the marketing-slide cache header from uat, D16 a (NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS)\n")])
// scope: the committed diff
const OWN = [...LEGAL_SHORT_LINKS_SCOPE_FILES]
const status = (changes) => changes.map(([s, rel]) => `${s}\t${rel}`).join('\n') + '\n'
const GOOD_PROOF_DIFFS = Object.fromEntries(LEGAL_SHORT_LINKS_OLDER_PROOFS.map(rel => [rel, git('diff', '-U0', BASE, git('log', '-1', '--format=%H', '--extended-regexp', '--grep=^Legal short links:', 'HEAD').trim(), '--', rel)])) // LATER-CHANGES: registry read (PHONE-SHELL-NAV): the base against this change's own last commit (a later change may teach those proofs too), a faithful stand-in for the committed diff of those files
const GOOD_STATUS = [...LEGAL_SHORT_LINKS_NEW_FILES.map(rel => ['A', rel]), ...LEGAL_SHORT_LINKS_OWN_EDITS.map(rel => ['M', rel])]
{ // control: a faithful fake of the committed diff passes (so the scope mutants below are killed by their change, not by the fake)
  committedFake = { own: OWN, foreign: [], nameStatus: status(GOOD_STATUS), proofDiffs: GOOD_PROOF_DIFFS }
  try { proveScope('control') } finally { committedFake = null }
}
await mutant('scope: next.config.mjs is in the commit', [], { committed: { proofDiffs: GOOD_PROOF_DIFFS, own: [...OWN, 'next.config.mjs'], foreign: [], nameStatus: status([...GOOD_STATUS, ['M', 'next.config.mjs']]) } })
await mutant('scope: an older test is edited', [], { committed: { proofDiffs: GOOD_PROOF_DIFFS, own: [...OWN, 'scripts/test-studio-p2-docs.mjs'], foreign: [], nameStatus: status([...GOOD_STATUS, ['M', 'scripts/test-studio-p2-docs.mjs']]) } })
await mutant('scope: a FRONTEND-1 test is edited', [], { committed: { proofDiffs: GOOD_PROOF_DIFFS, own: [...OWN, 'scripts/test-studio-launch-wording.mjs'], foreign: [], nameStatus: status([...GOOD_STATUS, ['M', 'scripts/test-studio-launch-wording.mjs']]) } })
await mutant('scope: an existing app file is edited (the root layout)', [], { committed: { proofDiffs: GOOD_PROOF_DIFFS, own: [...OWN, 'app/layout.tsx'], foreign: [], nameStatus: status([...GOOD_STATUS, ['M', 'app/layout.tsx']]) } })
await mutant('scope: a new /shortcuts page is in the commit', [], { committed: { proofDiffs: GOOD_PROOF_DIFFS, own: [...OWN, 'app/shortcuts/page.tsx'], foreign: [], nameStatus: status([...GOOD_STATUS, ['A', 'app/shortcuts/page.tsx']]) } })
await mutant('scope: a file of the change is missing from the commit (vercel.json)', [], { committed: { proofDiffs: GOOD_PROOF_DIFFS, own: OWN.filter(rel => rel !== VERCEL), foreign: [], nameStatus: status(GOOD_STATUS.filter(([, rel]) => rel !== VERCEL)) } })
await mutant('scope: a stray file is in the range (a foreign path, same subject)', [], { committed: { proofDiffs: GOOD_PROOF_DIFFS, own: [...OWN, 'docs/notes.md'], foreign: [], nameStatus: status([...GOOD_STATUS, ['A', 'docs/notes.md']]) } })
await mutant('scope: the range has a file the change\'s subject does not own', [], { committed: { proofDiffs: GOOD_PROOF_DIFFS, own: OWN, foreign: [], nameStatus: status([...GOOD_STATUS, ['M', 'middleware.ts']]) } })
const fakeScope = (rel, diff) => ({ committed: { proofDiffs: { ...GOOD_PROOF_DIFFS, [rel]: diff }, own: OWN, foreign: [], nameStatus: status(GOOD_STATUS) } })
for (const rel of LEGAL_SHORT_LINKS_OLDER_PROOFS) {
  const good = GOOD_PROOF_DIFFS[rel]
  await mutant(`scope: ${rel} loses a second line`, [], fakeScope(rel, good.replace(/\n\+/, '\n-removed line\n+')))
  await mutant(`scope: ${rel} has a second hunk`, [], fakeScope(rel, `${good}\n@@ -300,0 +301 @@\n+  // another edit about later registered changes`))
  await mutant(`scope: ${rel} removes a different line`, [], fakeScope(rel, good.replace(/^-.*$/m, '-  ok(true)')))
  await mutant(`scope: ${rel} gains an unrelated line`, [], fakeScope(rel, `${good}\n+  ok(true)`))
  await mutant(`scope: ${rel} is not edited at all`, [], fakeScope(rel, ''))
}
await mutant('scope: a new page is modified, not added', [], { committed: { proofDiffs: GOOD_PROOF_DIFFS, own: OWN, foreign: [], nameStatus: status(GOOD_STATUS.map(([s, rel]) => (rel === TERMS ? ['M', rel] : [s, rel]))) } })
await mutant('scope: vercel.json is added, not modified (the file was replaced)', [], { committed: { proofDiffs: GOOD_PROOF_DIFFS, own: OWN, foreign: [], nameStatus: status(GOOD_STATUS.map(([s, rel]) => (rel === VERCEL ? ['A', rel] : [s, rel]))) } })
// secret scan
await mutant('secret scan: a credential-shaped literal', [page(STRIP_MODULE, "export const LEGAL_SHORT_LINKS_FLAG = 'NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS'", `export const LEGAL_SHORT_LINKS_FLAG = 'NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS'\nconst ${['api', 'Key'].join('')} = '${['AKIA', 'ABCDEFGH', '12345678'].join('')}'`)])
await mutant('secret scan: a user:pass@ URL', [page(HELPER, '// FRONTEND-2 (PROGRAM-1', `// ${['https', '://', 'user', ':', 'hunter22', '@', 'example.com'].join('')}\n// FRONTEND-2 (PROGRAM-1`)])

console.log(`mutants: ${killed.length}/${killed.length + survived.length} killed`)
if (survived.length) { console.log('SURVIVED:\n  ' + survived.join('\n  ')); process.exit(1) }
console.log(`test-studio-legal-short-links: ${checks} checks passed, ${killed.length}/${killed.length} mutants killed; no network.`)
