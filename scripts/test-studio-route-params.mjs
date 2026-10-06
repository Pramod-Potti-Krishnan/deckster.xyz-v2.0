// Actual native proxies, isolated function calls only. Auth and fetch are local stubs;
// no application runtime, credentials, service requests or persistence are loaded.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import ts from 'typescript'

const root = new URL('../', import.meta.url), require = createRequire(import.meta.url)
const { NextResponse } = require('next/server')
const beforeRevision = 'bd46f97'
const specs = [
  { file: 'app/api/templates/[id]/route.ts', key: 'id', methods: ['GET', 'DELETE'], suffix: '' },
  { file: 'app/api/templates/[id]/blueprint/route.ts', key: 'id', methods: ['PATCH'], suffix: '/blueprint' },
  { file: 'app/api/ingest-jobs/[jobId]/route.ts', key: 'jobId', methods: ['GET'], suffix: '' },
]
const compile = source => {
  const result = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } })
  assert.deepEqual((result.diagnostics ?? []).filter(entry => entry.category === ts.DiagnosticCategory.Error), [])
  return result.outputText
}
const plain = value => JSON.parse(JSON.stringify(value))
let checks = 0

for (const spec of specs) {
  const source = fs.readFileSync(new URL(spec.file, root), 'utf8')
  const before = execFileSync('git', ['show', `${beforeRevision}:${spec.file}`], { cwd: root, encoding: 'utf8' })
  const signature = `params: Promise<{ ${spec.key}: string }>`
  const resolution = `  const { ${spec.key} } = await params;\n`
  assert.equal(source.split(signature).length - 1, spec.methods.length)
  assert.equal(source.split(resolution).length - 1, spec.methods.length)
  const reversed = source.replaceAll(signature, `params: { ${spec.key}: string }`)
    .replaceAll(resolution, '')
    .replaceAll(`encodeURIComponent(${spec.key})`, `encodeURIComponent(params.${spec.key})`)
  assert.equal(reversed, before, 'Complete proxy source is byte-exact outside only Promise params resolution')
  const ast = ts.createSourceFile(spec.file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  for (const method of spec.methods) {
    const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === method)
    assert.ok(declaration)
    const statements = declaration.body.statements
    assert.match(statements[0].getText(ast), /await resolveUserId\(\)/)
    assert.match(statements[1].getText(ast), /if \(!userId\) return NextResponse\.json/)
    assert.equal(statements[2].getText(ast), `const { ${spec.key} } = await params;`, 'Auth remains before parameter resolution')
  }
  checks++

  function load({ session, upstreamStatus = 200, upstreamBody = { native: 'upstream-body' }, upstreamFailure, jsonFailure, origin = 'https://offline-director.invalid' } = {}) {
    const calls = [], authCalls = [], authOptions = { supplied: 'offline-auth-options' }
    const mod = { exports: {} }
    vm.runInNewContext(compile(source), {
      module: mod, exports: mod.exports, process: { env: { DIRECTOR_API_URL: origin } },
      require: name => {
        if (name === 'next/server') return { NextResponse }
        if (name === 'next-auth') return { getServerSession: async options => { authCalls.push(options); return session } }
        if (name === '@/lib/auth-options') return { authOptions }
        throw new Error(`Test refuses dependency ${name}`)
      },
      fetch: async (url, options) => {
        calls.push({ url, options: plain(options) })
        if (upstreamFailure) throw new Error('Supplied upstream transport failure')
        return { status: upstreamStatus, json: async () => {
          if (jsonFailure) throw new Error('Supplied upstream JSON failure')
          return upstreamBody
        } }
      },
    })
    return { methods: mod.exports, calls, authCalls, authOptions }
  }

  for (const method of spec.methods) {
    for (const session of [null, {}, { user: {} }]) {
      const h = load({ session })
      let paramsReads = 0, bodyReads = 0
      const params = { get then() { paramsReads++; throw new Error('Unauthorized parameters must not be read') } }
      const response = await h.methods[method]({ json: async () => { bodyReads++; throw new Error('Unauthorized body must not be read') } }, { params })
      assert.equal(response.status, 401)
      assert.deepEqual(await response.json(), { error: 'Unauthorized' })
      assert.equal(h.calls.length, 0); assert.equal(paramsReads, 0); assert.equal(bodyReads, 0)
      assert.equal(h.authCalls[0], h.authOptions); checks++
    }

    for (const session of [{ user: { id: 'owner/ id?#é', email: 'not-selected@invalid.test' } }, { user: { email: 'owner+test@invalid.test' } }]) {
      for (const status of [200, 202, 403, 404, 409, 500]) {
        for (const origin of ['https://offline-director.invalid', undefined]) {
          const body = { native: ['no interpretation', status], error: status >= 400 ? 'upstream-denial' : null }
          const h = load({ session, upstreamStatus: status, upstreamBody: body, origin: origin ?? null })
          const payload = { template_blueprint: { slides: [{ title: 'Synthetic unsent content' }] }, keepUnknown: 'native JSON payload' }
          const id = 'resource/ id?#é', params = Promise.resolve({ [spec.key]: id })
          const response = await h.methods[method]({ json: async () => payload }, { params })
          assert.equal(response.status, status); assert.deepEqual(await response.json(), body)
          const owner = session.user.id || session.user.email
          const base = origin || 'https://directorv33-production.up.railway.app'
          const collection = spec.key === 'jobId' ? 'ingest-jobs' : 'templates'
          assert.deepEqual(h.calls, [{ url: `${base}/api/users/${encodeURIComponent(owner)}/${collection}/${encodeURIComponent(id)}${spec.suffix}`, options: method === 'GET' ? { cache: 'no-store' } : method === 'DELETE' ? { method: 'DELETE' } : { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } }])
          assert.equal(h.authCalls[0], h.authOptions); checks++
        }
      }
    }

    for (const failure of ['upstreamFailure', 'jsonFailure']) {
      const h = load({ session: { user: { id: 'offline-owner' } }, [failure]: true })
      const response = await h.methods[method]({ json: async () => ({ native: 'body' }) }, { params: Promise.resolve({ [spec.key]: 'offline-resource' }) })
      assert.equal(response.status, 502); assert.deepEqual(await response.json(), { error: 'director_unreachable' })
      assert.equal(h.calls.length, 1); checks++
    }

    if (method === 'PATCH') {
      const h = load({ session: { user: { id: 'offline-owner' } } })
      const response = await h.methods.PATCH({ json: async () => { throw new Error('Supplied invalid JSON') } }, { params: Promise.resolve({ id: 'offline-resource' }) })
      assert.equal(response.status, 400); assert.deepEqual(await response.json(), { error: 'invalid json' }); assert.equal(h.calls.length, 0); checks++
    }
  }
}

