import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
        That page isn&apos;t here.
      </h1>
      <p className="mt-4 max-w-md text-balance text-lg text-muted-foreground">
        The link may be old or mistyped. Head back home, or browse the guides.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Back to home
        </Link>
        <Link
          href="/learn"
          className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-6 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Browse the guides
        </Link>
      </div>
    </main>
  )
}
