/**
 * Session API hardening (flag SESSION_API_HARDENING_ENABLED, default off).
 *
 * Runs the REAL route handlers (app/api/admin/cleanup-sessions/route.ts,
 * app/api/sessions/route.ts, app/api/sessions/[id]/route.ts) and the real
 * lib/session-api-hardening.ts, with real NextRequest / NextResponse. Only the
 * external boundaries are faked: Prisma (in-memory, records every call),
 * next-auth's getServerSession and the auth options. No database, no network,
 * no real secrets (CRON_SECRET below is a throwaway test value).
 *
 * Properties:
 *   1. Flag unset / false / TRUE / 1 / " true": every response (status + body
 *      bytes) and every Prisma call is exactly what the pre-flag routes did:
 *      open cleanup listing, 409 echoing the row of any owner, PATCH spreading the
 *      whole body into the update.
 *      Optional differential: LEGACY_REF=<git ref> (e.g. origin/uat) runs the same
 *      matrix against the routes as they were at that ref and requires an
 *      identical sha256.
 *   2. Flag "true": cleanup GET needs `Bearer <CRON_SECRET>` (401 without / wrong,
 *      500 when no secret is configured, same body as flag-off with it, no Prisma
 *      read before the check); POST /api/sessions answers a bare 409 for another
 *      account's id and still echoes the row to its owner; PATCH writes only the
 *      allow-listed fields.
 *   3. Flag "true" changes nothing else: every other case in the matrix is
 *      identical to flag-off, including the payload of every real PATCH caller.
 *   4. The allow-list covers every field the frontend sends and only names real
 *      ChatSession columns.
 *
 * Run: node scripts/test-session-api-hardening.mjs
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';

const nodeRequire = createRequire(import.meta.url);
const root = path.join(new URL('.', import.meta.url).pathname, '..');

const FLAG = 'SESSION_API_HARDENING_ENABLED';
const TEST_SECRET = 'unit-test-throwaway-cron-secret';
const FIXED_NOW = Date.parse('2026-10-06T12:00:00.000Z');
const OLD = new Date(FIXED_NOW - 72 * 3600 * 1000);

const ROUTES = {
  cleanup: 'app/api/admin/cleanup-sessions/route.ts',
  sessions: 'app/api/sessions/route.ts',
  sessionId: 'app/api/sessions/[id]/route.ts',
};

const { NextRequest, NextResponse } = nodeRequire('next/server');

// ---------------------------------------------------------------------------
// Source loading
// ---------------------------------------------------------------------------
function readCurrent(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function readAtRef(ref) {
  return (rel) => execFileSync('git', ['show', `${ref}:${rel}`], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 24 });
}

function transpile(code) {
  return ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
}

// ---------------------------------------------------------------------------
// Fake Prisma: in-memory, records every call (args normalised for hashing)
// ---------------------------------------------------------------------------
function norm(value) {
  return JSON.parse(JSON.stringify(value ?? null, (k, v) => (k === 'updatedAt' ? '<now>' : v)));
}

function makeWorld() {
  const world = {
    sessionEmail: 'a@example.test',
    calls: [],
    users: [
      { id: 'user-a', email: 'a@example.test', name: 'A' },
      { id: 'user-b', email: 'b@example.test', name: 'B' },
    ],
    sessions: new Map(),
    cleanupRows: [],
    logs: [],
  };
  const rec = (op, args) => world.calls.push({ op, args: norm(args) });
  const clone = (row) => (row ? structuredClone(row) : null);

  world.sessions.set('own-session', {
    id: 'own-session', userId: 'user-a', title: 'Mine', createdAt: OLD, updatedAt: OLD,
    lastMessageAt: null, firstMessageAt: null, currentStage: 1, blankPresentationUrl: null,
    strawmanPreviewUrl: null, finalPresentationUrl: null, blankPresentationId: null,
    strawmanPresentationId: null, finalPresentationId: null, slideCount: null, status: 'active',
    isFavorite: false, geminiStoreName: 'fileSearchStores/own-store', geminiStoreId: 'own-store',
  });
  world.sessions.set('foreign-session', {
    id: 'foreign-session', userId: 'user-b', title: 'Theirs, private', createdAt: OLD, updatedAt: OLD,
    lastMessageAt: OLD, firstMessageAt: OLD, currentStage: 4,
    blankPresentationUrl: 'https://layout.example.test/p/victim-blank',
    strawmanPreviewUrl: 'https://layout.example.test/p/victim-straw',
    finalPresentationUrl: null, blankPresentationId: 'victim-blank', strawmanPresentationId: 'victim-straw',
    finalPresentationId: null, slideCount: 7, status: 'active', isFavorite: true,
    geminiStoreName: 'fileSearchStores/victim-store', geminiStoreId: 'victim-store',
  });
  world.cleanupRows = [
    {
      id: 'draft-victim', userId: 'user-b', createdAt: OLD, geminiStoreName: 'fileSearchStores/victim-store',
      uploadedFiles: [
        { id: 'f1', fileName: 'private-plan.pdf', fileSize: 2048, geminiFileUri: 'u1', geminiStoreName: 's1' },
        { id: 'f2', fileName: 'notes.docx', fileSize: 1024, geminiFileUri: 'u2', geminiStoreName: 's1' },
      ],
    },
  ];

  const prisma = {
    user: {
      async findUnique(args) {
        rec('user.findUnique', args);
        const u = world.users.find((x) => x.email === args.where.email);
        return clone(u);
      },
      async create(args) {
        rec('user.create', args);
        return { id: 'user-new', ...args.data };
      },
    },
    chatSession: {
      async findUnique(args) {
        rec('chatSession.findUnique', args);
        const row = clone(world.sessions.get(args.where.id));
        if (row && args.include) {
          if (args.include.messages) row.messages = [];
          if (args.include.stateCache) row.stateCache = null;
        }
        return row;
      },
      async create(args) {
        rec('chatSession.create', args);
        const row = { createdAt: new Date(FIXED_NOW), updatedAt: new Date(FIXED_NOW), ...args.data };
        world.sessions.set(row.id, row);
        return clone(row);
      },
      async update(args) {
        rec('chatSession.update', args);
        const row = world.sessions.get(args.where.id);
        for (const [k, v] of Object.entries(args.data)) {
          if (v === null || typeof v !== 'object' || v instanceof RealDateClass) row[k] = v;
        }
        return clone(row);
      },
      async findMany(args) {
        rec('chatSession.findMany', args);
        return clone(world.cleanupRows);
      },
      async count(args) {
        rec('chatSession.count', args);
        return 0;
      },
      async deleteMany(args) {
        rec('chatSession.deleteMany', args);
        return { count: world.cleanupRows.length };
      },
    },
    uploadedFile: {
      async deleteMany(args) { rec('uploadedFile.deleteMany', args); return { count: 2 }; },
    },
    chatMessage: {
      async deleteMany(args) { rec('chatMessage.deleteMany', args); return { count: 0 }; },
    },
    sessionStateCache: {
      async deleteMany(args) { rec('sessionStateCache.deleteMany', args); return { count: 0 }; },
    },
  };

  const quietConsole = {};
  for (const level of ['log', 'info', 'debug', 'warn', 'error']) {
    quietConsole[level] = (...args) => {
      world.logs.push(`${level}: ${args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}`);
    };
  }

  world.prisma = prisma;
  world.console = quietConsole;
  return world;
}

function loadModules(world, readSource) {
  const cache = new Map();
  const fakes = {
    'next/server': { NextRequest, NextResponse },
    'next-auth': {
      getServerSession: async () =>
        world.sessionEmail ? { user: { email: world.sessionEmail, id: 'token-id', name: 'T' } } : null,
    },
    '@/lib/auth-options': { authOptions: {} },
    '@/lib/prisma': { prisma: world.prisma },
    '@/lib/dev-deployment': { isStudioDevDeployment: () => false },
  };

  function requireFor() {
    return function load(spec) {
      if (spec in fakes) return fakes[spec];
      if (spec === 'node:crypto' || spec === 'crypto') return nodeRequire('node:crypto');
      if (spec === '@/lib/session-api-hardening') {
        // Always the real helper from the tree under test.
        if (!cache.has(spec)) {
          const mod = { exports: {} };
          cache.set(spec, mod.exports);
          new Function('module', 'exports', 'require', 'process', 'console', transpile(readCurrent('lib/session-api-hardening.ts')))(
            mod, mod.exports, load, process, world.console,
          );
          cache.set(spec, mod.exports);
        }
        return cache.get(spec);
      }
      throw new Error(`unexpected import in test loader: ${spec}`);
    };
  }

  function loadRoute(rel) {
    const mod = { exports: {} };
    new Function('module', 'exports', 'require', 'process', 'console', transpile(readSource(rel)))(
      mod, mod.exports, requireFor(), process, world.console,
    );
    return mod.exports;
  }

  return {
    cleanup: loadRoute(ROUTES.cleanup),
    sessions: loadRoute(ROUTES.sessions),
    sessionId: loadRoute(ROUTES.sessionId),
  };
}

// ---------------------------------------------------------------------------
// Env + time control
// ---------------------------------------------------------------------------
// `new Date()` and `Date.now()` inside the routes are pinned so response bytes
// and logs can be compared (and hashed) across runs.
const RealDateClass = globalThis.Date;
class FrozenDate extends RealDateClass {
  constructor(...args) {
    if (args.length === 0) super(FIXED_NOW);
    else super(...args);
  }
  static now() {
    return FIXED_NOW;
  }
}

async function withEnv(env, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(env)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const RealDate = globalThis.Date;
  globalThis.Date = FrozenDate;
  try {
    return await fn();
  } finally {
    globalThis.Date = RealDate;
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

// ---------------------------------------------------------------------------
// Request helpers + the case matrix
// ---------------------------------------------------------------------------
const url = (p) => `http://localhost:3000${p}`;
function req(method, p, { headers = {}, json, raw } = {}) {
  const init = { method, headers: { ...headers } };
  if (json !== undefined || raw !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = raw !== undefined ? raw : JSON.stringify(json);
  }
  return new NextRequest(url(p), init);
}

async function observe(world, fn) {
  world.calls.length = 0;
  world.logs.length = 0;
  const res = await fn();
  const text = await res.text();
  return {
    status: res.status,
    contentType: res.headers.get('content-type'),
    body: text,
    calls: world.calls.map((c) => ({ ...c })),
    logs: [...world.logs],
  };
}

// Every payload a real caller sends to PATCH /api/sessions/[id] (see the PR
// description for the file:line of each).
const REAL_PATCH_PAYLOADS = {
  'title only (builder first message / title from slide_update)': { title: 'Q4 plan' },
  'customized-deck source save (builder handoff)': {
    currentStage: 0,
    blankPresentationUrl: 'https://layout.example.test/p/abc',
    blankPresentationId: 'abc',
    slideCount: 5,
    lastMessageAt: '2026-10-06T12:00:00.000Z',
  },
  'recovered viewer URL (blank)': { blankPresentationUrl: 'https://layout.example.test/p/abc' },
  'recovered viewer URL (strawman + final)': {
    strawmanPreviewUrl: 'https://layout.example.test/p/s',
    finalPresentationUrl: 'https://layout.example.test/p/f',
  },
  'stage update, blank (updateMetadata)': {
    currentStage: 0, slideCount: 1, lastMessageAt: '2026-10-06T12:00:00.000Z',
    stateCache: { activeVersion: 'blank', slideStructure: { slides: [] } },
    blankPresentationUrl: 'https://layout.example.test/p/b', blankPresentationId: 'b',
  },
  'stage update, strawman (updateMetadata)': {
    currentStage: 4, slideCount: 8, lastMessageAt: '2026-10-06T12:00:00.000Z',
    stateCache: { activeVersion: 'strawman', slideStructure: { slides: [{ n: 1 }] }, currentStatus: { s: 'ok' } },
    strawmanPreviewUrl: 'https://layout.example.test/p/s', strawmanPresentationId: 's',
  },
  'stage update, final (updateMetadata)': {
    currentStage: 6, slideCount: 8, lastMessageAt: '2026-10-06T12:00:00.000Z',
    stateCache: { activeVersion: 'final', slideStructure: { slides: [] } },
    finalPresentationUrl: 'https://layout.example.test/p/f', finalPresentationId: 'f',
  },
  'slide count + strawman url (element/slide updates)': {
    slideCount: 9, lastMessageAt: '2026-10-06T12:00:00.000Z',
    strawmanPreviewUrl: 'https://layout.example.test/p/s', strawmanPresentationId: 's',
  },
  'slide count + final url (element/slide updates)': {
    slideCount: 9, lastMessageAt: '2026-10-06T12:00:00.000Z',
    finalPresentationUrl: 'https://layout.example.test/p/f', finalPresentationId: 'f',
  },
  'count only (studio persistCount)': { slideCount: 3, lastMessageAt: '2026-10-06T12:00:00.000Z' },
};

// A hostile body: allowed fields mixed with everything an owner must not write.
const HOSTILE_PATCH = {
  title: 'renamed',
  slideCount: 2,
  userId: 'user-b',
  id: 'someone-elses-id',
  createdAt: '2000-01-01T00:00:00.000Z',
  firstMessageAt: '2000-01-01T00:00:00.000Z',
  geminiStoreId: 'victim-store',
  geminiStoreName: 'fileSearchStores/victim-store',
  user: { connect: { id: 'user-b' } },
  messages: { deleteMany: {} },
  uploadedFiles: { deleteMany: {} },
  publishedDeck: { delete: true },
  stateCache: { activeVersion: 'final', slideStructure: [], currentStatus: null, sessionId: 'other', extra: 1 },
};

/** The full case matrix. Returns Map<caseName, observation>. */
async function runMatrix(readSource, env) {
  const out = new Map();
  const bearer = `Bearer ${TEST_SECRET}`;
  const idCtx = (id) => ({ params: Promise.resolve({ id }) });

  // each case gets a fresh world so Prisma state never leaks between cases
  async function run(name, setup, fn) {
    const world = makeWorld();
    setup?.(world);
    const mods = loadModules(world, readSource);
    out.set(name, await withEnv(env, () => observe(world, () => fn(mods))));
  }

  // --- cleanup-sessions
  await run('cleanup.GET no header, secret set', null, (m) => m.cleanup.GET(req('GET', '/api/admin/cleanup-sessions')));
  await run('cleanup.GET wrong bearer, secret set', null, (m) =>
    m.cleanup.GET(req('GET', '/api/admin/cleanup-sessions', { headers: { authorization: 'Bearer nope' } })));
  await run('cleanup.GET right bearer, secret set', null, (m) =>
    m.cleanup.GET(req('GET', '/api/admin/cleanup-sessions', { headers: { authorization: bearer, 'user-agent': 'vercel-cron/1.0' } })));
  await run('cleanup.GET no header, secret unset', null, (m) => m.cleanup.GET(req('GET', '/api/admin/cleanup-sessions')));
  await run('cleanup.POST no header, secret set', null, (m) => m.cleanup.POST(req('POST', '/api/admin/cleanup-sessions')));
  await run('cleanup.POST right bearer, secret set', null, (m) =>
    m.cleanup.POST(req('POST', '/api/admin/cleanup-sessions', { headers: { authorization: bearer } })));
  await run('cleanup.POST no secret configured', null, (m) =>
    m.cleanup.POST(req('POST', '/api/admin/cleanup-sessions', { headers: { authorization: 'Bearer undefined' } })));

  // --- POST /api/sessions
  await run('sessions.POST unauthenticated', (w) => { w.sessionEmail = null; }, (m) =>
    m.sessions.POST(req('POST', '/api/sessions', { json: { sessionId: 'x' } })));
  await run('sessions.POST missing sessionId', null, (m) => m.sessions.POST(req('POST', '/api/sessions', { json: {} })));
  await run('sessions.POST new id', null, (m) =>
    m.sessions.POST(req('POST', '/api/sessions', { json: { sessionId: 'brand-new', title: 'Fresh' } })));
  await run('sessions.POST own existing id', null, (m) =>
    m.sessions.POST(req('POST', '/api/sessions', { json: { sessionId: 'own-session' } })));
  await run('sessions.POST foreign existing id', null, (m) =>
    m.sessions.POST(req('POST', '/api/sessions', { json: { sessionId: 'foreign-session' } })));

  // --- PATCH /api/sessions/[id]
  const patch = (id, json, raw) => (m) =>
    m.sessionId.PATCH(req('PATCH', `/api/sessions/${id}`, raw !== undefined ? { raw } : { json }), idCtx(id));
  await run('sessions.PATCH unauthenticated', (w) => { w.sessionEmail = null; }, patch('own-session', { title: 'x' }));
  await run('sessions.PATCH unknown id', null, patch('nope', { title: 'x' }));
  await run('sessions.PATCH foreign id', null, patch('foreign-session', { title: 'x' }));
  await run('sessions.PATCH null body', null, patch('own-session', undefined, 'null'));
  await run('sessions.PATCH hostile body (own id)', null, patch('own-session', HOSTILE_PATCH));
  for (const [label, payload] of Object.entries(REAL_PATCH_PAYLOADS)) {
    await run(`sessions.PATCH real caller: ${label}`, null, patch('own-session', payload));
  }
  return out;
}

