import type { SlideComposeNeedsInputResult } from './index'

export const slideComposerNeedsInputFixture = {
  status: 'needs_input',
  questions: [
    {
      slot: 'source_materials',
      ask: 'What source material should ground this slide?',
    },
  ],
} satisfies SlideComposeNeedsInputResult
