// PASS2 ONBOARDING (flag NEXT_PUBLIC_STUDIO_P2_ONBOARDING, default off). Import-free: the words, the five steps, the choices, the one rule for "may continue", the example prompts the last step
// offers, the recap of the answers and where the last button goes.
//
// What the page does with an answer (the page has no network call and stores nothing, in the browser or on the account):
//   use case        -> the example prompts the starting-point step lists under "Create from scratch" (the lists the page has always had; "2025" is now "next year")
//   starting point  -> where the last button goes: Studio (/builder) or the template library in the Studio shell (/studio/templates; the marketing gallery at /templates has the public header)
//   role, team size -> nothing. They are only repeated in the recap, so no sentence on the page says they personalize anything.
// The words therefore promise nothing the page does not do: the old "Profile personalized", "AI agents ready to collaborate", "Enterprise features available: ... SSO ..." and "Recommended for you"
// (shown on whichever card was chosen) are gone, and the welcome step no longer says "just 4 quick steps" above "Step 1 of 5".

export type StudioOnboardingKey = 'useCase' | 'role' | 'team' | 'start'
export type StudioOnboardingAnswers = Record<StudioOnboardingKey, string>
export interface StudioOnboardingChoice { id: string; label: string; description?: string }
export interface StudioOnboardingStep { id: 'welcome' | StudioOnboardingKey; chapter: string; title: string; description: string }

export const STUDIO_ONBOARDING_EMPTY: StudioOnboardingAnswers = { useCase: '', role: '', team: '', start: '' }

export const STUDIO_ONBOARDING_STEPS: readonly StudioOnboardingStep[] = [
  { id: 'welcome', chapter: 'Welcome', title: 'Welcome to Deckster.', description: 'Four quick questions, then you are in Studio.' },
  { id: 'useCase', chapter: 'Use', title: 'What will you use Deckster for?', description: 'Pick the kind of deck you make most.' },
  { id: 'role', chapter: 'Role', title: 'What is your role?', description: 'Pick the one closest to your work.' },
  { id: 'team', chapter: 'Team', title: 'How big is your team?', description: 'Pick the size that fits.' },
  { id: 'start', chapter: 'Start', title: 'Choose your starting point.', description: 'Where would you like to begin?' },
]

export const STUDIO_ONBOARDING_USE_CASES: readonly StudioOnboardingChoice[] = [
  { id: 'sales', label: 'Sales Pitches', description: 'Win more deals with compelling pitch decks' },
  { id: 'marketing', label: 'Marketing Decks', description: 'Showcase campaigns and results' },
  { id: 'education', label: 'Educational Content', description: 'Teach and train effectively' },
  { id: 'business', label: 'Business Reports', description: 'Present data and insights' },
  { id: 'creative', label: 'Creative Projects', description: 'Portfolios and showcases' },
  { id: 'startup', label: 'Startup Pitches', description: 'Fundraising and investor decks' },
]

export const STUDIO_ONBOARDING_ROLES: readonly StudioOnboardingChoice[] = [
  { id: 'marketer', label: 'Marketer' },
  { id: 'sales', label: 'Sales Professional' },
  { id: 'educator', label: 'Educator' },
  { id: 'founder', label: 'Founder/Entrepreneur' },
  { id: 'designer', label: 'Designer' },
  { id: 'consultant', label: 'Consultant' },
  { id: 'student', label: 'Student' },
  { id: 'other', label: 'Other' },
]

export const STUDIO_ONBOARDING_TEAM_SIZES: readonly StudioOnboardingChoice[] = [
  { id: 'solo', label: 'Just me', description: 'Individual creator' },
  { id: 'small', label: '2-10 people', description: 'Small team' },
  { id: 'medium', label: '11-50 people', description: 'Growing organization' },
  { id: 'large', label: '50+ people', description: 'Enterprise team' },
]

export const STUDIO_ONBOARDING_STARTS: readonly StudioOnboardingChoice[] = [
  { id: 'scratch', label: 'Create from scratch', description: 'Open Studio and describe your deck to the Director' },
  { id: 'template', label: 'Use a template', description: 'Browse the template library and start from a design' },
]

/** The three things Studio is made of, shown on the welcome step in the words the Studio introduction uses. */
export const STUDIO_ONBOARDING_WELCOME_CARDS = [
  { id: 'director', title: 'The Director', text: 'Plans the deck with you in Chat.' },
  { id: 'canvas', title: 'The canvas', text: 'Shows each slide as it is built, ready to refine.' },
  { id: 'inspector', title: 'The Inspector', text: 'Edits what you select: the deck, a slide or an element.' },
] as const

