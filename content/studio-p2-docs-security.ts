// PASS2 Docs, the Security page (flag NEXT_PUBLIC_STUDIO_P2_DOCS, default off). Data only: the wording of /legal/security that says only what is true today, the same words `uat` already carries
// (marketing pass 2, 3 Oct 2026, commits 8ebd7bd and 621c7d0; the page there is unflagged). PROGRAM-1 lifted Docs ruling 2 ("no legal or security wording is changed") for exactly this page on 23 Oct, because the
// page it replaces made claims nobody has verified: SOC 2 Type II, "fully compliant" with GDPR, hosting on AWS, third-party penetration tests and audits, role-based access and multi-factor login for all internal
// access, a security@ address that answers within 24 hours, "Enterprise customers" with private model instances, and compliance reports from "our sales team". What stays is what the code and the services show:
// HTTPS everywhere, the Privacy Policy, Vercel and Railway as the hosts, Google sign-in (the product never sees a password), and support@deckster.xyz as the contact. The page, its tab description and the
// footer's trust lines read this only with the flag on; off, every word is as it was.
export type StudioSecurityIcon = "lock" | "filecheck" | "server" | "key"

export interface StudioSecurityCard { icon: StudioSecurityIcon; title: string; desc: string; color: string }

export const STUDIO_SECURITY_FACTS = {
  subtitle: "How Deckster looks after your data today, and what is still planned.",
  cards: [
    { icon: "lock", title: "Encryption", desc: "Every connection, from your browser to Deckster and from Deckster to its services, uses HTTPS (TLS).", color: "text-blue-600" },
    { icon: "filecheck", title: "Data Privacy", desc: "Your presentations are yours. Our Privacy Policy explains what we collect, how it is used, and how to contact us about your data.", color: "text-green-600" },
    { icon: "server", title: "Where it runs", desc: "The web app runs on Vercel and the backend services on Railway.", color: "text-orange-600" },
    { icon: "key", title: "Sign-in", desc: "You sign in with your Google account, so Deckster never sees or stores your password. Planned: multi-factor login for all internal team access.", color: "text-indigo-600" },
  ] as readonly StudioSecurityCard[],
  dataProtection: "Your data belongs to you. Files you upload are stored in your account and read by the AI models that build your deck (Google and OpenRouter-hosted models). They are never shown to your audience by name. You can delete your knowledge graph with one button; deleting a file removes it from your list.",
  vulnerability: "We value the security community's help in keeping our platform safe. If you believe you've found a security vulnerability, please report it to support@deckster.xyz and we will get back to you.",
  questionsHeading: "Security Questions",
  questions: "Need to know how we handle your data, or have a question for a vendor review? Email support@deckster.xyz and we will get back to you.",
  /** The tab / search description (app/legal/security/layout.tsx). */
  description: "How Deckster protects your data: encryption in transit, where it runs, Google sign-in, and how to report a vulnerability.",
} as const
