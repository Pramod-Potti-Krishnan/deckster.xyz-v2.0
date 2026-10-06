// Bounded private-tree resolution/generation witnesses. No app handler, auth,
// client constructor, token signer, adapter callback or service is invoked.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const root = process.cwd();
const privateRoot = path.join(root, '.env.studio-v4-runtime/isolated-dependencies');
const evidence = path.join(root, 'docs/studio-v4/overnight-fidelity-20261002/evidence/build-compatibility-repair');
fs.mkdirSync(evidence, { recursive: true });
const read = f => fs.readFileSync(path.resolve(root, f), 'utf8');
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const fileHash = f => hash(fs.readFileSync(f));
const real = f => fs.realpathSync(f);
const within = (file, dir) => file === dir || file.startsWith(dir + path.sep);
const save = (name, data) => fs.writeFileSync(path.join(evidence, name), JSON.stringify(data, null, 2) + '\n');
const privateRequire = createRequire(path.join(privateRoot, 'package.json'));
const sharedRequire = createRequire(path.join(root, 'package.json'));
const ts = sharedRequire('typescript');
const sourceFiles = ['lib/prisma.ts', 'lib/wallet.ts', 'lib/publish/serialize.ts', 'app/api/publish/route.ts', 'app/api/publish/[slug]/questions/[id]/promote/route.ts'];
const sharedClientPackage = real(sharedRequire.resolve('@prisma/client/package.json'));
const sharedGenerated = path.resolve(path.dirname(sharedClientPackage), '../../.prisma/client');
const privateClientPackage = real(privateRequire.resolve('@prisma/client/package.json'));
const privateGenerated = path.resolve(path.dirname(privateClientPackage), '../../.prisma/client');
const guardedFiles = [
  'package.json', 'pnpm-lock.yaml', 'prisma/schema.prisma', 'tsconfig.json',
  ...sourceFiles, 'lib/auth-options.ts',
  ...['index.js', 'index.d.ts', 'schema.prisma', 'package.json'].map(f => path.join(sharedGenerated, f)),
].map(f => path.resolve(root, f));
const protectedHashes = () => Object.fromEntries(guardedFiles.map(f => [path.relative(root, f), fileHash(f)]));
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const pnpmVersion = execFileSync('pnpm', ['--version'], { cwd: privateRoot, encoding: 'utf8' }).trim();
assert.equal(pnpmVersion, '9.12.3');
assert.equal(fs.lstatSync(path.join(root, 'node_modules')).isSymbolicLink(), true);
assert.equal(fs.lstatSync(path.join(privateRoot, 'node_modules')).isSymbolicLink(), false);
assert.notEqual(real(path.join(root, 'node_modules')), real(path.join(privateRoot, 'node_modules')));
assert.ok(within(privateClientPackage, privateRoot));
assert.ok(within(privateGenerated, privateRoot));
const prismaCli = real(privateRequire.resolve('prisma/build/index.js'));
assert.ok(within(prismaCli, privateRoot));
const ignored = spawnSync('git', ['check-ignore', path.join(privateRoot, 'package.json')], { cwd: root, encoding: 'utf8' });
assert.equal(ignored.status, 0);
for (const f of ['package.json', 'pnpm-lock.yaml', 'prisma/schema.prisma']) {
  assert.equal(fileHash(path.join(root, f)), fileHash(path.join(privateRoot, f)), `${f} copied unchanged`);
}
assert.equal(fs.existsSync(path.join(root, 'contexts/presentation-context.tsx')), false);
assert.equal(fs.existsSync(path.join(privateRoot, '.env')), false);
assert.deepEqual(fs.readdirSync(privateRoot).filter(f => f !== '.engine-cache').sort(), ['node_modules', 'package.json', 'pnpm-lock.yaml', 'prisma']);
const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
// Module resolution uses the normal private package layout. There is no
// @prisma/client alias, synthetic declaration or package implementation.
const privateOptions = { ...parsed.options, baseUrl: privateRoot, incremental: false, noEmit: true };
assert.equal(privateOptions.paths?.['@prisma/client'], undefined);
const resolutions = sourceFiles.map(f => {
  const actualSource = read(f);
  const sf = ts.createSourceFile(f, actualSource, ts.ScriptTarget.Latest, true);
  const imports = sf.statements.filter(n => ts.isImportDeclaration(n) && n.moduleSpecifier.text === '@prisma/client');
  assert.equal(imports.length, 1, `actual ${f} has one direct import`);
  const containing = path.join(privateRoot, f);
  const runtimeEntry = real(createRequire(containing).resolve('@prisma/client'));
  const typed = ts.resolveModuleName('@prisma/client', containing, privateOptions, ts.sys).resolvedModule;
  assert.ok(typed, `actual ${f} import resolves in private layout`);
  const typeEntry = real(typed.resolvedFileName);
  assert.ok(within(runtimeEntry, privateRoot));
  assert.ok(within(typeEntry, privateRoot));
  assert.equal(runtimeEntry, real(privateRequire.resolve('@prisma/client')));
  return { source: f, sourceHash: hash(actualSource), isTypeOnly: imports[0].importClause.isTypeOnly, runtimeEntry, typeEntry };
});
const adapterEntry = real(privateRequire.resolve('@auth/prisma-adapter'));
assert.ok(within(adapterEntry, privateRoot));
const adapterRequire = createRequire(adapterEntry);
const adapterPeerEntry = real(adapterRequire.resolve('@prisma/client'));
assert.equal(adapterPeerEntry, resolutions[0].runtimeEntry);
const adapterTypePeer = ts.resolveModuleName('@prisma/client', path.join(path.dirname(adapterEntry), 'index.d.ts'), privateOptions, ts.sys).resolvedModule;
assert.equal(real(adapterTypePeer.resolvedFileName), resolutions[0].typeEntry);
const guards = {
  capturedAt: new Date().toISOString(), head, pnpmVersion, privateRoot,
  originalRootSymlink: fs.readlinkSync(path.join(root, 'node_modules')),
  privateClientPackage, privateGenerated, prismaCli, resolutions,
  adapter: { entry: adapterEntry, runtimePeerEntry: adapterPeerEntry, typePeerEntry: real(adapterTypePeer.resolvedFileName) },
  copiedFiles: Object.fromEntries(['package.json', 'pnpm-lock.yaml', 'prisma/schema.prisma'].map(f => [f, fileHash(path.join(privateRoot, f))])),
  protectedFileHashes: protectedHashes(),
  privateTreeIgnored: true, rootSymlinkSwitched: false,
};
if (process.argv.includes('--pre-generate')) {
  save('pre-generation-guards.json', guards);
  console.log('PASS: unchanged copied files, private realpaths, five imports and adapter peer checked before generation.');
  process.exit(0);
}
const before = JSON.parse(read(path.join(evidence, 'pre-generation-guards.json')));
assert.equal(guards.originalRootSymlink, before.originalRootSymlink);
assert.deepEqual(guards.protectedFileHashes, before.protectedFileHashes, 'all protected source/shared generated files unchanged');
const generatedSchema = read(path.join(privateGenerated, 'schema.prisma'));
const canonicalSchema = read('prisma/schema.prisma');
const stripComments = s => s.replace(/"(?:\\.|[^"\\])*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, t => t.startsWith('//') || t.startsWith('/*') ? '' : t);
const normalize = s => (s.match(/"(?:\\.|[^"\\])*"|[^\s"]+/g) ?? []).join(' ');
const normalizedBody = s => {
  const lines = s.split('\n').map(normalize).filter(Boolean);
  return [...lines.filter(l => !l.startsWith('@@')), ...lines.filter(l => l.startsWith('@@')).sort()].join(' ');
};
const modelBody = s => Object.fromEntries([...stripComments(s).matchAll(/model\s+(\w+)\s*\{([^}]+)\}/g)].map(m => [m[1], normalizedBody(m[2])]));
assert.deepEqual(modelBody(generatedSchema), modelBody(canonicalSchema));
const generatedCode = read(path.join(privateGenerated, 'index.js'));
const begin = generatedCode.indexOf('const config = {');
const end = generatedCode.indexOf('\n}', begin);
const generatedConfig = JSON.parse(generatedCode.slice(begin + 'const config = '.length, end + 2));
assert.equal(generatedConfig.clientVersion, '6.19.0');
assert.deepEqual(generatedConfig.generator.binaryTargets.map(t => t.value), ['darwin-arm64', 'rhel-openssl-3.0.x']);
assert.equal(generatedConfig.generator.sourceFilePath, path.join(privateRoot, 'prisma/schema.prisma'));
assert.ok(within(generatedConfig.generator.output.value, privateRoot));
assert.equal(generatedConfig.inlineSchema, generatedSchema);
for (const file of ['libquery_engine-darwin-arm64.dylib.node', 'libquery_engine-rhel-openssl-3.0.x.so.node']) assert.ok(fs.existsSync(path.join(privateGenerated, file)));

