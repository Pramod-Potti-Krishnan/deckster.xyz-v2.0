/**
 * KNOWLEDGE-3, the F1 follow-up (test only): Studio signs a Researcher K-06 session token (lib/researcher-session-token.ts,
 * mintResearcherSessionToken) at exactly four places. Two sign for a chat Studio has just checked belongs to the caller (the session-token route and the
 * connector file's chat token), one signs the owner's own library id (no chat), and one, in the ingest-status route, signs a different name from the
 * chat it checked and is protected by something else (site 1 below).
 *
 * Why it is pinned: Researcher's DSB-3 (RESEARCHER_CONNECTOR_BIND_ON_LINK_ENABLED) binds a chat that has no owner record to the owner named
 * in the token, so the token is the whole proof of ownership. That holds only while nobody can get a token for a chat they do not own, and that
 * rests on there being exactly these four mint sites (KNOWLEDGE-3's F1 note streams/knowledge-3/reviews/F1-OWNER-CHECKED-CLAIM.md; REVIEW-1's
 * streams/review1/uploads-v1.0-277.md, F1, closed by construction; REVIEW-1's #633 review streams/review1/deckster.xyz-v2.0-633.md, P3 1-4, which this
 * file now follows). A fifth site, or a site that moves above its check, must fail here and be read by a person.
 *
 *   1. app/api/researcher/ingest-status/[jobId]/route.ts   x1: prisma.chatSession.findUnique, then a userId !== accountId refusal, then the mint. It does NOT sign the chat it checked: it signs the
 *                                                              chat's stored Researcher session name (ChatSession.geminiStoreName), and the browser can set that name (POST /api/sessions/[id]/files).
 *                                                              What protects it is that the token is used once, on the server, as a header of the single upstream request to Researcher's ingest-status
 *                                                              job route, which then checks its own owner record for that session (REVIEW-1's reading: it refuses a session with no stored owner); the token
 *                                                              is never returned, logged or sent to the browser (check h), and never goes to the connector routes (the bind-on-link path), which need the service key.
 *   2. app/api/researcher/session-token/route.ts           x1: same order. It signs the checked chat id itself (check g). The token goes to the browser by design, for 15 minutes.
 *   3. lib/connectors-gdrive-server.ts                     x2: connectorIdentityHeader (sessionId: connectorSessionId(owner), the owner's own library token, not a chat)
 *                                                              and chatSessionIdentityHeader (chat-scoped; one caller, handleSessionLinks, after ownChatRefusal)
 *
 * Assertions: a. call sites  b. importers  c. the connector file's shape
 *   d. route order: in the two routes the lookup, the owner-mismatch refusal and the mint sit directly in one function, the exported GET handler (a mint in a helper fails), in that order
 *   e. where RESEARCHER_SESSION_TOKEN_SECRET is read
 *   f. what else could sign, as far as source can show: researcherSessionTokenSecret (the secret helper) is imported only by the same three files; every result of calling it there goes only into the
 *      minter's secret property or a truthiness test; those three files and the library never use Web Crypto's subtle; the three never call or import createHmac and take no whole crypto module
 *   g. session-token route: the mint's sessionId is the same variable the lookup uses as where.id
 *   h. ingest-status route: minted.token is used once, as a header value of the one upstream fetch, and is never part of a response, a log or a return
 *   i. the library: its export list is pinned to today's names, createHmac is called once, inside the minter, and nothing but createHmac is taken from crypto
 * What this does not show: a secret read built from pieces of its name or by taking process.env whole (check e looks for the name as written), or a signer from a package other than
 * crypto that is handed a secret read that way. A reviewer reads those; the check holds the rest.
 * Plain node, no new dependency (typescript, which the other Studio source tests already use, parses the source, so comments and strings never
 * count and line breaks and spacing do not matter). Names are strict; no line numbers are pinned. No network, no secret, nothing is written.
 *
 * Run: node scripts/test-studio-researcher-token-mint-sites.mjs [root]
 *   root: the tree to read; default the repo root. The MINT_SITES_ROOT environment variable does the same when no argument is given
 *   (used to run this against a mutated temporary copy). The scan covers every source file under root except node_modules, .next, .git,
 *   the top-level scripts/ and tests/, any __tests__ directory, and *.test.* / *.spec.* files.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(process.argv[2] || process.env.MINT_SITES_ROOT || path.join(here, '..'))

const MINT = 'mintResearcherSessionToken'
const TOKEN_MODULE = 'researcher-session-token'
const SECRET_HELPER = 'researcherSessionTokenSecret'
const SIGNER = 'createHmac'
const DEFINITION = 'lib/researcher-session-token.ts'
const INGEST_ROUTE = 'app/api/researcher/ingest-status/[jobId]/route.ts'
const TOKEN_ROUTE = 'app/api/researcher/session-token/route.ts'
const CONNECTORS = 'lib/connectors-gdrive-server.ts'
const CHAT_HEADER = 'chatSessionIdentityHeader'
const OWNER_GATE = 'ownChatRefusal'
const LINKS_HANDLER = 'handleSessionLinks'
const SECRET_ENV = 'RESEARCHER_SESSION_TOKEN_SECRET'
// the names lib/researcher-session-token.ts exports today (values and types); a new one is a new way to sign and must be read by a person (check i)
const LIBRARY_EXPORTS = ['MintResearcherSessionTokenInput', 'MintedResearcherSessionToken', 'RESEARCHER_SESSION_TOKEN_HEADER', 'RESEARCHER_SESSION_TOKEN_MAX_TTL_SECONDS',
  'RESEARCHER_SESSION_TOKEN_MIN_SECRET_BYTES', 'RESEARCHER_SESSION_TOKEN_VERSION', 'isTokenClaim', 'mintResearcherSessionToken', 'researcherSessionTokenSecret']
const NOTES = 'See KNOWLEDGE-3 streams/knowledge-3/reviews/F1-OWNER-CHECKED-CLAIM.md and REVIEW-1 streams/review1/uploads-v1.0-277.md (F1) before adding or moving a mint site.'

const ALLOWED_CALLS = { [INGEST_ROUTE]: 1, [TOKEN_ROUTE]: 1, [CONNECTORS]: 2 }
const SOURCE_EXT = /\.(?:[cm]?[jt]sx?)$/
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '__tests__'])
const SKIP_TOP = new Set(['scripts', 'tests'])
const SKIP_FILE = /\.(?:test|spec)\./

// ---------------------------------------------------------------- reading the tree
assert.ok(fs.existsSync(root) && fs.statSync(root).isDirectory(), `root is not a directory: ${root}`)
function walk(dir, rel, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const childRel = rel ? `${rel}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || (!rel && SKIP_TOP.has(entry.name))) continue
      walk(path.join(dir, entry.name), childRel, out)
    } else if (entry.isFile() && SOURCE_EXT.test(entry.name) && !SKIP_FILE.test(entry.name)) {
      out.push(childRel)
    }
  }
  return out
}
const files = walk(root, '', []).sort()
const NEEDLES = [MINT, SECRET_ENV, CHAT_HEADER, TOKEN_MODULE, SECRET_HELPER]
const parsed = new Map() // rel -> SourceFile, only for files that name something this test cares about
for (const rel of files) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8')
  if (!NEEDLES.some(needle => text.includes(needle))) continue
  const kind = rel.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  parsed.set(rel, ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, /\.[cm]?jsx?$/.test(rel) ? ts.ScriptKind.JSX : kind))
}

// ---------------------------------------------------------------- AST helpers
const walkNodes = (node, visit) => { visit(node); ts.forEachChild(node, child => walkNodes(child, visit)) }
const nodesOf = (sf, test) => { const out = []; walkNodes(sf, n => { if (test(n)) out.push(n) }); return out }
const startOf = (n) => n.getStart()
const calleeName = (call) => {
  const e = call.expression
  if (ts.isIdentifier(e)) return e.text
  if (ts.isPropertyAccessExpression(e)) return e.name.text
  return null
}
const isCallTo = (n, name) => ts.isCallExpression(n) && calleeName(n) === name
const callsTo = (scope, name) => nodesOf(scope, n => isCallTo(n, name))
const isFunctionLike = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n)
const functionName = (fn) => {
  if (fn.name && ts.isIdentifier(fn.name)) return fn.name.text
  const p = fn.parent
  if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text
  if (p && ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) return p.name.text
  return null
}
const enclosingNamedFunction = (n) => { for (let p = n.parent; p; p = p.parent) if (isFunctionLike(p) && functionName(p)) return p; return null }
const where = (sf, n) => `${sf.fileName}:${sf.getLineAndCharacterOfPosition(startOf(n)).line + 1}`
const isNamedDeclaration = (n, name) => (ts.isFunctionDeclaration(n) || ts.isVariableDeclaration(n) || ts.isClassDeclaration(n)) && n.name && ts.isIdentifier(n.name) && n.name.text === name
const hasExport = (n) => {
  const decl = ts.isVariableDeclaration(n) ? n.parent?.parent : n
  return !!decl && ts.canHaveModifiers(decl) && (ts.getModifiers(decl) ?? []).some(m => m.kind === ts.SyntaxKind.ExportKeyword)
}
const hasModifier = (n, kind) => ts.canHaveModifiers(n) && (ts.getModifiers(n) ?? []).some(m => m.kind === kind)
/** The nearest function-like ancestor (an arrow or a callback counts), or null at module level. */
const nearestFunction = (n) => { for (let p = n.parent; p; p = p.parent) if (ts.isFunctionLike(p)) return p; return null }
const describeFunction = (fn) => (fn ? `${functionName(fn) ?? '(anonymous function)'} (${where(fn.getSourceFile(), fn)})` : '(module level)')
/** `fn` is the function a route exports under `name`: `export function NAME` or `export const NAME = (async) function / arrow`. */
const isExportedHandler = (fn, name) => {
  if (!fn) return false
  if (ts.isFunctionDeclaration(fn)) return !!fn.name && fn.name.text === name && hasExport(fn)
  const p = fn.parent
  return (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && !!p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) && p.name.text === name && hasExport(p)
}
/** The value of property `name` in an object literal: `name: value` gives value, the shorthand `name` gives its identifier; null when there is none (or `obj` is no object literal). */
const objectProp = (obj, name) => {
  if (!obj || !ts.isObjectLiteralExpression(obj)) return null
  for (const prop of obj.properties) {
    if (ts.isPropertyAssignment(prop) && (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) && prop.name.text === name) return prop.initializer
    if (ts.isShorthandPropertyAssignment(prop) && prop.name.text === name) return prop.name
  }
  return null
}
/** `n` with the wrappers that do not change its value (parentheses, `!`, `as`, `satisfies`, a type assertion) taken off the outside: the outermost such node. */
const unwrapUp = (n) => {
  let e = n
  while (e.parent && (ts.isParenthesizedExpression(e.parent) || ts.isNonNullExpression(e.parent) || ts.isAsExpression(e.parent) || ts.isSatisfiesExpression(e.parent) || ts.isTypeAssertionExpression(e.parent))) e = e.parent
  return e
}
/** An identifier that names a property (`x.NAME`, `{ NAME: v }`, `{ NAME: local } = o`) and so is no use of a variable called NAME. */
const isPropertyNameOnly = (id) => {
  const p = id.parent
  return (ts.isPropertyAccessExpression(p) && p.name === id) || (ts.isPropertyAssignment(p) && p.name === id) || (ts.isBindingElement(p) && p.propertyName === id)
}
const chatSessionLookups = (sf) => nodesOf(sf, n => isCallTo(n, 'findUnique') && ts.isPropertyAccessExpression(n.expression) && ts.isPropertyAccessExpression(n.expression.expression)
  && n.expression.expression.name.text === 'chatSession' && ts.isIdentifier(n.expression.expression.expression) && n.expression.expression.expression.text === 'prisma')

