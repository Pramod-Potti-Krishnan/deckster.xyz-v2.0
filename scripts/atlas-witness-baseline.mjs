import fs from 'node:fs'
import { createHash } from 'node:crypto'

// Exact frozen historical sources only. No Git/network fallback or override.
const directory = new URL('./fixtures/atlas-witness-baselines/', import.meta.url)
const manifestBytes = fs.readFileSync(new URL('manifest.json', directory))
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const expectedManifestSha256 = 'f2baadad7f924aedb47b1438135b6a45455f555aee382086f6307c16320f0e6a'
if (digest(manifestBytes) !== expectedManifestSha256) throw new Error('Atlas baseline manifest SHA-256 mismatch')
const manifest = JSON.parse(manifestBytes.toString('utf8'))
if (manifest.schema !== 1 || !Array.isArray(manifest.sources)) throw new Error('Invalid Atlas baseline manifest')
const sources = new Map()
for (const source of manifest.sources) {
  if (!/^[0-9a-f]{40}$/.test(source.origin_commit) || !/^[0-9a-f]{64}$/.test(source.sha256)
    || !Number.isSafeInteger(source.bytes) || source.bytes < 0
    || source.origin !== `${source.origin_commit}:${source.origin_path}`
    || source.fixture !== `blobs/${source.sha256}.txt`
    || source.original_specifier !== `${source.origin_commit.slice(0, 7)}:${source.origin_path}`) {
    throw new Error('Invalid Atlas baseline source identity')
  }
  for (const specifier of [source.original_specifier, source.origin]) {
    if (sources.has(specifier)) throw new Error('Duplicate Atlas baseline source identity')
    sources.set(specifier, source)
  }
}

export function readAtlasBaseline(specifier) {
  const source = sources.get(specifier)
  if (!source) throw new Error(`Unknown Atlas baseline source: ${String(specifier)}`)
  let bytes
  try { bytes = fs.readFileSync(new URL(source.fixture, directory)) }
  catch (error) { throw new Error(`Atlas baseline fixture unavailable: ${source.origin}`, { cause: error }) }
  if (bytes.length !== source.bytes || digest(bytes) !== source.sha256) {
    throw new Error(`Atlas baseline fixture SHA-256 mismatch: ${source.origin}`)
  }
  return bytes.toString('utf8')
}
