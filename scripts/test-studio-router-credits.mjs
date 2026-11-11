// Targeted offline financial/authentication tests. Real TS sources in isolated VMs; no network or DB.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import React from 'react'
import * as jsx from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { ROUTER_BILLING_EDITS, ROUTER_BILLING_ENV_BLOCK, ROUTER_BILLING_SCOPE_FILES, stripRouterBilling } from './studio-router-billing-strip.mjs'
import { LATER_CHANGE_FILES, LATER_ENV_BLOCKS, LATER_STRIPS } from './studio-later-changes.mjs'

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const read = name => fs.readFileSync(path.join(root, name), 'utf8')
const plain = x => JSON.parse(JSON.stringify(x))
function load(name, imports = {}, env = {}, extra = {}) {
  const out = { exports: {} }
  const code = ts.transpileModule(read(name), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, reportDiagnostics: true })
  assert.equal((code.diagnostics || []).filter(x => x.category === ts.DiagnosticCategory.Error).length, 0)
  vm.runInNewContext(code.outputText, { exports: out.exports, module: out, require: id => {
    if (!(id in imports)) throw new Error(`Unexpected import ${id}`)
    return imports[id]
  }, process: { env }, URL, Response, Request, AbortController, TextDecoder, setTimeout, clearTimeout, console: { error() { throw new Error('Unexpected log') }, log() {} }, ...extra }, { filename: name })
  return out.exports
}
const PUBLIC = 'lib/billing/router-credit-view.ts', SERVER = 'lib/billing/router-credits.ts', COMPONENT = 'components/billing/studio-router-usage.tsx', ROUTE = 'app/api/account/usage/route.ts'
const viewLib = load(PUBLIC)
const raw = () => ({
  user_id: 'qa:billing', as_of: '2026-11-02T12:00:00Z', plan: 'premium', plan_source: 'fresh',
  period: { key: 'opaque', start: '2026-10-18T00:00:00Z', end: '2026-11-18T00:00:00Z' },
  credits: { plan_granted: '10000.000000', plan_used: '9000.500000', plan_left: '999.500000', topup_balance: '1000.400000', remaining: '1999.900000', overdraft: '0.000000' },
  images: { used: 120, cap: 300 }, provider_cost_usd: 'PRIVATE', tokens: 'PRIVATE', model: 'PRIVATE', mode: 'PRIVATE',
})
const month = () => ({ user_id: 'qa:billing', as_of: '2026-11-02T12:00:00Z', month: { start: '2026-11-01T00:00:00Z', end: '2026-12-01T00:00:00Z' }, credits_used: '0.700000', daily: [{ date: '2026-11-01', credits_used: '0.400000' }, { date: '2026-11-02', credits_used: '0.300000' }] })
const env = { STUDIO_ROUTER_CREDITS_READ: 'true', MODEL_ROUTER_URL: 'https://router.example/v1/', ROUTER_CREDITS_READ_API_KEY: 'synthetic-test-read-key' }
const server = (environment = env, extra = {}) => load(SERVER, { 'server-only': {}, './router-credit-view': viewLib }, environment, extra)
const json = (body, status = 200) => Response.json(body, { status })
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
let checks = 0
async function check(name, run) { await run(); checks++; console.log(`PASS ${name}`) }

