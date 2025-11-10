'use client';

import { useState } from 'react';
import { ArticleCategory } from '@/types/article';
import { getAllArticles, getFeaturedArticles, getArticleCategories } from '@/lib/articles';
import { ArticleCard } from '@/components/marketing/Resources/ArticleCard';
import { Header, Footer } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Sparkles } from 'lucide-react';

export default function ResourcesPage() {
  const allArticles = getAllArticles();
  const featuredArticles = getFeaturedArticles();
  const articleCategories = getArticleCategories();
  const [selectedCategory, setSelectedCategory] = useState<ArticleCategory | 'all'>('all');

  const filteredArticles = selectedCategory === 'all'
    ? allArticles
    : allArticles.filter(article => article.category === selectedCategory);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Header */}
      <div className="border-b bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
              <BookOpen className="h-3 w-3 mr-1" />
              Resources & Insights
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Learn About AI-Powered Presentations
            </h1>
            <p className="text-lg text-muted-foreground">
              Discover best practices, tutorials, and insights about creating stunning presentations with deckster's multi-agent AI system.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 container mx-auto px-4 py-8">
        {/* Featured Articles */}
        {featuredArticles.length > 0 && selectedCategory === 'all' && (
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              <h2 className="text-2xl font-bold">Featured Articles</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredArticles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          </div>
        )}

        {/* Category Filter */}
        <div className="mb-8">
          <Tabs
            value={selectedCategory}
            onValueChange={(value) => setSelectedCategory(value as ArticleCategory | 'all')}
            className="w-full"
          >
            <TabsList className="w-full justify-start flex-wrap h-auto">
              <TabsTrigger value="all" className="flex-shrink-0">
                All Articles ({allArticles.length})
              </TabsTrigger>
              {articleCategories.map((category) => (
                <TabsTrigger
                  key={category.value}
                  value={category.value}
                  className="flex-shrink-0"
                >
                  {category.label} ({category.count})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">
            Showing {filteredArticles.length} {filteredArticles.length === 1 ? 'article' : 'articles'}
          </p>
        </div>

        {/* Articles Grid */}
        {filteredArticles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArticles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="max-w-md mx-auto">
              <h3 className="text-lg font-semibold mb-2">No articles found</h3>
              <p className="text-muted-foreground mb-4">
                Try selecting a different category
              </p>
              <button
                onClick={() => setSelectedCategory('all')}
                className="text-primary hover:underline"
              >
                View all articles
              </button>
            </div>
          </div>
        )}

        {/* Newsletter Signup Section */}
        <div className="mt-16 py-12 px-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-lg text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Stay Updated with deckster
          </h2>
          <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
            Get the latest articles, product updates, and AI presentation tips delivered to your inbox.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 h-10 px-4 rounded-md border border-input bg-background"
            />
            <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 h-10 px-6">
              Subscribe
            </button>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
