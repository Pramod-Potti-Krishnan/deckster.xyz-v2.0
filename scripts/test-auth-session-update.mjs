/**
 * NextAuth `update()` must not let the browser decide approval, plan or wallet.
 *
 * Runs the REAL `jwt` callback from lib/auth-options.ts (and the real
 * lib/auth-session-update.ts) with only the external boundaries faked: Prisma,
 * the Prisma adapter, the OAuth providers and Stripe. No database, no network,
 * no real secrets.
 *
 * Properties:
 *   1. Flag unset / not exactly "true": the update branch behaves exactly as it
 *      did before the flag existed (compared against a verbatim copy of the
 *      legacy branch, over a matrix of inputs).
 *   2. Flag on: client-sent approved / tier / walletBalanceCents are ignored and
 *      the database values are used; name / image still update (with limits).
 *   3. Flag on, coupon redemption: the DB is written first, then update()
 *      yields the new tier / approval / wallet.
 *   4. Flag on is fail-closed: lookup error or missing row never falls back to
 *      a client value.
 *   5. Sign-in and plain refresh paths are untouched by the flag.
 *
 * Run: node scripts/test-auth-session-update.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';

const nodeRequire = createRequire(import.meta.url);
const root = path.join(new URL('.', import.meta.url).pathname, '..');

const FLAG = 'AUTH_SESSION_UPDATE_SERVER_READ_ENABLED';
const THROWAWAY_ENV = {
  NEXTAUTH_SECRET: 'unit-test-throwaway-secret',
  GOOGLE_CLIENT_ID: 'unit-test-client-id',
  GOOGLE_CLIENT_SECRET: 'unit-test-client-secret',
  DATABASE_URL: 'postgresql://unit-test.invalid/none',
};
const savedEnv = {};
for (const key of [FLAG, 'NEXT_PUBLIC_ENABLE_DEV_LOGIN', 'DEV_LOGIN_USER_ID', 'NODE_ENV', ...Object.keys(THROWAWAY_ENV)]) {
  savedEnv[key] = process.env[key];
}
Object.assign(process.env, THROWAWAY_ENV);
delete process.env[FLAG];

// ---------------------------------------------------------------------------
// Module loader: real modules, faked boundaries. `new Function` keeps everything
// in this realm so deepEqual / instanceof behave.
// ---------------------------------------------------------------------------
function makeMocks() {
  const state = {
    users: new Map(), // id -> { id, email, approved, tier, walletBalanceCents }
    findUniqueCalls: [],
    failNextFindUnique: false,
  };
  const prisma = {
    user: {
      async findUnique(args) {
        state.findUniqueCalls.push(args);
        if (state.failNextFindUnique) throw new Error('simulated database outage');
        const where = args.where;
        let row = null;
        if (where.id !== undefined) row = state.users.get(where.id) ?? null;
        else if (where.email !== undefined) {
          row = [...state.users.values()].find((u) => u.email === where.email) ?? null;
        }
        if (!row) return null;
        const out = {};
        for (const key of Object.keys(args.select ?? row)) out[key] = row[key];
        return out;
      },
    },
  };
  return { state, prisma };
}

function loadAuthOptions(extraEnv = {}) {
  const { state, prisma } = makeMocks();
  const cache = new Map();
  const nodeVars = {};
  for (const [k, v] of Object.entries(extraEnv)) {
    nodeVars[k] = process.env[k];
    process.env[k] = v;
  }

  const fakes = {
    'next-auth/providers/google': () => ({ id: 'google' }),
    'next-auth/providers/credentials': () => ({ id: 'credentials' }),
    '@auth/prisma-adapter': { PrismaAdapter: () => ({}) },
    './prisma': { prisma },
    '@/lib/stripe/stripe-utils': { getUserSubscription: async () => null },
  };

  function load(spec) {
    if (spec in fakes) {
      const fake = fakes[spec];
      return typeof fake === 'function' ? { default: fake, __esModule: true } : fake;
    }
    let rel;
    if (spec === './auth-session-update' || spec === '@/lib/auth-session-update') rel = 'lib/auth-session-update.ts';
    else if (spec === '@/lib/auth-options') rel = 'lib/auth-options.ts';
    else throw new Error(`unexpected import in test loader: ${spec}`);
    if (cache.has(rel)) return cache.get(rel);
    const code = ts.transpileModule(fs.readFileSync(path.join(root, rel), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    return evaluate(rel, code);
  }

  function evaluate(rel, code) {
    const mod = { exports: {} };
    cache.set(rel, mod.exports);
    new Function('module', 'exports', 'require', 'process', 'console', code)(mod, mod.exports, load, process, console);
    cache.set(rel, mod.exports);
    return mod.exports;
  }

  const authOptionsModule = load('@/lib/auth-options');
  for (const [k, v] of Object.entries(nodeVars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return {
    authOptions: authOptionsModule.authOptions,
    helper: load('./auth-session-update'),
    state,
  };
}

/** Verbatim copy of the legacy update branch (lib/auth-options.ts on uat @ ee532fa, lines 135-152). */
function legacyUpdateBranch({ token, trigger, session }) {
  if (trigger === 'update' && session) {
    if (typeof session.name === 'string') {
      token.name = session.name;
    }
    if (typeof session.image === 'string') {
      token.picture = session.image;
    }
    if (typeof session.approved === 'boolean') {
      token.approved = session.approved;
    }
    if (typeof session.walletBalanceCents === 'number') {
      token.walletBalanceCents = session.walletBalanceCents;
    }
    if (typeof session.tier === 'string') {
      token.tier = session.tier;
    }
    return token;
  }
  return token;
}

