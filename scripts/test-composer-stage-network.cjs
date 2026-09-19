// Pure guard tests: every transport visible to the evaluated preload is a stub.
// The outer process is also started with COMPOSER_STAGE_DENY_ALL=1 and preload.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const { urlToHttpOptions } = require('node:url')
const code = fs.readFileSync(require.resolve('./composer-stage-network.cjs'), 'utf8')
const calls = []
const capture = kind => (...args) => { calls.push({ kind, args }); return { end() {} } }
class Socket {}
Socket.prototype.connect = capture('socket')
class UdpSocket {}
for (const name of ['send', 'sendto', 'connect', 'bind']) UdpSocket.prototype[name] = capture(`udp.${name}`)
const names = ['resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveCaa', 'resolveCname', 'resolveMx', 'resolveNaptr', 'resolveNs', 'resolvePtr', 'resolveSoa', 'resolveSrv', 'resolveTxt', 'reverse', 'lookupService']
class Resolver {}
class PromiseResolver {}
const dns = { lookup: capture('dns.lookup'), Resolver, promises: { lookup: capture('dns.promises.lookup'), Resolver: PromiseResolver } }
for (const target of [dns, dns.promises, Resolver.prototype, PromiseResolver.prototype]) {
  for (const name of names) target[name] = capture(`dns.${name}`)
}
const dgram = { Socket: UdpSocket, createSocket: capture('udp.createSocket') }
const http = { request: capture('http.request') }
const https = { request: capture('https.request') }
const modules = { 'node:fs': { appendFileSync: capture('log') }, 'node:net': { Socket }, 'node:dns': dns,
  'node:dgram': dgram, 'node:http': http, 'node:https': https, 'node:url': { urlToHttpOptions } }
const sandbox = { require: id => { assert.ok(Object.hasOwn(modules, id)); return modules[id] },
  module: { exports: {} }, URL, process: { env: {}, nextTick: process.nextTick }, fetch: capture('fetch') }
vm.runInNewContext(code, sandbox, { filename: 'composer-stage-network.cjs' })
let assertions = 0
function denied(fn, pattern = /COMPOSER_STAGE/) {
  const before = calls.length
  assert.throws(fn, pattern)
  assert.equal(calls.length, before, 'A denied operation reached the transport')
  assertions++
}
async function main() {
  for (const target of [dns, dns.promises, new Resolver(), new PromiseResolver()]) {
    for (const name of names) denied(() => target[name]('example.invalid', () => {}), /LOCAL_DNS_ONLY/)
  }
  denied(() => dns.lookup('example.invalid', () => {}), /LOCAL_DNS_ONLY/)
  await assert.rejects(dns.promises.lookup('example.invalid'), /LOCAL_DNS_ONLY/)
  const beforeDns = calls.length
  assert.equal((await dns.promises.lookup('localhost')).address, '127.0.0.1')
  assert.equal((await dns.promises.lookup('localhost', { family: 6 })).address, '::1')
  assert.equal((await dns.promises.lookup('::1', { all: true }))[0].family, 6)
  await new Promise((resolve, reject) => dns.lookup('127.0.0.1', (error, address, family) => {
    try { assert.equal(error, null); assert.equal(address, '127.0.0.1'); assert.equal(family, 4); resolve() } catch (error) { reject(error) }
  }))
  await new Promise((resolve, reject) => dns.lookup('localhost', { all: true, family: 6 }, (error, entries) => {
    try { assert.equal(error, null); assert.equal(entries[0].address, '::1'); resolve() } catch (error) { reject(error) }
  }))
  assert.equal(calls.length, beforeDns, 'Loopback lookup consulted a resolver')
  denied(() => dgram.createSocket('udp4'), /NO_UDP/)
  for (const name of ['send', 'sendto', 'connect', 'bind']) denied(() => new UdpSocket()[name]('example.invalid'), /NO_UDP/)

  const textUrl = 'http://127.0.0.1:8525/v1.2/atomic/METRICS/custom'
  for (const override of [
    { path: '/health' }, { path: '/v1.2/atomic/METRICS' }, { path: '/v1.2/atomic/../atomic/METRICS/custom' },
    { path: '//example.invalid/v1.2/atomic/METRICS/custom' }, { path: '/v1.2/atomic/METRICS/custom?other=1' },
    { hostname: 'example.invalid' }, { port: 8520 }, { protocol: 'https:' }, { auth: 'name:secret' },
    { socketPath: '/private/tmp/another-service.sock' },
  ]) denied(() => http.request(textUrl, { method: 'POST', ...override }))
  denied(() => http.request(textUrl, { method: 'GET' }))
  denied(() => https.request(textUrl.replace('http:', 'https:'), { method: 'POST' }))
  denied(() => http.request({ hostname: 'localhost', port: 8525, method: 'POST', path: '/health' }))
  // Validate the final merged request. The initial URL may be overridden to an
  // allowed route, just as an allowed URL may be overridden to a denied route.
  http.request('http://127.0.0.1:8525/health', { method: 'POST', path: '/v1.2/atomic/METRICS/custom' })
  assert.equal(calls.at(-1).kind, 'http.request')
  http.request({ hostname: 'localhost', port: 8525, method: 'POST', path: '/v1.2/atomic/METRICS/custom' })
  assert.equal(calls.at(-1).kind, 'http.request')
  http.request(new URL('http://localhost:8526/api/presentations/clone-1'), () => {})
  assert.equal(calls.at(-1).kind, 'http.request')
  http.request({ hostname: '::1', port: 8526, path: '/api/presentations/clone-1' })
  assert.equal(calls.at(-1).kind, 'http.request')

  sandbox.fetch(textUrl, { method: 'POST', redirect: 'follow', body: 'fixture' })
  assert.equal(calls.at(-1).kind, 'fetch')
  assert.equal(calls.at(-1).args[1].redirect, 'error')
  assert.equal(calls.at(-1).args[1].body, 'fixture')
  sandbox.fetch({ url: textUrl, method: 'POST', redirect: 'follow' })
  assert.equal(calls.at(-1).args[1].redirect, 'error')
  denied(() => sandbox.fetch('http://localhost:8525/health'))
  denied(() => sandbox.fetch('https://example.invalid/'))

  sandbox.process.env.COMPOSER_STAGE_DENY_ALL = '1'
  denied(() => http.request(textUrl, { method: 'POST' }))
  denied(() => sandbox.fetch(textUrl, { method: 'POST' }))
  denied(() => new Socket().connect({ host: 'localhost', port: 8525 }))
  denied(() => new Socket().connect({ path: '/private/tmp/next.sock' }))
  denied(() => dns.lookup('localhost', () => {}))
  await assert.rejects(dns.promises.lookup('localhost'), /LOCAL_DNS_ONLY/)
  console.log(`PASS: ${assertions} transport-denial cases plus loopback DNS, merged request options, IPv6, forced redirect:error and deny-all checks. All transports are stubs.`)
}
main().catch(error => { console.error(error); process.exitCode = 1 })
