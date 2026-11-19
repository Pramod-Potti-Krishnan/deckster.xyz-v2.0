import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const root = new URL('../', import.meta.url)
const base = '659f66d7a431711f27c8ad54acb1505c0f3b3265'
const chatInput = 'components/builder/chat-input.tsx'
const pickerLib = 'lib/studio-upload-formats.ts'
const pickerImport = '@/lib/studio-upload-formats'
const shell = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const narrow = 'NEXT_PUBLIC_STUDIO_UPLOAD_FORMATS_NARROW'
const textFormats = 'NEXT_PUBLIC_STUDIO_UPLOAD_TEXT_FORMATS'
const legacy = '.pdf,.docx,.doc,.txt,.md,.xlsx,.xls,.csv,.pptx,.ppt,.json,.xml,.yaml,.yml,.png,.jpg,.jpeg,.gif,.webp,.py,.js,.ts,.java,.go,.rs'
const narrowed = '.pdf,.docx,.txt,.md,.xlsx,.csv,.pptx,.png,.jpg,.jpeg,.gif,.webp'
const withText = '.pdf,.docx,.txt,.md,.xlsx,.csv,.pptx,.json,.xml,.yaml,.yml,.png,.jpg,.jpeg,.gif,.webp,.py,.js,.ts,.java,.go,.rs'
const read = file => readFileSync(new URL(file, root), 'utf8')
const readBase = file => execFileSync('git', ['show', `${base}:${file}`], { cwd: root, encoding: 'utf8' })
const require = createRequire(import.meta.url)
const { LATER_CHANGE_FILES, LATER_ENV_BLOCKS, LATER_STRIPS, stripLaterChanges } = await import('./studio-later-changes.mjs')

function evaluate(source, fileName, env, load = require) {
  const { outputText } = ts.transpileModule(source, {
    fileName,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
  })
  const exports = {}
  new Function('exports', 'require', 'process', outputText)(exports, load, { env })
  return exports
}

// Evaluate the real file input and Studio shell condition with only their local dependencies.
function renderPicker(source, env, lib = () => read(pickerLib)) {
  const ast = ts.createSourceFile(chatInput, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const bindings = new Map()
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ['studio', 'uploadFormats', 'hiddenFileInput'].includes(node.name.getText(ast))) {
      bindings.set(node.name.getText(ast), node.getText(ast))
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert.ok(bindings.has('studio') && bindings.has('hiddenFileInput'), 'Find the real picker and shell condition')
  let formatModuleLoads = 0
  function load(id) {
    if (id !== pickerImport) return require(id)
    formatModuleLoads += 1
    return evaluate(lib(), pickerLib, env)
  }
  const { default: element } = evaluate(`
    const fileInputRef = { current: null }
    const ${bindings.get('studio')}
    ${bindings.has('uploadFormats') ? `const ${bindings.get('uploadFormats')}` : ''}
    const ${bindings.get('hiddenFileInput')}
    export default hiddenFileInput
  `, chatInput, env, load)
  return { accept: element.props.accept, html: renderToStaticMarkup(element), formatModuleLoads }
}

const baseSource = readBase(chatInput)
const uploadFormatsIndex = LATER_STRIPS.findIndex(strip => strip.name === 'stripUploadFormats')
const headSource = uploadFormatsIndex === -1
  ? read(chatInput)
  : LATER_STRIPS.slice(uploadFormatsIndex + 1).reduce((source, strip) => strip(chatInput, source), read(chatInput))
const matrix = [
  ['off / off', 'false', 'false', legacy],
  ['off / on', 'false', 'true', legacy],
  ['on / off', 'true', 'false', narrowed],
  ['on / on', 'true', 'true', withText],
  ['unset flags', undefined, undefined, legacy],
  ['nonliteral narrowing', 'True', 'true', legacy],
  ['nonliteral text flag', 'true', '1', narrowed],
  ['legacy shell with both on', 'true', 'true', legacy, 'false'],
]

function proveMatrix(source, lib) {
  const identityDigests = []
  const rows = []
  for (const [name, narrowValue, textValue, expected, shellValue = 'true'] of matrix) {
    const env = { [shell]: shellValue, [narrow]: narrowValue, [textFormats]: textValue }
    const before = renderPicker(baseSource, env)
    const after = renderPicker(source, env, lib)
    assert.equal(before.accept, legacy, name)
    assert.equal(after.accept, expected, name)
    assert.equal(after.formatModuleLoads, expected === legacy ? 0 : 1, name)
    assert.equal(after.html, before.html.replace(`accept="${legacy}"`, `accept="${expected}"`), name)
    if (expected === legacy) {
      identityDigests.push([before.html, after.html].map(html => createHash('sha256').update(html).digest('hex')))
    }
    rows.push(`${name}  ${after.accept}`)
  }
  return { identityDigests, rows }
}

const { identityDigests, rows } = proveMatrix(headSource)
const uploadFormats = await import('./studio-upload-formats-strip.mjs')
assert.equal(uploadFormats.stripUploadFormats(chatInput, headSource), baseSource, 'Remove just the picker changes')
assert.equal(stripLaterChanges(chatInput, headSource), stripLaterChanges(chatInput, baseSource))
assert.ok(LATER_STRIPS.includes(uploadFormats.stripUploadFormats))
assert.ok(LATER_ENV_BLOCKS.includes(uploadFormats.UPLOAD_FORMATS_ENV_BLOCK))
assert.equal(stripLaterChanges('.env.example', read('.env.example')), stripLaterChanges('.env.example', readBase('.env.example')))
for (const file of uploadFormats.UPLOAD_FORMATS_SCOPE_FILES) assert.ok(LATER_CHANGE_FILES.has(file), file)
assert.equal(uploadFormats.stripUploadFormats('unrelated.tsx', headSource), headSource)

const realLib = read(pickerLib)
const mutants = [
  ['read narrowing unconditionally', headSource.replace(`process.env.${narrow} === 'true'`, 'true'), realLib],
  ['ignore the text flag', headSource, realLib.replace(`process.env.${textFormats} === 'true'`, 'true')],
  ['offer legacy Word input', headSource, realLib.replace('.pdf,.docx,', '.pdf,.docx,.doc,')],
  ['apply narrowing outside Studio', headSource.replace(`studio && process.env.${narrow}`, `process.env.${narrow}`), realLib],
]
for (const [name, source, lib] of mutants) {
  assert.notDeepEqual([source, lib], [headSource, realLib], name)
  assert.throws(() => proveMatrix(source, () => lib), { code: 'ERR_ASSERTION' }, name)
  console.log(`Caught mutant  ${name}`)
}
console.log(rows.join('\n'))
console.log(`Flag-off markup SHA-256 (base / head)  ${identityDigests[0].join(' / ')}`)
console.log(`Passed ${rows.length} picker cases, source and registry identity, and ${mutants.length} mutants.`)
