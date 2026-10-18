// PASS2-PAGES Your details DET-03 (NEXT_PUBLIC_STUDIO_P2_DETAILS, exact "true" + literal Studio shell, default off). Fails on base (nothing here exists).
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import { BASE_COMMIT, CHANGES, FILE, stripP2Details } from './studio-p2-details-strip.mjs'

const root = new URL('..', import.meta.url)
const read = rel => fs.readFileSync(new URL(rel, root), 'utf8')
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
let checks = 0

let baseAvailable = true
try { git(['cat-file', '-e', `${BASE_COMMIT}^{commit}`]) } catch { baseAvailable = false }
if (baseAvailable) {
  assert.equal(stripP2Details(read(FILE)), git(['show', `${BASE_COMMIT}:${FILE}`]), `${FILE}: stripped == base`); checks++
  const allowed = new Set([FILE, 'lib/studio-p2-details.ts', 'scripts/studio-p2-details-strip.mjs', 'scripts/test-studio-p2-details.mjs', 'package.json', '.env.example'])
  for (const rel of git(['diff', '--name-only', BASE_COMMIT, '--']).split('\n').filter(Boolean).filter(rel => !rel.startsWith('docs/'))) { assert.ok(allowed.has(rel), `${rel} is outside this change`); checks++ }
} else console.log(`  SKIP base identity: ${BASE_COMMIT} is not in this clone`)
for (const [added, base] of CHANGES) {
  const extra = added.split('\n').filter(line => !base.split('\n').includes(line) && line.trim())
  // inside one chunk: a line names the flag, is an import, or is part of a chunk opened by `p2Details ? <>` (the flag's own JSX branch)
  const ungated = extra.filter(line => !/^import /.test(line) && !/p2Details|p2Fields|p2LogoUrl|DET-03/.test(line) && !added.includes('{p2Details ? <>')
    // the closing brace of that ternary, on the base line it follows
    && !base.split('\n').includes(line.replace(/\}$/, '')))
  assert.deepEqual(ungated, [], 'every addition is behind the flag'); checks++
}
// p2Fields only feeds flag branches: outside them it is never read
const source = read(FILE)
for (const line of source.split('\n').filter(l => /p2Fields\./.test(l))) {
  assert.ok(/p2Details/.test(line) || /<label className="sp-field/.test(line), `p2Fields read outside the flag: ${line.trim().slice(0, 120)}`); checks++
}

function loadLib(env) {
  const compiled = ts.transpileModule(read('lib/studio-p2-details.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  const module = { exports: {} }
  vm.runInNewContext(compiled.outputText, { module, exports: module.exports, process: { env }, URL })
  return module.exports
}
assert.equal(loadLib({}).STUDIO_P2_DETAILS_ENABLED, false)
assert.equal(loadLib({ NEXT_PUBLIC_STUDIO_P2_DETAILS: 'true' }).STUDIO_P2_DETAILS_ENABLED, false, 'needs the shell')
assert.equal(loadLib({ NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_STUDIO_P2_DETAILS: 'true' }).STUDIO_P2_DETAILS_ENABLED, true)
checks += 3
const lib = loadLib({})
assert.equal(lib.httpsLogoUrl('https://acme.com/logo.png'), 'https://acme.com/logo.png')
assert.equal(lib.httpsLogoUrl('  https://acme.com/a b.png '), 'https://acme.com/a%20b.png')
assert.equal(lib.httpsLogoUrl('http://acme.com/logo.png'), null, 'https only')
assert.equal(lib.httpsLogoUrl('javascript:alert(1)'), null)
assert.equal(lib.httpsLogoUrl('data:image/png;base64,AAAA'), null)
assert.equal(lib.httpsLogoUrl('https://user:pw@acme.com/x.png'), null, 'no credentials')
assert.equal(lib.httpsLogoUrl('/logo.png'), null, 'absolute only')
assert.equal(lib.httpsLogoUrl(''), null)
assert.equal(lib.logoUrlProblem(''), null)
assert.equal(lib.logoUrlProblem('https://acme.com/x.png'), null)
assert.match(lib.logoUrlProblem('acme.com/x.png'), /https:\/\//)
assert.equal(lib.websiteForSlide('https://acme.com/'), 'acme.com')
assert.equal(lib.websiteForSlide('HTTP://acme.com/team'), 'acme.com/team')
assert.equal(lib.contactLine(' a@b.co ', 'https://acme.com/'), 'a@b.co · acme.com')
assert.equal(lib.contactLine('', 'acme.com'), 'acme.com')
assert.equal(lib.contactLine('', ''), '')
checks += 16
// the logo image is only ever the validated URL
assert.match(source, /p2Details && !logo && p2LogoUrl && <img key=\{p2LogoUrl\} src=\{p2LogoUrl\}/); checks++
assert.match(source, /const p2LogoUrl = p2Details \? httpsLogoUrl\(p2Fields\.logoUrl\) : null/); checks++
assert.match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_P2_DETAILS="false"$/m); checks++
console.log(`test-studio-p2-details: ${checks} checks passed`)
