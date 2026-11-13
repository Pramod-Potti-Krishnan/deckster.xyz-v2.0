// KNOWLEDGE: P4-15 composer half, "Add from Google Drive" in the Builder composer's attach menu + the Drive chips (DARK; needs NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED and
// NEXT_PUBLIC_STUDIO_CONNECTORS_SESSION_LINKS_ENABLED, both exact "true", plus the Knowledge entitlement). No new flag and no .env.example block. Registered with scripts/studio-later-changes.mjs (two lines).
// Every line this change adds to an EXISTING app file carries the marker GDRIVE-COMPOSER (matched as a whole token): components/builder/chat-input.tsx and app/builder/page.tsx.
// Pure insertions only: no existing line of app code is rewritten (older pins hold the base's lines in order). Strip the marked lines and each file is the base's (#608's head: c2dfebba since its refresh onto studio-v4-dev-preparation-code; first 1baf289d), byte for byte.
// Plain node, no imports, nothing read from disk or git here.

export const CONNECTORS_GDRIVE_COMPOSER_MARKER_RE = /(?<![\w-])GDRIVE-COMPOSER(?![\w-])/

export const CONNECTORS_GDRIVE_COMPOSER_FILES = [
  'components/builder/chat-input.tsx',
  'app/builder/page.tsx',
]

export const CONNECTORS_GDRIVE_COMPOSER_SCOPE_FILES = new Set([
  'app/api/connectors/gdrive/start/route.ts',
  'app/builder/page.tsx',
  'components/builder/chat-input.tsx',
  'components/builder/gdrive-composer.css',
  'components/builder/gdrive-composer.tsx',
  'hooks/use-gdrive-composer.ts',
  'lib/connectors-gdrive-composer.ts',
  'lib/connectors-gdrive-server.ts',
  'lib/gdrive-picker-loader.ts',
  'scripts/studio-connectors-gdrive-composer-strip.mjs',
  'scripts/test-studio-connectors-gdrive-composer.mjs',
  'scripts/studio-later-changes.mjs',
])

/** The file without this change's lines is the base's file. Any other file (and anything that is not a string) comes back as it was. */
export function stripConnectorsGdriveComposer(rel, text) {
  if (typeof text !== 'string' || !CONNECTORS_GDRIVE_COMPOSER_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !CONNECTORS_GDRIVE_COMPOSER_MARKER_RE.test(line)).join('\n')
}
