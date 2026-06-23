import type { SlideComposeNeedsInputResult } from './compose-helpers'

export const slideComposerNeedsInputFixture = {
  status: 'needs_input',
  questions: [
    {
      slot: 'source_materials',
      ask: 'What source material should ground this slide?',
    },
  ],
} satisfies SlideComposeNeedsInputResult
