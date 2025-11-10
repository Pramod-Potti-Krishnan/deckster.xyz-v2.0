'use client';

import { getAllCompetitors } from '@/lib/comparisons';
import { Header, Footer } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, CheckCircle2, Sparkles, Users, Zap, Award } from 'lucide-react';
import Link from 'next/link';

export default function ComparePage() {
  const competitors = getAllCompetitors();

  const aiCompetitors = competitors.filter(c => c.category === 'presentation-ai');
  const toolCompetitors = competitors.filter(c => c.category === 'presentation-tool');
  const traditionalCompetitors = competitors.filter(c => c.category === 'traditional');

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Hero Section */}
      <div className="border-b bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="mb-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
              <Award className="h-3 w-3 mr-1" />
              Honest Comparisons
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              How Deckster Compares
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8">
              See how our multi-agent AI system stacks up against other presentation tools
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg">
                <Link href="/builder">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Try Deckster Free
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/agents">
                  Learn About Our AI
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Why Different */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              What Makes Deckster Different
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Our multi-agent AI system is a fundamentally different approach to creating presentations
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <Card className="border-2">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <CardTitle>Specialized AI Agents</CardTitle>
                <CardDescription>
                  Four AI specialists (Director, Scripter, Graphic Artist, Data Visualizer) work together - not just one general AI.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center mb-4">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <CardTitle>True Content Creation</CardTitle>
                <CardDescription>
                  AI actually writes your content, not just helps with design or suggests templates.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-pink-600 to-rose-600 flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <CardTitle>Minutes, Not Hours</CardTitle>
                <CardDescription>
                  Complete presentations from scratch in minutes - AI handles the heavy lifting of creation.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          <Separator className="mb-16" />

          {/* AI-Powered Competitors */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold mb-2">vs. AI-Powered Tools</h2>
            <p className="text-muted-foreground mb-8">
              How we compare to other AI presentation tools
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {aiCompetitors.map((competitor) => (
                <Link
                  key={competitor.id}
                  href={`/compare/${competitor.slug}`}
                  className="group"
                >
                  <Card className="h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-2">
                    <CardHeader>
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <CardTitle className="text-2xl mb-2">
                            Deckster vs {competitor.name}
                          </CardTitle>
                          <Badge variant="secondary" className="mb-3">
                            {competitor.tagline}
                          </Badge>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                      </div>
                      <CardDescription className="text-base">
                        See how our multi-agent AI system compares to {competitor.name}'s approach.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span>Detailed feature comparison</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>

          <Separator className="mb-16" />

          {/* Collaboration Tools */}
          {toolCompetitors.length > 0 && (
            <>
              <div className="mb-16">
                <h2 className="text-3xl font-bold mb-2">vs. Collaboration Platforms</h2>
                <p className="text-muted-foreground mb-8">
                  AI-first creation vs. team collaboration
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {toolCompetitors.map((competitor) => (
                    <Link
                      key={competitor.id}
                      href={`/compare/${competitor.slug}`}
                      className="group"
                    >
                      <Card className="h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-2">
                        <CardHeader>
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <CardTitle className="text-2xl mb-2">
                                Deckster vs {competitor.name}
                              </CardTitle>
                              <Badge variant="secondary" className="mb-3">
                                {competitor.tagline}
                              </Badge>
                            </div>
                            <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                          </div>
                          <CardDescription className="text-base">
                            Different philosophies: AI creation vs. collaborative editing.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span>When to choose each platform</span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
              <Separator className="mb-16" />
            </>
          )}

          {/* Traditional Tools */}
          {traditionalCompetitors.length > 0 && (
            <div className="mb-16">
              <h2 className="text-3xl font-bold mb-2">vs. Traditional Software</h2>
              <p className="text-muted-foreground mb-8">
                Next generation AI vs. proven standards
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {traditionalCompetitors.map((competitor) => (
                  <Link
                    key={competitor.id}
                    href={`/compare/${competitor.slug}`}
                    className="group"
                  >
                    <Card className="h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-2">
                      <CardHeader>
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <CardTitle className="text-2xl mb-2">
                              Deckster vs {competitor.name}
                            </CardTitle>
                            <Badge variant="secondary" className="mb-3">
                              {competitor.tagline}
                            </Badge>
                          </div>
                          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                        </div>
                        <CardDescription className="text-base">
                          How AI-native tools are changing presentation creation.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span>Honest comparison of both approaches</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* CTA Section */}
          <div className="mt-20 py-16 px-8 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-2xl text-center">
            <h3 className="text-3xl md:text-4xl font-bold mb-4">
              Try the Difference Yourself
            </h3>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Experience how multi-agent AI creates better presentations. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                <Link href="/builder">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Start Creating Free
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/examples">
                  View Example Decks
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