export const STUDIO_ONBOARDING_WORDS = {
  eyebrow: 'Deckster / Studio',
  eyebrowDone: 'Deckster / Studio · All set',
  chapters: 'Setup steps',
  welcomeNote: 'You can skip this at any time.',
  needChoice: 'Choose one to continue.',
  chosen: 'Selected:',
  teamLarge: 'Teams of 50 or more: see the plans and pricing.',
  teamLargeLink: 'See plans',
  promptsTitle: 'Prompts to try once you are in Studio',
  next: 'Continue',
  back: 'Back',
  finish: 'Finish',
  skip: 'Skip to your decks',
  doneTitle: 'You are ready.',
  doneScratch: 'Studio opens with the Director in Chat. Describe your deck to begin.',
  doneTemplate: 'The template library opens next. Pick a design to start from.',
  doneNote: 'Your answers are not saved to your account.',
  openStudio: 'Open Studio',
  openTemplates: 'Browse templates',
} as const

export const STUDIO_ONBOARDING_SKIP_HREF = '/dashboard'
export const STUDIO_ONBOARDING_PRICING_HREF = '/pricing'
const STUDIO_HREF = '/builder'
const TEMPLATES_HREF = '/studio/templates'

const PROMPTS: Record<string, readonly string[]> = {
  sales: ['Create a product pitch deck for a B2B SaaS platform', 'Build a sales proposal for enterprise clients', 'Make a customer success story presentation'],
  marketing: ['Create a Q4 marketing campaign results presentation', 'Build a social media strategy deck for next year', 'Make a brand positioning presentation'],
  education: ['Create a lecture on Introduction to Machine Learning', 'Build a training workshop on effective communication', 'Make a course overview presentation for students'],
  business: ['Create a quarterly business review for executives', 'Build a project status report with timeline', 'Make a strategic planning presentation for next year'],
  creative: ['Create a creative portfolio showcasing recent work', 'Build a design case study presentation', 'Make an agency capabilities deck'],
  startup: ['Create a Series A fundraising pitch deck', 'Build a product roadmap presentation for investors', 'Make a startup overview for potential partners'],
}
const GENERIC_PROMPTS: readonly string[] = ['Create a professional presentation about...', 'Build a compelling deck for...', 'Make an engaging presentation on...']

/** Three example prompts for a use case; any other value (nothing chosen) gets the generic three. */
export function studioOnboardingPrompts(useCase: string): readonly string[] {
  return Object.prototype.hasOwnProperty.call(PROMPTS, useCase) ? PROMPTS[useCase] : GENERIC_PROMPTS
}

/** The choices a question step offers (none for the welcome step). */
export function studioOnboardingChoices(key: StudioOnboardingKey): readonly StudioOnboardingChoice[] {
  return key === 'useCase' ? STUDIO_ONBOARDING_USE_CASES : key === 'role' ? STUDIO_ONBOARDING_ROLES : key === 'team' ? STUDIO_ONBOARDING_TEAM_SIZES : STUDIO_ONBOARDING_STARTS
}

/** The label of what was chosen for a question, '' when nothing (or something unknown) is chosen. */
export function studioOnboardingLabel(key: StudioOnboardingKey, id: string): string {
  return studioOnboardingChoices(key).find(choice => choice.id === id)?.label ?? ''
}

/** Welcome may always continue; a question step needs one of its own choices. */
export function studioOnboardingCanContinue(stepIndex: number, answers: StudioOnboardingAnswers): boolean {
  const step = STUDIO_ONBOARDING_STEPS[stepIndex]
  if (!step) return false
  if (step.id === 'welcome') return true
  return studioOnboardingLabel(step.id, answers[step.id]) !== ''
}

/** The sentence under the choices of a question step. */
export function studioOnboardingStatus(stepIndex: number, answers: StudioOnboardingAnswers): string {
  const step = STUDIO_ONBOARDING_STEPS[stepIndex]
  if (!step) return ''
  if (step.id === 'welcome') return STUDIO_ONBOARDING_WORDS.welcomeNote
  const label = studioOnboardingLabel(step.id, answers[step.id])
  return label ? `${STUDIO_ONBOARDING_WORDS.chosen} ${label}.` : STUDIO_ONBOARDING_WORDS.needChoice
}

/** Where the last button goes, and what it says. */
export function studioOnboardingDestination(start: string): { href: string; label: string; text: string } {
  return start === 'template'
    ? { href: TEMPLATES_HREF, label: STUDIO_ONBOARDING_WORDS.openTemplates, text: STUDIO_ONBOARDING_WORDS.doneTemplate }
    : { href: STUDIO_HREF, label: STUDIO_ONBOARDING_WORDS.openStudio, text: STUDIO_ONBOARDING_WORDS.doneScratch }
}

/** The answers, one row each, for the last screen. */
export function studioOnboardingRecap(answers: StudioOnboardingAnswers): { label: string; value: string }[] {
  return [
    { label: 'Use', value: studioOnboardingLabel('useCase', answers.useCase) },
    { label: 'Role', value: studioOnboardingLabel('role', answers.role) },
    { label: 'Team', value: studioOnboardingLabel('team', answers.team) },
    { label: 'Start', value: studioOnboardingLabel('start', answers.start) },
  ].filter(row => row.value)
}