const modalFile = 'components/delete-confirm-modal.tsx'
const modal = fs.readFileSync(new URL(modalFile, root), 'utf8')
const previousModal = execFileSync('git', ['show', `${beforeRevision}:${modalFile}`], { cwd: root, encoding: 'utf8' })
assert.equal(modal.split('  title?: string | null\n').length, 2)
assert.equal(modal.replace('  title?: string | null\n', '  title?: string\n'), previousModal, 'Complete modal source differs only in its accurately nullable title type')
assert.equal(compile(modal), compile(previousModal), 'All modal runtime output, classic markup and callbacks are unchanged')
checks++

// Native activation is a separate local function fixture. Prisma is never loaded.
const activateFile = 'app/api/sessions/[id]/activate/route.ts'
const activate = fs.readFileSync(new URL(activateFile, root), 'utf8')
const previousActivate = execFileSync('git', ['show', `${beforeRevision}:${activateFile}`], { cwd: root, encoding: 'utf8' })
assert.equal(activate.split('{ params }: { params: Promise<{ id: string }> }').length, 2)
assert.equal(activate.replace('{ params }: { params: Promise<{ id: string }> }', '{ params }: { params: { id: string } }')
  .replace('const sessionId = (await params).id', 'const sessionId = params.id'), previousActivate, 'Complete activation source remains exact outside Promise params resolution')
