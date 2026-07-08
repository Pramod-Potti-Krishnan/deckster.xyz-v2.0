import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

/**
 * Template Ingest reconnect-polling proxy → Director job status (C-5).
 *
 * Mirrors the /api/templates proxy pattern: storage lives in Director; this is
 * a thin authenticated proxy. The Director user_id MUST match the one the
 * builder uses on the Director WebSocket connect — the WS hook uses
 * `user?.id || user?.email` (use-deckster-websocket-v2.ts), so we derive the
 * same here server-side.
 */
const DIRECTOR_API_URL =
  process.env.DIRECTOR_API_URL || 'https://directorv33-production.up.railway.app';

async function resolveUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const uid = (session?.user as { id?: string } | undefined)?.id || session?.user?.email;
  return uid ?? null;
}

// GET /api/ingest-jobs/{jobId} → Director ingest-job status/result
export async function GET(_req: NextRequest, { params }: { params: { jobId: string } }) {
  const userId = await resolveUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const r = await fetch(
      `${DIRECTOR_API_URL}/api/users/${encodeURIComponent(userId)}/ingest-jobs/${encodeURIComponent(params.jobId)}`,
      { cache: 'no-store' },
    );
    const body = await r.json();
    return NextResponse.json(body, { status: r.status });
  } catch {
    return NextResponse.json({ error: 'director_unreachable' }, { status: 502 });
  }
}