const ENV_OFF_VARIANTS = [
  ['unset', undefined],
  ['false', 'false'],
  ['TRUE', 'TRUE'],
  ['1', '1'],
  [' true', ' true'],
  ['empty', ''],
];

function envFor(flagValue, { secret = true } = {}) {
  return { [FLAG]: flagValue, CRON_SECRET: secret ? TEST_SECRET : undefined };
}

const hashOf = (matrix) =>
  createHash('sha256')
    .update(JSON.stringify([...matrix.entries()]))
    .digest('hex');

// The cases whose "secret unset" variants need a different env.
async function fullMatrix(readSource, flagValue) {
  const withSecret = await runMatrix(readSource, envFor(flagValue));
  const noSecret = await runMatrix(readSource, envFor(flagValue, { secret: false }));
  // splice the secret-less results for the cases named "no header, secret unset"
  // and "no secret configured"
  for (const name of ['cleanup.GET no header, secret unset', 'cleanup.POST no secret configured']) {
    withSecret.set(name, noSecret.get(name));
  }
  return withSecret;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

const lib = (() => {
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', transpile(readCurrent('lib/session-api-hardening.ts')))(
    mod, mod.exports, nodeRequire,
  );
  return mod.exports;
})();

const offMatrix = await fullMatrix(readCurrent, undefined);
const onMatrix = await fullMatrix(readCurrent, 'true');

