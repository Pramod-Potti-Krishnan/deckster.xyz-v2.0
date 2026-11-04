// C-07 (pre-promotion, PROGRAM-1 ruling 4 Nov 2026): app/api/dev/mock-token/route.ts is DELETED outright. It replaces the earlier gate
// (NODE_ENV === 'development' AND NEXT_PUBLIC_DEV_MODE). No flag: a security fix applies in every environment.
// Proves: 1. the route file (and its now-empty folder) is gone, on disk and in the committed tree, and was in the base;
//         2. no source file references /api/dev/mock-token (only this proof, the strip registry and the older pins that name it);
//         3. the route set (base vs HEAD) loses exactly /api/dev/mock-token;
//         4. the change is registered (scripts/studio-prepromo-strip.mjs PREPROMO_DELETED / PREPROMO_REMOVED_ROUTES, in the later-changes registry);
//         5. mutants: each must make 1-4 fail.
// Plain node; `git` reads the base and HEAD trees. No server, no network.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { PREPROMO_BASE, PREPROMO_DELETED, PREPROMO_REMOVED_ROUTES, PREPROMO_SCOPE_FILES } from './studio-prepromo-strip.mjs'
import { LATER_CHANGE_FILES } from './studio-later-changes.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.PREPROMO_BASE || PREPROMO_BASE
const ROUTE = 'app/api/dev/mock-token/route.ts'
const LINK = /\/api\/dev\/mock-token(?![\w-])/
const SOURCE_DIRS = ['app', 'components', 'lib', 'hooks', 'types', 'contexts', 'utils', 'stores', 'pages', 'src']
const SOURCE_FILES = ['middleware.ts', 'next.config.mjs', 'next.config.js', 'next.config.ts', 'vercel.json', 'package.json']
const SOURCE_EXT = /\.(tsx?|jsx?|mjs|cjs|json)$/
// non-app files that still name the route: this proof, the registry strip, and the older pins that name it (reported, not app code)
const KNOWN_SCRIPTS = ['scripts/test-studio-dev-token-gate.mjs', 'scripts/studio-prepromo-strip.mjs', 'scripts/test-studio-dev-server.mjs', 'scripts/test-studio-dev-deployment.mjs',
  'scripts/test-studio-d1-debug-routes.mjs', 'scripts/test-studio-build-provenance.mjs', 'scripts/test-studio-jose-candidate.mjs']
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
const gitOk = (...args) => { try { git(...args); return true } catch { return false } }

