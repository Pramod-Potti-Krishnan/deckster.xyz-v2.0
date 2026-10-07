import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { directorApiUrlOrResponse } from '@/lib/service-url-response';

async function resolveUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const uid = (session?.user as { id?: string } | undefined)?.id || session?.user?.email;
  return uid ?? null;
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const director = directorApiUrlOrResponse();
  if (director.error) return director.error;
  const DIRECTOR_API_URL = director.url;
  try {
    const r = await fetch(
      `${DIRECTOR_API_URL}/api/users/${encodeURIComponent(userId)}/templates/${encodeURIComponent(id)}/enrich`,
      { method: 'POST' },
    );
    const body = await r.json();
    return NextResponse.json(body, { status: r.status });
  } catch {
    return NextResponse.json({ error: 'director_unreachable' }, { status: 502 });
  }
}