const freshToken = () => ({
  sub: 'user-1',
  id: 'user-1',
  email: 'member@example.test',
  name: 'Member',
  picture: 'https://cdn.example.test/old.png',
  tier: 'free',
  approved: false,
  walletBalanceCents: 0,
  subscription: null,
});

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

function withFlag(value, fn) {
  const previous = process.env[FLAG];
  if (value === undefined) delete process.env[FLAG];
  else process.env[FLAG] = value;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env[FLAG];
    else process.env[FLAG] = previous;
  }
}

async function runUpdate(authOptions, token, session) {
  return authOptions.callbacks.jwt({ token, trigger: 'update', session });
}

// ---------------------------------------------------------------------------
// 1. Flag off: identical to the previous behaviour
// ---------------------------------------------------------------------------

const SESSIONS = [
  undefined,
  null,
  {},
  { name: 'New Name' },
  { image: 'https://cdn.example.test/new.png' },
  { approved: true },
  { approved: 'true' },
  { tier: 'premium' },
  { tier: 42 },
  { walletBalanceCents: 999999 },
  { walletBalanceCents: '5' },
  { name: 'N', image: 'https://x.test/i.png', approved: true, tier: 'pro', walletBalanceCents: 123 },
  { email: 'other@example.test', id: 'someone-else', sub: 'someone-else', subscription: { status: 'active' } },
];

for (const flagValue of [undefined, '', 'false', '0', '1', 'TRUE', 'yes', ' true']) {
  test(`flag ${JSON.stringify(flagValue)} (not exactly "true"): update branch is identical to the legacy branch`, async () => {
    const { authOptions } = loadAuthOptions();
    await withFlag(flagValue, async () => {
      for (const session of SESSIONS) {
        const expected = legacyUpdateBranch({ token: freshToken(), trigger: 'update', session });
        const actual = await runUpdate(authOptions, freshToken(), session);
        assert.equal(JSON.stringify(actual), JSON.stringify(expected), `diverged for session ${JSON.stringify(session)}`);
      }
    });
  });
}

