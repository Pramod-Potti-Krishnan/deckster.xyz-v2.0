'use client';

import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConnectionErrorProps {
  onRetry?: () => void;
  className?: string;
  message?: string;
}

/**
 * Simplified ConnectionError component for Director v2.0
 * Shows a simple error alert with retry button
 */
export function ConnectionError({
  onRetry,
  className,
  message = "Unable to connect to Director v2.0. Please check your internet connection."
}: ConnectionErrorProps) {
  return (
    <Alert
      variant="destructive"
      className={cn('relative', className)}
    >
      <div className="flex items-start gap-3">
        <WifiOff className="h-4 w-4 mt-0.5" />
        <div className="flex-1">
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            <p className="text-sm">{message}</p>
            {onRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                className="mt-2"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry Connection
              </Button>
            )}
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
}

// Simple inline connection status indicator (optional, not used in current builder)
export function ConnectionStatusIndicator({
  status = 'disconnected',
  className
}: {
  status?: 'connected' | 'connecting' | 'disconnected' | 'error';
  className?: string;
}) {
  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500 animate-pulse';
      case 'error':
      case 'disconnected':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getTooltipText = () => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div
      className={cn('relative group', className)}
      title={getTooltipText()}
    >
      <div className={cn(
        'w-2 h-2 rounded-full transition-colors',
        getStatusColor()
      )} />

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
        {getTooltipText()}
      </div>
    </div>
  );
}
