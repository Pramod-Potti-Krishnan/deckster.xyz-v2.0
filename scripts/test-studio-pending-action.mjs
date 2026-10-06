import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Render the real native leaves. Explicit dependencies only; all requests refused.
let flag = 'true'
const refuse = () => { throw new Error('Offline pending-action fixture refuses every service request') }
const react = { useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}], useEffect() {}, useRef: current => ({ current }), useCallback: callback => callback }
const jsx = (type, props, key) => ({ type, props, key })
const imports = {
  react: { ...react, default: react },
  'react/jsx-runtime': { jsx, jsxs: jsx },
  'lucide-react': Object.fromEntries(['Sparkles', 'ArrowUpRight', 'BookOpen', 'Lightbulb', 'ListChecks', 'Globe', 'SlidersHorizontal', 'Paperclip', 'ArrowUp', 'Square', 'Loader2', 'Search', 'Brain', 'LayoutTemplate', 'Palette', 'Save', 'Star', 'Trash2', 'X', 'CheckCircle2', 'AlertCircle'].map(name => [name, name])),
  './studio-director-header.css': {},
  '@/components/builder/chat/mention-popover': { SlideMentionPopover: 'SlideMentionPopover' },
  '@/lib/mdc-mentions': { filterMentionSlides: () => [], mentionToken: refuse },
  '@/lib/mdc-flags': { CHAT_MENTIONS: false },
  '@/components/ui/button': { Button: 'Button' },
  '@/components/ui/textarea': { Textarea: 'Textarea' },
  '@/components/file-chip': { FileChip: 'FileChip' },
  '@/components/ui/dropdown-menu': { DropdownMenu: 'DropdownMenu', DropdownMenuContent: 'DropdownMenuContent', DropdownMenuTrigger: 'DropdownMenuTrigger' },
  '@/components/ui/switch': { Switch: 'Switch' },
  '@/lib/config': { config: { api: { themeBuilderUrl: 'fixture.invalid' } }, features: { enableFileUploads: true } },
  '@/lib/theme-builder': { FALLBACK_THEME_PRESETS: [], isValidThemeHex: () => true, normalizeThemePresetId: value => value },
  '@/hooks/use-theme-profiles': { useThemeProfiles: () => ({ loading: false, error: null, listThemes: refuse, saveTheme: refuse, setStandardTheme: refuse, clearStandardTheme: refuse, deleteTheme: refuse }) },
  '@/hooks/use-templates': { isTemplateGenerationReady: () => false, templateGenerationUnavailableReason: () => '' },
  './template-picker': { TemplatePicker: 'TemplatePicker' },
}
function load(relative) {
  const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  assert.equal((compiled.diagnostics || []).filter(entry => entry.category === ts.DiagnosticCategory.Error).length, 0)
  const mod = { exports: {} }
  vm.runInNewContext(compiled.outputText, {
    module: mod, exports: mod.exports, fetch: refuse,
    process: { env: { get NEXT_PUBLIC_STUDIO_V4_SHELL() { return flag } } },
    require: name => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name] },
  })
  return mod.exports
}
const { ChatInput } = load('../components/builder/chat-input.tsx')
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : !value || typeof value !== 'object' ? [] : [value, ...nodes(value.props?.children)]
const textOf = value => Array.isArray(value) ? value.map(textOf).join('') : value == null || value === false ? '' : typeof value === 'object' ? textOf(value.props?.children) : String(value)
const action = { label: 'Original native requires-input label ' + 'CompleteUnbrokenOriginalLabel'.repeat(45) + ' END OF NATIVE ACTION', value: 'native-revise', primary: false, requires_input: true }
const pending = { action, messageId: 'synthetic-local-pending', timestamp: 1 }
const original = JSON.stringify(pending)
for (const enabled of ['true','false','TRUE',undefined]) {
  flag = enabled
  let cancels = 0, sends = 0, edits = 0
  const props = {
    inputMessage: 'Retained native input draft', onInputChange: () => edits++, onSubmit: () => sends++,
    uploadedFiles: [], onFilesSelected: refuse, onRemoveFile: refuse, onClearAllFiles: refuse,
    pendingActionInput: pending, onCancelAction: () => cancels++, researchEnabled: false, onResearchEnabledChange: refuse,
    webSearchEnabled: false, onWebSearchEnabledChange: refuse, knowledgeGraphEnabled: false, onKnowledgeGraphEnabledChange: refuse,
    showKnowledgeGraphToggle: false, knowledgeGraphAccess: 'unavailable', onKnowledgeGraphAccessClick: refuse,
    isReady: true, isLoadingSession: false, connected: true, connecting: false,
    user: { id: 'synthetic-local-props' }, currentSessionId: 'synthetic-local-props', onRequestSession: refuse,
    buildTheme: { mode: 'auto' }, onBuildThemeChange: refuse,
  }
  let tree = ChatInput(props)
  const content = nodes(tree).find(node => node.props?.['data-studio-v4-type-role'] === 'action-content')
  const label = nodes(content).find(node => node.props?.['data-studio-v4-type-role'] === 'action-label')
  const helper = nodes(content).find(node => node.props?.['data-studio-v4-type-role'] === 'action-helper')
  const cancel = nodes(tree).find(node => node.props?.['data-studio-v4-type-role'] === 'action-cancel')
  const area = nodes(tree).find(node => node.type === 'Textarea')
  assert.equal(tree.props['data-studio-v4-type'], undefined, 'TYPE remains off and is not needed for owned shell fit')
  assert.equal(content.props.tabIndex, enabled === 'true' ? 0 : undefined)
  assert.equal(content.props.role, enabled === 'true' ? 'region' : undefined)
  assert.equal(content.props['aria-label'], enabled === 'true' ? 'Pending Director action' : undefined)
  assert.equal(nodes(tree).filter(node => node.props?.['data-studio-composer-pending-action'] === 'true').length, enabled === 'true' ? 1 : 0)
  assert.equal(label.props.children, action.label, 'complete original label including far-end content retained')
  assert.equal(textOf(helper), 'Type your input and press Enter')
  assert.equal(textOf(cancel), 'Cancel'); assert.equal(cancel.props.onClick, props.onCancelAction)
  assert.equal(area.props.value, props.inputMessage)
  assert.equal(sends, 0); assert.equal(edits, 0); assert.equal(cancels, 0, 'rendering/read-region does not submit, edit or cancel')
  cancel.props.onClick(); assert.equal(cancels, 1); assert.equal(sends, 0); assert.equal(edits, 0)
  let prevented = 0
  area.props.onKeyDown({ key: 'Escape', shiftKey: false, preventDefault: () => prevented++ })
  assert.equal(cancels, 2); assert.equal(prevented, 1); assert.equal(sends, 0)
  for (const state of [{ awaitingReply: true }, { isLoadingSession: true }, { isTemplateReuseRunning: true }, { uploadedFiles: [{ id: 'local-upload', name: 'Original pending upload.pdf', status: 'uploading', type: 'application/pdf', size: 100 }] }]) {
    tree = ChatInput({ ...props, ...state })
    assert.equal(nodes(tree).find(node => node.props?.['data-studio-v4-type-role'] === 'action-cancel').props.disabled, undefined, 'native Cancel remains available through existing busy states')
    assert.equal(nodes(tree).find(node => node.type === 'Textarea').props.disabled, Boolean(state.isLoadingSession || state.isTemplateReuseRunning))
  }
  tree = ChatInput({ ...props, pendingActionInput: null, inputMessage: '' })
  assert.equal(nodes(tree).some(node => node.props?.['data-studio-v4-type-role'] === 'action-content'), false)
  assert.equal(nodes(tree).find(node => node.type === 'Textarea').props.value, '', 'owner can supply the existing cleared pending/draft state')
}
assert.equal(JSON.stringify(pending), original, 'native pending action object and full data untouched')
console.log('Actual native pending banner passed: literal shell without TYPE, complete long label/helper/name/read region, exact Cancel callback, original Escape/busy gates, retained/owner-cleared draft states and no render/send effects. Services refused; root owns actual requires-input click and full scroll/Cancel fit proof.')
