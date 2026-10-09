/**
 * Reload fix R2 (RUN-1 J1): a slide whose title is missing falls back to its raw backend slide_type, so the rail and the
 * viewer's thumbnail rows read "closing_slide". Behind NEXT_PUBLIC_STUDIO_HISTORY_ACTION_STATUS_ENABLED (exact 'true',
 * default off; the same flag as the history action status). Off, every title is returned unchanged. Import-free.
 */
const RAW_SLIDE_TYPE_LABELS: Record<string, string> = {
  closing_slide: 'Closing Slide',
  title_slide: 'Title Slide',
  section_divider: 'Section Divider',
}

const STUDIO_HISTORY_ACTION_STATUS_ENABLED = process.env.NEXT_PUBLIC_STUDIO_HISTORY_ACTION_STATUS_ENABLED === 'true'

/** Only the raw identifier itself is mapped. Any other string, including a title the user chose ("Hero", "Content"), is returned as is. */
export function slideTitleLabel<T>(title: T): T | string {
  if (!STUDIO_HISTORY_ACTION_STATUS_ENABLED || typeof title !== 'string') return title
  return RAW_SLIDE_TYPE_LABELS[title.trim().toLowerCase()] ?? title
}
