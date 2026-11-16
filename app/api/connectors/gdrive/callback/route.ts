import type { NextRequest } from 'next/server'
import { handleCallback } from '@/lib/connectors-gdrive-server'

export const dynamic = 'force-dynamic'
export const GET = (req: NextRequest) => handleCallback(req)
