// FRONTEND-1 UX honesty + polish (frontend1/ux-honesty-polish, 4 Nov). Two kinds of change, one strip:
//   1. HONESTY (no flag, always on): content/docs.ts drops the Google Slides export claim and says "Deckster"; Help drops "eight specialists" and the hard-coded plan prices (points to the pricing page);
//      Billing reads every plan fact from the pricing v2 list (lib/marketing/homepage-v2-pricing.ts, PRICING_TIERS) and states none of its own; /docs/api says "API access is not open yet" and lists no endpoint;
//      Help and Docs name the create button by its current label ("New deck" / "+ Presentation"). These are rewrites, not insertions, so UX_HONESTY_EDITS holds [text now, text before] and the strip puts the
//      before-text back: an older pin that holds one of these files to an earlier commit reads it as it was. scripts/test-studio-ux-honesty.mjs holds the NEW truth.
//   2. UX-09 (flag NEXT_PUBLIC_STUDIO_PAGE_HEADINGS, the string "true", default off): one shared heading container and heading style on the Studio pages. Every line it adds to an existing file carries the
//      marker PAGE-HEADINGS (a whole token) and is a pure insertion; the strip takes those lines out.
// How the older pins reach it: registered in scripts/studio-later-changes.mjs (three lines), and scripts/studio-launch-wording-strip.mjs calls it innermost (the Help / Docs / Billing pins read through that strip).
// Plain node, nothing read from disk or git here.

export const BASE_COMMIT = '3e1ce88e' // origin/studio-v4-dev-preparation-code at the start of this change
export const PAGE_HEADINGS_FLAG = 'NEXT_PUBLIC_STUDIO_PAGE_HEADINGS'
export const PAGE_HEADINGS_MARKER_RE = /(?<![\w-])PAGE-HEADINGS(?![\w-])/

