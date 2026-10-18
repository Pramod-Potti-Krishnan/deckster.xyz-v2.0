// PASS2-PAGES Intelligence INT-03/04/07 (NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE, exact "true" + literal Studio shell, default off). Fails on base: the lib,
// the strip list and the edits do not exist there.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import { BASE_COMMIT, CHANGES, FILE, stripP2Intelligence } from './studio-p2-intelligence-strip.mjs'

const root = new URL('..', import.meta.url)
const read = rel => fs.readFileSync(new URL(rel, root), 'utf8')
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
let checks = 0

// 1. flag-off identity: the component without the listed text is the base file byte for byte; nothing else outside this change moved
let baseAvailable = true
try { git(['cat-file', '-e', `${BASE_COMMIT}^{commit}`]) } catch { baseAvailable = false }
if (baseAvailable) {
  assert.equal(stripP2Intelligence(read(FILE)), git(['show', `${BASE_COMMIT}:${FILE}`]), `${FILE}: stripped == base`); checks++
  const allowed = new Set([FILE, 'lib/studio-p2-intelligence.ts', 'components/studio-personal/studio-p2-intelligence.css', 'scripts/studio-p2-intelligence-strip.mjs', 'scripts/test-studio-p2-intelligence.mjs', 'package.json', '.env.example'])
  for (const rel of git(['diff', '--name-only', BASE_COMMIT, '--']).split('\n').filter(Boolean).filter(rel => !rel.startsWith('docs/'))) { assert.ok(allowed.has(rel), `${rel} is outside this change`); checks++ }
} else console.log(`  SKIP base identity: ${BASE_COMMIT} is not in this clone`)
// every listed addition is behind the flag (an import, the voice state, or text that names p2Int)
for (const [added, base] of CHANGES) {
  const extra = added.split('\n').filter(line => !base.split('\n').includes(line) && line.trim())
  // the base text moved into the else branch of a `p2Int ? … : base` in the same chunk is not new behaviour
  const ungated = extra.filter(line => !/^import /.test(line) && !/p2Int/.test(line)
    && !(added.includes('p2Int ?') && base.includes(line.trim().replace(/^: /, ''))))
  const voiceState = ungated.every(line => /voiceChoice|INT-03|setVoiceChoice/.test(line))
  const voiceRow = added.includes('function VoiceNarrationRow(') // only rendered as `p2Int ? <VoiceNarrationRow`
  assert.ok(ungated.length === 0 || voiceState || voiceRow, `ungated addition:\n${ungated.join('\n')}`); checks++
}
const source = read(FILE)
assert.match(source, /\{p2Int \? <VoiceNarrationRow /, 'the voice row renders only with the flag'); checks++
assert.equal((source.match(/<VoiceNarrationRow /g) ?? []).length, 1); checks++
assert.match(source, /\{!p2Int && <><button className="sp-button" type="button" disabled=\{!changed\}/, 'INT-07: the dead Apply button and the bottom reset exist only without the flag'); checks++
// the CSS matches only flag markup
const css = read('components/studio-personal/studio-p2-intelligence.css').replace(/\/\*[\s\S]*?\*\//g, '')
for (const line of css.split('\n').filter(l => l.includes('{') && !l.trim().startsWith('@media'))) { assert.match(line, /data-p2-int="true"|\.sp-p2-int-/, `rule outside the flag markup: ${line}`); checks++ }

// 2. the lib
function loadLib(env) {
  const compiled = ts.transpileModule(read('lib/studio-p2-intelligence.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  const module = { exports: {} }
  vm.runInNewContext(compiled.outputText, { module, exports: module.exports, process: { env } })
  return module.exports
}
assert.equal(loadLib({}).STUDIO_P2_INTELLIGENCE_ENABLED, false)
assert.equal(loadLib({ NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE: 'true' }).STUDIO_P2_INTELLIGENCE_ENABLED, false, 'needs the shell')
assert.equal(loadLib({ NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE: 'yes' }).STUDIO_P2_INTELLIGENCE_ENABLED, false)
assert.equal(loadLib({ NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE: 'true' }).STUDIO_P2_INTELLIGENCE_ENABLED, true)
checks += 4
const lib = loadLib({})
assert.equal(lib.recommendedOptionLabel('Gemini 3 Flash Preview'), 'Recommended — Gemini 3 Flash Preview')
assert.equal(lib.choiceOriginLabel(true), 'Recommended')
assert.equal(lib.choiceOriginLabel(false), 'Your choice')
assert.equal(lib.voiceProvider('fish-audio/s2.1-pro'), 'Fish Audio')
assert.equal(lib.voiceProvider('acme/x'), 'Narration service')
assert.equal(lib.voiceModelName('microsoft/mai-voice-2-flash'), 'MAI Voice 2 Flash')
assert.equal(lib.voiceModelName('acme/new-voice-9'), 'new-voice-9')
assert.equal(lib.voiceOptionLabel({ name: 'Ava', model: 'microsoft/mai-voice-2-flash' }), 'Ava · MAI Voice 2 Flash')
checks += 8
// every narration voice's model has a provider and a name here (a new model would otherwise show its raw id)
const voices = read('lib/narration/voices.ts')
for (const [, model] of voices.matchAll(/model: '([^']+)'/g)) {
  assert.notEqual(lib.voiceProvider(model), 'Narration service', `${model} provider`)
  assert.notEqual(lib.voiceModelName(model), model.split('/').pop(), `${model} display name`)
  checks += 2
}
assert.match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE="false"$/m); checks++
console.log(`test-studio-p2-intelligence: ${checks} checks passed`)
