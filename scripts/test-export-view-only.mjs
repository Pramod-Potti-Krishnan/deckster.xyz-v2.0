// CA-J2F2-VIEWONLY (Studio half): PDF/PPTX export requests carry `view_only: true`
// only when NEXT_PUBLIC_EXPORT_VIEW_ONLY_ENABLED is the literal "true".
// Run: pnpm test:export-view-only   (plain node: transpile + vm, no network, no Downloads call)
//
// Proves, on the REAL source of both export paths (lib/api/download-service.ts and
// app/api/publish/[slug]/download/[format]/route.ts), with fetch stubbed:
//   - flag off (unset, "false", "", "TRUE", "1"): the JSON request bodies are
//     byte-identical to the pinned literals (captured from the pre-change source 6d47cae);
//   - flag on ("true"): the same body plus a trailing `view_only: true`, nothing else.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const LIB = 'lib/export-view-only.ts'
const SERVICE = 'lib/api/download-service.ts'
const ROUTE = 'app/api/publish/[slug]/download/[format]/route.ts'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const compile = text => ts.transpileModule(text, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText

let testCount = 0
async function run(name, fn) {
  testCount += 1
  try {
    await fn()
  } catch (err) {
    console.error(`FAIL: ${name}`)
    throw err
  }
}

// One shared process.env for every module instance; tests flip the flag here.
const env = {}
const sandboxProcess = { env }
function setFlag(value) {
  if (value === undefined) delete env.NEXT_PUBLIC_EXPORT_VIEW_ONLY_ENABLED
  else env.NEXT_PUBLIC_EXPORT_VIEW_ONLY_ENABLED = value
}

function load(text, shims) {
  const module = { exports: {} }
  vm.runInNewContext(compile(text), {
    module,
    exports: module.exports,
    process: sandboxProcess,
    console,
    URL,
    require(id) {
      if (id in shims) return shims[id]
      throw new Error(`Unexpected dependency ${id}`)
    },
    ...(shims.__globals ?? {}),
  })
  return module.exports
}

const libSource = read(LIB)
const lib = load(libSource, {})

// ---- stubs shared by both export paths -----------------------------------------
const captured = []
const fetchStub = (url, init) => {
  captured.push({ url, init })
  return Promise.resolve({
    ok: true,
    body: {},
    blob: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  })
}
const browserGlobals = {
  fetch: fetchStub,
  window: { URL: { createObjectURL: () => 'blob:stub', revokeObjectURL() {} } },
  document: {
    body: { appendChild() {}, removeChild() {} },
    createElement: () => ({ click() {} }),
  },
}

const serviceUrlShim = { requireServiceUrl: () => 'https://downloads.test' }
function loadService(text, withLib) {
  return load(text, {
    '@/lib/service-url': serviceUrlShim,
    ...(withLib ? { '@/lib/export-view-only': lib } : {}),
    __globals: browserGlobals,
  })
}

class ServiceUrlConfigError extends Error {}
class NextResponse {
  constructor(body, init) { this.body = body; this.status = init?.status ?? 200; this.headers = init?.headers }
  static json(data, init) { return new NextResponse(data, init) }
}
const DECK = { slug: 's', title: 'My Deck', revokedAt: null, visibility: 'public', allowPdf: true, allowPptx: true, snapshotPresentationId: 'snap-9', slideCount: 7 }
function loadRoute(text, withLib, deck = DECK) {
  return load(text, {
    '@/lib/service-url': { ServiceUrlConfigError },
    'next/server': { NextRequest: class {}, NextResponse },
    'next/headers': { cookies: async () => ({ get: () => undefined }) },
    '@/lib/prisma': { prisma: { publishedDeck: { findUnique: async () => deck } } },
    '@/lib/publish/passcode': { unlockCookieName: () => 'c', verifyUnlockCookie: () => true },
    '@/lib/publish/service-urls': {
      getDownloadServiceUrl: () => 'https://downloads.test',
      getPublicLayoutBaseUrl: () => 'https://layout.test',
    },
    ...(withLib ? { '@/lib/export-view-only': lib } : {}),
    __globals: { fetch: fetchStub },
  })
}

async function serviceBodies(mod) {
  captured.length = 0
  await mod.downloadPDF('https://layout.test/p/abc123', 'medium')
  await mod.downloadPPTX('https://layout.test/p/abc123', 7)
  assert.equal(captured.length, 2)
  assert.equal(captured[0].url, 'https://downloads.test/convert/pdf')
  assert.equal(captured[1].url, 'https://downloads.test/convert/pptx')
  return { pdf: captured[0].init.body, pptx: captured[1].init.body }
}
async function routeBodies(mod, deck) {
  captured.length = 0
  for (const format of ['pdf', 'pptx']) {
    const res = await mod.GET({}, { params: Promise.resolve({ slug: 's', format }) })
    assert.equal(res.status, 200)
  }
  assert.equal(captured.length, 2)
  assert.equal(captured[0].url, 'https://downloads.test/convert/pdf')
  assert.equal(captured[1].url, 'https://downloads.test/convert/pptx')
  return { pdf: captured[0].init.body, pptx: captured[1].init.body }
}

// Pre-change bodies are pinned below (no git dependency: runs in shallow clones and CI).

// Pinned flag-off bodies (what the pre-change code sends today).
const PINNED = {
  servicePdf: '{"presentation_url":"https://layout.test/p/abc123","landscape":true,"print_background":true,"quality":"medium"}',
  servicePptx: '{"presentation_url":"https://layout.test/p/abc123","slide_count":7,"aspect_ratio":"16:9","quality":"high"}',
  routePdf: '{"presentation_url":"https://layout.test/p/snap-9","landscape":true,"print_background":true,"quality":"high"}',
  routePptx: '{"presentation_url":"https://layout.test/p/snap-9","slide_count":7,"aspect_ratio":"16:9","quality":"high"}',
}
const withViewOnly = json => JSON.stringify({ ...JSON.parse(json), view_only: true })

const OFF_VALUES = [undefined, 'false', '', 'TRUE', 'True', '1', 'yes', ' true']

// ---- the pure helper ------------------------------------------------------------
await run('lib/export-view-only.ts is import-free and reads the literal flag name', () => {
  assert.doesNotMatch(libSource.replace(/\/\/.*$/gm, ''), /^\s*(import|export\s+.*\sfrom)\s/m)
  assert.doesNotMatch(libSource, /require\(/)
  assert.match(libSource, /process\.env\.NEXT_PUBLIC_EXPORT_VIEW_ONLY_ENABLED === 'true'/)
})

await run('isExportViewOnlyEnabled: only the literal "true" turns it on', () => {
  for (const value of OFF_VALUES) {
    setFlag(value)
    assert.equal(lib.isExportViewOnlyEnabled(), false, `value ${JSON.stringify(value)} must be off`)
  }
  setFlag('true')
  assert.equal(lib.isExportViewOnlyEnabled(), true)
  setFlag(undefined)
})

await run('withExportViewOnly: off returns the same object, on appends view_only last without mutating', () => {
  const payload = { presentation_url: 'u', quality: 'high' }
  setFlag(undefined)
  assert.equal(lib.withExportViewOnly(payload), payload)
  assert.equal(JSON.stringify(lib.withExportViewOnly(payload)), JSON.stringify(payload))
  setFlag('true')
  const on = lib.withExportViewOnly(payload)
  assert.notEqual(on, payload)
  assert.equal(JSON.stringify(on), '{"presentation_url":"u","quality":"high","view_only":true}')
  assert.equal('view_only' in payload, false, 'input must not be mutated')
  setFlag(undefined)
})

// ---- lib/api/download-service.ts ------------------------------------------------
await run('download-service: flag off, bodies equal the pinned literals', async () => {
  const mod = loadService(read(SERVICE), true)
  for (const value of OFF_VALUES) {
    setFlag(value)
    const bodies = await serviceBodies(mod)
    assert.equal(bodies.pdf, PINNED.servicePdf, `pdf, flag ${JSON.stringify(value)}`)
    assert.equal(bodies.pptx, PINNED.servicePptx, `pptx, flag ${JSON.stringify(value)}`)
  }
  setFlag(undefined)
})

await run('download-service: flag on, PDF and PPTX add exactly view_only: true', async () => {
  const mod = loadService(read(SERVICE), true)
  setFlag('true')
  const bodies = await serviceBodies(mod)
  assert.equal(bodies.pdf, withViewOnly(PINNED.servicePdf))
  assert.equal(bodies.pptx, withViewOnly(PINNED.servicePptx))
  assert.equal(JSON.parse(bodies.pdf).view_only, true)
  assert.equal(JSON.parse(bodies.pptx).view_only, true)
  setFlag(undefined)
})

await run('download-service: request headers and method are unchanged by the flag', async () => {
  const mod = loadService(read(SERVICE), true)
  setFlag(undefined)
  await serviceBodies(mod)
  const off = captured.map(c => JSON.stringify([c.url, c.init.method, c.init.headers]))
  setFlag('true')
  await serviceBodies(mod)
  const on = captured.map(c => JSON.stringify([c.url, c.init.method, c.init.headers]))
  assert.deepEqual(on, off)
  setFlag(undefined)
})

// ---- app/api/publish/[slug]/download/[format]/route.ts --------------------------
await run('publish route: flag off, bodies equal the pinned literals', async () => {
  const mod = loadRoute(read(ROUTE), true)
  for (const value of OFF_VALUES) {
    setFlag(value)
    const bodies = await routeBodies(mod)
    assert.equal(bodies.pdf, PINNED.routePdf, `pdf, flag ${JSON.stringify(value)}`)
    assert.equal(bodies.pptx, PINNED.routePptx, `pptx, flag ${JSON.stringify(value)}`)
  }
  setFlag(undefined)
})

await run('publish route: flag on, PDF and PPTX add exactly view_only: true', async () => {
  const mod = loadRoute(read(ROUTE), true)
  setFlag('true')
  const bodies = await routeBodies(mod)
  assert.equal(bodies.pdf, withViewOnly(PINNED.routePdf))
  assert.equal(bodies.pptx, withViewOnly(PINNED.routePptx))
  setFlag(undefined)
})

await run('publish route: slide_count fallback (0 -> 1) and gating are untouched with the flag on', async () => {
  const empty = { ...DECK, slideCount: 0 }
  const mod = loadRoute(read(ROUTE), true, empty)
  setFlag('true')
  captured.length = 0
  await mod.GET({}, { params: Promise.resolve({ slug: 's', format: 'pptx' }) })
  assert.equal(JSON.parse(captured[0].init.body).slide_count, 1)
  // Disabled format still 403s before any request to Downloads is made.
  const noPdf = loadRoute(read(ROUTE), true, { ...DECK, allowPdf: false })
  captured.length = 0
  const res = await noPdf.GET({}, { params: Promise.resolve({ slug: 's', format: 'pdf' }) })
  assert.equal(res.status, 403)
  assert.equal(captured.length, 0)
  setFlag(undefined)
})

// ---- wiring ---------------------------------------------------------------------
await run('both export paths import the helper; types carry optional view_only', () => {
  const service = read(SERVICE)
  const route = read(ROUTE)
  assert.match(service, /import \{ withExportViewOnly \} from '@\/lib\/export-view-only'/)
  assert.match(route, /import \{ withExportViewOnly \} from '@\/lib\/export-view-only'/)
  assert.equal((service.match(/withExportViewOnly\(/g) || []).length, 2, 'PDF and PPTX')
  assert.equal((route.match(/withExportViewOnly\(/g) || []).length, 1, 'one payload object')
  assert.equal((service.match(/view_only\?: boolean/g) || []).length, 2, 'PDFConversionRequest and PPTXConversionRequest')
})

await run('flag is documented off in .env.example and the script is registered', () => {
  assert.match(read('.env.example'), /^NEXT_PUBLIC_EXPORT_VIEW_ONLY_ENABLED="false"$/m)
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.scripts['test:export-view-only'], 'node scripts/test-export-view-only.mjs')
})

console.log(`export-view-only: ${testCount} tests passed`)
