import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const configuredGeneratorRoot = process.env.DIAGRAM_GENERATOR_REPO
  ? path.resolve(process.env.DIAGRAM_GENERATOR_REPO)
  : null
const generatorCandidates = [
  configuredGeneratorRoot,
  // Normal master-polyrepo checkout: <Deckster>/frontend + backend/diagram-generator.
  path.resolve(frontendRoot, '..', 'backend', 'diagram-generator'),
  // Isolated frontend worktree: <Deckster>/.worktrees/<name>.
  path.resolve(frontendRoot, '..', '..', 'backend', 'diagram-generator'),
  // Backward-compatible sibling checkout used by older CI jobs.
  path.resolve(frontendRoot, '..', 'diagram-generator'),
].filter(Boolean)
const isGeneratorRepo = candidate => fs.existsSync(
  path.join(candidate, 'models', 'atomic_catalog.py'),
)
const generatorRoot = generatorCandidates.find(isGeneratorRepo)

if (configuredGeneratorRoot && !isGeneratorRepo(configuredGeneratorRoot)) {
  throw new Error(
    `DIAGRAM_GENERATOR_REPO does not contain models/atomic_catalog.py: ${configuredGeneratorRoot}`,
  )
}
if (!generatorRoot) {
  const checkedOutGenerator = generatorCandidates.find(candidate => (
    fs.existsSync(path.join(candidate, '.git'))
  ))
  if (checkedOutGenerator) {
    throw new Error(
      `Diagram Generator checkout does not expose models/atomic_catalog.py: ${checkedOutGenerator}. `
      + 'Check out its deployment ref or set DIAGRAM_GENERATOR_REPO to the matching isolated worktree.',
    )
  }
  console.warn(
    'SKIP diagram catalog drift (frontend-only checkout): Diagram Generator is not available. '
    + 'Set DIAGRAM_GENERATOR_REPO to make this cross-repo contract test mandatory.',
  )
  process.exit(0)
}

const source = fs.readFileSync(path.join(frontendRoot, 'lib/diagram-catalog.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const mod = { exports: {} }
vm.runInNewContext(compiled.outputText, {
  module: mod,
  exports: mod.exports,
  console,
  process,
  fetch,
  setTimeout,
  require: id => {
    throw new Error(`Unexpected catalog import: ${id}`)
  },
})

const generatorCatalog = JSON.parse(execFileSync(
  'python3',
  [
    '-c',
    'import json; from models.atomic_catalog import atomic_catalog; print(json.dumps(atomic_catalog()))',
  ],
  { cwd: generatorRoot, encoding: 'utf8' },
))
const frontendCatalog = JSON.parse(JSON.stringify(mod.exports.DIAGRAM_CATALOG_FALLBACK))

assert.deepEqual(
  frontendCatalog,
  generatorCatalog,
  'Frontend fallback must exactly mirror the Diagram Generator catalog',
)

console.log('diagram catalog drift test passed')