/** The identifiers a name or binding pattern declares. */
function bindingIdentifiers(name, out = []) {
  if (ts.isIdentifier(name)) out.push(name)
  else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) for (const el of name.elements) if (ts.isBindingElement(el)) bindingIdentifiers(el.name, out)
  return out
}
/** The identifier that declares `name` directly in scope node `scope`, or null: parameters, const / let / var, function and class declarations, catch and for-loop variables. */
function declaredIn(scope, name) {
  const pickNamed = (ids) => ids.find(id => id.text === name) ?? null
  if (ts.isFunctionLike(scope)) {
    for (const param of scope.parameters) { const d = pickNamed(bindingIdentifiers(param.name)); if (d) return d }
    return ts.isFunctionExpression(scope) && scope.name && scope.name.text === name ? scope.name : null
  }
  if (ts.isCatchClause(scope)) return scope.variableDeclaration ? pickNamed(bindingIdentifiers(scope.variableDeclaration.name)) : null
  if (ts.isForStatement(scope) || ts.isForOfStatement(scope) || ts.isForInStatement(scope)) {
    const init = scope.initializer
    return init && ts.isVariableDeclarationList(init) ? pickNamed(init.declarations.flatMap(d => bindingIdentifiers(d.name))) : null
  }
  const statements = ts.isSourceFile(scope) || ts.isBlock(scope) || ts.isModuleBlock(scope) ? scope.statements : ts.isCaseBlock(scope) ? scope.clauses.flatMap(c => [...c.statements]) : null
  if (!statements) return null
  for (const st of statements) {
    if (ts.isVariableStatement(st)) { const d = pickNamed(st.declarationList.declarations.flatMap(x => bindingIdentifiers(x.name))); if (d) return d }
    else if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name && st.name.text === name) return st.name
  }
  return null
}
/** The identifier node that declares the variable `use` refers to: the nearest enclosing scope that declares its name. Null for an import or a global. Two uses are the same variable exactly when this gives the same node. */
function bindingOf(use) {
  for (let p = use.parent; p; p = p.parent) { const d = declaredIn(p, use.text); if (d) return d }
  return null
}
/** The names a module exports, from its top-level statements: declarations with `export`, `export { a, b as c }`, `export * from`, `export default`, `export =`. Types and interfaces count. */
function exportedNames(sf) {
  const names = []
  for (const st of sf.statements) {
    if (ts.isExportAssignment(st)) names.push(st.isExportEquals ? 'export =' : 'default')
    else if (ts.isExportDeclaration(st)) {
      if (!st.exportClause) names.push(`* from ${st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier) ? st.moduleSpecifier.text : '?'}`)
      else if (ts.isNamespaceExport(st.exportClause)) names.push(st.exportClause.name.text)
      else for (const el of st.exportClause.elements) names.push(el.name.text)
    } else if (hasModifier(st, ts.SyntaxKind.ExportKeyword)) {
      if (hasModifier(st, ts.SyntaxKind.DefaultKeyword)) names.push('default')
      else if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) for (const id of bindingIdentifiers(d.name)) names.push(id.text)
      else if (st.name && ts.isIdentifier(st.name)) names.push(st.name.text)
      else names.push('(unnamed export)')
    }
  }
  return names
}
/** True when the value of `n` is used only as a truthiness test: `!n` (a boolean whatever surrounds it), `if (n)`, `n ? a : b`, or an operand of && or || whose own value is used that way. */
function isTruthinessOnly(n) {
  const e = unwrapUp(n), p = e.parent
  if (!p) return false
  if (ts.isPrefixUnaryExpression(p) && p.operator === ts.SyntaxKind.ExclamationToken) return true
  if (ts.isIfStatement(p) && p.expression === e) return true
  if (ts.isConditionalExpression(p) && p.condition === e) return true
  if (ts.isBinaryExpression(p) && (p.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken || p.operatorToken.kind === ts.SyntaxKind.BarBarToken) && (p.left === e || p.right === e)) return isTruthinessOnly(p)
  return false
}
/** True when `n` is the value of the `secret` property of the object literal that is the first argument of a mintResearcherSessionToken( call. */
function isMinterSecret(n) {
  const e = unwrapUp(n), p = e.parent
  const isSecretProp = !!p && ((ts.isPropertyAssignment(p) && p.initializer === e && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === 'secret')
    || (ts.isShorthandPropertyAssignment(p) && p.name === e && e.text === 'secret'))
  const obj = isSecretProp ? p.parent : null
  return !!obj && ts.isObjectLiteralExpression(obj) && !!obj.parent && ts.isCallExpression(obj.parent) && obj.parent.arguments[0] === obj && isCallTo(obj.parent, MINT)
}

