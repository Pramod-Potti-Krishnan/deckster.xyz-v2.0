'use client';

import Link from 'next/link';
import {
  Sparkles,
  PenTool,
  Palette,
  BarChart,
  BarChart3,
  Compass,
  Search,
  TrendingUp,
  LayoutTemplate,
  Layers,
  ArrowRight,
  Brain,
  Zap,
  Users,
} from 'lucide-react';

import { getAllAgents } from '@/lib/agents';
import { Header, Footer } from '@/components/layout';
import { SnapDeck } from '@/components/marketing/SnapDeck/SnapDeck';
import { SlideNavArrows } from '@/components/marketing/SnapDeck/SlideNavArrows';
import { AgentChoreographySection } from '@/components/marketing/HomepageV2/AgentChoreography/AgentChoreographySection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const iconMap = {
  Sparkles,
  PenTool,
  Palette,
  BarChart,
  BarChart3,
  Compass,
  Search,
  TrendingUp,
  LayoutTemplate,
  Layers,
};

// Director → specialists → output story for the workflow slide. Mirrors the
// canonical agent-team description without re-deriving copy from agents.ts.
const WORKFLOW_STEPS: Array<{ title: string; description: string }> = [
  {
    title: 'Director receives the brief',
    description: 'Reads your prompt, scopes the deck, and picks which specialists to call.',
  },
  {
    title: 'Researcher pulls the facts',
    description: 'Gathers credible data, quotes, and citations the deck can stand behind.',
  },
  {
    title: 'Analyst finds the insight',
    description: 'Turns raw numbers into the through-line that ties every slide together.',
  },
  {
    title: 'Visualizer renders the data',
    description: 'Picks the right chart, diagram, or infographic for each finding.',
  },
  {
    title: 'Theme Builder applies the look',
    description: 'Locks colors, fonts, and spacing so every slide feels like one deck.',
  },
  {
    title: 'Slide Composer balances the page',
    description: 'Lays out each slide so headlines, visuals, and bullets breathe.',
  },
  {
    title: 'Element Generator builds the parts',
    description: 'Creates the metrics, charts, icons, and shapes each slide needs.',
  },
  {
    title: 'Content Generator writes the copy',
    description: 'Drafts headlines, body copy, and bullet lists in your voice.',
  },
];

export default function AgentsPage() {
  const agents = getAllAgents();

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans">
      <SnapDeck />
      <SlideNavArrows />
      <Header />

      <main>
        {/* Slide 1: Hero */}
        <section
          id="agents-hero"
          data-snap="slide"
          className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center overflow-hidden px-4 py-12"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-50 via-background to-blue-50 dark:from-purple-950/20 dark:via-background dark:to-blue-950/20" />
          </div>

          <div className="container mx-auto max-w-4xl text-center">
            <Badge className="mb-6 inline-flex items-center gap-1.5" variant="secondary">
              <Brain className="h-3 w-3" />
              Multi-Agent AI System
            </Badge>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
              Meet your{' '}
              <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                AI team
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-muted-foreground">
              Eight specialized AI agents working together to research, design, and ship
              presentations that actually land.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                <Link href="/builder">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Try it now
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/examples">View Examples</Link>
              </Button>
            </div>

            <div className="mt-14 grid grid-cols-1 gap-4 text-left sm:grid-cols-3">
              <FeatureChip
                icon={<Users className="h-4 w-4" />}
                title="Specialized expertise"
                body="Each agent is trained for one job — writing, design, data viz, orchestration."
              />
              <FeatureChip
                icon={<Zap className="h-4 w-4" />}
                title="Smart collaboration"
                body="The Director coordinates handoffs so every agent stays in sync with the brief."
              />
              <FeatureChip
                icon={<Brain className="h-4 w-4" />}
                title="Better results"
                body="Multiple specialists out-perform a single generalist on every slide."
              />
            </div>
          </div>
        </section>

        {/* Slide 2: Pyramid — reuses the homepage agent choreography */}
        <AgentChoreographySection />

        {/* Slide 3: Workflow */}
        <section
          id="agents-workflow"
          data-snap="slide"
          className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center px-4 py-12"
        >
          <div className="container mx-auto max-w-5xl">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                How the team works together
              </h2>
              <p className="mt-3 text-balance text-base text-muted-foreground sm:text-lg">
                Director → specialists → finished deck. Each handoff is checked before the
                next agent picks up the work.
              </p>
            </div>

            <ol className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {WORKFLOW_STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="relative rounded-xl border bg-card p-5 shadow-sm"
                >
                  <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-blue-600 text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <h3 className="text-base font-semibold leading-tight">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-snug text-muted-foreground">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>

            <div className="mt-10 text-center">
              <Button asChild variant="outline">
                <Link href="/agents/director">
                  Start with the Director
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Slide 4: Roster + CTA + compact footer baked in */}
        <section
          id="agents-cta"
          data-snap="slide"
          className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col"
        >
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
            <div className="container mx-auto max-w-6xl">
              <div className="mx-auto max-w-3xl text-center">
                <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                  Ready to see them in action?
                </h2>
                <p className="mt-3 text-balance text-base text-muted-foreground sm:text-lg">
                  Pick an agent to dive into, or jump straight into the builder.
                </p>
              </div>

              <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {agents.map((agent) => {
                  const Icon = iconMap[agent.icon as keyof typeof iconMap] || Sparkles;
                  return (
                    <Link
                      key={agent.id}
                      href={`/agents/${agent.slug}`}
                      className="group"
                    >
                      <Card className="h-full border-2 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                        <CardHeader className="p-4">
                          <div
                            className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${agent.color.gradient}`}
                          >
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                          <CardTitle className="text-base">{agent.name}</CardTitle>
                          <CardDescription className="line-clamp-2 text-xs">
                            {agent.tagline}
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    </Link>
                  );
                })}
              </div>

              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  <Link href="/builder">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Start creating
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/examples">View example presentations</Link>
                </Button>
              </div>
            </div>
          </div>

          <Footer compact />
        </section>
      </main>
    </div>
  );
}

function FeatureChip({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border bg-card/60 p-4 backdrop-blur">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-purple-600 to-blue-600 text-white">
          {icon}
        </span>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <p className="text-sm leading-snug text-muted-foreground">{body}</p>
    </div>
  );
}
