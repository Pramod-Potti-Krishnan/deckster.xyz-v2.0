// Invoke only under heavy.sh and the frontend repository suite lock.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
const candidate = path.resolve(new URL('../..', import.meta.url).pathname)
const baseline = '/private/tmp/element3-j3-fe-native-base-20261008'
const proof = '/private/tmp/element3-j3-fe-native-proof-20261008'
fs.mkdirSync(proof, { recursive: true })
const results = []
for (const [label, root] of [['baseline', baseline], ['candidate', candidate]]) {
  const ownTmp = fs.mkdtempSync(path.join(proof, `${label}-suite-tmp-`))
  const env = { ...process.env, TMPDIR: ownTmp }
  delete env.NEXT_PUBLIC_TEXTBOX_PLANNED_TIMEOUT_ENABLED
  delete env.NEXT_PUBLIC_ELEMENT_THEME_PREFLIGHT_RECOVERY_ENABLED
  const tests = fs.readdirSync(path.join(root, 'scripts')).filter(x => /^test-.*\.mjs$/.test(x)).sort()
  const entries = []
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
    results.push({ label, native: entries, native_passed: entries.filter(x => x.exit === 0).length, native_total: entries.length,
      typecheck: { exit: typed.status, signal: typed.signal, diagnostic_count: diagnostics.length, diagnostics } })
    console.log(`${label}: ${entries.filter(x => x.exit === 0).length}/${entries.length} native files passed; tsc exit=${typed.status}, diagnostics=${diagnostics.length}`)
  } finally { fs.rmSync(ownTmp, { recursive: true, force: true }) }
}
fs.writeFileSync(path.join(candidate, 'docs/j3-text-p0/native-pair-results.json'), JSON.stringify(results, null, 2) + '\n')