/** Every use of an identifier named `name`, sorted into: call (called, directly or through a namespace/member), import (an import specifier), declaration, other (anything else: passed as a value, re-exported, aliased). */
function usesOf(name) {
  const calls = [], imports = [], declarations = [], other = []
  for (const [rel, sf] of parsed) {
    walkNodes(sf, n => {
      if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && n.text === name) { other.push({ rel, sf, node: n }); return } // obj['name'] hides a call from the identifier scan
      if (!ts.isIdentifier(n) || n.text !== name) return
      const p = n.parent
      const site = { rel, sf, node: n }
      if (ts.isImportSpecifier(p)) imports.push({ ...site, aliased: !!p.propertyName })
      else if (isNamedDeclaration(p, name) && p.name === n) declarations.push({ ...site, decl: p })
      else if (ts.isCallExpression(p) && p.expression === n) calls.push({ ...site, call: p })
      else if (ts.isPropertyAccessExpression(p) && p.name === n && ts.isCallExpression(p.parent) && p.parent.expression === p) calls.push({ ...site, call: p.parent })
      else other.push(site)
    })
  }
  return { calls, imports, declarations, other }
}

// ---------------------------------------------------------------- harness
// assert.ok with our own message, so a failure prints the message and no generated diff
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v)
const equal = (a, b, message) => assert.ok(a === b, message)
const notEqual = (a, b, message) => assert.ok(a !== b, message)
const deepEqual = (a, b, message) => assert.ok(JSON.stringify(canon(a)) === JSON.stringify(canon(b)), message)
let passed = 0, failed = 0
function check(name, fn) {
  try { fn(); passed++; console.log('ok -', name) } catch (error) {
    failed++; console.log(`FAIL - ${name}\n       ${String(error?.message ?? error).split('\n').join('\n       ')}`)
  }
}
const count = (list) => { const m = {}; for (const s of list) m[s.rel] = (m[s.rel] ?? 0) + 1; return m }
const fmt = (m) => Object.keys(m).sort().map(k => `${k}: ${m[k]}`).join(', ') || '(none)'
const need = (sf, label) => { assert.ok(sf, `${label}: the file is not in the scan (or names none of the pinned identifiers). ${NOTES}`); return sf }