// Require the genuine generated export; never construct PrismaClient or invoke
// a model method/$connect. Module export loading alone does not use credentials.
const runtimeClient = privateRequire('@prisma/client');
assert.equal(typeof runtimeClient.PrismaClient, 'function');
assert.deepEqual(Object.keys(runtimeClient.Prisma.ModelName), Object.keys(modelBody(canonicalSchema)));
assert.deepEqual(runtimeClient.Prisma.dmmf.datamodel.models.map(m => m.name), Object.keys(modelBody(canonicalSchema)));
const clientExportsAcrossConsumers = sourceFiles.map(f => createRequire(path.join(privateRoot, f))('@prisma/client'));
assert.ok(clientExportsAcrossConsumers.every(c => c === runtimeClient));
assert.equal(adapterRequire('@prisma/client'), runtimeClient);
const adapterModule = await import(pathToFileURL(adapterEntry).href);
assert.equal(typeof adapterModule.PrismaAdapter, 'function');
// The adapter is a factory accepting the supplied client. It imports Prisma
// only for types; no adapter method/factory or account path is exercised.
const loadedPrismaModules = Object.keys(sharedRequire.cache).filter(f => /[/\\](?:\.prisma[/\\]client|@prisma[/\\]client)[/\\]/.test(f));
assert.ok(loadedPrismaModules.length > 0);
assert.ok(loadedPrismaModules.every(f => within(real(f), privateRoot)));
const joseRuntime = {};
for (const [version, consumer] of [['4.15.9', real(privateRequire.resolve('next-auth'))], ['6.1.2', real(adapterRequire.resolve('@auth/core'))]]) {
  const fromConsumer = createRequire(consumer);
  const entry = real(fromConsumer.resolve('jose'));
  assert.ok(within(entry, privateRoot));
  const cjsLoaded = fromConsumer('jose');
  const esmLoaded = await import(pathToFileURL(entry).href);
  assert.equal(typeof cjsLoaded.SignJWT, 'function');
  assert.equal(typeof esmLoaded.SignJWT, 'function');
  const methodNames = ['setProtectedHeader', 'setExpirationTime', 'setIssuedAt', 'sign'];
  for (const method of methodNames) assert.equal(typeof cjsLoaded.SignJWT.prototype[method], 'function');
  joseRuntime[version] = { actualNodeVersion: process.version, privateConsumer: consumer, publicEntry: entry,
    cjsExportLoads: true, esmExportLoads: true, inheritedChainMethodsPresent: methodNames,
    globalWebCryptoAvailable: typeof globalThis.crypto?.subtle === 'object', constructorInvoked: false, tokenSigned: false };
}
let directPrivateJose;
try { directPrivateJose = privateRequire.resolve('jose'); } catch (error) { directPrivateJose = error.code; }
assert.equal(directPrivateJose, 'MODULE_NOT_FOUND');
save('jose-runtime-proposal.json', { candidates: joseRuntime, directPrivateImport: directPrivateJose,
  manifestUnchanged: true, proposedDirectVersion: '6.1.2',
  repositoryRuntimeHint: read('.nvmrc').trim(), declaredNodeEngine: JSON.parse(read('package.json')).engines.node,
  policySource: 'https://github.com/panva/jose/security/policy', policyCheckedDate: '2026-10-03',
  policyFinding: 'Current maintainer policy lists only v6.x as supported with security updates.',
  deploymentGate: 'Actual deployed Node minor/module bundling is unverified. Installed v6.1.2 README allows CJS require(esm) on ^20.19.0 || ^22.12.0 || >=23.0.0. Actual local Node24.4.1 exports load; Node20 hint alone does not prove that minimum or deployed resolution. No dependency patch is applied.',
});

