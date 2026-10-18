// PASS2-PAGES Publish (flags NEXT_PUBLIC_STUDIO_P2_PUBLISH and NEXT_PUBLIC_STUDIO_P2_PUBLISH_INBOX, both exact "true" and Studio shell only, default off).
// Rows: PUB-01, PUB-02, PUB-06 (P1: recording default off, estimate + tick first), PUB-07, PUB-10, PUB-16, VIEW-07. VIEW-04 is a third-option row: not built.
// 1. Flag-off identity: stripping this change's listed text gives back the base commit's files byte for byte, and nothing else changed.
// 2. Every listed addition in a .ts/.tsx file is an import or names one of the two flags; every added CSS rule is scoped to markup only the flags render.
// 3. The real lib (bare vm) for every rule the rows depend on.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import { BASE_COMMIT, P2_FILES, stripP2Publish } from './studio-p2-publish-strip.mjs'

const root = new URL('..', import.meta.url)
const read = rel => fs.readFileSync(new URL(rel, root), 'utf8')
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
let checks = 0

// ---------------------------------------------------------------- 1. flag-off identity
let baseAvailable = true
try { git(['cat-file', '-e', `${BASE_COMMIT}^{commit}`]) } catch { baseAvailable = false }
const NEW_FILES = new Set(['lib/studio-p2-publish.ts', 'components/publish-p2.tsx', 'scripts/studio-p2-publish-strip.mjs', 'scripts/test-studio-p2-publish.mjs', 'package.json', '.env.example', 'scripts/test-studio-top-bar-v2.mjs'])
if (baseAvailable) {
  for (const rel of P2_FILES) {
    assert.equal(stripP2Publish(rel, read(rel)), git(['show', `${BASE_COMMIT}:${rel}`]), `${rel}: stripped == base`); checks++
  }
  const changed = git(['diff', '--name-only', BASE_COMMIT, '--']).split('\n').filter(Boolean).filter(rel => !rel.startsWith('docs/'))
  for (const rel of changed) {
    assert.ok(P2_FILES.includes(rel) || NEW_FILES.has(rel), `${rel} changed but is neither listed in the strip nor a new file of this change`); checks++
  }
  // package.json and .env.example only gain lines
  for (const rel of ['package.json', '.env.example']) {
    const diff = git(['diff', '--no-color', '-U0', BASE_COMMIT, '--', rel]).split('\n')
    const added = new Set(diff.filter(line => /^\+(?!\+\+)/.test(line)).map(line => line.slice(1).replace(/,$/, '')))
    // a JSON line that only gained its trailing comma is not a loss
    const removed = diff.filter(line => /^-(?!--)/.test(line)).filter(line => !added.has(line.slice(1).replace(/,$/, '')))
    assert.deepEqual(removed, [], `${rel} loses no line`); checks++
  }
} else console.log(`  SKIP base identity: ${BASE_COMMIT} is not in this clone`)