await test('flag helper: exactly "true" enables, anything else is off', () => {
  const saved = process.env[FLAG];
  try {
    for (const [label, value] of ENV_OFF_VARIANTS) {
      if (value === undefined) delete process.env[FLAG];
      else process.env[FLAG] = value;
      assert.equal(lib.isSessionApiHardeningEnabled(), false, `flag ${label}`);
    }
    process.env[FLAG] = 'true';
    assert.equal(lib.isSessionApiHardeningEnabled(), true);
  } finally {
    if (saved === undefined) delete process.env[FLAG];
    else process.env[FLAG] = saved;
  }
});

await test('flag off: today\'s behaviour is pinned (open listing, row-echoing 409, whole-body PATCH)', () => {
  // cleanup GET: no header, no secret needed, lists other users' ids and file counts
  const open = offMatrix.get('cleanup.GET no header, secret set');
  assert.equal(open.status, 200);
  const listing = JSON.parse(open.body);
  assert.equal(listing.dryRun, true);
  assert.equal(listing.sessions[0].userId, 'user-b');
  assert.equal(listing.sessions[0].fileCount, 2);
  assert.equal(offMatrix.get('cleanup.GET wrong bearer, secret set').status, 200);
  assert.equal(offMatrix.get('cleanup.GET no header, secret unset').status, 200);

  // POST /api/sessions: 409 echoes the row of any owner
  const foreign = offMatrix.get('sessions.POST foreign existing id');
  assert.equal(foreign.status, 409);
  const foreignBody = JSON.parse(foreign.body);
  assert.equal(foreignBody.error, 'Session already exists');
  assert.equal(foreignBody.session.userId, 'user-b');
  assert.equal(foreignBody.session.geminiStoreName, 'fileSearchStores/victim-store');

  // PATCH: every key of the body (minus stateCache) reaches Prisma
  const hostile = offMatrix.get('sessions.PATCH hostile body (own id)');
  assert.equal(hostile.status, 200);
  const update = hostile.calls.find((c) => c.op === 'chatSession.update');
  assert.equal(update.args.data.userId, 'user-b');
  assert.equal(update.args.data.geminiStoreId, 'victim-store');
  assert.equal(update.args.data.geminiStoreName, 'fileSearchStores/victim-store');
  assert.deepEqual(update.args.data.user, { connect: { id: 'user-b' } });
  assert.deepEqual(update.args.data.messages, { deleteMany: {} });
});

