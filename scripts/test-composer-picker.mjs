import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { setImmediate } from 'node:timers/promises'
import ts from 'typescript'

// Execute the real components, hook, and handlers with a minimal hook/JSX
// harness. UI primitives and fetch are mocked; no browser or server is needed.
let cells = [], cursor = 0, effects = []
const react = {
  useState(initial) {
    const index = cursor++
    if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial
    return [cells[index], value => { cells[index] = typeof value === 'function' ? value(cells[index]) : value }]
  },
  useCallback: callback => callback,
  useEffect: effect => { effects.push(effect) },
  useRef: current => ({ current }),
}
function render(component, props, reset = false) {
  if (reset) cells = []
  cursor = 0
  effects = []
  return component(props)
}
const element = (type, props, key) => ({ type, props, key })
const primitives = new Proxy({}, { get: (_, name) => name })
let flag = 'true'
let templates = []
let requests = []
const toasts = []
const imports = {
  react: { ...react, default: react },
  'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'Fragment' },
  'lucide-react': primitives,
  '@/components/ui/dropdown-menu': primitives,
  '@/components/ui/button': primitives,
  '@/components/ui/textarea': primitives,
  '@/components/ui/switch': primitives,
  '@/components/file-chip': primitives,
  '@/components/builder/chat/mention-popover': primitives,
  '@/lib/mdc-mentions': {},
  '@/lib/mdc-flags': { CHAT_MENTIONS: false },
  '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
  '@/lib/config': { features: { enableFileUploads: false }, config: { api: { themeBuilderUrl: 'http://localhost' } } },
  '@/lib/theme-builder': { FALLBACK_THEME_PRESETS: [], isValidThemeHex: value => /^#[\da-f]{6}$/i.test(value) },
  '@/hooks/use-theme-profiles': { useThemeProfiles: () => ({ loading: false, error: null }) },
  '@/hooks/use-toast': { useToast: () => ({ toast: value => toasts.push(value) }) },
}
function load(relative) {
  const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(output, {
    module, exports: module.exports,
    process: { env: { get NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED() { return flag } } },
    require: name => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name] },
    fetch: async url => {
      requests.push(url)
      assert.equal(url, '/api/templates', 'Only the existing legacy list request is allowed')
      return { ok: true, json: async () => ({ templates, count: templates.length }) }
    },
  })
  return module.exports
}
imports['@/hooks/use-templates'] = load('../hooks/use-templates.ts')
const picker = load('../components/builder/template-picker.tsx')
imports['./template-picker'] = picker
const { ChatInput } = load('../components/builder/chat-input.tsx')

function findAll(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap(item => findAll(item, predicate))
  if (!tree || typeof tree !== 'object') return []
  return [...(predicate(tree) ? [tree] : []), ...findAll(tree.props?.children, predicate)]
}
const ready = { blueprint_generation_method: 'llm', blueprint_enrichment_status: 'complete', template_purity_status: 'clean' }
const rows = [
  { id: 'legacy-ready', name: 'Legacy ready', ...ready },
  { id: 'legacy-review', name: 'Legacy review' },
  { id: 'composer', name: 'Composer carrier', ...ready, stage_template_summary: { slide_count: 3 } },
  { id: 'composer-incomplete', name: 'Incomplete Composer descriptor', stage_template_summary: null },
]
for (const enabled of ['true', 'false', undefined]) {
  flag = enabled
  for (const mode of ['generation', 'review']) {
    templates = rows
    requests = []
    const selected = []
    const props = { mode, onSelect: template => selected.push(template.id) }
    render(picker.TemplatePickerContent, props, true)
    for (const effect of effects) effect()
    await setImmediate()
    const tree = render(picker.TemplatePickerContent, props)
    const items = findAll(tree, item => item.type === 'DropdownMenuItem')
    const expectedRows = enabled === 'true' ? rows.slice(0, 2) : rows
    assert.deepEqual(items.map(item => item.key), expectedRows.map(row => row.id))
    for (const item of items) item.props.onClick()
    const expectedSelected = expectedRows.filter(row => mode === 'review' || row.blueprint_generation_method === 'llm')
    assert.deepEqual(selected, expectedSelected.map(row => row.id))
    assert.deepEqual(requests, ['/api/templates'])
  }
}

// Trace the actual ChatInput -> TemplatePicker props and action handlers. The
// production Builder represents flag-off by omitting onOpenComposerLibrary.
const chatProps = {
  inputMessage: '', uploadedFiles: [], pendingActionInput: null,
  user: { id: 'test-owner' }, isLoadingSession: false, buildTheme: { mode: 'auto' },
  templateBuilderEnabled: true, onSelectTemplate: () => assert.fail('Locked legacy selection was invoked'),
}
function chatPicker(overrides) {
  const tree = render(ChatInput, { ...chatProps, ...overrides }, true)
  return findAll(tree, item => item.type === picker.TemplatePicker)[0]
}
for (const libraryEnabled of [true, false]) {
  for (const locked of [true, false]) {
    let opened = 0
    const entry = chatPicker({
      templateSelectionLocked: locked,
      onOpenComposerLibrary: libraryEnabled ? () => { opened++ } : undefined,
    })
    assert.ok(entry)
    const tree = render(picker.TemplatePicker, entry.props, true)
    const trigger = findAll(tree, item => item.type === 'button')[0]
    assert.equal(Boolean(trigger.props.disabled), locked && !libraryEnabled)
    assert.equal(findAll(tree, item => item.type === picker.TemplatePickerContent).length, locked && libraryEnabled ? 0 : 1)
    const actions = findAll(tree, item => item.type === 'DropdownMenuItem' && item.props.onSelect)
    assert.equal(actions.length, libraryEnabled ? 1 : 0)
    if (libraryEnabled) {
      actions[0].props.onSelect()
      assert.equal(opened, 1, 'Library still opens when legacy selection is locked')
    }
    if (locked && libraryEnabled) assert.equal(findAll(tree, item => item.type === 'DropdownMenuItem' && item.props.disabled).length, 1)
  }
}
for (const unavailable of [{ user: null }, { isLoadingSession: true }]) {
  const entry = chatPicker({ ...unavailable, onOpenComposerLibrary: () => {}, templateSelectionLocked: true })
  const tree = render(picker.TemplatePicker, entry.props, true)
  assert.equal(findAll(tree, item => item.type === 'button')[0].props.disabled, true)
}
assert.equal(chatPicker({ templateBuilderEnabled: false }), undefined)
const libraryOnly = chatPicker({ templateBuilderEnabled: false, onOpenComposerLibrary: () => {}, templateSelectionLocked: true })
const libraryOnlyTree = render(picker.TemplatePicker, libraryOnly.props, true)
assert.equal(findAll(libraryOnlyTree, item => item.type === 'button')[0].props.disabled, false)
assert.equal(findAll(libraryOnlyTree, item => item.type === picker.TemplatePickerContent || item.props.disabled).length, 0)

console.log('Composer picker: flag-on Stage exclusion in generation/review; unchanged flag-off lists; independent library access; legacy, authentication and session locks passed.')
