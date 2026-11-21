// FRONTEND-1 (wave 1 step 0.9-S): the composer's file picker offers only what the Researcher reads today. Flags NEXT_PUBLIC_STUDIO_UPLOAD_FORMATS_NARROW and NEXT_PUBLIC_STUDIO_UPLOAD_TEXT_FORMATS (each the exact "true", default off, build-time).
// NARROW on (and the Studio shell on, which the composer checks): the picker's `accept` is the document and image lists below, and a file dropped on the composer that is not on the same list is left out. Off, the picker and the drop are what they were.
// TEXT_FORMATS acts only with NARROW on: it adds the data and source formats the Researcher reads only with its own text-formats switch (turn this one on only after that switch is on, in the same environment).
// Pure: the picker's accept string and the drop's check are built from the SAME lists below, so they cannot drift apart. The flags are read once, from literal env names (Next inlines only literal reads).

/** What the Researcher reads today: documents, spreadsheets, a presentation and text (no .doc, .xls or .ppt: it does not read them). */
export const UPLOAD_DOCUMENT_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md', '.xlsx', '.csv', '.pptx'] as const
/** Images. */
export const UPLOAD_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'] as const
/** Data and source files: read by the Researcher only with its own text-formats switch on. */
export const UPLOAD_TEXT_EXTENSIONS = ['.json', '.xml', '.yaml', '.yml', '.py', '.js', '.ts', '.java', '.go', '.rs'] as const

/** The extensions the narrowed picker and drop take: the documents, the images, and with `textFormats` the data and source files too. */
export const uploadExtensions = (textFormats: boolean): readonly string[] => [...UPLOAD_DOCUMENT_EXTENSIONS, ...UPLOAD_IMAGE_EXTENSIONS, ...(textFormats ? UPLOAD_TEXT_EXTENSIONS : [])]

/** The narrowed `accept` string, or undefined when the narrow flag is off (then the base's picker stands). The text flag does nothing alone. */
export const uploadAccept = (narrow: boolean, text: boolean): string | undefined => (narrow ? uploadExtensions(text).join(',') : undefined)

export const STUDIO_UPLOAD_FORMATS_NARROW: boolean = process.env.NEXT_PUBLIC_STUDIO_UPLOAD_FORMATS_NARROW === 'true'
export const STUDIO_UPLOAD_TEXT_FORMATS: boolean = process.env.NEXT_PUBLIC_STUDIO_UPLOAD_TEXT_FORMATS === 'true'
/** What the composer's picker gets (and what its drop is held to): the narrowed accept string, or undefined with the narrow flag off. */
export const STUDIO_UPLOAD_ACCEPT: string | undefined = uploadAccept(STUDIO_UPLOAD_FORMATS_NARROW, STUDIO_UPLOAD_TEXT_FORMATS)

/** Whether a file name is on the narrowed list: its ending (the last extension only, case-insensitive) is one of the list's extensions, as a browser matches `accept`. The caller applies it only when STUDIO_UPLOAD_ACCEPT is set (the narrow flag on). */
export const acceptsUploadFile = (name: string, textFormats: boolean = STUDIO_UPLOAD_TEXT_FORMATS): boolean => {
  const lower = typeof name === 'string' ? name.toLowerCase() : ''
  return uploadExtensions(textFormats).some(extension => lower.endsWith(extension))
}
