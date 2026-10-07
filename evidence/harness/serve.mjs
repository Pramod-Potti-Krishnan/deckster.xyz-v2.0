// Local isolated Studio dev server for the J2 harness. Run from the worktree root:
//   node evidence/harness/serve.mjs <port> <layoutOrigin> <runtimeDir> [--prod] [KEY=value ...]
// --prod runs `next build` then `next start` (no React StrictMode double-mount, like the deployed app);
// NEXT_PUBLIC_* values are inlined at build time, so build once per flag set.
// Every service URL is local or a `.invalid` name (RFC 2606: never resolvable), so
// nothing can leave the machine. A random NEXTAUTH_SECRET signs a fixture cookie
// written under <runtimeDir> (outside the repo). No credentials are inherited.
import { randomBytes } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { encode } from 'next-auth/jwt';

const [port, layoutOrigin, runtimeDir, ...rest] = process.argv.slice(2);
const prod = rest.includes('--prod');
const overrides = rest.filter(arg => arg !== '--prod');
if (!port || !layoutOrigin || !runtimeDir) {
  console.error('usage: serve.mjs <port> <layoutOrigin> <runtimeDir> [KEY=value ...]');
  process.exit(2);
}
mkdirSync(runtimeDir, { recursive: true });
const secret = randomBytes(32).toString('hex');
const token = await encode({ secret, token: { id: 'j2-harness-local', sub: 'j2-harness-local', name: 'J2 Harness', email: 'j2@example.invalid', approved: true, tier: 'free' } });
writeFileSync(`${runtimeDir}/cookie.json`, JSON.stringify({ name: 'next-auth.session-token', value: token, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }), { mode: 0o600 });

const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG', 'SHELL'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
Object.assign(env, {
  NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_STUDIO_V4_TOKENS: 'true', NEXT_PUBLIC_STUDIO_V4_LABELS: 'true',
  NEXT_PUBLIC_SLIDE_COMPOSER_ENABLED: 'true', NEXT_PUBLIC_SLIDE_REFINER_ENABLED: 'true',
  NEXT_PUBLIC_USE_TEXTLABS_GENERATION: 'true', NEXT_PUBLIC_COUPON_AUTH_ENABLED: 'false',
  NEXTAUTH_SECRET: secret, NEXTAUTH_URL: `http://127.0.0.1:${port}`, NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
  NEXT_PUBLIC_LAYOUT_SERVICE_URL: layoutOrigin,
  LAYOUT_SERVICE_URL: layoutOrigin,
  NEXT_PUBLIC_ELEMENTOR_URL: 'https://elementor.invalid',
  NEXT_PUBLIC_DOWNLOAD_SERVICE_URL: 'https://downloads.invalid',
  NEXT_PUBLIC_WS_URL: 'wss://director.invalid/ws',
  NEXT_PUBLIC_KNOWLEDGE_SERVICE_URL: 'https://knowledge.invalid',
  NEXT_PUBLIC_THEME_BUILDER_URL: 'https://themes.invalid',
  NEXT_PUBLIC_API_URL: 'https://director.invalid',
  NEXT_PUBLIC_DIRECTOR_API_URL: 'https://director.invalid',
});
for (const pair of overrides) {
  const i = pair.indexOf('=');
  if (i > 0) env[pair.slice(0, i)] = pair.slice(i + 1);
}
const j2 = Object.keys(env).filter(k => /^NEXT_PUBLIC_STUDIO_(SLIDE_COUNT|PANEL|GOTO)/.test(k)).map(k => `${k}=${env[k]}`);
console.log('J2 flags:', j2.length ? j2.join(' ') : '(none set: all three default off)');
if (prod) {
  const build = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build'], { env, stdio: 'inherit' });
  if (build.status !== 0) process.exit(build.status ?? 1);
}
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', prod ? 'start' : 'dev', '--hostname', '127.0.0.1', '--port', port], { env, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 0));
