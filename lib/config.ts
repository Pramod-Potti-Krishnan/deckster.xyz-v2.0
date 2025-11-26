// Application configuration
export const config = {
  // API Configuration
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'https://vibe-decker-agents-mvp10-production.up.railway.app',
    wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'wss://api.deckster.xyz/ws',
    uploadUrl: process.env.NEXT_PUBLIC_UPLOAD_URL || '/api/upload',
    timeout: parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '30000', 10),
  },

  // WebSocket Configuration
  websocket: {
    reconnectDelay: parseInt(process.env.NEXT_PUBLIC_WS_RECONNECT_DELAY || '1000', 10),
    maxReconnectDelay: parseInt(process.env.NEXT_PUBLIC_WS_MAX_RECONNECT_DELAY || '30000', 10),
    maxReconnectAttempts: parseInt(process.env.NEXT_PUBLIC_WS_MAX_RECONNECT_ATTEMPTS || '5', 10),
    heartbeatInterval: parseInt(process.env.NEXT_PUBLIC_WS_HEARTBEAT_INTERVAL || '30000', 10),
    messageTimeout: parseInt(process.env.NEXT_PUBLIC_WS_MESSAGE_TIMEOUT || '30000', 10),
  },

  // Authentication Configuration
  auth: {
    sessionMaxAge: parseInt(process.env.NEXTAUTH_SESSION_MAX_AGE || '2592000', 10), // 30 days
    tokenRefreshBuffer: parseInt(process.env.NEXT_PUBLIC_TOKEN_REFRESH_BUFFER || '300000', 10), // 5 minutes
  },

  // Feature Flags
  features: {
    useRealAPI: process.env.NEXT_PUBLIC_USE_REAL_API === 'true',
    useOptimisticUpdates: process.env.NEXT_PUBLIC_USE_OPTIMISTIC_UPDATES !== 'false',
    enableFileUploads: process.env.NEXT_PUBLIC_ENABLE_FILE_UPLOADS !== 'false',
    enableInternetSearch: process.env.NEXT_PUBLIC_ENABLE_INTERNET_SEARCH === 'true',
    debugMode: process.env.NEXT_PUBLIC_DEBUG_MODE === 'true',
  },

  // File Upload Configuration
  upload: {
    maxFileSize: parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE || '20971520', 10), // 20MB (updated from 10MB)
    maxFiles: parseInt(process.env.NEXT_PUBLIC_MAX_FILES || '5', 10),
    allowedTypes: (process.env.NEXT_PUBLIC_ALLOWED_FILE_TYPES || '.pdf,.docx,.doc,.txt,.md,.xlsx,.xls,.csv,.pptx,.ppt,.json,.xml,.yaml,.yml,.png,.jpg,.jpeg').split(','),
  },

  // UI Configuration
  ui: {
    defaultSplitPosition: parseInt(process.env.NEXT_PUBLIC_DEFAULT_SPLIT_POSITION || '25', 10),
    animationDuration: parseInt(process.env.NEXT_PUBLIC_ANIMATION_DURATION || '300', 10),
    toastDuration: parseInt(process.env.NEXT_PUBLIC_TOAST_DURATION || '5000', 10),
  },

  // Performance Configuration
  performance: {
    slidePreloadCount: parseInt(process.env.NEXT_PUBLIC_SLIDE_PRELOAD_COUNT || '3', 10),
    messageBatchSize: parseInt(process.env.NEXT_PUBLIC_MESSAGE_BATCH_SIZE || '10', 10),
    debounceDelay: parseInt(process.env.NEXT_PUBLIC_DEBOUNCE_DELAY || '300', 10),
  },

  // Error Handling Configuration
  errorHandling: {
    maxErrorLogSize: parseInt(process.env.NEXT_PUBLIC_MAX_ERROR_LOG_SIZE || '100', 10),
    errorReportingEnabled: process.env.NEXT_PUBLIC_ERROR_REPORTING === 'true',
    errorReportingEndpoint: process.env.NEXT_PUBLIC_ERROR_REPORTING_ENDPOINT,
  },

  // Development Configuration
  development: {
    mockAuthEnabled: process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_MOCK_AUTH !== 'false',
    logLevel: process.env.NEXT_PUBLIC_LOG_LEVEL || 'info',
  },
};

// Type-safe config getter
export function getConfig<K extends keyof typeof config>(section: K): typeof config[K] {
  return config[section];
}

// Validate required configuration
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required environment variables
  if (!process.env.NEXT_PUBLIC_API_URL && config.features.useRealAPI) {
    errors.push('NEXT_PUBLIC_API_URL is required when using real API');
  }

  if (!process.env.NEXTAUTH_URL) {
    errors.push('NEXTAUTH_URL is required for authentication');
  }

  if (!process.env.NEXTAUTH_SECRET) {
    errors.push('NEXTAUTH_SECRET is required for authentication');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Export individual config sections for convenience
export const apiConfig = config.api;
export const wsConfig = config.websocket;
export const authConfig = config.auth;
export const features = config.features;
export const uploadConfig = config.upload;
export const uiConfig = config.ui;
export const perfConfig = config.performance;