checks++
const fixedTime = '2026-10-03T01:02:03.000Z'
class FixedDate extends Date { constructor(value = fixedTime) { super(value) } }
const activationId = 'offline-session/ id?#é', ownerEmail = 'offline-owner+qa@invalid.test'
const nativeRecord = { id: activationId, userId: ownerEmail, status: 'draft', firstMessageAt: null, lastMessageAt: null }
const selection = { id: true, userId: true, status: true, firstMessageAt: true, lastMessageAt: true }
function loadActivation({ session = { user: { email: ownerEmail } }, record = nativeRecord, findError, updateError, authError } = {}) {
  const authOptions = { supplied: 'offline-activation-auth' }, authCalls = [], reads = [], writes = [], logs = []
  const mod = { exports: {} }
  vm.runInNewContext(compile(activate), {
    module: mod, exports: mod.exports, Date: FixedDate, Error,
    console: { log: (...args) => logs.push(args), error: (...args) => logs.push(args) },
    fetch: () => { throw new Error('Activation test refuses all network requests') },
    require: name => {
      if (name === 'next/server') return { NextResponse }
      if (name === 'next-auth') return { getServerSession: async options => { authCalls.push(options); if (authError) throw new Error('Supplied auth failure'); return session } }
      if (name === '@/lib/auth-options') return { authOptions }
      if (name === '@/lib/prisma') return { prisma: { chatSession: {
        findUnique: async query => { reads.push(plain(query)); if (findError) throw new Error('Supplied database read failure'); return record },
        update: async query => { writes.push(plain(query)); if (updateError) throw new Error('Supplied database update failure'); return { ...record, ...query.data } },
      } } }
      throw new Error(`Activation test refuses dependency ${name}`)
    },
  })
  return { run: mod.exports.POST, authOptions, authCalls, reads, writes, logs }
}
for (const session of [null, {}, { user: {} }, { user: { id: 'ID-alone-is-not-native-email-auth' } }]) {
  const h = loadActivation({ session }); let paramsReads = 0, bodyReads = 0
  const response = await h.run({ json: async () => { bodyReads++; throw new Error('No body read') } }, { params: { get then() { paramsReads++; throw new Error('No parameter read') } } })
  assert.equal(response.status, 401); assert.deepEqual(await response.json(), { error: 'Unauthorized' })
  assert.equal(paramsReads, 0); assert.equal(bodyReads, 0); assert.deepEqual(h.reads, []); assert.deepEqual(h.writes, [])
  assert.equal(h.authCalls[0], h.authOptions); checks++
}
for (const [record, status, body] of [
  [null, 404, { error: 'Session not found' }],
  [{ ...nativeRecord, userId: 'different-owner@invalid.test' }, 403, { error: 'Unauthorized - session belongs to different user' }],
  [{ ...nativeRecord, status: 'active', firstMessageAt: fixedTime }, 200, { message: 'Session already active', session: { ...nativeRecord, status: 'active', firstMessageAt: fixedTime } }],
]) {
  const h = loadActivation({ record }); let bodyReads = 0
  const response = await h.run({ json: async () => { bodyReads++; return { ignored: 'native route has no request body' } } }, { params: Promise.resolve({ id: activationId }) })
  assert.equal(response.status, status); assert.deepEqual(await response.json(), body)
  assert.deepEqual(h.reads, [{ where: { id: activationId }, select: selection }]); assert.deepEqual(h.writes, [])
  assert.equal(bodyReads, 0); checks++
}
// The native route does not exclude these status strings. Retain that existing
// behavior; supplied tombstones/running states are not new lifecycle policies.
for (const status of ['draft', 'active', 'running', 'deleted', 'tombstoned']) {
  for (const unreadBody of ['valid-json', 'invalid-json']) {
    const h = loadActivation({ record: { ...nativeRecord, status } }); let bodyReads = 0
    const response = await h.run({ json: async () => { bodyReads++; if (unreadBody === 'invalid-json') throw new Error('Supplied invalid JSON'); return { ignored: true } } }, { params: Promise.resolve({ id: activationId }) })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { message: 'Session activated successfully', session: { id: activationId, status: 'active', firstMessageAt: fixedTime, lastMessageAt: fixedTime } })
    assert.deepEqual(h.reads, [{ where: { id: activationId }, select: selection }])
    assert.deepEqual(h.writes, [{ where: { id: activationId }, data: { status: 'active', firstMessageAt: fixedTime, lastMessageAt: fixedTime } }])
    assert.equal(bodyReads, 0); checks++
  }
}
for (const [failure, detail, readCount, writeCount] of [
  ['authError', 'Supplied auth failure', 0, 0],
  ['findError', 'Supplied database read failure', 1, 0],
  ['updateError', 'Supplied database update failure', 1, 1],
]) {
  const h = loadActivation({ [failure]: true })
  const response = await h.run({}, { params: Promise.resolve({ id: activationId }) })
  assert.equal(response.status, 500); assert.deepEqual(await response.json(), { error: 'Failed to activate session', details: detail })
  assert.equal(h.reads.length, readCount); assert.equal(h.writes.length, writeCount); checks++
}
{
  const h = loadActivation()
  const response = await h.run({}, { params: Promise.reject(new Error('Supplied parameter resolution failure')) })
  assert.equal(response.status, 500); assert.deepEqual(await response.json(), { error: 'Failed to activate session', details: 'Supplied parameter resolution failure' })
  assert.deepEqual(h.reads, []); assert.deepEqual(h.writes, []); checks++
}

