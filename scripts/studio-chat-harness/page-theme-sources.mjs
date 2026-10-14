// The page's deck-theme preflight (PASS2-J3 P0), for fixtures with `"elementPreflight": true` only: the regions of
// app/builder/page.tsx that decide whether a theme pick reaches Director (set_theme) and whether Add Element's theme
// preflight lets a generation through to Text Labs. Every region is read from the live source by AST, compiled once and
// bound per render through the same strict scope as the chat regions (page-extract.mjs). Their anchors are written to the
// opt-in fixture's own `theme-sources.json`, so `_sources.json` (and every pre-existing baseline) is untouched.
import path from 'node:path'
import ts from 'typescript'
import * as extract from './page-extract.mjs'

const cache = new Map()

function find(source, predicate, what) {
  let hit = null
  const visit = node => { if (!hit && predicate(node)) hit = node; if (!hit) ts.forEachChild(node, visit) }
  visit(source)
  if (!hit) throw new Error(`harness extract: could not find ${what}. The page changed shape; update scripts/studio-chat-harness/page-theme-sources.mjs and re-record.`)
  return hit
}

export function pageThemeSources(root) {
  if (cache.has(root)) return cache.get(root)
  const page = extract.parseSource(path.join(root, 'app/builder/page.tsx'))
  const regions = []
  const compile = (label, node) => { regions.push(extract.anchor(label, node, page)); return extract.compile(node, page, label) }
  // const name = useCallback(fn, deps) -> { fn, deps }: memoised with the page's own dependency list, as React does.
  const callback = name => {
    const call = extract.findVariableInitializer(page, name)
    if (!ts.isCallExpression(call) || call.expression.getText(page) !== 'useCallback') throw new Error(`harness extract: ${name} is no longer a useCallback`)
    return { fn: compile(`page.${name}`, call.arguments[0]), deps: compile(`page.${name}.deps`, call.arguments[1]) }
  }
  const effect = extract.findCalls(page, 'useEffect').find(call => {
    const text = call.arguments[0].getText(page)
    return text.includes('composerThemeBlocked') && text.includes('requestThemeSyncForPresentation(effectivePresentationId)')
  })
  if (!effect) throw new Error('harness extract: the deck-theme sync effect (composerThemeBlocked -> requestThemeSyncForPresentation) is gone')
  const targetRef = extract.findVariableInitializer(page, 'themeSyncTargetRef')
  const targetAssign = find(page, node => ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
    && node.left.getText(page) === 'themeSyncTargetRef.current', '`themeSyncTargetRef.current = {...}`')
  const profileMatch = find(page, node => ts.isFunctionDeclaration(node) && node.name?.text === 'buildThemeProfileMatchesSelection', 'function buildThemeProfileMatchesSelection')

  const compiled = {
    composerLibraryEnabled: compile('page.composerLibraryEnabled', extract.findVariableInitializer(page, 'composerLibraryEnabled')),
    themeSyncTimeoutMs: compile('page.THEME_SYNC_TIMEOUT_MS', extract.findVariableInitializer(page, 'THEME_SYNC_TIMEOUT_MS')),
    buildThemeProfileMatchesSelection: compile('page.buildThemeProfileMatchesSelection', profileMatch),
    getThemeSyncSnapshot: callback('getThemeSyncSnapshot'),
    commitThemeSync: callback('commitThemeSync'),
    clearThemeSyncTimeout: callback('clearThemeSyncTimeout'),
    handleBuildThemeChange: callback('handleBuildThemeChange'),
    composerThemeBlocked: compile('page.composerThemeBlocked', extract.findVariableInitializer(page, 'composerThemeBlocked')),
    composerThemeFrozen: compile('page.composerThemeFrozen', extract.findVariableInitializer(page, 'composerThemeFrozen')),
    themeSyncTargetInitial: compile('page.themeSyncTargetRef(initial)', targetRef.arguments[0]),
    themeSyncTargetCurrent: compile('page.themeSyncTargetRef.current', targetAssign.right),
    requestThemeSyncForPresentation: callback('requestThemeSyncForPresentation'),
    ensureThemeReady: callback('ensureThemeReady'),
    themeSyncEffect: { fn: compile('page.themeSyncEffect', effect.arguments[0]), deps: compile('page.themeSyncEffect.deps', effect.arguments[1]) },
  }
  const result = { compiled, regions: regions.sort((a, b) => (a.label < b.label ? -1 : 1)) }
  cache.set(root, result)
  return result
}
