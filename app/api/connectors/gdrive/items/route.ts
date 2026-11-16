import { handleItemsDelete, handleItemsGet, handleItemsPost } from '@/lib/connectors-gdrive-server'

export const dynamic = 'force-dynamic'
export const GET = () => handleItemsGet()
export const POST = (req: Request) => handleItemsPost(req)
export const DELETE = (req: Request) => handleItemsDelete(req)