test('flag off: the DB is never consulted by an update()', async () => {
  const { authOptions, state } = loadAuthOptions();
  state.users.set('user-1', { id: 'user-1', email: 'member@example.test', approved: true, tier: 'pro', walletBalanceCents: 7 });
  await withFlag(undefined, () => runUpdate(authOptions, freshToken(), { tier: 'premium' }));
  assert.equal(state.findUniqueCalls.length, 0);
});

test('flag off: the legacy path is unchanged, i.e. it still copies client values (the behaviour the flag replaces)', async () => {
  const { authOptions } = loadAuthOptions();
  const token = await withFlag(undefined, () =>
    runUpdate(authOptions, freshToken(), { approved: true, tier: 'premium', walletBalanceCents: 5 }),
  );
  assert.equal(token.approved, true);
  assert.equal(token.tier, 'premium');
  assert.equal(token.walletBalanceCents, 5);
});

// ---------------------------------------------------------------------------
// 2. Flag on: client values ignored, DB values used
// ---------------------------------------------------------------------------

test('flag on: client-sent approved / tier / walletBalanceCents are ignored; DB values win', async () => {
  const { authOptions, state } = loadAuthOptions();
  state.users.set('user-1', { id: 'user-1', email: 'member@example.test', approved: false, tier: 'free', walletBalanceCents: 0 });
  const token = await withFlag('true', () =>
    runUpdate(authOptions, freshToken(), { approved: true, tier: 'premium', walletBalanceCents: 1000000 }),
  );
  assert.equal(token.approved, false);
  assert.equal(token.tier, 'free');
  assert.equal(token.walletBalanceCents, 0);
});

test('flag on: the lookup is keyed by the token user id, not by anything the client sent', async () => {
  const { authOptions, state } = loadAuthOptions();
  state.users.set('user-1', { id: 'user-1', email: 'member@example.test', approved: true, tier: 'starter', walletBalanceCents: 50 });
  state.users.set('victim', { id: 'victim', email: 'victim@example.test', approved: true, tier: 'premium', walletBalanceCents: 99999 });
  const token = await withFlag('true', () =>
    runUpdate(authOptions, freshToken(), { id: 'victim', sub: 'victim', email: 'victim@example.test', userId: 'victim' }),
  );
  assert.deepEqual(state.findUniqueCalls.map((c) => c.where), [{ id: 'user-1' }]);
  assert.equal(token.id, 'user-1');
  assert.equal(token.sub, 'user-1');
  assert.equal(token.email, 'member@example.test');
  assert.equal(token.tier, 'starter');
  assert.equal(token.walletBalanceCents, 50);
});

test('flag on: only approved / tier / walletBalanceCents are selected from the DB', async () => {
  const { authOptions, state } = loadAuthOptions();
  state.users.set('user-1', { id: 'user-1', email: 'member@example.test', approved: true, tier: 'pro', walletBalanceCents: 1 });
  await withFlag('true', () => runUpdate(authOptions, freshToken(), {}));
  assert.deepEqual(state.findUniqueCalls[0].select, { approved: true, tier: true, walletBalanceCents: true });
});

test('flag on: name and image still update from the client', async () => {
  const { authOptions, state } = loadAuthOptions();
  state.users.set('user-1', { id: 'user-1', email: 'member@example.test', approved: true, tier: 'pro', walletBalanceCents: 1 });
  const token = await withFlag('true', () =>
    runUpdate(authOptions, freshToken(), { name: '  Ada Lovelace ', image: 'https://cdn.example.test/ada.png?v=2' }),
  );
  assert.equal(token.name, 'Ada Lovelace');
  assert.equal(token.picture, 'https://cdn.example.test/ada.png?v=2');
  assert.equal(token.tier, 'pro');
});

