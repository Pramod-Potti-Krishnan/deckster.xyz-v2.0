import { NextResponse } from 'next/server'
import { BUILD_FINGERPRINT } from '@/lib/build-version'
import { DIAGRAM_CATALOG_VERSION } from '@/lib/diagram-catalog'
import { isWsBqClaimEnabled } from '@/lib/quota/build-quota'
import { isQuotaLiveTierEnabled } from '@/lib/quota/live-tier-flag'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(
    {
      build_sha: BUILD_FINGERPRINT,
      diagram_catalog_version: DIAGRAM_CATALOG_VERSION,
      // Runtime flag state, so a flip can be confirmed without signing in. The
      // key appears only when the flag is on: off leaves this response as it was.
      ...(isWsBqClaimEnabled() ? { ws_bq_claim_enabled: true } : {}),
      ...(isQuotaLiveTierEnabled() ? { quota_live_tier_enabled: true } : {}),
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
      },
    },
  )
}
