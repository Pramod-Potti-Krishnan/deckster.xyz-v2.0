import { requireStudioLibraryAccess } from '@/components/studio-libraries/access'
import { StudioLibraryAccountBoundary } from '@/components/studio-libraries/library-account-boundary'
import { ThemesWorkspace } from '@/components/studio-libraries/themes-workspace'

export default async function StudioThemesPage() {
  requireStudioLibraryAccess()
  return <StudioLibraryAccountBoundary><ThemesWorkspace /></StudioLibraryAccountBoundary>
}
