import { useState, useEffect, useCallback } from 'react';

export type ErrorCategory = 
  | 'AUTH_FAILED'
  | 'CONNECTION_LOST'
  | 'RATE_LIMIT'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN';

export interface ErrorDetails {
  code: string | number;
  message: string;
  category: ErrorCategory;
  recoverable: boolean;
  userMessage: string;
  technicalDetails?: any;
  timestamp: Date;
  retryAfter?: number;
}

export class ErrorHandler {
  private errorCallbacks = new Map<ErrorCategory, ((error: ErrorDetails) => void)[]>();
  private globalErrorHandler: ((error: ErrorDetails) => void) | null = null;
  private errorLog: ErrorDetails[] = [];
  private maxLogSize = 100;

  constructor() {
    // Set up global error listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
    }
  }

  // Categorize error based on type and content
  categorizeError(error: any): ErrorCategory {
    // WebSocket close codes
    if (error.code === 1008 || error.message?.includes('Unauthorized')) {
      return 'AUTH_FAILED';
    }
    if (error.code >= 1001 && error.code <= 1003) {
      return 'CONNECTION_LOST';
    }
    
    // HTTP status codes
    if (error.status === 429 || error.message?.includes('rate limit')) {
      return 'RATE_LIMIT';
    }
    if (error.status >= 400 && error.status < 500) {
      return 'VALIDATION_ERROR';
    }
    if (error.status >= 500) {
      return 'SERVER_ERROR';
    }
    
    // Network errors
    if (error.message?.includes('network') || error.message?.includes('fetch')) {
      return 'NETWORK_ERROR';
    }
    if (error.message?.includes('timeout')) {
      return 'TIMEOUT';
    }
    
    // Validation errors
    if (error.message?.includes('validation') || error.message?.includes('invalid')) {
      return 'VALIDATION_ERROR';
    }
    
    return 'UNKNOWN';
  }

  // Create error details from various error types
  createErrorDetails(error: any): ErrorDetails {
    const category = this.categorizeError(error);
    const code = error.code || error.status || 'UNKNOWN';
    const message = error.message || error.toString();
    
    return {
      code,
      message,
      category,
      recoverable: this.isRecoverable(category),
      userMessage: this.getUserMessage(category, error),
      technicalDetails: error,
      timestamp: new Date(),
      retryAfter: error.retryAfter || this.getRetryAfter(category)
    };
  }

  // Determine if error is recoverable
  private isRecoverable(category: ErrorCategory): boolean {
    switch (category) {
      case 'CONNECTION_LOST':
      case 'NETWORK_ERROR':
      case 'TIMEOUT':
      case 'RATE_LIMIT':
        return true;
      case 'AUTH_FAILED':
      case 'VALIDATION_ERROR':
        return false;
      default:
        return false;
    }
  }

  // Get user-friendly error message
  private getUserMessage(category: ErrorCategory, error: any): string {
    switch (category) {
      case 'AUTH_FAILED':
        return 'Your session has expired. Please sign in again.';
      case 'CONNECTION_LOST':
        return 'Connection lost. Attempting to reconnect...';
      case 'RATE_LIMIT':
        return `Too many requests. Please wait ${error.retryAfter || 60} seconds before trying again.`;
      case 'VALIDATION_ERROR':
        return error.userMessage || 'Please check your input and try again.';
      case 'SERVER_ERROR':
        return 'Something went wrong on our end. Please try again later.';
      case 'NETWORK_ERROR':
        return 'Network error. Please check your internet connection.';
      case 'TIMEOUT':
        return 'Request timed out. Please try again.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  // Get retry delay based on error category
  private getRetryAfter(category: ErrorCategory): number {
    switch (category) {
      case 'RATE_LIMIT':
        return 60; // 60 seconds
      case 'CONNECTION_LOST':
      case 'NETWORK_ERROR':
        return 5; // 5 seconds
      case 'TIMEOUT':
        return 10; // 10 seconds
      default:
        return 0;
    }
  }

  // Handle error with appropriate strategy
  handleError(error: any): ErrorDetails {
    const errorDetails = this.createErrorDetails(error);
    
    // Log error
    this.logError(errorDetails);
    
    // Call category-specific handlers
    const handlers = this.errorCallbacks.get(errorDetails.category) || [];
    handlers.forEach(handler => handler(errorDetails));
    
    // Call global handler
    if (this.globalErrorHandler) {
      this.globalErrorHandler(errorDetails);
    }
    
    // Handle specific error types
    switch (errorDetails.category) {
      case 'AUTH_FAILED':
        this.handleAuthError(errorDetails);
        break;
      case 'CONNECTION_LOST':
        this.handleConnectionError(errorDetails);
        break;
      case 'RATE_LIMIT':
        this.handleRateLimitError(errorDetails);
        break;
    }
    
    return errorDetails;
  }

  // Specific error handlers
  private handleAuthError(error: ErrorDetails): void {
    // Clear stored tokens
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('mockUser');
      
      // Redirect to login after a short delay
      setTimeout(() => {
        window.location.href = '/auth/signin';
      }, 2000);
    }
  }

  private handleConnectionError(error: ErrorDetails): void {
    // Connection errors are usually handled by the WebSocket client
    // This is for additional UI feedback
    console.log('Connection error handled:', error);
  }

  private handleRateLimitError(error: ErrorDetails): void {
    // Rate limit errors should show a countdown
    console.log('Rate limit error:', error);
  }

  // Register error handler for specific category
  on(category: ErrorCategory, handler: (error: ErrorDetails) => void): () => void {
    if (!this.errorCallbacks.has(category)) {
      this.errorCallbacks.set(category, []);
    }
    
    const handlers = this.errorCallbacks.get(category)!;
    handlers.push(handler);
    
    // Return unsubscribe function
    return () => {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    };
  }

  // Set global error handler
  setGlobalHandler(handler: ((error: ErrorDetails) => void) | null): void {
    this.globalErrorHandler = handler;
  }

  // Log error for debugging
  private logError(error: ErrorDetails): void {
    this.errorLog.push(error);
    
    // Trim log if too large
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }
    
    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorHandler]', error);
    }
  }

  // Get error log
  getErrorLog(): ErrorDetails[] {
    return [...this.errorLog];
  }

  // Clear error log
  clearErrorLog(): void {
    this.errorLog = [];
  }

  // Handle unhandled promise rejections
  private handleUnhandledRejection(event: PromiseRejectionEvent): void {
    console.error('Unhandled promise rejection:', event.reason);
    this.handleError(event.reason);
  }

  // Export error log for debugging
  exportErrorLog(): string {
    return JSON.stringify(this.errorLog, null, 2);
  }
}

// Create singleton instance
export const errorHandler = new ErrorHandler();

// React hook for error handling
export function useErrorHandler() {
  const [error, setError] = useState<ErrorDetails | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    const unsubscribe = errorHandler.setGlobalHandler((errorDetails) => {
      setError(errorDetails);
      
      if (errorDetails.recoverable) {
        setIsRecovering(true);
        
        // Auto-clear recoverable errors after delay
        setTimeout(() => {
          setError(null);
          setIsRecovering(false);
        }, errorDetails.retryAfter ? errorDetails.retryAfter * 1000 : 5000);
      }
    });

    return () => {
      errorHandler.setGlobalHandler(null);
    };
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setIsRecovering(false);
  }, []);

  const reportError = useCallback((error: any) => {
    return errorHandler.handleError(error);
  }, []);

  return {
    error,
    isRecovering,
    clearError,
    reportError
  };
}