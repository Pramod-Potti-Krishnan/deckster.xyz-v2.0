// PASS2D B3a: the Add Element card gallery stays whole at narrow widths
// (flag NEXT_PUBLIC_STUDIO_ELEMENT_GALLERY_FIT, exact "true", default off).
// Offline and self-contained: no network, no git, no browser. The repo root is found from this file (package.json anchor).
// It loads the import-free helper (lib/studio-element-gallery-fit.ts) on its own, renders the REAL gallery component (components/studio-element-gallery.tsx)
// with the menu parts stubbed as host elements that keep their props, and parses the REAL stylesheet with postcss. Flag off is proven byte-identical to
// the base: the gallery's static markup (several item states) hashes to the value captured from the base file, and every stylesheet rule outside the new
// block hashes to the base stylesheet's. Then every suite re-runs against deliberately broken copies of the sources: each mutant must be caught.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'
import postcss from 'postcss'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const React = nodeRequire('react')
const jsxRuntime = nodeRequire('react/jsx-runtime')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')

const FLAG = 'NEXT_PUBLIC_STUDIO_ELEMENT_GALLERY_FIT'
const FILES = {
  lib: 'lib/studio-element-gallery-fit.ts',
  gallery: 'components/studio-element-gallery.tsx',
  css: 'components/studio-element-gallery.css',
}
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
const SRC = Object.fromEntries(Object.entries(FILES).map(([key, rel]) => [key, read(rel)]))
const ENVEX = read('.env.example')
const PKG = JSON.parse(read('package.json'))
const sha = text => crypto.createHash('sha256').update(text).digest('hex')

// Captured from the base files (origin/studio-v4-dev-preparation-code at 00921c0, before this change), flag unset.
const BASE = {
  // renderToStaticMarkup of <StudioElementGalleryMenu> for CASES below, each hashed in order
  markup: '992b8e1e4c503c93e2d10bc084f702e3fea4f13b3fa46511533bf3276bef8276',
  // components/studio-element-gallery.css, character for character
  css: '26c23d896029fef70ba9d15207c17d8c8a922dabc662af8234b28f48ad053210',
}
const FIT_MARK = '/* PASS2D B3a'

// PRINT_GOLDEN=1 BASE_ROOT=<a pristine base checkout> node scripts/test-studio-element-gallery-fit.mjs   re-prints the two base values above.
const GOLDEN_ROOT = process.env.PRINT_GOLDEN ? path.resolve(process.env.BASE_ROOT ?? repoRoot) : null

let checks = 0
const check = (fn, ...args) => { checks++; return fn(...args) }

// ---------------------------------------------------------------- loader: transpile-on-require, repo files only
const transpiled = new Map()
function compile(rel, source) {
  const key = `${rel}\0${source}`
  if (!transpiled.has(key)) {
    const out = ts.transpileModule(source, { fileName: rel, reportDiagnostics: true, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } })
    const errors = (out.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)
    assert.equal(errors.length, 0, `${rel} does not transpile: ${errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join('; ')}`)
    transpiled.set(key, out.outputText)
  }
  return transpiled.get(key)
}
/** A tiny module world: `src` overrides repo files (key: lib | gallery); the menu parts are host elements that keep every prop. */
function createWorld({ env = {}, src = {} } = {}) {
  const sources = { ...SRC, ...src }
  // Radix-only props (align, sideOffset, collisionPadding, textValue...) become data-x-* so they stay visible in the markup without React warnings.
  const DOM = /^(className|id|role|title|disabled|style|data-.*|aria-.*)$/
  const menuPart = tag => ({ children, ...props }) => React.createElement(tag, Object.fromEntries(Object.entries(props)
    .filter(([key]) => typeof props[key] !== 'function')
    .map(([key, value]) => DOM.test(key) ? [key, value] : [`data-x-${key.toLowerCase()}`, typeof value === 'object' ? JSON.stringify(value) : String(value)])), children)
  const cache = new Map()
  const stubs = {
    react: React,
    'react/jsx-runtime': jsxRuntime,
    '@/components/ui/dropdown-menu': { DropdownMenuContent: menuPart('div'), DropdownMenuItem: menuPart('button'), DropdownMenuLabel: menuPart('span') },
  }
  function load(rel, source) {
    if (cache.has(rel)) return cache.get(rel).exports
    const module = { exports: {} }
    cache.set(rel, module)
    const require = spec => {
      if (spec in stubs) return stubs[spec]
      if (spec.endsWith('.css')) return {}
      if (spec === '@/lib/studio-element-gallery-fit') return load(FILES.lib, sources.lib)
      throw new Error(`unexpected import ${spec} from ${rel}`)
    }
    new Function('module', 'exports', 'require', 'process', compile(rel, source))(module, module.exports, require, { env })
    return module.exports
  }
  return { lib: () => load(FILES.lib, sources.lib), gallery: () => load(FILES.gallery, sources.gallery) }
}

