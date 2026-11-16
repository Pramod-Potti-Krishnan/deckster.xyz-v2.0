import { handleSessionLinks } from '@/lib/connectors-gdrive-server'

export const dynamic = 'force-dynamic'
export const POST = (req: Request) => handleSessionLinks(req, 'POST')
export const DELETE = (req: Request) => handleSessionLinks(req, 'DELETE')
