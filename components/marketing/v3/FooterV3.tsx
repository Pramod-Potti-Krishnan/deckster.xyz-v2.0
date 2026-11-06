import Link from "next/link"
import { V3_CONTENT } from "@/lib/marketing/v3-content"
import { studioDocsFooterLinks } from "@/lib/studio-p2-docs"

// PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS, default off): Help, Docs, Security and Cookies join Privacy and Terms (no other link on the Landing reached them). Off: the footer as it was.
const STUDIO_P2_DOCS = process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === "true"

export function FooterV3() {
  const links = STUDIO_P2_DOCS ? studioDocsFooterLinks(V3_CONTENT.footer.links) : V3_CONTENT.footer.links
  return (
    <footer className="ftr">
      <div className="ftr__in">
        <span>{V3_CONTENT.footer.copyright}</span>
        <nav aria-label="Footer navigation">
          {links.map((link) => <Link key={link.label} href={link.href}>{link.label}</Link>)}
        </nav>
      </div>
    </footer>
  )
}
