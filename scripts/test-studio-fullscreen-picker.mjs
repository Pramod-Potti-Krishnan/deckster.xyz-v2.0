import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

// Actual JSX/handlers and typed wrapper; no browser, DOM replacement renderer,
// fullscreen API, insert request, timers or services are invoked by this witness.
const root = new URL('../', import.meta.url)
const baselineRevision = 'a29f749cc9951c07d93680fa05dada47c2199d67'
const read = file => fs.readFileSync(new URL(file, root), 'utf8')
const prior = file => execFileSync('git', ['show', `${baselineRevision}:${file}`], { cwd: root, encoding: 'utf8' })
const pickerFile = 'components/slide-layout-picker.tsx', wrapperFile = 'components/ui/popover.tsx'
const picker = read(pickerFile), wrapper = read(wrapperFile), oldPicker = prior(pickerFile), oldWrapper = prior(wrapperFile)
const jsx = (type, props, key) => ({ type, props: props ?? {}, ...(key === undefined ? {} : { key }) })
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : []
const text = tree => Array.isArray(tree) ? tree.map(text).join('') : tree == null || typeof tree === 'boolean' ? '' : typeof tree === 'object' ? text(tree.props?.children) : String(tree)
const compile = (source, file) => {
  const out = ts.transpileModule(source, { fileName: file, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } })
  assert.equal((out.diagnostics ?? []).filter(x => x.category === ts.DiagnosticCategory.Error).length, 0, file)
  return out.outputText
}
const refuse = () => assert.fail('No browser, timer, network or service operation is allowed')
const cn = (...values) => values.flat().filter(Boolean).join(' ')
function load(code, file, dependencies, globals = {}) {
  const mod = { exports: {} }
  vm.runInNewContext(compile(code, file), { module: mod, exports: mod.exports, fetch: refuse, setTimeout: refuse, ...globals, require: name => { assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name] } })
  return mod.exports
}
const definitions = load(read('types/elements.ts'), 'types/elements.ts', {})
const primitives = { Root: 'PopoverRoot', Trigger: 'PopoverTrigger', Portal: 'PopoverPortal', Content: 'PopoverDOMContent' }
function loadWrapper(code = wrapper) {
  return load(code, wrapperFile, { react: { forwardRef: fn => fn }, '@radix-ui/react-popover': primitives, '@/lib/utils': { cn }, 'react/jsx-runtime': { jsx, jsxs: jsx } })
}
function harness({ code = picker, wrapperCode = wrapper, flag = 'true', disabled = false, add = async () => {}, fullscreen = null } = {}) {
  const slots = [], writes = [], docReads = [], doc = { fullscreen }
  let index = 0, tree
  const react = {
    useState(initial) { const i = index++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { writes.push([i, value]); slots[i] = typeof value === 'function' ? value(slots[i]) : value }] },
    useMemo: fn => fn(), useRef: value => ({ current: value }),
  }
  const document = { get fullscreenElement() { docReads.push(doc.fullscreen); return doc.fullscreen } }
  const mod = load(code, pickerFile, {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx }, './studio-slide-layout-picker.css': {}, '@/components/ui/popover': loadWrapper(wrapperCode),
    'lucide-react': new Proxy({}, { get: (_target, name) => String(name) }), '@/lib/utils': { cn }, '@/types/elements': definitions,
  }, { document, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: flag === '__absent__' ? undefined : flag } } })
  const h = {
    doc, docReads, writes,
    render() { index = 0; tree = mod.SlideLayoutPicker({ onAddSlide: add, disabled, className: 'native-extra' }); return tree },
    open(value) { tree.props.onOpenChange(value); return h.render() },
    get tree() { return tree },
    get popup() { return nodes(tree).find(x => typeof x.type === 'function') },
    portal() { return h.popup.type(h.popup.props, null) },
    get trigger() { return nodes(tree).find(x => x.type === 'PopoverTrigger').props.children },
    get cards() { return nodes(tree).filter(x => x.type === 'button' && (x.props['aria-label']?.startsWith('Insert ') || x.props.title && typeof x.props.onClick === 'function')) },
  }
  h.render(); return h
}
// React omits false/null/undefined children. Normalize only those omissions in
// child arrays on both sides; retain meaningful nodes, text and false props.
const rendered = tree => JSON.stringify(tree, (key, value) => typeof value === 'function' ? key === 'type' ? value.displayName : undefined : key === 'children' && Array.isArray(value) ? value.filter(child => child !== false && child !== true && child !== null && child !== undefined) : value)
let checks = 0
async function check(label, fn) { await fn(); checks++; console.log(`PASS ${label}`) }
const A = { id: 'actual-fullscreen-A' }, B = { id: 'actual-fullscreen-B' }
await check('Baseline reproduces missing fullscreen owner: actual picker/wrapper portal remains body default', () => {
  const h = harness({ code: oldPicker, wrapperCode: oldWrapper, fullscreen: A }); h.open(true)
  assert.equal(h.tree.props.open, true); assert.equal(h.portal().props.container, undefined); assert.equal(h.docReads.length, 0)
  assert.throws(() => assert.equal(h.portal().props.container, A), assert.AssertionError)
})
for (const fullscreen of [A, null]) await check(`Studio opening captures exact current fullscreen element: ${fullscreen?.id ?? 'normal body'}`, () => {
  const h = harness({ fullscreen }); h.open(true)
  assert.equal(h.tree.props.open, true); assert.equal(h.popup.props.portalContainer, fullscreen); assert.equal(h.portal().props.container, fullscreen)
  assert.deepEqual(h.docReads, [fullscreen]); assert.equal(h.portal().props.children.props.portalContainer, undefined)
})
await check('Close clears portal owner without reading document; reopening captures new owner rather than cached fullscreen', () => {
  const h = harness({ fullscreen: A }); h.open(true); h.doc.fullscreen = B; h.open(false)
  assert.equal(h.tree.props.open, false); assert.equal(h.portal().props.container, null); assert.deepEqual(h.docReads, [A])
  h.open(true); assert.equal(h.portal().props.container, B); h.open(false); h.doc.fullscreen = null; h.open(true)
  assert.equal(h.portal().props.container, null); assert.deepEqual(h.docReads, [A, B, null])
})
await check('Native explicit Close callback still closes; fresh reopen recaptures fullscreen owner', () => {
  const h = harness({ fullscreen: A }); h.open(true)
  nodes(h.tree).find(x => x.props['aria-label'] === 'Close slide layouts').props.onClick(); h.render(); assert.equal(h.tree.props.open, false)
  h.doc.fullscreen = B; h.open(true); assert.equal(h.portal().props.container, B)
})
for (const outcome of ['resolve', 'reject']) await check(`Native insertion callback/layout identity and isAdding lifetime are preserved: ${outcome}`, async () => {
  let resolve, reject; const pending = new Promise((a,b) => { resolve = a; reject = b }), calls = []
  const h = harness({ fullscreen: A, add: id => { calls.push(id); return pending } }); h.open(true)
  const chosen = h.cards[0], expected = definitions.SLIDE_LAYOUTS[0].layout
  const task = chosen.props.onClick(); h.render()
  assert.deepEqual(calls, [expected]); assert.equal(h.tree.props.open, false); assert.equal(h.trigger.props.disabled, true)
  assert.match(text(h.tree), /Adding your slide/); assert.ok(h.cards.every(x => x.props.disabled))
  if (outcome === 'reject') { reject(new Error('Supplied insertion refusal')); await assert.rejects(task, /Supplied insertion refusal/) } else { resolve(); await task }
  h.render(); assert.equal(h.trigger.props.disabled, false); assert.ok(h.cards.every(x => !x.props.disabled)); assert.deepEqual(calls, [expected])
})
await check('All actual layout IDs/options, disabled gate and query/category behavior remain intact', () => {
  const h = harness({ disabled: true }); h.open(true)
  assert.equal(h.trigger.props.disabled, true); assert.equal(h.cards.length, definitions.SLIDE_LAYOUTS.length); assert.ok(h.cards.every(x => x.props.disabled))
  assert.deepEqual(h.cards.map(x => x.key).sort(), Array.from(definitions.SLIDE_LAYOUTS, x => x.layout).sort())
  for (const layout of definitions.SLIDE_LAYOUTS) assert.equal(h.cards.find(x => x.key === layout.layout).props.title, layout.description)
  const before = harness({ code: oldPicker, wrapperCode: oldWrapper, disabled: true }); before.open(true)
  const strip = tree => JSON.stringify(JSON.parse(rendered(tree)), (key, value) => key === 'portalContainer' ? undefined : value)
  assert.equal(strip(h.tree), rendered(before.tree))
  const input = nodes(h.tree).find(x => x.props['aria-label'] === 'Find a slide layout'); input.props.onChange({ target: { value: 'impossible-no-match' } }); h.render(); assert.equal(h.cards.length, 0); assert.match(text(h.tree), /No matching layouts/)
  nodes(h.tree).find(x => x.props['aria-label'] === 'Clear slide layout search').props.onClick(); h.render()
  const category = definitions.SLIDE_LAYOUT_CATEGORIES[1]
  nodes(h.tree).find(x => x.type === 'button' && text(x) === category.label).props.onClick(); h.render()
  assert.deepEqual(h.cards.map(x => x.key), Array.from(definitions.SLIDE_LAYOUTS.filter(x => x.category === category.category), x => x.layout))
})
for (const container of [undefined, null, A]) await check(`Shared wrapper sends optional container only to Portal: ${container?.id ?? String(container)}`, () => {
  const ref = {}, onEscapeKeyDown = refuse, props = { portalContainer: container, id: 'native-content', 'aria-label': 'Native popup', onEscapeKeyDown, align: 'end', sideOffset: 9, children: 'Native complete child', className: 'native-class' }
  const tree = loadWrapper().PopoverContent(props, ref), content = tree.props.children
  assert.equal(tree.type, primitives.Portal); assert.equal(tree.props.container, container); assert.equal(content.type, primitives.Content)
  assert.equal(Object.hasOwn(content.props, 'portalContainer'), false); assert.equal(Object.hasOwn(content.props, 'container'), false)
  assert.equal(content.props.ref, ref); assert.equal(content.props.onEscapeKeyDown, onEscapeKeyDown); assert.equal(content.props.align, 'end'); assert.equal(content.props.sideOffset, 9); assert.equal(content.props.children, props.children); assert.match(content.props.className, /native-class/)
})
await check('Omitted wrapper option preserves every native content/default prop against baseline', () => {
  const props = { children: 'Unchanged default child', id: 'same-native-id' }, before = loadWrapper(oldWrapper).PopoverContent(props, null), current = loadWrapper().PopoverContent(props, null)
  assert.equal(rendered(current), rendered(before)); assert.equal(current.props.container, undefined)
})
for (const flag of ['__absent__', '', 'false', 'TRUE', '1']) await check(`Classic/default-off keeps original setOpen/body portal/options/callback tree: ${flag}`, async () => {
  const calls = [[], []], a = harness({ flag, fullscreen: A, add: async id => calls[0].push(id) }), b = harness({ code: oldPicker, wrapperCode: oldWrapper, flag, fullscreen: A, add: async id => calls[1].push(id) })
  for (const value of [true, false, true]) { a.open(value); b.open(value); assert.equal(rendered(a.tree), rendered(b.tree)); assert.equal(rendered(a.portal()), rendered(b.portal())) }
  assert.equal(a.docReads.length, 0); assert.equal(a.portal().props.container, undefined)
  await a.cards[0].props.onClick(); await b.cards[0].props.onClick(); a.render(); b.render()
  assert.deepEqual(calls[0], calls[1]); assert.equal(rendered(a.tree), rendered(b.tree)); assert.equal(a.tree.props.open, false)
})
await check('Exact narrow source reversal retains all native handlers/options and shared wrapper defaults', () => {
  // Reverse only the reviewed optional Generate method seam; native layout,
  // fullscreen, state, gate and callback bytes remain under the original guard.
  let pickerWithoutMethod = picker
  for (const addition of ["  onGenerateSlide?: () => void\n", "  onGenerateSlide,\n", "        {onGenerateSlide && <nav className=\"slp-methods\" aria-label=\"New slide method\"><button type=\"button\" disabled={unavailable} onClick={() => { setOpen(false); onGenerateSlide() }}><Sparkles size={13} aria-hidden=\"true\" />Generate</button><button type=\"button\" aria-current=\"page\" onClick={() => searchInput.current?.focus()}><LayoutGrid size={13} aria-hidden=\"true\" />From a layout</button></nav>}\n"] ) {
    assert.equal(pickerWithoutMethod.split(addition).length, 2)
    pickerWithoutMethod = pickerWithoutMethod.replace(addition, '')
  }
  const restoredPicker = pickerWithoutMethod.replace('  const [portalContainer, setPortalContainer] = useState<Element | null>(null)\n', '').replace("onOpenChange={nextOpen => {\n      setPortalContainer(nextOpen ? document.fullscreenElement : null)\n      setOpen(nextOpen)\n    }}", 'onOpenChange={setOpen}').replace('PopoverContent portalContainer={portalContainer}', 'PopoverContent')
  assert.equal(restoredPicker, oldPicker)
  const restoredWrapper = wrapper.replace('React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & {\n    portalContainer?: React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Portal>["container"]\n  }', 'React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>').replace('sideOffset = 4, portalContainer, ...props', 'sideOffset = 4, ...props').replace('<PopoverPrimitive.Portal container={portalContainer}>', '<PopoverPrimitive.Portal>')
  assert.equal(restoredWrapper, oldWrapper)
})
await check('Negative control rejects dropped fullscreen capture and wrapper prop leakage', () => {
  const dropped = harness({ code: picker.replace('nextOpen ? document.fullscreenElement : null', 'null'), fullscreen: A }); dropped.open(true)
  assert.throws(() => assert.equal(dropped.portal().props.container, A), assert.AssertionError)
  const leaky = loadWrapper(wrapper.replace('sideOffset = 4, portalContainer, ...props', 'sideOffset = 4, ...props').replace('container={portalContainer}', 'container={props.portalContainer}')).PopoverContent({ portalContainer: A }, null)
  assert.throws(() => assert.equal(Object.hasOwn(leaky.props.children.props, 'portalContainer'), false), assert.AssertionError)
})
// Publish continuation uses its exact independent predecessor, after the
// separately reviewed picker change; no old options/focus callback are waived.
const dialogFile = 'components/ui/dialog.tsx', publishFile = 'components/publish-dialog.tsx'
const publishPredecessor = 'fe0ef1d9c1e95cef1bc21adb28f0b2333b8d3aef'
const publishPrior = file => execFileSync('git', ['show', `${publishPredecessor}:${file}`], { cwd: root, encoding: 'utf8' })
const dialog = read(dialogFile), publish = read(publishFile), oldDialog = publishPrior(dialogFile), oldPublish = publishPrior(publishFile)
const dialogPrimitives = Object.fromEntries(['Root','Trigger','Portal','Close','Overlay','Content','Title','Description'].map(name => [name, 'DialogPrimitive' + name]))
function loadDialog(code = dialog) {
  return load(code, dialogFile, { react: { forwardRef: fn => fn }, '@radix-ui/react-dialog': dialogPrimitives, 'lucide-react': { X: 'X' }, '@/lib/utils': { cn }, 'react/jsx-runtime': { jsx, jsxs: jsx } })
}
function publishExpressions(source) {
  const ast = ts.createSourceFile(publishFile, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let flag, portal, focus
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'STUDIO_PUBLISH') flag = node.initializer
    if (ts.isJsxAttribute(node) && node.name.getText(ast) === 'portalContainer') portal = node.initializer.expression
    if (ts.isJsxAttribute(node) && node.name.getText(ast) === 'onCloseAutoFocus') focus = node.initializer.expression
    ts.forEachChild(node, visit)
  }
  visit(ast); assert.ok(flag && focus)
  return { ast, flag, portal, focus }
}
const publishNodes = publishExpressions(publish), beforePublishNodes = publishExpressions(oldPublish)
function publishPortal({ flag = 'true', open = true, server = false, fullscreen = A, code } = {}) {
  let reads = 0
  const env = { process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: flag === '__absent__' ? undefined : flag } }, open }
  if (!server) env.document = { get fullscreenElement() { reads++; return fullscreen } }
  const expression = code ?? publishNodes.portal.getText(publishNodes.ast)
  const value = vm.runInNewContext(compile('const STUDIO_PUBLISH = ' + publishNodes.flag.getText(publishNodes.ast) + '; (' + expression + ')', 'publish-portal.ts'), env)
  return { value, reads }
}
await check('Publish predecessor reproduces body-default Dialog portal with no fullscreen prop', () => {
  assert.equal(beforePublishNodes.portal, undefined)
  const tree = loadDialog(oldDialog).DialogContent({ children: 'Existing Publish content' }, null)
  assert.equal(tree.props.container, undefined); assert.throws(() => assert.equal(tree.props.container, A), assert.AssertionError)
})
for (const container of [undefined, null, A]) await check(`Actual Dialog wrapper routes container only to Portal and retains overlay/content: ${container?.id ?? String(container)}`, () => {
  const ref = {}, onCloseAutoFocus = refuse, children = { exact: 'Original native Publish child' }
  const props = { portalContainer: container, className: 'native-dialog-extra', 'aria-label': 'Actual Publish', onCloseAutoFocus, children }
  const current = loadDialog(), previous = loadDialog(oldDialog), tree = current.DialogContent(props, ref)
  assert.equal(tree.type, dialogPrimitives.Portal); assert.equal(tree.props.container, container)
  const [overlayNode, content] = tree.props.children
  assert.equal(overlayNode.type, current.DialogOverlay); assert.equal(content.type, dialogPrimitives.Content)
  assert.equal(Object.hasOwn(content.props, 'portalContainer'), false); assert.equal(Object.hasOwn(content.props, 'container'), false)
  assert.equal(Object.hasOwn(overlayNode.props, 'portalContainer'), false); assert.equal(content.props.onCloseAutoFocus, onCloseAutoFocus); assert.equal(content.props.ref, ref)
  assert.equal(content.props.children[0], children)
  const baseline = previous.DialogContent({ ...props, portalContainer: undefined }, ref)
  // The newly introduced property is absent from the prior caller's props.
  const priorProps = { ...props }; delete priorProps.portalContainer
  const exactBaseline = previous.DialogContent(priorProps, ref)
  assert.equal(rendered(content), rendered(exactBaseline.props.children[1]))
  assert.equal(rendered(current.DialogOverlay(overlayNode.props, null)), rendered(previous.DialogOverlay(exactBaseline.props.children[0].props, null)))
  assert.equal(baseline.props.container, undefined)
})
await check('Omitted shared Dialog option keeps native body Portal, overlay, close control and defaults exact', () => {
  const props = { children: 'Complete original child', id: 'native-dialog-id' }, current = loadDialog().DialogContent(props, null), before = loadDialog(oldDialog).DialogContent(props, null)
  assert.equal(rendered(current), rendered(before)); assert.equal(current.props.container, undefined)
  assert.equal(current.props.children[1].props.children[1].type, dialogPrimitives.Close)
})
await check('Actual Studio Publish expression captures fullscreen only when open and document exists', () => {
  assert.equal(publishPortal().value, A); assert.equal(publishPortal().reads, 1)
  assert.equal(publishPortal({ fullscreen: null }).value, null)
  for (const config of [{ open: false }, { server: true }, { server: true, open: false }]) {
    const result = publishPortal(config); assert.equal(result.value, undefined); assert.equal(result.reads, 0)
  }
  assert.equal(publishPortal({ fullscreen: B }).value, B, 'Fresh render follows the actual current fullscreen owner')
})
for (const flag of ['__absent__', '', 'false', 'TRUE', '1']) await check(`Publish default-off portal guard preserves body defaults without document access: ${flag}`, () => {
  for (const open of [false, true]) for (const server of [false, true]) {
    const result = publishPortal({ flag, open, server }); assert.equal(result.value, undefined); assert.equal(result.reads, 0)
    const props = { portalContainer: result.value, children: 'Exact classic content' }
    const current = loadDialog().DialogContent(props, null), before = loadDialog(oldDialog).DialogContent({ children: props.children }, null)
    assert.equal(rendered(current), rendered(before))
  }
})
await check('Entire Publish file reverses exactly to fe0ef1d9 after only the added portal prop; focus callback stays byte exact', () => {
  const line = "        portalContainer={STUDIO_PUBLISH && open && typeof document !== 'undefined' ? document.fullscreenElement : undefined}\n"
  assert.equal(publish.split(line).length, 2); assert.equal(publish.replace(line, ''), oldPublish)
  assert.equal(publishNodes.focus.getText(publishNodes.ast), beforePublishNodes.focus.getText(beforePublishNodes.ast))
  const restored = dialog.replace('React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {\n    portalContainer?: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Portal>["container"]\n  }', 'React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>').replace('className, children, portalContainer, ...props', 'className, children, ...props').replace('<DialogPortal container={portalContainer}>', '<DialogPortal>')
  assert.equal(restored, oldDialog)
})
await check('Publish/Dialog negative controls reject dropped container, lost server guard and leaked native content prop', () => {
  assert.throws(() => assert.equal(publishPortal({ code: 'undefined' }).value, A), assert.AssertionError)
  assert.throws(() => publishPortal({ server: true, code: publishNodes.portal.getText(publishNodes.ast).replace(" && typeof document !== 'undefined'", '') }), error => error.name === 'ReferenceError')
  const leaky = loadDialog(dialog.replace('className, children, portalContainer, ...props', 'className, children, ...props').replace('container={portalContainer}', 'container={props.portalContainer}')).DialogContent({ portalContainer: A, children: 'Native child' }, null)
  assert.throws(() => assert.equal(Object.hasOwn(leaky.props.children[1].props, 'portalContainer'), false), assert.AssertionError)
})
for (const file of ['components/template-save-dialog.tsx', 'components/template-ingest-dialog.tsx']) {
  const source = read(file), before = prior(file), ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let flagExpression, portalExpression, portalCount = 0
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'STUDIO_TEMPLATE_FLOW') flagExpression = node.initializer
    if (ts.isJsxAttribute(node) && node.name.getText(ast) === 'portalContainer') { portalExpression = node.initializer.expression; portalCount++ }
    ts.forEachChild(node, visit)
  }
  visit(ast); assert.ok(flagExpression && portalExpression); assert.equal(portalCount, 1)
  compile(source, file)
  function run({ flag = 'true', open = true, server = false, fullscreen = A, expression = portalExpression.getText(ast), flagCode = flagExpression.getText(ast) } = {}) {
    let reads = 0
    const context = { process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: flag === '__absent__' ? undefined : flag } }, open }
    if (!server) context.document = { get fullscreenElement() { reads++; return fullscreen } }
    const value = vm.runInNewContext(compile('const STUDIO_TEMPLATE_FLOW = ' + flagCode + '; (' + expression + ')', 'template-portal.ts'), context)
    return { value, reads }
  }
  await check(`${file}: original fullscreen body portal is retained as a negative baseline`, () => {
    assert.doesNotMatch(before, /portalContainer=/)
    const baseline = loadDialog(oldDialog).DialogContent({ children: 'Native Template content' }, null)
    assert.equal(baseline.props.container, undefined); assert.throws(() => assert.equal(baseline.props.container, A), assert.AssertionError)
  })
  await check(`${file}: actual Studio expression respects open/SSR/normal/fullscreen owner`, () => {
    assert.equal(run().value, A); assert.equal(run().reads, 1); assert.equal(run({ fullscreen: null }).value, null)
    for (const config of [{ open: false }, { server: true }, { open: false, server: true }]) { const result = run(config); assert.equal(result.value, undefined); assert.equal(result.reads, 0) }
    assert.equal(run({ fullscreen: B }).value, B)
    const routed = loadDialog().DialogContent({ portalContainer: run().value, children: 'Actual original Template content' }, null)
    assert.equal(routed.props.container, A); assert.equal(Object.hasOwn(routed.props.children[1].props, 'portalContainer'), false)
  })
  for (const flag of ['__absent__', '', 'false', 'TRUE', '1']) await check(`${file}: literal/default-off guard keeps native body portal: ${flag}`, () => {
    for (const open of [true, false]) for (const server of [true, false]) {
      const result = run({ flag, open, server }); assert.equal(result.value, undefined); assert.equal(result.reads, 0)
      const current = loadDialog().DialogContent({ portalContainer: result.value, children: 'Unchanged native default content' }, null), previous = loadDialog(oldDialog).DialogContent({ children: 'Unchanged native default content' }, null)
      assert.equal(rendered(current), rendered(previous))
    }
  })
  await check(`${file}: complete file reverses to a29f749c after only the portal prop; all native handlers/gates/options stay exact`, () => {
    const addition = "portalContainer={STUDIO_TEMPLATE_FLOW && open && typeof document !== 'undefined' ? document.fullscreenElement : undefined} "
    assert.equal(source.split(addition).length, 2); assert.equal(source.replace(addition, ''), before)
  })
  await check(`${file}: dropped capture, removed server fence and nonliteral flag controls are rejected`, () => {
    assert.throws(() => assert.equal(run({ expression: 'undefined' }).value, A), assert.AssertionError)
    assert.throws(() => run({ server: true, expression: portalExpression.getText(ast).replace(" && typeof document !== 'undefined'", '') }), error => error.name === 'ReferenceError')
    const loosened = flagExpression.getText(ast).replace("=== 'true'", "!== 'false'")
    assert.notEqual(loosened, flagExpression.getText(ast))
    assert.throws(() => assert.equal(run({ flag: '__absent__', flagCode: loosened }).value, undefined), assert.AssertionError)
  })
}
console.log(`${checks} actual fullscreen picker/Popover/Publish/Template/Dialog checks passed; exact historical baselines and negative controls retained. No browser/API/fullscreen/insertion/publish/upload service operations.`)