await check('defaults OFF: no reads even with credentials; exact enable spelling', async () => {
  for (const flag of [undefined, 'false', 'TRUE', '1', ' true', 'true ']) {
    const lib = server({ ...env, STUDIO_ROUTER_CREDITS_READ: flag })
    assert.deepEqual(plain(await lib.getRouterCreditsForSession('qa:billing', { fetcher: () => { throw new Error('Must not fetch') } })), { available: false })
    assert.equal(load(PUBLIC, {}, { NEXT_PUBLIC_STUDIO_ROUTER_USAGE: flag }).STUDIO_ROUTER_USAGE_ENABLED, false)
  }
})
await check('fixed-point display boundaries, large safe decimals, no false below-one exhaustion', () => {
  const display = viewLib.creditDisplay
  assert.equal(display('0.000000'), '0 credits')
  assert.equal(display('0.000001'), 'under 1 credit')
  assert.equal(display('0.999999'), 'under 1 credit')
  assert.equal(display('1.999999'), '1 credit')
  assert.equal(display('999999999999999.999999'), '999,999,999,999,999 credits')
  for (const bad of ['', 'NaN', 'Infinity', '-1.000000', '1.0', '1.000000\n', 0]) assert.equal(display(bad), 'Unavailable')
  assert.equal(viewLib.billingPlanLabel('premium'), 'Max')
})
await check('account-bound projection redacts internal metadata and validates real facts', () => {
  const parse = server().parseRouterCreditView
  const view = parse(raw(), 'qa:billing')
  assert.equal(view.plan, 'premium'); assert.equal(view.images.cap, 300)
  assert.equal(JSON.stringify(view).includes('PRIVATE'), false)
  assert.equal('user_id' in view, false)
  assert.equal(parse(raw(), 'other'), null)
  for (const mutate of [x => { x.credits.plan_left = '999.400000' }, x => { x.plan = 'PRIVATE' }, x => { x.as_of = '2026-02-30T00:00:00Z' }, x => { x.images.cap = -1 }, x => { x.images.used = 0.2 }, x => { x.period.end = x.period.start }, x => { x.plan_source = 'failsafe' }, x => { x.credits.topup_balance = 123 }, x => { delete x.credits.plan_used }]) {
    const x = raw(); mutate(x); assert.equal(parse(x, 'qa:billing'), null)
  }
  const unlimited = raw(); unlimited.images.cap = null
  assert.equal(parse(unlimited, 'qa:billing').images.cap, null)
  const exhausted = raw(); exhausted.credits.plan_used = '12000.000000'; exhausted.credits.plan_left = '0.000000'
  assert.equal(parse(exhausted, 'qa:billing').credits.planLeft, '0.000000')
})
await check('server reads scoped balance and independent UTC chart, exact path/auth/no-store/no redirects', async () => {
  const calls = []
  const view = await server().getRouterCreditsForSession('qa:billing', { fetcher: async (url, options) => { calls.push({ url, options }); return json(calls.length === 1 ? raw() : month()) } })
  assert.equal(view.available, true); assert.equal(view.daily.used, '0.700000')
  assert.equal(view.period.start, '2026-10-18T00:00:00Z'); assert.equal(view.daily.month.start, '2026-11-01T00:00:00Z')
  assert.equal(calls[0].url, 'https://router.example/v1/credits/qa%3Abilling')
  assert.equal(calls[1].url, 'https://router.example/v1/usage/user/qa%3Abilling/credits')
  for (const c of calls) { assert.equal(c.options.headers.Authorization, `Bearer ${env.ROUTER_CREDITS_READ_API_KEY}`); assert.equal(c.options.cache, 'no-store'); assert.equal(c.options.redirect, 'error'); assert.ok(c.options.signal) }
  assert.equal(JSON.stringify(view).includes(env.ROUTER_CREDITS_READ_API_KEY), false)
})
await check('unconfigured/invalid identity rejects before fetch; upstream auth/error/malformed never fabricates zero', async () => {
  for (const bad of [{ MODEL_ROUTER_URL: 'https://user:password@router.example' }, { MODEL_ROUTER_URL: 'file:///tmp/router' }, { MODEL_ROUTER_URL: 'https://router.example/?key=x' }, { ROUTER_CREDITS_READ_API_KEY: '' }, { ROUTER_CREDITS_READ_API_KEY: 'bad\nkey' }]) {
    const got = await server({ ...env, ...bad }).getRouterCreditsForSession('qa:billing', { fetcher: () => { throw new Error('Must not fetch') } }); assert.equal(got.available, false)
  }
  for (const id of ['', '../someone', 'a/b', 'x@y', '.', 'qa:billing\n']) assert.equal((await server().getRouterCreditsForSession(id, { fetcher: () => { throw new Error('Must not fetch') } })).available, false)
  for (const response of [json({ secret: 'PRIVATE' }, 503), json({}, 403), new Response('{'), json({ ...raw(), user_id: 'foreign' }), new Response('x'.repeat(65537))]) {
    const got = await server().getRouterCreditsForSession('qa:billing', { fetcher: async () => response }); assert.deepEqual(plain(got), { available: false })
  }
  const got = await server().getRouterCreditsForSession('qa:billing', { fetcher: async () => { throw new Error('PRIVATE') } }); assert.deepEqual(plain(got), { available: false })
})
await check('streamed byte limit cancels without Content-Length and bounded deadline aborts requests', async () => {
  let cancelled = false
  const stream = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(32769)) }, cancel() { cancelled = true } })
  assert.equal((await server().getRouterCreditsForSession('qa:billing', { fetcher: async () => new Response(stream) })).available, false)
  assert.equal(cancelled, true)
  const fast = server(env, { setTimeout: cb => setTimeout(cb, 5) })
  let aborted = false
  const got = await fast.getRouterCreditsForSession('qa:billing', { fetcher: (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => { aborted = true; reject(new Error('Aborted')) })) })
  assert.equal(aborted, true); assert.equal(got.available, false)
})
await check('optional chart cannot corrupt balance; validate full calendar days and exact sums', async () => {
  const badMonths = []
  for (const mutate of [x => { x.user_id = 'foreign' }, x => { x.credits_used = '0.700001' }, x => { x.daily.reverse() }, x => { x.daily.pop() }, x => { x.daily[0].date = '2026-11-02' }, x => { x.month.end = '2026-12-02T00:00:00Z' }]) { const x = month(); mutate(x); badMonths.push(x) }
  for (const bad of badMonths) {
    let count = 0
    const view = await server().getRouterCreditsForSession('qa:billing', { fetcher: async () => json(++count === 1 ? raw() : bad) })
    assert.equal(view.available, true); assert.equal(view.daily, undefined); assert.equal(view.credits.planLeft, '999.500000')
  }
})

