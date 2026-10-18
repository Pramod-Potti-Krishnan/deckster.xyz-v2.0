// PASS2-PAGES Account settings, rows ACC-04 (ink-slate primary actions) and ACC-17 (/shortcuts on the Studio tokens), flag NEXT_PUBLIC_STUDIO_P2_ACCOUNT
// (exact "true" + the literal Studio shell, default off). Fails on base: the lib, the CSS and the attributes do not exist there.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

const BASE_COMMIT = 'fbc77c0430099ec7e11a188307ee5521b6937719'
const root = new URL('..', import.meta.url)
const read = rel => fs.readFileSync(new URL(rel, root), 'utf8')
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
let checks = 0

function loadLib(env) {
  const compiled = ts.transpileModule(read('lib/studio-p2-account.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  const module = { exports: {} }
  vm.runInNewContext(compiled.outputText, { module, exports: module.exports, process: { env } })
  return module.exports
}
assert.equal(loadLib({}).STUDIO_P2_ACCOUNT_ENABLED, false, 'default off')
assert.equal(loadLib({ NEXT_PUBLIC_STUDIO_P2_ACCOUNT: 'true' }).STUDIO_P2_ACCOUNT_ENABLED, false, 'needs the shell')
assert.equal(loadLib({ NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_STUDIO_P2_ACCOUNT: '1' }).STUDIO_P2_ACCOUNT_ENABLED, false, 'exact "true"')
assert.equal(loadLib({ NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_STUDIO_P2_ACCOUNT: 'true' }).STUDIO_P2_ACCOUNT_ENABLED, true)
const lib = loadLib({})
assert.equal(lib.p2AccountAttr(true), 'true')
assert.equal(lib.p2AccountAttr(false), undefined, 'off: the attribute is absent, so the DOM is the base DOM')
checks += 6

// flag-off identity: the two pages only gain an import and an attribute whose value is p2AccountAttr(...)
const FILES = ['app/(app)/layout.tsx', 'app/(app)/shortcuts/page.tsx']
let baseAvailable = true
try { git(['cat-file', '-e', `${BASE_COMMIT}^{commit}`]) } catch { baseAvailable = false }
if (baseAvailable) {
  for (const rel of FILES) {
    const stripped = read(rel)
      .replace(/^import "@\/components\/settings\/studio-p2-account\.css"\n/m, '')
      .replace(/^import \{ p2AccountAttr, STUDIO_P2_ACCOUNT_ENABLED \} from "@\/lib\/studio-p2-account"\n/m, '')
      .replace(/ data-studio-(p2-account|shortcuts)=\{p2AccountAttr\(STUDIO_P2_ACCOUNT_ENABLED\)\}/g, '')
    assert.equal(stripped, git(['show', `${BASE_COMMIT}:${rel}`]), `${rel}: without the import(s) and the attribute it is the base file`)
    checks++
  }
  const changed = git(['diff', '--name-only', BASE_COMMIT, '--']).split('\n').filter(Boolean).filter(rel => !rel.startsWith('docs/'))
  const allowed = new Set([...FILES, 'lib/studio-p2-account.ts', 'components/settings/studio-p2-account.css', 'scripts/test-studio-p2-account.mjs', 'package.json', '.env.example'])
  for (const rel of changed) { assert.ok(allowed.has(rel), `${rel} is outside this change`); checks++ }
} else console.log(`  SKIP base identity: ${BASE_COMMIT} is not in this clone`)
assert.match(read('app/(app)/layout.tsx'), /data-studio-p2-account=\{p2AccountAttr\(STUDIO_P2_ACCOUNT_ENABLED\)\}/)
assert.match(read('app/(app)/shortcuts/page.tsx'), /<main data-studio-shortcuts=\{p2AccountAttr\(STUDIO_P2_ACCOUNT_ENABLED\)\}/)
checks += 2

// the CSS: every rule needs the flag-only frame attribute; ACC-04 uses the ink action token, not the accent
const css = read('components/settings/studio-p2-account.css').replace(/\/\*[\s\S]*?\*\//g, '')
const selectors = css.split('}').map(block => block.split('{')[0].trim()).filter(Boolean)
assert.ok(selectors.length >= 20)
const topLevel = group => { const out = []; let depth = 0, cur = ''; for (const ch of group) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { out.push(cur); cur = '' } else cur += ch } out.push(cur); return out }
for (const group of selectors) for (const sel of topLevel(group)) {
  assert.match(sel.trim(), /^\[data-studio-v4-shell="true"\]\[data-studio-p2-account="true"\] /, `rule outside the flag scope: ${sel}`); checks++
}
const acc04 = css.slice(0, css.indexOf('[data-studio-v4-shell="true"][data-studio-p2-account="true"] [data-studio-shortcuts="true"]'))
assert.match(acc04, /\[data-studio-settings-profile-save\]/)
assert.match(acc04, /\[data-studio-billing-plan-summary\] button/)
assert.match(acc04, /\[data-studio-billing-upgrade\] button/)
assert.match(acc04, /background: var\(--ss-action\); color: var\(--ss-on-action\)/)
assert.doesNotMatch(acc04, /--ss-accent/, 'ACC-04 never paints a primary action violet')
checks += 5
// ACC-17: rows have no hover fill (the base's near-white dark hover), key chips are outlined, and nothing is a literal colour
const acc17 = css.slice(css.indexOf('[data-studio-shortcuts="true"]'))
assert.match(acc17, /div\.justify-between:hover \{ background: transparent; \}/)
assert.match(acc17, /\.font-mono \{[^}]*border: 1px solid var\(--ss-line\)/)
assert.doesNotMatch(acc17.replace(/rgb\(|color-mix/g, ''), /#[0-9a-f]{3,6}\b/i, 'tokens only')
checks += 3
// the dark tokens the rules rely on exist (studio-shell.css)
const shell = read('components/layout/studio-shell.css')
for (const token of ['--ss-action', '--ss-action-hover', '--ss-on-action', '--ss-line', '--ss-panel', '--ss-surface', '--ss-field', '--ss-soft', '--ss-active', '--ss-teal', '--ss-muted', '--ss-text', '--ss-accent']) {
  assert.ok(shell.includes(`${token}:`), `${token} defined`); checks++
}
assert.match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_P2_ACCOUNT="false"$/m); checks++
console.log(`test-studio-p2-account: ${checks} checks passed`)
