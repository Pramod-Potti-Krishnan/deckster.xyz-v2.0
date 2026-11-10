import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'
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
function directorBaseUrl(): string {
  return requireServiceUrl('Director', [{ name: 'DIRECTOR_API_URL', value: process.env.DIRECTOR_API_URL }])
}

async function resolveUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const uid = (session?.user as { id?: string } | undefined)?.id || session?.user?.email;
  return uid ?? null;
}

// GET /api/ingest-jobs/{jobId} → Director ingest-job status/result
export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const userId = await resolveUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { jobId } = await params;
  try {
    const r = await fetch(
      `${directorBaseUrl()}/api/users/${encodeURIComponent(userId)}/ingest-jobs/${encodeURIComponent(jobId)}`,
      { cache: 'no-store' },
    );
    const body = await r.json();
    return NextResponse.json(body, { status: r.status });
  } catch (error) {
    if (error instanceof ServiceUrlConfigError) return NextResponse.json({ error: error.message, code: error.code }, { status: 503 })
    return NextResponse.json({ error: 'director_unreachable' }, { status: 502 });
  }
}
