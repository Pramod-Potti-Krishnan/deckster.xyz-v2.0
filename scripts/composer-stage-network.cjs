// Dedicated Stage 1 process guard, preloaded before Next or its dependencies.
const fs = require('node:fs')
const net = require('node:net')
const dns = require('node:dns')
const dgram = require('node:dgram')
const http = require('node:http')
const https = require('node:https')
const { urlToHttpOptions } = require('node:url')
const local = host => ['localhost', '127.0.0.1', '::1', '[::1]', undefined].includes(host)
const ports = [9, 3018, 8526, 8525]
function check(host, port, kind) {
  const allowed = process.env.COMPOSER_STAGE_DENY_ALL !== '1' && local(host) && ports.includes(Number(port))
  if (process.env.COMPOSER_NETWORK_LOG) fs.appendFileSync(process.env.COMPOSER_NETWORK_LOG, JSON.stringify({ time: new Date().toISOString(), kind, host, port, allowed }) + '\n')
  if (!allowed) throw new Error('COMPOSER_STAGE_LOCAL_NETWORK_ONLY')
}
function httpAllowed(url, method = 'GET') {
  if (url.protocol !== 'http:' || !local(url.hostname) || url.username || url.password || url.hash) return false
  if (url.port === '3018') return /^\/api\/auth\/(?:session|csrf|providers|callback\/(?:credentials|dev-login)|signout|_log)$/.test(url.pathname) && ['GET', 'POST'].includes(method)
  if (url.search) return false
  if (url.port === '8525') return method === 'POST' && /^\/v1\.2\/atomic\/(?:TEXT_BOX|METRICS|TABLE)\/custom$/.test(url.pathname)
  if (url.port === '8526') return method === 'GET' && /^\/api\/presentations\/[A-Za-z0-9-]+$/.test(url.pathname)
    || method === 'POST' && /^\/api\/presentations\/[A-Za-z0-9-]+\/slides\/[0-9]+\/textboxes\/[A-Za-z0-9_-]+\/recreate$/.test(url.pathname)
  return false
}
function checkHttp(url, method, kind) {
  check(url.hostname, url.port || (url.protocol === 'https:' ? 443 : 80), kind)
  if (!httpAllowed(url, method)) throw new Error('COMPOSER_STAGE_EXACT_HTTP_ROUTE_ONLY')
}
const connect = net.Socket.prototype.connect
net.Socket.prototype.connect = function (...args) {
  let options = Array.isArray(args[0]) ? args[0][0] : args[0]
  if (typeof options === 'object' && options.path) {
    if (process.env.COMPOSER_STAGE_DENY_ALL === '1' || !['/private/tmp/', '/var/folders/', '/private/var/folders/'].some(prefix => options.path.startsWith(prefix))) throw new Error('COMPOSER_STAGE_LOCAL_SOCKET_ONLY')
  } else if (typeof options === 'object') check(options.host, options.port, 'socket')
  else check(typeof args[1] === 'string' ? args[1] : 'localhost', options, 'socket')
  return connect.apply(this, args)
}
function localLookup(hostname, options) {
  if (!local(hostname) || hostname === undefined || process.env.COMPOSER_STAGE_DENY_ALL === '1') throw new Error('COMPOSER_STAGE_LOCAL_DNS_ONLY')
  const family = typeof options === 'number' ? options : options?.family
  const ipv6 = ['::1', '[::1]'].includes(hostname) || hostname === 'localhost' && [6, 'IPv6'].includes(family)
  const address = ipv6 ? '::1' : '127.0.0.1'
  const result = { address, family: ipv6 ? 6 : 4 }
  return options?.all ? [result] : result
}
// Resolve the three accepted loopback names in process. Never consult DNS,
// including through the promise API or a separately constructed Resolver.
dns.lookup = function (hostname, options, callback) {
  if (typeof options === 'function') { callback = options; options = undefined }
  const result = localLookup(hostname, options)
  if (typeof callback !== 'function') throw new TypeError('DNS lookup callback required')
  process.nextTick(() => Array.isArray(result) ? callback(null, result) : callback(null, result.address, result.family))
}
dns.promises.lookup = async function (hostname, options) { return localLookup(hostname, options) }
const denyDns = () => { throw new Error('COMPOSER_STAGE_LOCAL_DNS_ONLY') }
for (const target of [dns, dns.promises, dns.Resolver?.prototype, dns.promises.Resolver?.prototype]) {
  if (!target) continue
  for (const name of Object.getOwnPropertyNames(target)) {
    if ((name.startsWith('resolve') || ['reverse', 'lookupService'].includes(name)) && typeof target[name] === 'function') target[name] = denyDns
  }
}
const denyUdp = () => { throw new Error('COMPOSER_STAGE_NO_UDP') }
dgram.createSocket = denyUdp
for (const name of ['send', 'sendto', 'connect', 'bind']) {
  if (typeof dgram.Socket.prototype[name] === 'function') dgram.Socket.prototype[name] = denyUdp
}
const originalFetch = globalThis.fetch
if (originalFetch) globalThis.fetch = function (input, init) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
  checkHttp(url, (init?.method || input?.method || 'GET').toUpperCase(), 'fetch')
  // A redirect is a new destination and must not evade the route check above.
  return originalFetch.call(this, input, { ...init, redirect: 'error' })
}
function effectiveHttpUrl(input, options, protocol) {
  const fromUrl = typeof input === 'string' || input instanceof URL
  const effective = fromUrl ? { ...urlToHttpOptions(new URL(input)), ...(typeof options === 'object' && options) } : { ...input }
  const hostname = effective.hostname || effective.host || 'localhost'
  const port = effective.port || (protocol === 'https:' ? 443 : 80)
  // socketPath would ignore the URL authority; auth is excluded by the policy.
  if (effective.socketPath || effective.auth || !local(hostname)) throw new Error('COMPOSER_STAGE_EXACT_HTTP_ROUTE_ONLY')
  const host = hostname.includes(':') && !hostname.startsWith('[') ? `[${hostname}]` : hostname
  const path = effective.path || '/'
  const url = new URL(`${effective.protocol || protocol}//${host}:${port}${path}`)
  // Node sends options.path literally. Do not allow URL normalization to turn
  // an unapproved raw path into an approved one for the guard alone.
  if (typeof path !== 'string' || path !== url.pathname + url.search) throw new Error('COMPOSER_STAGE_EXACT_HTTP_ROUTE_ONLY')
  return { url, method: (effective.method || 'GET').toUpperCase() }
}
for (const [module, protocol] of [[http, 'http:'], [https, 'https:']]) {
  const original = module.request
  module.request = function (input, options, callback) {
    const effective = effectiveHttpUrl(input, options, protocol)
    checkHttp(effective.url, effective.method, 'request')
    return original.apply(this, arguments)
  }
  module.get = function (...args) { const req = module.request(...args); req.end(); return req }
}
module.exports = { httpAllowed }
