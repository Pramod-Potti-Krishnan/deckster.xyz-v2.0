import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

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
      { cache: 'no-store' },
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
      { method: 'DELETE' },
    );
    const body = await r.json();
    return NextResponse.json(body, { status: r.status });
  } catch (error) {
    if (error instanceof ServiceUrlConfigError) return NextResponse.json({ error: error.message, code: error.code }, { status: 503 })
    return NextResponse.json({ error: 'director_unreachable' }, { status: 502 });
  }
}

// PATCH /api/templates/{id}  body { name }  → Director PATCH /api/users/{uid}/templates/{id}  (rename)
// Behind NEXT_PUBLIC_STUDIO_TEMPLATE_LIBRARY_MANAGE (exact "true", default off): off, it answers 404 before it reads the session or calls Director. Only { name } is forwarded; Director's own answer
// (200 the row, 404 not found, 405 while its rename flag is off, 409 a name already used, 422 a refused name) goes back with its status.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_LIBRARY_MANAGE !== 'true') return NextResponse.json({ error: 'template_rename_not_enabled' }, { status: 404 });
  const userId = await resolveUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const name = payload && typeof payload === 'object' ? (payload as { name?: unknown }).name : undefined;
  try {
    const r = await fetch(
      `${directorBaseUrl()}/api/users/${encodeURIComponent(userId)}/templates/${encodeURIComponent(id)}`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) },
    );
    const body = await r.json().catch(() => ({}));
    return NextResponse.json(body, { status: r.status });
  } catch (error) {
    if (error instanceof ServiceUrlConfigError) return NextResponse.json({ error: error.message, code: error.code }, { status: 503 })
    return NextResponse.json({ error: 'director_unreachable' }, { status: 502 });
  }
}
