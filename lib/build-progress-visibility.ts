interface BuildProgressVisibilityInput {
  isGeneratingFinal: boolean
  hasVisibleThinkingStream: boolean
  currentStatus?: {
    status?: string
  } | null
}

export function shouldShowBuildWorkingPulse({
  isGeneratingFinal,
  hasVisibleThinkingStream,
  currentStatus,
}: BuildProgressVisibilityInput): boolean {
  if (hasVisibleThinkingStream) return false
  if (isGeneratingFinal) return true
  return currentStatus?.status === 'thinking' || currentStatus?.status === 'generating'
}
