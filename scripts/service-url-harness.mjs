// Shared exports from the actual FE0 pure module; no fake validation or fallback.
// One cached instance preserves ServiceUrlConfigError identity across VM loaders.
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const module = { exports: {} }
vm.runInNewContext(ts.transpileModule(
  fs.readFileSync(new URL('../lib/service-url.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText, {
  module, exports: module.exports, URL, Error,
  require: id => { throw new Error(`Unexpected service URL harness import: ${id}`) },
})
export const serviceUrl = module.exports
// These domains are reserved fixtures; each test still owns/refuses its fetch.
export const textLabsEnv = Object.freeze({ NEXT_PUBLIC_ELEMENTOR_URL: 'https://textlabs.synthetic.invalid' })
