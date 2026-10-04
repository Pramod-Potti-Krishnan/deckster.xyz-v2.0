"use client"

import { WifiOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ErrorDetails } from '@/lib/error-handler'
import './studio-websocket-error.css'

const STUDIO_WEBSOCKET_ERROR = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

interface WebSocketErrorFallbackProps {
  errorDetails?: Pick<ErrorDetails, 'userMessage'>
  retry: () => void
}

/** Exact native message/action only; ErrorBoundary owns classification and recovery. */
export function WebSocketErrorFallback({ errorDetails, retry }: WebSocketErrorFallbackProps) {
  if (!STUDIO_WEBSOCKET_ERROR) return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 m-4">
      <div className="flex items-center gap-2 text-red-800 mb-2">
        <WifiOff className="h-5 w-5" />
        <span className="font-medium">Connection Error</span>
      </div>
      <p className="text-sm text-red-700 mb-3">
        {errorDetails?.userMessage || 'Failed to establish connection with AI agents. Please check your internet connection and try again.'}
      </p>
      <Button onClick={retry} size="sm" variant="outline">
        <RefreshCw className="mr-2 h-4 w-4" />
        Reconnect
      </Button>
    </div>
  )
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 m-4" data-studio-v4-shell="true" data-studio-websocket-error="true" role="alert">
      <div className="flex items-center gap-2 text-red-800 mb-2">
        <WifiOff className="h-5 w-5" aria-hidden />
        <span className="font-medium">Connection Error</span>
      </div>
      <p className="text-sm text-red-700 mb-3" data-studio-websocket-error-details="true" role="region" tabIndex={0} aria-label="Connection error details">
        {errorDetails?.userMessage || 'Failed to establish connection with AI agents. Please check your internet connection and try again.'}
      </p>
      <Button onClick={retry} size="sm" variant="outline">
        <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
        Reconnect
      </Button>
    </div>
  )
}
