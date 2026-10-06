import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Real read-only components and local selection callbacks only; no service hook runs.
let flag = 'true', cells = [], cursor = 0
const refuse = () => { throw new Error('Template-readability fixture refuses all service operations') }
const react = {
  useState(initial) { const index = cursor++; if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial; return [cells[index], value => { cells[index] = typeof value === 'function' ? value(cells[index]) : value }] },
  useEffect() {}, useRef: current => ({ current }), useCallback: callback => callback,
}
const jsx = (type, props, key) => ({ type, props, key })
const imports = { './templates-fidelity.css': {}, './library-account-boundary': { useStudioLibraryAccount:()=>null, libraryAccountIsCurrent:()=>false, libraryAccountCanStart:()=>false },
  react,
  'react/jsx-runtime': { jsx, jsxs: jsx },
  'lucide-react': Object.fromEntries(['ArrowRight', 'FolderOpen', 'Loader2', 'Plus', 'Search', 'X', 'ArrowLeft', 'FileText', 'FileUp', 'Layers', 'LayoutTemplate', 'RefreshCw'].map(name => [name, name])),
  '@/components/layout/app-header': { BackToBuilderButton: 'BackToBuilderButton' },
  './libraries.css': {},
  '@/components/studio-intro-replay': { StudioIntroReplay: 'StudioIntroReplay' },
  '@/components/template-ingest-dialog': { TemplateIngestDialog: 'TemplateIngestDialog' },
  './studio-workflow-action': { StudioWorkflowAction: 'StudioWorkflowAction' },
  '@/hooks/use-templates': { useTemplates: refuse, isTemplateGenerationReady: refuse, templateGenerationStatus: refuse, templateGenerationStatusLabel: refuse, templateGenerationUnavailableReason: refuse },
}
function load(relative, suffix = '') {
  const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8') + suffix
  const compiled = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  assert.equal((compiled.diagnostics || []).filter(entry => entry.category === ts.DiagnosticCategory.Error).length, 0)
  const mod = { exports: {} }
  vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports, fetch: refuse,
    process: { env: { get NEXT_PUBLIC_STUDIO_V4_SHELL() { return flag } } },
    require: name => { assert.ok(name in imports, `Unexpected dependency ${name}`); return imports[name] },
  })
  return mod.exports
}
const controls = load('../components/studio-libraries/library-controls.tsx')
imports['./library-controls'] = controls
// Expose the actual private native Inspector only inside this offline module.
const { TemplateInspector } = load('../components/studio-libraries/templates-workspace.tsx', '\nexport { TemplateInspector }\n')
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : !value || typeof value !== 'object' ? [] : [value, ...nodes(value.props?.children)]
const textOf = value => Array.isArray(value) ? value.map(textOf).join('') : value == null || value === false ? '' : typeof value === 'object' ? textOf(value.props?.children) : String(value)
const expanded = value => Array.isArray(value) ? value.map(expanded) : !value || typeof value !== 'object' ? value : typeof value.type === 'function' ? expanded(value.type(value.props)) : { ...value, props: { ...value.props, children: expanded(value.props?.children) } }
const snapshot = structuredClone(JSON.parse(fs.readFileSync(new URL('./studio-v4/workspace-fixtures.json', import.meta.url), 'utf8')).template)
const slide = snapshot.template_blueprint.slides[0]
slide.elements.push(structuredClone(snapshot.template_blueprint.slides[1].elements[0]))
snapshot.slots = [0, 1].map(index => ({
  slot_id: `synthetic-local-source-${index}`, slide_index: index,
  name: `Synthetic source ${index + 1}`, slide_title: `Original local title ${index + 1}`,
  slide_subtitle: `Original local subtitle ${index + 1}`, abstract_intent: `Complete source intent ${index + 1}`,
  narrative_role: 'Evidence', key_message: `Local key message ${index + 1}`, element_type: 'text_box',
  content_type: 'text', canvas_type: 'content', complete_test_context: 'Long local read-only metadata. '.repeat(100),
}))
const original = JSON.stringify(snapshot)
const render = values => { if (values) cells = values; cursor = 0; return TemplateInspector({ snapshot, slide }) }
for (const enabled of ['true', 'false', 'TRUE', undefined]) {
  flag = enabled
  for (const [scope, label] of [['deck', 'Deck'], ['slide', 'Slide'], ['element', 'Element'], ['source', 'Source slots']]) {
    let tree = render([scope, 0, 0])
    const studio = enabled === 'true'
    assert.equal(tree.type, 'details')
    assert.equal(tree.props.tabIndex, studio ? 0 : undefined)
    assert.equal(tree.props.role, studio ? 'group' : undefined)
    assert.equal(tree.props['aria-label'], studio ? 'Template details: deck, slide, element and source metadata' : undefined)
    const scopes = nodes(tree).filter(node => node.type === 'button')
    assert.deepEqual(scopes.map(node => textOf(node)), ['Deck', 'Slide', 'Element', 'Source slots'])
    assert.equal(scopes.find(node => textOf(node) === label).props['aria-pressed'], true)
    scopes.find(node => textOf(node) === 'Deck').props.onClick()
    assert.equal(cells[0], 'deck', 'same local native scope selection callback')
    tree = render([scope, 0, 0])
    const full = nodes(tree).find(node => node.type === controls.MetadataDisclosure && node.props.label === 'Complete saved snapshot & source metadata')
    assert.equal(full.props.value, snapshot, 'complete original snapshot identity forwarded')
    const dom = expanded(tree)
    const fullPre = nodes(dom).find(node => node.type === 'pre' && textOf(node) === JSON.stringify(snapshot, null, 2))
    assert.ok(fullPre, 'full JSON retained, including values far beyond initial scroll fold')
    assert.equal(fullPre.props.tabIndex, studio ? 0 : undefined)
    assert.equal(fullPre.props['aria-label'], studio ? full.props.label : undefined)
    assert.equal(fullPre.props.role, studio ? 'region' : undefined)
    if (scope === 'element' || scope === 'source') {
      const select = nodes(tree).find(node => node.type === 'select')
      assert.deepEqual(nodes(select).filter(node => node.type === 'option').map(node => node.props.value), [0, 1])
      select.props.onChange({ target: { value: '1' } })
      const updated = render()
      const selected = nodes(updated).find(node => node.type === controls.MetadataDisclosure && node.props.label === (scope === 'element' ? 'Full element contract' : 'Complete source slot'))
      assert.equal(selected.props.value, scope === 'element' ? slide.elements[1] : snapshot.slots[1])
      assert.equal(nodes(updated).find(node => node.type === 'select').props.value, 1)
    }
  }
}
assert.equal(JSON.stringify(snapshot), original, 'all supplied data stay untouched after scope/selection changes')
flag = 'true'
for (const value of [null, undefined]) assert.equal(controls.MetadataDisclosure({ label: 'Complete metadata', value }), null)
for (const value of [false, 0, '', { zero: 0, bool: false, nested: [1, 'all data'], end: 'COMPLETE END' }]) {
  const tree = controls.MetadataDisclosure({ label: 'Complete metadata', value })
  const pre = nodes(tree).find(node => node.type === 'pre')
  assert.equal(textOf(pre), JSON.stringify(value, null, 2))
  assert.equal(pre.props.tabIndex, 0)
  assert.equal(pre.props['aria-label'], 'Complete metadata')
}
cells = []; cursor = 0
const empty = TemplateInspector({ snapshot: { id: 'local-empty', slots: [] } })
assert.equal(cells[0], 'deck', 'native no-slide scope default preserved')
assert.ok(nodes(empty).find(node => node.type === controls.MetadataDisclosure).props.value)
console.log('Template read regions passed: actual MetadataDisclosure/TemplateInspector, literal flags, full JSON/null/falsy values, every original Deck/Slide/Element/Source choice, native element/source selection and complete object identity, unmodified source data/defaults, named keyboard targets. No service hooks, requests or mutations ran; root owns native keyboard-scroll proof.')
