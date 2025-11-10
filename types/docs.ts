export interface DocSection {
  id: string;
  title: string;
  items: DocItem[];
}

export interface DocItem {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
}

export interface DocNavItem {
  title: string;
  href: string;
  items?: DocNavItem[];
}
