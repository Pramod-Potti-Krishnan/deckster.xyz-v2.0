"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ArrowRight, Search } from "lucide-react"
import { Header, Footer } from "@/components/layout"
import { getAllDocs } from "@/lib/docs"
import { STUDIO_DOCS_AGENT_RULES } from "@/content/studio-p2-docs-agents"
import { STUDIO_DOCS_FACT_RULES } from "@/content/studio-p2-docs-facts"
import {
  STUDIO_DOCS_WORDS as W,
  studioDocsCategoryTitle,
  studioDocsCurrent,
  studioDocsExcerpt,
  studioDocsFilter,
  studioDocsHref,
  studioDocsItem,
  studioDocsLinkKind,
  studioDocsLinkLands,
  studioDocsNav,
  studioDocsRelated,
  studioDocsResultLine,
  studioDocsSplit,
} from "@/lib/studio-p2-docs"
import "./studio-p2-docs.css"

// PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS): /docs and /docs/<category>/<article> in the Studio shell's tokens. The site's own header and footer stay (these are public pages); the body is the shell's.
// The same articles, the same search, the same links as before. No new action. The text names the current agents (content/studio-p2-docs-agents.ts) and says what the product does today: the plans, the Google sign-in
// (content/studio-p2-docs-facts.ts, applied after the agent rules); content/docs.ts itself is not changed.
const RULES = [...STUDIO_DOCS_AGENT_RULES, ...STUDIO_DOCS_FACT_RULES]

function Page({ kind, children }: { kind: string; children: ReactNode }) {
  return (
    <div data-studio-p2-docs-page={kind} className="sd-page">
      <Header />
      {children}
      <Footer />
    </div>
  )
}

function HelpBand({ title, body, secondary }: { title: string; body: string; secondary: ReactNode }) {
  return (
    <aside className="sd-help" aria-labelledby="sd-help-title">
      <h2 id="sd-help-title">{title}</h2>
      <p>{body}</p>
      <div className="sd-actions">
        <Link href="/help" className="sd-button sd-button--primary">{W.helpCenter}</Link>
        {secondary}
      </div>
    </aside>
  )
}

