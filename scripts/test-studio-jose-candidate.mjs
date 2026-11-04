// Isolated direct-dependency proposal. Compiles actual source; never executes
// the route, constructs SignJWT, invokes signing, or changes the live tree.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
const root = process.cwd();
const scratch = path.join(root, '.env.studio-v4-runtime/jose-candidate-20261003');
const frozen = path.join(root, '.env.studio-v4-runtime/isolated-dependencies');
const evidence = path.join(root, 'docs/studio-v4/overnight-fidelity-20261002/evidence/jose-dependency-candidate');
const hash = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const write = (n, v) => fs.writeFileSync(path.join(evidence, n), typeof v === 'string' ? v : JSON.stringify(v, null, 2) + '\n');
const protectedFiles = ['package.json', 'pnpm-lock.yaml', '.nvmrc', 'next.config.mjs', 'app/api/dev/mock-token/route.ts', '.env.studio-v4-runtime/isolated-dependencies/package.json', '.env.studio-v4-runtime/isolated-dependencies/pnpm-lock.yaml',
  '.env.studio-v4-runtime/isolated-dependencies/node_modules/.pnpm/jose@6.1.2/node_modules/jose/package.json',
  '.env.studio-v4-runtime/isolated-dependencies/node_modules/.pnpm/jose@4.15.9/node_modules/jose/package.json'];
