// ESM-only packages the chat renders with, imported once with dynamic import() so the
// vm-hosted CommonJS modules can `require` them synchronously.
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

let cached = null
export async function esmPackages(root) {
  if (cached?.root === root) return cached.value
  const resolved = createRequire(path.join(root, 'package.json')).resolve('react-markdown')
  const markdown = (await import(pathToFileURL(resolved).href)).default
  cached = { root, value: { 'react-markdown': { __esModule: true, default: markdown } } }
  return cached.value
}

// lucide-react icons render as a compact <svg data-icon="Name" ...> instead of ~1KB of path
// data: the baseline still records WHICH icon, its size and classes, and diffs stay readable.
export function lucideStub(React) {
  const cache = new Map()
  return new Proxy({ __esModule: true }, {
    get(target, name) {
      if (name in target || typeof name !== 'string') return target[name]
      if (!cache.has(name)) {
        const Icon = props => React.createElement('svg', { 'data-icon': name, ...props })
        Icon.displayName = `Icon(${name})`
        cache.set(name, Icon)
      }
      return cache.get(name)
    },
  })
}
