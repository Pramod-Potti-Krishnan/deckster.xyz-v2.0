"use client"

import dynamic from "next/dynamic"

// NEXT_PUBLIC_STUDIO_DECK_IMPORT: the Decks layout (app/(app)/dashboard/layout.tsx) renders this only with the flag on. The real module (and its stylesheet) is loaded from here, on the client side
// of the boundary, so the server layout's own stylesheet and script lists do not name them: a build with the flag off or unset ships the Decks page with nothing of this feature in its assets.
const Entry = dynamic(() => import("./studio-deck-import-entry").then(module => module.StudioDeckImportEntry))

/** The "Import a PowerPoint" button above the Decks page (and the dialog it opens). */
export function StudioDeckImportEntryGate() { return <Entry /> }
