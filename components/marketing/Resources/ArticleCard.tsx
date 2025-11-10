'use client';

import { Article } from '@/types/article';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Clock, Calendar, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface ArticleCardProps {
  article: Article;
}

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

export function ArticleCard({ article }: ArticleCardProps) {
  const formattedDate = new Date(article.publishedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Link href={`/resources/${article.id}`}>
      <Card className="group overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 h-full flex flex-col">
        {/* Cover Image */}
        <div className="w-full h-48 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20 overflow-hidden">
          <div className="w-full h-full flex items-center justify-center text-6xl">
            📄
          </div>
        </div>

        <CardHeader className="pb-3 flex-grow">
          <div className="flex items-start justify-between gap-2 mb-2">
            <Badge className={categoryConfig[article.category].className}>
              {categoryConfig[article.category].label}
            </Badge>
            {article.featured && (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                Featured
              </Badge>
            )}
          </div>

          <CardTitle className="text-xl line-clamp-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
            {article.title}
          </CardTitle>

          <CardDescription className="line-clamp-3 text-sm mt-2">
            {article.excerpt}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Tags */}
          <div className="flex flex-wrap gap-1">
            {article.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>

          {/* Author */}
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20">
                {article.author.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{article.author.name}</span>
              <span className="text-xs text-muted-foreground">{article.author.role}</span>
            </div>
          </div>
        </CardContent>

        <CardFooter className="pt-3 border-t flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{article.readTime} min read</span>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
        </CardFooter>
      </Card>
    </Link>
  );
}
