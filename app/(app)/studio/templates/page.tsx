import { requireStudioLibraryAccess } from '@/components/studio-libraries/access'
import { StudioLibraryAccountBoundary } from '@/components/studio-libraries/library-account-boundary'
import { TemplatesWorkspace } from '@/components/studio-libraries/templates-workspace'
import { StudioTemplateWorkspaceLibrary } from '@/components/studio-template-workspace/entry'

export default async function StudioTemplatesPage() {
  requireStudioLibraryAccess()
  // PASS2-PK-FOUR item 4 (NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE, default off): uploads still locking show their progress here.
  if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE === 'true') {
    return <StudioLibraryAccountBoundary><TemplatesWorkspace /><StudioTemplateWorkspaceLibrary /></StudioLibraryAccountBoundary>
  }
  return <StudioLibraryAccountBoundary><TemplatesWorkspace /></StudioLibraryAccountBoundary>
}