// Exact ErrorHandler implementation, with its React imports/type boundary fixed.
const handlerFile = 'lib/error-handler.ts', handler = fs.readFileSync(new URL(handlerFile, root), 'utf8')
const previousHandler = execFileSync('git', ['show', `${beforeRevision}:${handlerFile}`], { cwd: root, encoding: 'utf8' })
const hookImport = "import { useState, useEffect, useCallback } from 'react';\n\n"
assert.equal(handler.split(hookImport).length, 2)
assert.equal(handler.replace(hookImport, '').replace('setGlobalHandler(handler: ((error: ErrorDetails) => void) | null)', 'setGlobalHandler(handler: (error: ErrorDetails) => void)'), previousHandler, 'Complete error lifecycle, retry timing, listeners, hook bodies and diagnostics stay byte-exact')
const handlerProgram = ts.createProgram([new URL(handlerFile, root).pathname], {
  noEmit: true, strict: true, skipLibCheck: true, types: ['node', 'react'],
  target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
  moduleResolution: ts.ModuleResolutionKind.Node10, lib: ['lib.es2020.d.ts', 'lib.dom.d.ts'],
})
assert.deepEqual(ts.getPreEmitDiagnostics(handlerProgram).map(entry => ts.flattenDiagnosticMessageText(entry.messageText, ' ')), [], 'Actual ErrorHandler file has no semantic type diagnostics; no suppression or synthetic declarations')
checks++
function loadErrorHandler(source) {
  const mod = { exports: {} }
  vm.runInNewContext(compile(source), {
    module: mod, exports: mod.exports, Date: FixedDate, process: { env: { NODE_ENV: 'test' } },
    console: { log() {}, error() {} }, setTimeout: () => { throw new Error('Class comparison refuses real timers') },
    require: name => { if (name === 'react') return require('react'); throw new Error(`ErrorHandler comparison refuses dependency ${name}`) },
  })
  return new mod.exports.ErrorHandler()
}
for (const error of [
  { code: 1008, message: 'Unauthorized' }, { code: 1001, message: 'Disconnected' },
  { status: 429, message: 'rate limit', retryAfter: 12 }, { status: 400, message: 'invalid input' },
  { status: 503, message: 'server failed' }, { message: 'network unavailable' },
  { message: 'timeout' }, { message: 'supplied unknown failure' },
]) {
  const current = loadErrorHandler(handler), previous = loadErrorHandler(previousHandler)
  const exercise = instance => {
    const seen = [], categories = []
    instance.setGlobalHandler(details => seen.push(plain(details)))
    const stop = instance.on(instance.categorizeError(error), details => categories.push(plain(details)))
    const first = instance.handleError(error)
    instance.setGlobalHandler(null)
    const second = instance.handleError(error)
    stop()
    instance.setGlobalHandler(details => seen.push(plain(details)))
    const third = instance.handleError(error)
    const logs = plain(instance.getErrorLog())
    instance.clearErrorLog()
    assert.equal(seen.length, 2); assert.equal(categories.length, 2); assert.deepEqual(plain(instance.getErrorLog()), [])
    return plain({ seen, categories, first, second, third, logs })
  }
  assert.deepEqual(exercise(current), exercise(previous), 'Actual class set/clear/replace, category callbacks, unsubscribe, messages/delays and logs are identical')
  checks++
}
console.log(`PASS ${checks} isolated proxy/activation/auth/ownership/forwarding/error/type-only/class-preservation cases; actual ErrorHandler semantic typecheck clear; no service requests, Prisma client or application runtime.`)