function route(enabled = true, session = { user: { id: 'qa:billing' } }, billing = { available: false }) {
  const calls = []
  const lib = load(ROUTE, {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200, headers: options.headers ?? {} }) } },
    'next-auth': { getServerSession: async () => session }, '@/lib/auth-options': { authOptions: {} },
    '@/lib/prisma': { prisma: { chatSession: { count: async query => { calls.push(query); return 3 } }, uploadedFile: { aggregate: async query => { calls.push(query); return { _sum: { fileSize: 42 } } } } } },
    '@/lib/billing/router-credits': { routerCreditsReadEnabled: () => enabled, getRouterCreditsForSession: async id => { calls.push(id); return billing } },
  })
  return { ...lib, calls }
}
await check('account API flag OFF exact legacy shape/no router call; ON additive/no-store and authenticated only', async () => {
  const off = route(false); const a = await off.GET(new Request('https://studio.example/api/account/usage?user_id=foreign'))
  assert.deepEqual(plain(a), { body: { presentationCount: 3, storageBytes: 42 }, status: 200, headers: {} }); assert.equal(off.calls.length, 2)
  const on = route(true); const b = await on.GET(new Request('https://studio.example/api/account/usage?user_id=foreign', { headers: { 'X-User-ID': 'foreign' } }))
  assert.deepEqual(plain(b.body), { presentationCount: 3, storageBytes: 42, billing: { available: false } }); assert.equal(b.headers['Cache-Control'], 'private, no-store'); assert.equal(on.calls[2], 'qa:billing')
  for (const query of on.calls.slice(0, 2)) assert.equal(query.where.userId, 'qa:billing')
  const unauth = route(true, null); assert.equal((await unauth.GET()).status, 401); assert.equal(unauth.calls.length, 0)
})

