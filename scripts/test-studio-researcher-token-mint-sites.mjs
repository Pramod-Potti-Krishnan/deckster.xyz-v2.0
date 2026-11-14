/**
 * KNOWLEDGE-3, the F1 follow-up (test only): Studio signs a Researcher K-06 session token (lib/researcher-session-token.ts,
 * mintResearcherSessionToken) at exactly four places, and each one signs only for an owner it has already checked.
 *
 * Why it is pinned: Researcher's DSB-3 (RESEARCHER_CONNECTOR_BIND_ON_LINK_ENABLED) binds a chat that has no owner record to the owner named
 * in the token, so the token is the whole proof of ownership. That holds only while nobody can get a token for a chat they do not own, and that
 * rests on there being exactly these four mint sites (KNOWLEDGE-3's F1 note streams/knowledge-3/reviews/F1-OWNER-CHECKED-CLAIM.md; REVIEW-1's
 * streams/review1/uploads-v1.0-277.md, F1, closed by construction). A fifth site, or a site that moves above its owner check, must fail here
 * and be read by a person.
 *
 *   1. app/api/researcher/ingest-status/[jobId]/route.ts   x1, chat-scoped: prisma.chatSession.findUnique, then a userId !== accountId refusal, then the mint
 *   2. app/api/researcher/session-token/route.ts           x1, chat-scoped: same order
 *   3. lib/connectors-gdrive-server.ts                     x2: connectorIdentityHeader (sessionId: connectorSessionId(owner), the owner's own library token, not a chat)
 *                                                              and chatSessionIdentityHeader (chat-scoped; one caller, handleSessionLinks, after ownChatRefusal)
 *
 * Assertions: a. call sites  b. importers  c. the connector file's shape  d. route order  e. where RESEARCHER_SESSION_TOKEN_SECRET is read
 *   f. nothing else signs: researcherSessionTokenSecret (the secret helper) is imported only by the same three files, and those three never call or import createHmac.
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
  const sessionIdInit = (call) => {
    const arg = call.arguments[0]
    if (!arg || !ts.isObjectLiteralExpression(arg)) return null
    for (const prop of arg.properties) {
      if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'sessionId') return prop.initializer
      if (ts.isShorthandPropertyAssignment(prop) && prop.name.text === 'sessionId') return prop.name
    }
    return null
  }
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

// ---- d. route order
function routeOrder(rel) {
  const sf = need(parsed.get(rel), rel)
  const mints = callsTo(sf, MINT)
  equal(mints.length, 1, `${rel} has ${mints.length} ${MINT}( calls, expected 1. ${NOTES}`)
  const mintAt = startOf(mints[0])
  const lookups = nodesOf(sf, n => isCallTo(n, 'findUnique') && ts.isPropertyAccessExpression(n.expression) && ts.isPropertyAccessExpression(n.expression.expression)
    && n.expression.expression.name.text === 'chatSession' && ts.isIdentifier(n.expression.expression.expression) && n.expression.expression.expression.text === 'prisma')
  assert.ok(lookups.length > 0, `${rel} has no prisma.chatSession.findUnique( call. ${NOTES}`)
  const lookup = lookups[0]
  assert.ok(startOf(lookup) < mintAt, `${rel}: ${MINT}( (${where(sf, mints[0])}) comes before prisma.chatSession.findUnique( (${where(sf, lookup)}). ${NOTES}`)
  // the owner-mismatch refusal: an if on `<x>.userId !== accountId` (either side, !== or !=) whose body returns
  const isOwnerMismatch = (e) => ts.isBinaryExpression(e) && (e.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken || e.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken)
    && [[e.left, e.right], [e.right, e.left]].some(([a, b]) => ts.isPropertyAccessExpression(a) && a.name.text === 'userId' && ts.isIdentifier(b) && b.text === 'accountId')
  const refusals = nodesOf(sf, n => ts.isIfStatement(n) && nodesOf(n.expression, isOwnerMismatch).length > 0 && nodesOf(n.thenStatement, x => ts.isReturnStatement(x)).length > 0)
  assert.ok(refusals.length > 0, `${rel} has no owner-mismatch refusal (an if on <row>.userId !== accountId that returns). ${NOTES}`)
  const refusal = refusals.find(r => startOf(r) > startOf(lookup))
  assert.ok(refusal, `${rel}: the owner-mismatch refusal (${where(sf, refusals[0])}) does not come after prisma.chatSession.findUnique( (${where(sf, lookup)}). ${NOTES}`)
  assert.ok(refusal.getEnd() <= mintAt, `${rel}: ${MINT}( (${where(sf, mints[0])}) comes before the owner-mismatch refusal (${where(sf, refusal)}). ${NOTES}`)
}
check(`d. ${TOKEN_ROUTE}: the mint comes after prisma.chatSession.findUnique( and after the owner-mismatch refusal`, () => routeOrder(TOKEN_ROUTE))
check(`d. ${INGEST_ROUTE}: the mint comes after prisma.chatSession.findUnique( and after the owner-mismatch refusal`, () => routeOrder(INGEST_ROUTE))

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

// ---- f. nothing else signs: the secret helper stays with the three, and the three sign only through the minter
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

console.log(`\n${passed} passed, ${failed} failed`)
console.log(failed === 0 ? 'PASS test-studio-researcher-token-mint-sites' : 'FAIL test-studio-researcher-token-mint-sites')
process.exit(failed === 0 ? 0 : 1)
