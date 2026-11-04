import { handleItemsGet, handleItemsPost } from '@/lib/connectors-gdrive-server'

export const dynamic = 'force-dynamic'
export const GET = () => handleItemsGet()
export const POST = (req: Request) => handleItemsPost(req)
