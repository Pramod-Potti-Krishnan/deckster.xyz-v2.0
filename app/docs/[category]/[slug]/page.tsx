'use client';

import { useParams } from 'next/navigation';
import { getDocBySlug, getDocNavigation, getRelatedDocs } from '@/lib/docs';
import { Header, Footer } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { BookOpen, ChevronRight, Home, ArrowLeft, Share2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function DocPage() {
  const params = useParams();
  const category = params.category as string;
  const slug = params.slug as string;
  const doc = getDocBySlug(category, slug);
  const navigation = getDocNavigation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!doc) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 container mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold mb-4">Documentation Not Found</h1>
          <p className="text-muted-foreground mb-8">
            The documentation page you're looking for doesn't exist.
          </p>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Documentation
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const relatedDocs = getRelatedDocs(doc);

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
            <Link href="/docs" className="hover:text-foreground transition-colors">
              Documentation
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">{doc.title}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <div className="container mx-auto px-4 py-8">
          <div className="flex gap-8">
            {/* Sidebar Navigation */}
            <aside className="hidden lg:block w-64 shrink-0">
              <div className="sticky top-24">
                <ScrollArea className="h-[calc(100vh-12rem)]">
                  <div className="space-y-6">
                    {navigation.map((section) => (
                      <div key={section.title}>
                        <h4 className="font-semibold mb-3">{section.title}</h4>
                        <ul className="space-y-2">
                          {section.items?.map((item) => {
                            const itemSlug = item.href.split('/').pop();
                            const isActive = itemSlug === slug;
                            return (
                              <li key={item.href}>
                                <Link
                                  href={item.href}
                                  className={`block text-sm py-1 px-3 rounded-md transition-colors ${
                                    isActive
                                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 font-medium'
                                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                                  }`}
                                >
                                  {item.title}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </aside>

            {/* Article Content */}
            <main className="flex-1 max-w-3xl">
              {/* Article Header */}
              <div className="mb-8">
                <Badge className="mb-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                  <BookOpen className="h-3 w-3 mr-1" />
                  {doc.category.split('-').map(word =>
                    word.charAt(0).toUpperCase() + word.slice(1)
                  ).join(' ')}
                </Badge>
                <h1 className="text-4xl font-bold tracking-tight mb-4">{doc.title}</h1>
                <div className="flex items-center gap-4">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Share2 className="h-4 w-4" />
                    Share
                  </Button>
                </div>
              </div>

              <Separator className="mb-8" />

              {/* Markdown Content */}
              <div className="prose prose-lg dark:prose-invert max-w-none
                prose-headings:font-bold prose-headings:tracking-tight
                prose-h1:text-4xl prose-h1:mb-8 prose-h1:pb-4 prose-h1:border-b
                prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:pt-6 prose-h2:pb-4 prose-h2:px-6 prose-h2:rounded-lg prose-h2:bg-gradient-to-r prose-h2:from-purple-50 prose-h2:to-blue-50 dark:prose-h2:from-purple-950/20 dark:prose-h2:to-blue-950/20 prose-h2:border-2 prose-h2:border-purple-100 dark:prose-h2:border-purple-900
                prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-4 prose-h3:text-purple-900 dark:prose-h3:text-purple-100
                prose-p:text-base prose-p:leading-7 prose-p:mb-4 prose-p:text-gray-700 dark:prose-p:text-gray-300
                prose-ul:my-6 prose-ul:list-disc prose-ul:pl-6 prose-ul:space-y-3
                prose-ol:my-6 prose-ol:list-decimal prose-ol:pl-6 prose-ol:space-y-3
                prose-li:text-base prose-li:leading-7 prose-li:text-gray-700 dark:prose-li:text-gray-300
                prose-strong:font-semibold prose-strong:text-gray-900 dark:prose-strong:text-gray-100
                prose-code:bg-purple-100 dark:prose-code:bg-purple-900 prose-code:text-purple-900 dark:prose-code:text-purple-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:before:content-[''] prose-code:after:content-['']
                prose-pre:bg-slate-100 dark:prose-pre:bg-slate-900 prose-pre:p-6 prose-pre:rounded-lg prose-pre:overflow-x-auto prose-pre:border prose-pre:border-slate-200 dark:prose-pre:border-slate-800 prose-pre:my-6
                prose-blockquote:border-l-4 prose-blockquote:border-purple-600 prose-blockquote:pl-6 prose-blockquote:italic prose-blockquote:my-6 prose-blockquote:text-slate-600 dark:prose-blockquote:text-slate-400 prose-blockquote:bg-purple-50/50 dark:prose-blockquote:bg-purple-950/20 prose-blockquote:py-4 prose-blockquote:rounded-r
                prose-a:text-purple-600 dark:prose-a:text-purple-400 prose-a:no-underline hover:prose-a:underline prose-a:font-medium
                prose-img:rounded-lg prose-img:shadow-lg">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {doc.content}
                </ReactMarkdown>
              </div>

              {/* Related Documentation */}
              {relatedDocs.length > 0 && (
                <div className="mt-16">
                  <Separator className="mb-8" />
                  <h2 className="text-2xl font-bold mb-6">Related Documentation</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {relatedDocs.map((relatedDoc) => (
                      <Link
                        key={relatedDoc.id}
                        href={`/docs/${relatedDoc.category}/${relatedDoc.slug}`}
                      >
                        <Card className="h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                          <CardHeader>
                            <CardTitle className="text-base">{relatedDoc.title}</CardTitle>
                            <CardDescription className="line-clamp-2 text-xs">
                              {relatedDoc.content.substring(0, 100)}...
                            </CardDescription>
                          </CardHeader>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Help CTA */}
              <div className="mt-16 p-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-lg">
                <h3 className="text-lg font-bold mb-2">Need more help?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Can't find what you're looking for? Our support team is here to help.
                </p>
                <div className="flex gap-3">
                  <Link
                    href="/help"
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 h-9 px-4"
                  >
                    Contact Support
                  </Link>
                  <Link
                    href="/docs"
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4"
                  >
                    Browse All Docs
                  </Link>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