export function StudioDocsIndex() {
  const sections = studioDocsCurrent(getAllDocs(), RULES)
  const [query, setQuery] = useState("")
  const found = studioDocsFilter(sections, query)
  return (
    <Page kind="index">
      <main className="sd-main container mx-auto px-4">
        <header className="sd-hero">
          <span className="sd-eyebrow">{W.eyebrow}</span>
          <h1>{W.title}</h1>
          <p>{W.lede}</p>
          <div className="sd-search">
            <Search aria-hidden="true" size={15} />
            <input type="search" aria-label={W.searchLabel} placeholder={W.searchPlaceholder} value={query} onChange={event => setQuery(event.target.value)} />
          </div>
          <p className="sd-count" role="status">{studioDocsResultLine(found.shown, found.total, sections.length, query)}</p>
        </header>

        {found.sections.length > 0 ? found.sections.map(section => (
          <section key={section.id} className="sd-section" aria-labelledby={`sd-section-${section.id}`}>
            <h2 id={`sd-section-${section.id}`}>{section.title}</h2>
            <ul className="sd-cards">
              {section.items.map(doc => (
                <li key={doc.id}>
                  <Link href={studioDocsHref(doc.category, doc.slug)} className="sd-card">
                    <span className="sd-card__title">{doc.title}<ArrowRight aria-hidden="true" size={14} /></span>
                    <span className="sd-card__text">{studioDocsExcerpt(doc.content)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )) : (
          <div className="sd-empty" data-studio-p2-docs-state="empty">
            <h2>{W.emptyTitle}</h2>
            <p>{W.emptyBody}</p>
            <div className="sd-actions">
              <button type="button" className="sd-button" onClick={() => setQuery("")}>{W.clearSearch}</button>
            </div>
          </div>
        )}

        <HelpBand
          title={W.helpTitle}
          body={W.helpBody}
          secondary={<a href={`mailto:${W.supportEmail}`} className="sd-button">{W.emailSupport}</a>}
        />
      </main>
    </Page>
  )
}

function NavList({ nav }: { nav: ReturnType<typeof studioDocsNav> }) {
  return (
    <>
      {nav.map(section => (
        <div key={section.id} className="sd-side__group">
          <p className="sd-side__title">{section.title}</p>
          <ul>
            {section.items.map(item => (
              <li key={item.id}><Link href={item.href} aria-current={item.current ? "page" : undefined}>{item.title}</Link></li>
            ))}
          </ul>
        </div>
      ))}
    </>
  )
}

export function StudioDocArticle() {
  const params = useParams()
  const pick = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? ""
  const category = pick(params?.category)
  const slug = pick(params?.slug)
  const sections = studioDocsCurrent(getAllDocs(), RULES)
  const doc = studioDocsItem(sections, category, slug)

  if (!doc) {
    return (
      <Page kind="not-found">
        <main className="sd-main sd-main--narrow container mx-auto px-4">
          <div className="sd-empty" data-studio-p2-docs-state="not-found">
            <h1>{W.notFoundTitle}</h1>
            <p>{W.notFoundBody}</p>
            <div className="sd-actions">
              <Link href="/docs" className="sd-button sd-button--primary">{W.backToDocs}</Link>
              <Link href="/help" className="sd-button">{W.helpCenter}</Link>
            </div>
          </div>
        </main>
      </Page>
    )
  }

  const nav = studioDocsNav(sections, doc.category, doc.slug)
  const { title, body } = studioDocsSplit(doc.content, doc.title)
  const related = studioDocsRelated(sections, doc)
  return (
    <Page kind="article">
      <nav className="sd-crumbs container mx-auto px-4" aria-label={W.breadcrumb}>
        <ol>
          <li><Link href="/">{W.home}</Link></li>
          <li><Link href="/docs">{W.docsLabel}</Link></li>
          <li aria-current="page">{doc.title}</li>
        </ol>
      </nav>
      <div className="sd-layout container mx-auto px-4">
        <nav className="sd-side" aria-label={W.navLabel}><NavList nav={nav} /></nav>
        <main className="sd-article">
          <details className="sd-side-mobile">
            <summary>{W.navSummary}</summary>
            <nav aria-label={W.navLabel}><NavList nav={nav} /></nav>
          </details>
          <header className="sd-article__head">
            <span className="sd-eyebrow">{studioDocsCategoryTitle(sections, doc.category)}</span>
            <h1>{title}</h1>
          </header>
          <div className="sd-prose">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h2>{children}</h2>,
                table: ({ children }) => <div className="sd-table"><table>{children}</table></div>,
                a: ({ href, children }) => {
                  const kind = studioDocsLinkKind(href)
                  if (kind === "internal") {
                    return studioDocsLinkLands(href, sections)
                      ? <Link href={href as string}>{children}</Link>
                      : <span data-studio-p2-docs-dead-link="true">{children}</span>
                  }
                  if (kind === "external") return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
                  return <a href={href}>{children}</a>
                },
              }}
            >
              {body}
            </ReactMarkdown>
          </div>

          {related.length > 0 && (
            <section className="sd-section" aria-labelledby="sd-related-title">
              <h2 id="sd-related-title">{W.related}</h2>
              <ul className="sd-cards sd-cards--three">
                {related.map(item => (
                  <li key={item.id}>
                    <Link href={studioDocsHref(item.category, item.slug)} className="sd-card">
                      <span className="sd-card__title">{item.title}<ArrowRight aria-hidden="true" size={14} /></span>
                      <span className="sd-card__text">{studioDocsExcerpt(item.content, 100)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <HelpBand
            title={W.moreHelpTitle}
            body={W.moreHelpBody}
            secondary={<Link href="/docs" className="sd-button">{W.browseAll}</Link>}
          />
        </main>
      </div>
    </Page>
  )
}
