// PASS2 #6 (frontend-2): the Studio Add Element picker as a card gallery.
// Flag NEXT_PUBLIC_STUDIO_ELEMENT_GALLERY (exact "true"), default off. Flag off must render the picker exactly as the base did.
// Run: node scripts/test-studio-element-gallery.mjs   (plain node: transpile + vm, no network, no React runtime)
//   PRINT_GOLDEN=1 node scripts/test-studio-element-gallery.mjs   re-prints the flag-off hashes (run on a pristine base checkout).
//
// The proof is made on the REAL source: the Add Element <DropdownMenuPortal> JSX and the `addElementItems` / `studioElementGallery`
// declarations are cut out of components/presentation-viewer.tsx by AST and evaluated, so a later edit to the viewer is tested,
// not a copy of it.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import postcss from 'postcss'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const exists = file => fs.existsSync(path.join(root, file))
const VIEWER = 'components/presentation-viewer.tsx'
const GALLERY = 'components/studio-element-gallery.tsx'
const GALLERY_CSS = 'components/studio-element-gallery.css'
const FLAG = 'NEXT_PUBLIC_STUDIO_ELEMENT_GALLERY'

// ---- tiny JSX "runtime": elements become {type, props, children}; function components are expanded by `serialise` -------
const FRAGMENT = '__Fragment'
const jsx = (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) })
const JSX_OPTIONS = { jsx: ts.JsxEmit.React, jsxFactory: '__jsx', jsxFragmentFactory: FRAGMENT, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
function serialise(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(serialise).join('')
  if (typeof node.type === 'function') return serialise(node.type({ ...node.props, children: node.children }))
  if (node.type === FRAGMENT) return serialise(node.children)
  const attrs = Object.keys(node.props).sort().map(key => typeof node.props[key] === 'function' ? `${key}=<fn>` : `${key}=${JSON.stringify(node.props[key])}`)
  return `<${String(node.type)}${attrs.length ? ' ' + attrs.join(' ') : ''}>${serialise(node.children)}</${String(node.type)}>`
}
const textOf = node => {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (typeof node.type === 'function') return textOf(node.type({ ...node.props, children: node.children }))
  return textOf(node.children)
}
const walk = (node, visit) => {
  if (node === null || node === undefined || typeof node !== 'object') return
  if (Array.isArray(node)) { node.forEach(child => walk(child, visit)); return }
  visit(node)
  walk(node.type !== null && typeof node.type === 'function' ? node.type({ ...node.props, children: node.children }) : node.children, visit)
}
const sha = text => crypto.createHash('sha256').update(text).digest('hex')

// ---- cut real source out of the viewer ------------------------------------------------------------------------------
const viewerSource = ts.createSourceFile(VIEWER, read(VIEWER), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
function find(node, predicate) {
  if (predicate(node)) return node
  let match
  ts.forEachChild(node, child => { if (!match) match = find(child, predicate) })
  return match
}
const declaration = name => find(viewerSource, n => ts.isVariableDeclaration(n) && n.name.getText(viewerSource) === name)
const addItemsDeclaration = declaration('addElementItems')
assert.ok(addItemsDeclaration, 'addElementItems is declared in the viewer')
const galleryDeclaration = declaration('studioElementGallery')
const portalNode = find(viewerSource, n => ts.isJsxElement(n) && n.openingElement.tagName.getText(viewerSource) === 'DropdownMenuPortal' && n.getText(viewerSource).includes('"add-element"'))
assert.ok(portalNode, 'the Add Element <DropdownMenuPortal> is in the viewer')

// Evaluate one expression of the real source. Free capitalised names (icons, UI parts) resolve to name-only stubs; everything
// else must come from `scope`, or the run fails loudly.
function evaluate(expressionText, scope) {
  const js = ts.transpileModule(`(${expressionText});`, { compilerOptions: JSX_OPTIONS, fileName: 'expression.tsx' }).outputText
  const proxy = new Proxy(scope, {
    has: (target, key) => typeof key === 'string' && (key in target || (/^[A-Z]/.test(key) && !(key in globalThis))),
    get: (target, key) => key === Symbol.unscopables ? undefined : key in target ? target[key] : String(key),
  })
  return vm.runInNewContext(`with (__scope) { ${js} }`, { __scope: proxy, console })
}

// ---- the viewer's environment, with every handler recorded ------------------------------------------------------------
function makeEnvironment({ studioShell, isFullscreen, viewerIsReady, withPanel, env = {}, galleryMenu }) {
  const calls = []
  // JSON-normalised: arguments built inside the vm have another Object prototype than the host's.
  const record = name => (...args) => { calls.push(JSON.parse(JSON.stringify([name, ...args]))); return undefined }
  const scope = {
    __jsx: jsx, [FRAGMENT]: FRAGMENT, process: { env },
    studioShell, isFullscreen, viewerIsReady,
    onOpenGenerationPanel: withPanel ? record('onOpenGenerationPanel') : undefined,
    handleInsertTable: record('handleInsertTable'), handleInsertChart: record('handleInsertChart'), handleInsertTextBox: record('handleInsertTextBox'),
    handleInsertImage: record('handleInsertImage'), handleInsertInfographic: record('handleInsertInfographic'), handleInsertDiagram: record('handleInsertDiagram'),
    toolbarDropdownPortalContainer: null,
  }
  if (galleryMenu) scope.StudioElementGalleryMenu = galleryMenu
  scope.addElementItems = evaluate(addItemsDeclaration.initializer.getText(viewerSource), scope)
  // The flag declaration is new; the base has none (undefined = off), which keeps the base hashes capturable.
  scope.studioElementGallery = galleryDeclaration ? evaluate(galleryDeclaration.initializer.getText(viewerSource), scope) : undefined
  const render = () => evaluate(portalNode.getText(viewerSource), scope)
  return { scope, calls, render }
}

// ---- the gallery module, from its real source ------------------------------------------------------------------------
function loadGallery() {
  const js = ts.transpileModule(read(GALLERY), { compilerOptions: JSX_OPTIONS, fileName: GALLERY }).outputText
  const mod = { exports: {} }
  const stubs = {
    '@/components/ui/dropdown-menu': { DropdownMenuContent: 'DropdownMenuContent', DropdownMenuItem: 'DropdownMenuItem', DropdownMenuLabel: 'DropdownMenuLabel' },
  }
  const requireFn = id => {
    if (id in stubs) return stubs[id]
    if (id.endsWith('.css')) return {}
    throw new Error(`gallery imported an unexpected module: ${id}`)
  }
  vm.runInNewContext(js, { module: mod, exports: mod.exports, require: requireFn, __jsx: jsx, [FRAGMENT]: FRAGMENT, console })
  return mod.exports
}

// ---- the matrix the flag-off proof runs over -------------------------------------------------------------------------
const MATRIX = []
for (const studioShell of [false, true]) for (const isFullscreen of [false, true]) for (const viewerIsReady of [false, true]) for (const withPanel of [false, true]) {
  MATRIX.push({ name: `shell=${studioShell} fullscreen=${isFullscreen} ready=${viewerIsReady} panel=${withPanel}`, studioShell, isFullscreen, viewerIsReady, withPanel })
}

// Hashes of serialise(<Add Element portal>) for every cell of the matrix, captured from the base viewer
// (origin/studio-v4-dev-preparation-code at 68e3396, before this change) with the flag unset.
const BASE_HASHES = {
  'shell=false fullscreen=false ready=false panel=false': 'd60ace4e48f00074e7ec9d195649fed2b8f30325729c1740d81e29bb98474b11',
  'shell=false fullscreen=false ready=false panel=true': 'd60ace4e48f00074e7ec9d195649fed2b8f30325729c1740d81e29bb98474b11',
  'shell=false fullscreen=false ready=true panel=false': '4127c5febfcf30e02c444fb8446dd0c871dcd76cdfcfa03cec8f34f1981fbb1e',
  'shell=false fullscreen=false ready=true panel=true': 'b87ad8e6f0b7de55b65af01b8a92271324b2f4f1d31b39bec16490d4c15763bc',
  'shell=false fullscreen=true ready=false panel=false': 'd60ace4e48f00074e7ec9d195649fed2b8f30325729c1740d81e29bb98474b11',
  'shell=false fullscreen=true ready=false panel=true': 'd60ace4e48f00074e7ec9d195649fed2b8f30325729c1740d81e29bb98474b11',
  'shell=false fullscreen=true ready=true panel=false': '4127c5febfcf30e02c444fb8446dd0c871dcd76cdfcfa03cec8f34f1981fbb1e',
  'shell=false fullscreen=true ready=true panel=true': 'b87ad8e6f0b7de55b65af01b8a92271324b2f4f1d31b39bec16490d4c15763bc',
  'shell=true fullscreen=false ready=false panel=false': '314d8b8202d73693bdc4533ca1edb80cc917ea4d47297c55f2061c7b6e10016d',
  'shell=true fullscreen=false ready=false panel=true': '314d8b8202d73693bdc4533ca1edb80cc917ea4d47297c55f2061c7b6e10016d',
  'shell=true fullscreen=false ready=true panel=false': 'f4538f29f3826d1d697d4c6cc8c5c54b68aa51f39eae8114e9bb92a4c067b18d',
  'shell=true fullscreen=false ready=true panel=true': '5fd34be61754c54f906cde23b515fa67caa8ba1abaf3c24508fed53b920892cd',
  'shell=true fullscreen=true ready=false panel=false': '1632c55e5325fa3a38e8b1e19b8d7de7492fd8f1b3cd27b1a147b95151886501',
  'shell=true fullscreen=true ready=false panel=true': '1632c55e5325fa3a38e8b1e19b8d7de7492fd8f1b3cd27b1a147b95151886501',
  'shell=true fullscreen=true ready=true panel=false': '30b93f84e10779faa78a66d6b47bc25f92e5aca21fc490a4e26cb9f3b116d731',
  'shell=true fullscreen=true ready=true panel=true': '11bfab0429cd97e01945a5f8a040830df7b9a5e39bcf239ef8f8a2c320345047',
}

if (process.env.PRINT_GOLDEN) {
  const out = {}
  for (const cell of MATRIX) out[cell.name] = sha(serialise(makeEnvironment(cell).render()))
  console.log(JSON.stringify(out, null, 2))
  process.exit(0)
}

let testCount = 0
function run(name, fn) {
  testCount += 1
  try { fn() } catch (err) { console.error(`FAIL: ${name}`); throw err }
}

const gallery = loadGallery()
const { StudioElementGalleryMenu, orderElementGalleryItems, ELEMENT_GALLERY_ORDER } = gallery
const READY = { studioShell: true, isFullscreen: false, viewerIsReady: true, withPanel: true }

// ---- the flag ---------------------------------------------------------------------------------------------------------
run('the flag is read in the viewer as the exact string "true", only in the normal Studio viewer, and defaults off', () => {
  assert.match(read(VIEWER), /process\.env\.NEXT_PUBLIC_STUDIO_ELEMENT_GALLERY === 'true'/)
  assert.ok(galleryDeclaration, 'the viewer declares studioElementGallery')
  const expression = galleryDeclaration.initializer.getText(viewerSource)
  for (const [value, expected] of [[undefined, false], ['', false], ['false', false], ['1', false], ['TRUE', false], ['True', false], [' true', false], ['true ', false], ['true', true]]) {
    for (const { studioShell, isFullscreen } of MATRIX) {
      const env = value === undefined ? {} : { [FLAG]: value }
      const got = evaluate(expression, { process: { env }, studioShell, isFullscreen })
      assert.equal(got, expected && studioShell && !isFullscreen, `${JSON.stringify(value)} shell=${studioShell} fullscreen=${isFullscreen}`)
    }
  }
})

run('the flag is documented in .env.example, default "false", and has an npm script', () => {
  assert.match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_ELEMENT_GALLERY="false"$/m)
  assert.equal(JSON.parse(read('package.json')).scripts['test:studio-element-gallery'], 'node scripts/test-studio-element-gallery.mjs')
})

// ---- flag off is the base ---------------------------------------------------------------------------------------------
run('flag off (unset, "false", or any non-"true" value): the picker renders byte-for-byte as the base did, in every state', () => {
  for (const cell of MATRIX) {
    for (const value of [undefined, 'false', '1', 'TRUE', ' true', 'true ']) {
      const env = value === undefined ? {} : { [FLAG]: value }
      const hash = sha(serialise(makeEnvironment({ ...cell, env, galleryMenu: StudioElementGalleryMenu }).render()))
      assert.equal(hash, BASE_HASHES[cell.name], `${cell.name} flag=${JSON.stringify(value)}`)
    }
  }
})

run('flag on, but outside the normal Studio viewer (classic builder, or fullscreen): the picker is still the base dropdown', () => {
  for (const cell of MATRIX.filter(c => !c.studioShell || c.isFullscreen)) {
    const hash = sha(serialise(makeEnvironment({ ...cell, env: { [FLAG]: 'true' }, galleryMenu: StudioElementGalleryMenu }).render()))
    assert.equal(hash, BASE_HASHES[cell.name], cell.name)
  }
})

run('the base dropdown it falls back to is the one the viewer always had (w-52, icon + label rows, same markers)', () => {
  const html = serialise(makeEnvironment({ ...READY, studioShell: true, isFullscreen: false, env: {} }).render())
  assert.match(html, /data-studio-authoring-menu="add-element"/)
  assert.match(html, /className="w-52 p-1"/)
  assert.doesNotMatch(html, /data-studio-element-gallery/)
  assert.equal((html.match(/<DropdownMenuItem /g) || []).length, 9)
})

// ---- flag on: the gallery ---------------------------------------------------------------------------------------------
const galleryEnv = (overrides = {}) => makeEnvironment({ ...READY, env: { [FLAG]: 'true' }, galleryMenu: StudioElementGalleryMenu, ...overrides })
const galleryItemsOf = rendered => {
  const found = []
  walk(rendered, node => { if (node.type === 'DropdownMenuItem') found.push(node) })
  return found
}
const dropdownItemsOf = rendered => galleryItemsOf(rendered)
const MOCKUP_COPY = {
  'Text Box': 'Headlines & body copy', 'Image': 'An expressive visual', 'Chart': 'Make data meaningful', 'Metrics': 'The numbers that matter',
  'Table': 'Structured comparisons', 'Diagram': 'Connected ideas', 'Infographic': 'A visual story', 'Icon / Label': 'Symbol or text label', 'Shape': 'A building block',
}

run('flag on, normal Studio viewer: the viewer renders the gallery menu with its own addElementItems (same array, so same handlers)', () => {
  const env = galleryEnv()
  const portal = env.render()
  assert.equal(portal.type, 'DropdownMenuPortal')
  const [child] = portal.children
  assert.equal(child.type, StudioElementGalleryMenu)
  assert.equal(child.props.items, env.scope.addElementItems, 'the exact array the dropdown maps over')
})

run('the gallery keeps the same element types as the dropdown, and shows them in the mockup order', () => {
  const dropdown = dropdownItemsOf(makeEnvironment({ ...READY, env: {} }).render()).map(item => textOf(item).trim())
  const cards = galleryItemsOf(galleryEnv().render()).map(item => item.props['aria-label'])
  assert.deepEqual([...cards].sort(), [...dropdown].sort(), 'same nine labels')
  assert.equal(cards.length, 9)
  assert.deepEqual(cards, ['Text Box', 'Image', 'Chart', 'Metrics', 'Table', 'Diagram', 'Infographic', 'Icon / Label', 'Shape'])
  assert.deepEqual([...ELEMENT_GALLERY_ORDER], cards)
  assert.notDeepEqual(cards, dropdown, 'the dropdown order differed from the mockup; the gallery follows the mockup')
})

run('each card has an illustration, the name and the mockup one-line description; the name stays the accessible name', () => {
  const rendered = galleryEnv().render()
  const items = galleryItemsOf(rendered)
  for (const item of items) {
    const label = item.props['aria-label']
    const body = item.children.flat(Infinity)
    const art = body.find(node => node?.props?.className === 'seg-art')
    assert.ok(art, `${label}: art`)
    assert.equal(art.props['aria-hidden'], 'true', `${label}: art is decorative`)
    assert.equal(art.children.flat(Infinity)[0].type, 'svg', `${label}: an inline illustration`)
    assert.ok(art.children.flat(Infinity)[0].children.length > 0, `${label}: the illustration draws something`)
    const name = body.find(node => node?.props?.className === 'seg-name')
    assert.equal(textOf(name), label)
    const description = body.find(node => node?.props?.className === 'seg-desc')
    assert.equal(textOf(description), MOCKUP_COPY[label], `${label}: description`)
    assert.equal(item.props['aria-describedby'], description.props.id, `${label}: described by its line`)
    assert.equal(item.props.textValue, label, `${label}: typeahead text is the label, as before`)
    assert.equal(item.props['data-studio-element-card'], label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
  }
  assert.equal(new Set(items.map(item => item.props['aria-describedby'])).size, 9, 'description ids are unique')
  assert.ok(MOCKUP_COPY && Object.keys(MOCKUP_COPY).length === 9)
})

run('the menu root carries the Studio authoring markers, the gallery marker and no fixed w-52', () => {
  const menu = StudioElementGalleryMenu({ items: galleryEnv().scope.addElementItems })
  assert.equal(menu.type, 'DropdownMenuContent')
  assert.equal(menu.props['data-studio-authoring-menu'], 'add-element')
  assert.equal(menu.props['data-studio-element-gallery'], 'true')
  assert.equal(menu.props.align, 'start')
  assert.equal(menu.props.sideOffset, 8)
  assert.doesNotMatch(menu.props.className, /w-52/)
  assert.equal(menu.children.flat(Infinity)[0].type, 'DropdownMenuLabel')
})

run('same handlers: every card calls exactly what the dropdown row for that element called', () => {
  for (const withPanel of [true, false]) {
    for (const label of ELEMENT_GALLERY_ORDER) {
      const before = makeEnvironment({ ...READY, withPanel, env: {} })
      const dropdownRow = dropdownItemsOf(before.render()).find(item => textOf(item).trim() === label)
      dropdownRow.props.onClick()
      const after = galleryEnv({ withPanel })
      const card = galleryItemsOf(after.render()).find(item => item.props['aria-label'] === label)
      card.props.onClick()
      assert.deepEqual(after.calls, before.calls, `${label} panel=${withPanel}`)
      if (withPanel) assert.equal(after.calls.length, 1, `${label}: one call`)
    }
  }
})

run('the follow-on panel is opened with the same element types as before', () => {
  const opened = []
  const env = galleryEnv()
  for (const item of galleryItemsOf(env.render())) item.props.onClick()
  for (const call of env.calls) opened.push(call[1])
  assert.deepEqual(opened, ['TEXT_BOX', 'IMAGE', 'CHART', 'METRICS', 'TABLE', 'DIAGRAM', 'INFOGRAPHIC', 'ICON_LABEL', 'SHAPE'])
})

run('same disabled rules: not ready disables all; without the panel hook, Metrics / Icon / Shape are disabled, the rest fall back', () => {
  for (const viewerIsReady of [false, true]) for (const withPanel of [false, true]) {
    const before = dropdownItemsOf(makeEnvironment({ ...READY, viewerIsReady, withPanel, env: {} }).render())
    const after = galleryItemsOf(galleryEnv({ viewerIsReady, withPanel }).render())
    const wasDisabled = Object.fromEntries(before.map(item => [textOf(item).trim(), item.props.disabled]))
    const isDisabled = Object.fromEntries(after.map(item => [item.props['aria-label'], item.props.disabled]))
    assert.deepEqual(isDisabled, wasDisabled, `ready=${viewerIsReady} panel=${withPanel}`)
  }
  const noPanel = galleryItemsOf(galleryEnv({ withPanel: false }).render())
  assert.deepEqual(noPanel.filter(item => item.props.disabled).map(item => item.props['aria-label']).sort(), ['Icon / Label', 'Metrics', 'Shape'])
})

// ---- ordering --------------------------------------------------------------------------------------------------------
run('ordering is stable, keeps unknown labels after the known ones in their own order, and never mutates its input', () => {
  const input = [{ label: 'Zebra' }, { label: 'Shape' }, { label: 'Chart' }, { label: 'Alpha' }, { label: 'Text Box' }]
  const copy = JSON.stringify(input)
  const ordered = orderElementGalleryItems(input)
  assert.deepEqual(ordered.map(item => item.label), ['Text Box', 'Chart', 'Shape', 'Zebra', 'Alpha'])
  assert.equal(JSON.stringify(input), copy)
  assert.deepEqual(orderElementGalleryItems([]), [])
})

run('an element the gallery has no illustration for still renders as a plain labelled card (nothing is dropped)', () => {
  const items = [{ label: 'Quote', icon: 'QuoteIcon', disabled: false, action() {} }, ...galleryEnv().scope.addElementItems]
  const cards = galleryItemsOf(StudioElementGalleryMenu({ items }))
  assert.equal(cards.length, 10)
  const quote = cards.find(card => card.props['aria-label'] === 'Quote')
  assert.equal(quote.props['aria-describedby'], undefined)
  assert.equal(cards.at(-1), quote, 'unknown labels sit after the known ones')
})

// ---- scope: presentation only ------------------------------------------------------------------------------------------
run('the gallery module only imports the dropdown parts and its own stylesheet (no panel, no service, no state)', () => {
  const imports = [...read(GALLERY).matchAll(/^import .* from ["']([^"']+)["']|^import ["']([^"']+)["']/gm)].map(match => match[1] || match[2])
  assert.deepEqual(imports.sort(), ['./studio-element-gallery.css', '@/components/ui/dropdown-menu', 'lucide-react', 'react'].sort())
  assert.doesNotMatch(read(GALLERY), /fetch\(|useState|useEffect|onOpenGenerationPanel|process\.env/)
})

run('the viewer diff is the flag, one import and the ternary around the existing dropdown', () => {
  const source = read(VIEWER)
  assert.equal([...source.matchAll(/studioElementGallery/g)].length, 2, 'declared once, used once')
  assert.equal([...source.matchAll(/StudioElementGalleryMenu/g)].length, 2, 'imported once, used once')
  assert.match(source, /import \{ StudioElementGalleryMenu \} from '\.\/studio-element-gallery'/)
})

run('the stylesheet parses and every rule is scoped to the gallery marker (it cannot reach the other authoring menus)', () => {
  const css = read(GALLERY_CSS)
  const ast = postcss.parse(css)
  let rules = 0
  ast.walkRules(rule => {
    rules += 1
    for (const selector of rule.selectors) {
      const scoped = selector.includes('[data-studio-element-gallery')
      assert.ok(scoped, `unscoped selector: ${selector}`)
    }
  })
  assert.ok(rules > 20)
  // the picker's size only: nothing here sets a width on the generation panel or any other marker
  assert.doesNotMatch(css, /data-studio-(add-slide|generation|element-panel|v4-viewer|v4-thumbnails)/)
  assert.match(css, /\.dark \[data-studio-authoring-menu\]\[data-studio-element-gallery\]/, 'dark tokens')
})

console.log(`PASS: studio element gallery (${testCount} tests)`)
