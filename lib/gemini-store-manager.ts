/**
 * Gemini File Search Store Manager
 *
 * Manages Google Gemini File Search Stores for RAG-based content generation.
 * Handles:
 * - Creating stores per user session
 * - Uploading files to stores
 * - Listing files in stores
 * - Cleaning up stores
 */

import { getVertexAIClient, GEMINI_CONFIG } from './vertexai-client';
import { readFile } from 'fs/promises';

export interface CreateStoreOptions {
  sessionId: string;
  userId: string;
  displayName?: string;
}

export interface UploadFileToStoreOptions {
  storeName: string;
  filePath: string;
  displayName: string;
  metadata?: Record<string, string>;
}

export interface StoreFileInfo {
  name: string;  // Full resource name: "files/abc123"
  displayName: string;
  mimeType: string;
  sizeBytes: number;
  createTime: string;
}

/**
 * Create a new File Search Store for a session
 *
 * @param options Store creation options
 * @returns Object with storeName (full resource name) and storeId
 */
export async function createFileSearchStore(
  options: CreateStoreOptions
): Promise<{ storeName: string; storeId: string }> {
  try {
    const vertexAI = getVertexAIClient();
    const displayName = options.displayName || `Session_${options.sessionId.substring(0, 8)}`;

    // Note: The exact API may vary based on Vertex AI SDK version
    // This follows the typical pattern for creating resources
    const response = await fetch(
      `https://${GEMINI_CONFIG.location}-aiplatform.googleapis.com/v1/` +
      `projects/${GEMINI_CONFIG.project}/locations/${GEMINI_CONFIG.location}/fileSearchStores`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAccessToken()}`,
        },
        body: JSON.stringify({
          displayName,
          metadata: {
            session_id: options.sessionId,
            user_id: options.userId,
            created_at: new Date().toISOString(),
            created_by: 'deckster-frontend',
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create store: ${response.status} ${error}`);
    }

    const store = await response.json();
    const storeName = store.name; // Format: "fileSearchStores/{store_id}"
    const storeId = storeName.split('/').pop() || '';

    console.log('[Gemini Store] Created File Search Store:', { storeName, storeId, displayName });

    return { storeName, storeId };
  } catch (error) {
    console.error('[Gemini Store] Error creating File Search Store:', error);
    throw new Error(
      `Failed to create File Search Store: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Upload a file to a File Search Store
 *
 * This performs both upload and indexing in a single operation.
 *
 * @param options Upload options including store name and file path
 * @returns Object with fileUri and fileName
 */
export async function uploadFileToStore(
  options: UploadFileToStoreOptions
): Promise<{ fileUri: string; fileName: string }> {
  try {
    const vertexAI = getVertexAIClient();

    // Read file from filesystem
    const fileBuffer = await readFile(options.filePath);
    const fileBlob = new Blob([fileBuffer]);

    console.log('[Gemini Store] Uploading file:', {
      store: options.storeName,
      file: options.displayName,
      size: fileBuffer.length,
    });

    // Upload file using multipart form data
    const formData = new FormData();
    formData.append('file', fileBlob, options.displayName);
    formData.append('displayName', options.displayName);
    if (options.metadata) {
      formData.append('metadata', JSON.stringify(options.metadata));
    }

    const response = await fetch(
      `https://${GEMINI_CONFIG.location}-aiplatform.googleapis.com/v1/` +
      `${options.storeName}/files:upload`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getAccessToken()}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to upload file: ${response.status} ${error}`);
    }

    const result = await response.json();
    const fileUri = result.file?.name || result.name; // Format: "files/abc123"
    const fileName = result.file?.displayName || options.displayName;

    console.log('[Gemini Store] File uploaded successfully:', { fileUri, fileName });

    return { fileUri, fileName };
  } catch (error) {
    console.error('[Gemini Store] Error uploading file:', error);
    throw new Error(
      `Failed to upload file to store: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * List all files in a File Search Store
 *
 * @param storeName Full resource name of the store
 * @returns Array of file information
 */
export async function listStoreFiles(storeName: string): Promise<StoreFileInfo[]> {
  try {
    const response = await fetch(
      `https://${GEMINI_CONFIG.location}-aiplatform.googleapis.com/v1/` +
      `${storeName}/files`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${await getAccessToken()}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list files: ${response.status} ${error}`);
    }

    const result = await response.json();
    const files = result.files || [];

    console.log(`[Gemini Store] Listed ${files.length} files in store:`, storeName);

    return files;
  } catch (error) {
    console.error('[Gemini Store] Error listing store files:', error);
    throw error;
  }
}

/**
 * Delete a File Search Store
 *
 * Note: This will also delete all files within the store.
 *
 * @param storeName Full resource name of the store to delete
 */
export async function deleteFileSearchStore(storeName: string): Promise<void> {
  try {
    const response = await fetch(
      `https://${GEMINI_CONFIG.location}-aiplatform.googleapis.com/v1/${storeName}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${await getAccessToken()}`,
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      const error = await response.text();
      throw new Error(`Failed to delete store: ${response.status} ${error}`);
    }

    console.log('[Gemini Store] Deleted File Search Store:', storeName);
  } catch (error) {
    console.error('[Gemini Store] Error deleting store:', error);
    throw error;
  }
}

/**
 * Get Google Cloud access token for API authentication
 *
 * This uses the service account credentials configured via GOOGLE_APPLICATION_CREDENTIALS
 */
async function getAccessToken(): Promise<string> {
  try {
    // In a real implementation, this would use the Google Auth Library
    // For now, we'll use a placeholder that works with Application Default Credentials
    const { GoogleAuth } = await import('google-auth-library');

    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();

    if (!tokenResponse.token) {
      throw new Error('Failed to obtain access token');
    }

    return tokenResponse.token;
  } catch (error) {
    console.error('[Gemini Store] Error getting access token:', error);
    throw new Error('Failed to authenticate with Google Cloud. Check your service account configuration.');
  }
}

/**
 * Retry wrapper for transient failures
 *
 * @param fn Function to retry
 * @param maxRetries Maximum number of retry attempts
 * @param delay Base delay in milliseconds (exponential backoff)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      const backoffDelay = Math.min(delay * Math.pow(2, attempt - 1), 10000);
      console.log(`[Gemini Store] Retry ${attempt}/${maxRetries} after ${backoffDelay}ms`);

      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }

  throw new Error('Max retries exceeded');
}