// ---------------------------------------------------------------- the gallery states the identity proof renders
const NINE = ['Text Box', 'Image', 'Chart', 'Metrics', 'Table', 'Diagram', 'Infographic', 'Icon / Label', 'Shape']
const Icon = () => null
const items = (labels, disabled = []) => labels.map(label => ({ label, icon: Icon, disabled: disabled.includes(label), action: () => undefined }))
const CASES = [
  { name: 'nine cards, all enabled', props: { items: items(NINE) } },
  { name: 'nine cards, two disabled, reason shown', props: { items: items(NINE, ['Chart', 'Shape']), disabledReason: 'Loading the slide…' } },
  { name: 'an unknown label keeps its place after the known ones', props: { items: items([...NINE, 'Quote']) } },
  { name: 'none disabled, a reason given', props: { items: items(NINE), disabledReason: 'Not available right now.' } },
]
const markupFor = (world, props) => renderToStaticMarkup(React.createElement(world.gallery().StudioElementGalleryMenu, props))
const contentProps = (world, props) => {
  const found = []
  const walk = node => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) { node.forEach(walk); return }
    if (node.props?.['data-studio-authoring-menu'] === 'add-element') found.push(node.props)
    walk(node.props?.children)
  }
  // expand function components one level: StudioElementGalleryMenu returns the Content element
  walk(world.gallery().StudioElementGalleryMenu(props))
  assert.equal(found.length, 1, 'one menu content')
  const { children, ...rest } = found[0]
  return rest
}
const BASE_CONTENT_PROPS = { 'data-studio-authoring-menu': 'add-element', 'data-studio-element-gallery': 'true', align: 'start', sideOffset: 8, className: 'p-1' }

// ---------------------------------------------------------------- css: the real stylesheet, parsed
function cssParts(css) {
  const at = css.indexOf(FIT_MARK)
  return { base: at === -1 ? css : css.slice(0, at), fit: at === -1 ? '' : css.slice(at) }
}
const selectorsOf = css => { const out = []; postcss.parse(css).walkRules(rule => out.push({ selector: rule.selector, inMedia: rule.parent?.type === 'atrule' ? rule.parent.params : null, decls: Object.fromEntries(rule.nodes.filter(n => n.type === 'decl').map(n => [n.prop, n.value])) })); return out }

