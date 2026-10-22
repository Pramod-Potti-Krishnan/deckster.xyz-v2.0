// PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS): the words and the small rules of /docs and /docs/<category>/<article> in the Studio shell's tokens. Import-free, so the test runs it as plain code.
// The shapes below are the ones of types/docs.ts (DocSection / DocItem); the test pins them to content/docs.ts and lib/docs.ts.
// Content pass (PROGRAM-1, 22 Oct): the docs text names the current agents (the rules are content/studio-p2-docs-agents.ts), /docs/api says it is not available yet, the footers drop the links to it and to the two redirects
// (/integrations, /agents), and the Landing footer gains Help, Docs, Security and Cookies.

export interface StudioDocItem { id: string; title: string; slug: string; category: string; content: string }
export interface StudioDocSection { id: string; title: string; items: StudioDocItem[] }

export const STUDIO_DOCS_EXCERPT_MAX = 150

export const STUDIO_DOCS_WORDS = {
  eyebrow: 'Documentation',
  title: 'Get the most out of Deckster',
  lede: 'Guides and answers for turning your ideas into finished slides',
  searchLabel: 'Search documentation',
  searchPlaceholder: 'Search documentation',
  clearSearch: 'Clear search',
  emptyTitle: 'No articles found',
  emptyBody: 'Nothing in the documentation matches that search. Try a different word, or clear the search to see every article.',
  helpTitle: 'Still have questions?',
  helpBody: 'Can\'t find what you\'re looking for? Check the Help Center, or write to our support team.',
  helpCenter: 'Help Center',
  emailSupport: 'Email support',
  supportEmail: 'support@deckster.xyz',
  moreHelpTitle: 'Need more help?',
  moreHelpBody: 'Can\'t find what you\'re looking for? Our support team is here to help.',
  browseAll: 'Browse all docs',
  breadcrumb: 'Breadcrumb',
  home: 'Home',
  docsLabel: 'Documentation',
  navLabel: 'Documentation articles',
  navSummary: 'All articles',
  related: 'Related documentation',
  notFoundTitle: 'Article not found',
  notFoundBody: 'This documentation page does not exist, or it has moved. The list of articles has what is here today.',
  backToDocs: 'Browse documentation',
  apiNoticeTitle: 'Not available yet',
  apiNoticeBody: 'The Deckster API is not open yet. There is no API key to generate, and the endpoints below cannot be called today. This page stays for reference.',
} as const

/** "7 articles in 3 categories" with no search; "2 of 7 articles match “chart”" with one ("0 of 7 ..." when none do). */
export function studioDocsResultLine(shown: number, total: number, categories: number, query: unknown): string {
  const q = typeof query === 'string' ? query.trim() : ''
  const articles = (n: number) => `${n} ${n === 1 ? 'article' : 'articles'}`
  if (!q) return `${articles(total)} in ${categories} ${categories === 1 ? 'category' : 'categories'}`
  return `${shown} of ${articles(total)} match “${q}”`
}

/** The sections that still hold an article after the search (title or text, any case, the query trimmed); every section when the query is blank. */
export function studioDocsFilter(sections: readonly StudioDocSection[], query: unknown): { sections: StudioDocSection[]; shown: number; total: number } {
  const q = typeof query === 'string' ? query.trim().toLowerCase() : ''
  const total = sections.reduce((sum, section) => sum + section.items.length, 0)
  if (!q) return { sections: sections.map(section => ({ ...section, items: [...section.items] })), shown: total, total }
  const kept = sections
    .map(section => ({ ...section, items: section.items.filter(item => item.title.toLowerCase().includes(q) || item.content.toLowerCase().includes(q)) }))
    .filter(section => section.items.length > 0)
  return { sections: kept, shown: kept.reduce((sum, section) => sum + section.items.length, 0), total }
}

export function studioDocsHref(category: string, slug: string): string {
  return `/docs/${category}/${slug}`
}

/** The side list, built from the articles that exist (the old static list also named three articles nobody wrote). */
export function studioDocsNav(sections: readonly StudioDocSection[], category: string, slug: string) {
  return sections.map(section => ({
    id: section.id,
    title: section.title,
    items: section.items.map(item => ({
      id: item.id,
      title: item.title,
      href: studioDocsHref(item.category, item.slug),
      current: item.category === category && item.slug === slug,
    })),
  }))
}

/** The section's own title for a category id; the id itself in words ("agent-reference" -> "Agent reference") when no section has it. */
export function studioDocsCategoryTitle(sections: readonly StudioDocSection[], category: string): string {
  const section = sections.find(candidate => candidate.id === category)
  if (section) return section.title
  const words = category.split('-').filter(Boolean).join(' ')
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : ''
}

/** The article's own first heading is its title ("# Quick Start Guide"); the rest is the body. An article without one keeps the title it was listed under. */
export function studioDocsSplit(content: unknown, fallbackTitle: string): { title: string; body: string } {
  const text = typeof content === 'string' ? content : ''
  const lines = text.split('\n')
  const first = lines.findIndex(line => line.trim() !== '')
  const heading = first >= 0 ? /^#\s+(.+?)\s*#*\s*$/.exec(lines[first]) : null
  if (!heading) return { title: fallbackTitle, body: text }
  return { title: heading[1].trim(), body: lines.slice(first + 1).join('\n').replace(/^\s*\n/, '') }
}

