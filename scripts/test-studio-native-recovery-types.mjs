import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import ts from 'typescript'

const root = path.resolve(new URL('../', import.meta.url).pathname)
const configPath = path.join(root, 'tsconfig.json')
const config = ts.readConfigFile(configPath, ts.sys.readFile)
assert.equal(config.error, undefined)
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
assert.equal(parsed.errors.length, 0)
const roots = ['components/builder/chat-input.tsx', 'hooks/use-theme-profiles.ts', 'components/template-save-dialog.tsx',
  'lib/template-retry-acknowledgement.ts', 'hooks/use-templates.ts', 'next-env.d.ts', 'types/next-auth.d.ts']
const program = ts.createProgram(roots.map(file => path.join(root, file)), {
  ...parsed.options, noEmit: true, incremental: false,
})
const diagnostics = ts.getPreEmitDiagnostics(program).map(d => ({
  file: d.file ? path.relative(root, d.file.fileName) : null,
  code: d.code, message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
}))
const hashes = Object.fromEntries(roots.map(file => [file,
  crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]))
const result = { capturedAt: new Date().toISOString(), typescript: ts.version,
  scope: 'Actual native theme/Save recovery leaves and full imported source/type graph under normal tsconfig; no emit, alias, suppression, service or whole-app pass.',
  sourceHashes: hashes, diagnostics }
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(result, null, 2) + '\n')
assert.deepEqual(diagnostics, [])
console.log('PASS native theme/Save recovery actual imported type graph: zero diagnostics; whole-app compiler remains a separate known failed gate.')
