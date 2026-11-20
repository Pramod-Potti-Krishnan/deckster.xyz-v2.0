// AVATAR-W5 Step A (A-1): GET /api/avatar/companions, the signed-in user's own companions (no upload). Thin: the owner comes from the SERVER session here (this route does its own check; middleware does not match /api/avatar),
// and lib/server/avatar-pack-access.ts decides everything (NEXT_PUBLIC_STUDIO_MY_COMPANIONS off, signed out -> the one 404, before the session is even read when the flag is off).
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { handleCompanions } from '@/lib/server/avatar-pack-access'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  return handleCompanions(request, {
    env: process.env,
    userId: async () => {
      const session = await getServerSession(authOptions)
      const user = session?.user as { id?: unknown } | undefined
      return typeof user?.id === 'string' && user.id ? user.id : null
    },
  })
}

export async function HEAD(request: Request) {
  return GET(request)
}

export async function POST(request: Request) {
  return GET(request)
}

export async function PUT(request: Request) {
  return GET(request)
}

export async function PATCH(request: Request) {
  return GET(request)
}

export async function DELETE(request: Request) {
  return GET(request)
}

export async function OPTIONS(request: Request) {
  return GET(request)
}
