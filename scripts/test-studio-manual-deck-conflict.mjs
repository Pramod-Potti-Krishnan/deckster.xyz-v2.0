import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Actual leaf only; no workflow hook, services, build or persistence are loaded.
const source = fs.readFileSync(new URL('../components/builder/manual-deck-conflict-dialog.tsx', import.meta.url), 'utf8')
const options = { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
const compiled = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: options })
assert.equal((compiled.diagnostics || []).filter(entry => entry.category === ts.DiagnosticCategory.Error).length, 0)
const jsx = (type, props, key) => ({ type, props, key })
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : !value || typeof value !== 'object' ? [] : [value, ...nodes(value.props?.children)]
const textOf = value => Array.isArray(value) ? value.map(textOf).join('') : value == null || value === false ? '' : typeof value === 'object' ? textOf(value.props?.children) : String(value)
class LocalElement {
  constructor(ownerDocument) { this.ownerDocument = ownerDocument; this.isConnected = true; this.children = []; this.focusCalls = [] }
  contains(node) { return node === this || this.children.includes(node) }
  focus(options) { this.focusCalls.push(options); this.ownerDocument.activeElement = this }
}
function fixture(flag) {
  const document = { activeElement: null, dialogs: [], querySelectorAll: () => document.dialogs }
  document.body = new LocalElement(document)
  const refs = []
  const imports = {
    react: { useRef: initial => { const ref = { current: initial }; refs.push(ref); return ref } },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'lucide-react': { History: 'History', Layers3: 'Layers3', Loader2: 'Loader2' },
    '@/components/ui/button': { Button: 'Button' },
    '@/components/ui/alert-dialog': Object.fromEntries(['AlertDialog', 'AlertDialogCancel', 'AlertDialogContent', 'AlertDialogDescription', 'AlertDialogHeader', 'AlertDialogTitle'].map(name => [name, name])),
    './studio-manual-deck-conflict.css': {},
  }
  const mod = { exports: {} }
  vm.runInNewContext(compiled.outputText, {
    module: mod, exports: mod.exports, document, HTMLElement: LocalElement,
    process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: flag } },
    fetch: () => { throw new Error('All service requests refused') },
    require: name => { assert.ok(name in imports, `Unexpected dependency ${name}`); return imports[name] },
  })
  return { document, refs, render: props => mod.exports.ManualDeckConflictDialog(props) }
}
const props = { open: true, summary: { slide_count: 3, element_count: 7 }, onCancel() {}, onPrependGenerated() {}, onStartNewSession() {} }
for (const flag of ['true', 'false', 'TRUE', undefined]) {
  for (const summary of [null, { slide_count: 1, element_count: 0 }, { slide_count: 3, element_count: 1 }, { slide_count: 123, element_count: 456 }]) {
    for (const busy of [false, true]) {
      const test = fixture(flag)
      const error = 'Complete local explanation\n\n' + 'Long supplied error context. '.repeat(100) + 'END OF ERROR'
      let cancelled = 0, prepended = 0, newSessions = 0
      const tree = test.render({ ...props, summary, busy, error, onCancel: () => cancelled++, onPrependGenerated: () => prepended++, onStartNewSession: () => newSessions++ })
      const content = nodes(tree).find(node => node.type === 'AlertDialogContent')
      const choices = nodes(tree).filter(node => node.type === 'Button')
      const cancel = nodes(tree).find(node => node.type === 'AlertDialogCancel')
      const alert = nodes(tree).find(node => node.props?.role === 'alert')
      assert.equal(choices.length, 2)
      assert.ok(textOf(tree).includes('Keep your customized slides?'))
      assert.ok(textOf(tree).includes(`This deck has ${summary?.slide_count ?? 0} customized`))
      assert.ok(textOf(choices[0]).includes('Add generated slides above my slides'))
      assert.ok(textOf(choices[1]).includes('Save this as previous and build in a new session'))
      assert.equal(choices[0].props.disabled, busy)
      assert.equal(choices[1].props.disabled, busy)
      assert.equal(cancel.props.disabled, busy)
      assert.equal(textOf(alert), error, 'full error retained without clipping/truncation in the native data')
      tree.props.onOpenChange(true)
      tree.props.onOpenChange(false)
      assert.equal(cancelled, busy ? 0 : 1, 'existing busy cancel guard')
      choices[0].props.onClick()
      choices[1].props.onClick()
      assert.equal(prepended, 1)
      assert.equal(newSessions, 1, 'original callback identities retained; disabled prevents native user activation')
      assert.equal(nodes(tree).some(node => node.type === 'Loader2'), busy)
      const studio = flag === 'true'
      assert.equal(content.props['data-studio-manual-deck-conflict'], studio ? 'true' : undefined)
      assert.equal(content.props['aria-busy'], studio ? busy : undefined)
      assert.equal(alert.props.tabIndex, studio ? 0 : undefined)
      assert.equal(choices[0].props.autoFocus, studio ? undefined : true)
      assert.equal(typeof content.props.onOpenAutoFocus, studio ? 'function' : 'undefined')
      assert.equal(typeof content.props.onCloseAutoFocus, studio ? 'function' : 'undefined')
    }
  }
}
const defaultTree = fixture('true').render(props)
assert.equal(nodes(defaultTree).some(node => node.props?.role === 'alert'), false)
assert.equal(nodes(defaultTree).find(node => node.type === 'Button').props.disabled, false)

