"use client"

import React from "react"
import { AlertCircle, RefreshCw } from "lucide-react"

/**
 * J6 pass-2 S6: one bad field must not blank the Second Brain. A render error inside a section (or, for the page-level use, anywhere on the
 * page) shows a short plain-words notice with "Try again" in that section's place; the rest of the page keeps working. Technical detail
 * (the error and the component stack) goes to the console only. Used only behind NEXT_PUBLIC_STUDIO_KNOWLEDGE_FIXES.
 *
 * `resetKey`: when it changes (a new response, a different selection, another account) a failed section is shown again.
 */
interface Props {
  /** Names the section in the console only. */
  label: string
  resetKey?: unknown
  /** The whole-page safety net uses a plainer, larger notice. */
  page?: boolean
  children?: React.ReactNode
}

interface State { failed: boolean }

export class KnowledgeSectionBoundary extends React.Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[knowledge] "${this.props.label}" could not be shown`, error, info?.componentStack)
  }

  componentDidUpdate(previous: Props) {
    if (this.state.failed && !Object.is(previous.resetKey, this.props.resetKey)) this.setState({ failed: false })
  }

  private retry = () => this.setState({ failed: false })

  render() {
    if (!this.state.failed) return this.props.children
    const page = this.props.page === true
    return (
      <div
        role="alert"
        data-studio-knowledge-role="section-fallback"
        className={page
          ? "mx-auto my-10 flex max-w-xl flex-col items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-900/60 dark:bg-amber-950/30"
          : "flex min-w-0 flex-col items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30"}
      >
        <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            {page ? "Your Second Brain could not be shown" : "This part of the page could not be shown"}
          </p>
          <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-300">
            {page
              ? "Something in the data we received did not display correctly. Nothing in your graph has changed. Try again, or refresh the page."
              : "Something in the data we received did not display correctly. The rest of the page still works. Try again, or refresh the page."}
          </p>
        </div>
        <button
          type="button"
          onClick={this.retry}
          className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-amber-800 dark:bg-transparent dark:text-amber-100 dark:hover:bg-amber-950/60"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </button>
      </div>
    )
  }
}