const routesOf = files => [...new Set(files
  .filter(file => /^app\/(.*\/)?(page|route)\.(tsx|ts|jsx|js)$/.test(file))
  .map(file => '/' + file.replace(/^app\//, '').replace(/(^|\/)(page|route)\.\w+$/, '').split('/').filter(segment => segment && !/^\(.*\)$/.test(segment)).join('/')))].sort()

const real = {
  exists: rel => fs.existsSync(path.join(root, rel)),
  inHead: rel => gitOk('cat-file', '-e', `HEAD:${rel}`),
  headFiles: () => git('ls-tree', '-r', '--name-only', 'HEAD').split('\n').filter(Boolean),
  read: rel => fs.readFileSync(path.join(root, rel), 'utf8'),
  deleted: PREPROMO_DELETED, removed: PREPROMO_REMOVED_ROUTES, registered: LATER_CHANGE_FILES, scope: PREPROMO_SCOPE_FILES,
}
const baseFiles = git('ls-tree', '-r', '--name-only', BASE).split('\n').filter(Boolean)

function check(w) {
  let n = 0
  const ok = (v, m) => { assert.ok(v, m); n++ }
  const deep = (a, b, m) => { assert.deepEqual(a, b, m); n++ }
  // 1. gone
  ok(!w.exists(ROUTE), `${ROUTE} is not on disk`)
  ok(!w.exists(path.dirname(ROUTE)), `${path.dirname(ROUTE)} is gone too`)
  ok(!w.inHead(ROUTE), `${ROUTE} is not in the committed tree`)
  ok(baseFiles.includes(ROUTE), `${ROUTE} was in the base ${BASE.slice(0, 8)}`)
  // 2. no source references it
  const head = w.headFiles()
  const sources = head.filter(rel => (SOURCE_DIRS.some(d => rel.startsWith(`${d}/`)) || SOURCE_FILES.includes(rel)) && SOURCE_EXT.test(rel) && w.exists(rel))
  ok(sources.length > 100, `scanned ${sources.length} source files`)
  for (const rel of sources) { assert.doesNotMatch(w.read(rel), LINK, `${rel} references /api/dev/mock-token`); n++ }
  const scripts = head.filter(rel => rel.startsWith('scripts/') && w.exists(rel) && LINK.test(w.read(rel))).sort()
  for (const rel of scripts) ok(KNOWN_SCRIPTS.includes(rel), `${rel} is a known script`)
  // 3. the route set loses exactly that route
  const before = routesOf(baseFiles), after = routesOf(head)
  deep(before.filter(route => !after.includes(route)), ['/api/dev/mock-token'], 'the route set loses exactly /api/dev/mock-token')
  deep(after.filter(route => !before.includes(route)).filter(route => route.startsWith('/api/dev')), [], 'no /api/dev route is added back')
  // 4. registered as a deletion
  deep(w.deleted, [ROUTE], 'PREPROMO_DELETED is the route file')
  deep(w.removed, ['/api/dev/mock-token'], 'PREPROMO_REMOVED_ROUTES is the route')
  deep(routesOf(w.deleted), w.removed, 'the deleted file served exactly the removed route')
  ok(w.scope.includes(ROUTE) && w.registered.has(ROUTE), 'the registry names the deleted file')
  return n
}

const checks = check(real)

const routeBase = git('show', `${BASE}:${ROUTE}`)
const MUTANTS = [
  ['route restored on disk', { exists: rel => rel === ROUTE || rel === path.dirname(ROUTE) || real.exists(rel) }],
  ['route restored in HEAD', { inHead: rel => rel === ROUTE || real.inHead(rel), headFiles: () => [...real.headFiles(), ROUTE] }],
  ['a component fetches it', { read: rel => rel.startsWith('components/') && rel.endsWith('.tsx') ? real.read(rel) + "\nfetch('/api/dev/mock-token')\n" : real.read(rel) }],
  ['a hook links it', { read: rel => rel.startsWith('hooks/') ? real.read(rel) + "\n// POST /api/dev/mock-token\n" : real.read(rel) }],
  ['a new unknown script names it', { headFiles: () => [...real.headFiles(), 'scripts/new-mock.mjs'], exists: rel => rel === 'scripts/new-mock.mjs' || real.exists(rel), read: rel => rel === 'scripts/new-mock.mjs' ? "fetch('/api/dev/mock-token')" : real.read(rel) }],
  ['another route also deleted', { headFiles: () => real.headFiles().filter(rel => rel !== 'app/api/version/route.ts') }],
  ['moved to another path', { headFiles: () => [...real.headFiles(), 'app/api/dev/token/route.ts'] }],
  ['not registered', { registered: new Set([...LATER_CHANGE_FILES].filter(rel => rel !== ROUTE)) }],
  ['deletion list empty', { deleted: [] }],
  ['wrong removed route', { removed: ['/api/dev'] }],
  ['the old gated route text back', { exists: rel => rel === ROUTE || real.exists(rel), read: rel => rel === ROUTE ? routeBase : real.read(rel) }],
]
let killed = 0
for (const [name, override] of MUTANTS) {
  let survived = false
  try { check({ ...real, ...override }); survived = true } catch { killed++ }
  assert.ok(!survived, `mutant "${name}" survived`)
}
console.log(`dev token route deleted: ${checks} checks passed, ${killed}/${MUTANTS.length} mutants killed`)
