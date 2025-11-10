'use client';

import { useParams } from 'next/navigation';
import { getComparisonBySlug, getRelatedCompetitors } from '@/lib/comparisons';
import { Header, Footer } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, XCircle, MinusCircle, ChevronRight, Home, ArrowLeft, Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Link from 'next/link';

export default function ComparisonDetailPage() {
  const params = useParams();
  const slug = params.competitor as string;
  const comparison = getComparisonBySlug(slug);

  if (!comparison) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 container mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold mb-4">Comparison Not Found</h1>
          <p className="text-muted-foreground mb-8">
            The comparison you're looking for doesn't exist.
          </p>
          <Link
            href="/compare"
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Comparisons
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const relatedCompetitors = getRelatedCompetitors(slug, 3);

  const getFeatureIcon = (value: string | boolean) => {
    if (value === true) return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    if (value === false) return <XCircle className="h-5 w-5 text-red-500" />;
    return <MinusCircle className="h-5 w-5 text-gray-400" />;
  };

  const getWinnerBadge = (winner: string) => {
    if (winner === 'deckster') return <Badge className="bg-purple-600">Deckster</Badge>;
    if (winner === 'competitor') return <Badge variant="secondary">{ comparison.competitor.name}</Badge>;
    return <Badge variant="outline">Tie</Badge>;
  };

  const getAdvantageIcon = (advantage: string) => {
    if (advantage === 'deckster') return <TrendingUp className="h-5 w-5 text-green-600" />;
    if (advantage === 'competitor') return <TrendingDown className="h-5 w-5 text-orange-600" />;
    return <Minus className="h-5 w-5 text-gray-400" />;
  };

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
            <Link href="/compare" className="hover:text-foreground transition-colors">
              Comparisons
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">vs {comparison.competitor.name}</span>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="border-b bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="mb-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
              Deckster vs {comparison.competitor.name}
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              {comparison.summary.headline}
            </h1>
            <p className="text-xl text-muted-foreground mb-6">
              {comparison.summary.subheadline}
            </p>
            <p className="text-lg text-muted-foreground mb-8">
              {comparison.summary.description}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg">
                <Link href="/builder">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Try Deckster
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/compare">
                  View All Comparisons
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Key Differentiators */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold mb-8">Key Differences</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {comparison.keyDifferentiators.map((diff) => (
                <Card key={diff.id} className="border-2">
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        {getAdvantageIcon(diff.advantage)}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-2">{diff.title}</CardTitle>
                        <CardDescription className="text-base">
                          {diff.description}
                        </CardDescription>
                        {diff.advantage !== 'neutral' && (
                          <div className="mt-3">
                            <Badge variant={diff.advantage === 'deckster' ? 'default' : 'secondary'} className="text-xs">
                              {diff.advantage === 'deckster' ? 'Deckster Advantage' : `${comparison.competitor.name} Advantage`}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>

          <Separator className="mb-16" />

          {/* Feature Comparison Table */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold mb-8">Feature Comparison</h2>

            <div className="space-y-6">
              {['ai', 'core', 'collaboration', 'export', 'pricing'].map((category) => {
                const categoryFeatures = comparison.featureComparison.filter(f => f.category === category);
                if (categoryFeatures.length === 0) return null;

                return (
                  <div key={category}>
                    <h3 className="text-xl font-semibold mb-4 capitalize">
                      {category === 'ai' ? 'AI Capabilities' : category}
                    </h3>
                    <div className="space-y-3">
                      {categoryFeatures.map((feature) => (
                        <Card key={feature.id} className={feature.deckster.highlight || feature.competitor.highlight ? 'border-2' : ''}>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base font-semibold mb-4">
                              {feature.feature}
                            </CardTitle>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Deckster */}
                              <div className={`flex items-start gap-3 ${feature.deckster.highlight ? 'p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg' : ''}`}>
                                <div className="flex-shrink-0 mt-1">
                                  {getFeatureIcon(feature.deckster.value)}
                                </div>
                                <div>
                                  <div className="font-semibold text-sm mb-1">Deckster</div>
                                  <div className="text-sm text-muted-foreground">
                                    {typeof feature.deckster.value === 'string' ? feature.deckster.value : feature.deckster.value ? 'Yes' : 'No'}
                                  </div>
                                  {feature.deckster.description && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {feature.deckster.description}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Competitor */}
                              <div className={`flex items-start gap-3 ${feature.competitor.highlight ? 'p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg' : ''}`}>
                                <div className="flex-shrink-0 mt-1">
                                  {getFeatureIcon(feature.competitor.value)}
                                </div>
                                <div>
                                  <div className="font-semibold text-sm mb-1">{comparison.competitor.name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {typeof feature.competitor.value === 'string' ? feature.competitor.value : feature.competitor.value ? 'Yes' : 'No'}
                                  </div>
                                  {feature.competitor.description && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {feature.competitor.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator className="mb-16" />

          {/* Use Case Comparisons */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold mb-8">Use Case Comparisons</h2>
            <div className="space-y-6">
              {comparison.useCaseComparisons.map((useCase) => (
                <Card key={useCase.id} className="border-2">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-4">
                      <CardTitle className="text-xl">{useCase.useCase}</CardTitle>
                      {getWinnerBadge(useCase.winner)}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <div className="font-semibold text-sm flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-purple-600" />
                          Deckster Approach
                        </div>
                        <CardDescription className="text-sm">
                          {useCase.decksterApproach}
                        </CardDescription>
                      </div>
                      <div className="space-y-2">
                        <div className="font-semibold text-sm flex items-center gap-2">
                          {comparison.competitor.name} Approach
                        </div>
                        <CardDescription className="text-sm">
                          {useCase.competitorApproach}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>

          <Separator className="mb-16" />

          {/* Verdict */}
          <div className="mb-16">
            <Card className="border-2 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/10 dark:to-blue-950/10">
              <CardHeader>
                <CardTitle className="text-2xl mb-4">{comparison.verdict.title}</CardTitle>
                <CardDescription className="text-base mb-6">
                  {comparison.verdict.description}
                </CardDescription>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-semibold mb-3">Choose {comparison.competitor.name} if you:</h4>
                    <ul className="space-y-2">
                      {comparison.verdict.bestFor.map((item, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3">Choose Deckster if you:</h4>
                    <ul className="space-y-2">
                      {comparison.verdict.decksterBestFor.map((item, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-purple-600 flex-shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </div>

          {/* Other Comparisons */}
          {relatedCompetitors.length > 0 && (
            <>
              <Separator className="mb-16" />
              <div className="mb-16">
                <h2 className="text-3xl font-bold mb-8">Other Comparisons</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {relatedCompetitors.map((competitor) => (
                    <Link
                      key={competitor.id}
                      href={`/compare/${competitor.slug}`}
                    >
                      <Card className="h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                        <CardHeader>
                          <CardTitle className="text-lg">
                            vs {competitor.name}
                          </CardTitle>
                          <CardDescription className="text-sm">
                            {competitor.tagline}
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* CTA */}
          <div className="py-16 px-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl text-center text-white">
            <h3 className="text-3xl md:text-4xl font-bold mb-4">
              Experience the Difference
            </h3>
            <p className="text-lg mb-8 max-w-2xl mx-auto opacity-90">
              See how our multi-agent AI system creates presentations. Try it free - no credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" variant="secondary">
                <Link href="/builder">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Start Creating Free
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                <Link href="/examples">
                  View Examples
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