console.log(`Researcher K-06 mint sites, scan root ${root} (${files.length} source files, ${parsed.size} name a pinned identifier)`)

const mintUses = usesOf(MINT)
const chatHeaderUses = usesOf(CHAT_HEADER)
const helperUses = usesOf(SECRET_HELPER)
const CALL_SITE_FILES = [INGEST_ROUTE, TOKEN_ROUTE, CONNECTORS]

/** Files (outside `allowed`) that reach a whole module without naming what they take from it: a namespace or default import, import =, export * from, require(), import(). Named imports are not listed. */
function reachWholeModule(isModule, allowed) {
  const reached = []
  for (const [rel, sf] of parsed) {
    if (allowed.includes(rel)) continue
    walkNodes(sf, n => {
      if (ts.isImportDeclaration(n) && isModule(n.moduleSpecifier)) {
        const clause = n.importClause
        if (!clause || clause.name || (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings))) reached.push(where(sf, n))
      }
      if (ts.isExportDeclaration(n) && isModule(n.moduleSpecifier) && !n.exportClause) reached.push(where(sf, n))
      if (ts.isImportEqualsDeclaration(n) && ts.isExternalModuleReference(n.moduleReference) && isModule(n.moduleReference.expression)) reached.push(where(sf, n))
      if (ts.isCallExpression(n) && n.arguments.length >= 1 && isModule(n.arguments[0]) && (calleeName(n) === 'require' || n.expression.kind === ts.SyntaxKind.ImportKeyword)) reached.push(where(sf, n))
    })
  }
  return reached
}
const isTokenModule = (lit) => !!lit && ts.isStringLiteral(lit) && lit.text.split('/').pop() === TOKEN_MODULE
const isCryptoModule = (lit) => !!lit && ts.isStringLiteral(lit) && (lit.text === 'crypto' || lit.text === 'node:crypto')

// ---- a. call sites
check(`a. ${MINT}( is called at exactly the four known sites, and nowhere else`, () => {
  const calls = mintUses.calls.filter(s => s.rel !== DEFINITION)
  const got = count(calls)
  const problems = []
  for (const rel of Object.keys(got)) if (!(rel in ALLOWED_CALLS)) problems.push(`unexpected file ${rel}: ${got[rel]} call(s) (allowed: none), at ${calls.filter(s => s.rel === rel).map(s => where(s.sf, s.node)).join(', ')}`)
  for (const [rel, want] of Object.entries(ALLOWED_CALLS)) if ((got[rel] ?? 0) !== want) problems.push(`${rel}: ${got[rel] ?? 0} call(s), expected ${want}`)
  equal(problems.length, 0, `${problems.join('\n')}\nfound ${fmt(got)}; expected ${fmt(ALLOWED_CALLS)}.\n${NOTES}`)
  const self = mintUses.calls.filter(s => s.rel === DEFINITION)
  equal(self.length, 0, `${DEFINITION} calls ${MINT} itself at ${self.map(s => where(s.sf, s.node)).join(', ')}. ${NOTES}`)
  const decls = mintUses.declarations
  deepEqual(decls.map(d => d.rel), [DEFINITION], `${MINT} must be declared once, in ${DEFINITION}; found ${fmt(count(decls))}. ${NOTES}`)
  assert.ok(hasExport(decls[0].decl), `${MINT} is no longer an exported declaration in ${DEFINITION}; re-read this test before changing it`)
  // a use that is not a call and not an import (aliased, re-exported, passed as a value) hides a call from the count above
  const hidden = mintUses.other.filter(s => s.rel !== DEFINITION)
  equal(hidden.length, 0, `${MINT} is referenced without being called (alias, re-export or passed as a value), which hides a call site from this count: ${hidden.map(s => where(s.sf, s.node)).join(', ')}. ${NOTES}`)
  const inDef = mintUses.other.filter(s => s.rel === DEFINITION)
  equal(inDef.length, 0, `${DEFINITION} references ${MINT} other than by declaring it: ${inDef.map(s => where(s.sf, s.node)).join(', ')}. ${NOTES}`)
})

// ---- b. importers
check(`b. the files that import ${MINT} are exactly the three call-site files`, () => {
  const importers = mintUses.imports
  const got = count(importers)
  const want = CALL_SITE_FILES
  deepEqual(Object.keys(got).sort(), [...want].sort(), `importers: ${fmt(got)}; expected exactly ${want.join(', ')}. ${NOTES}`)
  for (const [rel, n] of Object.entries(got)) equal(n, 1, `${rel} imports ${MINT} ${n} times, expected once`)
  const aliased = importers.filter(s => s.aliased)
  equal(aliased.length, 0, `${MINT} is imported under another name at ${aliased.map(s => where(s.sf, s.node)).join(', ')}; an alias hides a call site from this test. ${NOTES}`)
  // the module reached without naming the minter (a namespace or default import, export *, require(), import()) from any file outside the three: named imports of its other exports are fine
  const reachedAnotherWay = reachWholeModule(isTokenModule, [DEFINITION, ...CALL_SITE_FILES])
  equal(reachedAnotherWay.length, 0, `lib/${TOKEN_MODULE} is reached as a whole module (namespace import, export *, require or import()) outside the three: ${reachedAnotherWay.join(', ')}. ${NOTES}`)
})

// ---- c. the connector file's shape
check(`c. ${CONNECTORS}: one mint is the owner's library token (sessionId: connectorSessionId(...)), the other sits inside ${CHAT_HEADER}`, () => {
  const sf = need(parsed.get(CONNECTORS), CONNECTORS)
  const mints = callsTo(sf, MINT)
  equal(mints.length, 2, `${CONNECTORS} has ${mints.length} ${MINT}( calls, expected 2. ${NOTES}`)
  const sessionIdInit = (call) => objectProp(call.arguments[0], 'sessionId')
  const libraryMints = mints.filter(c => { const init = sessionIdInit(c); return !!init && isCallTo(init, 'connectorSessionId') })
  const chatMints = mints.filter(c => enclosingNamedFunction(c) && functionName(enclosingNamedFunction(c)) === CHAT_HEADER)
  equal(libraryMints.length, 1, `expected one mint that passes sessionId: connectorSessionId(...), found ${libraryMints.length}. ${NOTES}`)
  equal(chatMints.length, 1, `expected one mint inside function ${CHAT_HEADER}, found ${chatMints.length}. ${NOTES}`)
  notEqual(libraryMints[0], chatMints[0], `the same mint is both the library token and the chat token; the two sites must be different. ${NOTES}`)
  const libraryHome = enclosingNamedFunction(libraryMints[0])
  assert.ok(!libraryHome || functionName(libraryHome) !== CHAT_HEADER, `the library mint sits inside ${CHAT_HEADER}. ${NOTES}`)
  const chatInit = sessionIdInit(chatMints[0])
  assert.ok(chatInit && !isCallTo(chatInit, 'connectorSessionId'), `the mint inside ${CHAT_HEADER} must sign the chat's own session id, not a library id. ${NOTES}`)
})

