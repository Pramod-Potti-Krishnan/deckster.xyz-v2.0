// Environment profiles the transcripts run under. The module environment is a plain object
// handed to the repo code as `process.env`; the host process environment is never read.
import { SYNTHETIC_WS_URL, SYNTHETIC_LAYOUT_URL } from './fake-env.mjs'

export const BASE_ENV = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_WS_URL: SYNTHETIC_WS_URL,
  NEXT_PUBLIC_LAYOUT_SERVICE_URL: SYNTHETIC_LAYOUT_URL,
}

export const PROFILES = {
  // Studio shell with the MDC card treatment on: the shipping Studio chat.
  studio: { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_CHAT_CLARITY: 'true', NEXT_PUBLIC_CHAT_QUESTIONS: 'true' },
  // Studio shell, structured questions off: asks render as prompt text + action buttons.
  'studio-plain': { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' },
  // Pre-Studio builder: the plain-button ask fallback branch of MessageList.
  classic: { NEXT_PUBLIC_STUDIO_V4_SHELL: 'false' },
}
