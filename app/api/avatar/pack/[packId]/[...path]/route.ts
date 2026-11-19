// AVATAR-W5 Step A (A-1, A-2): GET /api/avatar/pack/<packId>/<path...>, one file of a PRIVATE companion pack. Thin: the owner comes from the SERVER session here (this route does its own check; middleware does not match
// /api/avatar), and lib/server/avatar-pack-access.ts decides everything: the signed-in owner of a live pack gets a 302 to a short-lived link for that one file (lib/server/avatar-pack-link.ts), everyone else, and every
// refusal reason (flag off, signed out, not the owner, unknown or erased pack, unsafe path, no such file, signer failure), gets the one identical 404.
// The Supabase client is built lazily, only when a link is actually being signed for an owner, never at module load and never with the flag off. Server-only: the service-role variable never reaches the browser.
import { createClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { handlePack } from '@/lib/server/avatar-pack-access'
import { mintPackLink, selectMinter } from '@/lib/server/avatar-pack-link'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Context = { params: Promise<{ packId: string; path: string[] }> }

type StorageClient = ReturnType<typeof createClient>
let cached: { url: string; serviceKey: string; client: StorageClient } | null = null

/** The Supabase client, built on first use (never at module load, never for anyone who is not the owner of a live pack) from the project URL and the server-side service-role variable, and kept while those do not change (the pattern of
 *  lib/supabase-storage.ts). Missing variables throw, which the minter turns into null, which is the one 404. */
function storageClient(): StorageClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('storage is not configured')
  if (!cached || cached.url !== url || cached.serviceKey !== serviceKey) cached = { url, serviceKey, client: createClient(url, serviceKey, { auth: { persistSession: false } }) }
  return cached.client
}

/** The private bucket's signer, in the one shape lib/server/avatar-pack-link.ts needs. */
const signer = {
  async createSignedUrl(bucket: string, key: string, expiresIn: number) {
    return storageClient().storage.from(bucket).createSignedUrl(key, expiresIn)
  },
}

/** Only the dev stand-in asks this (NODE_ENV development): is that committed file of public/ served by this very server? Asked of the server itself, so no file path is ever built from a request. */
async function servedHere(request: Request, relativePath: string): Promise<boolean> {
  try {
    // HEAD, so there is no body to read or cancel (cancelling the body of a request to this same server never settled under `next dev`), and a short deadline so a slow answer is just "no".
    const response = await fetch(new URL(relativePath.replace(/^public\//, '/'), request.url), { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(3000) })
    return response.ok
  } catch {
    return false
  }
}

export async function GET(request: Request, context: Context) {
  const { packId, path } = await context.params
  return handlePack(request, packId, path, {
    env: process.env,
    userId: async () => {
      const session = await getServerSession(authOptions)
      const user = session?.user as { id?: unknown } | undefined
      return typeof user?.id === 'string' && user.id ? user.id : null
    },
    // The route asks mintPackLink(owner, packId, path) for the link; in Step B the inside of that module becomes one call to the spawn service and this route does not change.
    minter: env => {
      const signerFor = selectMinter(env, { storage: signer, fileExists: relativePath => servedHere(request, relativePath) })
      return { mint: async ({ owner, packId: id, path: file, ttlSeconds }) => (await mintPackLink(owner, id, file, { minter: signerFor, ttlSeconds }))?.url ?? null }
    },
  })
}

export async function HEAD(request: Request, context: Context) {
  return GET(request, context)
}

export async function POST(request: Request, context: Context) {
  return GET(request, context)
}

export async function PUT(request: Request, context: Context) {
  return GET(request, context)
}

export async function PATCH(request: Request, context: Context) {
  return GET(request, context)
}

export async function DELETE(request: Request, context: Context) {
  return GET(request, context)
}

export async function OPTIONS(request: Request, context: Context) {
  return GET(request, context)
}
