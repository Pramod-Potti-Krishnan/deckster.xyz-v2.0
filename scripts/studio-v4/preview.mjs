// Local isolated UAT preview. Only explicitly allowed public flags; no inherited credentials.
import { randomBytes } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { encode } from 'next-auth/jwt';
const port = '8792';
const secret = randomBytes(32).toString('hex');
const runtime = new URL('../../.env.studio-v4-runtime/', import.meta.url);
mkdirSync(runtime, { recursive: true });
const token = await encode({ secret, token: { id: 'studio-v4-cp0-local', sub: 'studio-v4-cp0-local', name: 'CP0 Local Fixture', email: 'cp0@example.invalid', approved: true, tier: 'free' } });
writeFileSync(new URL('s0-cookie.json', runtime), JSON.stringify({ name: 'next-auth.session-token', value: token, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }), { mode: 0o600 });
const pendingToken = await encode({ secret, token: { id: 'studio-v4-pending-local', sub: 'studio-v4-pending-local', name: 'Pending Local Fixture', approved: false, tier: 'free' } });
writeFileSync(new URL('pending-cookie.json', runtime), JSON.stringify({ name: 'next-auth.session-token', value: pendingToken, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }), { mode: 0o600 });
const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG', 'SHELL'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
Object.assign(env, {
  NEXT_PUBLIC_STUDIO_V4_SHELL: process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? 'true' : 'false',
  NEXT_PUBLIC_STUDIO_V4_TOKENS: process.env.NEXT_PUBLIC_STUDIO_V4_TOKENS === 'true' ? 'true' : 'false',
  NEXT_PUBLIC_STUDIO_V4_LABELS: process.env.NEXT_PUBLIC_STUDIO_V4_LABELS === 'true' ? 'true' : 'false',
  NEXT_PUBLIC_STUDIO_V4_TYPE: process.env.NEXT_PUBLIC_STUDIO_V4_TYPE === 'true' ? 'true' : 'false',
  NEXT_PUBLIC_CHAT_MENTIONS: process.env.NEXT_PUBLIC_CHAT_MENTIONS === 'true' ? 'true' : 'false',
  NEXT_PUBLIC_TEMPLATE_BUILDER_ENABLED: process.env.NEXT_PUBLIC_TEMPLATE_BUILDER_ENABLED === 'true' ? 'true' : 'false',
  NEXT_PUBLIC_DECK_IDENTITY_ENABLED: process.env.NEXT_PUBLIC_DECK_IDENTITY_ENABLED === 'true' ? 'true' : 'false',
  NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED: process.env.NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED === 'true' ? 'true' : 'false',
  NEXT_PUBLIC_COMPOSER_STAGE1B_NEW_TOPIC_ENABLED: process.env.NEXT_PUBLIC_COMPOSER_STAGE1B_NEW_TOPIC_ENABLED === 'true' ? 'true' : 'false',
  NEXT_PUBLIC_COUPON_AUTH_ENABLED: process.env.NEXT_PUBLIC_COUPON_AUTH_ENABLED === 'true' ? 'true' : 'false',
  NEXT_PUBLIC_BUILD_NARRATION: process.env.NEXT_PUBLIC_BUILD_NARRATION === 'true' ? 'true' : 'false',
  NEXT_PUBLIC_USE_TEXTLABS_GENERATION: process.env.NEXT_PUBLIC_USE_TEXTLABS_GENERATION === 'false' ? 'false' : 'true',
  NEXT_PUBLIC_BLUEPRINT_EDITOR_V2: process.env.NEXT_PUBLIC_BLUEPRINT_EDITOR_V2 === 'true' ? 'true' : 'false',
  NEXT_PUBLIC_TEMPLATE_INGEST_ENABLED: process.env.NEXT_PUBLIC_TEMPLATE_INGEST_ENABLED === 'true' ? 'true' : 'false',
  NEXT_PUBLIC_CHAT_QUESTIONS: process.env.NEXT_PUBLIC_CHAT_QUESTIONS === 'true' ? 'true' : 'false',
  NEXT_PUBLIC_CHAT_CLARITY: process.env.NEXT_PUBLIC_CHAT_CLARITY === 'true' ? 'true' : 'false',
  NEXT_PUBLIC_SLIDE_COMPOSER_ENABLED: process.env.NEXT_PUBLIC_SLIDE_COMPOSER_ENABLED === 'true' ? 'true' : 'false',
  NEXT_PUBLIC_SLIDE_REFINER_ENABLED: process.env.NEXT_PUBLIC_SLIDE_REFINER_ENABLED === 'true' ? 'true' : 'false',
  NEXTAUTH_SECRET: secret, NEXTAUTH_URL: `http://127.0.0.1:${port}`, NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
  NEXT_PUBLIC_LAYOUT_SERVICE_URL: 'https://layout-builder-v75-uat.up.railway.app',
  LAYOUT_SERVICE_URL: 'https://layout-builder-v75-uat.up.railway.app',
  NEXT_PUBLIC_ELEMENTOR_URL: 'https://web-uat-19a9.up.railway.app',
  NEXT_PUBLIC_DOWNLOAD_SERVICE_URL: 'https://web-uat-1d12.up.railway.app',
  NEXT_PUBLIC_WS_URL: 'wss://directorv40-uat.up.railway.app/ws',
  NEXT_PUBLIC_KNOWLEDGE_SERVICE_URL: 'https://researcher-v11-uat.up.railway.app',
  KNOWLEDGE_SERVICE_URL: 'https://researcher-v11-uat.up.railway.app',
  RESEARCHER_SERVICE_URL: 'https://researcher-v11-uat.up.railway.app',
  NEXT_PUBLIC_THEME_BUILDER_URL: 'https://themebuilderv10-uat.up.railway.app',
  NEXT_PUBLIC_API_URL: 'https://directorv40-uat.up.railway.app',
  NEXT_PUBLIC_DIRECTOR_API_URL: 'https://directorv40-uat.up.railway.app',
  DIRECTOR_API_URL: 'https://directorv40-uat.up.railway.app',
  SLIDE_COMPOSER_DIRECTOR_URL: 'https://directorv40-uat.up.railway.app',
  COMPOSER_DIRECTOR_URL: 'https://directorv40-uat.up.railway.app',
});
writeFileSync(new URL('preview-config.json', runtime), JSON.stringify({ port, shell: env.NEXT_PUBLIC_STUDIO_V4_SHELL, tokens: env.NEXT_PUBLIC_STUDIO_V4_TOKENS, type: env.NEXT_PUBLIC_STUDIO_V4_TYPE, labels: env.NEXT_PUBLIC_STUDIO_V4_LABELS, mentions: env.NEXT_PUBLIC_CHAT_MENTIONS }, null, 2));
writeFileSync(new URL('preview-features.json', runtime), JSON.stringify({ couponAuth: env.NEXT_PUBLIC_COUPON_AUTH_ENABLED, buildNarration: env.NEXT_PUBLIC_BUILD_NARRATION, useTextLabsGeneration: env.NEXT_PUBLIC_USE_TEXTLABS_GENERATION, slideComposer: env.NEXT_PUBLIC_SLIDE_COMPOSER_ENABLED, templateBuilder: env.NEXT_PUBLIC_TEMPLATE_BUILDER_ENABLED, deckIdentity: env.NEXT_PUBLIC_DECK_IDENTITY_ENABLED, composerLibrary: env.NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED, composerNewTopic: env.NEXT_PUBLIC_COMPOSER_STAGE1B_NEW_TOPIC_ENABLED, blueprintEditorV2: env.NEXT_PUBLIC_BLUEPRINT_EDITOR_V2, slideRefiner: env.NEXT_PUBLIC_SLIDE_REFINER_ENABLED, templateIngest: env.NEXT_PUBLIC_TEMPLATE_INGEST_ENABLED, chatQuestions: env.NEXT_PUBLIC_CHAT_QUESTIONS, chatClarity: env.NEXT_PUBLIC_CHAT_CLARITY }, null, 2));
console.log(`Isolated UAT frontend (tokens=${env.NEXT_PUBLIC_STUDIO_V4_TOKENS}, type=${env.NEXT_PUBLIC_STUDIO_V4_TYPE}, labels=${env.NEXT_PUBLIC_STUDIO_V4_LABELS}, mentions=${env.NEXT_PUBLIC_CHAT_MENTIONS}): http://127.0.0.1:${port}/builder (use capture.py for the intercepted fixture; no database credentials).`);
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', port], { env, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 0));
