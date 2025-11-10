import { docSections, docNavigation } from '@/content/docs';
import { DocSection, DocItem } from '@/types/docs';

export function getAllDocs(): DocSection[] {
  return docSections;
}

export function getDocBySlug(category: string, slug: string): DocItem | undefined {
  for (const section of docSections) {
    if (section.id === category) {
      const doc = section.items.find(item => item.slug === slug);
      if (doc) return doc;
    }
  }
  return undefined;
}

export function getDocNavigation() {
  return docNavigation;
}

export function searchDocs(query: string): DocItem[] {
  const lowerQuery = query.toLowerCase();
  const results: DocItem[] = [];

  for (const section of docSections) {
    for (const item of section.items) {
      const searchableText = `${item.title} ${item.content}`.toLowerCase();
      if (searchableText.includes(lowerQuery)) {
        results.push(item);
      }
    }
  }

  return results;
}

export function getRelatedDocs(currentDoc: DocItem, limit: number = 3): DocItem[] {
  const relatedDocs: DocItem[] = [];

  for (const section of docSections) {
    if (section.id === currentDoc.category) {
      for (const item of section.items) {
        if (item.id !== currentDoc.id && relatedDocs.length < limit) {
          relatedDocs.push(item);
        }
      }
    }
  }

  return relatedDocs;
}
