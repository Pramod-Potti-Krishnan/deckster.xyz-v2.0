"use client"

import { ArrowUpRight, BookOpen, Lightbulb, ListChecks, Sparkles } from "lucide-react"

export type StudioDirectorConnectionState = "connecting" | "connected" | "disconnected" | "error"

export interface StudioPresentationContext {
  title?: string | null
  slideCount?: number | null
}

interface StudioWelcomeProps {
  presentationContext?: StudioPresentationContext

  onDraftPrompt?: (text: string) => void
  connectionState?: StudioDirectorConnectionState
  busy?: boolean
}

const STARTERS = [
  {
    id: "pitch",
    label: "Pitch an idea",
    detail: "Make the case for something new",
    icon: Lightbulb,
    prompt: "Help me create a presentation to pitch [idea] to [audience]. The decision I want them to make is [decision].",
  },
  {
    id: "update",
    label: "Share a project update",
    detail: "Progress, lessons and what comes next",
    icon: ListChecks,
    prompt: "Help me create a project update for [audience] about [project]. Cover our progress, the challenges, and the next steps.",
  },
  {
    id: "explain",
    label: "Explain a topic",
    detail: "Turn a complex idea into a clear story",
    icon: BookOpen,
    prompt: "Help me explain [topic] to [audience]. They should leave understanding [key takeaway].",
  },
]

const CONTINUATION_STARTERS = [
  {
    id: "refine-message",
    label: "Refine a slide",
    detail: "Describe the change you want",
    icon: Lightbulb,
    prompt: "Help me refine [slide or section] in the current presentation for [audience]. I want to improve [message or outcome].",
  },
  {
    id: "review-story",
    label: "Review the story",
    detail: "Focus on the audience and takeaway",
    icon: BookOpen,
    prompt: "Help me review the story of the current presentation for [audience]. Focus on [concern or goal].",
  },
  {
    id: "update-content",
    label: "Update the content",
    detail: "Add the details that have changed",
    icon: ListChecks,
    prompt: "Help me update [slide or section] in the current presentation with [new content]. Keep [parts that should stay the same].",
  },
]

const CONNECTION_LABELS: Record<StudioDirectorConnectionState, string> = {
  connecting: "Connecting to Director…",
  connected: "Director connected",
  disconnected: "Director disconnected · you can draft meanwhile",
  error: "Connection needs attention · you can draft meanwhile",
}

/** Local guidance, not a Director message. Starters only request an editable draft. */
export function StudioWelcome({ onDraftPrompt, connectionState, busy = false, presentationContext }: StudioWelcomeProps) {
  const continuing = Boolean(presentationContext)
  const starters = continuing ? CONTINUATION_STARTERS : STARTERS
  const title = presentationContext?.title?.trim()
  const slideCount = presentationContext?.slideCount
  const hasSlideCount = typeof slideCount === "number" && Number.isInteger(slideCount) && slideCount > 0
  return (
    <section data-studio-director-welcome="true" data-studio-director-welcome-context={continuing ? "presentation" : undefined} aria-label={continuing ? "Continue with your presentation" : "Getting started with your presentation"}>
      <div data-studio-director-welcome-part="eyebrow"><Sparkles size={13} aria-hidden="true" />{continuing ? "Your current presentation" : "Your presentation brief"}</div>
      <h2>{continuing ? "What would you like to change?" : "What are we making?"}</h2>
      <p data-studio-director-welcome-part="intro">{continuing ? "Describe your next change in chat. Name the slide or section and the message you want to improve." : "Start with your topic, who it’s for, and what you want them to take away. Director can help shape the story from there."}</p>
      {continuing && (title || hasSlideCount) && (
        <p data-studio-director-welcome-part="presentation">
          {title && <strong>{title}</strong>}
          {hasSlideCount && <span>{slideCount} {slideCount === 1 ? "slide" : "slides"}</span>}
        </p>
      )}
      <div data-studio-director-welcome-part="brief">
        <span><b>{continuing ? "Slide" : "Topic"}</b>{continuing ? "Which part needs attention?" : "What is the presentation about?"}</span>
        <span><b>{continuing ? "Change" : "Audience"}</b>{continuing ? "What should improve?" : "Who will be in the room?"}</span>
        <span><b>{continuing ? "Keep" : "Outcome"}</b>{continuing ? "What should stay as it is?" : "What should they think or do?"}</span>
      </div>
      {onDraftPrompt && (
        <div data-studio-director-welcome-part="starters">
          <p data-studio-director-welcome-part="caption">{continuing ? "Start your next change" : "Need a starting point?"}</p>
          {starters.map(({ id, label, detail, icon: Icon, prompt }) => (
            <button
              key={id}
              type="button"
              data-studio-director-starter={id}
              disabled={busy}
              aria-label={`Draft a starter: ${label}`}
              onClick={() => { if (!busy) onDraftPrompt(prompt) }}
            >
              <Icon size={16} aria-hidden="true" />
              <span><strong>{label}</strong><small>{detail}</small></span>
              <ArrowUpRight size={14} aria-hidden="true" />
            </button>
          ))}
          <p data-studio-director-welcome-part="hint">{busy ? "Director is working. Starters will be available when this step finishes." : "Choose a starter to add an editable draft below. Fill in the brackets, then send when you’re ready."}</p>
        </div>
      )}
      {connectionState && <p data-studio-director-welcome-part="connection" data-connection-state={connectionState} role="status">{CONNECTION_LABELS[connectionState]}</p>}
    </section>
  )
}