await test('flag off, every non-"true" spelling: identical to unset (sha256 over the whole matrix)', async () => {
  const reference = hashOf(offMatrix);
  for (const [label, value] of ENV_OFF_VARIANTS) {
    assert.equal(hashOf(await fullMatrix(readCurrent, value)), reference, `flag ${label}`);
  }
  console.log(`  flag-off matrix sha256 ${reference} (${offMatrix.size} cases)`);
});

await test('differential: flag off equals the routes at LEGACY_REF (sha256)', async () => {
  const ref = process.env.LEGACY_REF;
  if (!ref) {
    console.log('  skipped (set LEGACY_REF=origin/uat to compare against the pre-change routes)');
    return;
  }
  const legacy = await fullMatrix(readAtRef(ref), undefined);
  assert.equal(hashOf(offMatrix), hashOf(legacy), `flag-off output differs from ${ref}`);
  for (const [name, obs] of offMatrix) assert.deepEqual(obs, legacy.get(name), name);
  console.log(`  identical to ${ref}: ${hashOf(legacy)} (${legacy.size} cases)`);
});

await test('flag on, cleanup GET: no or wrong bearer -> 401 and no Prisma read; right bearer -> as today', () => {
  for (const name of ['cleanup.GET no header, secret set', 'cleanup.GET wrong bearer, secret set']) {
    const o = onMatrix.get(name);
    assert.equal(o.status, 401, name);
    assert.deepEqual(JSON.parse(o.body), { error: 'Unauthorized' }, name);
    assert.deepEqual(o.calls, [], `${name}: nothing read from the database`);
    assert.ok(!o.body.includes('user-b') && !o.body.includes('private-plan'), name);
    assert.ok(o.logs.every((l) => !l.includes(TEST_SECRET) && !l.includes('Bearer nope')), `${name}: no credential in logs`);
  }
  const ok = onMatrix.get('cleanup.GET right bearer, secret set');
  const was = offMatrix.get('cleanup.GET right bearer, secret set');
  assert.equal(ok.status, 200);
  assert.equal(ok.body, was.body, 'authorised response bytes identical to flag-off');
  assert.deepEqual(ok.calls, was.calls);
});

