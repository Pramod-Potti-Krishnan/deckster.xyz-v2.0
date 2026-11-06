// Invoke only under heavy.sh and the frontend repository suite lock.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
const candidate = '/Users/pk1980/Software/Deckster/.worktrees/element3-j3-shape-typed-fe-20261008'
const baseline = '/private/tmp/element3-j3-shape-fe-native-base-20261008'
const proof = '/private/tmp/element3-j3-shape-fe-native-proof-20261008'
fs.mkdirSync(proof, { recursive: true })
fs.writeFileSync(path.join(proof,'runner.pid'),String(process.pid)+'\n')
fs.writeFileSync(path.join(proof,'started.json'),JSON.stringify({pid:process.pid,at:new Date().toISOString()}))
const results = []
for (const [label, root] of [['baseline', baseline], ['candidate', candidate]]) {
  const ownTmp = fs.mkdtempSync(path.join(proof, `${label}-suite-tmp-`))
  const env = { ...process.env, TMPDIR: ownTmp }
  delete env.NEXT_PUBLIC_SHAPE_TYPED_FAILURE_RECOVERY_ENABLED
  for (const key of Object.keys(env)) if (/KEY|TOKEN|SECRET|CREDENTIAL|PASSWORD/i.test(key)) delete env[key]
  env.NODE_OPTIONS=`--require ${path.join(proof,'deny-network.cjs')}`
  delete env.NEXT_PUBLIC_TEXTBOX_PLANNED_TIMEOUT_ENABLED
  delete env.NEXT_PUBLIC_ELEMENT_THEME_PREFLIGHT_RECOVERY_ENABLED
  const tests = fs.readdirSync(path.join(root, 'scripts')).filter(x => /^test-.*\.mjs$/.test(x)).sort()
  const entries = []
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  const sourceHashes = Object.fromEntries(['hooks/use-textlabs-generation.ts','lib/shape-generation-failure.ts','lib/textlabs-client.ts','scripts/test-shape-typed-failure.mjs']
    .filter(file => fs.existsSync(path.join(root, file)))
    .map(file => [file, createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]))
  try {
    for (const script of tests) {
      const run = spawnSync(process.execPath, [path.join(root, 'scripts', script)], { cwd: root, env, encoding: 'utf8', timeout: 60_000 })
      fs.writeFileSync(path.join(proof, `${label}-${script}.log`), `${run.stdout || ''}${run.stderr || ''}`)
      const message = `${run.stdout || ''}${run.stderr || ''}`.split('\n').find(x => /AssertionError|Error:|error TS/.test(x)) || null
      entries.push({ script, exit: run.status, signal: run.signal, message })
    }
    const typed = spawnSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--incremental', 'false', '--pretty', 'false'], { cwd: root, env, encoding: 'utf8', timeout: 120_000 })
    fs.writeFileSync(path.join(proof, `${label}-tsc.log`), `${typed.stdout || ''}${typed.stderr || ''}`)
    const diagnostics = `${typed.stdout || ''}${typed.stderr || ''}`.split('\n').filter(x => /error TS\d+/.test(x))
    results.push({ label, source_commit: sourceCommit, source_hashes: sourceHashes, native: entries, native_passed: entries.filter(x => x.exit === 0).length, native_total: entries.length,
      typecheck: { exit: typed.status, signal: typed.signal, diagnostic_count: diagnostics.length, diagnostics } })
    console.log(`${label}: ${entries.filter(x => x.exit === 0).length}/${entries.length} native files passed; tsc exit=${typed.status}, diagnostics=${diagnostics.length}`)
  } finally { fs.rmSync(ownTmp, { recursive: true, force: true }) }
}
fs.writeFileSync(path.join(proof,'native-pair-results.json'),JSON.stringify(results,null,2)+'\n')
const [before,after]=results
const normalize=d=>d.replace(/\(\d+,\d+\)/,'')
const b=before.typecheck.diagnostics.map(normalize).sort(),a=after.typecheck.diagnostics.map(normalize).sort()
const oldStatus=new Map(before.native.map(x=>[x.script,x.exit]))
const changes=after.native.filter(x=>oldStatus.has(x.script)&&oldStatus.get(x.script)!==x.exit)
fs.writeFileSync(path.join(proof,'comparison.json'),JSON.stringify({base:before.source_commit,candidate:after.source_commit,native_status_changes:changes,new_native_files:after.native.filter(x=>!oldStatus.has(x.script)),typecheck_multiset_equal:JSON.stringify(a)===JSON.stringify(b),base_diagnostic_count:b.length,candidate_diagnostic_count:a.length},null,2)+'\n')
console.log(JSON.stringify({existing_native_status_changes:changes.length,typecheck_multiset_equal:JSON.stringify(a)===JSON.stringify(b),finished:new Date().toISOString()}))