/** [text now, text before], per file: the honesty rewrites (no flag). */
export const UX_HONESTY_EDITS = {
  "app/(app)/billing/page.tsx": [
    [
      "  // UX-06 (honesty, no flag): the plan words always come from the shared plan list (PRICING_TIERS, pricing v2), so Billing never states a plan fact that list does not.\n  const plan = studioPlanForTier(PRICING_TIERS, user.tier)\n",
      "  const plan = STUDIO_P2_ACCOUNT ? studioPlanForTier(PRICING_TIERS, user.tier) : null\n"
    ],
    [
      "                    {studioBillingPriceLine(PRICING_TIERS, user.tier, subscription?.billingCycle)}\n",
      "                    {STUDIO_P2_ACCOUNT\n                      ? studioBillingPriceLine(PRICING_TIERS, user.tier, subscription?.billingCycle)\n                      : subscription\n                      ? subscription.billingCycle === \"yearly\"\n                        ? \"$290/year\"\n                        : \"$29/month\"\n                      : user.tier === \"premium\"\n                        ? \"$100/month\"\n                        : user.tier === \"pro\"\n                          ? \"$50/month\"\n                          : user.tier === \"starter\"\n                            ? \"$20/month\"\n                            : \"No charge\"}\n"
    ],
    [
      "                  )\n                ) : (\n",
      "                  )\n                ) : user.tier === \"premium\" ? (\n                  <>\n                    <Feature included text=\"Unlimited presentations\" />\n                    <Feature included text=\"All 4 AI agents\" />\n                    <Feature included text=\"Custom branding\" />\n                    <Feature included text=\"Knowledge Graph\" />\n                    <Feature included text=\"Priority generation queue\" />\n                    <Feature included text=\"Advanced analytics\" />\n                  </>\n                ) : user.tier === \"pro\" ? (\n                  <>\n                    <Feature included text=\"Unlimited presentations\" />\n                    <Feature included text=\"All 4 AI agents\" />\n                    <Feature included text=\"Custom branding\" />\n                    <Feature included text=\"Advanced analytics\" />\n                    <Feature text=\"Knowledge Graph (upgrade to Max)\" />\n                  </>\n                ) : (\n"
    ],
    [
      "                  <p data-studio-billing-free-plan=\"true\" className=\"text-sm text-muted-foreground\">\n                    No paid plan yet. The plans and what each includes are on the{\" \"}\n                    <a href=\"/pricing\" className=\"underline underline-offset-2\">pricing page</a>.\n                  </p>\n",
      "                  <>\n                    <Feature included text=\"3 presentations\" />\n                    <Feature included text=\"2 AI agents\" />\n                    <Feature text=\"Custom branding (upgrade to Pro)\" />\n                    <Feature text=\"Advanced features (upgrade to Pro)\" />\n                  </>\n"
    ],
    [
      "                {user.tier === \"pro\" && nextPlan && (\n",
      "                {user.tier === \"pro\" && (STUDIO_P2_ACCOUNT ? nextPlan : true) && (\n"
    ],
    [
      "                    {`Upgrade to ${nextPlan.name}`}\n",
      "                    {STUDIO_P2_ACCOUNT ? `Upgrade to ${nextPlan?.name}` : \"Upgrade to Enterprise\"}\n"
    ],
    [
      "                  Compare the plans and what each includes on the pricing page\n",
      "                  Upgrade to Pro for unlimited presentations and advanced features\n"
    ]
  ],
  "app/docs/api/page.tsx": [
    [
      "'use client';\n\nimport { Header, Footer } from '@/components/layout';\nimport { PageHeader } from \"@/components/marketing/PageHeader\"\nimport { Section } from \"@/components/marketing/Section\"\nimport { Lock } from \"lucide-react\"\n\n// UX honesty (no flag, FRONTEND-1 UX review): there is no public Deckster API yet (no key screen, no /v1 endpoint), so this page says so and lists no endpoints, no auth scheme and no rate limits.\nexport default function ApiDocsPage() {\n    return (\n        <div className=\"min-h-screen bg-background flex flex-col\">\n            <Header />\n            <PageHeader\n                title=\"Deckster API\"\n                subtitle=\"API access is not open yet.\"\n            />\n\n            <Section>\n                <div className=\"max-w-4xl mx-auto space-y-4\" data-studio-api-not-open=\"true\">\n                    <h2 className=\"text-2xl font-bold flex items-center gap-2\">\n                        <Lock className=\"h-6 w-6 text-muted-foreground\" />\n                        API access is not open yet\n                    </h2>\n                    <p className=\"text-muted-foreground\">\n                        There is no public API today: no API keys and no endpoints to call. Build and edit decks in the builder, and export them to PowerPoint or PDF.\n                    </p>\n                    <p className=\"text-muted-foreground\">\n                        If you need programmatic access, tell us what you would use it for at{\" \"}\n                        <a href=\"mailto:support@deckster.xyz\" className=\"underline underline-offset-2\">support@deckster.xyz</a>.\n                    </p>\n                </div>\n            </Section>\n            <Footer />\n        </div>\n    )\n}\n",
      "'use client';\n\nimport { Header, Footer } from '@/components/layout';\nimport { StudioApiNotice } from '@/components/studio-docs/studio-p2-docs-api-notice';\nimport { PageHeader } from \"@/components/marketing/PageHeader\"\nimport { Section } from \"@/components/marketing/Section\"\nimport { Card, CardContent, CardHeader, CardTitle, CardDescription } from \"@/components/ui/card\"\nimport { Badge } from \"@/components/ui/badge\"\nimport { Code, Key, Lock, Zap } from \"lucide-react\"\n\n// PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS, default off): this page documents an API that is not open yet; with the flag on a notice says so under the header, the page below it is muted, it has no \"v1.0 Beta\" badge and no Rate Limits section (there is no API to limit, and no Enterprise plan). Off: the page as it was.\nconst STUDIO_P2_DOCS = process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === 'true';\n\nexport default function ApiDocsPage() {\n    return (\n        <div className=\"min-h-screen bg-background flex flex-col\">\n            <Header />\n            {STUDIO_P2_DOCS && <StudioApiNotice />}\n            <PageHeader\n                title=\"Deckster API\"\n                subtitle=\"Build powerful presentation workflows with our API\"\n                badge={STUDIO_P2_DOCS ? undefined : { text: \"v1.0 Beta\", icon: <Zap className=\"h-3 w-3\" /> }}\n            />\n\n            <Section>\n                <div className=\"max-w-4xl mx-auto space-y-12\">\n                    {/* Authentication */}\n                    <div>\n                        <h2 className=\"text-2xl font-bold mb-4 flex items-center gap-2\">\n                            <Key className=\"h-6 w-6 text-yellow-500\" />\n                            Authentication\n                        </h2>\n                        <p className=\"text-muted-foreground mb-4\">\n                            Authenticate your requests using Bearer tokens. You can generate an API key in your dashboard settings.\n                        </p>\n                        <div className=\"bg-muted p-4 rounded-lg font-mono text-sm\">\n                            Authorization: Bearer YOUR_API_KEY\n                        </div>\n                    </div>\n\n                    {/* Endpoints */}\n                    <div>\n                        <h2 className=\"text-2xl font-bold mb-6 flex items-center gap-2\">\n                            <Code className=\"h-6 w-6 text-blue-500\" />\n                            Core Endpoints\n                        </h2>\n\n                        <div className=\"space-y-6\">\n                            <Card>\n                                <CardHeader>\n                                    <div className=\"flex items-center gap-3\">\n                                        <Badge>POST</Badge>\n                                        <code className=\"text-sm font-bold\">/v1/presentations/generate</code>\n                                    </div>\n                                </CardHeader>\n                                <CardContent>\n                                    <p className=\"text-sm text-muted-foreground mb-2\">Generate a new presentation from a prompt.</p>\n                                    <pre className=\"bg-muted p-3 rounded text-xs overflow-x-auto\">\n                                        {`{\n  \"topic\": \"Q4 Marketing Strategy\",\n  \"slides\": 10,\n  \"style\": \"professional\"\n}`}\n                                    </pre>\n                                </CardContent>\n                            </Card>\n\n                            <Card>\n                                <CardHeader>\n                                    <div className=\"flex items-center gap-3\">\n                                        <Badge variant=\"secondary\">GET</Badge>\n                                        <code className=\"text-sm font-bold\">/v1/presentations/{`{id}`}</code>\n                                    </div>\n                                </CardHeader>\n                                <CardContent>\n                                    <p className=\"text-sm text-muted-foreground\">Retrieve details of a specific presentation.</p>\n                                </CardContent>\n                            </Card>\n                        </div>\n                    </div>\n\n                    {/* Rate Limits */}\n                    {!STUDIO_P2_DOCS && (\n                        <div>\n                            <h2 className=\"text-2xl font-bold mb-4 flex items-center gap-2\">\n                                <Lock className=\"h-6 w-6 text-red-500\" />\n                                Rate Limits\n                            </h2>\n                            <p className=\"text-muted-foreground\">\n                                The API is currently rate limited to 100 requests per minute for Pro plans and 1000 requests per minute for Enterprise plans.\n                            </p>\n                        </div>\n                    )}\n                </div>\n            </Section>\n            <Footer />\n        </div>\n    )\n}\n"
    ]
  ],
  "app/help/page.tsx": [
    [
      "      answer: \"Click \\\"New deck\\\" (on some pages it reads \\\"+ Presentation\\\") from the Decks page or the builder. Then, simply describe what you want to create in the chat interface, and our AI agents will generate slides for you.\"\n",
      "      answer: \"Click the 'New Presentation' button from your dashboard or builder page. Then, simply describe what you want to create in the chat interface, and our AI agents will generate slides for you.\"\n"
    ],
    [
      "      answer: \"You talk to the Director in plain English. It plans the deck and hands each part (research, writing, charts and visuals, theme, layout) to a specialist agent, and they work together to build your presentation.\"\n",
      "      answer: \"Deckster runs as eight specialists: the Director orchestrates, while the Researcher, Analyst, Content Generator, Visualizer, Theme Builder, Slide Composer, and Element Generator each own one part of the deck. They work together to build your presentation.\"\n"
    ],
    [
      "      answer: \"Every plan includes a monthly pool of credits the agents draw on as they build. See the pricing page for the current plans and prices. Top up anytime in a busy month.\"\n",
      "      answer: \"Every plan includes a monthly pool of credits the agents draw on as they build. Starter is $20/user/mo; Pro and Max add more capability and credits. Top up anytime in a busy month.\"\n"
    ],
    [
      "      answer: \"Go to your Profile > Billing & Subscription, or see the pricing page for the current plans and prices.\"\n",
      "      answer: \"Go to your Profile > Billing & Subscription, or see the pricing page. Choose Starter ($20), Pro ($50), or Max ($100) per user / month.\"\n"
    ],
    [
      "                        <h4 className=\"font-medium\">Start a new deck</h4>\n                        <p className=\"text-sm text-muted-foreground\">Click \"New deck\" (or \"+ Presentation\") from the Decks page</p>\n",
      "                        <h4 className=\"font-medium\">Create a New Presentation</h4>\n                        <p className=\"text-sm text-muted-foreground\">Click \"New Presentation\" from your dashboard</p>\n"
    ]
  ],
  "content/docs.ts": [
    [
      "Welcome to Deckster! This guide will help you create your first AI-powered presentation in just 5 minutes.\n",
      "Welcome to deckster! This guide will help you create your first AI-powered presentation in just 5 minutes.\n"
    ],
    [
      "## Step 2: Start a New Deck\n",
      "## Step 2: Start a New Presentation\n"
    ],
    [
      "1. From the Decks page, click \"New deck\" (on some pages it reads \"+ Presentation\")\n",
      "1. From your dashboard, click \"New Presentation\"\n"
    ],
    [
      "2. Choose your format (PDF or PowerPoint)\n",
      "2. Choose your format (PDF, PowerPoint, Google Slides)\n"
    ],
    [
      "Click \"New deck\" and describe your needs in detail to the AI agents.\n",
      "Click \"New Presentation\" and describe your needs in detail to the AI agents.\n"
    ],
    [
      "Deckster uses a multi-agent AI system where specialized agents collaborate to create your presentation. Think of them as your virtual creative team.\n",
      "deckster uses a multi-agent AI system where specialized agents collaborate to create your presentation. Think of them as your virtual creative team.\n"
    ],
    [
      "Unlike black-box AI, Deckster shows you **how** agents think:\n",
      "Unlike black-box AI, deckster shows you **how** agents think:\n"
    ],
    [
      "\n### Images (PNG/JPEG)\n",
      "\n### Google Slides\n**Best for:** Cloud collaboration, Google Workspace\n\n**Features:**\n- Direct to Google Drive\n- Real-time collaboration\n- Access anywhere\n- Auto-save\n\n**How to export:**\n1. Click \"Export\" \u2192 \"Google Slides\"\n2. Connect Google account (if needed)\n3. Select Drive location\n4. Open in Google Slides\n\n### Images (PNG/JPEG)\n"
    ],
    [
      "Present directly from Deckster:\n",
      "Present directly from deckster:\n"
    ]
  ]
}