test('flag on: name / image limits and types (over-long, empty, non-string, non-http image)', async () => {
  const { helper } = loadAuthOptions();
  const { pickClientProfileFields, SESSION_UPDATE_NAME_MAX, SESSION_UPDATE_IMAGE_MAX } = helper;
  assert.equal(SESSION_UPDATE_NAME_MAX, 80);
  assert.deepEqual(pickClientProfileFields({ name: 'x'.repeat(80) }), { name: 'x'.repeat(80) });
  assert.deepEqual(pickClientProfileFields({ name: 'x'.repeat(81) }), {});
  assert.deepEqual(pickClientProfileFields({ name: '   ' }), {});
  assert.deepEqual(pickClientProfileFields({ name: 42 }), {});
  assert.deepEqual(pickClientProfileFields({ name: { toString: () => 'x' } }), {});
  const longUrl = 'https://cdn.example.test/' + 'a'.repeat(SESSION_UPDATE_IMAGE_MAX);
  assert.deepEqual(pickClientProfileFields({ image: longUrl }), {});
  assert.deepEqual(pickClientProfileFields({ image: 'data:image/png;base64,AAAA' }), {});
  assert.deepEqual(pickClientProfileFields({ image: 'javascript:alert(1)' }), {});
  assert.deepEqual(pickClientProfileFields({ image: '/relative.png' }), {});
  assert.deepEqual(pickClientProfileFields({ image: '' }), {});
  assert.deepEqual(pickClientProfileFields({ image: 7 }), {});
  assert.deepEqual(pickClientProfileFields({ image: 'http://cdn.example.test/a.png' }), { image: 'http://cdn.example.test/a.png' });
  assert.deepEqual(pickClientProfileFields(undefined), {});
  assert.deepEqual(pickClientProfileFields('string'), {});
  assert.deepEqual(pickClientProfileFields([1, 2]), {});
});

test('flag on: rejected name / image leave the token values alone', async () => {
  const { authOptions, state } = loadAuthOptions();
  state.users.set('user-1', { id: 'user-1', email: 'member@example.test', approved: false, tier: 'free', walletBalanceCents: 0 });
  const token = await withFlag('true', () =>
    runUpdate(authOptions, freshToken(), { name: 'x'.repeat(500), image: 'data:text/html,hi' }),
  );
  assert.equal(token.name, 'Member');
  assert.equal(token.picture, 'https://cdn.example.test/old.png');
});

// ---------------------------------------------------------------------------
// 3. Coupon redemption: DB first, then update()
// ---------------------------------------------------------------------------

test('flag on: redeem flow (coupon writes the DB, then update()) yields the new tier, approval and wallet', async () => {
  const { authOptions, state } = loadAuthOptions();
  const row = { id: 'user-1', email: 'member@example.test', approved: false, tier: 'free', walletBalanceCents: 0 };
  state.users.set('user-1', row);

  // The /api/coupons/redeem transaction commits first...
  Object.assign(row, { approved: true, tier: 'pro', walletBalanceCents: 2500 });

  // ...then app/(auth)/redeem/page.tsx calls update({ approved, walletBalanceCents, tier }).
  const token = await withFlag('true', () =>
    runUpdate(authOptions, freshToken(), { approved: true, walletBalanceCents: 2500, tier: 'pro' }),
  );
  assert.equal(token.approved, true);
  assert.equal(token.tier, 'pro');
  assert.equal(token.walletBalanceCents, 2500);
});

test('flag on: a plain update() with no argument also pulls fresh DB values (pending-page "check status")', async () => {
  const { authOptions, state } = loadAuthOptions();
  state.users.set('user-1', { id: 'user-1', email: 'member@example.test', approved: true, tier: 'starter', walletBalanceCents: 10 });
  const token = await withFlag('true', () => runUpdate(authOptions, freshToken(), undefined));
  assert.equal(token.approved, true);
  assert.equal(token.tier, 'starter');
  assert.equal(token.walletBalanceCents, 10);
});

test('flag on: DB values are normalised like the sign-in branch (null tier -> free, null wallet -> 0)', async () => {
  const { authOptions, state } = loadAuthOptions();
  state.users.set('user-1', { id: 'user-1', email: 'member@example.test', approved: null, tier: null, walletBalanceCents: null });
  const token = await withFlag('true', () => runUpdate(authOptions, { ...freshToken(), approved: true, tier: 'pro', walletBalanceCents: 9 }, {}));
  assert.equal(token.approved, false);
  assert.equal(token.tier, 'free');
  assert.equal(token.walletBalanceCents, 0);
});

