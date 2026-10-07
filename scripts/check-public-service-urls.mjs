#!/usr/bin/env node
/**
 * Build-time check: which service-URL variables does this environment leave to a
 * built-in PRODUCTION default? (J8.0, R-20261007-frontend-22; CLAUDE.md gotcha #2.)
 *
 * NEXT_PUBLIC_* values are inlined into the browser bundle at `next build`, so a
 * variable missing at build time keeps its production default in the shipped JS and
 * no runtime flag can change that. This script reports it before the build.
 *
 * It prints variable NAMES and a status only; it never prints a configured value.
 * It is NOT wired into the build (see docs/service-url-fallbacks.md for how to wire it).
 *
 *   node scripts/check-public-service-urls.mjs [--env uat|prod|local] [--no-server] [--json] [--list]
 *
 * Which environment is being checked:
 *   --env uat|prod        strict, explicit (use this: both Vercel projects build with VERCEL_ENV=production)
 *   --env local           report only, always exit 0
 *   no --env              from VERCEL_ENV: preview|production is strict; development or unset is report only
 *
 * Exit codes: 0 ok (or report-only), 1 a required variable is unset (or, for --env uat,
 * set to the production default host), 2 usage error.
 */

// Hosts are the built-in defaults the code ships with (no credentials). Kept in step with
// docs/service-url-fallbacks.md; a drift test lives in scripts/test-service-url-fail-closed.mjs.
const VARIABLES = [
  { name: 'NEXT_PUBLIC_WS_URL', scope: 'browser', required: true, defaultHost: 'directorv33-production.up.railway.app', feature: 'Director WebSocket (chat to build)' },
  { name: 'NEXT_PUBLIC_ELEMENTOR_URL', scope: 'browser', required: true, defaultHost: 'web-production-3b42.up.railway.app', feature: 'Text Labs / Elementor (element generation, diagram catalog, build guard)' },
  { name: 'NEXT_PUBLIC_LAYOUT_SERVICE_URL', scope: 'browser+server', required: true, defaultHost: 'web-production-f0d13.up.railway.app', feature: 'Layout Service (viewer, slides; server: narration, publish)' },
  { name: 'NEXT_PUBLIC_DOWNLOAD_SERVICE_URL', scope: 'browser+server', required: true, defaultHost: 'web-production-4908a.up.railway.app', feature: 'Downloads (PDF/PPTX; server: publish downloads)' },
  { name: 'NEXT_PUBLIC_KNOWLEDGE_SERVICE_URL', scope: 'browser+server', required: true, defaultHost: 'researcher-v1.up.railway.app', feature: 'Researcher / Knowledge (browser upload; server: /api/upload)' },
  { name: 'NEXT_PUBLIC_THEME_BUILDER_URL', scope: 'browser', required: true, defaultHost: 'theme-v1.up.railway.app', feature: 'Theme Builder (chat input)' },
  { name: 'NEXT_PUBLIC_APP_URL', scope: 'browser+server', required: true, defaultHost: 'deckster.xyz', feature: 'Own origin: publish links, sitemap, publish production-vs-UAT guard' },
  { name: 'NEXT_PUBLIC_API_URL', scope: 'browser', required: false, defaultHost: 'vibe-decker-agents-mvp10-production.up.railway.app', feature: 'Legacy API base (lib/config.ts; no consumer found, reported as a warning only)' },
  { name: 'DIRECTOR_API_URL', scope: 'server', required: true, defaultHost: 'directorv33-production.up.railway.app', feature: 'Director REST proxies (templates, themes, ingest, handoff, slide composer)', serverOnly: true },
  { name: 'KNOWLEDGE_SERVICE_URL', scope: 'server', required: true, defaultHost: 'researcher-v1.up.railway.app', feature: 'Knowledge Graph proxies, publish Q&A, /api/upload', serverOnly: true },
]

function parseArgs(argv) {
  const options = { env: null, server: true, json: false, list: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--env') options.env = argv[++i]
    else if (arg.startsWith('--env=')) options.env = arg.slice('--env='.length)
    else if (arg === '--no-server') options.server = false
    else if (arg === '--json') options.json = true
    else if (arg === '--list') options.list = true
    else return { error: `unknown argument: ${arg}` }
  }
  if (options.env !== null && !['uat', 'prod', 'local'].includes(options.env)) {
    return { error: `--env must be uat, prod or local (got ${JSON.stringify(options.env)})` }
  }
  return { options }
}

function hostOf(value) {
  try { return new URL(value.trim()).host.toLowerCase() } catch { return null }
}

export function checkVariables(env, { target, includeServer = true }) {
  const strict = target === 'uat' || target === 'prod' || target === 'vercel'
  return VARIABLES.filter(variable => includeServer || !variable.serverOnly).map(variable => {
    const raw = env[variable.name]
    const set = typeof raw === 'string' && raw.trim() !== ''
    const onProductionDefault = set && hostOf(raw) === variable.defaultHost
    let status = 'set'
    if (!set) status = 'UNSET (production default would be used)'
    else if (onProductionDefault && target === 'uat') status = 'SET TO THE PRODUCTION DEFAULT HOST (wrong for uat)'
    const failing = strict && (!set || (onProductionDefault && target === 'uat'))
    return { name: variable.name, scope: variable.scope, feature: variable.feature, required: variable.required, set, status, failing: failing && variable.required, warning: failing && !variable.required }
  })
}

export function resolveTarget(options, env) {
  if (options.env) return options.env
  if (env.VERCEL_ENV === 'preview' || env.VERCEL_ENV === 'production') return 'vercel'
  return 'local'
}

function main() {
  const parsed = parseArgs(process.argv.slice(2))
  if (parsed.error) {
    console.error(`check-public-service-urls: ${parsed.error}`)
    process.exit(2)
  }
  const { options } = parsed
  if (options.list) {
    for (const variable of VARIABLES) console.log(`${variable.name}\t${variable.scope}\t${variable.defaultHost}\t${variable.feature}`)
    return
  }
  const target = resolveTarget(options, process.env)
  const rows = checkVariables(process.env, { target, includeServer: options.server })
  const failing = rows.filter(row => row.failing)
  const warnings = rows.filter(row => row.warning)
  const strict = target !== 'local'

  if (options.json) {
    console.log(JSON.stringify({ target, strict, ok: failing.length === 0, variables: rows.map(({ name, scope, status, failing: f, warning }) => ({ name, scope, status, failing: f, warning })) }, null, 2))
  } else {
    console.log(`service-url check: target=${target}${strict ? ' (strict)' : ' (report only)'}`)
    for (const row of rows) console.log(`  ${row.failing ? 'FAIL' : row.warning ? 'warn' : ' ok '}  ${row.name.padEnd(36)} ${row.scope.padEnd(15)} ${row.status}`)
    if (failing.length) console.log(`\n${failing.length} required variable(s) would fall back to a production host: ${failing.map(row => row.name).join(', ')}`)
    else if (warnings.length) console.log(`\nno required variable is missing; ${warnings.length} advisory warning(s): ${warnings.map(row => row.name).join(', ')}`)
    else console.log('\nevery checked variable is explicitly set')
  }
  process.exit(failing.length && strict ? 1 : 0)
}

import { fileURLToPath } from 'node:url'
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
