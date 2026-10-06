// Isolated native ImageForm controls: exact original algorithms/options/payloads, Studio names and classic DOM.
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
const file = 'components/generation-panel/forms/image-form.tsx'
const source = fs.readFileSync(new URL(file, root), 'utf8')
const original = execFileSync('git', ['show', 'd0cc173:' + file], { encoding: 'utf8', cwd: root })
const compile = text => {
  const result = ts.transpileModule(text, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } })
  assert.equal((result.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error).length, 0)
  return result.outputText
}
const canonical = (text, strip = false) => {
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const result = ts.transform(ast, [context => {
    const visit = node => {
      if (strip) {
        if (ts.isInterfaceDeclaration(node) && node.name.text === 'ImageGeometryDraft') return undefined
        if (ts.isImportSpecifier(node) && node.name.text === 'useRef') return undefined
        if (ts.isPropertySignature(node) && node.name.getText(ast) === 'targetElementId') return undefined
        if (ts.isBindingElement(node) && node.name.getText(ast) === 'targetElementId') return undefined
        if (ts.isIfStatement(node) && node.expression.getText(ast).startsWith('STUDIO_IMAGE_FORM')) return undefined
        if (ts.isVariableStatement(node) && node.declarationList.declarations.some(item => ['geometryDraft', '[geometryEdited, setGeometryEdited]', 'geometryContextRef'].includes(item.name.getText(ast)))) return undefined
        // Strip only the explicitly scoped geometry-cache fallback added to the
        // original initializer. All payload builders and original JSX stay exact.
        if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
          && node.left.getText(ast).startsWith('geometryDraft?.')) {
          return ts.isParenthesizedExpression(node.right) ? node.right.expression : node.right
        }
        if (ts.isConditionalExpression(node) && node.getText(ast) === 'STUDIO_IMAGE_FORM ? targetElementId : null') return undefined
        if (ts.isPropertySignature(node) && node.name.getText(ast) === 'onDraftChange') return undefined
        if (ts.isBindingElement(node) && node.name.getText(ast) === 'onDraftChange') return undefined
        if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)
          && node.expression.expression.getText(ast) === 'useEffect'
          && node.expression.arguments[0]?.getText(ast).includes('if (!STUDIO_IMAGE_FORM || !onDraftChange) return')) return undefined
        if (ts.isVariableStatement(node)) {
          const declaration = node.declarationList.declarations[0]
          if (declaration.name.getText(ast) === 'handleSubmit'
            && declaration.initializer?.getText(ast).includes('onSubmit(buildFormData())')) return undefined
          if (declaration.name.getText(ast) === 'buildFormData') {
            // Restore the frozen callback's dispatch terminal for exact AST
            // comparison; only the new draft reporter and wrapper are omitted.
            const call = declaration.initializer, callback = call.arguments[0]
            const statements = callback.body.statements.map(statement => (
              ts.isReturnStatement(statement) && statement.expression?.getText(ast) === 'formData'
                ? ts.factory.createExpressionStatement(ts.factory.createCallExpression(ts.factory.createIdentifier('onSubmit'), undefined, [ts.factory.createIdentifier('formData')]))
                : statement
            ))
            const legacyCallback = ts.factory.updateArrowFunction(callback, callback.modifiers, callback.typeParameters, callback.parameters, callback.type, callback.equalsGreaterThanToken, ts.factory.updateBlock(callback.body, statements))
            const dependencies = ts.factory.updateArrayLiteralExpression(call.arguments[1], [...call.arguments[1].elements, ts.factory.createIdentifier('onSubmit')])
            const initializer = ts.factory.updateCallExpression(call, call.expression, call.typeArguments, [legacyCallback, dependencies])
            const legacyDeclaration = ts.factory.updateVariableDeclaration(declaration, ts.factory.createIdentifier('handleSubmit'), declaration.exclamationToken, declaration.type, initializer)
            return ts.factory.updateVariableStatement(node, node.modifiers, ts.factory.updateVariableDeclarationList(node.declarationList, [legacyDeclaration]))
          }
        }
        if (ts.isImportDeclaration(node) && node.moduleSpecifier.text === './studio-image-form.css') return undefined
        if (ts.isVariableStatement(node) && node.declarationList.declarations.some(item => item.name.getText(ast) === 'STUDIO_IMAGE_FORM')) return undefined
        if (ts.isJsxAttribute(node) && node.initializer?.getText(ast).startsWith('{STUDIO_IMAGE_FORM')) return undefined
      }
      return ts.visitEachChild(node, visit, context)
    }
    return node => ts.visitNode(node, visit)
  }])
  const printed = ts.createPrinter({ removeComments: true }).printFile(result.transformed[0]); result.dispose(); return printed
}
assert.equal(canonical(source, true), canonical(original), 'Original algorithms, controls, gates, classic defaults, payload and text are AST-exact after explicitly normalizing Studio draft/geometry ownership additions')
const json = value => JSON.parse(JSON.stringify(value))
const find = (tree, predicate, result = []) => {
  if (!tree || typeof tree !== 'object') return result
  if (predicate(tree)) result.push(tree)
  React.Children.forEach(tree.props?.children, child => find(child, predicate, result))
  return result
}
const text = node => typeof node === 'string' ? node : !node || typeof node !== 'object' ? '' : React.Children.toArray(node.props?.children).map(text).join('')
const Shared = () => null
const ToggleRow = ({ label, value, options, onChange, field }) => React.createElement('div', null, label, options.map(option => React.createElement('button', { key: option.value, type: 'button', 'aria-pressed': value === option.value, onClick: () => onChange(field, option.value) }, option.label)))
const CollapsibleSection = ({ title, isOpen, onToggle, children }) => React.createElement('section', null, React.createElement('button', { type: 'button', onClick: onToggle }, title), isOpen ? children : null)
function harness({ studio = true, previous = false, seeds = {} } = {}) {
  const states = [], effects = [], submitted = [], mandatory = [], registered = [], themeUpdates = [], cache = new Map(), refs = []; let cursor = 0, refCursor = 0
  const fakeReact = { ...React, useRef(value) { const index = refCursor++; if (!(index in refs)) refs[index] = {current:value}; return refs[index] }, useState(initial) { const index = cursor++; if (!(index in states)) states[index] = index in seeds ? seeds[index] : typeof initial === 'function' ? initial() : initial; return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next }] }, useCallback: callback => callback, useEffect: callback => effects.push(callback) }
  const stubs = { react: fakeReact, '../shared/toggle-row': { ToggleRow }, '../shared/collapsible-section': { CollapsibleSection }, '../shared/padding-control': { PaddingControl: Shared }, '../shared/z-index-input': { ZIndexInput: Shared }, '../shared/theme-source-selector': { ThemeSourceSelector: Shared }, '../shared/use-theme-source-state': { useThemeSourceState: () => ({ themeSource: { mode: 'deck' }, updateThemeSource: value => themeUpdates.push(value), useDeckTheme: true, themeOverrides: null }) } }
  function load(filename, override) {
    if (cache.has(filename)) return cache.get(filename)
    const module = { exports: {} }
    vm.runInNewContext(compile(override ?? fs.readFileSync(filename, 'utf8')), { module, exports: module.exports, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: studio ? 'true' : 'false' } }, require: id => id in stubs ? stubs[id] : id.endsWith('.css') ? {} : id.startsWith('@/') ? load(new URL(id.slice(2) + '.ts', root).pathname) : require(id) })
    cache.set(filename, module.exports); return module.exports
  }
  const module = load(new URL(file, root).pathname, previous ? original : source)
  const render = (extra = {}) => {
    cursor = 0; refCursor = 0; effects.length = 0
    const props = { onSubmit: value => submitted.push(value), registerSubmit: callback => registered.push(callback), isGenerating: false, presentationId: 'local-image-specimen', prompt: 'Native image prompt', showAdvanced: true, registerMandatoryConfig: value => mandatory.push(value), panelMode: 'generate', ...extra }
    const tree = module.ImageForm(props); return { tree, html: renderToStaticMarkup(tree) }
  }
  const picker = () => { effects.find(callback => callback.toString().includes('registerMandatoryConfig'))(); return mandatory.at(-1) }
  const submit = () => { effects.find(callback => callback.toString().includes('registerSubmit'))(); registered.at(-1)(); return submitted.at(-1) }
  return { states, effects, submitted, themeUpdates, render, picker, submit }
}
const field = (tree, label) => find(tree, node => ['select', 'input'].includes(node.type) && node.props['aria-label'] === label)[0]
const button = (tree, label) => find(tree, node => node.type === 'button' && text(node) === label)[0]
let checks = 1, h = harness({ seeds: { 14: true, 15: true } }), rendered = h.render(), picker = h.picker()
assert.equal(picker.optionGroups.flatMap(group => group.options).length, 9)
assert.deepEqual(json(picker.optionGroups.map(group => group.group)), ['Automatic', 'Photography', 'Illustration', 'Design'])
assert.equal(find(field(rendered.tree, 'Image style'), node => node.type === 'option').length, 9)
assert.equal(find(field(rendered.tree, 'Image quality'), node => node.type === 'option').length, 5)
assert.equal(find(rendered.tree, node => node.props['data-studio-image-group'] === 'aspect')[0].props['aria-label'], 'Image aspect ratio')
for (const label of ['Image width (grid)', 'Image height (grid)']) { const input = field(rendered.tree, label); assert.equal(input.props.min, .2); assert.equal(input.props.step, .2) }
assert.equal(find(rendered.tree, node => node.props['data-studio-image-group'] === 'position-presets').length, 0)
assert.equal(button(rendered.tree, 'Reset to Auto').props.disabled, true)
assert.match(rendered.html, /Size: 12 x 7 grid \(720 x 420px\)/)
checks++
for (const style of ['realistic', 'photo', 'illustration', 'brand_graphic', 'flat_vector', 'isometric', 'minimal', 'abstract']) {
  field(rendered.tree, 'Image style').props.onChange({ target: { value: style } }); rendered = h.render(); assert.equal(h.picker().selectedValue, style); assert.equal(h.submit().imageConfig.style, style); checks++
}
field(rendered.tree, 'Image style').props.onChange({ target: { value: '' } }); h.render(); assert.equal(h.picker().selectedValue, 'auto'); assert.equal(h.submit().imageConfig.style, undefined); checks++
for (const quality of ['draft', 'standard', 'high', 'ultra']) {
  rendered = h.render(); field(rendered.tree, 'Image quality').props.onChange({ target: { value: quality } }); h.render(); assert.equal(h.submit().imageConfig.quality, quality)
  rendered = h.render(); field(rendered.tree, 'Image quality').props.onChange({ target: { value: '' } }); h.render(); assert.equal(h.submit().imageConfig.quality, undefined); checks++
}
const aspectGeometry = { '16:9': [24, 14, 5, 4], '4:3': [18, 14, 8, 4], '1:1': [14, 14, 10, 4], '9:16': [7, 14, 13, 4], '3:2': [21, 14, 6, 4] }
for (const [ratio, [width, height, col, row]] of Object.entries(aspectGeometry)) {
  rendered = h.render(); button(rendered.tree, ratio).props.onClick(); rendered = h.render(); const data = h.submit()
  assert.deepEqual([data.imageConfig.width, data.imageConfig.height, data.imageConfig.start_col, data.imageConfig.start_row], [width, height, col, row])
  assert.equal(data.imageConfig.aspect_ratio, ratio); assert.equal(data.imageConfig.auto_position, false)
  assert.equal(button(rendered.tree, ratio).props['aria-pressed'], true)
  assert.equal(button(rendered.tree, 'Custom').props['aria-pressed'], false)
  checks++
}
const typeModule = { exports: {} }; vm.runInNewContext(compile(fs.readFileSync(new URL('types/textlabs.ts', root), 'utf8')), { module: typeModule, exports: typeModule.exports, require })
const presets = typeModule.exports.IMAGE_POSITION_PRESETS
for (const [key, preset] of Object.entries(presets)) {
  rendered = h.render(); button(rendered.tree, preset.label).props.onClick(); rendered = h.render(); const data = h.submit()
  assert.deepEqual([data.imageConfig.start_col, data.imageConfig.start_row, data.imageConfig.width, data.imageConfig.height], [preset.start_col, preset.start_row, preset.width, preset.height])
  assert.equal(button(rendered.tree, preset.label).props['aria-pressed'], true)
  assert.equal(button(rendered.tree, 'Custom').props['aria-pressed'], true)
  assert.equal(field(rendered.tree, 'Image column (grid)').props.max, 32); assert.equal(field(rendered.tree, 'Image row (grid)').props.max, 18)
  checks++
}
rendered = h.render(); field(rendered.tree, 'Image width (grid)').props.onChange({ target: { value: '11.4' } }); field(rendered.tree, 'Image height (grid)').props.onChange({ target: { value: '7.2' } }); rendered = h.render(); const custom = h.submit()
assert.equal(custom.imageConfig.aspect_ratio, '19:12'); assert.equal(custom.imageConfig.width, 11.4); assert.equal(custom.imageConfig.height, 7.2)
assert.equal(find(rendered.tree, node => node.type === 'button' && node.props['aria-pressed'] && String(node.props['aria-label']).startsWith('Image position')).length, 0)
button(rendered.tree, 'Reset to Auto').props.onClick(); rendered = h.render({ elementContext: null }); assert.equal(h.states[12].size, 0); assert.equal(h.submit().imageConfig.style, undefined); assert.equal(h.submit().imageConfig.quality, undefined); checks++
const context = { startCol: 4.2, startRow: 5.4, width: 10.6, height: 6.8 }
rendered = h.render({ elementContext: context }); button(rendered.tree, 'Reset to Auto').props.onClick(); rendered = h.render({ elementContext: context }); const reset = h.submit()
assert.deepEqual([reset.imageConfig.start_col, reset.imageConfig.start_row, reset.imageConfig.width, reset.imageConfig.height], [4.2, 5.4, 10.6, 6.8]); assert.equal(reset.advancedModified, false); assert.equal(reset.imageConfig.auto_position, undefined); assert.equal(reset.imageConfig.aspect_ratio, undefined); checks++
for (const operation of ['edit', 'variation']) {
  h = harness({ seeds: { 14: true, 15: true } }); h.render({ panelMode: 'refine' }); const configs = h.picker(); assert.equal(configs[0].nativeSelect, true); assert.deepEqual(json(configs[0].options.map(option => option.value)), ['edit', 'variation']); configs[0].onChange(operation); h.render({ panelMode: 'refine' }); assert.equal(h.submit().imageConfig.operation, operation); checks++
}
for (const extra of [{}, { showAdvanced: false }, { isGenerating: true }, { panelMode: 'edit' }, { panelMode: 'refine' }, { elementContext: context }, { initialDraft: { formData: { componentType: 'IMAGE', prompt: 'Remembered image', imageConfig: { style: 'photo', quality: 'high', auto_position: false, aspect_ratio: '4:3', width: 18, height: 14 }, advancedModified: true } } }]) {
  const native = harness({ studio: false, seeds: { 14: true, 15: true, 16: true } }), previous = harness({ studio: false, previous: true, seeds: { 14: true, 15: true, 16: true } })
  assert.equal(native.render(extra).html, previous.render(extra).html, 'Classic DOM exact')
  assert.equal(JSON.stringify(native.picker(), (key, value) => typeof value === 'function' ? '[callback]' : value), JSON.stringify(previous.picker(), (key, value) => typeof value === 'function' ? '[callback]' : value))
  assert.deepEqual(json(native.submit()), json(previous.submit()), 'Original complete image form data exact')
  checks++
}
const css = fs.readFileSync(new URL('components/generation-panel/forms/studio-image-form.css', root), 'utf8'), ast = postcss.parse(css)
ast.walkRules(rule => assert.ok(rule.selector.includes('[data-studio-v4-shell="true"]') && rule.selector.includes('[data-studio-image-'), 'Own scoped marker only'))
assert.match(css, /grid-template-columns: repeat\(auto-fit/); assert.match(css, /:focus-visible/); assert.match(css, /content: ' · grid'/); checks++
// The actual form's new effect stores options without dispatching generation.
const drafts = []
const remembered = { formData: { componentType: 'IMAGE', prompt: 'Existing image', count: 1, layout: 'horizontal', advancedModified: true, imageConfig: { operation: 'variation', style: 'brand_graphic', quality: 'high', corners: 'rounded', border: true, start_col: 3, start_row: 7, width: 14, height: 8, aspect_ratio: '7:4' }, paddingConfig: { top: 1, right: 2, bottom: 3, left: 4 } } }
const extras = { panelMode: 'refine', initialDraft: remembered, onDraftChange: value => drafts.push(value) }
const report = specimen => specimen.effects.find(callback => callback.toString().includes('if (!STUDIO_IMAGE_FORM || !onDraftChange)'))()
h = harness({ seeds: { 14: true, 15: true } }); rendered = h.render(extras); report(h)
assert.equal(h.submitted.length, 0); assert.equal(drafts.length, 1)
assert.deepEqual(json(drafts.at(-1).formData.imageConfig), { operation: 'variation', placeholder_mode: false, start_col: 3, start_row: 7, width: 14, height: 8, grid_row: '7/15', grid_column: '3/17', style: 'brand_graphic', quality: 'high', corners: 'rounded', border: true, aspect_ratio: '7:4' })
assert.deepEqual(json(drafts.at(-1).formData.paddingConfig), { top: 1, right: 2, bottom: 3, left: 4 }); checks++
field(rendered.tree, 'Image style').props.onChange({ target: { value: 'photo' } }); rendered = h.render(extras)
field(rendered.tree, 'Image quality').props.onChange({ target: { value: 'ultra' } }); rendered = h.render(extras)
h.picker()[0].onChange('edit'); rendered = h.render(extras); report(h)
assert.equal(drafts.at(-1).formData.imageConfig.style, 'photo'); assert.equal(drafts.at(-1).formData.imageConfig.quality, 'ultra'); assert.equal(drafts.at(-1).formData.imageConfig.operation, 'edit'); assert.equal(h.submitted.length, 0); checks++
field(rendered.tree, 'Image style').props.onChange({ target: { value: '' } }); rendered = h.render(extras)
field(rendered.tree, 'Image quality').props.onChange({ target: { value: '' } }); rendered = h.render(extras); report(h)
assert.equal(Object.hasOwn(drafts.at(-1).formData.imageConfig, 'style'), false); assert.equal(Object.hasOwn(drafts.at(-1).formData.imageConfig, 'quality'), false); checks++
field(rendered.tree, 'Image width (grid)').props.onChange({ target: { value: '13.2' } }); rendered = h.render(extras); report(h)
assert.equal(drafts.at(-1).formData.imageConfig.width, 13.2); checks++
button(rendered.tree, '1:1').props.onClick(); rendered = h.render(extras); report(h)
assert.equal(drafts.at(-1).formData.imageConfig.aspect_ratio, '1:1'); assert.equal(drafts.at(-1).formData.imageConfig.width, 14); assert.equal(drafts.at(-1).formData.imageConfig.height, 14); checks++
h = harness({ studio: false }); h.render({ ...extras, onDraftChange: () => assert.fail('Classic never reports a Studio draft') }); report(h); assert.equal(h.submitted.length, 0); checks++
const routerSource = fs.readFileSync(new URL('components/generation-panel/index.tsx', root), 'utf8')
assert.match(routerSource, /<ImageForm[^>]+onDraftChange=\{onDraftChange\}/); checks++
const fixture = fs.readFileSync(new URL('scripts/studio-v4/ten-hour-specialist-forms-fixture.tsx', root), 'utf8')
compile(fixture); assert.equal((fixture.match(/value: 'IMAGE', label: 'Image'/g) ?? []).length, 1); assert.doesNotMatch(fixture, /Image \(native header selection\)/)
assert.match(fixture, /No Add Element acknowledgement/); assert.match(fixture, /refuses generation/); checks++
// Run the actual context effect and cache reporter, preserving native ownership.
const nativeA = {elementId:'A',startCol:3,startRow:7,width:14,height:8}
const geometryProps = { ...extras, targetElementId:'A', elementContext:nativeA }
const sync = specimen => specimen.effects.find(callback => callback.toString().includes('setStartCol(elementContext.startCol)'))()
h=harness({seeds:{14:true,15:true}});rendered=h.render(geometryProps);sync(h);rendered=h.render(geometryProps);report(h)
let geoDraft=drafts.at(-1)
assert.deepEqual([geoDraft.imageGeometry.startCol,geoDraft.imageGeometry.startRow,geoDraft.imageGeometry.width,geoDraft.imageGeometry.height],[3,7,14,8]);assert.equal(geoDraft.imageGeometry.geometryEdited,false);assert.equal(button(rendered.tree,'Custom').props['aria-pressed'],true);assert.match(rendered.html,/Aspect: 7:4/);checks+=4
button(rendered.tree,'1:1').props.onClick();rendered=h.render(geometryProps);report(h);geoDraft=drafts.at(-1)
assert.equal(geoDraft.imageGeometry.geometryEdited,true);assert.equal(geoDraft.imageGeometry.selectedAspectRatio,'1:1');checks+=2
h=harness();rendered=h.render({...geometryProps,initialDraft:geoDraft});sync(h);rendered=h.render({...geometryProps,initialDraft:geoDraft});report(h)
assert.equal(drafts.at(-1).imageGeometry.height,14);assert.equal(button(rendered.tree,'1:1').props['aria-pressed'],true);assert.equal(drafts.at(-1).imageGeometry.showPosition,true);checks+=3
// The selected native position preset is a raw UI value, distinct from its ratio.
button(rendered.tree,'Center Wide').props.onClick();rendered=h.render(geometryProps);report(h);geoDraft=drafts.at(-1)
h=harness();rendered=h.render({...geometryProps,initialDraft:geoDraft});sync(h);rendered=h.render({...geometryProps,initialDraft:geoDraft});report(h)
assert.equal(button(rendered.tree,'Center Wide').props['aria-pressed'],true);assert.equal(button(rendered.tree,'Custom').props['aria-pressed'],true);assert.equal(drafts.at(-1).imageGeometry.width,24);checks+=3
field(rendered.tree,'Image width (grid)').props.onChange({target:{value:'11.4'}});field(rendered.tree,'Image height (grid)').props.onChange({target:{value:'7.2'}});rendered=h.render(geometryProps);report(h);geoDraft=drafts.at(-1)
h=harness();rendered=h.render({...geometryProps,initialDraft:geoDraft});sync(h);rendered=h.render({...geometryProps,initialDraft:geoDraft});report(h)
assert.equal(button(rendered.tree,'Custom').props['aria-pressed'],true);assert.equal(drafts.at(-1).formData.imageConfig.aspect_ratio,'19:12');checks+=2
const movedA={...nativeA,startCol:5,width:12}
rendered=h.render({...geometryProps,initialDraft:geoDraft,elementContext:movedA});sync(h);rendered=h.render({...geometryProps,initialDraft:geoDraft,elementContext:movedA});report(h)
assert.equal(drafts.at(-1).imageGeometry.startCol,5);assert.equal(drafts.at(-1).imageGeometry.width,12);assert.equal(drafts.at(-1).imageGeometry.geometryEdited,false);checks+=3
// A stale old blank context cannot take the new target's cached geometry.
h=harness();rendered=h.render({...geometryProps,targetElementId:'B',initialDraft:geoDraft});sync(h);rendered=h.render({...geometryProps,targetElementId:'B',initialDraft:geoDraft});report(h);assert.equal(drafts.at(-1).imageGeometry.width,11.4);checks++
const nativeB={elementId:'B',startCol:19,startRow:7,width:12,height:8}
rendered=h.render({...geometryProps,targetElementId:'B',initialDraft:geoDraft,elementContext:nativeB});sync(h);rendered=h.render({...geometryProps,targetElementId:'B',initialDraft:geoDraft,elementContext:nativeB});report(h)
assert.equal(drafts.at(-1).imageGeometry.startCol,19);assert.equal(drafts.at(-1).imageGeometry.width,12);checks+=2
// Incomplete numeric input stays the original callback's0; no submission occurs.
h=harness({seeds:{14:true,15:true}});rendered=h.render(geometryProps);sync(h);rendered=h.render(geometryProps);field(rendered.tree,'Image width (grid)').props.onChange({target:{value:''}});rendered=h.render(geometryProps);report(h);const incompleteGeo=drafts.at(-1)
h=harness();rendered=h.render({...geometryProps,initialDraft:incompleteGeo});sync(h);rendered=h.render({...geometryProps,initialDraft:incompleteGeo});report(h);assert.equal(drafts.at(-1).imageGeometry.width,0);assert.equal(h.submitted.length,0);checks+=2
// Auto and reset release the raw override and return to current native bounds.
h=harness();rendered=h.render({...geometryProps,initialDraft:geoDraft});sync(h);rendered=h.render({...geometryProps,initialDraft:geoDraft})
const positionToggle=find(rendered.tree,n=>n.props.label==='Positioning')[0];positionToggle.props.onChange('auto_position','auto');rendered=h.render(geometryProps);report(h)
assert.equal(drafts.at(-1).imageGeometry.geometryEdited,false);assert.equal(drafts.at(-1).imageGeometry.width,14);assert.equal(drafts.at(-1).formData.imageConfig.auto_position,undefined);checks+=3
console.log(`${checks} isolated native ImageForm checks passed: eight styles +Auto, four qualities +Auto, five exact scale-fit ratios, nine native position presets, custom fractions/reset/refine operations, seven classic DOM/payload parities complete original AST equality after explicit draft/geometry-bridge normalization, and Studio draft reporting without generation. Native opening/services remain unproven.`)
