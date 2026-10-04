import { requireStudioLibraryAccess } from '@/components/studio-libraries/access'
import { StudioLibraryAccountBoundary } from '@/components/studio-libraries/library-account-boundary'
import { TemplatesWorkspace } from '@/components/studio-libraries/templates-workspace'

export default async function StudioTemplatesPage() {
  requireStudioLibraryAccess()
  return <StudioLibraryAccountBoundary><TemplatesWorkspace /></StudioLibraryAccountBoundary>
}
