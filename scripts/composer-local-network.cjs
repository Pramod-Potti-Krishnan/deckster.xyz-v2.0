// Extra local-process guard. No inherited provider credentials are needed.
const fs = require('node:fs')
const net = require('node:net')
const dns = require('node:dns')
const local = host => ['localhost', '127.0.0.1', '::1', '[::1]', undefined].includes(host)
// A new isolated R17 process opts in; running shared processes keep their guard.
const ports = process.env.COMPOSER_LOCAL_ROUND === 'r17'
  ? [9, 3017, 8504, 8505, 8507, 8519, 8520, 8521]
  : [9, 3006, 8504, 8505, 8507]
function check(host, port, kind) {
  const allowed = local(host) && ports.includes(Number(port))
  if (process.env.COMPOSER_NETWORK_LOG) fs.appendFileSync(process.env.COMPOSER_NETWORK_LOG, JSON.stringify({ time: new Date().toISOString(), kind, host, port, allowed }) + '\n')
  if (!allowed) throw new Error('COMPOSER_LOCAL_NETWORK_ONLY')
}
const connect = net.Socket.prototype.connect
net.Socket.prototype.connect = function (...args) {
  let options = Array.isArray(args[0]) ? args[0][0] : args[0]
  if (typeof options === 'object' && options.path) {
    if (!options.path.startsWith('/private/tmp/') && !options.path.startsWith('/var/folders/') && !options.path.startsWith('/private/var/folders/')) throw new Error('COMPOSER_LOCAL_SOCKET_ONLY')
  } else if (typeof options === 'object') check(options.host, options.port, 'socket')
  else check(typeof args[1] === 'string' ? args[1] : 'localhost', options, 'socket')
  return connect.apply(this, args)
}
const lookup = dns.lookup
dns.lookup = function (hostname, ...args) {
  if (!local(hostname)) throw new Error('COMPOSER_LOCAL_DNS_ONLY')
  return lookup.call(this, hostname, ...args)
}
const fetch = globalThis.fetch
if (fetch) globalThis.fetch = function (input, init) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
  check(url.hostname, url.port || (url.protocol === 'https:' ? 443 : 80), 'fetch')
  return fetch.call(this, input, init)
}
