import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth-options"

// Force dynamic rendering to prevent static optimization
// This ensures environment variables are available at runtime, not frozen at build time
export const dynamic = 'force-dynamic'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }