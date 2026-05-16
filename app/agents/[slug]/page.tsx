'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
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
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Zap,
} from 'lucide-react';

import { getAgentBySlug, getRelatedAgents } from '@/lib/agents';
import { Header, Footer } from '@/components/layout';
import { SnapDeck } from '@/components/marketing/SnapDeck/SnapDeck';
import { SlideNavArrows } from '@/components/marketing/SnapDeck/SlideNavArrows';
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
};

const slideClass =
  'relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center px-4 py-12';

export default function AgentDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const agent = getAgentBySlug(slug);

  if (!agent) {
    return (
      <div className="flex min-h-screen flex-col bg-background font-sans">
        <Header />
        <div className="container mx-auto flex-1 px-4 py-16 text-center">
          <h1 className="mb-4 text-4xl font-bold">Agent Not Found</h1>
          <p className="mb-8 text-muted-foreground">
            The agent you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link
            href="/agents"
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Agents
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const relatedAgents = getRelatedAgents(agent, 3);
  const Icon = iconMap[agent.icon as keyof typeof iconMap] || Sparkles;

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans">
      <SnapDeck />
      <SlideNavArrows />
      <Header />

      <main>
        {/* Slide 1: Hero — gradient background using agent's color */}
        <section
          id="agent-hero"
          data-snap="slide"
          className={`${slideClass} overflow-hidden text-white`}
        >
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br ${agent.color.gradient}`}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.18),transparent_60%)]"
          />

          <div className="container mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
              <Icon className="h-10 w-10 text-white" />
            </div>
            <Badge className="mb-4 bg-white/15 text-white hover:bg-white/20">
              {agent.title}
            </Badge>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
              {agent.name}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-white/85 sm:text-xl">
              {agent.tagline}
            </p>
            <p className="mx-auto mt-4 max-w-3xl text-balance text-base leading-relaxed text-white/75">
              {agent.description}
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" variant="secondary">
                <Link href="/builder">
                  <Zap className="mr-2 h-4 w-4" />
                  Try {agent.name} in the builder
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20"
              >
                <Link href="/agents">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  All agents
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Slide 2: Capabilities */}
        <section id="agent-capabilities" data-snap="slide" className={slideClass}>
          <div className="container mx-auto max-w-5xl">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                Key capabilities
              </h2>
              <p className="mt-3 text-balance text-base text-muted-foreground sm:text-lg">
                What {agent.name} brings to the team.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
              {agent.capabilities.map((capability) => (
                <Card key={capability.id} className="border-2">
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${agent.color.gradient}`}
                      >
                        <CheckCircle2 className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="mb-2 text-lg">{capability.title}</CardTitle>
                        <CardDescription className="text-sm leading-relaxed">
                          {capability.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Slide 3: Workflow */}
        <section id="agent-workflow" data-snap="slide" className={slideClass}>
          <div className="container mx-auto max-w-4xl">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                How {agent.name} works
              </h2>
              <p className="mt-3 text-balance text-base text-muted-foreground sm:text-lg">
                The step-by-step process {agent.name} follows on every deck.
              </p>
            </div>

            <div className="relative mt-10">
              <div
                className={`absolute bottom-0 left-4 top-0 w-0.5 bg-gradient-to-b ${agent.color.gradient} opacity-25`}
              />
              <div className="space-y-6">
                {agent.workflow.map((step) => (
                  <div key={step.id} className="relative pl-14">
                    <div
                      className={`absolute left-0 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${agent.color.gradient} text-sm font-bold text-white`}
                    >
                      {step.step}
                    </div>
                    <h3 className="text-lg font-semibold">{step.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Slide 4: Use cases */}
        <section id="agent-use-cases" data-snap="slide" className={slideClass}>
          <div className="container mx-auto max-w-5xl">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                Common use cases
              </h2>
              <p className="mt-3 text-balance text-base text-muted-foreground sm:text-lg">
                How {agent.name} excels in different scenarios.
              </p>
            </div>

            <div className="mt-10 space-y-5">
              {agent.useCases.map((useCase, index) => (
                <Card key={useCase.id} className="border-l-4 border-l-purple-500">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div
                        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${agent.color.gradient} text-sm font-bold text-white`}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="mb-2 text-lg">{useCase.title}</CardTitle>
                        <CardDescription className="text-sm leading-relaxed">
                          {useCase.description}
                        </CardDescription>
                        <div className="mt-3 rounded-lg bg-muted/60 p-3">
                          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Example
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {useCase.example}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Slide 5: Related agents */}
        {relatedAgents.length > 0 && (
          <section id="agent-related" data-snap="slide" className={slideClass}>
            <div className="container mx-auto max-w-5xl">
              <div className="mx-auto max-w-3xl text-center">
                <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                  Other AI agents
                </h2>
                <p className="mt-3 text-balance text-base text-muted-foreground sm:text-lg">
                  More specialists you might want to meet.
                </p>
              </div>

              <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
                {relatedAgents.map((relatedAgent) => {
                  const RelatedIcon =
                    iconMap[relatedAgent.icon as keyof typeof iconMap] || Sparkles;
                  return (
                    <Link
                      key={relatedAgent.id}
                      href={`/agents/${relatedAgent.slug}`}
                      className="group"
                    >
                      <Card className="h-full border-2 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                        <CardHeader>
                          <div
                            className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${relatedAgent.color.gradient}`}
                          >
                            <RelatedIcon className="h-6 w-6 text-white" />
                          </div>
                          <CardTitle className="text-lg">{relatedAgent.name}</CardTitle>
                          <CardDescription className="line-clamp-2 text-sm">
                            {relatedAgent.tagline}
                          </CardDescription>
                          <div className="mt-3 inline-flex items-center text-sm font-medium text-primary">
                            Learn more
                            <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                          </div>
                        </CardHeader>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Slide 6: CTA + compact footer baked in */}
        <section
          id="agent-cta"
          data-snap="slide"
          className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col overflow-hidden text-white"
        >
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br ${agent.color.gradient}`}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.18),transparent_55%)]"
          />

          <div className="flex flex-1 items-center justify-center px-4 py-12">
            <div className="container mx-auto max-w-3xl text-center">
              <h2 className="text-balance text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl">
                Try {agent.name} in the builder
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-relaxed text-white/85 sm:text-lg">
                Start a deck and {agent.name} will join the team automatically when the work
                calls for it.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" variant="secondary">
                  <Link href="/builder">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Start creating
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                >
                  <Link href="/agents">View all agents</Link>
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