const guards = () => Object.fromEntries(protectedFiles.map(f => [f, hash(path.join(root, f))]));
const before = guards(), rootSymlink = fs.readlinkSync(path.join(root, 'node_modules'));
assert.equal(execFileSync('git', ['check-ignore', path.join(scratch, 'package.json')], { encoding: 'utf8' }).trim(), path.join(scratch, 'package.json'));
const metadata = JSON.parse(fs.readFileSync(path.join(evidence, 'registry-6.2.12.json')));
const latest = JSON.parse(fs.readFileSync(path.join(evidence, 'registry-latest.json')));
assert.equal(latest.version, '6.2.12'); assert.equal(metadata.version, latest.version);
const archive = path.join(scratch, 'jose-6.2.12.tgz');
assert.equal('sha512-' + crypto.createHash('sha512').update(fs.readFileSync(archive)).digest('base64'), metadata.dist.integrity);
fs.mkdirSync(path.join(scratch, 'vendor'), { recursive: true });
execFileSync('tar', ['-xzf', archive, '-C', path.join(scratch, 'vendor')]);
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
assert.equal(manifest.dependencies.jose, undefined);
manifest.dependencies = Object.fromEntries(Object.entries(manifest.dependencies).flatMap(([key, value]) => key === 'jsonwebtoken' ? [['jose', '6.2.12'], [key, value]] : [[key, value]]));
const candidateManifest = JSON.stringify(manifest, null, 2) + '\n';
fs.writeFileSync(path.join(scratch, 'package.json'), candidateManifest);
let lock = fs.readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8');
assert.ok(!lock.includes('  jose@6.2.12:'));
lock = lock.replace('      jsonwebtoken:\n', '      jose:\n        specifier: 6.2.12\n        version: 6.2.12\n      jsonwebtoken:\n');
lock = lock.replace('  js-tokens@4.0.0:\n', `  jose@6.2.12:\n    resolution: {integrity: ${metadata.dist.integrity}}\n\n  js-tokens@4.0.0:\n`);
lock = lock.replace('  jose@6.1.2: {}\n', '  jose@6.1.2: {}\n\n  jose@6.2.12: {}\n');
fs.writeFileSync(path.join(scratch, 'pnpm-lock.yaml'), lock);
// The new tree owns only jose. Existing genuine dependencies are linked read-only;
// no package-manager install, lock regeneration or lifecycle is run.
fs.mkdirSync(path.join(scratch, 'node_modules'), { recursive: true });
for (const entry of fs.readdirSync(path.join(frozen, 'node_modules'))) {
  if (entry.startsWith('.')) continue;
  const target = path.join(scratch, 'node_modules', entry);
  if (!fs.existsSync(target)) fs.symlinkSync(path.join(frozen, 'node_modules', entry), target);
}
const joseLink = path.join(scratch, 'node_modules/jose');
if (!fs.existsSync(joseLink)) fs.symlinkSync(path.join(scratch, 'vendor/package'), joseLink);
const require = createRequire(path.join(scratch, 'package.json'));
const runtimeEntry = fs.realpathSync(require.resolve('jose'));
assert.ok(runtimeEntry.startsWith(path.join(scratch, 'vendor/package') + path.sep));
const module = await import(pathToFileURL(runtimeEntry).href);
assert.equal(typeof module.SignJWT, 'function');
for (const method of ['setProtectedHeader', 'setExpirationTime', 'setIssuedAt', 'sign']) assert.equal(typeof module.SignJWT.prototype[method], 'function');
const ts = require('typescript');
const source = fs.readFileSync(path.join(root, 'app/api/dev/mock-token/route.ts'), 'utf8');
const virtual = path.join(scratch, 'app/api/dev/mock-token/route.ts');
const parsed = ts.parseJsonConfigFileContent(ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile).config, ts.sys, root);
const options = { ...parsed.options, baseUrl: scratch, noEmit: true, incremental: false };
const host = ts.createCompilerHost(options), baseRead = host.readFile, baseExists = host.fileExists, baseDir = host.directoryExists;
host.readFile = f => f === virtual ? source : baseRead(f);
host.fileExists = f => f === virtual || baseExists(f);
host.directoryExists = f => virtual.startsWith(path.resolve(f) + path.sep) || baseDir(f);
host.getSourceFile = (f, language) => { const s = host.readFile(f); return s === undefined ? undefined : ts.createSourceFile(f, s, language, true); };
const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([virtual], options, host)).map(d => ({ code: d.code, message: ts.flattenDiagnosticMessageText(d.messageText, '\n') }));
assert.deepEqual(diagnostics, []);
const typeResolution = ts.resolveModuleName('jose', virtual, options, host).resolvedModule;
assert.ok(fs.realpathSync(typeResolution.resolvedFileName).startsWith(path.join(scratch, 'vendor/package') + path.sep));
// Genuine installed Next webpack plus its actual app-layer external policy.
// TypeScript erasure is focused ESNext emit of the byte-unchanged route. This
// is not a full Next loader/config build; next/server is externalized to keep
// the witness bounded to the route→jose chain. The bundle is never loaded.
const emitted = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, fileName: virtual }).outputText;
assert.ok(emitted.includes("import { SignJWT } from 'jose'"));
const entry = path.join(scratch, 'route.mjs'); fs.writeFileSync(entry, emitted);
const nextWebpack = require('next/dist/compiled/webpack/webpack'); nextWebpack.init();
const { makeExternalHandler } = require('next/dist/build/handle-externals');
const { WEBPACK_LAYERS } = require('next/dist/lib/constants');
const { defaultConfig } = require('next/dist/server/config-shared');
const optOutPackages = require('next/dist/lib/server-external-packages.json');
assert.ok(!optOutPackages.includes('jose'));
const regex = new RegExp(`[/\\\\]node_modules[/\\\\](${optOutPackages.map(p => p.replace(/\//g, '[/\\\\]')).join('|')})[/\\\\]`);
const handle = makeExternalHandler({ config: defaultConfig, optOutBundlingPackageRegex: regex, transpiledPackages: [], dir: scratch });
const decisions = [];
const compiler = nextWebpack.webpack({ mode: 'production', target: 'node18', context: scratch,
  entry: { route: { import: entry, layer: WEBPACK_LAYERS.reactServerComponents } },
  experiments: { layers: true }, cache: false, devtool: false,
  output: { path: path.join(scratch, 'bundle'), filename: 'route.cjs', library: { type: 'commonjs2' } },
  optimization: { minimize: false },
  externals: [async ({ context, request, dependencyType, contextInfo, getResolve }) => {
    if (request === 'next/server') return 'commonjs next/server';
    const result = await handle(context, request, dependencyType, contextInfo.issuerLayer,
      resolveOptions => (resolveContext, resolveRequest) => new Promise((resolve, reject) => {
        getResolve(resolveOptions)(resolveContext, resolveRequest, (error, result, data) => {
          if (error) reject(error); else resolve([result, !!(data?.descriptionFileData?.type === 'module' || /\.mjs$/.test(result))]);
        });
      }));
    if (request === 'jose') decisions.push({ request, dependencyType, layer: contextInfo.issuerLayer, result: result ?? 'bundled' });
    return result;
  }],
});
const stats = await new Promise((resolve, reject) => compiler.run((error, stats) => error ? reject(error) : resolve(stats)));
await new Promise((resolve, reject) => compiler.close(error => error ? reject(error) : resolve()));
const json = stats.toJson({ all: false, errors: true, warnings: true, modules: true, nestedModules: true });
write('webpack-stats.json', json); assert.equal(stats.hasErrors(), false, JSON.stringify(json.errors));
assert.ok(decisions.some(d => d.request === 'jose' && d.result === 'bundled' && d.layer === 'rsc'));
const bundle = fs.readFileSync(path.join(scratch, 'bundle/route.cjs'), 'utf8');
assert.ok(!/require\(["']jose["']\)/.test(bundle));
assert.ok(bundle.includes('crypto.subtle'));
// Existing transitive consumers remain pinned to their genuine old versions.
const frozenRequire = createRequire(path.join(frozen, 'package.json'));
const transitive = {};
for (const consumer of ['next-auth', '@auth/core']) {
  const from = consumer === '@auth/core' ? createRequire(frozenRequire.resolve('@auth/prisma-adapter')) : frozenRequire;
  const r = createRequire(from.resolve(consumer));
  transitive[consumer] = { entry: fs.realpathSync(r.resolve('jose')), version: r('jose/package.json').version };
}
assert.equal(transitive['next-auth'].version, '4.15.9'); assert.equal(transitive['@auth/core'].version, '6.1.2');
// Exercise only the genuine Next missing-global polyfill in a child process.
// Node24 with its global deleted is a branch witness, not a Node18 execution.
const polyfill = require.resolve('next/dist/server/node-polyfill-crypto');
const polyfillSource = `const assert = require('node:assert/strict'); delete globalThis.crypto; assert.equal(typeof globalThis.crypto, 'undefined'); require(${JSON.stringify(polyfill)}); assert.equal(globalThis.crypto, require('node:crypto').webcrypto); assert.equal(typeof globalThis.crypto.subtle.importKey, 'function'); assert.equal(typeof globalThis.crypto.subtle.sign, 'function'); console.log(JSON.stringify({node:process.version, missingGlobalRestored:true, subtleMethodsPresent:true, cryptoOperationInvoked:false}));`;
const polyfillResult = JSON.parse(execFileSync(process.execPath, ['-e', polyfillSource], { encoding: 'utf8', env: { PATH: process.env.PATH } }));
write('next-polyfill-witness.json', { ...polyfillResult, polyfill, polyfillHash: hash(polyfill),
  bootstrapFiles: Object.fromEntries(['next/dist/server/next.js', 'next/dist/server/next-server.js', 'next/dist/build/entries.js', 'next/dist/build/handle-externals.js', 'next/dist/build/webpack-config.js'].map(f => [f, hash(require.resolve(f))])),
  limitation: 'Genuine installed Next polyfill missing-global branch under Node24 only. Upstream jose v6 explicitly drops supported Node18 despite possible polyfilled behavior.' });
const candidateLockHash = hash(path.join(scratch, 'pnpm-lock.yaml'));
const pnpmVersion = execFileSync('pnpm', ['--version'], { encoding: 'utf8' }).trim();
assert.equal(pnpmVersion, '9.12.3');
const validation = spawnSync('pnpm', ['install', '--lockfile-only', '--frozen-lockfile', '--offline', '--ignore-scripts', '--ignore-workspace'], { cwd: scratch, encoding: 'utf8', env: { ...process.env, CI: 'true' } });
write('lock-validation.json', { pnpmVersion, args: ['install', '--lockfile-only', '--frozen-lockfile', '--offline', '--ignore-scripts', '--ignore-workspace'], status: validation.status, stdout: validation.stdout, lockHashBefore: candidateLockHash, lockHashAfter: hash(path.join(scratch, 'pnpm-lock.yaml')) });
assert.equal(validation.status, 0); assert.equal(hash(path.join(scratch, 'pnpm-lock.yaml')), candidateLockHash);
for (const name of ['package.json', 'pnpm-lock.yaml']) {
  const diff = spawnSync('git', ['diff', '--no-index', '--', path.join(root, name), path.join(scratch, name)], { encoding: 'utf8' });
  assert.equal(diff.status, 1);
  const normalized = diff.stdout.replace(/^diff --git .*$/m, `diff --git a/${name} b/${name}`).replace(/^--- .*$/m, `--- a/${name}`).replace(/^\+\+\+ .*$/m, `+++ b/${name}`);
  write(name + '.patch', normalized);
}
assert.deepEqual(guards(), before); assert.equal(fs.readlinkSync(path.join(root, 'node_modules')), rootSymlink);
write('candidate-witness.json', { capturedAt: new Date().toISOString(), head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  packageVersion: metadata.version, tarballIntegrityVerified: true, tarballSha256: hash(archive), runtimeEntry,
  nextVersion: require('next/package.json').version, webpackVersion: nextWebpack.webpack.version,
  nodeVersion: process.version, nodeTarget: 'node18', globalWebCryptoPresent: typeof globalThis.crypto?.subtle === 'object',
  directTypeEntry: fs.realpathSync(typeResolution.resolvedFileName), actualRouteDiagnostics: diagnostics,
  actualRouteHash: hash(path.join(root, 'app/api/dev/mock-token/route.ts')), emittedHash: hash(entry), bundleHash: hash(path.join(scratch, 'bundle/route.cjs')),
  bundlingDecisions: decisions, rawJoseRequireInBundle: false, cryptoSubtleRemainsRequired: true, transitive,
  protectedHashes: before, sharedAndFrozenFilesUnchanged: true, rootSymlink,
  routeExecuted: false, signerConstructed: false, tokenSigned: false, handlersInvoked: false,
  limitations: 'Focused genuine Next webpack/external-policy compilation, TS ESNext source erasure, unrelated next/server externalized. Not a full Next SWC/app-route-loader build, deployed Node verification or token behavior test.' });
console.log('PASS: current patch integrity, actual route types/import, Next app-layer bundling, genuine runtime exports and unchanged protected trees. No route/token executed.');
