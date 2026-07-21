import type { TextLabsBaseFormData, ThemeSourceSelection } from '@/types/textlabs'

export function resolveDraftThemeSource(
  presentationId?: string | null,
  formData?: Pick<TextLabsBaseFormData, 'useDeckTheme' | 'themeOverrides'> | null,
): ThemeSourceSelection {
  if (formData?.themeOverrides) {
    return { mode: 'another', overrides: formData.themeOverrides }
  }
  if (formData?.useDeckTheme === false) {
    return { mode: 'none', overrides: null }
  }
  if (formData?.useDeckTheme === true) {
    return { mode: presentationId ? 'deck' : 'none', overrides: null }
  }
  return { mode: presentationId ? 'deck' : 'none', overrides: null }
}
