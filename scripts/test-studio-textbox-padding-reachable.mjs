// R6: "Box padding" reachable for an Add Element text box in the Studio Format inspector
// (flag NEXT_PUBLIC_STUDIO_TEXTBOX_PADDING_REACHABLE_ENABLED, exact "true", default off).
// Offline and self-contained: no network, no git, no browser. The repo root is found from this file (package.json anchor).
// The REAL inspector source is compiled and rendered two ways: react-dom/server (real React: header, tabs, which panel is hidden,
// how many "Box padding" inputs exist and where) and a tiny hook-driven renderer (real JSX elements, fake hooks) that clicks a tab,
// types into the padding field and blurs it, so the whole path Format -> tab -> Box padding -> setTextBoxPadding is exercised.
// It then re-runs everything against deliberately broken copies of the source: each mutant must be caught.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const React = nodeRequire('react')
const jsxRuntime = nodeRequire('react/jsx-runtime')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')

const FLAG = 'NEXT_PUBLIC_STUDIO_TEXTBOX_PADDING_REACHABLE_ENABLED'
const INSPECTOR = 'components/builder/studio-format-inspector.tsx'
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
const SOURCE = read(INSPECTOR)

let checks = 0
const check = (fn, ...args) => { checks++; return fn(...args) }
const settle = () => new Promise(resolve => setTimeout(resolve, 0)) // let the async send finish (its in-flight guard clears after the awaits)
const plain = value => JSON.parse(JSON.stringify(value)) // values built inside the vm context have another realm's prototypes

// ---------------------------------------------------------------- loader: the real inspector, leaf dependencies stubbed
const BOX_FIELDS = ['Box padding', 'Box fill', 'Box border style', 'Box border width', 'Box border color', 'Box corner radius']
const TEXT_COMMANDS = ['setTextBoxFont', 'setTextBoxFontWeight', 'setTextBoxFontSize', 'setTextBoxColor', 'setTextBoxAlignment',
  'setTextBoxVerticalAlignment', 'setTextBoxLineHeight', 'setTextBoxParagraphSpacing']
const BOX_COMMANDS = ['setTextBoxPadding', 'setTextBoxBorder', 'setTextBoxBackground']
function load(source, env, reactImpl) {
  const compiled = ts.transpileModule(source, { fileName: INSPECTOR, reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  assert.equal((compiled.diagnostics || []).filter(value => value.category === ts.DiagnosticCategory.Error).length, 0, 'inspector must transpile')
  const leaf = name => ({ children }) => jsxRuntime.jsx('div', { 'data-stub': name, children })
  const stubs = {
    react: reactImpl,
    'react/jsx-runtime': jsxRuntime,
    'lucide-react': { X: () => null, Sparkles: () => null, Loader2: () => null },
    '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
    '@/components/ui/panel': { PanelSection: leaf('PanelSection'), ButtonGroup: () => null, Divider: () => null },
    '@/components/element-format-panel/tabs/arrange-tab': { ArrangeTab: () => jsxRuntime.jsx('div', { 'data-stub': 'ArrangeTab' }) },
    '@/components/builder/studio-panels.css': {},
    '@/components/builder/studio-format-failures.css': {},
  }
  const mod = { exports: {} }
  vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports, process: { env }, console,
    fetch: () => assert.fail('no service requests'), require: id => { assert.ok(id in stubs, `unexpected import ${id}`); return stubs[id] } })
  return mod.exports
}

// ---------------------------------------------------------------- targets, as lib/studio-format-native.ts admits them
const base = { selectionOwner: {}, elementId: 'box-1', presentationId: 'deck-1', slideIndex: 3, sessionId: 'session-1', properties: null }
const target = {
  /** An ordinary Add Element TEXT_BOX: admitted as editable text with the box commands (native.ts: text -> editable-text). */
  editable: (extra = {}) => ({ ...base, kind: 'editable-text', formatting: { padding: '12px' }, box: { padding: '12px', backgroundColor: 'rgb(255, 255, 255)' },
    supportedCommands: [...TEXT_COMMANDS, ...BOX_COMMANDS, 'generateTextBoxContent'], ...extra }),
  /** A retained custom render (render_spec): textbox-shell, no commands. */
  shellLocked: () => ({ ...base, kind: 'textbox-shell', box: { padding: '12px' }, supportedCommands: [] }),
  shell: () => ({ ...base, kind: 'textbox-shell', box: { padding: '12px' }, supportedCommands: [...BOX_COMMANDS] }),
  element: () => ({ ...base, kind: 'element', elementType: 'image', supportedCommands: [] }),
}

