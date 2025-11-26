/**
 * Vertex AI Client Utility
 *
 * Initializes and exports the Vertex AI client for Google Gemini File API operations.
 * This client is used for:
 * - Uploading files to Gemini
 * - Creating and managing File Search Stores
 * - Performing RAG (Retrieval-Augmented Generation)
 */

import { VertexAI } from '@google-cloud/vertexai';
import { GoogleAuth } from 'google-auth-library';

// Store decoded credentials for use by GoogleAuth
let cachedCredentials: any = null;

// Validate required environment variables
function validateEnvironment() {
  const required = {
    GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
    GOOGLE_CLOUD_LOCATION: process.env.GOOGLE_CLOUD_LOCATION,
  };

  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      'Please configure Google Cloud credentials in .env.local'
    );
  }

  return required as { GOOGLE_CLOUD_PROJECT: string; GOOGLE_CLOUD_LOCATION: string };
}

/**
 * Setup Google authentication with support for base64-encoded credentials
 *
 * Supports three methods:
 * 1. GOOGLE_APPLICATION_CREDENTIALS_BASE64 - Base64 encoded service account JSON (recommended for Vercel)
 * 2. GOOGLE_APPLICATION_CREDENTIALS - File path or inline JSON
 * 3. Default credentials (for local development with gcloud CLI)
 */
function setupGoogleAuth() {
  const base64Creds = process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;

  if (base64Creds) {
    // Decode base64 credentials and parse as JSON object
    try {
      const decodedCreds = Buffer.from(base64Creds, 'base64').toString('utf-8');
      cachedCredentials = JSON.parse(decodedCreds);

      console.log('[Vertex AI] Using base64-encoded service account credentials');
    } catch (error) {
      throw new Error(
        'Failed to decode GOOGLE_APPLICATION_CREDENTIALS_BASE64. ' +
        'Ensure it contains valid base64-encoded JSON.'
      );
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('[Vertex AI] Using GOOGLE_APPLICATION_CREDENTIALS');
    // For file path, GoogleAuth will handle it automatically
    cachedCredentials = null;
  } else {
    console.log('[Vertex AI] Using default credentials (gcloud CLI)');
    cachedCredentials = null;
  }
}

/**
 * Get Google Cloud credentials object for direct use with GoogleAuth
 *
 * @returns Credentials object if available, null otherwise
 */
export function getGoogleCredentials(): any | null {
  // Ensure setupGoogleAuth has been called
  if (cachedCredentials === null && process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64) {
    setupGoogleAuth();
  }
  return cachedCredentials;
}

/**
 * Get or create Vertex AI client instance
 *
 * @returns VertexAI client configured with project and location
 */
export function getVertexAIClient(): VertexAI {
  const { GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION } = validateEnvironment();

  // Setup authentication (handles base64 credentials)
  setupGoogleAuth();

  const vertexAI = new VertexAI({
    project: GOOGLE_CLOUD_PROJECT,
    location: GOOGLE_CLOUD_LOCATION,
  });

  return vertexAI;
}

/**
 * Gemini model configuration
 */
export const GEMINI_CONFIG = {
  // Model to use for content generation
  model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',

  // Project and location
  project: process.env.GOOGLE_CLOUD_PROJECT || '',
  location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',

  // File upload limits (matching frontend validation)
  maxFileSize: 20 * 1024 * 1024, // 20 MB
  maxFilesPerStore: 5,

  // Supported MIME types for Gemini File API
  supportedMimeTypes: [
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',

    // Spreadsheets
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',

    // Presentations
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',

    // Data formats
    'application/json',
    'application/xml',
    'text/xml',
    'application/x-yaml',
    'text/yaml',

    // Images
    'image/png',
    'image/jpeg',
    'image/jpg',

    // Code files (text/plain with metadata)
    'text/x-python',
    'text/javascript',
    'text/typescript',
    'text/x-java-source',
    'text/x-go',
    'text/x-rustsrc',
  ],
} as const;

/**
 * Check if environment is properly configured
 */
export function isVertexAIConfigured(): boolean {
  try {
    validateEnvironment();
    return true;
  } catch {
    return false;
  }
}
