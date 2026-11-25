import { pathToFileURL } from 'node:url'

const ROUTE = 'app/api/director/ws-token/route.ts'
const HOOK = 'hooks/use-deckster-websocket-v2.ts'
const SERVER = 'STUDIO_RESEARCHER_OWNER_PROOF_ENABLED'
const CLIENT = 'NEXT_PUBLIC_STUDIO_RESEARCHER_OWNER_PROOF'

export const SCOPE_FILES = new Set([
  ROUTE, HOOK, '.env.example', 'scripts/studio-later-changes.mjs', 'scripts/test-studio-researcher-owner-proof.mjs',
  'scripts/fixtures/researcher-session-auth-f899342.py', 'scripts/fixtures/researcher-session-auth-parity.mjs',
])
export const ENV_BLOCK = [
  '# D16 STUDIO RESEARCHER OWNER PROOF. Both flags default off and accept only the exact value "true".',
  '# The server flag mints proof for the authenticated account and session. The public build-time flag carries it on auth_refresh.',
  `${SERVER}="false"`,
  `${CLIENT}="false"`,
].join('\n')

export function stripResearcherOwnerProof(rel, text) {
  if (typeof text !== 'string' || (rel !== ROUTE && rel !== HOOK)) return text
  return text
    .replace(/^.* \/\/ D16-OWNER-PROOF\n/gm, '')
}

