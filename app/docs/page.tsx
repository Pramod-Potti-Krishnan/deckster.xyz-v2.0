'use client';

import { getAllDocs } from '@/lib/docs';
import { Header, Footer } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { BookOpen, Search, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function DocsPage() {
  const sections = getAllDocs();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSections = sections.map(section => ({
    ...section,
    items: section.items.filter(item =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter(section => section.items.length > 0);

  const totalDocs = sections.reduce((sum, section) => sum + section.items.length, 0);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Header */}
      <div className="border-b bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
              <BookOpen className="h-3 w-3 mr-1" />
              Documentation
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              deckster Documentation
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              Everything you need to know to create amazing AI-powered presentations
            </p>

            {/* Search */}
            <div className="relative max-w-md mx-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search documentation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-2xl font-bold">{totalDocs}</CardTitle>
                <CardDescription>Documentation Articles</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-2xl font-bold">{sections.length}</CardTitle>
                <CardDescription>Categories</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-2xl font-bold">4</CardTitle>
                <CardDescription>AI Agents to Learn</CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* Documentation Sections */}
          {filteredSections.length > 0 ? (
            <div className="space-y-16">
              {filteredSections.map((section, index) => (
                <div key={section.id}>
                  {/* Section Separator (except first) */}
                  {index > 0 && (
                    <div className="mb-12">
                      <Separator />
                    </div>
                  )}

                  {/* Section Header */}
                  <div className="mb-8">
                    <h2 className="text-3xl font-bold mb-2">{section.title}</h2>
                    <p className="text-muted-foreground">
                      {section.items.length} {section.items.length === 1 ? 'article' : 'articles'}
                    </p>
                  </div>

                  {/* Documentation Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {section.items.map((doc) => (
                      <Link
                        key={doc.id}
                        href={`/docs/${doc.category}/${doc.slug}`}
                        className="group"
                      >
                        <Card className="h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-purple-200 dark:hover:border-purple-800">
                          <CardHeader>
                            <CardTitle className="flex items-center justify-between text-lg">
                              <span className="group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                {doc.title}
                              </span>
                              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
                            </CardTitle>
                            <CardDescription className="line-clamp-2 text-sm mt-2">
                              {doc.content.substring(0, 150)}...
                            </CardDescription>
                          </CardHeader>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="max-w-md mx-auto">
                <h3 className="text-lg font-semibold mb-2">No documentation found</h3>
                <p className="text-muted-foreground mb-4">
                  Try a different search query
                </p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-primary hover:underline"
                >
                  Clear search
                </button>
              </div>
            </div>
          )}

          {/* Help CTA */}
          <div className="mt-16 py-12 px-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-lg text-center">
            <h3 className="text-2xl md:text-3xl font-bold mb-4">
              Still have questions?
            </h3>
            <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
              Can't find what you're looking for? Check our Help Center or contact our support team.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/help"
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 h-10 px-6"
              >
                Visit Help Center
              </Link>
              <Link
                href="/help"
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-6"
              >
                Contact Support
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
