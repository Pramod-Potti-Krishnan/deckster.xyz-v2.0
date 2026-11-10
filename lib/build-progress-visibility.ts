interface BuildProgressVisibilityInput {
  isGeneratingFinal: boolean
  hasVisibleThinkingStream: boolean
  currentStatus?: {
    status?: string
  } | null
  // Build Narration (D5): when the narration canvas + DirectorPresence own the
  // "something is building" surface, chat never shows the working pulse.
  narrationOwnsChat?: boolean
}

export function shouldShowBuildWorkingPulse({
  isGeneratingFinal,
  hasVisibleThinkingStream,
  currentStatus,
  narrationOwnsChat,
}: BuildProgressVisibilityInput): boolean {
  if (narrationOwnsChat) return false
  if (hasVisibleThinkingStream) return false
  if (isGeneratingFinal) return true
  return currentStatus?.status === 'thinking' || currentStatus?.status === 'generating'
}
