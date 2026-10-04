import { notFound } from 'next/navigation'

/** Authentication and approval use the shared /studio middleware matcher. */
export function requireStudioLibraryAccess() {
  if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL !== 'true') notFound()
}
