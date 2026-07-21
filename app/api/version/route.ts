import { NextResponse } from 'next/server'
import { BUILD_FINGERPRINT } from '@/lib/build-version'
import { DIAGRAM_CATALOG_VERSION } from '@/lib/diagram-catalog'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(
    {
      build_sha: BUILD_FINGERPRINT,
      diagram_catalog_version: DIAGRAM_CATALOG_VERSION,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
      },
    },
  )
}