/** Existing files UX-09 adds marked lines to. */
export const PAGE_HEADINGS_FILES = ['app/(app)/layout.tsx']

/** New files (no base text to put back). */
export const UX_HONESTY_NEW_FILES = ['scripts/studio-ux-honesty-strip.mjs', 'scripts/test-studio-ux-honesty.mjs', 'lib/studio-page-headings.ts', 'components/studio-page-headings/studio-page-headings-mount.tsx', 'components/studio-page-headings/studio-page-headings.css']

/** The older proofs and strips this change teaches (one marked line each). */
export const UX_HONESTY_PIN_FILES = ['scripts/studio-launch-wording-strip.mjs', 'scripts/test-studio-p2-docs.mjs']

export const PAGE_HEADINGS_ENV_BLOCK = "# STUDIO PAGE HEADINGS (FRONTEND-1, UX-09). On only for the string \"true\" (and only with NEXT_PUBLIC_STUDIO_V4_SHELL); default off, and then nothing runs. Build-time value: change it on Vercel and redeploy.\n# On: the Studio account pages (Decks, Templates, Themes, Intelligence, Details, Settings, Billing ...) share one page container (1152 px wide, 32 px gutter; 16 px on a phone) and one page heading style (28 px, 24 px on a phone).\nNEXT_PUBLIC_STUDIO_PAGE_HEADINGS=\"false\"\n"

/** Every file this change's commits touch. */
export const UX_HONESTY_SCOPE_FILES = new Set([...Object.keys(UX_HONESTY_EDITS), ...PAGE_HEADINGS_FILES, ...UX_HONESTY_NEW_FILES, ...UX_HONESTY_PIN_FILES, 'scripts/studio-later-changes.mjs', '.env.example'])

/** The file as it was before this change: honesty rewrites put back, PAGE-HEADINGS lines taken out. Any other file is returned as it is. */
export function stripUxHonesty(rel, text) {
  if (typeof text !== 'string') return text
  let out = text
  for (const [now, was] of UX_HONESTY_EDITS[rel] || []) out = out.replace(now, () => was)
  if (PAGE_HEADINGS_FILES.includes(rel)) out = out.split('\n').filter(line => !PAGE_HEADINGS_MARKER_RE.test(line)).join('\n')
  return out
}