await test('flag on, cleanup GET: no CRON_SECRET configured fails closed (500), never open', () => {
  const o = onMatrix.get('cleanup.GET no header, secret unset');
  assert.equal(o.status, 500);
  assert.deepEqual(JSON.parse(o.body), { error: 'Server misconfiguration - CRON_SECRET not set' });
  assert.deepEqual(o.calls, []);
});

await test('cleanup POST is untouched by the flag', () => {
  for (const name of [
    'cleanup.POST no header, secret set',
    'cleanup.POST right bearer, secret set',
    'cleanup.POST no secret configured',
  ]) {
    assert.deepEqual(onMatrix.get(name), offMatrix.get(name), name);
  }
  assert.equal(onMatrix.get('cleanup.POST no header, secret set').status, 401);
  assert.equal(onMatrix.get('cleanup.POST right bearer, secret set').status, 200);
});

await test('checkCronBearer: exact "Bearer <secret>" only', () => {
  const S = 's3cret-value';
  assert.equal(lib.checkCronBearer(`Bearer ${S}`, S), 'ok');
  for (const bad of [null, '', S, `bearer ${S}`, `Bearer  ${S}`, `Bearer ${S} `, `Bearer ${S}x`, 'Bearer s3cret-valu', `Basic ${S}`]) {
    assert.equal(lib.checkCronBearer(bad, S), 'unauthorized', JSON.stringify(bad));
  }
  assert.equal(lib.checkCronBearer('Bearer undefined', undefined), 'misconfigured');
  assert.equal(lib.checkCronBearer('Bearer ', ''), 'misconfigured');
  assert.equal(lib.checkCronBearer(null, undefined), 'misconfigured');
});

