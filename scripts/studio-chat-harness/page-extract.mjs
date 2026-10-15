// Pulls the REAL page-level handlers out of app/builder/page.tsx (and the DB-to-transcript
// split out of hooks/use-builder-session.ts) by AST, so the harness executes the code the
// browser runs instead of a copy. Free variables are resolved through a strict scope:
// anything the harness did not provide throws a named error rather than silently being
// undefined. Each extracted region also reports a whitespace-insensitive source hash
// ("anchor") so the baseline notices if the page edits a region the harness mirrors.
import crypto from 'node:crypto'
import fs from 'node:fs'
import ts from 'typescript'

const BUILTINS = new Set(['undefined', 'NaN', 'Infinity', 'Object', 'Array', 'JSON', 'Math', 'Number', 'String', 'Boolean', 'Symbol', 'Promise',
  'Set', 'Map', 'WeakMap', 'WeakSet', 'Error', 'TypeError', 'RangeError', 'RegExp', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'encodeURIComponent', 'decodeURIComponent', 'URL', 'URLSearchParams', 'Intl', 'Reflect'])

export function parseSource(file) {
  const text = fs.readFileSync(file, 'utf8')
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  if (source.parseDiagnostics.length) throw new Error(`harness extract: ${file} does not parse`)
  return source
}

function walk(node, visit) {
  const hit = visit(node)
  if (hit) return hit
  let found
  ts.forEachChild(node, child => { if (!found) found = walk(child, visit) })
  return found
}

function must(node, what) {
  if (!node) throw new Error(`harness extract: could not find ${what}. The page changed shape; update scripts/studio-chat-harness/page-extract.mjs and re-record.`)
  return node
}

// const name = useCallback(<fn>, [deps]) -> <fn>
export function useCallbackFunction(source, name) {
  const declaration = must(walk(source, node => ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name ? node : null), `const ${name}`)
  const call = declaration.initializer
  if (!call || !ts.isCallExpression(call) || call.expression.getText(source) !== 'useCallback') throw new Error(`harness extract: ${name} is no longer a useCallback`)
  return call.arguments[0]
}

// useDecksterWebSocketV2({ prop: <expr> }) -> <expr>
export function hookOptionProperty(source, callName, property) {
  const call = must(walk(source, node => ts.isCallExpression(node) && node.expression.getText(source) === callName ? node : null), `${callName}(...)`)
  const literal = call.arguments[0]
  const prop = must(literal.properties.find(item => item.name?.getText(source) === property), `${callName} option ${property}`)
  return prop.initializer ?? prop
}

// Every `sendMessage*(...)` / `sendTypedTurn(...)` call site, printed: a cheap, exact snapshot
// of how the page assembles outbound user_message options.
export function sendCallSites(source) {
  const printer = ts.createPrinter({ removeComments: true })
  const names = new Set(['sendMessage', 'sendMessageWhenConnected', 'sendTypedTurn'])
  const sites = []
  const visit = node => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && names.has(node.expression.text)) {
      const enclosing = (() => { for (let p = node.parent; p; p = p.parent) if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text; return '(module)' })()
      sites.push({ enclosing, callee: node.expression.text, arguments: node.arguments.map(arg => printer.printNode(ts.EmitHint.Unspecified, arg, source).replace(/\s+/g, ' ')) })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return sites
}

export function anchor(label, node, source) {
  const text = node.getText(source).replace(/\s+/g, ' ').trim()
  return { label, chars: text.length, sha256: crypto.createHash('sha256').update(text).digest('hex').slice(0, 16) }
}

const strictScope = (values, label) => new Proxy(values, {
  has: (_target, key) => typeof key === 'string',
  get: (target, key) => {
    if (key === Symbol.unscopables) return undefined
    if (Object.prototype.hasOwnProperty.call(target, key)) return target[key]
    if (BUILTINS.has(key)) return globalThis[key]
    throw new Error(`harness scope: page code "${label}" reads "${String(key)}", which the harness did not provide. Add it in scripts/studio-chat-harness/page-probe.mjs.`)
  },
  set: (target, key, value) => { target[key] = value; return true },
})

// Compile an expression/function AST node once; call the result with a values object to
// bind its free variables. JSX inside the node becomes React.createElement (classic).
export function compile(node, source, label) {
  const text = typeof node === 'string' ? node : node.getText(source)
  const compiled = ts.transpileModule(`var __fn = (${text});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React, alwaysStrict: false },
    reportDiagnostics: true,
  })
  const errors = (compiled.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(`harness extract: ${label} does not compile: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`)
  // eslint-disable-next-line no-new-func
  const factory = new Function('scope', `with (scope) { ${compiled.outputText}\nreturn __fn }`)
  return values => factory(strictScope({ ...values }, label))
}

// Whether the page renders <Tag ... /> at all. NEXT_PUBLIC_STUDIO_ONE_LIVE_TAB added one (<StudioSupersededNotice>); the base page does not
// have it, and the harness must still run the base page as it is (so its flag-off output can be compared with the branch's).
export function hasJsxTag(source, tag) {
  return Boolean(walk(source, node => (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(source) === tag ? node : null))
}

// Every attribute expression of <Tag ... /> in the page, by prop name. A spread attribute ({...expr}) is kept in order under the
// synthetic name "...<n>"; evaluate it with `evaluateProps` below (an object that is merged over what came before, exactly as JSX does).
export function jsxAttributes(source, tag) {
  const opening = must(walk(source, node => (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(source) === tag ? node : null), `<${tag} ...>`)
  const out = {}
  let spreads = 0
  for (const attr of opening.attributes.properties) {
    if (ts.isJsxSpreadAttribute(attr)) {
      out[`...${spreads++}`] = { text: attr.expression.getText(source), node: attr.expression, spread: true }
      continue
    }
    const name = attr.name.getText(source)
    if (!attr.initializer) out[name] = { text: 'true', node: null }
    else if (ts.isStringLiteral(attr.initializer)) out[name] = { text: JSON.stringify(attr.initializer.text), node: attr.initializer }
    else out[name] = { text: attr.initializer.expression.getText(source), node: attr.initializer.expression }
  }
  return out
}

// ---- generic finders -------------------------------------------------------

export function findIfStatement(source, predicate, what) {
  return must(walk(source, node => ts.isIfStatement(node) && predicate(node) ? node : null), what)
}

export function findVariableInitializer(source, name) {
  const declaration = must(walk(source, node => ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer ? node : null), `const ${name} = ...`)
  return declaration.initializer
}

export function findCalls(source, calleeText) {
  const calls = []
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === calleeText) calls.push(node)
    ts.forEachChild(node, visit)
  }
  visit(source)
  return calls
}

// Evaluate compiled JSX attributes (name -> evaluator, in source order; "...<n>" names are spreads) into one props object.
// `wrap(name, value)` lets the caller wrap a value (the transcript runner records handler calls with it).
export function evaluateProps(compiled, values, wrap = (_name, value) => value) {
  const props = {}
  for (const [name, evaluate] of Object.entries(compiled)) {
    if (name.startsWith('...')) { Object.assign(props, evaluate(values) ?? {}); continue }
    props[name] = wrap(name, evaluate(values))
  }
  return props
}
