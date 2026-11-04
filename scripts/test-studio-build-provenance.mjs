// Offline provenance and virtual compiler witnesses. No package imports execute app,
// Prisma, Stripe or jose code; only TypeScript is loaded as a diagnostic compiler.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = process.cwd();
const out = path.join(root, 'docs/studio-v4/overnight-fidelity-20261002/evidence/build-compatibility-provenance');
fs.mkdirSync(out, { recursive: true });
// Keep evidence outside tsconfig's **/*.ts inclusion. These three exact paths
// are disposable artifacts from this script's earlier diagnostic iteration.
for (const name of ['historical-websocket-types.ts', 'historical-director-messages.ts', 'stripe-fields-witness.ts']) {
  const f = path.join(out, name);
  if (fs.existsSync(f)) fs.unlinkSync(f);
}
const require = createRequire(import.meta.url);
const ts = require('typescript');
const read = f => fs.readFileSync(path.resolve(root, f), 'utf8');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trimEnd();
const save = (name, data) => fs.writeFileSync(path.join(out, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n');
const tracked = git('ls-files', '-z').split('\0').filter(Boolean);
const trackedSource = tracked.filter(f => /\.(?:[cm]?[jt]sx?)$/.test(f) && fs.existsSync(path.join(root, f)));
const currentAppSource = execFileSync('rg', ['--files', 'app', 'components', 'contexts', 'hooks', 'lib'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(f => /\.(?:[cm]?[jt]sx?)$/.test(f));
const sourceFiles = [...new Set([...trackedSource, ...currentAppSource])];
const pkg = JSON.parse(read('package.json'));
const lock = read('pnpm-lock.yaml');
const npmLock = JSON.parse(read('package-lock.json'));
const metadata = n => {
  const f = fs.realpathSync(path.join(root, 'node_modules', n, 'package.json'));
  const p = JSON.parse(read(f));
  return { name: n, version: p.version, packageJson: f, sha256: sha(read(f)), type: p.type ?? 'commonjs', engines: p.engines ?? null };
};
const clientPackage = metadata('@prisma/client');
const sharedDir = path.resolve(path.dirname(clientPackage.packageJson), '../../.prisma/client');
const localDir = path.join(root, '.env.studio-v4-runtime/prisma-client');

// Tokenization removes whitespace and comments without changing quoted values.
// This is comparison, not a schema parser, migration or generation command.
function tokens(s) {
  return (s.match(/"(?:\\.|[^"\\])*"|\/\/[^\n]*|\/\*[\s\S]*?\*\/|[^\s"/]+|\//g) ?? [])
    .filter(t => !t.startsWith('//') && !t.startsWith('/*'));
}
const normalize = s => tokens(s).join(' ');
const withoutGenerator = s => s.replace(/generator\s+client\s*\{[^}]*\}/, '');
const stripComments = s => s.replace(/"(?:\\.|[^"\\])*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, t => t.startsWith('//') || t.startsWith('/*') ? '' : t);
// Prisma format relocates model-level @@map relative to @@index. Preserve all
// field/declaration content and field order; sort only independent @@ directives.
const normalizedBody = body => {
  const lines = body.split('\n').map(l => normalize(l)).filter(Boolean);
  return [...lines.filter(l => !l.startsWith('@@')), ...lines.filter(l => l.startsWith('@@')).sort()].join(' ');
};
const normalizedData = s => normalize(stripComments(withoutGenerator(s)).replace(/model\s+(\w+)\s*\{([^}]+)\}/g, (_, name, body) => `model ${name} { ${normalizedBody(body)} }`));
const models = s => Object.fromEntries([...stripComments(s).matchAll(/model\s+(\w+)\s*\{([^}]+)\}/g)].map(m => [m[1], normalizedBody(m[2])]));
const schemaInfo = f => {
  const s = read(f);
  return { path: f, sha256: sha(s), normalizedSha256: sha(normalize(s)), dataModelSha256: sha(normalizedData(s)), models: Object.keys(models(s)), generator: s.match(/generator\s+client\s*\{[^}]*\}/)?.[0] };
};
function generatedInfo(dir) {
  const s = read(path.join(dir, 'index.js'));
  const begin = s.indexOf('const config = {');
  const end = s.indexOf('\n}', begin);
  const config = JSON.parse(s.slice(begin + 'const config = '.length, end + 2));
  return {
    directory: dir, clientVersion: config.clientVersion, engineVersion: config.engineVersion,
    sourceFilePath: config.generator.sourceFilePath, output: config.generator.output.value,
    binaryTargets: config.generator.binaryTargets.map(t => t.value), inlineSchemaHash: config.inlineSchemaHash,
    inlineSchemaSha256: sha(config.inlineSchema), inlineSchemaMatchesCopiedSchema: config.inlineSchema === read(path.join(dir, 'schema.prisma')),
    artifacts: Object.fromEntries(['index.js', 'index.d.ts', 'schema.prisma', 'package.json'].map(f => [f, sha(read(path.join(dir, f)))])),
  };
}
const canonical = read('prisma/schema.prisma');
const local = read(path.join(localDir, 'schema.prisma'));
const shared = read(path.join(sharedDir, 'schema.prisma'));
const canonicalModels = models(canonical), sharedModels = models(shared);
assert.equal(sha(normalizedData(canonical)), sha(normalizedData(local)), 'local generated schema has exactly the canonical data model after only @@ directive ordering is normalized');
assert.equal(sha(normalizedData(local)), sha(normalizedData(read('.env.studio-v4-runtime/schema.prisma'))), 'local input and generated schemas have the same data model');
assert.equal(sha(withoutGenerator(canonical)), sha(withoutGenerator(read('.env.studio-v4-runtime/schema.prisma'))), 'local input is byte-identical outside its generator block');
const missingModels = Object.keys(canonicalModels).filter(n => !(n in sharedModels));
assert.deepEqual(missingModels, ['PublishedDeck', 'DeckQuestion', 'DeckFaqItem', 'PublishedDeckSource', 'MediaSegment']);
const changedCommonModels = Object.keys(sharedModels).filter(n => canonicalModels[n] !== sharedModels[n]);
const schemas = {
  canonical: schemaInfo('prisma/schema.prisma'), shared: schemaInfo(path.join(sharedDir, 'schema.prisma')),
  localInput: schemaInfo('.env.studio-v4-runtime/schema.prisma'), localGenerated: schemaInfo(path.join(localDir, 'schema.prisma')),
  master: schemaInfo('/Users/pk1980/Software/Deckster/frontend/prisma/schema.prisma'),
  missingModels, changedCommonModels,
  differencesInCommonModels: Object.fromEntries(changedCommonModels.map(n => [n, { shared: sharedModels[n], canonical: canonicalModels[n] }])),
  generated: { shared: generatedInfo(sharedDir), local: generatedInfo(localDir) },
  normalization: 'Comments and whitespace removed preserving quoted contents; generator client excluded only for dataModelSha256; independent model-level @@ directives sorted, field order and contents preserved.',
  localInputByteIdenticalOutsideGenerator: true,
};
for (const [label, s] of [['canonical', canonical], ['shared', shared], ['local', local]]) save(`schema-${label}.normalized.prisma`, normalize(s) + '\n');
function diff(a, b, name) {
  const r = spawnSync('git', ['diff', '--no-index', '--no-ext-diff', a, b], { cwd: root, encoding: 'utf8' });
  assert.ok(r.status === 0 || r.status === 1);
  save(name, r.stdout);
}
diff(path.join(sharedDir, 'schema.prisma'), path.join(root, 'prisma/schema.prisma'), 'schema-shared-to-canonical.diff');
diff(path.join(root, 'prisma/schema.prisma'), path.join(localDir, 'schema.prisma'), 'schema-canonical-to-local.diff');
diff(path.join(root, 'prisma/schema.prisma'), path.join(root, '.env.studio-v4-runtime/schema.prisma'), 'schema-canonical-to-local-input.diff');
const history = git('log', '--all', '--format=%H', '--', 'prisma/schema.prisma').split('\n');
const schemaHistoryMatches = [];
for (const commit of history) {
  let s;
  try { s = execFileSync('git', ['show', `${commit}:prisma/schema.prisma`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { continue; }
  if (sha(s) === sha(shared) || normalizedData(s) === normalizedData(shared)) {
    schemaHistoryMatches.push({ commit, metadata: git('show', '-s', '--format=%h %aI %s', commit), rawMatch: sha(s) === sha(shared), dataModelMatch: true });
  }
}
schemas.schemaHistoryMatches = schemaHistoryMatches;
save('prisma-provenance.json', schemas);

const parse = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
const configured = ts.parseJsonConfigFileContent(parse.config, ts.sys, root);
const options = { ...configured.options, incremental: false, noEmit: true, baseUrl: root };
const diagnostics = (roots, virtual = {}, extra = {}) => {
  const opts = { ...options, ...extra };
  const host = ts.createCompilerHost(opts);
  const v = Object.fromEntries(Object.entries(virtual).map(([f, s]) => [path.resolve(root, f), s]));
  const origRead = host.readFile, origExists = host.fileExists;
  const origDirectoryExists = host.directoryExists;
  host.readFile = f => v[path.resolve(f)] ?? origRead(f);
  host.fileExists = f => path.resolve(f) in v || origExists(f);
  host.directoryExists = f => Object.keys(v).some(p => p.startsWith(path.resolve(f) + path.sep)) || origDirectoryExists(f);
  host.getSourceFile = (f, languageVersion) => {
    const s = host.readFile(f);
    return s === undefined ? undefined : ts.createSourceFile(f, s, languageVersion, true);
  };
  const program = ts.createProgram(roots.map(f => path.resolve(root, f)), opts, host);
  return ts.getPreEmitDiagnostics(program).map(d => ({ file: d.file ? path.relative(root, d.file.fileName) : null,
    line: d.file ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : null,
    code: d.code, message: ts.flattenDiagnosticMessageText(d.messageText, '\n') }));
};
const prismaWitnessPath = path.join(out, 'prisma-models-witness.ts');
const prismaWitness = `import type { PrismaClient, PublishedDeck, DeckQuestion, DeckFaqItem, PublishedDeckSource, MediaSegment } from '@prisma/client';\ndeclare const prisma: PrismaClient;\nprisma.publishedDeck;\nprisma.deckQuestion;\nprisma.deckFaqItem;\nprisma.publishedDeckSource;\nprisma.mediaSegment;\n`;
save('prisma-models-witness.ts.txt', prismaWitness);
const prismaStandard = diagnostics([prismaWitnessPath], { [prismaWitnessPath]: prismaWitness });
const localPrismaPaths = { ...options.paths, '@prisma/client': [localDir] };
const prismaLocal = diagnostics([prismaWitnessPath], { [prismaWitnessPath]: prismaWitness }, { paths: localPrismaPaths });
assert.equal(prismaStandard.filter(d => d.code === 2305).length, 5);
assert.equal(prismaStandard.filter(d => d.code === 2339).length, 5);
assert.equal(prismaLocal.length, 0);
const actualSerializerStandard = diagnostics(['lib/publish/serialize.ts']);
const actualSerializerLocal = diagnostics(['lib/publish/serialize.ts'], {}, { paths: localPrismaPaths });
assert.equal(actualSerializerStandard.length, 1);
assert.equal(actualSerializerStandard[0].code, 2305);
assert.equal(actualSerializerLocal.length, 0);
save('prisma-virtual-diagnostics.json', { declarationWitness: { shared: prismaStandard, local: prismaLocal }, actualSerializer: { shared: actualSerializerStandard, local: actualSerializerLocal }, noRuntimeExecuted: true, actualSerializerSourceHash: sha(read('lib/publish/serialize.ts')) });
const contextPath = 'contexts/presentation-context.tsx';
const context = read(contextPath);
const oldWebsocket = execFileSync('git', ['show', 'bfc14cf^:lib/types/websocket-types.ts'], { cwd: root, encoding: 'utf8' });
const oldDirector = execFileSync('git', ['show', 'bfc14cf^:lib/types/director-messages.ts'], { cwd: root, encoding: 'utf8' });
save('historical-websocket-types.ts.txt', oldWebsocket);
save('historical-director-messages.ts.txt', oldDirector);
const deletedContext = execFileSync('git', ['show', '64f9033^:contexts/presentation-context.tsx'], { cwd: root, encoding: 'utf8' });
assert.equal(context, deletedContext, 'current context is exactly the historical upstream-deleted source');
const importEdges = [], unresolvedDynamic = [], contextReferences = [];
const contextSymbols = ['PresentationProvider', 'usePresentation', 'usePresentationSlides', 'useCurrentSlide', 'usePresentationPhase', 'usePresentationProgress', 'useChatMessages', 'PresentationState', 'PresentationAction'];
const contextSymbolConsumers = [];
for (const file of sourceFiles) {
  // Evidence and retired prototypes are not application modules. Their literals are
  // still searched for the exact context filename, but not treated as live imports.
  const s = read(file), absolute = path.join(root, file);
  if (file !== contextPath && /presentation-context/.test(s)) contextReferences.push(file);
  if (!/^(app|components|contexts|hooks|lib)\//.test(file) && !/^(middleware|instrumentation)\.[cm]?[jt]s$/.test(file)) continue;
  const sf = ts.createSourceFile(absolute, s, ts.ScriptTarget.Latest, true);
  const visit = n => {
    let module, kind;
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier) { module = n.moduleSpecifier; kind = ts.isImportDeclaration(n) ? 'import' : 'export'; }
    if (ts.isCallExpression(n) && (n.expression.kind === ts.SyntaxKind.ImportKeyword || n.expression.getText(sf) === 'require')) { module = n.arguments[0]; kind = 'dynamic'; }
    if (module) {
      if (ts.isStringLiteralLike(module)) {
        const specifier = module.text;
        const target = ts.resolveModuleName(specifier, absolute, options, ts.sys).resolvedModule?.resolvedFileName;
        importEdges.push({ file, kind, specifier, resolved: target ? path.relative(root, target) : null });
      } else unresolvedDynamic.push({ file, line: sf.getLineAndCharacterOfPosition(n.pos).line + 1 });
    }
    if (file !== contextPath && ts.isIdentifier(n) && contextSymbols.includes(n.text)) contextSymbolConsumers.push({ file, identifier: n.text });
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
const incomingContextEdges = importEdges.filter(e => e.resolved === contextPath || e.specifier.includes('presentation-context'));
assert.equal(incomingContextEdges.length, 0);
assert.equal(contextSymbolConsumers.length, 0);
const contextOriginal = diagnostics([contextPath]);
const contextRestored = diagnostics([contextPath], { 'lib/types/websocket-types.ts': oldWebsocket, 'lib/types/director-messages.ts': oldDirector });
save('legacy-context-virtual-diagnostics.json', { original: contextOriginal, restored: contextRestored });
assert.deepEqual(contextOriginal.map(d => d.code), [2307, 2307]);
assert.ok(contextRestored.some(d => d.code === 2339 && /id|timestamp/.test(d.message)));
const contextEmit = ts.transpileModule(context, { compilerOptions: { ...options, noEmit: false, jsx: ts.JsxEmit.ReactJSX } }).outputText;
assert.ok(!contextEmit.includes('websocket-types') && !contextEmit.includes('director-messages'), 'missing imports were erased as type-only uses');
save('legacy-context-provenance.json', {
  sourceHash: sha(context), historicalDeletedSourceHash: sha(deletedContext), byteIdenticalToUpstreamDeletion: true,
  deletionCommit: git('rev-parse', '64f9033'), typeRemovalCommit: git('rev-parse', 'bfc14cf'),
  deletionIsAncestorOfCurrentHead: spawnSync('git', ['merge-base', '--is-ancestor', '64f9033', 'HEAD'], { cwd: root }).status === 0,
  historicalTypeHashes: { websocket: sha(oldWebsocket), director: sha(oldDirector) },
  scannedTrackedSourceCount: trackedSource.length, scannedCurrentAppSourceCount: currentAppSource.length,
  scannedTotalSourceCount: sourceFiles.length, incomingContextEdges, contextSymbolConsumers, contextReferences, unresolvedDynamic,
  originalDiagnostics: contextOriginal, exactHistoricalRestoreDiagnostics: contextRestored,
  contextEmitSha256: sha(contextEmit), typeImportsErased: true,
  limitation: 'Static tracked application graph and symbol scan; reflective string construction outside it is not proven. File deletion candidate does not emit or execute this unreachable module; no runtime mounted-provider test is claimed.',
});
save('application-import-edges.json', importEdges);
save('candidate-delete-unused-context.patch', `diff --git a/${contextPath} b/${contextPath}\ndeleted file mode 100644\n--- a/${contextPath}\n+++ /dev/null\n@@ -1,${context.split('\n').length - 1} +0,0 @@\n${context.split('\n').slice(0, -1).map(l => '-' + l).join('\n')}\n`);

const mockPath = 'app/api/dev/mock-token/route.ts';
const mockOriginal = diagnostics([mockPath]);
const joseVersions = ['4.15.9', '6.1.2'];
const mockCandidates = {};
for (const version of joseVersions) {
  const dir = path.join(root, `node_modules/.pnpm/jose@${version}/node_modules/jose`);
  const manifest = JSON.parse(read(path.join(dir, 'package.json')));
  const mapped = diagnostics([mockPath], {}, { paths: { ...options.paths, jose: [path.join(dir, manifest.types)] } });
  assert.equal(mapped.length, 0, `actual route typechecks with ${version} declarations`);
  mockCandidates[version] = { manifestHash: sha(read(path.join(dir, 'package.json'))), type: manifest.type ?? 'commonjs', exports: manifest.exports['.'], isolatedDiagnostics: mapped };
}
assert.deepEqual(mockOriginal.map(d => d.code), [2307]);
let rootJose;
try { rootJose = { resolvable: true, path: require.resolve('jose') }; } catch (e) { rootJose = { resolvable: false, code: e.code }; }
assert.equal(rootJose.resolvable, false);
save('jose-provenance.json', {
  directDependency: pkg.dependencies.jose ?? null, directDevDependency: pkg.devDependencies.jose ?? null,
  rootJose, routeSourceHash: sha(read(mockPath)), originalDiagnostics: mockOriginal, candidates: mockCandidates,
  existingLockConsumers: { 'next-auth@4.24.13': '4.15.9', 'openid-client@5.7.1': '4.15.9', '@auth/core@0.41.1': '6.1.2' },
  routeReferences: sourceFiles.filter(f => f !== mockPath && /mock-token/.test(read(f))),
  emittedSourceChange: false, witnessLimit: 'Declaration-resolution proof only; no route call, JWT construction, signing or cryptographic behavior proof.',
});
function candidatePatch(file, candidate, label) {
  const candidateFile = path.join(out, `candidate-${label}-${path.basename(file)}`);
  fs.writeFileSync(candidateFile, candidate);
  const r = spawnSync('git', ['diff', '--no-index', '--no-ext-diff', path.join(root, file), candidateFile], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 1);
  return r.stdout.replace(/^diff --git .*$/m, `diff --git a/${file} b/${file}`).replace(/^--- .*$/m, `--- a/${file}`).replace(/^\+\+\+ .*$/m, `+++ b/${file}`);
}
for (const version of joseVersions) {
  const label = `jose${version[0]}`;
  const manifestCandidate = read('package.json').replace('    "jsonwebtoken":', `    "jose": "${version}",\n    "jsonwebtoken":`);
  const lockCandidate = lock.replace('      jsonwebtoken:\n', `      jose:\n        specifier: ${version}\n        version: ${version}\n      jsonwebtoken:\n`);
  assert.equal(JSON.parse(manifestCandidate).dependencies.jose, version);
  const patch = candidatePatch('package.json', manifestCandidate, label) + candidatePatch('pnpm-lock.yaml', lockCandidate, label);
  save(`candidate-${label}-direct-dependency.patch`, patch);
  const checked = spawnSync('git', ['apply', '--check', '--whitespace=error', path.join(out, `candidate-${label}-direct-dependency.patch`)], { cwd: root, encoding: 'utf8' });
  assert.equal(checked.status, 0, checked.stderr);
}
const contextPatchCheck = spawnSync('git', ['apply', '--check', '--whitespace=error', path.join(out, 'candidate-delete-unused-context.patch')], { cwd: root, encoding: 'utf8' });
assert.equal(contextPatchCheck.status, 0, contextPatchCheck.stderr);

const stripeMeta = metadata('stripe');
const stripeDir = path.dirname(stripeMeta.packageJson);
const stripeWitnessPath = path.join(out, 'stripe-fields-witness.ts');
const stripeWitness = `import Stripe from 'stripe';\ndeclare const subscription: Stripe.Subscription;\ndeclare const invoice: Stripe.Invoice;\nnew Stripe('offline-unused-placeholder', { apiVersion: '2024-11-20.acacia', typescript: true });\nsubscription.current_period_start;\nsubscription.current_period_end;\ninvoice.payment_intent;\ninvoice.subscription;\n// These do exist in the installed schema; mapping semantics need endpoint evidence.\nsubscription.items.data[0]?.current_period_start;\nsubscription.items.data[0]?.current_period_end;\ninvoice.parent?.subscription_details?.subscription;\n`;
save('stripe-fields-witness.ts.txt', stripeWitness);
const stripeDiagnostics = diagnostics([stripeWitnessPath], { [stripeWitnessPath]: stripeWitness });
assert.deepEqual(stripeDiagnostics.map(d => d.code), [2322, 2339, 2339, 2339, 2339]);
const stripeFiles = ['types/apiVersion.d.ts', 'types/lib.d.ts', 'types/Subscriptions.d.ts', 'types/SubscriptionItems.d.ts', 'types/Invoices.d.ts', 'types/InvoicePayments.d.ts', 'types/Events.d.ts', 'types/WebhookEndpoints.d.ts'];
save('stripe-provenance.json', {
  installed: stripeMeta, manifestSpecifier: pkg.dependencies.stripe,
  declaredApiVersion: read(path.join(stripeDir, 'types/apiVersion.d.ts')).match(/ApiVersion = '([^']+)'/)[1],
  constructorVersion: read('lib/stripe/stripe.ts').match(/apiVersion: '([^']+)'/)[1],
  declarationHashes: Object.fromEntries(stripeFiles.map(f => [f, sha(read(path.join(stripeDir, f)))])),
  witnessDiagnostics: stripeDiagnostics,
  implementationHashes: Object.fromEntries(['lib/stripe/stripe.ts', 'app/api/webhooks/stripe/route.ts', 'lib/wallet.ts'].map(f => [f, sha(read(f))])),
  getStripeConsumers: importEdges.filter(e => e.resolved === 'lib/stripe/stripe.ts'),
  incomingVersionGate: 'Current source verifies signature then casts event.data.object. It does not inspect event.api_version. Endpoint api_version and representative redacted subscription/invoice payload provenance are absent; request constructor apiVersion does not prove those incoming payload fields.',
  candidatePolicy: 'No billing patch: select a dependency generation consistent with verified endpoint contract, or explicitly authorize versioned validated payload adaptation after endpoint/version/multi-item and invoice-payment semantics are established. Never cast missing fields into existence or bump request API just to typecheck.',
});
const modelConsumers = importEdges.filter(e => /@prisma\/client|lib\/prisma/.test(e.specifier));
save('prisma-consumers.json', {
  imports: modelConsumers,
  missingModelConsumers: sourceFiles.filter(f => /^(app|lib)\//.test(f)).flatMap(f => {
    const lines = read(f).split('\n');
    return lines.flatMap((line, i) => /\b(publishedDeck|deckQuestion|deckFaqItem|publishedDeckSource|mediaSegment)\b/.test(line) ? [{ file: f, line: i + 1, code: line.trim() }] : []);
  }),
  runtimePrismaImportUnchanged: read('lib/prisma.ts').includes("from '@prisma/client'"),
  typeOnlyMapping: JSON.parse(read('.env.studio-v4-runtime/tsconfig.json')).compilerOptions.paths['@prisma/client'],
});
const installedLock = path.join(root, 'node_modules/.pnpm/lock.yaml');
save('dependency-provenance.json', {
  capturedAt: new Date().toISOString(), head: git('rev-parse', 'HEAD'), node: process.version,
  nodeModulesSymlink: fs.readlinkSync(path.join(root, 'node_modules')), packageManager: pkg.packageManager,
  fileHashes: Object.fromEntries(['package.json', 'pnpm-lock.yaml', 'package-lock.json', 'tsconfig.json', '.env.studio-v4-runtime/tsconfig.json'].map(f => [f, sha(read(f))])),
  installedLockHash: fs.existsSync(installedLock) ? sha(read(installedLock)) : null,
  installedSelected: ['@prisma/client', 'prisma', 'stripe', 'next', 'next-auth', '@auth/prisma-adapter', 'typescript'].map(metadata),
  npmLockSelected: Object.fromEntries(['@prisma/client', 'prisma', 'stripe', 'jose'].map(n => [n, { version: npmLock.packages?.['node_modules/' + n]?.version, direct: npmLock.packages?.['']?.dependencies?.[n] ?? npmLock.packages?.['']?.devDependencies?.[n] ?? null }])),
  pnpmSelectedImporter: lock.match(/      stripe:[\s\S]*?      tailwind-merge:/)?.[0] + '\n' + lock.match(/    devDependencies:[\s\S]*?      tailwindcss:/)?.[0],
  evidenceBasis: 'Local package/schema/declaration contents and Git history; no network, install, regeneration, database or application execution.',
});
save('witness-summary.json', {
  status: 'offline-provenance-and-candidate-evidence-complete',
  prismaCanonicalVsLocalDataModelEqual: true, prismaSharedMissingModels: missingModels,
  prismaSharedChangedCommonModels: changedCommonModels, legacyImporters: incomingContextEdges.length,
  prismaModelWitnessSharedDiagnostics: prismaStandard.length, prismaModelWitnessLocalDiagnostics: prismaLocal.length,
  actualSerializerSharedDiagnostics: actualSerializerStandard.length, actualSerializerLocalDiagnostics: actualSerializerLocal.length,
  historicalContextRestoreDiagnosticCount: contextRestored.length,
  mockRouteOriginalDiagnosticCount: mockOriginal.length, jose4CandidateDiagnosticCount: 0, jose6CandidateDiagnosticCount: 0,
  stripeActualDeclarationWitnessDiagnosticCount: stripeDiagnostics.length,
  wholeAppCompiler: 'Not rerun; prior 121 standard / 13 task-local diagnostic lines remain failing.',
  productionFilesModified: false, tokensMinted: false, connectedOperations: false,
});
console.log(JSON.stringify({ passed: true, missingModels, changedCommonModels, historicalContextRestoreDiagnostics: contextRestored.length, sourceFiles: sourceFiles.length, artifacts: out }));
