import { STUDIO_SESSION_HYGIENE_CSS } from '@/components/builder/studio-session-hygiene-styles'

/** The views' stylesheet, inline. Rendered by the flag-on views only. */
export function StudioSessionHygieneStyles() {
  return <style data-studio-session-hygiene="true" dangerouslySetInnerHTML={{ __html: STUDIO_SESSION_HYGIENE_CSS }} />
}
