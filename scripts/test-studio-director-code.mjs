import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import postcss from 'postcss'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import ReactMarkdown from 'react-markdown'
import { renderToStaticMarkup } from 'react-dom/server'

// Actual MessageList and actual existing Markdown parser; no raw-HTML plugin or service.
let flag = 'true'
const refuse = () => { throw new Error('Director code fixture refuses services, timers and writes') }
const imports = {
  react: { ...React, useMemo: callback => callback(), useState: value => [value, refuse], useRef: current => ({ current }), useEffect() {} },
  'react/jsx-runtime': jsxRuntime, 'react-markdown': ReactMarkdown,
  'lucide-react': { Sparkles: 'span', ExternalLink: 'span', User: 'span', ChevronDown: 'span' },
  '@/components/ui/button': { Button: 'button' }, '@/components/ui/badge': { Badge: 'span' }, '@/components/file-chip': { FileChip: 'FileChip' },
  '@/lib/debug-log': { debugLog() {} }, '@/lib/slide-compose-async': { hasLiveTrackedEphemeralMessage: refuse },
  '@/lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: {} }, '@/lib/layout-viewer-url-policy': { evaluateLayoutViewerUrl: refuse },
  '@/lib/mdc-flags': { CHAT_CLARITY: false, CHAT_QUESTIONS: false }, '@/lib/build-narration-heuristics': { shouldRerouteEphemeral: value => Boolean(value) },
  '@/components/builder/chat/question-card': { QuestionCard: 'QuestionCard' }, '@/components/builder/chat/studio-welcome': { StudioWelcome: 'StudioWelcome' }, '@/components/builder/chat/studio-outline-card': { StudioOutlineCard: 'StudioOutlineCard' }, './studio-director.css': {},
}
function load(relative) {
  const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } })
  assert.equal((compiled.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error).length, 0)
  const mod = { exports: {} }
  vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports, process: { env: { get NEXT_PUBLIC_STUDIO_V4_SHELL() { return flag } } }, fetch: refuse, setTimeout: refuse, clearTimeout: refuse, require: name => { assert.ok(name in imports, `Unexpected code fixture dependency ${name}`); return imports[name] } })
  return mod.exports
}
imports['@/lib/user-message-attachments'] = load('../lib/user-message-attachments.ts')
imports['@/lib/director-transcript'] = load('../lib/director-transcript.ts')
imports['@/lib/director-chat-history'] = load('../lib/director-chat-history.ts')
imports['@/lib/director-ask-identity'] = load('../lib/director-ask-identity.ts')
imports['@/lib/director-history-presentation'] = load('../lib/director-history-presentation.ts')
imports['@/lib/build-progress-visibility'] = load('../lib/build-progress-visibility.ts')
const { MessageList } = load('../components/builder/message-list.tsx')
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : !value || typeof value !== 'object' ? [] : [value, ...nodes(value.props?.children)]
const longCode = 'const original = "<native & value>";\n' + Array.from({ length: 90 }, (_, index) => `native_line_${index} = "${'UnbrokenOriginalValue'.repeat(12)}";`).join('\n') + '\nEND_COMPLETE_NATIVE_CODE\n'
const markdown = '# Native Director reply\n\n##### Native fifth-level heading\n\n###### Native sixth-level heading\n\n---\n\n- Native unordered item\n- Native second item\n\n1. Native ordered item\n2. Native ordered follow-up\n\n> Native quoted evidence\n\n[Native source](https://example.invalid/source)\n\n```text\n' + longCode + '```\n\nInline `original_value` remains exact.\n\n<script>alert("raw source stays text")</script>\n'
const original = { message_id: 'synthetic-code-message', session_id: 'synthetic-code-session', timestamp: '2026-10-02T16:00:00Z', type: 'chat_message', payload: { text: markdown, sub_title: 'Native retained subtitle', list_items: ['Native retained item'] } }
const originalJSON = JSON.stringify(original)
const base = () => ({ userMessages: [], messages: [original], userMessageIdsRef: { current: new Set() }, userMessageContentMapRef: { current: new Map() }, hasSeenWelcomeRef: { current: false }, answeredActionsRef: { current: new Set() }, messagesEndRef: { current: null }, onActionClick: refuse })
for (const enabled of ['true','false','TRUE',undefined]) {
  flag = enabled
  const tree = MessageList(base())
  const renderer = nodes(tree).find(node => node.type === ReactMarkdown)
  assert.ok(renderer); assert.equal(renderer.props.children, markdown, 'entire native message is passed unchanged to the same parser')
  assert.equal(typeof renderer.props.components.pre, enabled === 'true' ? 'function' : 'undefined')
  const rerendered = MessageList({ ...base(), currentStatus: { status: 'idle', text: 'Synthetic changed parent status' } })
  const rerenderedMarkdown = nodes(rerendered).find(node => node.type === ReactMarkdown)
  assert.equal(rerenderedMarkdown.props.components.pre, renderer.props.components.pre, 'native pre renderer reference survives parent/status rerender; changed component identity would remount focus/scroll')
  assert.equal(rerenderedMarkdown.props.children, markdown)

  assert.equal(renderer.props.rehypePlugins, undefined); assert.equal(renderer.props.remarkPlugins, undefined)
  const html = renderToStaticMarkup(renderer)
  assert.match(html, /END_COMPLETE_NATIVE_CODE/); assert.match(html, /native_line_89/)
  assert.match(html, /&lt;native &amp; value&gt;/)
  assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script>/)
  assert.match(html, /<h5>Native fifth-level heading<\/h5>/)
  assert.match(html, /<h6>Native sixth-level heading<\/h6>/)
  assert.match(html, /<hr\s*\/>/)
  assert.match(html, /<ul(?:\s[^>]*)?>/); assert.match(html, /<ol>/); assert.match(html, /<blockquote>/)
  assert.match(html, /Native ordered follow-up/); assert.match(html, /Native quoted evidence/)
  assert.match(html, /class="language-text"/)
  assert.match(html, /target="_blank"/); assert.match(html, /rel="noopener noreferrer"/)
  assert.match(html, /<code>original_value<\/code>/)
  if (enabled === 'true') {
    assert.match(html, /data-studio-director-code="true"/); assert.match(html, /tabindex="0"/); assert.match(html, /role="region"/); assert.match(html, /aria-label="Director code block"/)
    const codeNode = React.createElement('code', { className: 'language-fixture' }, longCode)
    const pre = renderer.props.components.pre({ node: { type: 'element', tagName: 'pre' }, children: codeNode, className: 'native-pre-class', title: 'Native complete code', id: 'native-code-id' })
    assert.equal(pre.type, 'pre'); assert.equal(pre.props.children, codeNode)
    assert.equal(pre.props.className, 'native-pre-class'); assert.equal(pre.props.title, 'Native complete code'); assert.equal(pre.props.id, 'native-code-id')
    assert.equal(pre.props.node, undefined, 'parser node never becomes a DOM attribute')
    assert.equal(nodes(pre).find(node => node.type === 'code').props.children, longCode)
  } else assert.doesNotMatch(html, /data-studio-director-code|tabindex|Director code block/)
  const action = { message_id: 'synthetic-action', timestamp: original.timestamp, type: 'action_request', payload: { prompt_text: 'Native choice', actions: [{ label: 'Exact native action', value: 'existing', primary: true, requires_input: false }] } }
  const actionTree = MessageList({ ...base(), messages: [action] })
  const buttons = nodes(actionTree).filter(node => node.type === 'button')
  assert.equal(buttons.length, enabled === 'true' ? 0 : 1, 'original native structured/classic action branch unchanged')
}
// Source cap check against the native short viewport measured by root. Browser
// focus/scroll geometry remains a separate runtime proof; full code is never clipped.
const css = postcss.parse(fs.readFileSync(new URL('../components/builder/studio-director.css', import.meta.url), 'utf8'))
let nativeCodeCap
css.walkRules(rule => {
  if (rule.selector === '[data-studio-v4-shell="true"] [data-studio-director-code="true"]') {
    rule.walkDecls('max-height', declaration => { nativeCodeCap = declaration.value })
  }
})
const cap = /^min\((\d+(?:\.\d+)?)px,\s*(\d+(?:\.\d+)?)dvh\)$/.exec(nativeCodeCap || '')
assert.ok(cap, 'owned native code region needs both a bounded and responsive viewport cap')
const allowedHeight = height => Math.min(Number(cap[1]), height * Number(cap[2]) / 100)
assert.ok(allowedHeight(600) < 290.75, 'native dark 600px capture chat viewport must fit the capped read region')
assert.ok(allowedHeight(900) <= 320, 'tall viewports retain the original bounded reading region')
assert.ok(allowedHeight(360) < allowedHeight(600), 'shorter viewport reduces cap without deleting content')
assert.equal(JSON.stringify(original), originalJSON, 'original message payload untouched')
console.log('Actual MessageList/Markdown passed: complete long formatted code and inline code, native pre props/child identity and stable renderer across parent/status rerenders, named Studio focus region only, classic parser output, raw HTML remains escaped, original safe links/action branches, native h5/h6/hr/list/blockquote semantics and unchanged full message. No services, timers, mutations or code execution ran; root owns native arrow-scroll proof.')
