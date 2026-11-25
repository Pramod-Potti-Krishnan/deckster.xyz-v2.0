// PL-19 proof, offline ($0, no network, no build): the Vercel PREVIEW build mark is decided at BUILD time from VERCEL_ENV and changes nothing else.
//   A. next.config.mjs evaluated with each VERCEL_ENV: only exactly "preview" adds a webpack hook; every other value (unset, production, development, odd
//      spellings) adds NO key at all, and the rest of the config is identical across all values.
//   B. The preview hook adds ONE NormalModuleReplacementPlugin that matches exactly the specifier '@/components/ui/toaster' (not look-alikes, not a relative
//      './toaster') and points at the wrapper file that exists.
//   C. The wrapper: exact text, renders the real Toaster through a RELATIVE import (so it cannot be swapped into itself), fixed + click-through, inline styles,
//      reads no environment (the decision is the build's, not the browser's), exports `Toaster`.
//   D. Wiring: the root layout is the ONLY importer of the alias, and NO source file imports the wrapper (so a build without the swap never includes it).
//   E. MUTANTS are exercised by running this script against edited copies (see the PR body); each must fail A-D.
//   node scripts/test-studio-preview-build-mark.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG = path.join(ROOT, 'next.config.mjs')
const WRAPPER = path.join(ROOT, 'components/preview-build/preview-toaster.tsx')
let passed = 0
const check = (name, fn) => { fn(); passed++; console.log(`ok  ${name}`) }

async function loadConfig(env) {
  const saved = process.env.VERCEL_ENV
  if (env === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = env
  try { return (await import(`${pathToFileURL(CONFIG).href}?env=${encodeURIComponent(String(env))}&t=${Date.now()}${Math.random()}`)).default }
  finally { if (saved === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = saved }
}
const shape = async (config) => JSON.stringify({
  keys: Object.keys(config).filter((k) => k !== 'webpack').sort(),
  env: config.env, images: config.images, headers: await config.headers(), redirects: await config.redirects(),
})

const production = await loadConfig('production')
const preview = await loadConfig('preview')

// ---- A ----
for (const value of [undefined, 'production', 'development', '', 'Preview', 'PREVIEW', ' preview', 'preview ', 'previews', 'stg']) {
  const config = await loadConfig(value)
  check(`A: VERCEL_ENV=${JSON.stringify(value)} adds no webpack hook and no other key`, () => {
    assert.equal('webpack' in config, false)
    assert.deepEqual(Object.keys(config).sort(), Object.keys(production).sort())
  })
}
assert.equal(await shape(preview), await shape(production)); passed++; console.log('ok  A: everything except the webpack key is identical across production and preview')
check('A: exactly "preview" adds the one webpack hook', () => {
  assert.equal(typeof preview.webpack, 'function')
  assert.deepEqual(Object.keys(preview).filter((k) => !(k in production)), ['webpack'])
})

// ---- B ----
class FakePlugin { constructor(pattern, target) { this.pattern = pattern; this.target = target } }
const fakeWebpack = { NormalModuleReplacementPlugin: FakePlugin }
const after = preview.webpack({ plugins: ['existing'], other: 1 }, { webpack: fakeWebpack })
check('B: the hook keeps the existing config and adds exactly one replacement plugin', () => {
  assert.equal(after.other, 1); assert.equal(after.plugins[0], 'existing'); assert.equal(after.plugins.length, 2)
  assert.ok(after.plugins[1] instanceof FakePlugin)
})
const plugin = after.plugins[1]
check("B: it matches exactly '@/components/ui/toaster' and nothing near it", () => {
  assert.equal(plugin.pattern.test('@/components/ui/toaster'), true)
  for (const near of ['@/components/ui/toast', '@/components/ui/toaster-extra', '@/components/ui/toasters', './toaster', '../ui/toaster', 'components/ui/toaster', '@/components/ui/toaster/index', '@/components/preview-build/preview-toaster'])
    assert.equal(plugin.pattern.test(near), false, near)
})
check('B: it points at the wrapper file, which exists, by an absolute path', () => {
  assert.ok(path.isAbsolute(plugin.target)); assert.equal(plugin.target, WRAPPER); assert.ok(fs.existsSync(plugin.target))
})

// ---- C ----
const wrapperFull = fs.readFileSync(WRAPPER, 'utf8')
const wrapper = wrapperFull.replace(/^\s*\/\/.*$/gm, '')   // the code, without its explanatory comments (which quote the alias on purpose)
check('C: the exact mark text', () => { assert.ok(wrapper.includes("'Preview build: not the UAT product'")) })
check('C: it exports Toaster and renders the real one through a relative import (never the alias)', () => {
  assert.match(wrapper, /export function Toaster\(/)
  assert.match(wrapper, /import \{ Toaster as BaseToaster \} from '\.\.\/ui\/toaster'/)
  assert.equal(/from '@\/components\/ui\/toaster'/.test(wrapper), false)
  assert.match(wrapper, /<BaseToaster \/>/)
})
check('C: fixed, click-through, inline styles, one mark', () => {
  assert.match(wrapper, /position: 'fixed'/); assert.match(wrapper, /pointerEvents: 'none'/)
  assert.equal((wrapper.match(/data-studio-preview-build-mark="true"/g) || []).length, 1)
  assert.equal(/className|\.css|import .*\.css/.test(wrapper), false)
})
check('C: it reads no environment (the build decides, the browser does not)', () => {
  assert.equal(/process\.env|import\.meta\.env|window\.|document\./.test(wrapper), false)
})

// ---- D ----
function sourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git', 'proof', 'public'].includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) sourceFiles(full, out)
    else if (/\.(tsx?|jsx?|mjs)$/.test(entry.name)) out.push(full)
  }
  return out
}
const codeOf = (f) => fs.readFileSync(f, 'utf8').replace(/^\s*\/\/.*$/gm, '')
const files = [...sourceFiles(path.join(ROOT, 'app')), ...sourceFiles(path.join(ROOT, 'components')), ...sourceFiles(path.join(ROOT, 'lib')), ...sourceFiles(path.join(ROOT, 'hooks'))]
check("D: the root layout is the ONLY importer of '@/components/ui/toaster'", () => {
  const importers = files.filter((f) => /from\s+['"]@\/components\/ui\/toaster['"]/.test(codeOf(f))).map((f) => path.relative(ROOT, f))
  assert.deepEqual(importers, ['app/layout.tsx'])
})
check('D: no source file imports the wrapper (so a build without the swap never includes it)', () => {
  const importers = files.filter((f) => f !== WRAPPER && /preview-toaster/.test(codeOf(f))).map((f) => path.relative(ROOT, f))
  assert.deepEqual(importers, [])
})
check('D: the config names the wrapper only inside the preview-only branch', () => {
  const text = fs.readFileSync(CONFIG, 'utf8')
  const spread = text.indexOf('...(isVercelPreviewBuild')
  assert.ok(spread > 0)
  assert.equal(text.slice(spread).includes('NormalModuleReplacementPlugin'), true)
  assert.equal(text.slice(0, spread).includes('NormalModuleReplacementPlugin'), false)
})

console.log(`PASS ${passed} checks`)
