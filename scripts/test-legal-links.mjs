/**
 * CA-J1F10. Flag off, sign-in and sign-up render the same tree as the Studio base.
 * Flag on, the four legal links are /legal/terms and /legal/privacy.
 * Transpile + vm, the same shape as scripts/test-studio-native-theme-recovery.mjs.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const FLAG = 'NEXT_PUBLIC_LEGAL_LINKS_FIXED_ENABLED'
const root = new URL('..', import.meta.url)
const pages = ['app/auth/signin/page.tsx', 'app/auth/signup/page.tsx']
let passed = 0
const ok = (name) => { passed += 1; console.log(`ok ${passed} ${name}`) }

function jsx(type, props, key) {
  return { type, props: props || {}, key: key ?? null }
}

function componentModule() {
  return new Proxy({}, {
    get(_target, name) {
      function Stub(props) { return jsx(String(name), props) }
      Stub.displayName = String(name)
      return Stub
    },
  })
}

function compile(source, filename) {
  const result = ts.transpileModule(source, {
    fileName: filename,
    reportDiagnostics: true,
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  })
  const errors = (result.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error)
  assert.equal(errors.length, 0, `${filename} transpile errors: ${errors.length}`)
  return result.outputText
}

function load(source, filename) {
  const output = compile(source, filename)
  const mod = { exports: {} }
  const localRequire = (id) => {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' }
    if (id === 'react') {
      return {
        useState(init) { return [typeof init === 'function' ? init() : init, () => {}] },
        useEffect() {},
        Suspense: 'Suspense',
      }
    }
    if (id === 'next-auth/react') return { signIn() {}, useSession: () => ({ data: null, status: 'unauthenticated' }) }
    if (id === 'next/navigation') return { useRouter: () => ({ push() {} }), useSearchParams: () => ({ get: () => null }) }
    if (id === '@/lib/legal-links') return legal
    if (id === '@/lib/config') return { features: { couponAuthEnabled: false } }
    return componentModule()
  }
  vm.runInNewContext(output, {
    module: mod,
    exports: mod.exports,
    require: localRequire,
    process,
    console,
  }, { filename })
  return mod.exports
}

let legal = null
function loadLegal() {
  legal = load(fs.readFileSync(new URL('lib/legal-links.ts', root), 'utf8'), 'lib/legal-links.ts')
}

function withFlag(value, fn) {
  const previous = process.env[FLAG]
  if (value === undefined) delete process.env[FLAG]
  else process.env[FLAG] = value
  try { return fn() }
  finally {
    if (previous === undefined) delete process.env[FLAG]
    else process.env[FLAG] = previous
  }
}

function expand(node, depth = 0) {
  if (depth > 12 || node == null || typeof node !== 'object') return node
  if (Array.isArray(node)) return node.map((item) => expand(item, depth + 1))
  const type = node.type
  const props = node.props || {}
  if (typeof type === 'function') return expand(type(props), depth + 1)
  const out = { type: typeof type === 'string' ? type : (type.displayName || type.name || 'component'), props: {} }
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'function') out.props[key] = 'fn'
    else if (key === 'children') out.props[key] = expand(value, depth + 1)
    else out.props[key] = value
  }
  return out
}

function hrefs(node, found = []) {
  if (!node || typeof node !== 'object') return found
  if (Array.isArray(node)) { node.forEach((item) => hrefs(item, found)); return found }
  if (typeof node.props?.href === 'string') found.push(node.props.href)
  if (node.props?.children) hrefs(node.props.children, found)
  return found
}

function render(source, filename) {
  const page = load(source, filename)
  return expand(page.default())
}

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

loadLegal()
for (const value of [undefined, 'false', '0', '']) {
  withFlag(value, () => {
    assert.equal(legal.legalHref('terms'), '/terms')
    assert.equal(legal.legalHref('privacy'), '/privacy')
  })
  ok(`flag ${value === undefined ? 'unset' : JSON.stringify(value)} keeps /terms and /privacy`)
}

withFlag('true', () => {
  loadLegal()
  assert.equal(legal.LEGAL_LINKS_FIXED_ENABLED, true)
  assert.equal(legal.legalHref('terms'), '/legal/terms')
  assert.equal(legal.legalHref('privacy'), '/legal/privacy')
})
ok('flag "true" points at /legal/terms and /legal/privacy')

withFlag('false', () => {
  loadLegal()
  assert.equal(legal.LEGAL_LINKS_FIXED_ENABLED, false)
})
ok('constant is false unless the flag is the literal true')

for (const page of ['app/legal/terms/page.tsx', 'app/legal/privacy/page.tsx']) {
  assert.equal(fs.existsSync(new URL(page, root)), true, page)
  ok(`${page} exists`)
}

for (const page of pages) {
  const source = fs.readFileSync(new URL(page, root), 'utf8')
  assert.equal(source.includes('href="/terms"'), false, page)
  assert.equal(source.includes('href="/privacy"'), false, page)
  assert.equal(source.includes("legalHref('terms')"), true, page)
  assert.equal(source.includes("legalHref('privacy')"), true, page)
  ok(`${page} routes the four links through legalHref`)
}

for (const page of pages) {
  const base = execFileSync('git', ['show', `HEAD:${page}`], { cwd: root, encoding: 'utf8' })
  const branch = fs.readFileSync(new URL(page, root), 'utf8')
  const baseTree = withFlag(undefined, () => render(base, page))
  for (const value of [undefined, 'false', '0']) {
    const branchTree = withFlag(value, () => render(branch, page))
    const baseHash = hash(baseTree)
    const branchHash = hash(branchTree)
    assert.equal(branchHash, baseHash, `${page} flag ${value === undefined ? 'unset' : value}\nbase ${baseHash}\nbranch ${branchHash}`)
    ok(`${page} flag ${value === undefined ? 'unset' : value} tree ${branchHash.slice(0, 12)} matches base`)
  }
  const onTree = withFlag('true', () => render(branch, page))
  const links = hrefs(onTree)
  assert.deepEqual(links.filter((href) => href === '/legal/terms' || href === '/legal/privacy'), ['/legal/terms', '/legal/privacy'])
  assert.equal(links.includes('/terms'), false)
  assert.equal(links.includes('/privacy'), false)
  ok(`${page} flag on hrefs ${links.join(' ')}`)
}

console.log(`test:legal-links ${passed} passed`)
