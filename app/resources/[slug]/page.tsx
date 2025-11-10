'use client';

import { useParams } from 'next/navigation';
import { getArticleBySlug, getRelatedArticles } from '@/lib/articles';
import { Header, Footer } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArticleCard } from '@/components/marketing/Resources/ArticleCard';
import { Clock, Calendar, ArrowLeft, Share2 } from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const categoryConfig = {
  'tutorials': {
    label: 'Tutorial',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  },
  'ai-insights': {
    label: 'AI Insights',
    className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  },
  'best-practices': {
    label: 'Best Practices',
    className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  },
  'product-updates': {
    label: 'Product Update',
    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  },
  'customer-stories': {
    label: 'Customer Story',
    className: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
  },
};

export default function ArticlePage() {
  const params = useParams();
  const slug = params.slug as string;
  const article = getArticleBySlug(slug);

  if (!article) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 container mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold mb-4">Article Not Found</h1>
          <p className="text-muted-foreground mb-8">
            The article you're looking for doesn't exist.
          </p>
          <Link
            href="/resources"
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Resources
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const relatedArticles = getRelatedArticles(article);
  const formattedDate = new Date(article.publishedAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Back Navigation */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link
            href="/resources"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Resources
          </Link>
        </div>
      </div>

      {/* Article Header */}
      <div className="border-b bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <Badge className={categoryConfig[article.category].className}>
                {categoryConfig[article.category].label}
              </Badge>
              {article.featured && (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                  Featured
                </Badge>
              )}
            </div>

            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              {article.title}
            </h1>

            <p className="text-xl text-muted-foreground mb-8">
              {article.excerpt}
            </p>

            {/* Article Meta */}
            <div className="flex flex-wrap items-center gap-6">
              {/* Author */}
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20">
                    {article.author.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-medium">{article.author.name}</span>
                  <span className="text-sm text-muted-foreground">{article.author.role}</span>
                </div>
              </div>

              <div className="h-8 w-px bg-border" />

              {/* Date and Read Time */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{formattedDate}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{article.readTime} min read</span>
                </div>
              </div>

              <div className="flex-1" />

              {/* Share Button */}
              <button className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors">
                <Share2 className="h-4 w-4" />
                <span className="text-sm font-medium">Share</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Article Content */}
      <div className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Cover Image Placeholder */}
          <div className="w-full h-96 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg mb-12 flex items-center justify-center">
            <span className="text-8xl">📄</span>
          </div>

          {/* Article Content */}
          <div className="prose prose-lg dark:prose-invert max-w-none mb-12">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {article.content}
            </ReactMarkdown>
          </div>

          {/* Tags */}
          <div className="border-t border-b py-6 mb-12">
            <div className="flex flex-wrap gap-2">
              {article.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Related Articles */}
          {relatedArticles.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Related Articles</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {relatedArticles.map((relatedArticle) => (
                  <ArticleCard key={relatedArticle.id} article={relatedArticle} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
