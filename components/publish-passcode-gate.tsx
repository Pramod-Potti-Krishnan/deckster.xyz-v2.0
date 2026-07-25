"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface PublishPasscodeGateProps {
  slug: string
  title: string
}

/**
 * Minimal passcode gate for restricted published decks. Posts to the public
 * unlock endpoint; on success the httpOnly cookie is set server-side and a
 * router.refresh() re-renders /p/[slug] past the gate.
 */
export function PublishPasscodeGate({ slug, title }: PublishPasscodeGateProps) {
  const router = useRouter()
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!passcode || isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    try {
      const response = await fetch(`/api/publish/${slug}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      })
      if (response.ok) {
        router.refresh()
        return
      }
      setError(response.status === 401 ? 'Incorrect passcode. Please try again.' : 'Something went wrong. Please try again.')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col items-center text-center mb-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            This presentation is protected. Enter the passcode to view it.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Passcode"
            autoFocus
            aria-label="Passcode"
          />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <Button type="submit" className="w-full" disabled={!passcode || isSubmitting}>
            {isSubmitting ? 'Checking…' : 'View presentation'}
          </Button>
        </form>
      </div>
    </div>
  )
}
