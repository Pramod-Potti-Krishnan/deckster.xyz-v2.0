// Isolated actual GenerationInput: UI semantics, native guards/intents, expansion and classic parity.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import postcss from 'postcss'

const require = createRequire(import.meta.url), root = new URL('../', import.meta.url)
const file = 'components/generation-panel/shared/generation-input.tsx'
const source = fs.readFileSync(new URL(file, root), 'utf8')
const original = execFileSync('git', ['show', 'b800c17:' + file], { encoding: 'utf8', cwd: root })
const compile = text => {
  const result = ts.transpileModule(text, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } })
  assert.equal((result.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error).length, 0)
  return result.outputText
}
// J2-F7 (#320) added an opt-in `stableSubmit` prop (default off). These are EXACTLY its additions, each matched by name
// and shape, so any other change to the file still breaks the pin below. --- stableSubmit strip begin
const stableSubmitId = (node, ast) => ts.isIdentifier(node) && node.getText(ast) === 'stableSubmit'
const stableSubmitRemoval = (node, ast) => {
  if (ts.isPropertySignature(node) && node.name.getText(ast) === 'stableSubmit') return 'prop'
  if (ts.isVariableStatement(node) && node.declarationList.declarations.length === 1
    && node.declarationList.declarations[0].name.getText(ast) === 'STABLE_SUBMIT_TEXTAREA_STYLE') return 'const'
  if (ts.isBindingElement(node) && ts.isIdentifier(node.name) && node.name.getText(ast) === 'stableSubmit' && !node.propertyName && !node.initializer) return 'destructure'
  if (ts.isIfStatement(node) && stableSubmitId(node.expression, ast) && !node.elseStatement
    && ts.isReturnStatement(node.thenStatement) && !node.thenStatement.expression) return 'effect guard'
  if (ts.isJsxAttribute(node) && node.name.getText(ast) === 'style'
    && node.initializer?.getText(ast) === '{stableSubmit ? STABLE_SUBMIT_TEXTAREA_STYLE : undefined}') return 'textarea style'
  return null
}
const stableSubmitDeps = (node, ast) => ts.isArrayLiteralExpression(node) && node.elements.some(item => stableSubmitId(item, ast))
// --- stableSubmit strip end
const canonical = (text, strip = false, removed = []) => {
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const result = ts.transform(ast, [context => {
    const visit = node => {
      if (strip) {
        if (ts.isImportDeclaration(node) && node.moduleSpecifier.text === './studio-generation-feedback.css') return undefined
        if (ts.isVariableStatement(node) && node.declarationList.declarations.some(item => item.name.getText(ast) === 'STUDIO_GENERATION_FEEDBACK')) return undefined
        if (ts.isJsxAttribute(node) && node.initializer?.getText(ast).includes('STUDIO_GENERATION_FEEDBACK')) return undefined
        const stable = stableSubmitRemoval(node, ast)
        if (stable) { removed.push(stable); return undefined }
        if (stableSubmitDeps(node, ast)) {
          removed.push('effect deps')
          return ts.visitEachChild(context.factory.updateArrayLiteralExpression(node, node.elements.filter(item => !stableSubmitId(item, ast))), visit, context)
        }
      }
      return ts.visitEachChild(node, visit, context)
    }
    return node => ts.visitNode(node, visit)
  }])
  const printed = ts.createPrinter({ removeComments: true }).printFile(result.transformed[0]); result.dispose(); return printed
}
const removedStable = []
assert.equal(canonical(source, true, removedStable), canonical(original), 'All original algorithms, guards, text, effects, callbacks, layout classes and native options remain AST-exact')
assert.deepEqual([...removedStable].sort(), ['const', 'destructure', 'effect deps', 'effect guard', 'prop', 'textarea style'],
  'the strip removed exactly the stableSubmit additions: the prop, the style const, the destructure, the effect guard and its deps entry, the textarea style (each once)')
