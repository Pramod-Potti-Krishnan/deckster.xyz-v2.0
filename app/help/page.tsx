"use client"

import { useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Header, Footer } from "@/components/layout"
import { PageHeader } from "@/components/marketing/PageHeader"
import { Section } from "@/components/marketing/Section"
import {
  BookOpen,
  MessageSquare,
  Video,
  FileQuestion,
  Mail,
  ExternalLink,
  Search,
  ChevronRight,
  Sparkles,
  Users,
  Zap,
  Shield
} from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Metadata } from "next"

// Force dynamic rendering to prevent build-time errors
export const dynamic = 'force-dynamic'

interface FAQItem {
  question: string
  answer: string
  category: string
}



export default function HelpPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")

  // Contact form state
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const faqItems: FAQItem[] = [
    {
      category: "Getting Started",
      question: "How do I create my first presentation?",
      answer: "Click the 'New Presentation' button from your dashboard or builder page. Then, simply describe what you want to create in the chat interface, and our AI agents will generate slides for you."
    },
    {
      category: "Getting Started",
      question: "What are AI agents and how do they work?",
      answer: "Deckster runs as eight specialists: the Director orchestrates, while the Researcher, Analyst, Content Generator, Visualizer, Theme Builder, Slide Composer, and Element Generator each own one part of the deck. They work together to build your presentation."
    },
    {
      category: "Features",
      question: "Can I edit slides after they're generated?",
      answer: "Yes! Click on any element in a slide to edit it directly. You can modify text, change layouts, add images, and customize everything to your needs."
    },
    {
      category: "Features",
      question: "How do I add attachments or data files?",
      answer: "Use the attach button in the chat. Drag and drop or click to browse — documents, images, and spreadsheets (CSV, Excel) become source material the Researcher can pull from."
    },
    {
      category: "Billing",
      question: "How do plans and credits work?",
      answer: "Every plan includes a monthly pool of credits the agents draw on as they build. Starter is $20/user/mo; Pro and Max add more capability and credits. Top up anytime in a busy month."
    },
    {
      category: "Billing",
      question: "How do I upgrade my subscription?",
      answer: "Go to your Profile > Billing & Subscription, or see the pricing page. Choose Starter ($20), Pro ($50), or Max ($100) per user / month."
    },
    {
      category: "Troubleshooting",
      question: "My presentation isn't loading. What should I do?",
      answer: "Try refreshing the page first. If the issue persists, check your internet connection and clear your browser cache. Contact support if the problem continues."
    },
    {
      category: "Troubleshooting",
      question: "Why can't I sign in with Google?",
      answer: "Ensure pop-ups are enabled for this site and cookies are not blocked. Try using a different browser or incognito mode. Make sure you're using a valid Google account."
    },
    {
      category: "Getting Started",
      question: "Do I need to install any software?",
      answer: "No! Deckster is entirely web-based. Just sign in through your browser and you're ready to go. Works on Chrome, Firefox, Safari, and Edge."
    },
    {
      category: "Getting Started",
      question: "Can I use templates instead of starting from scratch?",
      answer: "Absolutely! Visit the Templates page to browse professional starting points, then let the agents shape one into your deck."
    },
    {
      category: "Features",
      question: "How many slides can I create in one presentation?",
      answer: "There's no fixed cap on slides. Usage runs on monthly credits that scale with your plan (Starter, Pro, Max), and you can top up anytime."
    },
    {
      category: "Features",
      question: "Can I share a presentation with someone?",
      answer: "Yes — export to PowerPoint or PDF and send the file to anyone. (Live multi-user editing isn't available yet.)"
    },
    {
      category: "AI Agents",
      question: "How do I know which agents are working on my presentation?",
      answer: "As the team works, the builder streams what it's doing — so you can watch the agents research, write, and design your deck in real time."
    },
    {
      category: "AI Agents",
      question: "Can I ask for a specific change?",
      answer: "Yes — just say it in chat: 'make the intro more engaging' or 'turn this into a bar chart.' The Director routes your request to the right specialist."
    },
    {
      category: "AI Agents",
      question: "What do the higher tiers add?",
      answer: "Starter covers the full creation engine. Pro adds the Researcher (live web + your uploaded files) and the Analyst. Max adds the Knowledge Graph, which learns your domain across decks."
    },
    {
      category: "Exporting & Sharing",
      question: "What export formats are available?",
      answer: "You can export to PowerPoint (.pptx) and PDF — both with no watermark, preserving your presentation's design and theme."
    },
    {
      category: "Exporting & Sharing",
      question: "Can I download my presentations for offline use?",
      answer: "Yes — export to PowerPoint or PDF and the file is yours to present offline, anywhere."
    },
    {
      category: "Exporting & Sharing",
      question: "How do I share a presentation with someone who doesn't have Deckster?",
      answer: "Export to PDF or PowerPoint and send the file by email or any file-sharing service — no Deckster account needed to view it."
    },
    {
      category: "Billing",
      question: "How do I get started?",
      answer: "Pick a plan on the pricing page and open the builder — your monthly credits start right away. See the pricing page for current details."
    },
    {
      category: "Billing",
      question: "What happens if I downgrade my plan?",
      answer: "Your existing presentations are preserved. Moving to a lower tier keeps your work but drops that tier's extras — for example, the Researcher and Analyst are on Pro and up."
    },
    {
      category: "Billing",
      question: "How is billing handled?",
      answer: "Plans are billed per user, per month, with top-up credits available anytime. For any billing question, contact support and we'll help."
    },
    {
      category: "Troubleshooting",
      question: "The AI agents aren't responding. What should I check?",
      answer: "Ensure you have an active internet connection and haven't reached your plan's usage limits. Try refreshing the page. If issues persist, contact support."
    },
    {
      category: "Troubleshooting",
      question: "My export is taking too long. Is this normal?",
      answer: "Export times vary by presentation size. Most exports complete within 30-60 seconds. Large presentations (50+ slides) may take longer. You'll receive a notification when it's ready."
    },
    {
      category: "Troubleshooting",
      question: "How do I report a bug or suggest a feature?",
      answer: "Use the contact form on this page or email support@deckster.xyz. For feature requests, we love detailed descriptions of how the feature would help your workflow!"
    }
  ]

  const filteredFAQ = faqItems.filter(item => {
    const matchesSearch = item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const categories = ["all", ...Array.from(new Set(faqItems.map(item => item.category)))]

  const handleSubmitSupport = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // TODO: Implement actual support ticket submission
    await new Promise(resolve => setTimeout(resolve, 1500))

    setIsSubmitting(false)
    setShowSuccess(true)
    setSubject("")
    setMessage("")

    setTimeout(() => setShowSuccess(false), 5000)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Main Content */}
      <PageHeader
        title="Stuck? Let's get you unblocked"
        subtitle="Answers, quick-start steps, and a direct line to support — so you can get back to building your deck."
        badge={{
          text: "We're here to help",
          icon: <Shield className="h-3 w-3" />
        }}
      />

      {/* Main Content */}
      <Section className="flex-1 py-8">

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: BookOpen, title: "Documentation", desc: "Browse our comprehensive guides", color: "text-purple-600" },
            { icon: Video, title: "Video Tutorials", desc: "Watch step-by-step tutorials", color: "text-blue-600" },
            { icon: MessageSquare, title: "Community", desc: "Join our user community", color: "text-green-600" },
            { icon: Mail, title: "Contact Us", desc: "Get direct support", color: "text-orange-600" }
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              viewport={{ once: true }}
            >
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <item.icon className={`h-8 w-8 ${item.color} mb-2`} />
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Tabs defaultValue="faq" className="space-y-6">
          <TabsList>
            <TabsTrigger value="faq">FAQ</TabsTrigger>
            <TabsTrigger value="guides">Getting Started</TabsTrigger>
            <TabsTrigger value="contact">Contact Support</TabsTrigger>
          </TabsList>

          {/* FAQ Tab */}
          <TabsContent value="faq" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Frequently Asked Questions</CardTitle>
                <CardDescription>Find answers to common questions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search and Filter */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search FAQ..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="flex gap-2">
                    {categories.map(category => (
                      <Button
                        key={category}
                        variant={selectedCategory === category ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedCategory(category)}
                        className="capitalize"
                      >
                        {category}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* FAQ Items */}
                <div className="space-y-4">
                  {filteredFAQ.map((item, index) => (
                    <div key={index} className="border rounded-lg p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <FileQuestion className="h-4 w-4 text-purple-600" />
                            <h3 className="font-medium">{item.question}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground">{item.answer}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />
                      </div>
                    </div>
                  ))}
                </div>

                {filteredFAQ.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No FAQ items found matching your search.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Getting Started Tab */}
          <TabsContent value="guides" className="space-y-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    <CardTitle>Quick Start Guide</CardTitle>
                  </div>
                  <CardDescription>Get up and running with Deckster in minutes</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-sm font-medium text-purple-700">
                        1
                      </div>
                      <div>
                        <h4 className="font-medium">Sign in with Google</h4>
                        <p className="text-sm text-muted-foreground">Use your Google account to get started instantly</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-sm font-medium text-purple-700">
                        2
                      </div>
                      <div>
                        <h4 className="font-medium">Create a New Presentation</h4>
                        <p className="text-sm text-muted-foreground">Click "New Presentation" from your dashboard</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-sm font-medium text-purple-700">
                        3
                      </div>
                      <div>
                        <h4 className="font-medium">Describe Your Presentation</h4>
                        <p className="text-sm text-muted-foreground">Tell the AI agents what you want to create</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-sm font-medium text-purple-700">
                        4
                      </div>
                      <div>
                        <h4 className="font-medium">Review and Edit</h4>
                        <p className="text-sm text-muted-foreground">Customize the generated slides to your needs</p>
                      </div>
                    </div>
                  </div>

                  <Button className="w-full" asChild>
                    <Link href="/builder">
                      Start Creating
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    <CardTitle>Understanding AI Agents</CardTitle>
                  </div>
                  <CardDescription>Learn how our AI team works together</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    <div className="flex items-start gap-3">
                      <Badge className="bg-purple-100 text-purple-700">Director</Badge>
                      <p className="text-sm">Orchestrates the presentation creation process and coordinates other agents</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge className="bg-blue-100 text-blue-700">Researcher</Badge>
                      <p className="text-sm">Pulls facts from your files and the open web, with citations</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge className="bg-green-100 text-green-700">Analyst</Badge>
                      <p className="text-sm">Turns your numbers into insight</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge className="bg-orange-100 text-orange-700">Content Generator</Badge>
                      <p className="text-sm">Writes your headlines, body copy, and speaker notes</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge className="bg-pink-100 text-pink-700">Visualizer</Badge>
                      <p className="text-sm">Builds charts, diagrams, and infographics</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge className="bg-teal-100 text-teal-700">Theme Builder</Badge>
                      <p className="text-sm">Creates custom themes so every slide stays on brand</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge className="bg-indigo-100 text-indigo-700">Slide Composer</Badge>
                      <p className="text-sm">Handles layout and balance across each slide</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge className="bg-amber-100 text-amber-700">Element Generator</Badge>
                      <p className="text-sm">Produces individual elements — text, metrics, tables, and more</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-600" />
                    <CardTitle>Pro Tips</CardTitle>
                  </div>
                  <CardDescription>Make the most of Deckster</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span>Be specific in your requests - the more detail you provide, the better the results</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span>Upload relevant documents or data files to enhance your presentations</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span>Use version history to track changes and restore previous versions</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span>Collaborate with team members by sharing presentations</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Contact Support Tab */}
          <TabsContent value="contact" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Contact Support</CardTitle>
                <CardDescription>Get help from our support team</CardDescription>
              </CardHeader>
              <CardContent>
                {showSuccess && (
                  <Alert className="mb-6 border-green-200 bg-green-50">
                    <AlertDescription className="text-green-800">
                      Your message has been sent! We'll get back to you as soon as we can.
                    </AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSubmitSupport} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={user?.email || ""}
                      disabled
                      className="bg-slate-50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      placeholder="Brief description of your issue"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      placeholder="Describe your issue in detail..."
                      rows={6}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      required
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Sending..." : "Send Message"}
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      We&apos;ll reply by email as soon as we can.
                    </p>
                  </div>
                </form>

                <div className="mt-8 pt-8 border-t">
                  <h3 className="font-medium mb-4">Other Ways to Get Help</h3>
                  <div className="grid gap-3">
                    <a href="mailto:support@deckster.xyz" className="flex items-center gap-2 text-sm hover:text-purple-600">
                      <Mail className="h-4 w-4" />
                      support@deckster.xyz
                    </a>
                    <a href="#" className="flex items-center gap-2 text-sm hover:text-purple-600">
                      <MessageSquare className="h-4 w-4" />
                      Join our Discord community
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <a href="#" className="flex items-center gap-2 text-sm hover:text-purple-600">
                      <BookOpen className="h-4 w-4" />
                      Browse documentation
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </Section>

      <Footer />
    </div>
  )
}