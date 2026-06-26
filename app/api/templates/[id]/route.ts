import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

/** Template Builder proxy → Director CRUD for a single template. See ../route.ts. */
const DIRECTOR_API_URL =
  process.env.DIRECTOR_API_URL || 'https://directorv33-production.up.railway.app';

async function resolveUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const uid = (session?.user as { id?: string } | undefined)?.id || session?.user?.email;
  return uid ?? null;
}

// GET /api/templates/{id} → full snapshot (for a preview, if needed)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await resolveUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const r = await fetch(
      `${DIRECTOR_API_URL}/api/users/${encodeURIComponent(userId)}/templates/${encodeURIComponent(params.id)}`,
      { cache: 'no-store' },
    );
    const body = await r.json();
    return NextResponse.json(body, { status: r.status });
  } catch {
    return NextResponse.json({ error: 'director_unreachable' }, { status: 502 });
  }
}

// DELETE /api/templates/{id}
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await resolveUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const r = await fetch(
      `${DIRECTOR_API_URL}/api/users/${encodeURIComponent(userId)}/templates/${encodeURIComponent(params.id)}`,
      { method: 'DELETE' },
    );
    const body = await r.json();
    return NextResponse.json(body, { status: r.status });
  } catch {
    return NextResponse.json({ error: 'director_unreachable' }, { status: 502 });
  }
}
