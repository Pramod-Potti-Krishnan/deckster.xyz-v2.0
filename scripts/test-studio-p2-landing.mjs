// PASS2-PAGES Landing LAND-01 (NEXT_PUBLIC_STUDIO_P2_LANDING, exact "true", default off). Fails on base (nothing here exists).
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

const BASE_COMMIT = 'fbc77c0430099ec7e11a188307ee5521b6937719'
const root = new URL('..', import.meta.url)
const read = rel => fs.readFileSync(new URL(rel, root), 'utf8')
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
let checks = 0
function loadLib(env) {
  const compiled = ts.transpileModule(read('lib/studio-p2-landing.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  const module = { exports: {} }
  vm.runInNewContext(compiled.outputText, { module, exports: module.exports, process: { env } })
  return module.exports
}
assert.equal(loadLib({}).STUDIO_P2_LANDING_ENABLED, false)
assert.equal(loadLib({ NEXT_PUBLIC_STUDIO_P2_LANDING: '1' }).STUDIO_P2_LANDING_ENABLED, false)
assert.equal(loadLib({ NEXT_PUBLIC_STUDIO_P2_LANDING: 'true' }).STUDIO_P2_LANDING_ENABLED, true)
const lib = loadLib({})
assert.equal(lib.MV3_NIGHT_CLASS, 'mv3-night')
const css = read('styles/marketing-v3.css')
const night = css.match(/--night:(#[0-9A-Fa-f]{6})/)[1]
assert.equal(lib.MV3_NIGHT.toLowerCase(), night.toLowerCase(), 'same colour as the .mv3 --night token')
assert.match(css, new RegExp(`^html\\.mv3-page\\.mv3-night\\{background:${night}\\}$`, 'm'), 'the rule needs the flag-only class')
checks += 6
// flag-off identity: without the tagged lines and the one rule, both files are the base files
let baseAvailable = true
try { git(['cat-file', '-e', `${BASE_COMMIT}^{commit}`]) } catch { baseAvailable = false }
if (baseAvailable) {
  const hook = read('hooks/use-v3-deck.ts').split('\n').filter(line => !line.includes('// LAND-01') && !line.includes('@/lib/studio-p2-landing')).join('\n')
  assert.equal(hook, git(['show', `${BASE_COMMIT}:hooks/use-v3-deck.ts`]))
  const baseCss = css.replace(/\/\* NEXT_PUBLIC_STUDIO_P2_LANDING \(LAND-01\)[^\n]*\n/, '').replace(/^html\.mv3-page\.mv3-night\{[^\n]*\n/m, '')
  assert.equal(baseCss, git(['show', `${BASE_COMMIT}:styles/marketing-v3.css`]))
  checks += 2
  for (const line of read('hooks/use-v3-deck.ts').split('\n').filter(l => l.includes('// LAND-01'))) { assert.match(line, /^\s+if \(STUDIO_P2_LANDING_ENABLED\) html\.classList\.(add|remove)\(MV3_NIGHT_CLASS\)/); checks++ }
}
assert.match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_P2_LANDING="false"$/m); checks++
console.log(`test-studio-p2-landing: ${checks} checks passed`)
