"use client"

import React from 'react'
import { AlertTriangle, RefreshCw, WifiOff, Clock, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { errorHandler, ErrorDetails, ErrorCategory } from '@/lib/error-handler'
import { useEffect } from 'react'
import { WebSocketErrorFallback } from './websocket-error-fallback'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
  errorDetails?: ErrorDetails
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; errorDetails?: ErrorDetails; retry: () => void }>
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
    
    // Round 18 Enhanced Error Debugging
    console.log('[Round 18 Error Debug] Component crash captured:', {
      error: error.message,
      componentStack: errorInfo.componentStack,
      componentName: errorInfo.componentStack?.split('\n')[1]?.trim(), // Extract first component name
      stackTrace: error.stack,
      errorType: error.constructor.name,
      isSlideRelated: error.message.includes('length') || error.message.includes('slides') || error.message.includes('undefined'),
    });
    
    // Check if this might be the sO component issue
    if (error.message.includes("Cannot read properties of undefined (reading 'length')")) {
      console.log('[Round 18 sO Debug] POTENTIAL sO COMPONENT FOUND:', {
        componentStack: errorInfo.componentStack,
        stackLines: errorInfo.componentStack?.split('\n').slice(0, 5),
        message: error.message,
        fileName: error.stack?.split('\n')[1]
      });
    }
    
    // Process error through error handler
    const errorDetails = errorHandler.handleError(error)
    
    this.setState({
      error,
      errorInfo,
      errorDetails
    })

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined, errorDetails: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return <FallbackComponent 
          error={this.state.error!} 
          errorDetails={this.state.errorDetails}
          retry={this.retry} 
        />
      }

      return <DefaultErrorFallback 
        error={this.state.error!} 
        errorDetails={this.state.errorDetails}
        retry={this.retry} 
      />
    }

    return this.props.children
  }
}

interface ErrorFallbackProps {
  error: Error
  errorDetails?: ErrorDetails
  retry: () => void
}

function DefaultErrorFallback({ error, errorDetails, retry }: ErrorFallbackProps) {
  const getErrorIcon = () => {
    switch (errorDetails?.category) {
      case 'CONNECTION_LOST':
      case 'NETWORK_ERROR':
        return <WifiOff className="h-full w-full" />
      case 'AUTH_FAILED':
        return <Shield className="h-full w-full" />
      case 'TIMEOUT':
      case 'RATE_LIMIT':
        return <Clock className="h-full w-full" />
      default:
        return <AlertTriangle className="h-full w-full" />
    }
  }

  const getErrorColor = () => {
    switch (errorDetails?.category) {
      case 'CONNECTION_LOST':
      case 'NETWORK_ERROR':
        return 'text-orange-500'
      case 'AUTH_FAILED':
        return 'text-blue-500'
      default:
        return 'text-red-500'
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className={`mx-auto mb-4 h-12 w-12 ${getErrorColor()}`}>
            {getErrorIcon()}
          </div>
          <CardTitle className={getErrorColor()}>
            {errorDetails?.category === 'CONNECTION_LOST' ? 'Connection Lost' : 'Something went wrong'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 text-center">
            {errorDetails?.userMessage || 'An unexpected error occurred while rendering this component.'}
          </p>
          
          {process.env.NODE_ENV === 'development' && (
            <div className="bg-gray-50 p-3 rounded-md">
              <p className="text-xs font-mono text-gray-700 break-all">
                {error.message}
              </p>
              {errorDetails && (
                <p className="text-xs text-gray-500 mt-1">
                  Category: {errorDetails.category} | Code: {errorDetails.code}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-center">
            <Button 
              onClick={retry} 
              variant="outline" 
              className="w-full"
              disabled={errorDetails?.recoverable === false}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {errorDetails?.recoverable === false ? 'Refresh Page' : 'Try Again'}
            </Button>
          </div>

          {errorDetails?.retryAfter && (
            <p className="text-xs text-center text-gray-500">
              Please wait {errorDetails.retryAfter} seconds before retrying
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Specialized error boundary for WebSocket errors
export function WebSocketErrorBoundary({ children }: { children: React.ReactNode }) {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error('[WebSocketErrorBoundary] WebSocket error:', error, errorInfo)
    
    // Round 18 WebSocket-Specific Error Debugging
    console.log('[Round 18 WebSocket Debug] WebSocket boundary caught error:', {
      error: error.message,
      componentStack: errorInfo.componentStack,
      isLengthError: error.message.includes("reading 'length'"),
      isSlidesRelated: error.message.includes('slides') || errorInfo.componentStack?.includes('slide'),
      stackTrace: error.stack?.split('\n').slice(0, 3),
    });
    
    // Special handling for the sO component
    if (error.message.includes("Cannot read properties of undefined (reading 'length')")) {
      console.log('[Round 18 sO Hunt] WebSocket boundary found sO error:', {
        fullStack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      });
    }
  }

  return (
    <ErrorBoundary
      onError={handleError}
      fallback={({ error, errorDetails, retry }) => (
        <WebSocketErrorFallback errorDetails={errorDetails} retry={retry} />
      )}
    >
      {children}
    </ErrorBoundary>
  )
}

// Hook to catch and display errors in a component
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null)

  useEffect(() => {
    if (error) {
      throw error
    }
  }, [error])

  const resetError = () => setError(null)
  const captureError = (error: Error) => setError(error)

  return { resetError, captureError }
}