// ---------------------------------------------------------------- 2. every addition is gated
const stripSource = read('scripts/studio-p2-publish-strip.mjs')
const changesLiteral = stripSource.slice(stripSource.indexOf('const CHANGES = {') + 'const CHANGES = '.length, stripSource.indexOf('\n}\n', stripSource.indexOf('const CHANGES = {')) + 2)
const CHANGES = vm.runInNewContext(`(${changesLiteral})`)
// the flags, their import aliases, and p2Actions (null unless the inbox flag is on)
const FLAG = /STUDIO_P2_PUBLISH|STUDIO_P2_INBOX|p2Actions/
const P2_CLASSES = /\.studio-publish-(passcode|record-estimate|done-link|view-as-viewer)|\[data-studio-published-ask="true"\]|\.studio-qa-(unblock|remove-faq|in-faq)/
for (const [rel, pairs] of Object.entries(CHANGES)) {
  for (const [added, base] of pairs) {
    if (rel.endsWith('.css')) {
      assert.ok(added.startsWith(base), `${rel}: CSS change only appends`)
      const rules = added.slice(base.length).split('\n').filter(line => line.includes('{'))
      assert.ok(rules.length > 0, `${rel}: appended rules exist`)
      for (const rule of rules) assert.match(rule, P2_CLASSES, `${rel}: rule outside the flag-only markup: ${rule}`)
    } else {
      const extra = added.split('\n').filter(line => !base.split('\n').includes(line))
      // closing brackets of a flagged ternary opened in another listed change carry no behaviour
      // deck-qa-inbox's call() gains an optional `reverse`; undefined gives the base request (proved below), and only flag-gated rows pass it
      const ungated = extra.filter(line => line.trim() && !/^[\s)}\]>;,]*$/.test(line) && !/^import /.test(line.trim()) && !FLAG.test(line)
        && !(rel === 'components/deck-qa-inbox.tsx' && /\breverse\b/.test(line)))
      // multi-line JSX/ternaries: the block as a whole must name a flag
      assert.ok(ungated.length === 0 || FLAG.test(added), `${rel}: an addition names no flag:\n${ungated.join('\n')}`)
    }
    checks++
  }
}
// the inbox's optional `reverse`: absent, the request is the base one; present only in rows that exist with the inbox flag
{
  const inbox = read('components/deck-qa-inbox.tsx')
  assert.match(inbox, /fetch\(reverse\?\.url \?\? `\/api\/publish\/\$\{slug\}\/questions\/\$\{item\.id\}\$\{path\}`, \{\n\s+method: reverse \? 'DELETE' : 'POST',/)
  assert.match(inbox, /body: reverse \? undefined : JSON\.stringify\(body\),/)
  const passes = [...inbox.matchAll(/\{ url: `/g)].map(m => m.index)
  assert.equal(passes.length, 2, 'two callers pass reverse')
  for (const at of passes) assert.match(inbox.slice(Math.max(0, at - 400), at), /p2Actions\?\.(removeFromFaq|unblock)/, 'a reverse caller sits in a flag-only row')
  assert.match(inbox, /const p2Actions = STUDIO_P2_INBOX \? inboxRowActions\(item\) : null/)
  checks += 5
}
// the P1 row in plain words: recording starts off with the flag on, and on as before with it off
assert.match(read('components/publish-wizard.tsx'), /recordNarration: STUDIO_P2_PUBLISH \? false : true,/); checks++
// VIEW-04 (third option) is not in this change
assert.doesNotMatch(read('app/layout.tsx'), /StudioViewerThemeProvider|studio-p2-publish/); checks++
assert.ok(!fs.existsSync(new URL('components/studio-viewer-theme-provider.tsx', root)), 'no VIEW-04 provider'); checks++
assert.match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_P2_PUBLISH="false"$/m); checks++
assert.match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_P2_PUBLISH_INBOX="false"$/m); checks++

// ---------------------------------------------------------------- 3. the lib
function loadLib(env) {
  const compiled = ts.transpileModule(read('lib/studio-p2-publish.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  const module = { exports: {} }
  vm.runInNewContext(compiled.outputText, { module, exports: module.exports, process: { env }, URL })
  return module.exports
}
assert.equal(loadLib({}).STUDIO_P2_PUBLISH_ENABLED, false, 'default off')
assert.equal(loadLib({ NEXT_PUBLIC_STUDIO_P2_PUBLISH: 'true' }).STUDIO_P2_PUBLISH_ENABLED, false, 'needs the v4 shell')
assert.equal(loadLib({ NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_STUDIO_P2_PUBLISH: 'TRUE' }).STUDIO_P2_PUBLISH_ENABLED, false, 'exact "true"')
assert.equal(loadLib({ NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_STUDIO_P2_PUBLISH: 'true' }).STUDIO_P2_PUBLISH_ENABLED, true)
assert.equal(loadLib({ NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_STUDIO_P2_PUBLISH: 'true' }).STUDIO_P2_PUBLISH_INBOX_ENABLED, false, 'inbox has its own flag')
assert.equal(loadLib({ NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_STUDIO_P2_PUBLISH_INBOX: 'true' }).STUDIO_P2_PUBLISH_INBOX_ENABLED, true)
checks += 6
const lib = loadLib({ NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_STUDIO_P2_PUBLISH: 'true' })

// PUB-01
assert.equal(lib.audienceCopy('unlisted').title, 'Anyone with the link')
assert.equal(lib.audienceCopy('public').title, 'Anyone — listed publicly')
assert.equal(lib.audienceCopy('restricted').title, 'Only people with a passcode')
assert.equal(lib.audienceCopy('private'), null)
assert.equal(lib.audienceCopy(undefined), null)
checks += 5
// PUB-02
assert.equal(lib.PASSCODE_MIN_LENGTH, 6)
assert.equal(lib.passcodeShortBy(''), 0)
assert.equal(lib.passcodeShortBy('abc'), 3)
assert.equal(lib.passcodeShortBy('abcdef'), 0)
assert.equal(lib.passcodeCounter('abcde'), '1 more character needed')
assert.equal(lib.passcodeCounter('ab'), '4 more characters needed')
assert.equal(lib.passcodeCounter('abcdefg'), null)
assert.equal(lib.passcodeCounter(''), null)
checks += 8
// PUB-06 estimate
const est = lib.estimateRecording({ narrationMinutes: 5, compressedMinutes: 2 }, 0.15, 8)
assert.equal(est.minutes, 7.7)
assert.equal(est.cents, Math.ceil((5 + 2 + 0.67) * 0.15 * 100))
assert.equal(est.segments, 17)
assert.equal(lib.estimateRecording(null, 0.15, 8), null)
assert.equal(lib.estimateRecording({ narrationMinutes: 0, compressedMinutes: 0 }, 0.15, 8), null)
assert.equal(lib.estimateRecording({ narrationMinutes: 5, compressedMinutes: 2 }, Number.NaN, 8), null)
assert.equal(lib.estimateRecording({ narrationMinutes: 5, compressedMinutes: 2 }, 0.15, null).segments, null)
assert.equal(lib.estimateRecording({ narrationMinutes: 0.01, compressedMinutes: 0 }, 0, 1).cents, 1, 'never below 1¢')
checks += 8
assert.deepEqual({ ...lib.voiceRateFrom({ effectiveVoiceId: 'v2', voices: [{ id: 'v1', name: 'A', costPerMinuteUsd: 1 }, { id: 'v2', name: 'Alloy', costPerMinuteUsd: 0.12 }] }) }, { name: 'Alloy', costPerMinuteUsd: 0.12 })
assert.equal(lib.voiceRateFrom({ effectiveVoiceId: 'v9', voices: [] }), null)
assert.equal(lib.voiceRateFrom(null), null)
checks += 3
// PUB-06 / PUB-07 what publish may send
const base = { narrationEnabled: true, writeScript: true, recordNarration: true, recordConsentCents: null, other: 'kept' }
let out = lib.publishChoicesFor(base, false)
assert.equal(out.writeScript, false, 'no script without a session length')
assert.equal(out.recordNarration, false)
assert.equal(out.other, 'kept')
out = lib.publishChoicesFor(base, true)
assert.equal(out.writeScript, true)
assert.equal(out.recordNarration, false, 'no recording without the tick')
out = lib.publishChoicesFor({ ...base, recordConsentCents: 116 }, true)
assert.equal(out.recordNarration, true)
out = lib.publishChoicesFor({ ...base, recordConsentCents: 116, writeScript: false }, true)
assert.equal(out.recordNarration, false, 'no recording without a script')
out = lib.publishChoicesFor({ ...base, recordConsentCents: 116, narrationEnabled: false }, true)
assert.equal(out.writeScript, false)
assert.equal(out.recordNarration, false)
checks += 10
assert.equal(lib.recordingVerdict(116, { estimatedCents: 90 }).proceed, true)
assert.equal(lib.recordingVerdict(116, { estimatedCents: 116 }).proceed, true)
assert.equal(lib.recordingVerdict(116, { estimatedCents: 117 }).proceed, false)
assert.match(lib.recordingVerdict(116, { estimatedCents: 117 }).detail, /117¢, above the 116¢/)
assert.equal(lib.recordingVerdict(116, null).proceed, false)
assert.equal(lib.recordingVerdict(116, { error: 'x' }).proceed, false)
assert.equal(lib.recordingVerdict(null, { estimatedCents: 1 }).proceed, false)
checks += 7
// PUB-10 the done link stays on this environment
assert.equal(lib.publicUrlForThisOrigin('https://deckster.xyz/p/abc', 'https://deckster-studio-v4-dev.vercel.app'), 'https://deckster-studio-v4-dev.vercel.app/p/abc')
assert.equal(lib.publicUrlForThisOrigin('https://www.deckster.xyz/p/abc?x=1', 'http://localhost:3000'), 'http://localhost:3000/p/abc?x=1')
assert.equal(lib.publicUrlForThisOrigin('https://deckster.xyz/p/abc', 'https://deckster.xyz'), 'https://deckster.xyz/p/abc', 'production stays')
assert.equal(lib.publicUrlForThisOrigin('https://deckster-xyz-uat.vercel.app/p/abc', 'https://other.example'), 'https://deckster-xyz-uat.vercel.app/p/abc', 'a configured app URL stays')
assert.equal(lib.publicUrlForThisOrigin('not a url', 'http://localhost:3000'), 'not a url')
assert.equal(lib.publicUrlForThisOrigin('https://deckster.xyz/p/abc', 'null'), 'https://deckster.xyz/p/abc')
assert.equal(lib.publicUrlForThisOrigin('https://deckster.xyz/p/abc', undefined), 'https://deckster.xyz/p/abc')
checks += 7
// PUB-16
assert.deepEqual({ ...lib.inboxRowActions({ status: 'blocked' }) }, { unblock: true, removeFromFaq: false, publishToFaq: false, answer: false })
assert.deepEqual({ ...lib.inboxRowActions({ status: 'answered', faqItemId: 'f1' }) }, { unblock: false, removeFromFaq: true, publishToFaq: false, answer: true })
assert.deepEqual({ ...lib.inboxRowActions({ status: 'pending', faqItemId: '' }) }, { unblock: false, removeFromFaq: false, publishToFaq: true, answer: true })
assert.equal(lib.faqItemIdOf({ status: 'x', faqItemId: 7 }), null)
checks += 4
// the done link uses the origin rule
assert.match(read('components/publish-p2.tsx'), /setUrl\(publicUrlForThisOrigin\(recordUrl, window\.location\.origin\)\)/); checks++

console.log(`test-studio-p2-publish: ${checks} checks passed`)
