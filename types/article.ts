export type ArticleCategory =
  | 'tutorials'
  | 'ai-insights'
  | 'best-practices'
  | 'product-updates'
  | 'customer-stories';

export interface Article {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  category: ArticleCategory;
  author: {
    name: string;
    role: string;
    avatar?: string;
  };
  publishedAt: string;
  readTime: number; // in minutes
  featured?: boolean;
  tags: string[];
  coverImage: string;
}
