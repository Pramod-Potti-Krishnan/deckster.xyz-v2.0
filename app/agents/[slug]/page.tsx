'use client';

import { useParams } from 'next/navigation';
import { getAgentBySlug, getRelatedAgents } from '@/lib/agents';
import { Header, Footer } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Sparkles, PenTool, Palette, BarChart, ChevronRight, Home, ArrowLeft, CheckCircle2, Zap } from 'lucide-react';
import Link from 'next/link';

const iconMap = {
  Sparkles,
  PenTool,
  Palette,
  BarChart,
};

export default function AgentDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const agent = getAgentBySlug(slug);

  if (!agent) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 container mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold mb-4">Agent Not Found</h1>
          <p className="text-muted-foreground mb-8">
            The agent you're looking for doesn't exist.
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
  const Icon = iconMap[agent.icon as keyof typeof iconMap];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Breadcrumb */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              <Home className="h-4 w-4" />
            </Link>
            <ChevronRight className="h-4 w-4" />
            <Link href="/agents" className="hover:text-foreground transition-colors">
              AI Agents
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">{agent.name}</span>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className={`border-b bg-gradient-to-br from-${agent.color.secondary} to-white dark:from-${agent.color.primary}/10 dark:to-background`}>
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-start gap-6 mb-8">
              <div className={`h-20 w-20 rounded-2xl bg-gradient-to-br ${agent.color.gradient} flex items-center justify-center flex-shrink-0`}>
                <Icon className="h-10 w-10 text-white" />
              </div>
              <div className="flex-1">
                <Badge className={`mb-3 bg-gradient-to-r ${agent.color.gradient} text-white`}>
                  {agent.title}
                </Badge>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
                  {agent.name}
                </h1>
                <p className="text-xl text-muted-foreground mb-6">
                  {agent.tagline}
                </p>
                <div className="flex gap-4">
                  <Button asChild className={`bg-gradient-to-r ${agent.color.gradient} hover:opacity-90`}>
                    <Link href="/builder">
                      <Zap className="h-4 w-4 mr-2" />
                      Try {agent.name}
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/agents">
                      View All Agents
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Description */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold mb-4">Overview</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {agent.description}
            </p>
          </div>

          <Separator className="mb-16" />

          {/* Capabilities */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold mb-8">Key Capabilities</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {agent.capabilities.map((capability) => (
                <Card key={capability.id} className="border-2">
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${agent.color.gradient} flex items-center justify-center flex-shrink-0`}>
                        <CheckCircle2 className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-2">{capability.title}</CardTitle>
                        <CardDescription className="text-base">
                          {capability.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>

          <Separator className="mb-16" />

          {/* Use Cases */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold mb-4">Common Use Cases</h2>
            <p className="text-muted-foreground mb-8">
              Here's how {agent.name} excels in different scenarios
            </p>
            <div className="space-y-6">
              {agent.useCases.map((useCase, index) => (
                <Card key={useCase.id} className="border-l-4" style={{ borderLeftColor: `var(--${agent.color.primary})` }}>
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className={`h-8 w-8 rounded-full bg-gradient-to-br ${agent.color.gradient} flex items-center justify-center flex-shrink-0 text-white font-bold`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-3">{useCase.title}</CardTitle>
                        <CardDescription className="text-base mb-4">
                          {useCase.description}
                        </CardDescription>
                        <div className={`bg-${agent.color.secondary} dark:bg-${agent.color.primary}/10 p-4 rounded-lg`}>
                          <div className="text-sm font-semibold mb-2">Example:</div>
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

          <Separator className="mb-16" />

          {/* Workflow */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold mb-4">How {agent.name} Works</h2>
            <p className="text-muted-foreground mb-8">
              The step-by-step process {agent.name} follows
            </p>
            <div className="relative">
              {/* Vertical line */}
              <div className={`absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b ${agent.color.gradient} opacity-20`} />

              <div className="space-y-8">
                {agent.workflow.map((step, index) => (
                  <div key={step.id} className="relative pl-12">
                    <div className={`absolute left-0 h-8 w-8 rounded-full bg-gradient-to-br ${agent.color.gradient} flex items-center justify-center text-white font-bold text-sm`}>
                      {step.step}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                      <p className="text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Separator className="mb-16" />

          {/* Technical Details */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold mb-8">Technical Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {agent.technicalDetails.map((detail) => (
                <Card key={detail.id} className={`border-2 bg-gradient-to-br from-${agent.color.secondary} to-white dark:from-${agent.color.primary}/5 dark:to-background`}>
                  <CardHeader>
                    <CardTitle className="text-base mb-2">{detail.aspect}</CardTitle>
                    <CardDescription className="text-sm">
                      {detail.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>

          {/* Related Agents */}
          {relatedAgents.length > 0 && (
            <>
              <Separator className="mb-16" />
              <div className="mb-16">
                <h2 className="text-3xl font-bold mb-8">Other AI Agents</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {relatedAgents.map((relatedAgent) => {
                    const RelatedIcon = iconMap[relatedAgent.icon as keyof typeof iconMap];
                    return (
                      <Link
                        key={relatedAgent.id}
                        href={`/agents/${relatedAgent.slug}`}
                      >
                        <Card className="h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                          <CardHeader>
                            <div className={`h-12 w-12 rounded-lg bg-gradient-to-br ${relatedAgent.color.gradient} flex items-center justify-center mb-4`}>
                              <RelatedIcon className="h-6 w-6 text-white" />
                            </div>
                            <CardTitle className="text-lg">{relatedAgent.name}</CardTitle>
                            <CardDescription className="line-clamp-2 text-sm">
                              {relatedAgent.tagline}
                            </CardDescription>
                          </CardHeader>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* CTA */}
          <div className={`py-16 px-8 bg-gradient-to-br ${agent.color.gradient} rounded-2xl text-center text-white`}>
            <h3 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to work with {agent.name}?
            </h3>
            <p className="text-lg mb-8 max-w-2xl mx-auto opacity-90">
              Experience the power of specialized AI. Start creating presentations with {agent.name} and the rest of the team.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" variant="secondary">
                <Link href="/builder">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Start Creating
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                <Link href="/agents">
                  View All Agents
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