check(`c. ${CHAT_HEADER}( has exactly one caller, inside ${LINKS_HANDLER}, after the ${OWNER_GATE}( refusal; it is not exported`, () => {
  const sf = need(parsed.get(CONNECTORS), CONNECTORS)
  const callers = chatHeaderUses.calls
  deepEqual(count(callers), { [CONNECTORS]: 1 }, `${CHAT_HEADER}( is called at ${callers.map(s => where(s.sf, s.node)).join(', ') || '(nowhere)'}; expected exactly one call, in ${CONNECTORS}. ${NOTES}`)
  equal(chatHeaderUses.other.length, 0, `${CHAT_HEADER} is referenced without being called (export, alias or passed as a value): ${chatHeaderUses.other.map(s => where(s.sf, s.node)).join(', ')}. ${NOTES}`)
  equal(chatHeaderUses.imports.length, 0, `${CHAT_HEADER} is imported at ${chatHeaderUses.imports.map(s => where(s.sf, s.node)).join(', ')}. ${NOTES}`)
  deepEqual(chatHeaderUses.declarations.map(d => d.rel), [CONNECTORS], `${CHAT_HEADER} must be declared once, in ${CONNECTORS}. ${NOTES}`)
  assert.ok(!hasExport(chatHeaderUses.declarations[0].decl), `${CHAT_HEADER} is exported from ${CONNECTORS}; another file could then call it without the owner check. ${NOTES}`)

  const call = callers[0].call
  const home = enclosingNamedFunction(call)
  // the call sits inside an arrow passed to guarded(...); the nearest NAMED function up the tree is the exported handler
  assert.ok(home && functionName(home) === LINKS_HANDLER, `${CHAT_HEADER}( is called inside ${home ? functionName(home) : '(no named function)'}, expected ${LINKS_HANDLER}. ${NOTES}`)
  const gates = callsTo(home, OWNER_GATE).filter(g => startOf(g) < startOf(call))
  assert.ok(gates.length > 0, `in ${LINKS_HANDLER}, ${CHAT_HEADER}( (${where(sf, call)}) does not come after an ${OWNER_GATE}( call. ${NOTES}`)
  // the refusal is acted on: its result is bound, and an if that tests it and returns sits between it and the mint
  const gate = gates[gates.length - 1]
  const bound = gate.parent && (ts.isAwaitExpression(gate.parent) ? gate.parent.parent : gate.parent)
  const refusedName = bound && ts.isVariableDeclaration(bound) && ts.isIdentifier(bound.name) ? bound.name.text : null
  assert.ok(refusedName, `in ${LINKS_HANDLER}, the result of ${OWNER_GATE}( is not bound to a variable, so its refusal cannot be returned. ${NOTES}`)
  const returns = nodesOf(home, n => ts.isIfStatement(n) && startOf(n) > startOf(gate) && n.getEnd() <= startOf(call)
    && nodesOf(n.expression, x => ts.isIdentifier(x) && x.text === refusedName).length > 0
    && nodesOf(n.thenStatement, x => ts.isReturnStatement(x)).length > 0)
  assert.ok(returns.length > 0, `in ${LINKS_HANDLER}, no \`if (${refusedName}) return ...\` sits between ${OWNER_GATE}( and ${CHAT_HEADER}(. ${NOTES}`)
})

// ---- d. route order, and one function
function routeOrder(rel) {
  const sf = need(parsed.get(rel), rel)
  const mints = callsTo(sf, MINT)
  equal(mints.length, 1, `${rel} has ${mints.length} ${MINT}( calls, expected 1. ${NOTES}`)
  const mint = mints[0], mintAt = startOf(mint)
  const lookups = chatSessionLookups(sf)
  assert.ok(lookups.length > 0, `${rel} has no prisma.chatSession.findUnique( call. ${NOTES}`)
  equal(lookups.length, 1, `${rel} has ${lookups.length} prisma.chatSession.findUnique( calls (${lookups.map(l => where(sf, l)).join(', ')}), expected 1: which one checks the chat the mint signs for would be a guess. ${NOTES}`)
  const lookup = lookups[0]
  assert.ok(startOf(lookup) < mintAt, `${rel}: ${MINT}( (${where(sf, mint)}) comes before prisma.chatSession.findUnique( (${where(sf, lookup)}). ${NOTES}`)
  // the owner-mismatch refusal: an if on `<x>.userId !== accountId` (either side, !== or !=) whose body returns (from the function the if is in)
  const isOwnerMismatch = (e) => ts.isBinaryExpression(e) && (e.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken || e.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken)
    && [[e.left, e.right], [e.right, e.left]].some(([a, b]) => ts.isPropertyAccessExpression(a) && a.name.text === 'userId' && ts.isIdentifier(b) && b.text === 'accountId')
  const refusals = nodesOf(sf, n => ts.isIfStatement(n) && nodesOf(n.expression, isOwnerMismatch).length > 0 && nodesOf(n.thenStatement, x => ts.isReturnStatement(x) && nearestFunction(x) === nearestFunction(n)).length > 0)
  assert.ok(refusals.length > 0, `${rel} has no owner-mismatch refusal (an if on <row>.userId !== accountId that returns). ${NOTES}`)
  const refusal = refusals.find(r => startOf(r) > startOf(lookup))
  assert.ok(refusal, `${rel}: the owner-mismatch refusal (${where(sf, refusals[0])}) does not come after prisma.chatSession.findUnique( (${where(sf, lookup)}). ${NOTES}`)
  assert.ok(refusal.getEnd() <= mintAt, `${rel}: ${MINT}( (${where(sf, mint)}) comes before the owner-mismatch refusal (${where(sf, refusal)}). ${NOTES}`)
  // the lookup, the refusal and the mint sit directly in one function (no callback, no helper between them), and it is the exported GET handler: a mint moved into a helper that GET calls, or that
  // a second handler calls without the check, would otherwise keep the text order above
  const home = nearestFunction(mint)
  assert.ok(nearestFunction(lookup) === home && nearestFunction(refusal) === home,
    `${rel}: the lookup (in ${describeFunction(nearestFunction(lookup))}), the owner-mismatch refusal (in ${describeFunction(nearestFunction(refusal))}) and ${MINT}( (in ${describeFunction(home)}) must sit directly in one function. ${NOTES}`)
  assert.ok(isExportedHandler(home, 'GET'), `${rel}: the lookup, the refusal and ${MINT}( sit in ${describeFunction(home)}, expected the exported GET handler itself. ${NOTES}`)
}
check(`d. ${TOKEN_ROUTE}: the lookup, the owner-mismatch refusal and the mint sit in the exported GET handler, in that order`, () => routeOrder(TOKEN_ROUTE))
check(`d. ${INGEST_ROUTE}: the lookup, the owner-mismatch refusal and the mint sit in the exported GET handler, in that order`, () => routeOrder(INGEST_ROUTE))

