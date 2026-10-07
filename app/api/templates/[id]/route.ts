import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { restEntitlementHeaders } from '@/lib/director-rest-entitlement';

/** Template Builder proxy → Director CRUD for a single template. See ../route.ts. */
function directorBaseUrl(): string {
  return requireServiceUrl('Director', [{ name: 'DIRECTOR_API_URL', value: process.env.DIRECTOR_API_URL }])
}

async function resolveUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const uid = (session?.user as { id?: string } | undefined)?.id || session?.user?.email;
  return uid ?? null;
}

// GET /api/templates/{id} → full snapshot (for a preview, if needed)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const r = await fetch(
      `${directorBaseUrl()}/api/users/${encodeURIComponent(userId)}/templates/${encodeURIComponent(id)}`,
      { cache: 'no-store', headers: restEntitlementHeaders(userId, 'GET') },
    );
    const body = await r.json();
    return NextResponse.json(body, { status: r.status });
  } catch (error) {
    if (error instanceof ServiceUrlConfigError) return NextResponse.json({ error: error.message, code: error.code }, { status: 503 })
    return NextResponse.json({ error: 'director_unreachable' }, { status: 502 });
  }
}

// DELETE /api/templates/{id}
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const r = await fetch(
      `${directorBaseUrl()}/api/users/${encodeURIComponent(userId)}/templates/${encodeURIComponent(id)}`,
      { method: 'DELETE', headers: restEntitlementHeaders(userId, 'DELETE') },
    );
    const body = await r.json();
    return NextResponse.json(body, { status: r.status });
  } catch (error) {
    if (error instanceof ServiceUrlConfigError) return NextResponse.json({ error: error.message, code: error.code }, { status: 503 })
    return NextResponse.json({ error: 'director_unreachable' }, { status: 502 });
  }
}