for (const condition of ['return', 'body-on-close', 'disconnected', 'unrelated-focus', 'new-dialog', 'inside-at-open', 'body-at-open']) {
  const test = fixture('true')
  const content = nodes(test.render(props)).find(node => node.type === 'AlertDialogContent')
  const opener = new LocalElement(test.document), dialog = new LocalElement(test.document), cancel = new LocalElement(test.document)
  dialog.children.push(cancel)
  content.props.ref.current = dialog
  test.document.activeElement = condition === 'inside-at-open' ? cancel : condition === 'body-at-open' ? test.document.body : opener
  let prevented = 0
  content.props.onOpenAutoFocus()
  // The native AlertDialog then focuses Cancel; it is not replaced by the leaf.
  test.document.activeElement = cancel
  if (condition === 'body-on-close') { test.document.activeElement = test.document.body; content.props.ref.current = null; dialog.isConnected = false }
  if (condition === 'disconnected') opener.isConnected = false
  if (condition === 'unrelated-focus') test.document.activeElement = new LocalElement(test.document)
  if (condition === 'new-dialog') test.document.dialogs.push(new LocalElement(test.document))
  content.props.onCloseAutoFocus({ preventDefault: () => prevented++ })
  const returns = condition === 'return' || condition === 'body-on-close'
  assert.equal(opener.focusCalls.length, returns ? 1 : 0, `${condition}: safe opener restoration`)
  assert.equal(prevented, returns ? 1 : 0)
  if (returns) assert.equal(opener.focusCalls[0].preventScroll, true)
  assert.equal(test.refs[2].current, null, 'discard consumed opener')
}
const specimen = fs.readFileSync(new URL('./studio-v4/ten-hour-manual-deck-conflict-fixture.tsx', import.meta.url), 'utf8')
const specimenSyntax = ts.transpileModule(specimen, { reportDiagnostics: true, compilerOptions: options })
assert.equal((specimenSyntax.diagnostics || []).filter(entry => entry.category === ts.DiagnosticCategory.Error).length, 0)
assert.match(specimen, /import \{ ManualDeckConflictDialog \} from '@\/components\/builder\/manual-deck-conflict-dialog'/)
assert.match(specimen, /import \{ PresentationViewer \} from '@\/components\/presentation-viewer'/)
assert.match(specimen, /isGenerating=\{false\}/)
assert.doesNotMatch(specimen, /\bfetch\s*\(|useDeckster|createSession|onRequestSession/)
console.log('Native ManualDeckConflictDialog passed: literal-shell markers, all counts/null, unchanged two choices/callbacks/busy/cancel/spinner/defaults, complete errors, keyboard-scroll props and safe focus return guards; specimen directly mounts actual leaf/viewer with local counters/draft only. No services loaded or requests executed. Root owns real Radix/browser proof.')
