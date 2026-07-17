import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const generatorRoot = process.env.DIAGRAM_GENERATOR_REPO
  ? path.resolve(process.env.DIAGRAM_GENERATOR_REPO)
  : path.resolve(frontendRoot, '..', 'diagram-generator')

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
