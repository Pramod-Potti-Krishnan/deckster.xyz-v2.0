// Actual legacy component callbacks, local state only. No iframe, app runtime,
// provider, auth, persistence, network or transport acknowledgement is loaded.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
const root = new URL('../', import.meta.url), beforeRevision = '412cc6c'
const read = file => fs.readFileSync(new URL(file, root), 'utf8')
const before = file => execFileSync('git', ['show', `${beforeRevision}:${file}`], { cwd: root, encoding: 'utf8' })
const parentFile = 'components/textbox-format-panel/index.tsx', aiFile = 'components/textbox-format-panel/ai-tab.tsx'
const removed = '              sessionId={sessionId}\n              onGetElementHtml={onGetElementHtml}\n'
assert.equal(before(parentFile).split(removed).length, 2)
const preFormatter = execFileSync('git', ['show', `c339e8c:${parentFile}`], { cwd: root, encoding: 'utf8' })
assert.equal(preFormatter, before(parentFile).replace(removed, ''), 'Historical c339e8c removes only the two unused child attributes')
const canonical = source => ts.createPrinter({ removeComments: true }).printFile(ts.createSourceFile(parentFile, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX))
const withoutFormatterAdditions = read(parentFile)
  .replace("import { useState, useCallback, useEffect, useRef } from 'react'", "import { useState, useCallback } from 'react'")
  .replace("import '@/components/builder/studio-format-failures.css'\n", '')
  .replace(/\nconst STUDIO_FORMAT_FAILURES[\s\S]*?\nexport function /, '\nexport function ')
  .replace(/  const formatTargetKey =[^\n]*\n  const formatFeedback = useStudioFormatFeedback[^\n]*\n  const applying =[^\n]*\n\n/, '')
  .replace(/\{STUDIO_FORMAT_FAILURES && formatFeedback.failure !== null && \([\s\S]*?\n\s*\)\}\n\n\s*/, '')
  .replace('STUDIO_FORMAT_FAILURES ? formatFeedback.run : handleSendCommand', 'handleSendCommand')
    .replace('STUDIO_FORMAT_FAILURES ? formatFeedback.runNative : handleSendCommand', 'handleSendCommand')
    .replace("STUDIO_FORMAT_FAILURES ? formatTargetKey : elementId || 'no-selection'", "elementId || 'no-selection'")
    .replaceAll('key={STUDIO_FORMAT_FAILURES ? formatTargetKey : undefined}\n', '')
  .replaceAll('isApplying={applying}', 'isApplying={isApplying}')
  .replaceAll('{applying && (', '{isApplying && (')