test('flag on: a downgrade in the DB is picked up too (the re-read is authoritative, not additive)', async () => {
  const { authOptions, state } = loadAuthOptions();
  state.users.set('user-1', { id: 'user-1', email: 'member@example.test', approved: true, tier: 'free', walletBalanceCents: 0 });
  const token = await withFlag('true', () =>
    runUpdate(authOptions, { ...freshToken(), approved: true, tier: 'premium', walletBalanceCents: 5000 }, undefined),
  );
  assert.equal(token.tier, 'free');
  assert.equal(token.walletBalanceCents, 0);
});

// ---------------------------------------------------------------------------
// 4. Fail-closed
// ---------------------------------------------------------------------------

test('flag on: a lookup error keeps the existing claims and ignores the client values', async () => {
  const { authOptions, state } = loadAuthOptions();
  state.failNextFindUnique = true;
  const original = console.error;
  console.error = () => {};
  let token;
  try {
    token = await withFlag('true', () =>
      runUpdate(authOptions, freshToken(), { approved: true, tier: 'premium', walletBalanceCents: 1e6, name: 'Still Updates' }),
    );
  } finally {
    console.error = original;
  }
  assert.equal(token.approved, false);
  assert.equal(token.tier, 'free');
  assert.equal(token.walletBalanceCents, 0);
  assert.equal(token.name, 'Still Updates');
});

test('flag on: a missing user row keeps the existing claims and ignores the client values', async () => {
  const { authOptions } = loadAuthOptions();
  const token = await withFlag('true', () =>
    runUpdate(authOptions, freshToken(), { approved: true, tier: 'premium', walletBalanceCents: 1e6 }),
  );
  assert.equal(token.approved, false);
  assert.equal(token.tier, 'free');
  assert.equal(token.walletBalanceCents, 0);
});

test('flag on: a token with no user id does no lookup and ignores the client values', async () => {
  const { authOptions, state } = loadAuthOptions();
  const t = freshToken();
  delete t.id;
  delete t.sub;
  const token = await withFlag('true', () => runUpdate(authOptions, t, { approved: true, tier: 'premium' }));
  assert.equal(state.findUniqueCalls.length, 0);
  assert.equal(token.approved, false);
  assert.equal(token.tier, 'free');
});

test('flag on: falls back to token.sub when token.id is absent', async () => {
  const { authOptions, state } = loadAuthOptions();
  state.users.set('user-1', { id: 'user-1', email: 'member@example.test', approved: true, tier: 'pro', walletBalanceCents: 3 });
  const t = freshToken();
  delete t.id;
  const token = await withFlag('true', () => runUpdate(authOptions, t, {}));
  assert.deepEqual(state.findUniqueCalls.map((c) => c.where), [{ id: 'user-1' }]);
  assert.equal(token.tier, 'pro');
});

test('flag on: the dev-login user (no DB row, non-production only) does no lookup', async () => {
  const { authOptions, state } = loadAuthOptions({ NEXT_PUBLIC_ENABLE_DEV_LOGIN: 'true', NODE_ENV: 'test' });
  const t = { ...freshToken(), id: 'uat-tpl-user', sub: 'uat-tpl-user', approved: true };
  const token = await withFlag('true', () => runUpdate(authOptions, t, { approved: false, tier: 'premium', name: 'Dev' }));
  assert.equal(state.findUniqueCalls.length, 0);
  assert.equal(token.approved, true);
  assert.equal(token.tier, 'free');
  assert.equal(token.name, 'Dev');
});

// ---------------------------------------------------------------------------
// 5. Other jwt paths unaffected by the flag
// ---------------------------------------------------------------------------

