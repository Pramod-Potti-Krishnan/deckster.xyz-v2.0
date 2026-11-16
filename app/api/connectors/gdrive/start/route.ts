import { handleStart } from '@/lib/connectors-gdrive-server'

export const dynamic = 'force-dynamic'
export const GET = (req: Request) => handleStart(req) // GDRIVE-COMPOSER: reads ?return= (the chat to come back to)