async function main() {
  const { default: assert } = await import('node:assert/strict')
  const { createHmac } = await import('node:crypto')
  const { execFileSync } = await import('node:child_process')
  const { readFileSync } = await import('node:fs')
  const { fileURLToPath } = await import('node:url')
  const { default: React } = await import('react')
  const { Root } = await import('./studio-chat-harness/mini-react.mjs')
  const { createEnvironment, installHostNetworkGuard, SYNTHETIC_WS_URL, START_MS } = await import('./studio-chat-harness/fake-env.mjs')
  const { createModuleLoader } = await import('./studio-chat-harness/module-loader.mjs')
  const { BASE_ENV } = await import('./studio-chat-harness/profiles.mjs')
  const { researcherTokenFixture, tokenDigest } = await import('./fixtures/researcher-session-auth-parity.mjs')
  const { default: net } = await import('node:net')
  const { default: dns } = await import('node:dns')
  installHostNetworkGuard(net, dns)
  const root = fileURLToPath(new URL('..', import.meta.url))
  const account = 'synthetic-account'
  const sid = 'synthetic-session'
  const email = 'synthetic@example.invalid'
  const fixtureMaterial = part => Array(8).fill(part).join(':')
  const proofMaterial = fixtureMaterial('proof')
  const transportMaterial = fixtureMaterial('transport')

  async function mint({ flag, secret = proofMaterial, userId = account, owner = userId } = {}) {
    const loader = createModuleLoader({
      root,
      globals: {
        Buffer, Date: { now: () => START_MS },
        process: { env: { [SERVER]: flag, RESEARCHER_SESSION_TOKEN_SECRET: secret, DIRECTOR_WS_AUTH_SECRET: transportMaterial } },
      },
      stubs: {
        crypto: { createHmac },
        'next/server': { NextResponse: { json: (body, status) => ({ wire: JSON.stringify(body), status: status?.status ?? 200 }) } },
        'next-auth': { getServerSession: async () => ({ user: { id: userId, email } }) },
      },
      fileStubs: {
        'lib/auth-options': { authOptions: {} },
        'lib/prisma': { prisma: { chatSession: { findUnique: async () => ({ userId: owner }) }, user: { findUnique: async () => null } } },
        'lib/quota/build-quota': { isWsBqClaimEnabled: () => false },
        'lib/quota/build-quota-claim': {},
        'lib/kg-entitlement': { isKgEntitled: () => false },
        'lib/stripe/stripe-utils': { getUserSubscription: async () => null },
        'lib/api-hardening': { requireApprovedUser: async () => null },
      },
    })
    return loader.load(ROUTE).GET({ nextUrl: { searchParams: new URLSearchParams({ session_id: sid }) } })
  }

  const off = await mint()
  const on = await mint({ flag: 'true' })
  const onBody = JSON.parse(on.wire)
  const proof = onBody.researcher_session_token
  assert.ok(typeof proof === 'string', 'server flag must produce Researcher proof')
  const { researcher_session_token, ...legacy } = onBody
  assert.equal(JSON.stringify(legacy), off.wire, 'off response body matches the legacy bytes')
  const now = START_MS / 1000
  const legacyPayload = Buffer.from(JSON.stringify({ sub: account, sid, iat: now, exp: now + 900, kg_entitled: false })).toString('base64url')
  const legacyMac = createHmac('sha256', transportMaterial).update(legacyPayload).digest('base64url')
  assert.equal(off.wire === JSON.stringify({ auth_enabled: true, auth_token: `${legacyPayload}.${legacyMac}`, expires_in: 900 }), true, 'legacy response order, full signed bytes and TTL')
  const directorClaim = JSON.parse(Buffer.from(legacyPayload, 'base64url'))
  const [version, signedSid, signedAccount, expires] = proof.split('.')
  assert.equal(version, 'v1')
  assert.equal(Buffer.from(signedSid, 'base64url').toString(), directorClaim.sid)
  assert.equal(Buffer.from(signedAccount, 'base64url').toString(), directorClaim.sub)
  assert.equal(Number(expires), now + 900)
  const input = { secret: proofMaterial, sid, uid: account, now, expires: now + 900 }
  const contract = researcherTokenFixture({ ...input, studioToken: proof })
  assert.equal(tokenDigest(proof) === contract.referenceSha256, true, 'token bytes match the Researcher f899342 minter')
  assert.equal(contract.state, 'valid', 'Researcher f899342 verifies Studio-minted bytes')
  assert.equal(contract.claimsMatch, true)

  const studioMint = createModuleLoader({ root, globals: { Buffer }, stubs: { crypto: { createHmac } } })
    .load('lib/researcher-session-token.ts').mintResearcherSessionToken
  const studioInput = { secret: proofMaterial, sessionId: sid, userId: account, nowSeconds: now, ttlSeconds: 900 }
  for (const uid of ['unsignable|id', 'unsignable\u0001id']) {
    assert.equal(studioMint({ ...studioInput, userId: uid }) === null, true)
    const invalid = researcherTokenFixture({ ...input, uid })
    assert.equal(invalid.referenceSha256, null)
    assert.equal(invalid.state, 'invalid')
  }
  const maxTtl = 24 * 60 * 60
  assert.equal(studioMint({ ...studioInput, ttlSeconds: maxTtl + 1 }) === null, true, 'Studio mint caps TTL at 24h')
  assert.equal(researcherTokenFixture({ ...input, expires: now + maxTtl + 1 }).state, 'valid', 'Researcher verifier includes 30 seconds of skew')
  assert.equal(researcherTokenFixture({ ...input, expires: now + maxTtl + 31 }).state, 'invalid', 'Researcher rejects TTL beyond 24h plus skew')

  // Both IDs meet the character cap, but their UTF-8 encoding crosses the Researcher wire cap.
  const longId = String.fromCodePoint(0x10400).repeat(255)
  const oversized = studioMint({ ...studioInput, sessionId: longId, userId: longId })
  assert.equal(oversized?.token.length > 2048, true, 'Studio can currently mint a wire token the Researcher cannot use')
  const oversizedContract = researcherTokenFixture({ ...input, sid: longId, uid: longId, studioToken: oversized.token })
  assert.equal(tokenDigest(oversized.token) === oversizedContract.referenceSha256, true)
  assert.equal(oversizedContract.state, 'invalid', 'Researcher rejects >2048 characters before claim validation')

  for (const scenario of [
    { flag: 'TRUE' },
    { flag: 'true', secret: '' },
    { flag: 'true', secret: `  ${'x'.repeat(31)}  ` },
    { flag: 'true', userId: 'unsignable|id' },
    { flag: 'true', userId: 'unsignable\u0001id' },
  ]) {
    const { wire, status } = await mint(scenario)
    const body = JSON.parse(wire)
    assert.equal(status, 200)
    assert.equal(typeof body.auth_token, 'string')
    assert.equal(Object.hasOwn(body, 'researcher_session_token'), false)
  }
  const foreign = await mint({ flag: 'true', owner: 'foreign-account' })
  assert.equal(foreign.status, 403, 'turned-on mint still enforces ownership with API hardening off')
  assert.equal(foreign.wire, '{"error":"Forbidden"}')

  async function socketHarness(flag, { failInitial = false } = {}) {
    const env = createEnvironment({
      processEnv: { ...BASE_ENV, [CLIENT]: flag, NEXT_PUBLIC_DIRECTOR_WS_URL: SYNTHETIC_WS_URL },
    })
    const privateWrites = []
    for (const storage of [env.sessionStorage, env.localStorage]) {
      const save = storage.setItem
      storage.setItem = (key, value) => {
        privateWrites.push([key, value])
        save(key, value)
      }
    }
    let count = 0
    let failNext = false
    let omitProofNext = false
    let delayNext
    env.globals.fetch = async (url, options) => {
      assert.match(String(url), /^\/api\/director\/ws-token\?session_id=/)
      assert.equal(options.cache, 'no-store')
      const mintNumber = ++count
      if (delayNext) {
        const wait = delayNext
        delayNext = undefined
        if (options.signal) {
          await Promise.race([
            wait,
            new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })),
          ])
        } else {
          await wait
        }
      }
      if (failInitial && mintNumber === 1) {
        if (failInitial === 'malformed') return { ok: true, json: async () => { throw new SyntaxError(proof) } }
        throw new Error('synthetic ws-token transport failure')
      }
      if (failNext) {
        failNext = false
        throw new Error(proof)
      }
      const includeProof = !omitProofNext
      omitProofNext = false
      return { ok: true, json: async () => ({
        auth_enabled: true,
        auth_token: `synthetic-director-${mintNumber}`,
        expires_in: 900,
        bq_claim: true,
        ...(includeProof ? { researcher_session_token: `${proof}.${mintNumber}` } : {}),
      }) }
    }
    let latest
    const loader = createModuleLoader({
      root,
      globals: env.globals,
      stubs: { react: React },
      fileStubs: {
        'hooks/use-auth': { useAuth: () => ({ user: { id: account, email } }) },
        'lib/debug-log': { debugLog: (...args) => privateWrites.push(args) },
      },
    })
    const { useDecksterWebSocketV2 } = loader.load(HOOK)
    const tree = new Root()
    function Probe({ sessionId }) {
      latest = useDecksterWebSocketV2({ existingSessionId: sessionId, autoConnect: true, reconnectOnError: Boolean(failInitial) })
      return null
    }
    const settle = async () => {
      for (let index = 0; index < 5; index++) {
        await env.macrotask()
        tree.flush()
      }
    }
    env.settle = settle
    const mount = sessionId => tree.setElement(React.createElement(Probe, { sessionId }))
    mount(sid)
    await settle()
    let initialFailure
    if (failInitial) {
      assert.equal(count, 1)
      assert.equal(env.sockets.length, 0, 'a failed Director mint cannot open an unauthenticated socket')
      initialFailure = {
        connection: latest.connectionState,
        reconnect: latest.reconnectStatus,
        message: latest.error?.message,
      }
      await env.clock.advance(5_000, settle)
      assert.equal(count, 2, 'the original scheduled reconnect retries once')
    }
    if (!env.sockets.length) {
      latest.connect()
      await settle()
    }
    assert.equal(env.sockets.length, 1)
    env.sockets[0].serverOpen()
    await settle()
    return {
      env, settle, mount, privateWrites, initialFailure,
      mintCount: () => count,
      failMint: () => { failNext = true },
      omitProof: () => { omitProofNext = true },
      pauseMint: () => {
        let release
        delayNext = new Promise(resolve => { release = resolve })
        return release
      },
      send: text => latest.sendMessageWhenConnected(text),
      frames: () => env.outbound.filter(({ data }) => data !== 'ping').map(({ data }) => JSON.parse(data)),
    }
  }

  const ws = await socketHarness('true')
  const cleanFrames = harness => harness.frames().map(({ type, payload }) => ({
    type,
    ...(type === 'auth_refresh' && {
      token: payload.token, proofPresent: typeof payload.researcher_session_token === 'string',
      sameMint: payload.researcher_session_token?.endsWith(`.${payload.token.split('-').at(-1)}`) ?? false,
    }),
  }))
  const refresh = n => ({ type: 'auth_refresh', token: `synthetic-director-${n}`, proofPresent: true, sameMint: true })
  const message = { type: 'user_message' }
  assert.deepEqual(cleanFrames(ws).slice(0, 1), [refresh(1)], 'exactly one proof frame is sent first on open')
  // Director brief ROW16-CONDITIONS-D12B-D16.md, lines 45–48.
  // This pins Studio's mock frame only, pending Director code sha.
  assert.equal(JSON.stringify(ws.frames()[0]) === JSON.stringify({
    type: 'auth_refresh',
    payload: { token: 'synthetic-director-1', researcher_session_token: `${proof}.1` },
  }), true, 'the first frame uses the socket credential and the exact nested proof field')
  assert.equal(ws.env.sockets[0].protocols.some(protocol => protocol.includes(proof)), false, 'proof is not in the handshake')
  assert.equal(ws.mintCount(), 1)
  assert.equal(ws.env.sockets[0].protocols[1], 'deckster-auth.synthetic-director-1')
  for (const text of ['first synthetic turn', 'second synthetic turn']) assert.equal(await ws.send(text), true)
  assert.deepEqual(cleanFrames(ws), [refresh(1), refresh(2), message, refresh(3), message],
    'each turn fetches a fresh proof and sends it directly before its user_message')
  ws.failMint()
  assert.equal(await ws.send('turn still delivered'), true)
  assert.deepEqual(cleanFrames(ws).slice(-2), [message, message])
  ws.omitProof()
  assert.equal(await ws.send('legacy token only'), true)
  assert.deepEqual(cleanFrames(ws).slice(-2), [message, message], 'a Director-only mint leaves the turn on its legacy path')
  await ws.env.clock.advance(540_000, ws.settle)
  await ws.settle()
  assert.deepEqual(cleanFrames(ws).at(-1), refresh(6), 'timer forwards both fields')
  ws.env.window.dispatchEvent({ type: 'deckster:ws-bq-refresh' })
  await ws.settle()
  assert.deepEqual(cleanFrames(ws).at(-1), refresh(7), 'forced refresh forwards both fields')
  const release = ws.pauseMint()
  const turn = ws.send('must not follow navigation')
  ws.mount(`${sid}-next`)
  await ws.settle()
  release()
  assert.equal(await turn, false)
  assert.deepEqual(cleanFrames(ws).at(-1), refresh(7), 'retired session cannot receive the pending proof or user turn')
  const privateSinks = JSON.stringify([ws.env.consoleEvents, ws.privateWrites, ws.env.sessionStorage.dump(), ws.env.localStorage.dump()])
  assert.equal(privateSinks.includes(proof), false)
  assert.equal(JSON.stringify(ws.env.sockets.map(({ url, protocols }) => [url, protocols])).includes(proof), false)
  const disabled = await socketHarness('false')
  assert.equal(await disabled.send('flag-off synthetic turn'), true)
  assert.deepEqual(cleanFrames(disabled), [message])
  assert.equal(disabled.mintCount(), 1, 'flag-off turn adds no fetch')
  assert.equal(JSON.stringify(disabled.env.outbound).includes(proof), false)

  const failedOff = await socketHarness('false', { failInitial: true })
  const failedOn = await socketHarness('true', { failInitial: true })
  assert.equal(failedOn.initialFailure.reconnect, 'scheduled')
  assert.deepEqual(failedOn.initialFailure, failedOff.initialFailure, 'Director mint failure uses the same retry and UI state with either flag')
  assert.deepEqual(cleanFrames(failedOn), [refresh(2)], 'the retry opens an authenticated socket and sends the new proof first')
  const malformedOn = await socketHarness('true', { failInitial: 'malformed' })
  assert.deepEqual(malformedOn.initialFailure, failedOff.initialFailure)
  assert.equal(JSON.stringify(malformedOn.env.consoleEvents).includes(proof), false, 'a malformed response can include proof in its parser error')

  const slow = await socketHarness('true')
  const endSlowMint = slow.pauseMint()
  const slowTurn = slow.send('send after timeout')
  await slow.env.clock.advance(3_000, slow.settle)
  assert.equal(await slowTurn, true)
  endSlowMint()
  assert.deepEqual(cleanFrames(slow), [refresh(1), message], 'a stalled mint times out; a still-current turn still sends')
  const endClosedMint = slow.pauseMint()
  const closedTurn = slow.send('must not outlive socket')
  slow.env.sockets[0].serverClose(1006)
  endClosedMint()
  assert.equal(await closedTurn, false)
  assert.deepEqual(cleanFrames(slow), [refresh(1), message], 'a closed socket cannot inherit a pending frame or turn')

  for (const file of [ROUTE, HOOK]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
    const base = execFileSync('git', ['show', `54c5f70e0e02d5c43811b409d4d9bc358826ca37:${file}`], { cwd: root, encoding: 'utf8' })
    assert.equal(stripResearcherOwnerProof(file, source) === base, true, `${file} strip restores the original source bytes`)
  }
  if (process.argv.includes('--wire-summary')) {
    console.log(JSON.stringify({
      flagOff: cleanFrames(disabled).map(({ type }) => type),
      flagOn: cleanFrames(ws).slice(0, 3).map(({ type, proofPresent, sameMint }) => ({ type, proofPresent, sameMint })),
    }))
  }
  console.log('D16 proof passed: owned mint, exact legacy bytes, open and per-turn ordering, timer and forced refresh, stale session and private sinks.')
  console.log('Researcher f899342 parity passed; Studio omits proof for a <32-byte stripped secret. Researcher rejects oversized tokens Studio can mint. Mock Director frame pending Director code sha.')
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await main()
