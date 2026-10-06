import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { SignJWT, jwtVerify } from 'jose'

const root = realpathSync(process.cwd())
const require = createRequire(path.join(root, 'package.json'))
const baseline = 'e7a59554c1e61b0b4bb67da4e3deda5026dbb70a'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const withinDependencies = entry => {
  const resolved = realpathSync(entry)
  assert.ok(resolved.startsWith(path.join(root, 'node_modules') + path.sep), resolved)
  return resolved
}
const prismaEntry = withinDependencies(require.resolve('@prisma/client'))
const client = require('@prisma/client')
const schema = readFileSync('prisma/schema.prisma', 'utf8')
assert.equal(schema, execFileSync('git', ['show', `${baseline}:prisma/schema.prisma`], { encoding: 'utf8' }))
const modelNames = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map(match => match[1])
assert.equal(modelNames.length, 19)
assert.deepEqual(Object.keys(client.Prisma.ModelName), modelNames)
assert.deepEqual(client.Prisma.dmmf.datamodel.models.map(model => model.name), modelNames)
assert.equal(client.Prisma.prismaVersion.client, '6.19.0')
const generatedEntry = withinDependencies(require.resolve('.prisma/client/default', {
  paths: [path.dirname(prismaEntry)],
}))
const generatedDir = path.dirname(generatedEntry)
const generatedSchema = readFileSync(path.join(generatedDir, 'schema.prisma'), 'utf8')
const stripComments = text => text.replace(/"(?:\\.|[^"\\])*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, token => token.startsWith('//') || token.startsWith('/*') ? '' : token)
const normalize = text => (text.match(/"(?:\\.|[^"\\])*"|[^\s"]+/g) ?? []).join(' ')
const modelBody = text => {
  const lines = text.split('\n').map(normalize).filter(Boolean)
  return [...lines.filter(line => !line.startsWith('@@')), ...lines.filter(line => line.startsWith('@@')).sort()].join(' ')
}
const models = text => [...stripComments(text).matchAll(/^model\s+(\w+)\s*\{([^}]+)\}/gm)].map(match => [match[1], modelBody(match[2])])
assert.deepEqual(models(generatedSchema), models(schema), 'Generated fields, defaults, relations and indexes must preserve the canonical schema')
const consumers = ['lib/prisma.ts', 'lib/stripe/stripe-utils.ts', 'app/api/webhooks/stripe/route.ts', 'app/api/account/route.ts', 'app/api/publish/[slug]/qa-sources/route.ts']
for (const consumer of consumers) {
  const fromConsumer = createRequire(path.join(root, consumer))
  assert.equal(fromConsumer('@prisma/client'), client)
  withinDependencies(fromConsumer.resolve('@prisma/client'))
}
const adapterEntry = withinDependencies(require.resolve('@auth/prisma-adapter'))
const fromAdapter = createRequire(adapterEntry)
assert.equal(fromAdapter('@prisma/client'), client)
const engines = Object.fromEntries(['libquery_engine-darwin-arm64.dylib.node', 'libquery_engine-rhel-openssl-3.0.x.so.node'].map(file => [file, hash(readFileSync(path.join(generatedDir, file)))]))
assert.equal(process.versions.node.split('.')[0], '22')
assert.equal(require('jose/package.json').version, '6.2.12')
withinDependencies(require.resolve('jose'))
assert.equal(JSON.parse(readFileSync(path.join(root, 'node_modules/stripe/package.json'), 'utf8')).version, '17.4.0')
withinDependencies(require.resolve('stripe'))

// Real jose/Web Crypto, local throwaway bytes only; no route/session or network operation.
const secret = crypto.getRandomValues(new Uint8Array(32))
const token = await new SignJWT({ purpose: 'isolated-runtime-witness' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1m').sign(secret)
assert.equal((await jwtVerify(token, secret)).payload.purpose, 'isolated-runtime-witness')
await assert.rejects(jwtVerify(token, crypto.getRandomValues(new Uint8Array(32))))

const protectedBilling = ['lib/stripe/stripe.ts', 'lib/stripe/stripe-utils.ts', 'app/api/webhooks/stripe/route.ts', 'app/api/stripe/create-checkout-session/route.ts', 'app/api/stripe/create-topup-session/route.ts', 'app/api/stripe/create-portal-session/route.ts', 'app/api/account/route.ts']
const billingHashes = Object.fromEntries(protectedBilling.map(file => {
  const bytes = readFileSync(file)
  assert.equal(hash(bytes), hash(execFileSync('git', ['show', `${baseline}:${file}`])))
  return [file, hash(bytes)]
}))
const evidence = {
  node: process.version, platform: process.platform, architecture: process.arch,
  rootNodeModulesIsRealDirectory: realpathSync('node_modules') === path.join(root, 'node_modules'),
  canonicalSchemaHash: hash(schema), models: modelNames, prismaVersion: client.Prisma.prismaVersion,
  prismaEntry, generatedEntry, engines, adapterEntry, consumers,
  jose: '6.2.12', webCryptoRoundTrip: true, wrongKeyRejected: true,
  stripe: '17.4.0', unchangedBillingSource: billingHashes,
  prismaConstructorsOrQueriesCalled: false, networkCalls: false,
}
assert.equal(evidence.rootNodeModulesIsRealDirectory, true)
writeFileSync('docs/studio-v4/dev-20261003/evidence/dependencies.json', JSON.stringify(evidence, null, 2) + '\n')
console.log('Node 22, isolated dependency realpaths, canonical 19-model Prisma/engines/adapter, real jose crypto and unchanged billing source checks passed; no database constructor/query, account or service call.')
