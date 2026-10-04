"use client"

import { useState, useEffect, useLayoutEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sparkles, MessageSquare, Layout, Users, ArrowRight, Play, X, Target, ListChecks, FileText, Download, Globe } from "lucide-react"
import { useSession } from "next-auth/react"

import './studio-onboarding.css'

const STUDIO_ONBOARDING = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

const studioChapters = [
  { title: 'Start with a spark.', description: 'Tell the Director what you are making, who it is for and what it should help them decide.',
    cards: [{ icon: Sparkles, title: 'The topic', text: 'Start with your idea or the subject you want to explore.' },
      { icon: Users, title: 'The audience', text: 'Describe who will read or hear your presentation.' },
      { icon: Target, title: 'The outcome', text: 'Explain the decision, understanding or next step you want to support.' }],
    note: 'Use Chat to work through the brief and respond to the Director’s questions.' },
  { title: 'Shape the story.', description: 'Review your deck on the canvas, then choose a slide or element to refine.',
    cards: [{ icon: MessageSquare, title: 'Talk it through', text: 'Give feedback in Chat as the story takes shape.' },
      { icon: Layout, title: 'Work on the canvas', text: 'Choose a slide from the filmstrip. Use the available tools to add, select and edit.' },
      { icon: ListChecks, title: 'Review the details', text: 'Open the Inspector to work with the selected deck, slide or element.' }],
    note: 'Tools become available as your deck is built. The current deck and selection determine which actions you can use.' },
  { title: 'Make it ready to share.', description: 'Review the supporting words, then choose how to deliver your presentation.',
    cards: [{ icon: FileText, title: 'Script, notes and sources', text: 'Open Notes below the canvas to review each slide’s script, speaker notes and references.' },
      { icon: Download, title: 'Download a ready deck', text: 'Use Download to choose the available PDF or PowerPoint format.' },
      { icon: Globe, title: 'Manage sharing', text: 'Use Publish to review access, permitted downloads and the current sharing settings.' }],
    note: 'Available delivery actions depend on the current deck. Enter Studio to continue your work.' },
]

interface OnboardingModalProps {
  open?: boolean
  onClose?: () => void
  onCloseAutoFocus?: (event: Event) => void
  replay?: boolean
}

