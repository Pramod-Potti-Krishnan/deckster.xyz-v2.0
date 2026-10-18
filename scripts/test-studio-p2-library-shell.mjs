// PASS2-PAGES shared shell row INT-15 / DET-12 / SB-17 (NEXT_PUBLIC_STUDIO_P2_LIBRARY_SHELL, exact "true" + literal Studio shell, default off). Fails on base.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import { BASE_COMMIT, CHANGES, FILES, stripP2LibraryShell } from './studio-p2-library-shell-strip.mjs'

const root = new URL('..', import.meta.url)
const read = rel => fs.readFileSync(new URL(rel, root), 'utf8')
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
let checks = 0
let baseAvailable = true
try { git(['cat-file', '-e', `${BASE_COMMIT}^{commit}`]) } catch { baseAvailable = false }
if (baseAvailable) {
  for (const rel of FILES) { assert.equal(stripP2LibraryShell(rel, read(rel)), git(['show', `${BASE_COMMIT}:${rel}`]), `${rel}: stripped == base`); checks++ }
  const allowed = new Set([...FILES, 'lib/studio-p2-library-shell.ts', 'components/layout/studio-p2-library-shell.css', 'scripts/studio-p2-library-shell-strip.mjs', 'scripts/test-studio-p2-library-shell.mjs', 'package.json', '.env.example'])
  for (const rel of git(['diff', '--name-only', BASE_COMMIT, '--']).split('\n').filter(Boolean).filter(rel => !rel.startsWith('docs/'))) { assert.ok(allowed.has(rel), `${rel} is outside this change`); checks++ }
} else console.log(`  SKIP base identity: ${BASE_COMMIT} is not in this clone`)
for (const rel of FILES) for (const [added, base] of CHANGES[rel]) {
  const extra = added.split('\n').filter(line => !base.split('\n').includes(line) && line.trim())
  for (const line of extra) { assert.ok(/^import /.test(line) || /p2Shell/.test(line), `${rel}: ungated addition ${line}`); checks++ }
}
const css = read('components/layout/studio-p2-library-shell.css').replace(/\/\*[\s\S]*?\*\//g, '')
for (const line of css.split('\n').filter(l => l.includes('{'))) { assert.match(line, /data-studio-p2-new-deck="true"|data-studio-p2-shell="true"/, `rule outside the flag markup: ${line}`); checks++ }

function loadLib(env) {
  const compiled = ts.transpileModule(read('lib/studio-p2-library-shell.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  const module = { exports: {} }
  vm.runInNewContext(compiled.outputText, { module, exports: module.exports, process: { env } })
  return module.exports
}
assert.equal(loadLib({}).STUDIO_P2_LIBRARY_SHELL_ENABLED, false)
assert.equal(loadLib({ NEXT_PUBLIC_STUDIO_P2_LIBRARY_SHELL: 'true' }).STUDIO_P2_LIBRARY_SHELL_ENABLED, false, 'needs the shell')
assert.equal(loadLib({ NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_STUDIO_P2_LIBRARY_SHELL: 'true' }).STUDIO_P2_LIBRARY_SHELL_ENABLED, true)
checks += 3
const lib = loadLib({})
const paths = ['/dashboard', '/knowledge', '/studio/intelligence']
assert.equal(lib.showsNewPresentation(true, '/knowledge', paths), true)
assert.equal(lib.showsNewPresentation(true, '/settings/profile', paths), false, 'not on account pages')
assert.equal(lib.showsNewPresentation(false, '/knowledge', paths), false)
assert.equal(lib.showsNewPresentation(true, null, paths), false)
assert.equal(lib.NEW_PRESENTATION_HREF, '/builder?session_id=new')
assert.match(read('lib/studio-session-hygiene.ts'), /newPresentation: '\/builder\?session_id=new'/, 'the same URL Studio uses')
checks += 6
assert.match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_P2_LIBRARY_SHELL="false"$/m); checks++
console.log(`test-studio-p2-library-shell: ${checks} checks passed`)
