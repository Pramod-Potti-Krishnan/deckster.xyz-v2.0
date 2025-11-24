'use client';

import { getAllAgents } from '@/lib/agents';
import { Header, Footer } from '@/components/layout';
import { PageHeader } from '@/components/marketing/PageHeader';
import { Section } from '@/components/marketing/Section';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sparkles, PenTool, Palette, BarChart, ArrowRight, Zap, Users, Brain } from 'lucide-react';
import Link from 'next/link';

const iconMap = {
  Sparkles,
  PenTool,
  Palette,
  BarChart,
};

export default function AgentsPage() {
  const agents = getAllAgents();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Hero Section */}
      <PageHeader
        title="Meet Your AI Team"
        subtitle="Four specialized AI agents working together to create presentations that wow"
        badge={{
          text: "Multi-Agent AI System",
          icon: <Brain className="h-3 w-3" />
        }}
        cta={{
          text: "Try It Now",
          href: "/builder",
          variant: "default"
        }}
        secondaryCta={{
          text: "View Examples",
          href: "/examples",
          variant: "outline"
        }}
      />

      {/* How It Works */}
      <Section>
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            How Our Multi-Agent System Works
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Unlike single-AI tools, deckster uses four specialized agents that collaborate like a professional creative team.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <Card className="border-2">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-white" />
              </div>
              <CardTitle>Specialized Expertise</CardTitle>
              <CardDescription>
                Each agent is trained for a specific task - writing, design, data visualization, or orchestration.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <CardTitle>Smart Collaboration</CardTitle>
              <CardDescription>
                The Director coordinates all agents, ensuring they work together seamlessly to achieve your goals.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-pink-600 to-rose-600 flex items-center justify-center mb-4">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <CardTitle>Better Results</CardTitle>
              <CardDescription>
                Multiple specialized minds produce higher quality output than a single generalist AI.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Separator className="mb-16" />

        {/* Agents Grid */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-2 text-center">The AI Team</h2>
          <p className="text-muted-foreground text-center mb-12">
            Click on any agent to learn more about their capabilities
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {agents.map((agent) => {
            const Icon = iconMap[agent.icon as keyof typeof iconMap] || Sparkles;

            // Map color classes properly
            const getGradientClass = (gradient: string) => {
              const gradientClasses: Record<string, string> = {
                'from-purple-600 to-blue-600': 'from-purple-600 to-blue-600',
                'from-blue-600 to-cyan-600': 'from-blue-600 to-cyan-600',
                'from-pink-600 to-rose-600': 'from-pink-600 to-rose-600',
                'from-emerald-600 to-teal-600': 'from-emerald-600 to-teal-600',
              };
              return gradientClasses[gradient] || 'from-purple-600 to-blue-600';
            };

            const getBgClass = (secondary: string) => {
              const bgClasses: Record<string, string> = {
                'purple-100': 'bg-purple-100 dark:bg-purple-900/30',
                'blue-100': 'bg-blue-100 dark:bg-blue-900/30',
                'pink-100': 'bg-pink-100 dark:bg-pink-900/30',
                'emerald-100': 'bg-emerald-100 dark:bg-emerald-900/30',
              };
              return bgClasses[secondary] || 'bg-purple-100 dark:bg-purple-900/30';
            };

            const getDotClass = (primary: string) => {
              const dotClasses: Record<string, string> = {
                'purple-600': 'bg-purple-600',
                'blue-600': 'bg-blue-600',
                'pink-600': 'bg-pink-600',
                'emerald-600': 'bg-emerald-600',
              };
              return dotClasses[primary] || 'bg-purple-600';
            };

            const gradientClass = getGradientClass(agent.color.gradient);

            return (
              <Link
                key={agent.id}
                href={`/agents/${agent.slug}`}
                className="group"
              >
                <Card className="h-full transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 border-2 hover:border-transparent relative overflow-hidden">
                  {/* Gradient background on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${gradientClass} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />

                  <CardHeader className="relative">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`h-16 w-16 rounded-xl bg-gradient-to-br ${gradientClass} flex items-center justify-center transition-transform group-hover:scale-110`}>
                        {Icon && <Icon className="h-8 w-8 text-white" />}
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                    </div>

                    <CardTitle className="text-2xl mb-2">
                      {agent.name}
                    </CardTitle>

                    <div className="mb-4">
                      <Badge variant="secondary" className={getBgClass(agent.color.secondary)}>
                        {agent.title}
                      </Badge>
                    </div>

                    <CardDescription className="text-base leading-relaxed">
                      {agent.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="relative">
                    <div className="space-y-3">
                      <div className="font-semibold text-sm">Key Capabilities:</div>
                      <ul className="space-y-2">
                        {agent.capabilities.slice(0, 3).map((capability) => (
                          <li key={capability.id} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <div className={`h-1.5 w-1.5 rounded-full ${getDotClass(agent.color.primary)} mt-1.5 flex-shrink-0`} />
                            <span>{capability.title}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-6">
                      <Button variant="outline" className="w-full group-hover:bg-gradient-to-r group-hover:from-purple-600 group-hover:to-blue-600 group-hover:text-white group-hover:border-transparent transition-all">
                        Learn More
                        <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* CTA Section */}
        <div className="mt-20 py-16 px-8 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-2xl text-center">
          <h3 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to see them in action?
          </h3>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Experience the power of AI collaboration. Create your first presentation in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
              <Link href="/builder">
                <Sparkles className="h-4 w-4 mr-2" />
                Start Creating
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/examples">
                View Example Presentations
              </Link>
            </Button>
          </div>
        </div>
      </Section>
      <Footer />
    </div>
  );
}
