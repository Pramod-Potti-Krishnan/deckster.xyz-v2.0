"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Sparkles,
  MessageSquare,
  Layout,
  Users,
  ArrowRight,
  Play,
  Briefcase,
  GraduationCap,
  TrendingUp,
  Palette,
  BarChart3,
  Rocket,
  FileText,
  CheckCircle2,
  PartyPopper,
  Target,
  UserCircle,
  FileUp
} from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const router = useRouter()

  // Personalization data
  const [useCase, setUseCase] = useState("")
  const [role, setRole] = useState("")
  const [teamSize, setTeamSize] = useState("")
  const [startingPoint, setStartingPoint] = useState("")

  const useCases = [
    { id: "sales", label: "Sales Pitches", icon: TrendingUp, description: "Win more deals with compelling pitch decks" },
    { id: "marketing", label: "Marketing Decks", icon: Palette, description: "Showcase campaigns and results" },
    { id: "education", label: "Educational Content", icon: GraduationCap, description: "Teach and train effectively" },
    { id: "business", label: "Business Reports", icon: BarChart3, description: "Present data and insights" },
    { id: "creative", label: "Creative Projects", icon: Sparkles, description: "Portfolios and showcases" },
    { id: "startup", label: "Startup Pitches", icon: Rocket, description: "Fundraising and investor decks" }
  ]

  const roles = [
    { id: "marketer", label: "Marketer" },
    { id: "sales", label: "Sales Professional" },
    { id: "educator", label: "Educator" },
    { id: "founder", label: "Founder/Entrepreneur" },
    { id: "designer", label: "Designer" },
    { id: "consultant", label: "Consultant" },
    { id: "student", label: "Student" },
    { id: "other", label: "Other" }
  ]

  const teamSizes = [
    { id: "solo", label: "Just me", description: "Individual creator" },
    { id: "small", label: "2-10 people", description: "Small team" },
    { id: "medium", label: "11-50 people", description: "Growing organization" },
    { id: "large", label: "50+ people", description: "Enterprise team" }
  ]

  const steps = [
    {
      title: "Welcome to Deckster",
      description: "Let's personalize your experience in just a few steps",
      icon: <Sparkles className="h-8 w-8 text-white" />,
      content: (
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Sparkles className="h-12 w-12 text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-4">Welcome to the Future of Presentations</h3>
            <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
              You're about to experience presentation creation powered by a team of specialized AI agents.
              Let's customize your experience in just 4 quick steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <Users className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <h4 className="font-semibold">Director</h4>
              <p className="text-sm text-muted-foreground">Strategic planning</p>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <h4 className="font-semibold">Scripter</h4>
              <p className="text-sm text-muted-foreground">Compelling content</p>
            </div>
            <div className="text-center p-4 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
              <Layout className="h-8 w-8 mx-auto mb-2 text-pink-600" />
              <h4 className="font-semibold">Graphic Artist</h4>
              <p className="text-sm text-muted-foreground">Beautiful design</p>
            </div>
            <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <BarChart3 className="h-8 w-8 mx-auto mb-2 text-emerald-600" />
              <h4 className="font-semibold">Data Visualizer</h4>
              <p className="text-sm text-muted-foreground">Clear insights</p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "What will you use Deckster for?",
      description: "Help us understand your main use case",
      icon: <Target className="h-8 w-8 text-white" />,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {useCases.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => setUseCase(item.id)}
                  className={`p-4 border-2 rounded-lg text-left transition-all hover:shadow-lg ${
                    useCase === item.id
                      ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-border hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      useCase === item.id ? 'bg-purple-600 text-white' : 'bg-muted'
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">{item.label}</h4>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                    {useCase === item.id && (
                      <CheckCircle2 className="h-5 w-5 text-purple-600" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )
    },
    {
      title: "What's your role?",
      description: "This helps us provide relevant templates and tips",
      icon: <UserCircle className="h-8 w-8 text-white" />,
      content: (
        <div className="space-y-4">
          <RadioGroup value={role} onValueChange={setRole} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {roles.map((item) => (
              <div key={item.id}>
                <RadioGroupItem value={item.id} id={item.id} className="peer sr-only" />
                <Label
                  htmlFor={item.id}
                  className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-purple-600 peer-data-[state=checked]:bg-purple-50 dark:peer-data-[state=checked]:bg-purple-900/20 cursor-pointer transition-all"
                >
                  <span className="text-sm font-medium">{item.label}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      )
    },
    {
      title: "Team size?",
      description: "Help us recommend the right plan for you",
      icon: <Users className="h-8 w-8 text-white" />,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teamSizes.map((item) => (
              <button
                key={item.id}
                onClick={() => setTeamSize(item.id)}
                className={`p-6 border-2 rounded-lg text-center transition-all hover:shadow-lg ${
                  teamSize === item.id
                    ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-border hover:border-purple-300'
                }`}
              >
                <h4 className="font-semibold text-lg mb-2">{item.label}</h4>
                <p className="text-sm text-muted-foreground mb-3">{item.description}</p>
                {teamSize === item.id && (
                  <Badge className="bg-purple-600">Selected</Badge>
                )}
              </button>
            ))}
          </div>
          {teamSize === 'large' && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Enterprise features available:</strong> Team collaboration, SSO, dedicated support, and more.{' '}
                <Link href="/pricing" className="underline font-medium">Learn more</Link>
              </p>
            </div>
          )}
        </div>
      )
    },
    {
      title: "Choose your starting point",
      description: "How would you like to begin?",
      icon: <Play className="h-8 w-8 text-white" />,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setStartingPoint('scratch')}
              className={`p-6 border-2 rounded-lg text-left transition-all hover:shadow-lg ${
                startingPoint === 'scratch'
                  ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-border hover:border-purple-300'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${
                  startingPoint === 'scratch' ? 'bg-purple-600 text-white' : 'bg-muted'
                }`}>
                  <FileText className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-lg mb-2">Create from scratch</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Start with a blank canvas and describe what you want to create
                  </p>
                  {startingPoint === 'scratch' && (
                    <Badge className="bg-purple-600">Recommended for you</Badge>
                  )}
                </div>
              </div>
            </button>

            <button
              onClick={() => setStartingPoint('template')}
              className={`p-6 border-2 rounded-lg text-left transition-all hover:shadow-lg ${
                startingPoint === 'template'
                  ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-border hover:border-purple-300'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${
                  startingPoint === 'template' ? 'bg-purple-600 text-white' : 'bg-muted'
                }`}>
                  <Layout className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-lg mb-2">Use a template</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Browse our gallery of professional templates
                  </p>
                  {startingPoint === 'template' && (
                    <Badge className="bg-purple-600">Selected</Badge>
                  )}
                </div>
              </div>
            </button>
          </div>

          {startingPoint === 'scratch' && useCase && (
            <div className="p-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-lg border-2 border-purple-200 dark:border-purple-800">
              <h4 className="font-semibold mb-3">Try these prompts to get started:</h4>
              <div className="space-y-2">
                {getPromptSuggestions(useCase).map((prompt, index) => (
                  <button
                    key={index}
                    className="w-full text-left p-3 bg-white dark:bg-gray-900 rounded-lg border border-purple-200 dark:border-purple-800 hover:border-purple-400 dark:hover:border-purple-600 hover:shadow-md transition-all text-sm"
                  >
                    <span className="text-purple-600 dark:text-purple-400 font-medium mr-2">→</span>
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    }
  ]

  const getPromptSuggestions = (useCase: string) => {
    const prompts: Record<string, string[]> = {
      sales: [
        "Create a product pitch deck for a B2B SaaS platform",
        "Build a sales proposal for enterprise clients",
        "Make a customer success story presentation"
      ],
      marketing: [
        "Create a Q4 marketing campaign results presentation",
        "Build a social media strategy deck for 2025",
        "Make a brand positioning presentation"
      ],
      education: [
        "Create a lecture on Introduction to Machine Learning",
        "Build a training workshop on effective communication",
        "Make a course overview presentation for students"
      ],
      business: [
        "Create a quarterly business review for executives",
        "Build a project status report with timeline",
        "Make a strategic planning presentation for 2025"
      ],
      creative: [
        "Create a creative portfolio showcasing recent work",
        "Build a design case study presentation",
        "Make an agency capabilities deck"
      ],
      startup: [
        "Create a Series A fundraising pitch deck",
        "Build a product roadmap presentation for investors",
        "Make a startup overview for potential partners"
      ]
    }
    return prompts[useCase] || [
      "Create a professional presentation about...",
      "Build a compelling deck for...",
      "Make an engaging presentation on..."
    ]
  }

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      setIsLoading(true)
      setTimeout(() => {
        setShowSuccess(true)
        setIsLoading(false)
      }, 1000)
    }
  }

  const handleFinish = () => {
    if (startingPoint === 'template') {
      router.push('/templates')
    } else {
      router.push('/builder')
    }
  }

  const handleSkip = () => {
    router.push('/dashboard')
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0: return true
      case 1: return useCase !== ""
      case 2: return role !== ""
      case 3: return teamSize !== ""
      case 4: return startingPoint !== ""
      default: return true
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl shadow-2xl">
        <CardHeader className="text-center pb-6">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
              {steps[currentStep].icon}
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">{steps[currentStep].title}</CardTitle>
          <CardDescription className="text-lg mt-2">{steps[currentStep].description}</CardDescription>
          <div className="mt-6">
            <Progress value={((currentStep + 1) / steps.length) * 100} className="w-full h-2" />
            <p className="text-sm text-muted-foreground mt-2">
              Step {currentStep + 1} of {steps.length}
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {steps[currentStep].content}

          <div className="flex items-center justify-between pt-6 border-t">
            <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground">
              Skip to Dashboard
            </Button>
            <div className="flex gap-3">
              {currentStep > 0 && (
                <Button variant="outline" onClick={() => setCurrentStep(currentStep - 1)}>
                  Back
                </Button>
              )}
              <Button
                onClick={handleNext}
                disabled={!canProceed() || isLoading}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                {isLoading ? "Processing..." : currentStep === steps.length - 1 ? "Let's Go!" : "Continue"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Success Celebration Dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
              <PartyPopper className="h-8 w-8 text-white" />
            </div>
            <DialogTitle className="text-2xl">You're All Set!</DialogTitle>
            <DialogDescription className="text-base mt-2">
              Your workspace is ready. Time to create something amazing with your AI team!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-purple-600 flex-shrink-0" />
                <span className="text-sm">Profile personalized</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <span className="text-sm">AI agents ready to collaborate</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-pink-600 flex-shrink-0" />
                <span className="text-sm">Templates and examples available</span>
              </div>
            </div>

            <div className="pt-4">
              <Button
                onClick={handleFinish}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                size="lg"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {startingPoint === 'template' ? 'Browse Templates' : 'Start Creating'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
