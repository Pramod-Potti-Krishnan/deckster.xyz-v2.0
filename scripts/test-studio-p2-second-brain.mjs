// PASS2-PAGES Second brain SB-08 (NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN, exact "true" + literal Studio shell, default off). Fails on base.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import { BASE_COMMIT, CHANGES, FILES, stripP2SecondBrain } from './studio-p2-second-brain-strip.mjs'

const root = new URL('..', import.meta.url)
const read = rel => fs.readFileSync(new URL(rel, root), 'utf8')
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
let checks = 0
let baseAvailable = true
try { git(['cat-file', '-e', `${BASE_COMMIT}^{commit}`]) } catch { baseAvailable = false }
if (baseAvailable) {
  for (const rel of FILES) { assert.equal(stripP2SecondBrain(rel, read(rel)), git(['show', `${BASE_COMMIT}:${rel}`]), `${rel}: stripped == base`); checks++ }
  const allowed = new Set([...FILES, 'lib/studio-p2-second-brain.ts', 'scripts/studio-p2-second-brain-strip.mjs', 'scripts/test-studio-p2-second-brain.mjs', 'package.json', '.env.example'])
  for (const rel of git(['diff', '--name-only', BASE_COMMIT, '--']).split('\n').filter(Boolean).filter(rel => !rel.startsWith('docs/'))) { assert.ok(allowed.has(rel), `${rel} is outside this change`); checks++ }
} else console.log(`  SKIP base identity: ${BASE_COMMIT} is not in this clone`)
// the TSX additions name the flag; the CSS additions only select the flag-only classes
for (const [added] of CHANGES['components/knowledge/studio-knowledge-inspector.tsx']) { assert.match(added, /p2Brain|^import /m); checks++ }
const [[cssAdded, cssBase]] = CHANGES['components/knowledge/studio-knowledge.css']
for (const line of cssAdded.slice(cssBase.length).split('\n').filter(l => l.includes('{'))) { assert.match(line, /\.ski-p2-(stats|rule)/, `rule outside the flag markup: ${line}`); checks++ }
assert.match(read('components/knowledge/studio-knowledge-inspector.tsx'), /\{p2Brain \? <><dl className="ski-p2-stats"/); checks++

function loadLib(env) {
  const compiled = ts.transpileModule(read('lib/studio-p2-second-brain.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  const module = { exports: {} }
  vm.runInNewContext(compiled.outputText, { module, exports: module.exports, process: { env } })
  return module.exports
}
assert.equal(loadLib({}).STUDIO_P2_SECOND_BRAIN_ENABLED, false)
assert.equal(loadLib({ NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN: 'true' }).STUDIO_P2_SECOND_BRAIN_ENABLED, false, 'needs the shell')
assert.equal(loadLib({ NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN: 'true' }).STUDIO_P2_SECOND_BRAIN_ENABLED, true)
checks += 3
const lib = loadLib({})
const plain = stats => stats.map(s => `${s.value} ${s.label}`).join(' | ')
assert.equal(plain(lib.inspectorStats(12, 3, 1)), '12 Mentions | 3 Evidence snippets | 1 Session')
assert.equal(plain(lib.inspectorStats(1, 1, 2)), '1 Mention | 1 Evidence snippet | 2 Sessions')
assert.equal(plain(lib.inspectorStats(undefined, null, Number.NaN)), '0 Mentions | 0 Evidence snippets | 0 Sessions')
assert.equal(plain(lib.inspectorStats(-4, 2.9, 1250)), '0 Mentions | 2 Evidence snippets | 1,250 Sessions')
assert.ok(!plain(lib.inspectorStats(1, 1, 1)).includes('%'), 'no coverage percentage')
checks += 5
assert.match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN="false"$/m); checks++
console.log(`test-studio-p2-second-brain: ${checks} checks passed`)
