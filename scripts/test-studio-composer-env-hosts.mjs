// C-06 (pre-promotion): requireComposerServiceUrl approves each composer service's UAT host (unchanged), loopback over http (unchanged),
// and now the host of the app's own configured service URL (NEXT_PUBLIC_DIRECTOR_API_URL / NEXT_PUBLIC_WS_URL for Director,
// NEXT_PUBLIC_LAYOUT_SERVICE_URL for Layout, NEXT_PUBLIC_KNOWLEDGE_SERVICE_URL for the Researcher), so production works once its URLs are set.
// UAT behaviour is identical: with the UAT env (or no env) the accepted and refused sets are exactly the old function's. Plus mutants.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const REL = 'lib/composer-library.ts'
const BASE = process.env.PREPROMO_BASE || '3e1ce88eec23fbfd33f249332d06a65ad05ffc40'
const load = (source, env) => {
  const out = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  const ctx = { module, exports: module.exports, URL, require: n => { throw new Error('import ' + n) } }
  if (env) ctx.process = { env }
  vm.runInNewContext(out, ctx)
  return module.exports.requireComposerServiceUrl
}
const verdict = (fn, url, host) => { try { return fn(url, host) } catch { return 'REFUSED' } }

const D = 'directorv40-uat.up.railway.app', L = 'layout-builder-v75-uat.up.railway.app', R = 'researcher-v11-uat.up.railway.app'
const PROD = { D: 'directorv33-production.up.railway.app', L: 'web-production-f0d13.up.railway.app', R: 'researcher-v1.up.railway.app' }
const UAT_ENV = {
  NEXT_PUBLIC_DIRECTOR_API_URL: `https://${D}`, NEXT_PUBLIC_WS_URL: `wss://${D}/ws`,
  NEXT_PUBLIC_LAYOUT_SERVICE_URL: `https://${L}`, NEXT_PUBLIC_KNOWLEDGE_SERVICE_URL: `https://${R}`,
}
const PROD_ENV = {
  NEXT_PUBLIC_DIRECTOR_API_URL: `https://${PROD.D}`, NEXT_PUBLIC_WS_URL: `wss://${PROD.D}/ws`,
  NEXT_PUBLIC_LAYOUT_SERVICE_URL: `https://${PROD.L}`, NEXT_PUBLIC_KNOWLEDGE_SERVICE_URL: `https://${PROD.R}/`,
}
const hosts = [D, L, R]
const candidates = h => [
  `https://${h}`, `https://${h}/`, `http://${h}`, `https://${h}:8443`, `https://u:p@${h}`, `https://${h}/x`, `https://${h}?a=1`, `https://${h}#f`,
  `https://${h}.evil.example`, 'http://localhost:3000', 'http://127.0.0.1:8533/', 'https://localhost', 'https://unapproved.example',
  ...Object.values(PROD).flatMap(p => [`https://${p}`, `http://${p}`, `https://${p}:444`]),
]

async function prove(source) {
  let n = 0
  const base = load(execFileSync('git', ['show', `${BASE}:${REL}`], { encoding: 'utf8' }))
  // 1. UAT identical: no process at all (the older sandboxes), an empty env, and the UAT env give exactly the base's verdicts
  for (const env of [undefined, {}, UAT_ENV]) {
    const fn = load(source, env)
    for (const h of hosts) for (const url of candidates(h)) { assert.equal(verdict(fn, url, h), verdict(base, url, h), `UAT identical: ${url} for ${h} (${env ? Object.keys(env).length : 'no process'})`); n++ }
  }
  // 2. production: each service accepts its own production host, over https, no port, nothing else new
  const fn = load(source, PROD_ENV)
  const own = { [D]: PROD.D, [L]: PROD.L, [R]: PROD.R }
  for (const h of hosts) {
    for (const url of candidates(h)) {
      const accepted = verdict(fn, url, h) !== 'REFUSED'
      const expected = verdict(base, url, h) !== 'REFUSED' || url === `https://${own[h]}`
      assert.equal(accepted, expected, `prod: ${url} for ${h}`); n++
    }
    assert.equal(fn(`https://${own[h]}`, h), `https://${own[h]}`); n++
  }
  // the WebSocket URL alone approves Director's host
  assert.equal(load(source, { NEXT_PUBLIC_WS_URL: `wss://${PROD.D}/ws` })(`https://${PROD.D}`, D), `https://${PROD.D}`); n++
  // 3. a weak configured value approves nothing: http, ported, credentialed, not a URL; and a Layout env never approves Director
  for (const bad of [`http://${PROD.D}`, `https://${PROD.D}:444`, `https://u:p@${PROD.D}`, 'not a url']) {
    assert.equal(verdict(load(source, { NEXT_PUBLIC_DIRECTOR_API_URL: bad }), `https://${PROD.D}`, D), 'REFUSED', `weak env ${bad}`); n++
  }
  assert.equal(verdict(load(source, { NEXT_PUBLIC_LAYOUT_SERVICE_URL: `https://${PROD.D}` }), `https://${PROD.D}`, D), 'REFUSED'); n++
  assert.equal(verdict(load(source, { NEXT_PUBLIC_DIRECTOR_API_URL: `https://${PROD.L}` }), `https://${PROD.L}`, L), 'REFUSED'); n++
  // 4. the configured value is read when used
  const env = {}; const late = load(source, env)
  assert.equal(verdict(late, `https://${PROD.R}`, R), 'REFUSED'); env.NEXT_PUBLIC_KNOWLEDGE_SERVICE_URL = `https://${PROD.R}`
  assert.equal(late(`https://${PROD.R}`, R), `https://${PROD.R}`); n += 2
  return n
}

const source = fs.readFileSync(REL, 'utf8')
const checks = await prove(source)
const MUTANTS = [
  ['any env scheme', "(url.protocol === 'https:' || url.protocol === 'wss:') && !url.port", '!url.port'],
  ['ported env', "&& !url.port && !url.username", '&& !url.username'],
  ['env ignored', 'composerEnvHosts(uatHost).includes(url.hostname)', 'false'],
  ['env approves http', "approved && url.protocol === 'https:'", "approved && url.protocol !== 'ftp:'"],
  ['layout env for Director', "? [readEnv(() => process.env.NEXT_PUBLIC_DIRECTOR_API_URL), readEnv(() => process.env.NEXT_PUBLIC_WS_URL)]", "? [readEnv(() => process.env.NEXT_PUBLIC_DIRECTOR_API_URL), readEnv(() => process.env.NEXT_PUBLIC_WS_URL), readEnv(() => process.env.NEXT_PUBLIC_LAYOUT_SERVICE_URL)]"],
  ['WS url dropped', ', readEnv(() => process.env.NEXT_PUBLIC_WS_URL)]', ']'],
  ['UAT host dropped', 'url.hostname === uatHost ||', 'false ||'],
]
let killed = 0
for (const [name, from, to] of MUTANTS) {
  assert.ok(source.includes(from), `mutant applies: ${name}`)
  let survived = false
  try { await prove(source.replace(from, to)); survived = true } catch { killed++ }
  assert.ok(!survived, `mutant survived: ${name}`)
}
console.log(`composer env hosts: ${checks} checks passed, ${killed}/${MUTANTS.length} mutants killed`)
