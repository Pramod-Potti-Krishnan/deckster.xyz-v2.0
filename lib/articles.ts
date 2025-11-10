import { articles } from '@/content/articles';
import { Article, ArticleCategory } from '@/types/article';

export function getAllArticles(): Article[] {
  return articles.sort((a, b) =>
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export function getFeaturedArticles(): Article[] {
  return articles.filter(article => article.featured);
}

export function getArticlesByCategory(category: ArticleCategory): Article[] {
  return articles.filter(article => article.category === category)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find(article => article.id === slug);
}

export function getRelatedArticles(article: Article, limit: number = 3): Article[] {
  return articles
    .filter(a =>
      a.id !== article.id &&
      (a.category === article.category || a.tags.some(tag => article.tags.includes(tag)))
    )
    .slice(0, limit);
}

export function getArticleCategories() {
  const categoryCounts = articles.reduce((acc, article) => {
    acc[article.category] = (acc[article.category] || 0) + 1;
    return acc;
  }, {} as Record<ArticleCategory, number>);

  return Object.entries(categoryCounts).map(([value, count]) => ({
    value: value as ArticleCategory,
    label: value.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' '),
    count,
  }));
}
