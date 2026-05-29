"use client"

import { useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useKnowledgeGraph } from "@/hooks/use-knowledge-graph"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  ArrowLeft,
  Shield,
  Bell,
  Eye,
  Download,
  Trash2,
  AlertTriangle,
  Mail,
  Lock,
  Globe,
  Brain,
} from "lucide-react"
import Link from "next/link"

// Force dynamic rendering to prevent build-time errors
export const dynamic = 'force-dynamic'

export default function AccountSettingsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  
  // Privacy settings
  const [profileVisibility, setProfileVisibility] = useState("private")
  const [activityTracking, setActivityTracking] = useState(false)
  
  // Notification settings
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [productUpdates, setProductUpdates] = useState(true)
  const [marketingEmails, setMarketingEmails] = useState(false)
  
  // Security settings
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Knowledge Graph
  const kg = useKnowledgeGraph()
  const [showKgPurgeConfirm, setShowKgPurgeConfirm] = useState(false)
  const [kgPurgeResult, setKgPurgeResult] = useState<string | null>(null)
  const [kgToggleLoading, setKgToggleLoading] = useState(false)

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

  if (!user) {
    router.push("/auth/signin")
    return null
  }

  const handleDataExport = () => {
    // TODO: Implement data export
    console.log("Exporting user data...")
  }

  const handleAccountDelete = () => {
    // TODO: Implement account deletion
    console.log("Deleting account...")
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/profile">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Profile
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Account Settings</h1>
          <p className="text-slate-600">Manage your account preferences and security settings</p>
        </div>

        <Tabs defaultValue="privacy" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          {/* Privacy Tab */}
          <TabsContent value="privacy" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Privacy Settings</CardTitle>
                <CardDescription>Control how your data is used and who can see your information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label className="flex items-center gap-2 mb-3">
                      <Eye className="h-4 w-4" />
                      Profile Visibility
                    </Label>
                    <div className="space-y-3">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="radio"
                          value="public"
                          checked={profileVisibility === "public"}
                          onChange={(e) => setProfileVisibility(e.target.value)}
                          className="text-purple-600"
                        />
                        <div>
                          <p className="font-medium">Public</p>
                          <p className="text-sm text-muted-foreground">Anyone can view your profile</p>
                        </div>
                      </label>
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="radio"
                          value="team"
                          checked={profileVisibility === "team"}
                          onChange={(e) => setProfileVisibility(e.target.value)}
                          className="text-purple-600"
                        />
                        <div>
                          <p className="font-medium">Team Only</p>
                          <p className="text-sm text-muted-foreground">Only team members can view your profile</p>
                        </div>
                      </label>
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="radio"
                          value="private"
                          checked={profileVisibility === "private"}
                          onChange={(e) => setProfileVisibility(e.target.value)}
                          className="text-purple-600"
                        />
                        <div>
                          <p className="font-medium">Private</p>
                          <p className="text-sm text-muted-foreground">Only you can view your profile</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Activity Tracking</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow us to collect usage data to improve the product
                      </p>
                    </div>
                    <Switch
                      checked={activityTracking}
                      onCheckedChange={setActivityTracking}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Data Management</CardTitle>
                <CardDescription>Export or delete your personal data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Download className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Export Your Data</p>
                      <p className="text-sm text-muted-foreground">
                        Download all your presentations and account data
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={handleDataExport}>
                    Export
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Knowledge Graph — Premium only */}
            {kg.isPremium && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Knowledge Graph
                  </CardTitle>
                  <CardDescription>
                    Build a knowledge graph across your decks so agents learn your domain over time
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Build a knowledge graph across my decks</Label>
                      <p className="text-sm text-muted-foreground">
                        When enabled, research from each deck enriches future decks on related topics
                      </p>
                    </div>
                    <Switch
                      checked={kg.isSubscribed}
                      disabled={kg.isLoading || kgToggleLoading}
                      onCheckedChange={async (checked) => {
                        setKgToggleLoading(true)
                        if (checked) {
                          await kg.subscribe()
                        } else {
                          kg.unsubscribe()
                        }
                        setKgToggleLoading(false)
                      }}
                    />
                  </div>

                  {kg.error && (
                    <p className="text-sm text-red-600">{kg.error}</p>
                  )}

                  {kgPurgeResult && (
                    <p className="text-sm text-green-600">{kgPurgeResult}</p>
                  )}

                  {kg.isSubscribed && (
                    <>
                      <Separator />
                      {!showKgPurgeConfirm ? (
                        <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Trash2 className="h-5 w-5 text-red-500" />
                            <div>
                              <p className="font-medium text-red-700">Delete my knowledge graph</p>
                              <p className="text-sm text-muted-foreground">
                                Permanently removes all stored knowledge
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setShowKgPurgeConfirm(true)}
                          >
                            Delete
                          </Button>
                        </div>
                      ) : (
                        <Alert className="border-red-200">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          <AlertDescription className="space-y-4">
                            <p>This will permanently delete your entire knowledge graph. This cannot be undone.</p>
                            <div className="flex gap-2">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={async () => {
                                  const result = await kg.purge()
                                  setShowKgPurgeConfirm(false)
                                  if (result) {
                                    setKgPurgeResult(
                                      `Deleted ${result.nodes_deleted} entities, ${result.edges_deleted} relations, and ${result.evidence_deleted} evidence items.`
                                    )
                                  }
                                }}
                              >
                                Yes, Delete Everything
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowKgPurgeConfirm(false)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Notifications</CardTitle>
                <CardDescription>Choose what emails you want to receive</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Account Activity</Label>
                    <p className="text-sm text-muted-foreground">
                      Important notifications about your account
                    </p>
                  </div>
                  <Switch
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Product Updates</Label>
                    <p className="text-sm text-muted-foreground">
                      New features and improvements
                    </p>
                  </div>
                  <Switch
                    checked={productUpdates}
                    onCheckedChange={setProductUpdates}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Marketing & Promotions</Label>
                    <p className="text-sm text-muted-foreground">
                      Special offers and promotional content
                    </p>
                  </div>
                  <Switch
                    checked={marketingEmails}
                    onCheckedChange={setMarketingEmails}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>How you receive notifications</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 border rounded-lg">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">Email Address</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    <Button variant="outline" size="sm">
                      Verify
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Authentication</CardTitle>
                <CardDescription>Manage how you sign in to your account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Google Sign-In</p>
                      <p className="text-sm text-muted-foreground">
                        Currently signed in with Google
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-green-600">Connected</span>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Lock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Two-Factor Authentication</p>
                      <p className="text-sm text-muted-foreground">
                        Add an extra layer of security
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={twoFactorEnabled}
                    onCheckedChange={setTwoFactorEnabled}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-600">Danger Zone</CardTitle>
                <CardDescription>Irreversible actions for your account</CardDescription>
              </CardHeader>
              <CardContent>
                {!showDeleteConfirm ? (
                  <Button 
                    variant="outline" 
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 w-full"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Account
                  </Button>
                ) : (
                  <Alert className="border-red-200">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="space-y-4">
                      <p>Are you sure you want to delete your account? This action cannot be undone.</p>
                      <div className="flex gap-2">
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={handleAccountDelete}
                        >
                          Yes, Delete My Account
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setShowDeleteConfirm(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}