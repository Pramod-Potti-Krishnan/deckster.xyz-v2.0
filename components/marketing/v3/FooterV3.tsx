import Link from "next/link"
import { V3_CONTENT } from "@/lib/marketing/v3-content"

export function FooterV3() {
  return (
    <footer className="ftr">
      <div className="ftr__in">
        <span>{V3_CONTENT.footer.copyright}</span>
        <nav aria-label="Footer navigation">
          {V3_CONTENT.footer.links.map((link) => <Link key={link.label} href={link.href}>{link.label}</Link>)}
        </nav>
      </div>
    </footer>
  )
}