export function OnboardingModal({ open: controlledOpen, onClose, onCloseAutoFocus, replay = false }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [open, setOpen] = useState(false)
  const { data: session } = useSession()
  const studioTitleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (STUDIO_ONBOARDING && replay) return
    const checkOnboarding = () => {
      // Check if user has seen onboarding
      const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding')
      const isNewUser = localStorage.getItem('isNewUser')

      if (!hasSeenOnboarding && session && (isNewUser === 'true' || controlledOpen)) {
        setOpen(true)
        localStorage.removeItem('isNewUser')
      }
    }
    if (STUDIO_ONBOARDING) {
      try { checkOnboarding() } catch { /* Explicit replay still works without browser storage. */ }
    } else checkOnboarding()
  }, [session, controlledOpen, replay])

  const steps = [
    {
      title: "Welcome to deckster.xyz",
      description: "Let's take a quick tour of how AI agents collaborate to create your presentations",
      icon: <Sparkles className="h-8 w-8" />,
      content: (
        <div className="space-y-4">
          <p className="text-slate-600">
            You're about to experience a new way of creating presentations. Instead of working alone, you'll collaborate
            with a team of specialized AI agents.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <Users className="h-6 w-6 mx-auto mb-2 text-purple-600" />
              <h4 className="font-semibold">The Director</h4>
              <p className="text-sm text-slate-600">Orchestrates the entire process</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <MessageSquare className="h-6 w-6 mx-auto mb-2 text-blue-600" />
              <h4 className="font-semibold">The Scripter</h4>
              <p className="text-sm text-slate-600">Writes compelling content</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <Layout className="h-6 w-6 mx-auto mb-2 text-green-600" />
              <h4 className="font-semibold">The Graphic Artist</h4>
              <p className="text-sm text-slate-600">Creates visual elements</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "The Dual-Pane Interface",
      description: "Your workspace is split into Mission Control and the Living Canvas",
      icon: <Layout className="h-8 w-8" />,
      content: (
        <div className="space-y-4">
          <p className="text-slate-600">
            The interface is designed for seamless collaboration between you and the AI agents.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">Mission Control (Left)</h4>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>• Chat with The Director</li>
                <li>• Give high-level instructions</li>
                <li>• Monitor agent progress</li>
                <li>• Provide feedback</li>
              </ul>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">Living Canvas (Right)</h4>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>• Interactive slide preview</li>
                <li>• Click to select elements</li>
                <li>• Real-time updates</li>
                <li>• Navigate between slides</li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Let's Create Your First Presentation",
      description: "Try the system with a simple example to see how it works",
      icon: <Play className="h-8 w-8" />,
      content: (
        <div className="space-y-4">
          <p className="text-slate-600">
            We'll create a sample presentation about "The Future of Remote Work" to demonstrate the collaborative
            process.
          </p>
          <div className="p-4 bg-slate-50 rounded-lg">
            <h4 className="font-semibold mb-2">What you'll see:</h4>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>• The Director analyzing your request</li>
              <li>• The Scripter writing slide content</li>
              <li>• The Graphic Artist suggesting visuals</li>
              <li>• Real-time slide generation</li>
            </ul>
          </div>
          <Badge className="bg-green-100 text-green-700">
            This is your Free tier experience - upgrade for advanced features!
          </Badge>
        </div>
      ),
    },
  ]

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleClose()
    }
  }

  const handleClose = () => {
    if (STUDIO_ONBOARDING) {
      try { localStorage.setItem('hasSeenOnboarding', 'true') } catch { /* Dismissal remains available. */ }
    } else localStorage.setItem('hasSeenOnboarding', 'true')
    setOpen(false)
    onClose?.()
  }

  const handleSkip = () => {
    handleClose()
  }

  const isOpen = controlledOpen !== undefined ? controlledOpen : open

  useLayoutEffect(() => {
    if (STUDIO_ONBOARDING && isOpen) setCurrentStep(0)
  }, [isOpen])

  if (STUDIO_ONBOARDING) {
    const chapter = studioChapters[currentStep]
    return <Dialog open={isOpen} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent data-studio-v4-shell="true" data-studio-onboarding="true"
        onCloseAutoFocus={onCloseAutoFocus}
        onOpenAutoFocus={(event) => { event.preventDefault(); studioTitleRef.current?.focus() }}>
        <DialogHeader className="studio-onboarding-header">
          <span className="studio-onboarding-eyebrow">Deckster / Studio · A quick introduction</span>
          <DialogTitle ref={studioTitleRef} tabIndex={-1} aria-live="polite">{chapter.title}</DialogTitle>
          <DialogDescription>{chapter.description}</DialogDescription>
        </DialogHeader>
        <div className="studio-onboarding-body">
          <ol className="studio-onboarding-chapters" aria-label="Introduction chapters">
            {['The spark', 'The story', 'Your stage'].map((label, index) => <li key={label} aria-current={currentStep === index ? 'step' : undefined}><b>{index + 1}</b>{label}</li>)}
          </ol>
          <div className="studio-onboarding-cards">
            {chapter.cards.map(({ icon: Icon, title, text }) => <article key={title}><Icon aria-hidden="true" /><h3>{title}</h3><p>{text}</p></article>)}
          </div>
          <p className="studio-onboarding-note">{chapter.note}</p>
        </div>
        <footer className="studio-onboarding-footer">
          <Button variant="ghost" onClick={handleSkip}>Skip introduction</Button>
          <div>
            <Button variant="ghost" disabled={currentStep === 0} onClick={() => setCurrentStep(currentStep - 1)}>Back</Button>
            <Button className="studio-onboarding-next" onClick={handleNext}>{currentStep === steps.length - 1 ? 'Enter Studio' : 'Next'}<ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4"
          onClick={handleClose}
        >
          <X className="h-4 w-4" />
        </Button>
        
        <DialogHeader className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            {steps[currentStep].icon}
          </div>
          <DialogTitle className="text-2xl">{steps[currentStep].title}</DialogTitle>
          <DialogDescription className="text-lg">{steps[currentStep].description}</DialogDescription>
          <div className="mt-4">
            <Progress value={((currentStep + 1) / steps.length) * 100} className="w-full" />
            <p className="text-sm text-slate-500 mt-2">
              Step {currentStep + 1} of {steps.length}
            </p>
          </div>
        </DialogHeader>
        
        <div className="mt-6 space-y-6">
          {steps[currentStep].content}

          <div className="flex items-center justify-between pt-6">
            <Button variant="ghost" onClick={handleSkip}>
              Skip Tutorial
            </Button>
            <Button onClick={handleNext}>
              {currentStep === steps.length - 1 ? "Start Building" : "Next"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}