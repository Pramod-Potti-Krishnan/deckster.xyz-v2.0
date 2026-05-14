import { Quote } from "lucide-react"

export function SocialProofSection() {
  return (
    <section
      id="social-proof"
      className="relative isolate overflow-hidden bg-white py-20 sm:py-24"
    >
      <div className="container relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <Quote
          className="mx-auto mb-6 h-10 w-10 text-primary/35"
          aria-hidden
        />
        <blockquote className="text-balance text-2xl font-semibold leading-snug text-foreground sm:text-3xl md:text-4xl">
          <p className="italic">
            “The first AI tool where I stopped fighting the output. I describe
            the deck, then I have a conversation about it — and I leave with a
            slide I’d actually present.”
          </p>
        </blockquote>
        <footer className="mt-7 flex flex-col items-center gap-1 text-sm">
          <span className="font-semibold text-foreground">
            Strategy lead
          </span>
          <span className="text-muted-foreground">
            B2B SaaS · early-access user
          </span>
        </footer>
      </div>
    </section>
  )
}
