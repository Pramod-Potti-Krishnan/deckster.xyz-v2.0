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
      answer: "Our AI agents are specialized assistants: The Director orchestrates the process, The Scripter writes content, The Graphic Artist handles visuals, and The Data Visualizer creates charts. They work together to build your presentations."
    },
    {
      category: "Features",
      question: "Can I edit slides after they're generated?",
      answer: "Yes! Click on any element in a slide to edit it directly. You can modify text, change layouts, add images, and customize everything to your needs."
    },
    {
      category: "Features",
      question: "How do I add attachments or data files?",
      answer: "Use the attachment panel in the builder interface. You can drag and drop files or click to browse. Supported formats include documents, images, videos, and data files (CSV, Excel)."
    },
    {
      category: "Billing",
      question: "What's included in the Free plan?",
      answer: "The Free plan includes 3 presentations, access to 2 AI agents, and basic features. Perfect for trying out the platform!"
    },
    {
      category: "Billing",
      question: "How do I upgrade my subscription?",
      answer: "Go to your Profile > Billing & Subscription, or click 'Upgrade' in the dashboard. Choose between Pro ($29/month) or Enterprise ($99/month) plans."
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
      answer: "No! deckster is entirely web-based. Just sign in through your browser and you're ready to go. Works on Chrome, Firefox, Safari, and Edge."
    },
    {
      category: "Getting Started",
      question: "Can I use templates instead of starting from scratch?",
      answer: "Absolutely! Visit the Templates page to browse 15+ professional templates across different categories. Click 'Use Template' to start with a pre-built structure."
    },
    {
      category: "Features",
      question: "How many slides can I create in one presentation?",
      answer: "There's no hard limit on slide count. The Free plan supports up to 3 presentations, while Pro and Enterprise plans offer unlimited presentations with unlimited slides."
    },
    {
      category: "Features",
      question: "Can I collaborate with my team on presentations?",
      answer: "Team collaboration is available on Pro and Enterprise plans. Share presentations with team members, work together in real-time, and leave comments for feedback."
    },
    {
      category: "AI Agents",
      question: "How do I know which agents are working on my presentation?",
      answer: "The Chain of Thought panel shows you exactly which agents are active and what they're working on. You'll see real-time updates as the Director, Scripter, Graphic Artist, and Data Visualizer collaborate."
    },
    {
      category: "AI Agents",
      question: "Can I request a specific agent to revise content?",
      answer: "Yes! In the chat interface, you can ask for specific changes like 'Scripter, make the intro more engaging' or 'Data Visualizer, create a bar chart for this data.'"
    },
    {
      category: "AI Agents",
      question: "What's the difference between Pro and Free AI capabilities?",
      answer: "Free plan includes Director and Scripter agents with basic capabilities. Pro adds the Graphic Artist and Data Visualizer, plus advanced features like web research and DALL-E image generation."
    },
    {
      category: "Exporting & Sharing",
      question: "What export formats are available?",
      answer: "You can export to PowerPoint (.pptx), PDF, Google Slides, PNG/JPEG images, and shareable web links. All formats preserve your presentation's design and formatting."
    },
    {
      category: "Exporting & Sharing",
      question: "Can I download my presentations for offline use?",
      answer: "Yes! Export to PowerPoint or PDF for offline presentations. Web link exports require an internet connection to view."
    },
    {
      category: "Exporting & Sharing",
      question: "How do I share a presentation with someone who doesn't have deckster?",
      answer: "Generate a shareable web link that anyone can view in their browser, or export to PDF/PowerPoint and send the file via email or file sharing services."
    },
    {
      category: "Billing",
      question: "Is there a free trial for Pro or Enterprise?",
      answer: "Yes! Pro plans include a 14-day free trial with full access to all features. Enterprise plans include a trial period customized to your needs. Contact sales for details."
    },
    {
      category: "Billing",
      question: "What happens if I downgrade my plan?",
      answer: "Your existing presentations are preserved, but you'll lose access to premium features. For example, downgrading from Pro to Free limits you to 3 presentations and basic AI agents."
    },
    {
      category: "Billing",
      question: "Do you offer refunds?",
      answer: "Yes! We offer a 14-day money-back guarantee for all paid plans. If you're not satisfied, contact support for a full refund within 14 days of purchase."
    },
    {
      category: "Troubleshooting",
      question: "The AI agents aren't responding. What should I check?",
      answer: "Ensure you have an active internet connection and haven't reached your plan's usage limits. Try refreshing the page. If issues persist, check our status page or contact support."
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
        title="Help & Support"
        subtitle="Get help with Deckster and learn how to make the most of our platform"
        badge={{
          text: "Support Center",
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
                      <Badge className="bg-blue-100 text-blue-700">Scripter</Badge>
                      <p className="text-sm">Writes compelling content and ensures consistent messaging</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge className="bg-green-100 text-green-700">Graphic Artist</Badge>
                      <p className="text-sm">Designs layouts and visual elements for your slides</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge className="bg-orange-100 text-orange-700">Data Visualizer</Badge>
                      <p className="text-sm">Creates charts and data visualizations from your data</p>
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
                      Your message has been sent! We'll get back to you within 24 hours.
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
                      {user?.tier === "enterprise" ? (
                        <span className="flex items-center gap-1">
                          <Shield className="h-4 w-4" />
                          Priority support response within 4 hours
                        </span>
                      ) : (
                        "We typically respond within 24 hours"
                      )}
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