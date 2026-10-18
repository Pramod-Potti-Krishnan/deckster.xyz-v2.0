// INT-15 / DET-12 / SB-17 (NEXT_PUBLIC_STUDIO_P2_LIBRARY_SHELL): the exact text this change adds, as [text with the change, base text] per file.
export const BASE_COMMIT = 'fbc77c0430099ec7e11a188307ee5521b6937719'
export const CHANGES = {
  'components/layout/app-header.tsx': [
    [
      `import "./studio-library-back.css"\nimport "./studio-p2-library-shell.css"\nimport { Plus } from "lucide-react"\nimport { NEW_PRESENTATION_HREF, STUDIO_P2_LIBRARY_SHELL_ENABLED as p2Shell, showsNewPresentation } from "@/lib/studio-p2-library-shell"\n`,
      `import "./studio-library-back.css"\n`,
    ],
    [
      `{libraryBack}{showsNewPresentation(p2Shell, pathname, STUDIO_LIBRARY_BACK_PATHS) && <Link data-studio-p2-new-deck="true" href={NEW_PRESENTATION_HREF}><Plus aria-hidden="true" />Presentation</Link>}</div></header>`,
      `{libraryBack}</div></header>`,
    ],
  ],
  'components/layout/studio-rail.tsx': [
    [
      `import "./studio-shell.css"\nimport { STUDIO_P2_LIBRARY_SHELL_ENABLED as p2Shell } from "@/lib/studio-p2-library-shell"\n`,
      `import "./studio-shell.css"\n`,
    ],
    [
      `    <aside data-studio-v4-rail="true" data-studio-p2-shell={p2Shell ? "true" : undefined} aria-label="Workspace navigation">`,
      `    <aside data-studio-v4-rail="true" aria-label="Workspace navigation">`,
    ],
  ],
}
export const FILES = Object.keys(CHANGES)
export function stripP2LibraryShell(rel, text) {
  return (CHANGES[rel] ?? []).reduce((out, [added, base]) => out.replace(added, () => base), text)
}