assert.equal(canonical(withoutFormatterAdditions), canonical(preFormatter), 'Only known literal-Studio formatter additions differ from c339e8c; full original parent AST/callbacks/AI/props/classic markup remain exact')
assert.equal(read(aiFile), before(aiFile), 'Complete native specialized AI consumer unchanged')
assert.equal(read(aiFile), execFileSync('git', ['show', `1f1214fb:${aiFile}`], { cwd: root, encoding: 'utf8' }))
let checks = 4
const compile = source => {
  const result = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } })
  assert.deepEqual((result.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error), [])
  return result.outputText
}
const jsx = (type, props) => ({ type, props: props || {} })
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : !tree || typeof tree !== 'object' ? [] : [tree, ...nodes(tree.props?.children)]
const find = (tree, test) => { const found = nodes(tree).filter(test); assert.equal(found.length, 1); return found[0] }
const text = value => Array.isArray(value) ? value.map(text).join('') : typeof value === 'string' ? value : value && typeof value === 'object' ? text(value.props?.children) : ''
const button = (tree, label) => find(tree, node => node.type === 'button' && text(node) === label)
const group = (tree, first) => find(tree, node => node.type === 'ButtonGroup' && node.props.options[0].value === first)
const plain = value => JSON.parse(JSON.stringify(value))
function load(file, exportName, props) {
  const state = []; let cursor = 0
  const mod = { exports: {} }
  const reject = () => { throw new Error('Offline legacy test refuses all services and iframe access') }
  vm.runInNewContext(compile(read(file)), {
    module: mod, exports: mod.exports, fetch: reject, Error, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: 'false' } },
    require: name => {
      if (name === 'react') return { useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value }] }, useCallback: callback => callback, useEffect() {}, useRef(initial) { const i = cursor++; if (!(i in state)) state[i] = { current: initial }; return state[i] } }
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx }
      if (name === '@/lib/utils') return { cn: (...values) => values.filter(Boolean).join(' ') }
      if (name === '@/components/builder/studio-panels.css' || name === '@/components/builder/studio-format-failures.css') return {}
      if (name === '@/components/ui/panel' || name === 'lucide-react' || name === './style-tab' || name === './ai-tab') return new Proxy({}, { get: (_target, key) => key })
      throw new Error(`Offline legacy test refuses dependency ${name}`)
    },
  })
  return { props, render(extra = {}) { cursor = 0; Object.assign(props, extra); return mod.exports[exportName](props) } }
}
function ai(options = {}) {
  const calls = []
  const h = load(aiFile, 'AITab', { isApplying: false, elementId: 'native-element', presentationId: 'native-deck', slideIndex: 3,
    onSendCommand: async (action, params) => { calls.push({ action, params: plain(params) }); return options.result ?? { success: false, error: 'Supplied refusal; no write' } }, ...options.props })
  return { ...h, calls }
}
const quick = [['Shorten','shorten'],['Expand','expand'],['Fix Grammar','grammar'],['Add Bullets','bulletize'],['Simplify','simplify'],['Professional','professional']]
for (const [label, action] of quick) {
  const h = ai(), tree = h.render(); assert.equal(button(tree, label).props.disabled, false)
  await button(tree, label).props.onClick()
  assert.deepEqual(h.calls, [{ action: 'generateTextBoxContent', params: { action, elementId: 'native-element', presentationId: 'native-deck', slideIndex: 3 } }])
  assert.ok(text(h.render()).includes('Supplied refusal; no write')); checks++
}
const h = ai(), tree = h.render()
const tones = group(tree, 'professional').props.options, styles = group(tree, 'expand').props.options
assert.deepEqual(plain(tones), [{value:'professional',label:'Prof'},{value:'casual',label:'Casual'},{value:'persuasive',label:'Pers'},{value:'technical',label:'Tech'}])
assert.deepEqual(plain(styles), [{value:'expand',label:'Expand'},{value:'summarize',label:'Summary'},{value:'rewrite',label:'Rewrite'}]); checks += 2
for (const tone of tones) for (const style of styles) {
  const h = ai(); let tree = h.render()
  find(tree, n => n.type === 'textarea').props.onChange({target:{value:'  Keep the exact native prompt  '}})
  group(h.render(), 'professional').props.onChange(tone.value); group(h.render(), 'expand').props.onChange(style.value)
  await button(h.render(), 'Generate Content').props.onClick()
  assert.deepEqual(h.calls, [{action:'generateTextBoxContent',params:{prompt:'Keep the exact native prompt',tone:tone.value,style:style.value,elementId:'native-element',presentationId:'native-deck',slideIndex:3}}])
  assert.equal(find(h.render(), n => n.type === 'textarea').props.value, '  Keep the exact native prompt  ')
  group(h.render(), 'professional').props.onChange(tone.value); group(h.render(), 'expand').props.onChange(style.value)
  assert.equal(group(h.render(), 'professional').props.value, null); assert.equal(group(h.render(), 'expand').props.value, null)
  await button(h.render(), 'Generate Content').props.onClick()
  assert.deepEqual(h.calls[1].params, {prompt:'Keep the exact native prompt',elementId:'native-element',presentationId:'native-deck',slideIndex:3}); checks++
}
for (const input of ['', '   ', '\n\t']) {
  const h = ai(); find(h.render(), n => n.type === 'textarea').props.onChange({target:{value:input}})
  assert.equal(button(h.render(), 'Generate Content').props.disabled, true)
  await button(h.render(), 'Generate Content').props.onClick()
  assert.equal(h.calls.length, 0); assert.ok(text(h.render()).includes('Please enter a prompt')); checks++
}
for (const result of [{success:true}, {success:false}, {success:false,error:'Native supplied error'}]) {
  const h = ai({result}); find(h.render(), n => n.type === 'textarea').props.onChange({target:{value:'Native local draft'}})
  await button(h.render(), 'Generate Content').props.onClick()
  assert.equal(find(h.render(), n => n.type === 'textarea').props.value, result.success ? '' : 'Native local draft')
  if (!result.success) assert.ok(text(h.render()).includes(result.error || 'Failed to generate content'))
  assert.equal(button(h.render(), 'Generate Content').props.disabled, Boolean(result.success)); checks++
}
for (const quickAction of [true,false]) {
  const h = ai({props:{onSendCommand:async()=>{throw new Error('Supplied native exception')}}})
  find(h.render(), n => n.type === 'textarea').props.onChange({target:{value:'Preserve draft'}})
  await button(h.render(), quickAction ? 'Shorten' : 'Generate Content').props.onClick()
  assert.ok(text(h.render()).includes('Supplied native exception'))
  assert.equal(find(h.render(), n => n.type === 'textarea').props.value, 'Preserve draft'); checks++
}
for (const quickAction of [true,false]) {
  const h = ai({props:{onSendCommand:async()=>{throw 'Supplied non-Error rejection'}}})
  find(h.render(), n => n.type === 'textarea').props.onChange({target:{value:'Preserve fallback draft'}})
  await button(h.render(), quickAction ? 'Shorten' : 'Generate Content').props.onClick()
  assert.ok(text(h.render()).includes(quickAction ? 'Action failed' : 'Failed to generate content'))
  assert.equal(find(h.render(), n => n.type === 'textarea').props.value, 'Preserve fallback draft'); checks++
}
for (const quickAction of [true,false]) {
  let resolve; const wait = new Promise(r => { resolve = r })
  const h = ai({props:{onSendCommand:()=>wait}}); find(h.render(), n => n.type === 'textarea').props.onChange({target:{value:'Local pending draft'}})
  const pending = button(h.render(), quickAction ? 'Shorten' : 'Generate Content').props.onClick(); const busy = h.render()
  for (const [label] of quick) assert.equal(button(busy, label).props.disabled, true)
  assert.equal(button(busy, 'Generating...').props.disabled, true); assert.equal(find(busy, n => n.type === 'textarea').props.disabled, true)
  assert.equal(group(busy,'professional').props.disabled,true); assert.equal(group(busy,'expand').props.disabled,true)
  resolve({success:false}); await pending; assert.equal(button(h.render(),'Generate Content').props.disabled,false); checks++
}
const applying = ai({props:{isApplying:true}}), applyingTree = applying.render()
for (const [label] of quick) assert.equal(button(applyingTree,label).props.disabled,true)
assert.equal(find(applyingTree,n=>n.type==='textarea').props.disabled,false)
assert.equal(group(applyingTree,'professional').props.disabled,false); assert.equal(group(applyingTree,'expand').props.disabled,false)
find(applyingTree,n=>n.type==='textarea').props.onChange({target:{value:'Nonempty applying draft'}})
assert.equal(button(applying.render(),'Generate Content').props.disabled,true); checks++
let resolveParent; const parentWait = new Promise(r=>{resolveParent=r}), deletes=[]
const parent = load(parentFile,'TextBoxFormatPanel',{isOpen:true,onClose(){},elementId:'native-element',formatting:null,onDelete:()=>deletes.push('delete'),
  presentationId:'native-deck',sessionId:'unused-session',onGetElementHtml:()=>{throw new Error('Unused callback must not execute')},onSendCommand:()=>parentWait})