for (const flagValue of [undefined, 'true']) {
  test(`flag ${JSON.stringify(flagValue)}: a plain session read (no trigger) returns the token untouched and does no lookup`, async () => {
    const { authOptions, state } = loadAuthOptions();
    state.users.set('user-1', { id: 'user-1', email: 'member@example.test', approved: true, tier: 'premium', walletBalanceCents: 1 });
    const before = JSON.stringify(freshToken());
    const out = await withFlag(flagValue, () => authOptions.callbacks.jwt({ token: freshToken(), session: { tier: 'premium' } }));
    assert.equal(JSON.stringify(out), before);
    assert.equal(state.findUniqueCalls.length, 0);
  });

  test(`flag ${JSON.stringify(flagValue)}: the sign-in branch still seeds the token from the DB`, async () => {
    const { authOptions, state } = loadAuthOptions();
    state.users.set('user-1', { id: 'user-1', email: 'member@example.test', approved: true, tier: 'pro', walletBalanceCents: 77 });
    const out = await withFlag(flagValue, () =>
      authOptions.callbacks.jwt({
        token: { sub: 'user-1', email: 'member@example.test' },
        user: { id: 'user-1', email: 'member@example.test' },
        account: { provider: 'google' },
        trigger: 'signIn',
      }),
    );
    assert.equal(out.id, 'user-1');
    assert.equal(out.approved, true);
    assert.equal(out.tier, 'pro');
    assert.equal(out.walletBalanceCents, 77);
    assert.deepEqual(state.findUniqueCalls[0].where, { email: 'member@example.test' });
  });
}

test('the flag is read at call time, not at module load', async () => {
  const { authOptions, state } = loadAuthOptions();
  state.users.set('user-1', { id: 'user-1', email: 'member@example.test', approved: false, tier: 'free', walletBalanceCents: 0 });
  const off = await withFlag(undefined, () => runUpdate(authOptions, freshToken(), { tier: 'premium' }));
  assert.equal(off.tier, 'premium');
  const on = await withFlag('true', () => runUpdate(authOptions, freshToken(), { tier: 'premium' }));
  assert.equal(on.tier, 'free');
});

test('the session callback only mirrors what is on the token (no client field reaches it)', async () => {
  const { authOptions } = loadAuthOptions();
  const out = await authOptions.callbacks.session({
    session: { user: { name: 'n' } },
    token: { id: 'user-1', tier: 'pro', approved: true, walletBalanceCents: 4, subscription: null },
  });
  assert.equal(out.user.tier, 'pro');
  assert.equal(out.user.approved, true);
  assert.equal(out.user.walletBalanceCents, 4);
});

test('the legacy update branch in lib/auth-options.ts is still present verbatim (flag off must stay byte-identical)', () => {
  const src = fs.readFileSync(path.join(root, 'lib/auth-options.ts'), 'utf8');
  const legacy = [
    '        // Client-initiated session update (e.g. after a profile edit).',
    '        // Refresh the mutable fields on the token without a full re-login.',
    '        if (trigger === "update" && session) {',
    '          if (typeof session.name === "string") {',
    '            token.name = session.name',
    '          }',
    '          if (typeof session.image === "string") {',
    '            token.picture = session.image',
    '          }',
    '          if (typeof session.approved === "boolean") {',
    '            token.approved = session.approved',
    '          }',
    '          if (typeof session.walletBalanceCents === "number") {',
    '            token.walletBalanceCents = session.walletBalanceCents',
    '          }',
    '          if (typeof session.tier === "string") {',
    '            token.tier = session.tier',
    '          }',
    '          return token',
    '        }',
  ].join('\n');
  assert.ok(src.includes(legacy), 'the legacy update branch was edited; flag-off behaviour may have changed');
});

// ---------------------------------------------------------------------------
let failed = 0;
for (const [name, fn] of tests) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  ✗ ${name}\n    ${error.message}`);
  }
}
for (const [key, value] of Object.entries(savedEnv)) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