// ---- e. secret reads
check(`e. process.env.${SECRET_ENV} is read in exactly one place, ${DEFINITION}`, () => {
  // every code occurrence of the name (an identifier, a string or a template piece; comments never count), so process.env.X, process.env['X'],
  // a destructuring and a const holding the name are all seen
  const hits = []
  for (const [rel, sf] of parsed) {
    walkNodes(sf, n => {
      const text = ts.isIdentifier(n) ? n.text : (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) ? n.text : null
      if (text !== null && text.includes(SECRET_ENV)) hits.push({ rel, sf, node: n })
    })
  }
  const got = count(hits)
  deepEqual(got, { [DEFINITION]: 1 }, `${SECRET_ENV} appears in code at: ${fmt(got)} (${hits.map(h => where(h.sf, h.node)).join(', ')}); expected only ${DEFINITION}: 1. ${NOTES}`)
  const n = hits[0].node, p = n.parent
  const viaEnv = ts.isPropertyAccessExpression(p) && p.name === n && ts.isPropertyAccessExpression(p.expression) && p.expression.name.text === 'env' && ts.isIdentifier(p.expression.expression) && p.expression.expression.text === 'process'
  assert.ok(viaEnv, `the one occurrence in ${DEFINITION} (${where(hits[0].sf, n)}) is no longer process.env.${SECRET_ENV}; re-read this test before changing it`)
})

// ---- f. what else could sign, as far as source can show: the secret helper stays with the three, its result goes only into the minter, and the three sign only through the minter
check(`f. ${SECRET_HELPER} is imported only by the same three files, and is declared in ${DEFINITION}`, () => {
  deepEqual(helperUses.declarations.map(d => d.rel), [DEFINITION], `${SECRET_HELPER} must be declared once, in ${DEFINITION}; found ${fmt(count(helperUses.declarations))}. ${NOTES}`)
  const got = count(helperUses.imports)
  deepEqual(Object.keys(got).sort(), [...CALL_SITE_FILES].sort(), `${SECRET_HELPER} importers: ${fmt(got)}; expected exactly ${CALL_SITE_FILES.join(', ')}. ${NOTES}`)
  const aliased = helperUses.imports.filter(s => s.aliased)
  equal(aliased.length, 0, `${SECRET_HELPER} is imported under another name at ${aliased.map(s => where(s.sf, s.node)).join(', ')}. ${NOTES}`)
  // any other use (a call, an alias, a value, obj['name']) outside the three and its own file; call counts inside the three are deliberately not pinned
  const stray = [...helperUses.calls, ...helperUses.other].filter(s => s.rel !== DEFINITION && !CALL_SITE_FILES.includes(s.rel))
  equal(stray.length, 0, `${SECRET_HELPER} is used outside the three files at ${stray.map(s => where(s.sf, s.node)).join(', ')}. ${NOTES}`)
  const reached = reachWholeModule(isTokenModule, [DEFINITION, ...CALL_SITE_FILES])
  equal(reached.length, 0, `lib/${TOKEN_MODULE} is reached as a whole module (namespace import, export *, require or import()) outside the three: ${reached.join(', ')}. ${NOTES}`)
})
check(`f. in the three files every result of calling ${SECRET_HELPER}( goes only into the minter's secret or a truthiness test`, () => {
  // allowed: the call itself, or a const holding it whose every reference is one of these, as (a) the `secret` property of the object passed to ${MINT}( or (b) a truthiness test (!x, if (x), x ? a : b, an && / || operand in one)
  const problems = []
  for (const rel of CALL_SITE_FILES) {
    const sf = need(parsed.get(rel), rel)
    for (const s of helperUses.other.filter(u => u.rel === rel)) problems.push(`${where(sf, s.node)}: ${SECRET_HELPER} is named without being called (an alias, a value passed on, a re-export or a string)`)
    for (const s of helperUses.calls.filter(u => u.rel === rel)) {
      const call = unwrapUp(s.call)
      if (isMinterSecret(call) || isTruthinessOnly(call)) continue
      const holder = call.parent
      if (ts.isVariableDeclaration(holder) && holder.initializer === call && ts.isIdentifier(holder.name) && (ts.getCombinedNodeFlags(holder) & ts.NodeFlags.Const)) {
        const scope = nearestFunction(holder) ?? sf
        for (const ref of nodesOf(scope, n => ts.isIdentifier(n) && n.text === holder.name.text && n !== holder.name && !isPropertyNameOnly(n))) {
          if (!isMinterSecret(ref) && !isTruthinessOnly(ref)) problems.push(`${where(sf, ref)}: \`${holder.name.text}\` holds the result of ${SECRET_HELPER}( (${where(sf, s.call)}) and is used other than as the minter's secret or in a truthiness test`)
        }
      } else problems.push(`${where(sf, s.call)}: the result of ${SECRET_HELPER}( is used other than as the minter's secret or in a truthiness test, and is not held in a const`)
    }
  }
  equal(problems.length, 0, `${problems.join('\n')}\nthe secret may go only into ${MINT}({ secret, ... }) or a test such as \`!secret\`, \`secret ? a : b\`, \`if (secret)\`. ${NOTES}`)
})
check(`f. none of the three files calls ${SIGNER} or imports it from crypto / node:crypto: they sign only through ${MINT}`, () => {
  for (const rel of CALL_SITE_FILES) {
    const sf = need(parsed.get(rel), rel)
    const hits = []
    walkNodes(sf, n => {
      if ((ts.isIdentifier(n) && n.text === SIGNER) || ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && n.text === SIGNER)) hits.push(where(sf, n)) // a call, an import specifier (aliased or not), a member, obj['createHmac']
    })
    equal(hits.length, 0, `${rel} names ${SIGNER} (a call, an import or a member) at ${hits.join(', ')}; a mint site must sign only through ${MINT}. ${NOTES}`)
  }
  // the whole crypto module taken without naming createHmac (namespace or default import, require('crypto'), import('crypto'), export *) would hand it over unseen
  const reached = reachWholeModule(isCryptoModule, [...parsed.keys()].filter(rel => !CALL_SITE_FILES.includes(rel)))
  equal(reached.length, 0, `${reached.join(', ')} take the whole crypto module (namespace or default import, export *, require or import()); a mint site must sign only through ${MINT}. ${NOTES}`)
})
check(`f. none of the three files, nor ${DEFINITION}, uses Web Crypto's subtle`, () => {
  for (const rel of [...CALL_SITE_FILES, DEFINITION]) {
    const sf = need(parsed.get(rel), rel)
    const hits = []
    walkNodes(sf, n => {
      if ((ts.isIdentifier(n) && n.text === 'subtle') || ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && n.text === 'subtle')) hits.push(where(sf, n)) // crypto.subtle, crypto['subtle'], { subtle } = crypto
    })
    equal(hits.length, 0, `${rel} names subtle (Web Crypto, crypto.subtle) at ${hits.join(', ')}; the three files sign only through ${MINT} and the library only with ${SIGNER}. ${NOTES}`)
  }
})