await test('flag on, POST /api/sessions: another account\'s id -> bare 409, no row fields', () => {
  const o = onMatrix.get('sessions.POST foreign existing id');
  assert.equal(o.status, 409);
  assert.deepEqual(JSON.parse(o.body), { error: 'Session already exists' });
  for (const leaked of ['user-b', 'victim', 'fileSearchStores', 'Theirs', 'layout.example.test']) {
    assert.ok(!o.body.includes(leaked), `body must not contain ${leaked}`);
  }
  assert.ok(!o.calls.some((c) => c.op === 'chatSession.create' || c.op === 'chatSession.update'), 'nothing written');
});

await test('flag on, POST /api/sessions: owner still gets the row; new id still 201; errors unchanged', () => {
  for (const name of [
    'sessions.POST own existing id',
    'sessions.POST new id',
    'sessions.POST unauthenticated',
    'sessions.POST missing sessionId',
  ]) {
    assert.deepEqual(onMatrix.get(name), offMatrix.get(name), name);
  }
  const own = onMatrix.get('sessions.POST own existing id');
  assert.equal(own.status, 409);
  assert.equal(JSON.parse(own.body).session.id, 'own-session');
  assert.equal(JSON.parse(own.body).session.userId, 'user-a');
  assert.equal(onMatrix.get('sessions.POST new id').status, 201);
});

