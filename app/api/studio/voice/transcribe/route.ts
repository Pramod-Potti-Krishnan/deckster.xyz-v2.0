// W6 P4-21 voice call (FRONTEND-1): POST /api/studio/voice/transcribe. Thin: the signed-in Studio user (the same session check as the other Studio routes), then lib/server/studio-voice-router.ts decides everything
// (NEXT_PUBLIC_STUDIO_VOICE_CALL off -> 404, validation, the model-router call, the error mapping). Server-only: the router key never reaches the browser.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { handleTranscribe } from '@/lib/server/studio-voice-router'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  return handleTranscribe(request, {
    env: process.env,
    fetch: (url, init) => fetch(url, init),
    userId: async () => {
      const session = await getServerSession(authOptions)
      const user = session?.user as { id?: unknown; email?: unknown } | undefined
      return user?.email && typeof user.id === 'string' && user.id ? user.id : null
    },
    traceId: () => `trc_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
  })
}