button(parent.render(),'AI').props.onClick(); const child = find(parent.render(),n=>n.type==='AITab')
assert.deepEqual(Object.keys(child.props).sort(),['elementId','isApplying','onSendCommand','presentationId','slideIndex'].sort()); assert.equal(child.props.slideIndex,0)
const parentPending = child.props.onSendCommand('generateTextBoxContent',{action:'shorten'})
assert.equal(find(parent.render(),n=>n.type==='AITab').props.isApplying,true)
resolveParent({success:false,error:'No write'}); assert.deepEqual(await parentPending,{success:false,error:'No write'})
assert.equal(find(parent.render(),n=>n.type==='AITab').props.isApplying,false)
find(parent.render(),n=>n.type==='button'&&n.props.title==='Delete text box').props.onClick(); assert.deepEqual(deletes,['delete'])
assert.equal(parent.render({isOpen:false}),null); checks += 3
const failedParent=load(parentFile,'TextBoxFormatPanel',{isOpen:true,onClose(){},elementId:'native-element',formatting:null,onSendCommand:async()=>{throw new Error('Parent callback rejection')}})
button(failedParent.render(),'AI').props.onClick()
await assert.rejects(find(failedParent.render(),n=>n.type==='AITab').props.onSendCommand('generateTextBoxContent',{}),/Parent callback rejection/)
assert.equal(find(failedParent.render(),n=>n.type==='AITab').props.isApplying,false); checks++
console.log(`Legacy TextBox: ${checks} focused source/options/callback/guard checks passed; no iframe, auth, service, acknowledgement or persistence operation.`)
