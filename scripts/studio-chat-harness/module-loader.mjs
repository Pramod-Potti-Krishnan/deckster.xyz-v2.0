// Loads the repo's own TypeScript modules (hook, components, libs) into one vm context
// that holds the fake browser globals. `@/x` resolves to the repo, `./x` relative to the
// importing file, node packages (react, react-markdown, lucide-react, ...) come from the
// repo's node_modules, and node built-ins are refused so nothing can reach the network.
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'

const EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs']

export function createModuleLoader({ root, globals, stubs = {}, fileStubs = {}, esmPackages = {} }) {
  const hostRequire = createRequire(path.join(root, 'package.json'))
  const context = vm.createContext({ ...globals })
  const cache = new Map()
  const sourceHashes = new Map()

  const resolveFile = base => {
    if (fs.existsSync(base) && fs.statSync(base).isFile()) return base
    for (const ext of EXTENSIONS) if (fs.existsSync(base + ext)) return base + ext
    for (const ext of EXTENSIONS) if (fs.existsSync(path.join(base, 'index' + ext))) return path.join(base, 'index' + ext)
    throw new Error(`harness loader: cannot resolve ${path.relative(root, base)}`)
  }

  function requireFrom(fromFile, specifier) {
    if (Object.prototype.hasOwnProperty.call(stubs, specifier)) return stubs[specifier]
    if (/\.(css|scss|svg|png)$/.test(specifier)) return {}
    if (specifier.startsWith('@/')) return loadFile(resolveFile(path.join(root, specifier.slice(2))))
    if (specifier.startsWith('./') || specifier.startsWith('../')) return loadFile(resolveFile(path.resolve(path.dirname(fromFile), specifier)))
    if (specifier.startsWith('node:') || ['fs', 'net', 'http', 'https', 'child_process', 'dns', 'tls', 'dgram', 'os', 'path', 'crypto', 'stream', 'zlib', 'worker_threads'].includes(specifier)) {
      throw new Error(`harness loader: node built-in "${specifier}" is refused (imported by ${path.relative(root, fromFile)})`)
    }
    if (Object.prototype.hasOwnProperty.call(esmPackages, specifier)) return esmPackages[specifier]
    try {
      return hostRequire(specifier)
    } catch (error) {
      if (error?.code === 'ERR_REQUIRE_ESM' || error?.code === 'ERR_REQUIRE_ASYNC_MODULE') {
        throw new Error(`harness loader: "${specifier}" is ESM-only; add it to ESM_PACKAGES in scripts/studio-chat-harness/index.mjs`)
      }
      throw new Error(`harness loader: cannot load "${specifier}" for ${path.relative(root, fromFile)}: ${error.message.split('\n')[0]}`)
    }
  }

  function loadFile(file) {
    const stubKey = path.relative(root, file).replace(/\.(tsx?|jsx?|mjs)$/, '')
    if (Object.prototype.hasOwnProperty.call(fileStubs, stubKey)) return fileStubs[stubKey]
    if (cache.has(file)) return cache.get(file).exports
    const source = fs.readFileSync(file, 'utf8')
    sourceHashes.set(path.relative(root, file), source.length)
    const compiled = ts.transpileModule(source, {
      fileName: file,
      reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, isolatedModules: true },
    })
    const errors = (compiled.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error)
    if (errors.length) throw new Error(`harness loader: syntax error in ${path.relative(root, file)}: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`)
    const module = { exports: {} }
    cache.set(file, module)
    const wrapper = vm.runInContext(`(function (module, exports, require, __filename) {${compiled.outputText}\n})`, context, { filename: file })
    wrapper(module, module.exports, specifier => requireFrom(file, specifier), file)
    return module.exports
  }

  return {
    context,
    load: relative => loadFile(resolveFile(path.join(root, relative))),
    loaded: () => [...sourceHashes.keys()].sort(),
  }
}