// ---- g. session-token route: the mint signs the very chat the lookup checked
check(`g. ${TOKEN_ROUTE}: the mint's sessionId is the same variable the prisma.chatSession.findUnique( lookup uses as where.id`, () => {
  const sf = need(parsed.get(TOKEN_ROUTE), TOKEN_ROUTE)
  const mints = callsTo(sf, MINT)
  equal(mints.length, 1, `${TOKEN_ROUTE} has ${mints.length} ${MINT}( calls, expected 1. ${NOTES}`)
  const lookups = chatSessionLookups(sf)
  equal(lookups.length, 1, `${TOKEN_ROUTE} has ${lookups.length} prisma.chatSession.findUnique( calls, expected 1. ${NOTES}`)
  const checkedId = objectProp(objectProp(lookups[0].arguments[0], 'where'), 'id')
  assert.ok(checkedId && ts.isIdentifier(checkedId), `${TOKEN_ROUTE}: the lookup's where.id (${where(sf, lookups[0])}) is not a plain variable, so what the mint signs cannot be tied to what was checked. ${NOTES}`)
  const signedId = objectProp(mints[0].arguments[0], 'sessionId')
  assert.ok(signedId && ts.isIdentifier(signedId), `${TOKEN_ROUTE}: the mint's sessionId (${where(sf, mints[0])}) is not a plain variable (it must be \`${checkedId.text}\`, the one the lookup checked). ${NOTES}`)
  const checkedDecl = bindingOf(checkedId), signedDecl = bindingOf(signedId)
  assert.ok(checkedDecl, `${TOKEN_ROUTE}: where.id names \`${checkedId.text}\` (${where(sf, checkedId)}), which is not declared in this file. ${NOTES}`)
  assert.ok(signedDecl === checkedDecl, `${TOKEN_ROUTE}: the mint signs \`${signedId.text}\` (${where(sf, signedId)}, declared ${signedDecl ? `at ${where(sf, signedDecl)}` : 'nowhere in this file'}) but the lookup checked \`${checkedId.text}\` (${where(sf, checkedId)}, declared at ${where(sf, checkedDecl)}); they are not the same variable, so the token may be for a chat nobody checked. ${NOTES}`)
  const decl = checkedDecl.parent
  assert.ok(ts.isVariableDeclaration(decl) && (ts.getCombinedNodeFlags(decl) & ts.NodeFlags.Const), `${TOKEN_ROUTE}: \`${checkedId.text}\` is not a const, so it could change between the lookup and the mint. ${NOTES}`)
})

