const CHAT_INPUT = 'components/builder/chat-input.tsx'

export const UPLOAD_FORMATS_SCOPE_FILES = [
  CHAT_INPUT,
  'lib/studio-upload-formats.ts',
  '.env.example',
  'scripts/studio-later-changes.mjs',
  'scripts/studio-upload-formats-strip.mjs',
  'scripts/test-studio-upload-formats.mjs',
]

export const UPLOAD_FORMATS_ENV_BLOCK = `# Studio upload picker formats. Both flags require the exact value "true" and default off.
# Enable text and source formats only after Researcher supports them in the same environment.
NEXT_PUBLIC_STUDIO_UPLOAD_FORMATS_NARROW=
NEXT_PUBLIC_STUDIO_UPLOAD_TEXT_FORMATS=
`

const PICKER_EDITS = [
  "  const uploadFormats: typeof import('@/lib/studio-upload-formats') | undefined = // STUDIO-UPLOAD-FORMATS\n"
    + "    studio && process.env.NEXT_PUBLIC_STUDIO_UPLOAD_FORMATS_NARROW === 'true' // STUDIO-UPLOAD-FORMATS\n"
    + "      ? require('@/lib/studio-upload-formats') // STUDIO-UPLOAD-FORMATS\n"
    + '      : undefined // STUDIO-UPLOAD-FORMATS\n',
  '      {...uploadFormats?.STUDIO_UPLOAD_FORMAT_PROPS} // STUDIO-UPLOAD-FORMATS\n',
]

export function stripUploadFormats(rel, text) {
  if (rel !== CHAT_INPUT || typeof text !== 'string') return text
  return PICKER_EDITS.reduce((source, line) => source.replace(line, ''), text)
}
