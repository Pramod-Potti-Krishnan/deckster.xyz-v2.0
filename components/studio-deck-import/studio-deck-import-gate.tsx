"use client"

import dynamic from "next/dynamic"

// NEXT_PUBLIC_STUDIO_DECK_IMPORT: the two server layouts (app/(app)/dashboard/layout.tsx, app/builder/layout.tsx) render these only with the flag on. The real modules (and their stylesheet) are
// loaded from here, on the client side of the boundary, so no server layout's stylesheet or script list names them: a build with the flag off or unset ships the Decks page and the Builder
// with nothing of this feature in their assets.
const Entry = dynamic(() => import("./studio-deck-import-entry").then(module => module.StudioDeckImportEntry))
const Note = dynamic(() => import("./studio-deck-import-note").then(module => module.StudioDeckImportNote), { ssr: false })

/** The "Import a PowerPoint" button above the Decks page (and the dialog it opens). */
export function StudioDeckImportEntryGate() { return <Entry /> }
/** The note over the Builder for a deck this browser imported. */
export function StudioDeckImportNoteGate() { return <Note /> }