// ---------------------------------------------------------------- 1) real React, server render
function ssr(exports, tgt, { busy = false } = {}) {
  return renderToStaticMarkup(React.createElement(exports.StudioFormatInspector, { isOpen: true, target: tgt, busy, onClose() {}, onSendCommand: async () => ({ success: true }) }))
}
function facts(html) {
  const header = /<h2>Format<\/h2><p>([^<]*)<\/p>/.exec(html)?.[1]
  const tabs = [...html.matchAll(/role="tab" aria-selected="(true|false)"[^>]*>([^<]*)</g)].map(m => ({ label: m[2], selected: m[1] === 'true' }))
  const panels = [...html.matchAll(/<div role="tabpanel" aria-label="([^"]+)"( hidden="")?/g)].map(m => ({ label: m[1], hidden: Boolean(m[2]) }))
  const split = html.split(/(?=<div role="tabpanel")/)
  const panelHtml = Object.fromEntries(split.slice(1).map(part => [/aria-label="([^"]+)"/.exec(part)[1], part]))
  const inputs = label => [...html.matchAll(new RegExp(`<input[^>]*aria-label="${label}"[^>]*>`, 'g'))].map(m => m[0])
  const inPanel = (panel, label) => [...(panelHtml[panel] ?? '').matchAll(new RegExp(`<input[^>]*aria-label="${label}"[^>]*>`, 'g'))].length
  return { header, tabs, panels, inputs, inPanel, panelHtml, selected: tabs.find(t => t.selected)?.label }
}
const labels = f => f.tabs.map(t => t.label)

function suiteSsr(source) {
  const off = load(source, {}, React)
  const on = load(source, { [FLAG]: 'true' }, React)

  // Flag off: the state PK's run hit. Editable text opens on Content; Box padding is in the HIDDEN Appearance panel.
  const offText = facts(ssr(off, target.editable()))
  check(assert.equal, offText.header, 'Selected text')
  check(assert.deepEqual, labels(offText), ['Content', 'Appearance', 'Arrange'])
  check(assert.equal, offText.selected, 'Content')
  check(assert.deepEqual, offText.panels, [{ label: 'Content', hidden: false }, { label: 'Appearance', hidden: true }, { label: 'Arrange', hidden: true }])
  for (const field of BOX_FIELDS) {
    check(assert.equal, offText.inputs(field).length, 1, `${field} exists once (off)`)
    check(assert.equal, offText.inPanel('Appearance', field), 1, `${field} lives in Appearance (off)`)
  }
  check(assert.ok, !offText.inputs('Box padding')[0].includes('disabled'), 'Box padding is enabled for an editable text box')
  check(assert.ok, offText.panelHtml.Content.includes('Edit text directly on the slide, or use the existing AI text actions below.'), 'Content panel text (off)')

  // Flag on: a Box tab for the editable text box, header says it is the box.
  const onText = facts(ssr(on, target.editable()))
  check(assert.equal, onText.header, 'Selected text box')
  check(assert.deepEqual, labels(onText), ['Content', 'Appearance', 'Box', 'Arrange'])
  check(assert.equal, onText.selected, 'Content', 'still opens on Content (AI text), the Box tab is one click away')
  check(assert.deepEqual, onText.panels, [{ label: 'Content', hidden: false }, { label: 'Appearance', hidden: true }, { label: 'Box', hidden: true }, { label: 'Arrange', hidden: true }])
  for (const field of BOX_FIELDS) {
    check(assert.equal, onText.inputs(field).length, 1, `${field} exists once (on)`)
    check(assert.equal, onText.inPanel('Box', field), 1, `${field} lives in Box (on)`)
    check(assert.equal, onText.inPanel('Appearance', field), 0, `${field} no longer buried in Appearance (on)`)
  }
  check(assert.ok, !onText.inputs('Box padding')[0].includes('disabled'))
  check(assert.ok, onText.inPanel('Appearance', 'Text size') === 1 && /Typography/.test(onText.panelHtml.Appearance) && /Theme colors/.test(onText.panelHtml.Appearance), 'Appearance keeps Typography and Theme colors')
  check(assert.ok, /value="12px"/.test(onText.inputs('Box padding')[0]), 'the read padding is shown')
  // Content and Arrange panels are byte-identical across the flag.
  for (const panel of ['Content', 'Arrange']) check(assert.equal, onText.panelHtml[panel], offText.panelHtml[panel], `${panel} panel unchanged`)
  check(assert.ok, offText.panelHtml.Appearance.includes('>Box</h3>') && !onText.panelHtml.Appearance.includes('>Box</h3>'), 'the Box block moved out of Appearance')

  // Busy (generation in progress) disables the field in both states; the tab stays.
  const busyOn = facts(ssr(on, target.editable(), { busy: true }))
  check(assert.ok, busyOn.inputs('Box padding')[0].includes('disabled'))
  check(assert.deepEqual, labels(busyOn), ['Content', 'Appearance', 'Box', 'Arrange'])

  // Padding command not admitted: the Box tab is there, the field is disabled (never a silent no-op).
  const noPad = facts(ssr(on, target.editable({ supportedCommands: TEXT_COMMANDS })))
  check(assert.ok, noPad.inputs('Box padding')[0].includes('disabled'))
  check(assert.ok, /Box commands are unavailable for this selection/.test(noPad.panelHtml.Box))

  // Other target kinds are byte-identical with the flag on or off.
  for (const [name, make] of [['shell', target.shell], ['shellLocked', target.shellLocked], ['element', target.element]]) {
    const a = ssr(off, make()), b = ssr(on, make())
    check(assert.equal, b, a, `${name}: flag on == flag off`)
  }
  const shell = facts(ssr(on, target.shell()))
  check(assert.equal, shell.header, 'Selected graphic box')
  check(assert.deepEqual, labels(shell), ['Appearance', 'Arrange'])
  check(assert.equal, shell.inPanel('Appearance', 'Box padding'), 1)
  check(assert.ok, shell.panelHtml.Appearance.includes('Box properties affect the surrounding container. Text and artwork inside it keep their rendered appearance.'), 'graphic box note')
  const locked = facts(ssr(on, target.shellLocked()))
  check(assert.ok, locked.inputs('Box padding')[0].includes('disabled'), 'a locked graphic box keeps its Box controls disabled')
  check(assert.ok, /Box commands are unavailable for this selection/.test(locked.panelHtml.Appearance))
  check(assert.equal, facts(ssr(on, target.element())).header, 'Selected element')
  check(assert.deepEqual, labels(facts(ssr(on, target.element()))), ['Arrange'])
  check(assert.ok, /Select an element on the slide to format it\./.test(ssr(on, null)))
  check(assert.equal, ssr(on, null), ssr(off, null))

  // The flag is read exactly: only the string "true" turns it on.
  for (const value of [undefined, '', 'false', 'TRUE', 'True', '1', ' true', 'true ', 'yes', 'on']) {
    const loaded = load(source, value === undefined ? {} : { [FLAG]: value }, React)
    check(assert.equal, loaded.STUDIO_TEXTBOX_PADDING_REACHABLE, false, `flag value ${JSON.stringify(value)} stays off`)
    check(assert.equal, ssr(loaded, target.editable()), ssr(off, target.editable()), `flag value ${JSON.stringify(value)} renders as off`)
  }
  check(assert.equal, on.STUDIO_TEXTBOX_PADDING_REACHABLE, true)
}

// ---------------------------------------------------------------- 2) hook-driven renderer: real elements, fake hooks
function mount(source, env, props) {
  const instances = new Map()
  let ctx = null
  let effects = []
  const fakeReact = {
    ...React,
    useState(initial) {
      const inst = ctx, slot = (inst.slots[inst.cursor] ??= { value: typeof initial === 'function' ? initial() : initial }); inst.cursor++
      return [slot.value, value => { slot.value = typeof value === 'function' ? value(slot.value) : value }]
    },
    useRef(initial) { const inst = ctx; const slot = (inst.slots[inst.cursor] ??= { current: initial }); inst.cursor++; return slot },
    useCallback(callback) { ctx.cursor++; return callback },
    useEffect(callback, deps) {
      const inst = ctx, slot = (inst.slots[inst.cursor] ??= { deps: null, cleanup: undefined }); inst.cursor++
      if (!slot.deps || !deps || deps.some((value, index) => value !== slot.deps[index])) {
        effects.push(() => { slot.cleanup?.(); slot.cleanup = callback(); slot.deps = deps })
      }
    },
  }
  const component = load(source, env, fakeReact).StudioFormatInspector
  function expand(node, pathKey) {
    if (Array.isArray(node)) return node.flatMap((child, index) => expand(child, `${pathKey}/${index}`))
    if (node === null || node === undefined || typeof node === 'boolean') return []
    if (typeof node !== 'object') return [String(node)]
    if (typeof node.type === 'function') {
      const key = `${pathKey}/${node.type.name || 'anon'}`
      const inst = instances.get(key) ?? { slots: [], cursor: 0 }
      instances.set(key, inst)
      inst.cursor = 0
      const previous = ctx; ctx = inst
      const out = node.type(node.props)
      ctx = previous
      return expand(out, key)
    }
    if (typeof node.type === 'symbol') return expand(node.props.children, pathKey) // Fragment
    return [{ type: node.type, props: node.props, children: expand(node.props.children, pathKey) }]
  }
  const api = {
    tree: [],
    render(nextProps = props) {
      props = nextProps
      api.tree = expand(React.createElement(component, props), 'root')
      let guard = 0
      while (effects.length && guard++ < 20) { const run = effects; effects = []; run.forEach(fn => fn()) }
      return api.tree
    },
    all() { const out = []; const walk = n => { if (typeof n === 'string') return; out.push(n); n.children.forEach(walk) }; api.tree.forEach(walk); return out },
    byRole(role) { return api.all().filter(n => n.props?.role === role) },
    panel(label) { return api.all().find(n => n.props?.role === 'tabpanel' && n.props['aria-label'] === label) },
    input(label, within) { const scope = within ? api.panel(within) : { children: api.tree }; const out = []; const walk = n => { if (typeof n === 'string') return; if (n.type === 'input' && n.props['aria-label'] === label) out.push(n); n.children.forEach(walk) }; scope.children.forEach(walk); return out },
    text(n) { return typeof n === 'string' ? n : n.children.map(api.text).join('') },
    tab(label) { return api.byRole('tab').find(n => api.text(n) === label) },
    selectedTab() { return api.byRole('tab').find(n => n.props['aria-selected'] === true) },
  }
  return api
}
async function suiteInteractive(source) {
  for (const [flag, expectBoxTab] of [[undefined, false], ['true', true]]) {
    const env = flag === undefined ? {} : { [FLAG]: flag }
    const calls = []
    const tgt = target.editable()
    const send = async (action, params, t) => { calls.push({ action, params, t }); return { success: true } }
    const props = { isOpen: true, target: tgt, busy: false, onClose() {}, onSendCommand: send }
    const app = mount(source, env, props)
    app.render()
    check(assert.equal, app.text(app.selectedTab()), 'Content')
    check(assert.equal, Boolean(app.tab('Box')), expectBoxTab)
    check(assert.equal, app.panel('Appearance').props.hidden, true)

    // The path: open the tab that holds Box, type, blur.
    const holder = expectBoxTab ? 'Box' : 'Appearance'
    check(assert.equal, app.panel(holder).props.hidden, true, 'the holder starts hidden (this is why it was not found)')
    app.tab(holder).props.onClick(); app.render()
    check(assert.equal, app.text(app.selectedTab()), holder)
    check(assert.equal, app.panel(holder).props.hidden, false)
    for (const other of ['Content', 'Arrange', ...(expectBoxTab ? ['Appearance'] : [])]) check(assert.equal, app.panel(other).props.hidden, true, `${other} hidden once ${holder} is open`)
    const field = app.input('Box padding', holder)
    check(assert.equal, field.length, 1)
    check(assert.equal, app.input('Box padding').length, 1)
    check(assert.equal, field[0].props.disabled, false)
    check(assert.equal, field[0].props.value, '12px')
    field[0].props.onChange({ target: { value: '20px' } }); app.render()
    check(assert.equal, app.input('Box padding', holder)[0].props.value, '20px')
    check(assert.equal, calls.length, 0, 'typing alone sends nothing')
    await app.input('Box padding', holder)[0].props.onBlur(); await settle()
    check(assert.equal, calls.length, 1)
    check(assert.equal, calls[0].action, 'setTextBoxPadding')
    check(assert.deepEqual, plain(calls[0].params), { elementId: 'box-1', padding: '20px' })
    check(assert.equal, calls[0].t, tgt, 'the admitted target is passed through unchanged')

    // The page re-reads after a confirmed command and hands back a refreshed target (same owner) and a new read snapshot.
    const refreshed = { ...tgt, box: { ...tgt.box, padding: '20px' } }
    app.render({ ...props, target: refreshed, readSnapshot: refreshed })
    check(assert.equal, app.text(app.selectedTab()), holder, 'a refresh keeps the open tab')
    check(assert.equal, app.input('Box padding', holder)[0].props.value, '20px')
    await app.input('Box padding', holder)[0].props.onBlur(); await settle()
    check(assert.equal, calls.length, 1, 'the unchanged value is not sent again')
    app.input('Box padding', holder)[0].props.onChange({ target: { value: '   ' } }); app.render()
    await app.input('Box padding', holder)[0].props.onBlur(); await settle()
    check(assert.equal, calls.length, 1, 'blank sends nothing')
    app.input('Box fill', holder)[0].props.onChange({ target: { value: 'rgb(1, 2, 3)' } }); app.render()
    await app.input('Box fill', holder)[0].props.onBlur(); await settle()
    check(assert.equal, calls.at(-1).action, 'setTextBoxBackground')
    check(assert.deepEqual, plain(calls.at(-1).params), { elementId: 'box-1', backgroundColor: 'rgb(1, 2, 3)' })
    app.input('Box corner radius', holder)[0].props.onChange({ target: { value: '8px' } }); app.render()
    await app.input('Box corner radius', holder)[0].props.onBlur(); await settle()
    check(assert.equal, calls.at(-1).action, 'setTextBoxBorder')
    check(assert.deepEqual, plain(calls.at(-1).params), { elementId: 'box-1', borderRadius: '8px' })

    // Back to Content: the holder hides again, and the one input is still the only one.
    app.tab('Content').props.onClick(); app.render()
    check(assert.equal, app.text(app.selectedTab()), 'Content')
    check(assert.equal, app.panel(holder).props.hidden, true)
    check(assert.equal, app.input('Box padding').length, 1)

    // A target without the padding command: the field is disabled and nothing is sent.
    const refusedCalls = []
    const refused = mount(source, env, { isOpen: true, target: target.editable({ supportedCommands: TEXT_COMMANDS }), busy: false, onClose() {},
      onSendCommand: async (...args) => { refusedCalls.push(args); return { success: true } } })
    refused.render(); refused.tab(holder).props.onClick(); refused.render()
    check(assert.equal, refused.input('Box padding', holder)[0].props.disabled, true)
    check(assert.equal, refusedCalls.length, 0)
  }
}

// ---------------------------------------------------------------- 3) text/config facts
function suiteStatic(source) {
  const flagReads = source.match(/process\.env\.NEXT_PUBLIC_STUDIO_TEXTBOX_PADDING_REACHABLE_ENABLED/g) ?? []
  check(assert.equal, flagReads.length, 1, 'one literal env read (Next inlines only the literal property access)')
  check(assert.match, source, /export const STUDIO_TEXTBOX_PADDING_REACHABLE = process\.env\.NEXT_PUBLIC_STUDIO_TEXTBOX_PADDING_REACHABLE_ENABLED === 'true'/)
  const envExample = read('.env.example')
  check(assert.match, envExample, /^NEXT_PUBLIC_STUDIO_TEXTBOX_PADDING_REACHABLE_ENABLED="false"$/m)
  check(assert.equal, (envExample.match(/NEXT_PUBLIC_STUDIO_TEXTBOX_PADDING_REACHABLE_ENABLED=/g) ?? []).length, 1)
  const pkg = JSON.parse(read('package.json'))
  check(assert.equal, pkg.scripts['test:studio-textbox-padding-reachable'], 'node scripts/test-studio-textbox-padding-reachable.mjs')
  // The flag lives in the inspector only: the page, viewer and native bridge are not touched.
  for (const rel of ['app/builder/page.tsx', 'components/presentation-viewer.tsx', 'lib/studio-format-native.ts']) {
    check(assert.ok, !read(rel).includes('TEXTBOX_PADDING_REACHABLE'), `${rel} does not read the flag`)
  }
}

async function runAll(source) {
  suiteStatic(source)
  suiteSsr(source)
  await suiteInteractive(source)
}

await runAll(SOURCE)
const cleanChecks = checks

// ---------------------------------------------------------------- mutation check: every mutant must be caught
const mutants = [
  ['flag read: not exact true', "=== 'true'\nconst validTarget", "!== 'false'\nconst validTarget"],
  ['flag read: always on', "NEXT_PUBLIC_STUDIO_TEXTBOX_PADDING_REACHABLE_ENABLED === 'true'", 'true'],
  ['flag read: always off', "NEXT_PUBLIC_STUDIO_TEXTBOX_PADDING_REACHABLE_ENABLED === 'true'", 'false'],
  ['flag read: wrong env name', 'NEXT_PUBLIC_STUDIO_TEXTBOX_PADDING_REACHABLE_ENABLED === ', 'NEXT_PUBLIC_STUDIO_TEXTBOX_PADDING_REACHABLE === '],
  ['header: unchanged with the flag on', "(STUDIO_TEXTBOX_PADDING_REACHABLE ? 'Selected text box' : 'Selected text')", "'Selected text'"],
  ['header: changed with the flag off', "(STUDIO_TEXTBOX_PADDING_REACHABLE ? 'Selected text box' : 'Selected text')", "'Selected text box'"],
  ['header: graphic box renamed', "'Selected graphic box'", "'Selected box'"],
  ['tabs: no Box tab with the flag on', "boxTab ? ['content', 'appearance', 'box', 'arrange']", "boxTab ? ['content', 'appearance', 'arrange']"],
  ['tabs: Box after Arrange', "['content', 'appearance', 'box', 'arrange']", "['content', 'appearance', 'arrange', 'box']"],
  ['tabs: Box before Appearance', "['content', 'appearance', 'box', 'arrange']", "['content', 'box', 'appearance', 'arrange']"],
  ['tabs: Box tab even with the flag off', ": ['content', 'appearance', 'arrange']) :", ": ['content', 'appearance', 'box', 'arrange']) :"],
  ['tabs: Box tab ignores the flag', "const boxTab = STUDIO_TEXTBOX_PADDING_REACHABLE && target.kind === 'editable-text'", "const boxTab = target.kind === 'editable-text'"],
  ['tabs: label wrong', "value === 'box' ? 'Box' : 'Arrange'", "value === 'box' ? 'Boxes' : 'Arrange'"],
  ['tabs: Box label shown as Arrange', "value === 'box' ? 'Box' : 'Arrange'", "'Arrange'"],
  ['tabs: Box tab click does nothing', 'onClick={()=>setTab(value)}', 'onClick={()=>{}}'],
  ['tabs: opens on Appearance', "useState<Tab>(target.kind === 'editable-text' ? 'content'", "useState<Tab>(target.kind === 'editable-text' ? 'appearance'"],
  ['tabs: opens on Box', "useState<Tab>(target.kind === 'editable-text' ? 'content'", "useState<Tab>(target.kind === 'editable-text' ? (STUDIO_TEXTBOX_PADDING_REACHABLE ? 'box' : 'content')"],
  ['panel: Box controls still in Appearance with the flag on', '{!boxTab && <BoxControls', '{true && <BoxControls'],
  ['panel: Box controls gone from Appearance with the flag off', '{!boxTab && <BoxControls', '{false && <BoxControls'],
  ['panel: Box panel always hidden', 'aria-label="Box" hidden={tab !== \'box\'}', 'aria-label="Box" hidden'],
  ['panel: Box panel never hidden', 'aria-label="Box" hidden={tab !== \'box\'}', 'aria-label="Box" hidden={false}'],
  ['panel: Box panel hidden by the wrong tab', 'aria-label="Box" hidden={tab !== \'box\'}', 'aria-label="Box" hidden={tab !== \'appearance\'}'],
  ['panel: Box panel mislabelled', 'role="tabpanel" aria-label="Box"', 'role="tabpanel" aria-label="Appearance"'],
  ['panel: Box panel not rendered', '{boxTab && <div role="tabpanel" aria-label="Box"', '{false && <div role="tabpanel" aria-label="Box"'],
  ['panel: Box panel rendered without the flag', '{boxTab && <div role="tabpanel" aria-label="Box"', '{<div role="tabpanel" aria-label="Box"'],
  ['panel: Box controls disabled in the Box tab', '<BoxControls key={`box-${readRevision}`} target={{...target,box:target.box ?? {padding:target.formatting?.padding,backgroundColor:target.formatting?.backgroundColor}}} send={send} disabled={disabled}/>\n        </div>}', '<BoxControls key={`box-${readRevision}`} target={{...target,box:target.box ?? {padding:target.formatting?.padding,backgroundColor:target.formatting?.backgroundColor}}} send={send} disabled={true}/>\n        </div>}'],
  ['panel: Box tab drops the read box (no fallback)', '          <p className="px-4 pt-3 text-xs">Box properties affect the whole text box. The text inside keeps its own formatting.</p>\n          <BoxControls key={`box-${readRevision}`} target={{...target,box:target.box ?? {padding:target.formatting?.padding,backgroundColor:target.formatting?.backgroundColor}}}', '          <p className="px-4 pt-3 text-xs">Box properties affect the whole text box. The text inside keeps its own formatting.</p>\n          <BoxControls key={`box-${readRevision}`} target={{...target,box:{}}}'],
  ['command: padding sends the border command', "['padding', 'Padding', 'setTextBoxPadding']", "['padding', 'Padding', 'setTextBoxBorder']"],
  ['command: padding not admitted for the editable box', "'setTextBoxLineHeight', 'setTextBoxParagraphSpacing', 'setTextBoxPadding', 'setTextBoxBorder',", "'setTextBoxLineHeight', 'setTextBoxParagraphSpacing', 'setTextBoxBorder',"],
  ['command: field label renamed', "aria-label={`Box ${label.toLowerCase()}`}", "aria-label={`Frame ${label.toLowerCase()}`}"],
  ['command: field never disabled by the missing command', 'disabled={disabled || !target.supportedCommands.includes(command)}', 'disabled={disabled}'],
  ['command: blur sends a blank value', 'if(draft[field]?.trim() && draft[field] !== target.box?.[field])', 'if(draft[field] !== target.box?.[field])'],
  ['command: blur sends without a change', 'if(draft[field]?.trim() && draft[field] !== target.box?.[field])', 'if(draft[field]?.trim())'],
  ['command: blur never sends', 'if(draft[field]?.trim() && draft[field] !== target.box?.[field])void send', 'if(false)void send'],
  ['command: wrong element id', 'void send(command,{elementId:target.elementId,[field]:draft[field]})', "void send(command,{elementId:'other',[field]:draft[field]})"],
  ['unrelated: Content panel changed', 'Edit text directly on the slide, or use the existing AI text actions below.', 'Edit text directly on the slide.'],
  ['unrelated: graphic box note changed', 'Box properties affect the surrounding container.', 'Box properties affect the container.'],
  ['unrelated: element header changed', ": target ? 'Selected element' :", ": target ? 'Selected item' :"],
]
let caught = 0
for (const [name, from, to] of mutants) {
  assert.ok(SOURCE.includes(from), `mutant "${name}" no longer matches the source`)
  const broken = SOURCE.replace(from, to)
  assert.notEqual(broken, SOURCE, `mutant "${name}" changes nothing`)
  load(broken, {}, React) // a mutant must be valid code: it is caught by behaviour, not by a syntax error
  let survived = false
  try { await runAll(broken); survived = true } catch { caught++ }
  assert.equal(survived, false, `mutant survived: ${name}`)
}
check(assert.equal, caught, mutants.length)
console.log(`studio-textbox-padding-reachable: ${checks} checks passed (${cleanChecks} on the real source), ${caught}/${mutants.length} mutants caught`)
