import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { unlockCookieName, verifyUnlockCookie } from '@/lib/publish/passcode';

// The Downloads service and the public Layout origin (same defaults the client
// bundle uses in lib/api/download-service.ts and lib/layout-service-client.ts).
// The URL handed to Downloads must be one Downloads can itself reach, so we use
// the PUBLIC Layout origin, not the server-only LAYOUT_SERVICE_URL.
const DOWNLOAD_SERVICE_URL =
  process.env.NEXT_PUBLIC_DOWNLOAD_SERVICE_URL || 'https://web-production-4908a.up.railway.app';
const PUBLIC_LAYOUT_BASE_URL =
  process.env.NEXT_PUBLIC_LAYOUT_SERVICE_URL || 'https://web-production-f0d13.up.railway.app';

// Auth (unlock cookie) + per-format flags are evaluated per request — never cache.
export const dynamic = 'force-dynamic';

const FORMAT_META = {
  pdf: {
    path: '/convert/pdf',
    contentType: 'application/pdf',
  },
  pptx: {
    path: '/convert/pptx',
    contentType:
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  },
} as const;

type DownloadFormat = keyof typeof FORMAT_META;

function safeFilenameBase(title: string): string {
  const base = title
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return base || 'presentation';
}

/**
 * GET /api/publish/[slug]/download/[format]  (format = pdf | pptx)
 *
 * Server-side download gate for published decks. Resolves the slug, enforces
 * the passcode (for restricted decks) and the per-format allow flag, then
 * proxies the Downloads service server-side and STREAMS the binary back. This
 * is the real enforcement point — the viewer's allowPdf/allowPptx toggles only
 * hide buttons, so a client that posts straight to Downloads would bypass them.
 *
 * RESIDUAL (ties to plan D-P8): this closes the normal/casual path — the viewer
 * never sees the Downloads endpoint and can't skip the passcode/flag checks. But
 * a viewer who extracts the iframe's snapshot URL ({layout}/p/{snapshotId}) can
 * still POST it to the public Downloads service directly. Fully closing that
 * requires tokenizing snapshot access on the Layout Service; NOT solved here.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; format: string }> }
) {
  try {
    const { slug, format } = await params;

    if (format !== 'pdf' && format !== 'pptx') {
      return NextResponse.json(
        { error: 'Unsupported download format' },
        { status: 400 }
      );
    }
    const downloadFormat = format as DownloadFormat;

    const deck = await prisma.publishedDeck.findUnique({ where: { slug } });
    if (!deck || deck.revokedAt) {
      return NextResponse.json(
        { error: 'Published deck not found' },
        { status: 404 }
      );
    }

    // Restricted decks: require a valid passcode-unlock cookie (bound to the
    // passcode hash) — the same gate the /p/[slug] page enforces before render.
    if (deck.visibility === 'restricted') {
      const cookieStore = await cookies();
      const unlockCookie = cookieStore.get(unlockCookieName(slug))?.value;
      if (!verifyUnlockCookie(slug, deck.passcodeHash ?? '', unlockCookie)) {
        return NextResponse.json(
          { error: 'This deck is passcode-protected. Unlock it first.' },
          { status: 401 }
        );
      }
    }

    // Per-format download flag — enforced here on the server, not just in the UI.
    const allowed = downloadFormat === 'pdf' ? deck.allowPdf : deck.allowPptx;
    if (!allowed) {
      return NextResponse.json(
        { error: `${downloadFormat.toUpperCase()} download is disabled for this deck` },
        { status: 403 }
      );
    }

    const presentationUrl = `${PUBLIC_LAYOUT_BASE_URL}/p/${deck.snapshotPresentationId}`;
    const slideCount = deck.slideCount > 0 ? deck.slideCount : 1;
    const meta = FORMAT_META[downloadFormat];

    // Same payload shape as lib/api/download-service.ts, sent server-side.
    const payload =
      downloadFormat === 'pdf'
        ? {
            presentation_url: presentationUrl,
            landscape: true,
            print_background: true,
            quality: 'high',
          }
        : {
            presentation_url: presentationUrl,
            slide_count: slideCount,
            aspect_ratio: '16:9',
            quality: 'high',
          };

    const upstream = await fetch(`${DOWNLOAD_SERVICE_URL}${meta.path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: meta.contentType,
      },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => '');
      console.error(
        '[Publish] Download proxy failed:',
        downloadFormat,
        upstream.status,
        detail.slice(0, 500)
      );
      return NextResponse.json(
        { error: `Failed to generate ${downloadFormat.toUpperCase()}. Please try again.` },
        { status: 502 }
      );
    }

    const filename = `${safeFilenameBase(deck.title)}_${new Date()
      .toISOString()
      .slice(0, 10)}.${downloadFormat}`;

    // Stream the binary straight through to the viewer (proxy — no buffering).
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': meta.contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error proxying published deck download:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