// ---- h. ingest-status route: the minted token goes into the one upstream request and nowhere else
check(`h. ${INGEST_ROUTE}: the minted token is used once, as a header value of the one upstream fetch, and never in a response, a log or a return`, () => {
  const sf = need(parsed.get(INGEST_ROUTE), INGEST_ROUTE)
  const mints = callsTo(sf, MINT)
  equal(mints.length, 1, `${INGEST_ROUTE} has ${mints.length} ${MINT}( calls, expected 1. ${NOTES}`)
  const holder = unwrapUp(mints[0]).parent
  assert.ok(ts.isVariableDeclaration(holder) && ts.isIdentifier(holder.name) && (ts.getCombinedNodeFlags(holder) & ts.NodeFlags.Const), `${INGEST_ROUTE}: the result of ${MINT}( (${where(sf, mints[0])}) is not held in a const, so this test cannot follow where the token goes. ${NOTES}`)
  const name = holder.name.text
  const tokenUses = [], stray = []
  for (const ref of nodesOf(sf, n => ts.isIdentifier(n) && n.text === name && n !== holder.name && !isPropertyNameOnly(n))) {
    const p = ref.parent
    if (ts.isPrefixUnaryExpression(p) && p.operator === ts.SyntaxKind.ExclamationToken) continue // the null guard, !minted: a boolean
    if (ts.isPropertyAccessExpression(p) && p.expression === ref && p.name.text === 'token') tokenUses.push(p)
    else stray.push(ref)
  }
  equal(stray.length, 0, `${INGEST_ROUTE}: \`${name}\` (the minted token) is used at ${stray.map(r => where(sf, r)).join(', ')} other than as \`!${name}\` or \`${name}.token\`; the token must never be returned, logged or passed on. ${NOTES}`)
  equal(tokenUses.length, 1, `${INGEST_ROUTE}: \`${name}.token\` is used ${tokenUses.length} times (${tokenUses.map(u => where(sf, u)).join(', ') || 'never'}), expected exactly once, as the header value of the upstream request; a response, a log line or a second request must not carry it. ${NOTES}`)
  // that one use is `headers: { <key>: minted.token }` in the options argument of a fetch( call, and it is the file's only fetch( call, made by the same function as the mint
  const use = tokenUses[0]
  const entry = ts.isPropertyAssignment(use.parent) && use.parent.initializer === use ? use.parent : null
  const headers = entry && ts.isObjectLiteralExpression(entry.parent) ? entry.parent : null
  const headersProp = headers && ts.isPropertyAssignment(headers.parent) && headers.parent.initializer === headers && ts.isIdentifier(headers.parent.name) && headers.parent.name.text === 'headers' ? headers.parent : null
  const options = headersProp && ts.isObjectLiteralExpression(headersProp.parent) ? headersProp.parent : null
  const fetchCall = options && ts.isCallExpression(options.parent) && options.parent.arguments[1] === options && calleeName(options.parent) === 'fetch' ? options.parent : null
  assert.ok(fetchCall, `${INGEST_ROUTE}: \`${name}.token\` (${where(sf, use)}) is not the value of an entry in the \`headers\` of the options argument of a fetch( call. ${NOTES}`)
  const fetches = callsTo(sf, 'fetch')
  equal(fetches.length, 1, `${INGEST_ROUTE} has ${fetches.length} fetch( calls (${fetches.map(f => where(sf, f)).join(', ')}), expected exactly 1, the upstream request that carries the token. ${NOTES}`)
  assert.ok(fetches[0] === fetchCall, `${INGEST_ROUTE}: the fetch( that carries the token (${where(sf, fetchCall)}) is not the file's only fetch( call. ${NOTES}`)
  assert.ok(nearestFunction(fetchCall) === nearestFunction(mints[0]), `${INGEST_ROUTE}: the fetch( that carries the token is in ${describeFunction(nearestFunction(fetchCall))} but the mint is in ${describeFunction(nearestFunction(mints[0]))}. ${NOTES}`)
})

// ---- i. the library: the one place that signs
check(`i. ${DEFINITION} exports exactly today's names (${LIBRARY_EXPORTS.length}), so a second signing function cannot be imported unseen`, () => {
  const sf = need(parsed.get(DEFINITION), DEFINITION)
  const got = exportedNames(sf).sort(), want = [...LIBRARY_EXPORTS].sort()
  const added = got.filter(x => !want.includes(x)), missing = want.filter(x => !got.includes(x))
  deepEqual(got, want, `${DEFINITION} exports ${got.length} names, expected ${want.length}. Added: ${added.join(', ') || '(none)'}. Missing: ${missing.join(', ') || '(none)'}. A new export here (a sibling of ${MINT} with another lifetime, say) is a new way to sign: a person must read it before this list changes. ${NOTES}`)
})
check(`i. ${DEFINITION}: ${SIGNER} is called once, inside ${MINT}, and nothing but ${SIGNER} is taken from crypto`, () => {
  const sf = need(parsed.get(DEFINITION), DEFINITION)
  const calls = callsTo(sf, SIGNER)
  equal(calls.length, 1, `${DEFINITION} has ${calls.length} ${SIGNER}( calls (${calls.map(c => where(sf, c)).join(', ') || 'none'}), expected exactly 1, inside ${MINT}. ${NOTES}`)
  const home = nearestFunction(calls[0])
  assert.ok(home && ts.isFunctionDeclaration(home) && home.name?.text === MINT && hasExport(home), `the one ${SIGNER}( call in ${DEFINITION} (${where(sf, calls[0])}) is in ${describeFunction(home)}, expected the exported function ${MINT}. ${NOTES}`)
  // every other mention of createHmac (an alias, a value passed on, obj['createHmac']) would hide a second use
  const callee = calls[0].expression
  const calleeNode = ts.isIdentifier(callee) ? callee : callee.name
  const mentions = nodesOf(sf, n => n !== calleeNode && ((ts.isIdentifier(n) && n.text === SIGNER) || ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && n.text === SIGNER)))
  const importSpecifiers = mentions.filter(n => ts.isImportSpecifier(n.parent) && n.parent.name === n && !n.parent.propertyName)
  const loose = mentions.filter(n => !importSpecifiers.includes(n))
  equal(loose.length, 0, `${DEFINITION} names ${SIGNER} other than in its one call and its import at ${loose.map(n => where(sf, n)).join(', ')} (an alias, a value passed on, a string). ${NOTES}`)
  const taken = nodesOf(sf, n => ts.isImportDeclaration(n) && isCryptoModule(n.moduleSpecifier)).flatMap(d => {
    const clause = d.importClause, bound = clause?.namedBindings
    return [...(clause?.name ? [`default ${clause.name.text}`] : []), ...(bound && ts.isNamespaceImport(bound) ? ['* as namespace'] : []),
      ...(bound && ts.isNamedImports(bound) ? bound.elements.map(el => (el.propertyName ? `${el.propertyName.text} as ${el.name.text}` : el.name.text)) : [])]
  })
  deepEqual(taken, [SIGNER], `${DEFINITION} takes ${taken.join(', ') || 'nothing'} from crypto; expected only { ${SIGNER} }. ${NOTES}`)
  const reached = reachWholeModule(isCryptoModule, [...parsed.keys()].filter(rel => rel !== DEFINITION))
  equal(reached.length, 0, `${reached.join(', ')} takes the whole crypto module (require or import()); the library may take only ${SIGNER}. ${NOTES}`)
})

console.log(`\n${passed} passed, ${failed} failed`)
console.log(failed === 0 ? 'PASS test-studio-researcher-token-mint-sites' : 'FAIL test-studio-researcher-token-mint-sites')
process.exit(failed === 0 ? 0 : 1)