function stripInline(line: string): string {
  return line
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(\*|_)(.+?)\1/g, '$2')
    .replace(/^\s*>+\s?/, '')
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/, '')
}

/** A card's line of text: the article's first paragraph with the markdown taken out (the old card cut raw markdown at 150 characters: "# Quick Start Guide Welcome to ..."). Cut at a word with "…" only when it is longer than max. */
export function studioDocsExcerpt(markdown: unknown, max: number = STUDIO_DOCS_EXCERPT_MAX): string {
  if (typeof markdown !== 'string') return ''
  const blocks: string[][] = [[]]
  let fenced = false
  for (const raw of markdown.split('\n')) {
    const line = raw.trim()
    if (/^(```|~~~)/.test(line)) { fenced = !fenced; blocks.push([]); continue }
    if (fenced) continue
    if (line === '' || /^#{1,6}\s/.test(line) || /^\|/.test(line) || /^(-{3,}|\*{3,}|_{3,})$/.test(line)) { blocks.push([]); continue }
    blocks[blocks.length - 1].push(stripInline(line))
  }
  const first = blocks.find(block => block.length > 0)
  const text = first ? first.join(' ').replace(/\s+/g, ' ').trim() : ''
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const space = cut.lastIndexOf(' ')
  const head = space > max * 0.6 ? cut.slice(0, space) : cut
  return `${head.replace(/[\s,;:.\-–—]+$/, '')}…`
}

/** A link inside an article: the site's own pages stay in the tab, anything else opens in a new one. */
export function studioDocsLinkKind(href: unknown): 'internal' | 'anchor' | 'external' | 'mail' {
  const value = typeof href === 'string' ? href.trim() : ''
  if (value.startsWith('#')) return 'anchor'
  if (value.startsWith('mailto:')) return 'mail'
  if (value.startsWith('/') && !value.startsWith('//')) return 'internal'
  return 'external'
}

/** Whether a link into the docs lands on a page: /docs, /docs/api, /docs/<category>/<article>. A link anywhere else on the site is not judged here (true). */
export function studioDocsLinkLands(href: unknown, sections: readonly StudioDocSection[]): boolean {
  const value = typeof href === 'string' ? href.trim() : ''
  const path = value.split(/[?#]/)[0]
  if (path !== '/docs' && !path.startsWith('/docs/')) return true
  const parts = path.split('/').filter(Boolean)
  if (parts.length === 1 || (parts.length === 2 && parts[1] === 'api')) return true
  return parts.length === 3 && sections.some(section => section.id === parts[1] && section.items.some(item => item.slug === parts[2]))
}

/** One piece of article text to swap for the current one: `doc` is "<category>/<slug>"; `from` is found once in that article's text. */
export interface StudioDocRule { doc: string; from: string; to: string }

/** The docs with the rules applied: each rule's text is swapped once, in order, in its own article, wherever it is found; an article no rule names, and a rule whose text is not found, change nothing. The sections handed in are never changed. */
export function studioDocsCurrent(sections: readonly StudioDocSection[], rules: readonly StudioDocRule[]): StudioDocSection[] {
  return sections.map(section => ({
    ...section,
    items: section.items.map(item => {
      const own = rules.filter(rule => rule.doc === `${item.category}/${item.slug}`)
      return { ...item, content: own.reduce((text, rule) => text.replace(rule.from, () => rule.to), item.content) }
    }),
  }))
}

/** The article at /docs/<category>/<slug> in these sections (the category is the section's id), or undefined. */
export function studioDocsItem(sections: readonly StudioDocSection[], category: string, slug: string): StudioDocItem | undefined {
  return sections.find(section => section.id === category)?.items.find(item => item.slug === slug)
}

/** The other articles in the open one's category, at most `limit`, in order (the same rule as lib/docs.ts, on these sections). */
export function studioDocsRelated(sections: readonly StudioDocSection[], current: StudioDocItem, limit: number = 3): StudioDocItem[] {
  const section = sections.find(candidate => candidate.id === current.category)
  return section ? section.items.filter(item => item.id !== current.id).slice(0, limit) : []
}

/** Pages the footers do not link to: /docs/api (not available yet), and /integrations and /agents (both redirect: next.config.mjs). The agent pages themselves (/agents/<agent>) are real pages and are not hidden. */
export function studioDocsHiddenHref(href: unknown): boolean {
  const path = typeof href === 'string' ? href.trim().split(/[?#]/)[0].replace(/\/+$/, '') : ''
  return path === '/docs/api' || path === '/integrations' || path === '/agents'
}

export interface StudioFooterLink { label: string; href: string }

/** The Landing footer with Help and Docs before the legal links and Security and Cookies after them; a link already there (Privacy, Terms) is never added twice. */
export function studioDocsFooterLinks<T extends StudioFooterLink>(links: readonly T[]): Array<T | StudioFooterLink> {
  const has = (href: string) => links.some(link => link.href === href)
  const legal = links.findIndex(link => link.href === '/legal/privacy' || link.href === '/legal/terms')
  const head = legal < 0 ? [...links] : links.slice(0, legal)
  const tail = legal < 0 ? [] : links.slice(legal)
  const help = [{ label: 'Help', href: '/help' }, { label: 'Docs', href: '/docs' }].filter(link => !has(link.href))
  const policy = [{ label: 'Security', href: '/legal/security' }, { label: 'Cookies', href: '/legal/cookies' }].filter(link => !has(link.href))
  return [...head, ...help, ...tail, ...policy]
}
