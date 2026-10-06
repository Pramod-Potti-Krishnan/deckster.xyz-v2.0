import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { readAtlasBaseline } from './atlas-witness-baseline.mjs'
import ts from 'typescript'
import postcss from 'postcss'

const path = 'components/studio-libraries/library-controls.tsx'
const source = fs.readFileSync(path, 'utf8')
const baseline = readAtlasBaseline(`536dbd2:${path}`)
const restored = source.replace('children, actions, workspaceId }: {', 'children, actions }: {')
  .replace('; workspaceId?: string', '')
  .replace('workspaceId ?? title.toLowerCase()', 'title.toLowerCase()')
  .replace(', readingLabel }: { children: ReactNode; error?: boolean; readingLabel?: string }', ' }: { children: ReactNode; error?: boolean }')
  .replace("  const studioReading = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && Boolean(readingLabel)\n", '')
  .replace(/ data-studio-library-notice-reading=\{studioReading \? 'true' : undefined\} tabIndex=\{studioReading \? 0 : undefined\} aria-label=\{studioReading \? readingLabel : undefined\}/, '')
assert.equal(restored, baseline, 'All original library controls/notice children/roles remain exact')
const workspacePath = 'components/studio-libraries/templates-workspace.tsx'
const workspace = fs.readFileSync(workspacePath, 'utf8')
// Exact retained readiness notice and read-only status/inspector/optimization
// contracts. Account guards deliberately change starts/continuations; they do
// not make the old whole-leaf equality claim truthful.
const parse=value=>ts.createSourceFile('templates.tsx',value,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
const find=(node,predicate)=>{if(predicate(node))return node;let found;ts.forEachChild(node,n=>{if(!found)found=find(n,predicate)});return found}
const prior=readAtlasBaseline(`e3b118a:${workspacePath}`)
const currentAst=parse(workspace),priorAst=parse(prior),printer=ts.createPrinter({removeComments:true})
for(const [name,predicate]of[
 ...['TemplateStatus','withOptimizationResult','TemplateInspector'].map(name=>[name,n=>ts.isFunctionDeclaration(n)&&n.name?.text===name]),
 ['complete generation readiness notice',n=>ts.isJsxElement(n)&&n.openingElement.tagName.getText()==='LibraryNotice'&&n.openingElement.attributes.properties.some(a=>ts.isJsxAttribute(a)&&a.name.getText()==='readingLabel')],
]){
 const a=find(currentAst,predicate),b=find(priorAst,predicate);assert.ok(a&&b,name)
 assert.equal(printer.printNode(ts.EmitHint.Unspecified,a,currentAst),printer.printNode(ts.EmitHint.Unspecified,b,priorAst),`${name} remains exact`)
}
assert.equal((workspace.match(/readingLabel=/g) || []).length, 1, 'Only readiness warning opts in')
assert(workspace.includes('{!isTemplateGenerationReady(snapshot) && <LibraryNotice readingLabel="Template generation readiness"'))
const css = fs.readFileSync('components/studio-libraries/libraries.css', 'utf8'); postcss.parse(css)
assert(css.includes('.sl-preview-panel > .sl-notice { max-height: 88px; overflow-y: auto;'))
assert(css.includes('[data-studio-library-notice-reading="true"]:focus-visible { outline: 2px solid var(--sl-accent); outline-offset: -2px; }'))
const narrow = postcss.parse(css).nodes.find(rule => rule.type === 'atrule' && rule.name === 'media' && rule.params === '(max-width: 820px)' && rule.nodes.some(child => child.selector?.includes('[data-studio-library-notice-reading="true"]')))
assert(narrow, 'Narrow correction uses exact native opt-in marker only')
assert.equal(narrow.nodes.length, 1)
assert.equal(narrow.nodes[0].selector, '[data-studio-v4-shell="true"] .studio-library [data-studio-library-notice-reading="true"]')
assert.deepEqual(Object.fromEntries(narrow.nodes[0].nodes.map(declaration => [declaration.prop, declaration.value])), { 'max-height': 'min(176px, 25dvh)', 'overflow-y': 'auto', 'overscroll-behavior': 'contain', 'scrollbar-width': 'thin' })
let calls = 0
const refuse = () => { calls++; throw new Error('No service or hook work permitted') }
const node = (type, props) => ({ type, props: props || {} })
function load(text, flag) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(text, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    exports, module: { exports }, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: flag } }, fetch: refuse,
    require(id) {
      if (id === 'react') return { useEffect: refuse, useRef: refuse, useState: refuse, useCallback: refuse }
      if (id === 'react/jsx-runtime') return { jsx: node, jsxs: node }
      if (id.endsWith('.css')) return {}
      if (id === 'lucide-react') return new Proxy({}, { get: (_target, key) => key })
      if (id === '@/components/layout/app-header') return { BackToBuilderButton: 'BackToBuilderButton' }
      if (id === '@/components/studio-intro-replay') return { StudioIntroReplay: 'StudioIntroReplay' }
      throw new Error(`Unexpected import ${id}`)
    },
  }); return exports
}
const children = ['Exact readiness reason', node('p', { children: `Optimization: ${'Returned failure text '.repeat(180)}[OPTIMIZATION END]` }), node('p', { children: `Cleanup: ${'Returned cleanup text '.repeat(180)}[CLEANUP END]` })]
let cases = 0
for (const flag of ['true', 'false', undefined, '1']) for (const error of [false, true]) for (const label of [undefined, '', 'Template generation readiness']) {
  const props = { children, error, readingLabel: label }
  const tree = load(source, flag).LibraryNotice(props)
  const active = flag === 'true' && Boolean(label)
  assert.equal(tree.props.role, error ? 'alert' : 'status'); assert.equal(tree.props.children, children)
  assert.equal(tree.props.tabIndex, active ? 0 : undefined)
  assert.equal(tree.props['aria-label'], active ? label : undefined)
  assert.equal(tree.props['data-studio-library-notice-reading'], active ? 'true' : undefined)
  if (!active) assert.equal(JSON.stringify(tree), JSON.stringify(load(baseline, flag).LibraryNotice(props)), 'Classic and nonopted notices unchanged')
  cases++
}
const native = load(fs.readFileSync('hooks/use-templates.ts', 'utf8'))
for (const [enrichment, purity, expected] of [['failed', 'pending', 'failed'], ['complete', 'failed', 'needs_cleanup'], ['failed', 'failed', 'needs_cleanup'], ['complete', 'clean', 'ready']]) {
  const snapshot = { id: 'returned-template', name: 'Returned template', blueprint_generation_method: 'llm', blueprint_enrichment_status: enrichment, template_purity_status: purity, blueprint_enrichment_error: '[OPTIMIZATION END]', template_purity_error: '[CLEANUP END]' }
  const saved = JSON.stringify(snapshot)
  assert.equal(native.templateGenerationStatus(snapshot), expected)
  assert.equal(native.isTemplateGenerationReady(snapshot), expected === 'ready')
  assert.equal(typeof native.templateGenerationUnavailableReason(snapshot), 'string')
  assert.equal(JSON.stringify(snapshot), saved, 'Readiness helpers do not modify supplied native fields')
  cases++
}
assert.equal(calls, 0)
console.log(`PASS ${cases} named warning/flag/role/content/classic/native-readiness cases; zero hooks, requests or actions`)
