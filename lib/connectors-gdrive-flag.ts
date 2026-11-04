/**
 * P4-15 slice 1: the Google Drive connector flag, client-safe (no node: imports, so a "use client" page can use it).
 * Flag NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED (exact "true", default off).
 */
export function isGdriveConnectorEnabled(value: string | undefined = process.env.NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED): boolean {
  return value === 'true'
}