// ---------------------------------------------------------------- the suites (each takes overrides so the mutants can reuse them)
function suiteLib(src = {}) {
  for (const [value, expected] of [[undefined, false], ['', false], ['false', false], ['1', false], ['TRUE', false], ['True', false], [' true', false], ['true ', false], ['yes', false], ['true', true]]) {
    const env = value === undefined ? {} : { [FLAG]: value }
    const lib = createWorld({ env, src }).lib()
    check(assert.equal, lib.STUDIO_ELEMENT_GALLERY_FIT_ENABLED, expected, `flag ${JSON.stringify(value)}`)
  }
  const lib = createWorld({ src }).lib()
  check(assert.deepEqual, { ...lib.studioElementGalleryFitProps(false) }, {}, 'flag off adds nothing')
  check(assert.deepEqual, { ...lib.studioElementGalleryFitProps(true) }, { collisionPadding: { left: 12, right: 12 }, 'data-studio-element-gallery-fit': 'true' }, 'flag on adds exactly the side collision margin and the marker')
  check(assert.equal, lib.STUDIO_ELEMENT_GALLERY_FIT_PADDING, 12)
  // pure: same answer every call, and no input mutated
  check(assert.deepEqual, { ...lib.studioElementGalleryFitProps(true) }, { ...lib.studioElementGalleryFitProps(true) })
}
function suiteIdentity(src = {}) {
  for (const value of [undefined, '', 'false', '1', 'TRUE', 'true ']) {
    const env = value === undefined ? {} : { [FLAG]: value }
    const world = createWorld({ env, src })
    for (const { name, props } of CASES) {
      check(assert.deepEqual, contentProps(world, props), BASE_CONTENT_PROPS, `flag ${JSON.stringify(value)} ${name}: the menu content gets exactly the props it always had`)
    }
    const hashes = CASES.map(({ props }) => sha(markupFor(world, props)))
    check(assert.equal, sha(hashes.join('\n')), BASE.markup, `flag ${JSON.stringify(value)}: the gallery's static markup is the base's, in every state`)
  }
}
function suiteOn(src = {}) {
  const world = createWorld({ env: { [FLAG]: 'true' }, src })
  for (const { name, props } of CASES) {
    check(assert.deepEqual, contentProps(world, props), { ...BASE_CONTENT_PROPS, collisionPadding: { left: 12, right: 12 }, 'data-studio-element-gallery-fit': 'true' }, `${name}: flag on adds the side collision margin and the marker, nothing else`)
    const on = markupFor(world, props)
    check(assert.match, on, /data-studio-element-gallery-fit="true"/, name)
    // the cards themselves are untouched: same markup once the marker is removed
    const off = markupFor(createWorld({ env: {}, src }), props)
    check(assert.equal, on.replace(' data-studio-element-gallery-fit="true"', '').replace(' data-x-collisionpadding="{&quot;left&quot;:12,&quot;right&quot;:12}"', ''), off, `${name}: only the content's attributes differ`)
  }
}
function suiteCss(src = {}) {
  const css = src.css ?? SRC.css
  const { base, fit } = cssParts(css)
  check(assert.notEqual, fit, '', 'the fit block exists')
  check(assert.equal, sha(base.trimEnd()), BASE.css, 'every rule outside the fit block is the base stylesheet, character for character')
  const rules = selectorsOf(fit)
  check(assert.ok, rules.length >= 5, 'the fit block has its rules')
  for (const { selector } of rules) {
    for (const part of selector.split(',')) check(assert.match, part, /\[data-studio-element-gallery-fit="true"\]/, `scoped to the marker: ${part.trim()}`)
  }
  const find = (sel, media) => rules.find(r => r.selector.includes(sel) && (media === undefined ? r.inMedia === null : r.inMedia === media))
  const room = find('data-studio-authoring-menu="add-element"', null)
  check(assert.ok, room, 'a sizing rule outside any media query')
  check(assert.match, room.decls['--seg-fit-room'], /var\(--radix-dropdown-menu-content-available-width/, 'sized from the room Radix reports')
  check(assert.match, room.decls['--seg-fit-room'], /calc\(100vw - 24px\)/, 'never past the viewport')
  check(assert.equal, room.decls.width, 'var(--seg-fit-room)')
  check(assert.equal, room.decls['max-width'], 'var(--seg-fit-room)')
  const narrow = rules.filter(r => r.inMedia === '(max-width: 480px)')
  check(assert.ok, narrow.length >= 4, 'the narrow block has its rules')
  check(assert.equal, narrow.find(r => !r.selector.includes('.seg-')).decls['grid-template-columns'], 'repeat(3, minmax(0, 1fr))', 'three columns at 480 px and below')
  check(assert.equal, narrow.find(r => r.selector.includes('.seg-desc')).decls.display, 'none', 'the description is dropped from view at 480 px and below')
  check(assert.match, narrow.find(r => r.selector.includes('.seg-art')).decls['aspect-ratio'], /5 \/ 2\.6/, 'compact illustration')
  // nothing in the fit block can reach the flag-off gallery: no selector without the marker, no :root / body / bare element rule
  check(assert.doesNotMatch, fit, /(^|[,{}]\s*)(:root|body|html|\*)\b/m)
}
function suiteWiring(src = {}) {
  check(assert.match, ENVEX, /^NEXT_PUBLIC_STUDIO_ELEMENT_GALLERY_FIT="false"$/m, 'documented in .env.example, default off')
  check(assert.equal, PKG.scripts['test:studio-element-gallery-fit'], 'node scripts/test-studio-element-gallery-fit.mjs', 'npm script registered')
  const gallery = src.gallery ?? SRC.gallery
  check(assert.doesNotMatch, gallery, /process\.env/, 'the gallery component reads no environment; the flag is read in the helper')
  const lib = src.lib ?? SRC.lib
  check(assert.equal, (lib.match(new RegExp(FLAG, 'g')) ?? []).length >= 1, true)
  check(assert.doesNotMatch, lib, /^import\s/m, 'the helper has no imports')
  const readers = []
  for (const rel of ['components', 'lib', 'hooks', 'app']) {
    const walk = dir => { for (const entry of fs.readdirSync(path.join(repoRoot, dir), { withFileTypes: true })) {
      const next = path.posix.join(dir, entry.name)
      if (entry.isDirectory()) walk(next)
      else if (/\.(ts|tsx)$/.test(entry.name) && fs.readFileSync(path.join(repoRoot, next), 'utf8').includes(`process.env.${FLAG}`)) readers.push(next)
    } }
    walk(rel)
  }
  check(assert.deepEqual, readers, [FILES.lib], 'the flag is read in exactly one file')
  check(assert.match, gallery, /\.\.\.studioElementGalleryFitProps\(STUDIO_ELEMENT_GALLERY_FIT_ENABLED\)/, 'the gallery spreads the helper onto the menu content')
}
const SUITES = { lib: suiteLib, identity: suiteIdentity, on: suiteOn, css: suiteCss, wiring: suiteWiring }

if (GOLDEN_ROOT) {
  const baseGallery = fs.readFileSync(path.join(GOLDEN_ROOT, FILES.gallery), 'utf8')
  const baseCss = fs.readFileSync(path.join(GOLDEN_ROOT, FILES.css), 'utf8')
  const world = createWorld({ env: {}, src: { gallery: baseGallery } })
  console.log(JSON.stringify({ markup: sha(CASES.map(({ props }) => sha(markupFor(world, props))).join('\n')), css: sha(cssParts(baseCss).base.trimEnd()) }, null, 2))
  process.exit(0)
}

// ---------------------------------------------------------------- run on the real sources
for (const [name, suite] of Object.entries(SUITES)) {
  suite()
  console.log(`ok   ${name}`)
}

// ---------------------------------------------------------------- mutants: each broken copy must fail at least one suite
const replaceOnce = (source, from, to) => { assert.ok(source.includes(from), `mutant anchor missing: ${from}`); return source.replace(from, to) }
const MUTANTS = [
  ['flag parse accepts any truthy value', { lib: s => replaceOnce(s, "process.env.NEXT_PUBLIC_STUDIO_ELEMENT_GALLERY_FIT === 'true'", "!!process.env.NEXT_PUBLIC_STUDIO_ELEMENT_GALLERY_FIT") }],
  ['flag parse is case-insensitive', { lib: s => replaceOnce(s, "process.env.NEXT_PUBLIC_STUDIO_ELEMENT_GALLERY_FIT === 'true'", "String(process.env.NEXT_PUBLIC_STUDIO_ELEMENT_GALLERY_FIT).toLowerCase() === 'true'") }],
  ['helper adds the props even with the flag off', { lib: s => replaceOnce(s, 'return enabled ? {', 'return true ? {') }],
  ['helper drops the marker when on', { lib: s => replaceOnce(s, ", 'data-studio-element-gallery-fit': 'true' }", ' }') }],
  ['helper drops the collision margin when on', { lib: s => replaceOnce(s, 'collisionPadding: { left: STUDIO_ELEMENT_GALLERY_FIT_PADDING, right: STUDIO_ELEMENT_GALLERY_FIT_PADDING }, ', '') }],
  ['helper pads top and bottom too (shrinks the room at ~600 px tall viewports)', { lib: s => replaceOnce(s, 'collisionPadding: { left: STUDIO_ELEMENT_GALLERY_FIT_PADDING, right: STUDIO_ELEMENT_GALLERY_FIT_PADDING }', 'collisionPadding: STUDIO_ELEMENT_GALLERY_FIT_PADDING') }],
  ['collision margin changed', { lib: s => replaceOnce(s, 'STUDIO_ELEMENT_GALLERY_FIT_PADDING = 12', 'STUDIO_ELEMENT_GALLERY_FIT_PADDING = 0') }],
  ['helper gains an import', { lib: s => `import fs from 'fs'\n${s}` }],
  ['gallery stops spreading the helper', { gallery: s => replaceOnce(s, '      {...studioElementGalleryFitProps(STUDIO_ELEMENT_GALLERY_FIT_ENABLED)}\n', '') }],
  ['gallery forces the flag on', { gallery: s => replaceOnce(s, 'studioElementGalleryFitProps(STUDIO_ELEMENT_GALLERY_FIT_ENABLED)', 'studioElementGalleryFitProps(true)') }],
  ['gallery reads the environment itself', { gallery: s => replaceOnce(s, 'const GALLERY_REASON_ID', "const FIT = process.env.NEXT_PUBLIC_STUDIO_ELEMENT_GALLERY_FIT\nconst GALLERY_REASON_ID") }],
  ['gallery changes a base attribute (sideOffset)', { gallery: s => replaceOnce(s, 'sideOffset={8}', 'sideOffset={9}') }],
  ['gallery changes a card (description id)', { gallery: s => replaceOnce(s, 'className="seg-card cursor-pointer"', 'className="seg-card cursor-default"') }],
  ['css: a fit rule loses its marker scope (leaks to the flag-off gallery)', { css: s => replaceOnce(s, '@media (max-width: 480px) {\n  [data-studio-authoring-menu][data-studio-element-gallery][data-studio-element-gallery-fit="true"] {\n    grid-template-columns: repeat(3', '@media (max-width: 480px) {\n  [data-studio-authoring-menu][data-studio-element-gallery] {\n    grid-template-columns: repeat(3') }],
  ['css: the description rule is unscoped', { css: s => replaceOnce(s, '[data-studio-element-gallery-fit="true"] .seg-desc { display: none; }', '.seg-desc { display: none; }') }],
  ['css: a base rule is edited', { css: s => replaceOnce(s, '[data-studio-authoring-menu="add-element"][data-studio-element-gallery="true"] { width: 448px; }', '[data-studio-authoring-menu="add-element"][data-studio-element-gallery="true"] { width: 440px; }') }],
  ['css: sizing ignores the room Radix reports', { css: s => replaceOnce(s, 'var(--radix-dropdown-menu-content-available-width, 448px), ', '') }],
  ['css: sizing may pass the viewport', { css: s => replaceOnce(s, ', calc(100vw - 24px));\n  width: var(--seg-fit-room)', ');\n  width: var(--seg-fit-room)') }],
  ['css: narrow layout stays at two columns', { css: s => replaceOnce(s, 'grid-template-columns: repeat(3, minmax(0, 1fr));\n    gap: 6px', 'grid-template-columns: repeat(2, minmax(0, 1fr));\n    gap: 6px') }],
  ['css: the description is kept at narrow widths', { css: s => replaceOnce(s, '.seg-desc { display: none; }', '.seg-desc { display: block; }') }],
  ['css: the fit block is removed', { css: s => s.slice(0, s.indexOf(FIT_MARK)) }],
]
let caught = 0
for (const [label, mutation] of MUTANTS) {
  const src = {}
  for (const [key, fn] of Object.entries(mutation)) src[key] = fn(SRC[key])
  let failedIn = null
  for (const [name, suite] of Object.entries(SUITES)) {
    try { suite(src) } catch { failedIn = name; break }
  }
  assert.ok(failedIn, `mutant NOT caught: ${label}`)
  caught++
  if (process.env.VERBOSE) console.log(`     caught by [${failedIn}]: ${label}`)
}
console.log(`ok   mutants: ${caught} of ${MUTANTS.length} caught`)
console.log(`PASS: studio element gallery fit (${checks} checks, ${MUTANTS.length} mutants)`)