function checkVirtual(relative, source) {
  const file = path.join(privateRoot, relative);
  const host = ts.createCompilerHost(privateOptions);
  const baseRead = host.readFile, baseExists = host.fileExists, baseDir = host.directoryExists;
  host.readFile = f => f === file ? source : baseRead(f);
  host.fileExists = f => f === file || baseExists(f);
  host.directoryExists = f => file.startsWith(path.resolve(f) + path.sep) || baseDir(f);
  host.getSourceFile = (f, lang) => {
    const text = host.readFile(f);
    return text === undefined ? undefined : ts.createSourceFile(f, text, lang, true);
  };
  const p = ts.createProgram([file], privateOptions, host);
  return ts.getPreEmitDiagnostics(p).map(d => ({ code: d.code, file: d.file ? path.relative(privateRoot, d.file.fileName) : null, message: ts.flattenDiagnosticMessageText(d.messageText, '\n') }));
}
const witness = `import { PrismaAdapter } from '@auth/prisma-adapter';\nimport type { PrismaClient, PublishedDeck, DeckQuestion, DeckFaqItem, PublishedDeckSource, MediaSegment } from '@prisma/client';\ndeclare const prisma: PrismaClient;\nPrismaAdapter(prisma);\nprisma.publishedDeck; prisma.deckQuestion; prisma.deckFaqItem; prisma.publishedDeckSource; prisma.mediaSegment;\n`;
fs.writeFileSync(path.join(evidence, 'canonical-model-adapter-witness.ts.txt'), witness);
const modelDiagnostics = checkVirtual('canonical-witness.ts', witness);
const serializerDiagnostics = checkVirtual('lib/publish/serialize.ts', read('lib/publish/serialize.ts'));
const singletonDiagnostics = checkVirtual('lib/prisma.ts', read('lib/prisma.ts'));
assert.deepEqual(modelDiagnostics, []);
assert.deepEqual(serializerDiagnostics, []);
assert.deepEqual(singletonDiagnostics, []);
// Preserve the exact reviewed retirement even after Builder commits it, when
// git diff of the now-absent file is empty. Reverse-check below proves its scope.
fs.writeFileSync(path.join(evidence, 'context-retirement.patch'), read('docs/studio-v4/overnight-fidelity-20261002/evidence/build-compatibility-provenance/candidate-delete-unused-context.patch'));
const reverse = spawnSync('git', ['apply', '--reverse', '--check', path.join(root, 'docs/studio-v4/overnight-fidelity-20261002/evidence/build-compatibility-provenance/candidate-delete-unused-context.patch')], { cwd: root, encoding: 'utf8' });
assert.equal(reverse.status, 0, 'exact upstream retirement is reverse-applicable');
save('isolation-witness.json', {
  ...guards, generated: { clientVersion: generatedConfig.clientVersion, engineVersion: generatedConfig.engineVersion,
    sourceFilePath: generatedConfig.generator.sourceFilePath, output: generatedConfig.generator.output.value,
    binaryTargets: generatedConfig.generator.binaryTargets.map(t => t.value), canonicalModelNames: Object.keys(modelBody(canonicalSchema)),
    inlineSchemaHash: generatedConfig.inlineSchemaHash, artifactHashes: Object.fromEntries(['index.js', 'index.d.ts', 'schema.prisma', 'package.json', 'libquery_engine-darwin-arm64.dylib.node', 'libquery_engine-rhel-openssl-3.0.x.so.node'].map(f => [f, fileHash(path.join(privateGenerated, f))])),
  }, loadedPrismaModules, sharedSourceAndClientUnchanged: true,
  allFiveConsumerRuntimeExportsIdentical: true, adapterPeerRuntimeExportsIdentical: true,
  actualSerializerDiagnostics: serializerDiagnostics, actualSingletonDiagnostics: singletonDiagnostics, modelAdapterDiagnostics: modelDiagnostics,
  contextRetirementExact: true, clientConstructed: false, adapterInvoked: false, tokensMinted: false, databaseOrServiceCalls: false,
  runtimeScope: 'Actual installed/generated export loading and Node package resolution in the private dependency layout; active root consumers/preview still use the original symlink. Type-only imports have no emitted runtime import. No application handler or client/adapter operation was executed.',
});
if (process.argv.includes('--full-compiler')) {
  const compiler = privateRequire('typescript');
  assert.equal(compiler.version, '5.9.3');
  const fullOptions = { ...parsed.options, incremental: false, noEmit: true };
  assert.equal(fullOptions.paths?.['@prisma/client'], undefined);
  const nodeRoot = path.join(root, 'node_modules');
  const privateNodeRoot = path.join(privateRoot, 'node_modules');
  const routeDependencyRead = f => within(path.resolve(f), nodeRoot) ? privateNodeRoot + path.resolve(f).slice(nodeRoot.length) : f;
  const host = compiler.createCompilerHost(fullOptions);
  host.readFile = f => compiler.sys.readFile(routeDependencyRead(f));
  host.fileExists = f => compiler.sys.fileExists(routeDependencyRead(f));
  host.directoryExists = f => compiler.sys.directoryExists(routeDependencyRead(f));
  host.getDirectories = f => compiler.sys.getDirectories(routeDependencyRead(f));
  host.realpath = f => compiler.sys.realpath(routeDependencyRead(f));
  host.getSourceFile = (f, lang) => {
    const text = host.readFile(f);
    return text === undefined ? undefined : compiler.createSourceFile(f, text, lang, true);
  };
  const program = compiler.createProgram(parsed.fileNames, fullOptions, host);
  const remaining = compiler.getPreEmitDiagnostics(program).map(d => {
    const f = d.file ? path.relative(root, d.file.fileName) : '';
    const p = d.file ? d.file.getLineAndCharacterOfPosition(d.start) : null;
    return `${f}${p ? `(${p.line + 1},${p.character + 1})` : ''}: error TS${d.code}: ${compiler.flattenDiagnosticMessageText(d.messageText, '\n')}`;
  });
  fs.writeFileSync(path.join(evidence, 'typecheck-private-layout.txt'), remaining.join('\n') + '\n');
  const comparisonFile = path.join(root, 'docs/studio-v4/overnight-fidelity-20261002/evidence/visual-convergence-integration/typecheck-isolated-alias.txt');
  const normalized = lines => [...new Set(lines.filter(l => /error TS\d+:/.test(l)).map(l => l.replace(/\(\d+,\d+\)/, '(*)')))].sort();
  const previous = normalized(read(comparisonFile).split('\n'));
  const current = normalized(remaining);
  const added = current.filter(l => !previous.includes(l));
  const removed = previous.filter(l => !current.includes(l));
  const resolvedPrivateModelClient = compiler.resolveModuleName('@prisma/client', path.join(root, 'lib/prisma.ts'), fullOptions, host).resolvedModule;
  assert.ok(within(real(resolvedPrivateModelClient.resolvedFileName), privateRoot));
  save('full-compiler-comparison.json', { head, compilerVersion: compiler.version, sourceFileCount: parsed.fileNames.length,
    compilerOptions: { incremental: false, noEmit: true, strict: fullOptions.strict, skipLibCheck: fullOptions.skipLibCheck, paths: fullOptions.paths },
    virtualLayout: 'Only filesystem reads/resolution of the existing root node_modules prefix route to the genuine private installed tree. Actual local application files and normal root tsconfig are used; no @prisma/client alias, config write or root symlink switch.',
    resolvedPrismaDeclaration: real(resolvedPrivateModelClient.resolvedFileName), sourceDiagnosticLines: remaining.length,
    comparedTo: path.relative(root, comparisonFile), added, removed, remaining,
    result: remaining.length ? 'failed-with-disclosed-jose-and-Stripe-gates' : 'passed',
    runtimeScope: 'Virtual full semantic compiler proof of the prospective dependency layout; active app runtime remains on original shared symlink.',
  });
  assert.deepEqual(added, [], 'private layout adds no diagnostics compared with root isolated alias evidence');
  assert.deepEqual(removed, [], 'remaining diagnostic identities match root isolated alias evidence');
  assert.equal(remaining.length, 11);
  console.log('Full prospective private-layout compiler remains FAILED: 11 diagnostics, exactly matching existing alias evidence; no new errors or suppressions.');
}
console.log('PASS: private canonical 19-model generated client; both platform engines; five imports and adapter resolve identically; actual serializer/singleton and model/adapter declaration checks zero; protected source/shared client unchanged.');