await test('flag on, PATCH: only allow-listed fields reach Prisma; identity, store and relation fields are dropped', () => {
  const o = onMatrix.get('sessions.PATCH hostile body (own id)');
  assert.equal(o.status, 200);
  const update = o.calls.find((c) => c.op === 'chatSession.update');
  assert.deepEqual(Object.keys(update.args.data).sort(), ['slideCount', 'stateCache', 'title', 'updatedAt']);
  assert.equal(update.args.data.title, 'renamed');
  assert.equal(update.args.data.slideCount, 2);
  assert.equal(update.args.where.id, 'own-session', 'the row addressed is still the URL id');
  // stateCache is the route's own scoped upsert: exactly three fields, never sessionId/extra
  const upsert = update.args.data.stateCache.upsert;
  assert.deepEqual(Object.keys(upsert.create).sort(), ['activeVersion', 'currentStatus', 'slideStructure']);
  assert.deepEqual(Object.keys(upsert.update).sort(), ['activeVersion', 'currentStatus', 'slideStructure']);
  const stored = JSON.parse(o.body).session;
  assert.equal(stored.userId, 'user-a', 'still owned by the caller');
  assert.equal(stored.geminiStoreId, 'own-store');
  assert.equal(stored.geminiStoreName, 'fileSearchStores/own-store');
});

await test('flag on, PATCH: auth / not-found / forbidden / bad body paths are unchanged', () => {
  for (const name of [
    'sessions.PATCH unauthenticated',
    'sessions.PATCH unknown id',
    'sessions.PATCH foreign id',
    'sessions.PATCH null body',
  ]) {
    assert.deepEqual(onMatrix.get(name), offMatrix.get(name), name);
  }
  assert.equal(onMatrix.get('sessions.PATCH unauthenticated').status, 401);
  assert.equal(onMatrix.get('sessions.PATCH unknown id').status, 404);
  assert.equal(onMatrix.get('sessions.PATCH foreign id').status, 403);
  assert.equal(onMatrix.get('sessions.PATCH null body').status, 500);
});