const imports = (react = React, auth = () => ({ user: { id: 'qa:billing' }, isLoading: false })) => ({
  react, 'react/jsx-runtime': jsx, 'next/link': ({ href, children }) => React.createElement('a', { href }, children), '@/hooks/use-auth': { useAuth: auth }, '@/lib/billing/router-credit-view': viewLib, './studio-router-usage.css': {},
})
await check('SSR states, period vs month, images finite/unlimited, decimal labels and safe DOM', () => {
  const component = load(COMPONENT, imports())
  for (const kind of ['loading', 'unavailable', 'disabled', 'signed-out']) {
    const html = renderToStaticMarkup(React.createElement(component.StudioRouterUsageView, { state: { kind }, retry() {}, page: true }))
    assert.ok(html.includes('Usage')); assert.equal(html.includes('0 credits'), false); assert.equal(html.includes('PRIVATE'), false)
  }
  const view = server().parseRouterCreditView(raw(), 'qa:billing')
  view.credits.planLeft = '0.400000'; view.images.cap = null
  const html = renderToStaticMarkup(React.createElement(component.StudioRouterUsageView, { state: { kind: 'ready', view }, page: true }))
  assert.ok(html.includes('Max plan')); assert.ok(html.includes('Unlimited')); assert.ok(html.includes('under 1 credit')); assert.ok(html.includes('Nov 18, 2026')); assert.ok(html.includes('Never expire'))
  assert.equal(/PRIVATE|provider|token|margin|model_id|running will finish/i.test(html), false)
  assert.equal(renderToStaticMarkup(React.createElement(component.StudioRouterUsage, {})), '')
})
await check('async account changes hide old results immediately and ignore late replies/cleanup', async () => {
  let user = 'first', values = [], index = 0, effect = null, pendingEffect = null, dependency = null
  const fakeReact = { ...React,
    useState(initial) { const at = index++; if (!(at in values)) values[at] = initial; return [values[at], next => { values[at] = typeof next === 'function' ? next(values[at]) : next }] },
    useEffect(run, deps) { if (!dependency || deps.some((value, at) => dependency[at] !== value)) { effect?.(); pendingEffect = run; dependency = deps } },
  }
  const requests = []
  const component = load(COMPONENT, { ...imports(fakeReact, () => ({ user: user ? { id: user } : null, isLoading: false })), '@/lib/billing/router-credit-view': { ...viewLib, STUDIO_ROUTER_USAGE_ENABLED: true } }, {}, { fetch: (_url, options) => new Promise(resolve => requests.push({ resolve, options })) })
  const loader = component.StudioRouterUsage({}).type
  const render = () => { index = 0; const element = loader({ page: true }); if (pendingEffect) { effect = pendingEffect(); pendingEffect = null } return element.props.state }
  assert.equal(render().kind, 'loading'); assert.equal(requests.length, 1)
  const view = server().parseRouterCreditView(raw(), 'qa:billing')
  requests[0].resolve(json({ billing: view })); await tick(); assert.equal(render().kind, 'ready')
  user = 'second'; assert.equal(render().kind, 'loading'); assert.equal(requests[0].options.signal.aborted, true)
  user = 'third'; assert.equal(render().kind, 'loading'); assert.equal(requests[1].options.signal.aborted, true)
  requests[1].resolve(json({ billing: view })); await tick(); assert.equal(render().kind, 'loading')
  requests[2].resolve(json({ billing: { available: false } })); await tick(); assert.equal(render().kind, 'unavailable')
  user = null; assert.equal(render().kind, 'signed-out'); assert.equal(requests[2].options.signal.aborted, true)
})
await check('registered shared edits are reversible to current dev; flags default OFF and keys blank', () => {
  for (const name of Object.keys(ROUTER_BILLING_EDITS)) {
    const base = execFileSync('git', ['show', `eeb78d4f:${name}`], { cwd: root, encoding: 'utf8' })
    assert.equal(stripRouterBilling(name, read(name)), base)
  }
  for (const name of ROUTER_BILLING_SCOPE_FILES) assert.ok(LATER_CHANGE_FILES.has(name))
  assert.ok(LATER_ENV_BLOCKS.includes(ROUTER_BILLING_ENV_BLOCK)); assert.ok(LATER_STRIPS.includes(stripRouterBilling))
  assert.ok(read('.env.example').endsWith(ROUTER_BILLING_ENV_BLOCK))
  assert.ok(ROUTER_BILLING_ENV_BLOCK.includes('STUDIO_ROUTER_CREDITS_READ="false"')); assert.ok(ROUTER_BILLING_ENV_BLOCK.includes('NEXT_PUBLIC_STUDIO_ROUTER_USAGE="false"')); assert.ok(ROUTER_BILLING_ENV_BLOCK.includes('ROUTER_CREDITS_READ_API_KEY=\n'))
})
if (process.env.BILLING_PREVIEW_DIR) {
  const directory = process.env.BILLING_PREVIEW_DIR
  assert.ok(directory.startsWith('/Volumes/Deckster-T9/'))
  fs.mkdirSync(directory, { recursive: true })
  const component = load(COMPONENT, imports())
  let calls = 0
  const view = await server().getRouterCreditsForSession('qa:billing', { fetcher: async () => json(++calls === 1 ? raw() : month()) })
  const html = renderToStaticMarkup(React.createElement(component.StudioRouterUsageView, { state: { kind: 'ready', view }, page: true }))
  const error = renderToStaticMarkup(React.createElement(component.StudioRouterUsageView, { state: { kind: 'unavailable' }, retry() {}, page: true }))
  const css = read('components/billing/studio-router-usage.css')
  for (const dark of [false, true]) for (const [name, markup] of [['usage', html], ['unavailable', error]]) fs.writeFileSync(path.join(directory, `${name}-${dark ? 'dark' : 'light'}.html`), `<!doctype html><html class="${dark ? 'dark' : ''}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Billing usage · offline fixture</title><style>body{margin:0;font-family:Arial,sans-serif;background:${dark ? '#131b1e' : '#f6f8f7'}}${css}</style><body>${markup}<script>document.documentElement.dataset.overflow=String(document.documentElement.scrollWidth>innerWidth)</script></body></html>`)
}
console.log(`${checks} focused router billing checks passed; offline, no shared writes.`)
