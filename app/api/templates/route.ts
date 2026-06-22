import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

/**
 * Template Builder proxy → Director CRUD (TEMPLATE_PLAN.md §5 C2).
 *
 * Storage lives in Director's Supabase (template_configs); this is a thin
 * authenticated proxy. The Director user_id MUST match the one the builder uses
 * on the Director WebSocket connect — the WS hook uses `user?.id || user?.email`
 * (use-deckster-websocket-v2.ts), so we derive the same here server-side.
 *
 * DIRECTOR_API_URL points at the Director HTTP host (local UAT: http://localhost:8000).
 */
const DIRECTOR_API_URL =
  process.env.DIRECTOR_API_URL || 'https://directorv33-production.up.railway.app';

async function resolveUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const uid = (session?.user as { id?: string } | undefined)?.id || session?.user?.email;
  return uid ?? null;
}

// GET /api/templates → the user's saved templates (picker list)
export async function GET() {
  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const r = await fetch(
      `${DIRECTOR_API_URL}/api/users/${encodeURIComponent(userId)}/templates`,
      { cache: 'no-store' },
    );
    const body = await r.json();
    return NextResponse.json(body, { status: r.status });
  } catch {
    return NextResponse.json(
      { error: 'director_unreachable', templates: [], count: 0 },
      { status: 502 },
    );
  }
}

// POST /api/templates → save the agreed deck as a template ({name, source_session_id})
export async function POST(req: NextRequest) {
  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  try {
    const r = await fetch(
      `${DIRECTOR_API_URL}/api/users/${encodeURIComponent(userId)}/templates`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    const body = await r.json();
    return NextResponse.json(body, { status: r.status });
  } catch {
    return NextResponse.json({ error: 'director_unreachable' }, { status: 502 });
  }
}
