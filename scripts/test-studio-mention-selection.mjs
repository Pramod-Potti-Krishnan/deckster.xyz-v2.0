import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Actual mention filtering, native leaf and composer; no effects/service calls run.
let flag = 'true', refs = []
const refuse = () => { throw new Error('Mention fixture refuses every service operation') }
const jsx = (type, props, key) => ({ type, props, key })
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : !value || typeof value !== 'object' ? [] : [value, ...nodes(value.props?.children)]
const imports = {
  react: { useState: value => [value, () => {}], useRef: current => { const ref = { current }; refs.push(ref); return ref }, useEffect() {}, useCallback: callback => callback },
  'react/jsx-runtime': { jsx, jsxs: jsx },
  'lucide-react': Object.fromEntries(['Layers','Globe','SlidersHorizontal','Paperclip','ArrowUp','Square','Loader2','Search','Brain','LayoutTemplate','Palette','Save','Star','Trash2','X','CheckCircle2','AlertCircle'].map(name => [name,name])),
  '@/components/ui/button': { Button: 'Button' }, '@/components/ui/textarea': { Textarea: 'textarea' }, '@/components/ui/switch': { Switch: 'Switch' }, '@/components/file-chip': { FileChip: 'FileChip' },
  '@/components/ui/dropdown-menu': { DropdownMenu: 'DropdownMenu', DropdownMenuTrigger: 'DropdownMenuTrigger', DropdownMenuContent: 'DropdownMenuContent' },
  '@/lib/config': { features: { enableFileUploads: true }, config: { api: { themeBuilderUrl: 'fixture.invalid' } } },
  '@/lib/theme-builder': { FALLBACK_THEME_PRESETS: [], normalizeThemePresetId: value => value, isValidThemeHex: () => true },
  '@/lib/mdc-flags': { CHAT_MENTIONS: true },
  '@/hooks/use-templates': { isTemplateGenerationReady: () => false, templateGenerationUnavailableReason: () => '' },
  '@/hooks/use-theme-profiles': { useThemeProfiles: () => ({ loading: false, error: null, listThemes: refuse, saveTheme: refuse, setStandardTheme: refuse, clearStandardTheme: refuse, deleteTheme: refuse }) },
  './template-picker': { TemplatePicker: 'TemplatePicker' }, './studio-director.css': {},
  './studio-theme-menu': { StudioThemeMenu: 'StudioThemeMenu' },
}
function load(relative) {
  const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8')
  const result = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  assert.equal((result.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error).length, 0)
  const mod = { exports: {} }
  vm.runInNewContext(result.outputText, { module: mod, exports: mod.exports, process: { env: { get NEXT_PUBLIC_STUDIO_V4_SHELL() { return flag } } }, fetch: refuse, require: name => { assert.ok(name in imports, `Unexpected mention dependency ${name}`); return imports[name] } })
  return mod.exports
}
const mentions = load('../lib/mdc-mentions.ts')
imports['@/lib/mdc-mentions'] = mentions
const { SlideMentionPopover } = load('../components/builder/chat/mention-popover.tsx')
imports['@/components/builder/chat/mention-popover'] = { SlideMentionPopover }
const { ChatInput } = load('../components/builder/chat-input.tsx')
const slides = Array.from({ length: 15 }, (_, index) => ({ index, slide_id: `native-supplied-${index}`, title: index === 1 ? 'Complete long native title — ' + 'unbroken-native-source-name'.repeat(8) + ' END' : `Native slide ${index + 1}` }))
const original = JSON.stringify(slides)
for (const enabled of ['true','false','TRUE',undefined]) {
  flag = enabled
  for (const query of ['', 'Complete long', '15', 'No matches']) {
    const expected = mentions.filterMentionSlides(slides, query).slice(0, 12)
    const selected = [], focus = []
    const tree = SlideMentionPopover({ slides, query, onSelect: value => selected.push(value), onKeyboardSelect: () => focus.push('local focus callback') })
    if (!expected.length) { assert.equal(tree, null); continue }
    const buttons = nodes(tree).filter(node => node.type === 'button')
    assert.deepEqual(buttons.map(node => node.key), expected.map(slide => slide.index))
    for (const [index, button] of buttons.entries()) {
      const title = nodes(button).find(node => node.type === 'span' && node.props.children === expected[index].title)
      assert.ok(title, 'full native title remains exact')
      let prevented = 0
      button.props.onMouseDown({ preventDefault: () => prevented++ })
      assert.equal(prevented, 1); assert.equal(selected.at(-1), expected[index])
      const count = selected.length
      if (enabled === 'true') {
        button.props.onClick({ detail: 1 }); assert.equal(selected.length, count, 'mouse click does not duplicate native mousedown selection')
        assert.equal(focus.length, index)
        button.props.onClick({ detail: 0 }); assert.equal(selected.length, count + 1)
        assert.equal(selected.at(-1), expected[index]); assert.equal(focus.length, index + 1)
      } else assert.equal(button.props.onClick, undefined, 'classic has no added activation handler')
    }
  }
  let sends = 0, draft = '', focused = 0
  const props = { inputMessage: 'Retain context @Complete', onInputChange: value => { draft = value }, onSubmit: () => sends++, uploadedFiles: [], onFilesSelected: refuse, onRemoveFile: refuse, onClearAllFiles: refuse, pendingActionInput: null, onCancelAction: refuse,
    researchEnabled: false, onResearchEnabledChange: refuse, webSearchEnabled: false, onWebSearchEnabledChange: refuse, knowledgeGraphEnabled: false, onKnowledgeGraphEnabledChange: refuse, showKnowledgeGraphToggle: false, knowledgeGraphAccess: 'unavailable', onKnowledgeGraphAccessClick: refuse,
    isReady: true, isLoadingSession: false, connected: true, connecting: false, user: { id: 'local-props' }, currentSessionId: 'local-props', onRequestSession: refuse, buildTheme: { mode: 'auto' }, onBuildThemeChange: refuse, mentionSlides: slides }
  refs = []
  const tree = ChatInput(props)
  const input = nodes(tree).find(node => node.type === 'textarea')
  const focusOptions = []
  input.props.ref.current = { focus: options => { focused++; focusOptions.push({ ...options }) } }
  const nativePopover = nodes(tree).find(node => node.type === SlideMentionPopover)
  assert.equal(typeof nativePopover.props.onKeyboardSelect, enabled === 'true' ? 'function' : 'undefined')
  const popover = SlideMentionPopover(nativePopover.props)
  const row = nodes(popover).find(node => node.type === 'button')
  if (enabled === 'true') {
    row.props.onClick({ detail: 0 })
    assert.equal(draft, `Retain context ${mentions.mentionToken(slides[1])} `)
    assert.equal(focused, 1); assert.deepEqual(focusOptions, [{ preventScroll: true }])
    assert.equal(sends, 0, 'keyboard row selection only prefills; never submits')
    row.props.onMouseDown({ preventDefault() {} }); row.props.onClick({ detail: 1 })
    assert.equal(focused, 1, 'native pointer selection keeps original focus behavior')
  }
  for (const key of ['Enter','Tab']) {
    let prevented = 0
    input.props.onKeyDown({ key, shiftKey: false, preventDefault: () => prevented++ })
    assert.equal(prevented, 1); assert.equal(sends, 0)
    assert.equal(draft, `Retain context ${mentions.mentionToken(slides[1])} `)
  }
}
assert.equal(JSON.stringify(slides), original)
console.log('Actual mention/composer passed: complete native titles, same filter/12 cap/IDs, unchanged mousedown focus, keyboard-only row selection once, native token serialization, preventScroll composer focus, Enter/Tab first-match no-send and literal/classic callback gates. No service requests or effects ran.')
