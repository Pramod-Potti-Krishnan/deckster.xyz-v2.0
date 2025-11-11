'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Clock, Mail, LogOut, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function PendingApprovalPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(false);

  // Redirect if user becomes approved
  useEffect(() => {
    if (session?.user?.approved) {
      router.push('/builder');
    }
  }, [session, router]);

  const handleCheckStatus = async () => {
    setIsChecking(true);
    try {
      // Force session update to check approval status
      const updatedSession = await update();

      if (updatedSession?.user?.approved) {
        router.push('/builder');
      } else {
        // Show feedback that status hasn't changed yet
        setTimeout(() => setIsChecking(false), 1000);
      }
    } catch (error) {
      console.error('Error checking status:', error);
      setIsChecking(false);
    }
  };

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/' });
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    router.push('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 dark:from-purple-950/20 dark:via-blue-950/20 dark:to-pink-950/20 flex flex-col">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <Link href="/" className="flex items-center gap-2 group w-fit">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 transition-transform group-hover:scale-105">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              deckster
            </span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto h-20 w-20 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 flex items-center justify-center">
              <Clock className="h-10 w-10 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-3xl mb-2">Account Pending Approval</CardTitle>
              <CardDescription className="text-base">
                Your account has been created successfully
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* User Info */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Signed in as:</span>
                <span className="font-medium">{session.user?.email}</span>
              </div>
            </div>

            {/* Status Message */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">What happens next?</h3>
              <div className="space-y-2 text-muted-foreground">
                <p>
                  Your account is currently pending approval from our team. We're reviewing all new sign-ups to ensure the best experience for everyone.
                </p>
                <p>
                  Once approved, you'll be able to access the full deckster platform and start creating amazing presentations with our AI agents.
                </p>
              </div>
            </div>

            {/* Expected Timeline */}
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Expected Timeline</h4>
              <p className="text-sm text-blue-700 dark:text-blue-200">
                We typically review new accounts within <strong>24-48 hours</strong>. You'll receive an email notification once your account is approved.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                onClick={handleCheckStatus}
                disabled={isChecking}
                variant="default"
                className="flex-1"
              >
                {isChecking ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Check Approval Status
                  </>
                )}
              </Button>
              <Button
                onClick={handleLogout}
                variant="outline"
                className="flex-1"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>

            {/* Contact */}
            <div className="text-center pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Have questions?{' '}
                <Link href="/help" className="text-purple-600 hover:underline font-medium">
                  Contact support
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