const helper = { exports: {} }
vm.runInNewContext(compile(fs.readFileSync(new URL('lib/element-prompt-limit.ts', root), 'utf8')), { module: helper, exports: helper.exports, require })
const Passthrough = ({ children }) => React.createElement('div', null, children)
const find = (tree, predicate, result = []) => {
  if (!tree || typeof tree !== 'object') return result
  if (predicate(tree)) result.push(tree)
  React.Children.forEach(tree.props?.children, child => find(child, predicate, result))
  return result
}
function harness(studio = true, previous = false) {
  const effects = [], ref = { current: { style: {}, scrollHeight: 275 } }, submitted = [], changed = [], toggled = []
  const fakeReact = { ...React, useRef: () => ref, useEffect: callback => effects.push(callback) }, module = { exports: {} }
  vm.runInNewContext(compile(previous ? original : source), { module, exports: module.exports, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: studio ? 'true' : 'false' } }, require: id => id === 'react' ? fakeReact : id === '@/lib/element-prompt-limit' ? helper.exports : id === '@/components/ui/popover' ? { Popover: Passthrough, PopoverTrigger: Passthrough, PopoverContent: Passthrough } : id.endsWith('.css') ? {} : require(id) })
  const render = (extra = {}) => {
    effects.length = 0
    const props = { prompt: 'Native prompt', onPromptChange: value => changed.push(value), mandatoryConfig: null, showAdvanced: false, onToggleAdvanced: () => toggled.push(true), onSubmit: intent => submitted.push(intent), isGenerating: false, error: null, ...extra }
    const tree = module.exports.GenerationInput(props)
    return { tree, html: renderToStaticMarkup(tree) }
  }
  return { effects, ref, submitted, changed, toggled, render }
}
let checks = 1
const diagnostic = 'Native diagnostic with retained multiline detail.\n' + 'Actual diagnostic detail and a long identifier xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx. '.repeat(35)
let h = harness(), rendered = h.render({ error: diagnostic })
const alert = find(rendered.tree, node => node.props['data-studio-generation-feedback'] === 'true')[0]
const details = find(alert, node => node.props['data-studio-generation-feedback-text'] === 'true')[0]
const guidance = find(alert, node => node.props['data-studio-generation-feedback-guidance'] === 'true')[0]
assert.equal(alert.props.role, 'alert')
assert.equal(details.props.role, 'region')
assert.equal(details.props.tabIndex, 0)
assert.equal(details.props['aria-label'], 'Generation error details')
assert.equal(details.props.children, diagnostic)
assert.equal(find(details, node => node.type === 'button').length, 0)
assert.equal(guidance.type, 'button')
assert.equal(find(rendered.tree, node => node.type === 'textarea')[0].props['aria-label'], 'Generation prompt')
checks++
for (const strategy of [undefined, 'resume_same_attempt', 'start_fresh_attempt', 'do_not_retry']) for (const blocked of ['none', 'busy', 'limit']) {
  h = harness()
  const config = blocked === 'limit' ? { fieldLabel: 'Source', displayLabel: 'Prompt', promptMaxLength: 3 } : null
  rendered = h.render({ error: diagnostic, retryStrategy: strategy, isGenerating: blocked === 'busy', mandatoryConfig: config })
  const buttons = find(rendered.tree, node => node.type === 'button'), primary = buttons.find(node => Boolean(node.props.title)), retry = find(rendered.tree, node => node.props['data-studio-generation-feedback-guidance'] === 'true')[0]
  const generate = buttons.find(node => String(node.props.title ?? '').includes('⌘↵') || node.props.title === 'Shorten the prompt before generating')
  assert.equal(generate.props.disabled, blocked !== 'none')
  assert.equal(generate.props['aria-label'], generate.props.title)
  generate.props.onClick()
  assert.deepEqual(h.submitted, blocked === 'none' ? [strategy === 'resume_same_attempt' ? 'retry' : 'generate'] : [])
  if (strategy === 'do_not_retry') {
    assert.equal(retry.type, 'p')
    assert.equal(retry.props.children, 'Update the prompt or settings before generating again.')
  } else {
    const expectedLabel = strategy === 'resume_same_attempt' ? 'Check generation result' : strategy === 'start_fresh_attempt' ? 'Try fresh generation' : 'Try again'
    assert.equal(React.Children.toArray(retry.props.children).filter(child => typeof child === 'string').join(''), expectedLabel)
    assert.equal(retry.props.disabled, blocked !== 'none')
    retry.props.onClick()
    assert.deepEqual(h.submitted, blocked === 'none' ? [strategy === 'resume_same_attempt' ? 'retry' : 'generate', 'retry'] : [])
  }
  const textarea = find(rendered.tree, node => node.type === 'textarea')[0]
  assert.equal(textarea.props.disabled, blocked === 'busy')
  assert.equal(textarea.props['aria-invalid'], blocked === 'limit')
  assert.equal(textarea.props['aria-describedby'], blocked === 'limit' ? 'generation-prompt-limit' : undefined)
  checks++
}
for (const showAdvanced of [false, true]) {
  h = harness(); rendered = h.render({ showAdvanced })
  const advanced = find(rendered.tree, node => node.type === 'button' && String(node.props.title).includes('advanced options'))[0]
  assert.equal(advanced.props['aria-label'], advanced.props.title)
  assert.equal(advanced.props['aria-expanded'], showAdvanced)
  advanced.props.onClick(); assert.deepEqual(h.toggled, [true]); checks++
}
h = harness(); rendered = h.render({ prompt: '😀😀😀😀', mandatoryConfig: { fieldLabel: 'Source', displayLabel: 'Prompt', promptMaxLength: 3 } })
assert.match(rendered.html, /4 \/ 3/)
assert.match(rendered.html, /1 character too long/)
find(rendered.tree, node => node.type === 'textarea')[0].props.onChange({ target: { value: 'Native changed prompt' } }); assert.deepEqual(h.changed, ['Native changed prompt'])
h.effects[0](); assert.equal(h.ref.current.style.height, '160px')
h.ref.current.scrollHeight = 87; h.effects[0](); assert.equal(h.ref.current.style.height, '87px'); checks++
for (const extra of [{}, { error: diagnostic }, { error: diagnostic, retryStrategy: 'resume_same_attempt' }, { error: diagnostic, retryStrategy: 'start_fresh_attempt' }, { error: diagnostic, retryStrategy: 'do_not_retry' }, { error: diagnostic, isGenerating: true }, { showAdvanced: true }, { prompt: 'Too long', mandatoryConfig: { fieldLabel: 'Source', displayLabel: 'Prompt', promptMaxLength: 3 } }]) {
  assert.equal(harness(false).render(extra).html, harness(false, true).render(extra).html, 'Classic SSR exact')
  checks++
}
const css = fs.readFileSync(new URL('components/generation-panel/shared/studio-generation-feedback.css', root), 'utf8'), ast = postcss.parse(css)
ast.walkRules(rule => assert.ok(rule.selector.startsWith('[data-studio-v4-shell="true"] '), 'Every feedback rule is scoped to literal own Studio shell'))
assert.match(css, /max-height: min\(100px, 16dvh\)/)
assert.match(css, /overflow-y: auto/)
assert.match(css, /white-space: pre-wrap/)
assert.match(css, /overflow-wrap: anywhere/)
assert.match(css, /generation-feedback-text="true"\]:focus-visible/)
assert.doesNotMatch(css, /textarea|generation-panel-fields|flex-shrink|display: none|text-overflow|line-clamp/)
checks++
console.log(`${checks} isolated GenerationInput feedback checks passed; native geometry/keyboard scroll require Root's strict capture.`)
