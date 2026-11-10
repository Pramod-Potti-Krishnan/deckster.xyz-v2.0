// Offline config/bundling check only. No env file, auth, DB or service request.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { schemaTokens } from './studio-v4/schema-parity.mjs'

const require = createRequire(import.meta.url)
const configUrl = new URL('../next.config.mjs', import.meta.url)
const previousFlag = process.env.STUDIO_V4_CONNECTED_LOCAL
delete process.env.STUDIO_V4_CONNECTED_LOCAL
const normal = (await import(`${configUrl.href}?offline=normal`)).default
process.env.STUDIO_V4_CONNECTED_LOCAL = 'true'
const local = (await import(`${configUrl.href}?offline=connected`)).default
if (previousFlag === undefined) delete process.env.STUDIO_V4_CONNECTED_LOCAL
else process.env.STUDIO_V4_CONNECTED_LOCAL = previousFlag

assert.equal(normal.distDir, '.next')
assert.equal(normal.webpack, undefined)
assert.equal(local.distDir, '.env.studio-v4-connected-runtime/next')
const { distDir: localDir, webpack: localWebpack, headers: localHeaders, redirects: localRedirects, ...localRest } = local
const { distDir: normalDir, headers: normalHeaders, redirects: normalRedirects, ...normalRest } = normal
assert.deepEqual(localRest, normalRest, 'Every normal Next option remains unchanged')
assert.equal(localHeaders.toString(), normalHeaders.toString())
assert.equal(localRedirects.toString(), normalRedirects.toString())
assert.deepEqual(await localHeaders(), await normalHeaders())
assert.deepEqual(await localRedirects(), await normalRedirects())
const unchangedExternal = (_context, callback) => callback()
for (const context of [{ isServer: false }, { isServer: true, nextRuntime: 'edge' }]) {
  const config = { externals: [unchangedExternal] }
  assert.equal(localWebpack(config, context), config)
  assert.deepEqual(config.externals, [unchangedExternal], 'Client and edge resolution are unchanged')
}
const config = localWebpack({ externals: [unchangedExternal] }, { isServer: true, nextRuntime: 'nodejs' })
assert.equal(config.externals[1], unchangedExternal, 'Native external chain is preserved')
let external
config.externals[0]({ request: '@prisma/client' }, (error, result) => { assert.equal(error, null); external = result })
const clientPath = fileURLToPath(new URL('../.env.studio-v4-runtime/prisma-client/index.js', import.meta.url))
assert.equal(external, `commonjs ${clientPath}`)
let passThrough = false
config.externals[0]({ request: 'next-auth' }, (...args) => { assert.equal(args.length, 0); passThrough = true })
assert.equal(passThrough, true, 'Other dependencies use the existing chain')

// Compile and execute a tiny probe through the actual external callback. It
// reads generated model metadata; it never constructs/connects PrismaClient.
const webpackModule = require('next/dist/compiled/webpack/webpack')
webpackModule.init()
const webpack = webpackModule.webpack
const probeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-v4-prisma-probe-'))
fs.chmodSync(probeDir, 0o700)
try {
  const entry = path.join(probeDir, 'entry.cjs')
  fs.writeFileSync(entry, 'const { Prisma } = require("@prisma/client"); module.exports = Prisma.dmmf.datamodel.models.map(model => model.name).sort();\n')
  await new Promise((resolve, reject) => {
    const compiler = webpack({ mode: 'development', target: 'node', devtool: false, entry,
      output: { path: probeDir, filename: 'probe.cjs', library: { type: 'commonjs2' } },
      externals: config.externals, optimization: { minimize: false },
    })
    compiler.run((error, stats) => compiler.close(closeError => {
      if (error || closeError) return reject(error || closeError)
      if (stats.hasErrors()) return reject(new Error(stats.toString({ all: false, errors: true })))
      resolve()
    }))
  })
  const actual = require(path.join(probeDir, 'probe.cjs'))
  const schema = fs.readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8')
  const expected = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map(match => match[1]).sort()
  assert.equal(expected.length, 19)
  assert.deepEqual(actual, expected, 'Compiled server probe uses the exact task-owned model inventory')
  const generatedSchema = fs.readFileSync(new URL('../.env.studio-v4-runtime/prisma-client/schema.prisma', import.meta.url), 'utf8')
  assert.ok(schemaTokens(generatedSchema) === schemaTokens(schema), 'Generated schema matches fields/relations/defaults; only client configuration, formatting and model-attribute order differ')
  const specimen = 'model A {\n id String @id\n label String @default("two  spaces")\n @@map("native_a")\n @@index([label])\n}\nmodel B {\n id String @id\n @@map("native_b")\n}\n'
  assert.equal(schemaTokens(specimen), schemaTokens(specimen.replace(' @@map("native_a")\n @@index([label])', ' @@index([label])\n @@map("native_a")')))
  for (const changed of [specimen.replace('two  spaces', 'two spaces'), specimen.replace('label String', 'label String?'), specimen.replace('native_a', 'wrong_table'), specimen.replace('@@index([label])', '@@index([id])')]) {
    assert.notEqual(schemaTokens(changed), schemaTokens(specimen), 'Quoted defaults, fields, maps and indexes must stay exact')
  }
} finally {
  fs.rmSync(probeDir, { recursive: true, force: true })
}
console.log('Connected local runtime: default/cache isolation, unchanged client/edge/dependency resolution and actual 19-model server bundling pass offline. No account, DB or service operation.')
