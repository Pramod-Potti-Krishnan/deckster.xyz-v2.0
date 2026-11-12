import { FrameworkDefaultNotFound } from '@/components/framework-default-not-found'

/**
 * Unknown routes. NEXT_PUBLIC_STUDIO_SESSION_HYGIENE off: the framework's built-in 404, unchanged. The flag is tested
 * inline, around the import(), so with it off the build drops the Studio view and its stylesheets from this page's module
 * graph altogether (the 404 document then gains nothing). On: the Studio-styled page.
 */
export default async function NotFound() {
  if (process.env.NEXT_PUBLIC_STUDIO_SESSION_HYGIENE === 'true') {
    const { StudioNotFound } = await import('@/components/studio-not-found')
    return <StudioNotFound />
  }
  return <FrameworkDefaultNotFound />
}