await test('flag on, PATCH: every real caller payload produces the same Prisma update and response as flag off', () => {
  const names = Object.keys(REAL_PATCH_PAYLOADS).map((l) => `sessions.PATCH real caller: ${l}`);
  assert.ok(names.length >= 10);
  for (const name of names) {
    const on = onMatrix.get(name);
    assert.equal(on.status, 200, name);
    assert.deepEqual(on, offMatrix.get(name), name);
    // and the update really carries the caller's fields
    const label = name.replace('sessions.PATCH real caller: ', '');
    const sent = REAL_PATCH_PAYLOADS[label];
    const data = on.calls.find((c) => c.op === 'chatSession.update').args.data;
    for (const [key, value] of Object.entries(sent)) {
      if (key === 'stateCache') assert.ok(data.stateCache?.upsert, `${name}: stateCache upsert`);
      else assert.deepEqual(data[key], value, `${name}: ${key}`);
    }
  }
});

await test('PATCH allow-list: pick helper handles hostile shapes', () => {
  const polluted = JSON.parse('{"title":"t","__proto__":{"userId":"x"},"constructor":{"a":1},"toString":"x"}');
  assert.deepEqual(lib.pickAllowedSessionUpdates(polluted), { title: 't' });
  assert.deepEqual(lib.pickAllowedSessionUpdates({}), {});
  assert.deepEqual(lib.pickAllowedSessionUpdates({ title: undefined }), { title: undefined });
  const forbidden = [
    'id', 'userId', 'createdAt', 'updatedAt', 'firstMessageAt', 'geminiStoreName', 'geminiStoreId',
    'user', 'messages', 'stateCache', 'uploadedFiles', 'publishedDeck',
  ];
  for (const key of forbidden) assert.ok(!lib.SESSION_PATCH_ALLOWED_FIELDS.includes(key), key);
});

await test('PATCH allow-list covers every field the frontend sends and only names real ChatSession columns', () => {
  const allowed = new Set(lib.SESSION_PATCH_ALLOWED_FIELDS);

  // 1. columns exist on the model
  const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');
  const model = schema.match(/model ChatSession \{([\s\S]*?)\n\}/)[1];
  const columns = new Set(
    model.split('\n').map((l) => l.trim().match(/^([A-Za-z]\w*)\s+\w/)?.[1]).filter(Boolean),
  );
  for (const field of allowed) assert.ok(columns.has(field), `${field} is not a ChatSession column`);

  // 2. the typed surface of updateMetadata (hooks/use-session-persistence.ts)
  const persistence = readCurrent('hooks/use-session-persistence.ts');
  const typeBlock = persistence.match(/const updateMetadata = useCallback\(async \(updates: \{([\s\S]*?)\n  \}\) => \{/)[1];
  const typed = [...typeBlock.matchAll(/^\s{4}(\w+)\??:/gm)].map((m) => m[1]);
  assert.ok(typed.includes('title') && typed.includes('stateCache'), 'parsed updateMetadata type');
  for (const key of typed) {
    if (key === 'stateCache') continue; // handled by the route as a scoped nested upsert
    assert.ok(allowed.has(key), `updateMetadata sends ${key}, which is not allow-listed`);
  }

  // 3. every `updates.<field> = ...` assembled in the builder before updateMetadata
  const builder = readCurrent('app/builder/page.tsx');
  const assigned = new Set([...builder.matchAll(/\bupdates\.(\w+)\s*=/g)].map((m) => m[1]));
  assert.ok(assigned.size >= 6, 'found the builder update assignments');
  for (const key of assigned) assert.ok(allowed.has(key), `builder sends ${key}, which is not allow-listed`);

  // 4. the direct PATCH bodies in the builder / session hook
  assert.ok(/currentStage: 0,\s*blankPresentationUrl: pending\.presentationUrl,\s*blankPresentationId: pending\.presentationId,\s*slideCount: pending\.summary\.slide_count,\s*lastMessageAt:/.test(builder));
  assert.ok(/body: JSON\.stringify\(\{ title: generatedTitle \}\)/.test(builder));
  const sessionHook = readCurrent('hooks/use-builder-session.ts');
  assert.ok(/normalizedSessionUrls\[recovered\.field\]/.test(sessionHook));
  for (const field of ['blankPresentationUrl', 'strawmanPreviewUrl', 'finalPresentationUrl']) {
    assert.ok(allowed.has(field));
  }
});

console.log(`\n${passed} tests passed`);
