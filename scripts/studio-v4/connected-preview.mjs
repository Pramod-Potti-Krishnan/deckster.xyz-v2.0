// Normal-auth local UAT preview. Never mint cookies or reuse sample identities.
import { readFileSync, statSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { schemaTokens } from './schema-parity.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const runtime = new URL('../../.env.studio-v4-connected-runtime/', import.meta.url)
const require = createRequire(import.meta.url)
const localOrigin = 'http://localhost:3002'
const requiredOrigins = {
  NEXT_PUBLIC_WS_URL: 'wss://directorv40-uat.up.railway.app/ws',
  NEXT_PUBLIC_LAYOUT_SERVICE_URL: 'https://layout-builder-v75-uat.up.railway.app',
  LAYOUT_SERVICE_URL: 'https://layout-builder-v75-uat.up.railway.app',
  NEXT_PUBLIC_ELEMENTOR_URL: 'https://web-uat-19a9.up.railway.app',
  NEXT_PUBLIC_DOWNLOAD_SERVICE_URL: 'https://web-uat-1d12.up.railway.app',
  NEXT_PUBLIC_KNOWLEDGE_SERVICE_URL: 'https://researcher-v11-uat.up.railway.app',
  KNOWLEDGE_SERVICE_URL: 'https://researcher-v11-uat.up.railway.app',
  RESEARCHER_SERVICE_URL: 'https://researcher-v11-uat.up.railway.app',
  NEXT_PUBLIC_THEME_BUILDER_URL: 'https://themebuilderv10-uat.up.railway.app',
  DIRECTOR_API_URL: 'https://directorv40-uat.up.railway.app',
  COMPOSER_DIRECTOR_URL: 'https://directorv40-uat.up.railway.app',
  SLIDE_COMPOSER_DIRECTOR_URL: 'https://directorv40-uat.up.railway.app',
}
function privateRead(name) {
  const file = new URL(name, runtime)
  const stat = statSync(file)
  if (!stat.isFile() || (stat.mode & 0o077)) throw new Error(`Private runtime ${name} must be a restricted regular file`)
  return readFileSync(file, 'utf8')
}
function checkUrl(name, value, expected) {
  let url
  try { url = new URL(value) } catch { throw new Error(`Missing or invalid runtime origin: ${name}`) }
  if (url.username || url.password || url.search || url.hash || url.href.replace(/\/$/, '') !== expected) {
    throw new Error(`Runtime origin does not match the approved local/UAT target: ${name}`)
  }
}
try {
  const values = parseEnv(privateRead('.env.local'))
  const approval = JSON.parse(privateRead('approval.json'))
  for (const [name, expected] of Object.entries(requiredOrigins)) checkUrl(name, values[name], expected)
  checkUrl('NEXTAUTH_URL', values.NEXTAUTH_URL, localOrigin)
  checkUrl('NEXT_PUBLIC_APP_URL', values.NEXT_PUBLIC_APP_URL, localOrigin)
  if (values.NEXT_PUBLIC_ENABLE_DEV_LOGIN !== 'false') throw new Error('Connected preview requires dev login disabled')
  for (const name of Object.keys(values)) {
    if (name.startsWith('NEXT_PUBLIC_') && /SECRET|TOKEN|PASSWORD|SERVICE_ROLE/i.test(name) && name !== 'NEXT_PUBLIC_STUDIO_V4_TOKENS') {
      throw new Error('A server-only credential name is present in public runtime configuration')
    }
  }
  for (const name of ['NEXTAUTH_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'DATABASE_URL', 'DIRECTOR_WS_AUTH_SECRET', 'COMPOSER_FRONTDOOR_TOKEN', 'LAYOUT_PUBLISH_KEY']) {
    if (!values[name]?.trim()) throw new Error(`Required normal-auth server configuration is missing: ${name}`)
  }
  const client = require('../../.env.studio-v4-runtime/prisma-client')
  const modelNames = [...readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8').matchAll(/^model\s+(\w+)\s*\{/gm)].map(match => match[1]).sort()
  const generatedNames = client.Prisma.dmmf.datamodel.models.map(model => model.name).sort()
  if (JSON.stringify(modelNames) !== JSON.stringify(generatedNames)) throw new Error('Task-owned Prisma client does not match this frontend model inventory')
  const sourceSchema = readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8')
  const generatedSchema = readFileSync(new URL('../../.env.studio-v4-runtime/prisma-client/schema.prisma', import.meta.url), 'utf8')
  if (schemaTokens(sourceSchema) !== schemaTokens(generatedSchema)) throw new Error('Task-owned Prisma client schema fields/relations/defaults do not match the frontend')
  const approved = typeof approval.approvedAccount === 'string' && approval.approvedAccount.trim().length > 0
  const loginRoutingVerified = Array.isArray(approval.verifiedRoutingScopes) && approval.verifiedRoutingScopes.includes('frontend-login')
  console.log(JSON.stringify({ prepared: true, normalAuthConfigPresent: true, explicitUatOrigins: true, taskOwnedPrismaModels: modelNames.length, approvedAccountPresent: approved, loginRoutingVerified, serverStarted: false }))
  if (!process.argv.includes('--start')) process.exit(0)
  if (!approved || !loginRoutingVerified) throw new Error('Connected startup awaits the genuine approved account and recorded frontend-login routing check')
  // Only prepared private configuration plus basic OS values enter the child.
  const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG', 'SHELL'].filter(name => process.env[name]).map(name => [name, process.env[name]]))
  Object.assign(env, values, { STUDIO_V4_CONNECTED_LOCAL: 'true', NEXT_TELEMETRY_DISABLED: '1', NODE_ENV: 'development' })
  console.log(`LOCAL UAT — normal sign-in: ${localOrigin}/builder. Sample preview remains on 8792. Verify the real owner and every journey's downstream routes before writes.`)
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', 'localhost', '--port', '3002'], { cwd: root, env, stdio: 'inherit' })
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
  child.on('error', () => { console.error('Could not start the local UAT process'); process.exitCode = 1 })
  child.on('exit', code => process.exit(code ?? 0))
} catch (error) {
  // Config/parse errors can contain values; emit only our controlled messages.
  const message = error instanceof Error ? error.message : ''
  const safe = /^(Private runtime|Missing or invalid runtime origin|Runtime origin does not match|Connected preview requires|A server-only credential name|Required normal-auth server configuration|Task-owned Prisma client|Connected startup awaits)/.test(message)
  console.error(safe ? message : 'Private local UAT preparation check failed; inspect configuration without exposing values')
  process.exitCode = 1
}
