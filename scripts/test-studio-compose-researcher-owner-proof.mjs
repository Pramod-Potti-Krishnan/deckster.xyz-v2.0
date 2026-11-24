import { pathToFileURL } from 'node:url'

const ROUTE = 'app/api/slides/compose/route.ts'
const TEST = 'scripts/test-studio-compose-researcher-owner-proof.mjs'
const FLAG = 'STUDIO_RESEARCHER_OWNER_PROOF_ENABLED'
const HEADER = 'X-Deckster-Session-Token'

export const COMPOSE_RESEARCHER_OWNER_PROOF_FILES = new Set([ROUTE, TEST])

export function stripComposeResearcherOwnerProof(relative, source) {
  if (relative !== ROUTE || typeof source !== 'string') return source
  return source.replace(/^.* \/\/ D16-COMPOSE-OWNER-PROOF\n/gm, '')
}

async function main() {
  const { default: assert } = await import('node:assert/strict')
  const crypto = await import('node:crypto')
  const { default: dns } = await import('node:dns')
  const { default: net } = await import('node:net')
  const { execFileSync } = await import('node:child_process')
  const { readFileSync } = await import('node:fs')
  const { fileURLToPath } = await import('node:url')
  const { installHostNetworkGuard } = await import('./studio-chat-harness/fake-env.mjs')
  const { createModuleLoader } = await import('./studio-chat-harness/module-loader.mjs')
  installHostNetworkGuard(net, dns)

  const root = fileURLToPath(new URL('..', import.meta.url))
  const account = 'synthetic-compose-user'
  const email = 'compose@example.invalid'
  const sid = 'synthetic-compose-session'
  const now = 1_790_000_000
  const material = crypto.randomBytes(32).toString('hex')
  const body = { session_id: sid, user_id: 'caller-supplied', prompt: 'compose a synthetic slide' }
  const kgBody = { ...body, research: { use_knowledge_graph: true } }

  async function run({
    flag = 'true',
    sessionUser = { id: account, email },
    session = { userId: account, status: 'active' },
    input = body,
    gateId = account,
    lookupFails = false,
    signingMaterial = material,
  } = {}) {
    const envReads = []
    const fetches = []
    const lookups = []
    const env = new Proxy({
      NEXT_PUBLIC_SLIDE_COMPOSER_ENABLED: 'true',
      SLIDE_COMPOSER_DIRECTOR_URL: 'https://director.example.invalid',
      ...(flag === null ? {} : { [FLAG]: flag }),
      RESEARCHER_SESSION_TOKEN_SECRET: signingMaterial,
    }, {
      get(target, name) {
        envReads.push(name)
        return target[name]
      },
    })

    const loader = createModuleLoader({
      root,
      globals: {
        Buffer,
        URL,
        URLSearchParams,
        process: { env },
        Date: { now: () => now * 1000 },
        fetch: async (url, init) => {
          fetches.push({ url, init })
          return { status: 202, text: async () => '{"status":"accepted","target_index":2}' }
        },
      },
      stubs: {
        crypto,
        'next/server': { NextResponse: { json: (payload, init) => ({ body: JSON.stringify(payload), status: init?.status ?? 200 }) } },
        'next-auth': { getServerSession: async () => sessionUser ? { user: sessionUser } : null },
      },
      fileStubs: {
        'lib/auth-options': { authOptions: {} },
        'lib/api-hardening': {
          isApiHardeningEnabled: () => false,
          requireApprovedUser: async () => null,
          requireSessionOwner: async () => null,
        },
        'lib/kg-proxy': {
          requireKgEntitled: async () => ({ userId: gateId }),
          kgHeaders: headers => ({ ...headers, 'X-Synthetic-KG': 'enabled' }),
        },
        'lib/studio-compose-entitlement': {
          composeEntitlementHeaders: () => ({ 'X-Synthetic-Entitlement': 'enabled' }),
        },
        'lib/prisma': {
          prisma: { chatSession: { findUnique: async query => {
            lookups.push(query.where.id)
            if (lookupFails) throw new Error('synthetic database failure')
            return session
          } } },
        },
      },
    })

    const result = await loader.load(ROUTE).POST({ json: async () => input })
    const sent = fetches[0]
    return {
      result, lookups, envReads, count: fetches.length,
      header: sent?.init.headers[HEADER],
      redirect: sent?.init.redirect,
      wire: sent ? JSON.stringify(sent) : null,
      wireWithoutProof: sent ? JSON.stringify({
        ...sent,
        init: Object.fromEntries(Object.entries(sent.init)
          .filter(([name]) => name !== 'redirect')
          .map(([name, value]) => [name, name === 'headers'
            ? Object.fromEntries(Object.entries(value).filter(([header]) => header !== HEADER))
            : value])),
      }) : null,
    }
  }

  const accepted = await run()
  assert.equal(typeof accepted.header === 'string', true, 'owned account and live chat session mint proof with API hardening off')
  assert.deepEqual(accepted.lookups, [sid])
  assert.equal(accepted.count, 1)
  assert.equal(accepted.redirect, 'error', 'a proof-bearing request must stay with its configured Director origin')
  const [version, signedSid, signedOwner, expires, mac] = accepted.header.split('.')
  assert.equal(version, 'v1')
  assert.equal(Buffer.from(signedSid, 'base64url').toString(), sid)
  assert.equal(Buffer.from(signedOwner, 'base64url').toString(), account)
  assert.equal(Number(expires), now + 900)
  const expectedMac = crypto.createHmac('sha256', material).update(`${sid}|${account}|${expires}`).digest('base64url')
  assert.equal(mac === expectedMac, true, 'signed session, account and expiry verify')
  assert.equal(accepted.result.body.includes(accepted.header), false)

  const baseWire = JSON.stringify({
    url: 'https://director.example.invalid/api/v1/slides/compose-one',
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Synthetic-Entitlement': 'enabled' },
      body: JSON.stringify({ ...body, user_id: account }),
      cache: 'no-store',
    },
  })
  for (const flag of [null, 'false', 'TRUE', ' true', 'true ']) {
    const off = await run({ flag })
    assert.equal(off.wire === baseWire, true, 'flag-off request matches the pinned base wire')
    assert.equal(off.wire === accepted.wireWithoutProof, true, 'flag-off wire includes exact legacy headers, order and body bytes')
    assert.deepEqual(off.result, accepted.result)
    assert.deepEqual(off.lookups, [])
    assert.equal(off.redirect, undefined)
    assert.equal(off.envReads.includes('RESEARCHER_SESSION_TOKEN_SECRET'), false)
  }

  const kg = await run({ input: kgBody })
  const kgOff = await run({ input: kgBody, flag: 'false' })
  assert.equal(typeof kg.header === 'string', true, 'the KG request also carries owner proof')
  assert.equal(kg.wireWithoutProof === kgOff.wire, true, 'KG headers and entitlement are untouched')

  for (const scenario of [
    { session: null },
    { session: { userId: 'other-account', status: 'active' } },
    { session: { userId: account, status: 'deleted' } },
    { sessionUser: { email } },
    { input: { ...body, session_id: undefined } },
    { input: { ...body, session_id: ' ' } },
    { input: { ...body, session_id: sid + ' ' } },
    { input: { ...body, session_id: sid + '|' } },
    { input: kgBody, gateId: 'other-account' },
    { lookupFails: true },
    { signingMaterial: '' },
  ]) {
    const on = await run(scenario)
    const off = await run({ ...scenario, flag: 'false' })
    assert.equal(on.header === undefined, true, 'an unverified request must not carry owner proof')
    assert.equal(on.count, 1)
    assert.equal(on.wire === off.wire, true, 'an unavailable proof leaves the original request bytes')
    assert.deepEqual(on.result, off.result)
  }

  const anonymous = await run({ sessionUser: null })
  assert.equal(anonymous.result.status, 401)
  assert.equal(anonymous.count, 0)
  assert.deepEqual(anonymous.lookups, [])

  const source = readFileSync(new URL(`../${ROUTE}`, import.meta.url), 'utf8')
  const base = execFileSync('git', ['show', `bf3a07be60806b69680b667bef66927c197a37ca:${ROUTE}`], { cwd: root, encoding: 'utf8' })
  assert.equal(stripComposeResearcherOwnerProof(ROUTE, source) === base, true, 'the registry strip restores the base route byte for byte')
  console.log('Compose Researcher owner proof passed: signed identity, live ownership, KG forwarding, safe fallback, and exact flag-off bytes.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
