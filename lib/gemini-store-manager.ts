/**
 * Gemini File Search Store Manager
 *
 * Manages Google Gemini File Search Stores for RAG-based content generation.
 * Uses the Gemini Developer API (not Vertex AI) for File Search functionality.
 *
 * Handles:
 * - Creating stores per user session
 * - Uploading files to stores
 * - Listing files in stores
 * - Cleaning up stores
 */

import { readFile } from 'fs/promises';

// Gemini Developer API configuration
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
// Upload endpoint has different base URL (upload subdomain before version)
const GEMINI_UPLOAD_BASE = 'https://generativelanguage.googleapis.com/upload/v1beta';

// Get API key from environment
function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add it to your .env.local file. ' +
      'Get your API key from https://aistudio.google.com/app/apikey'
    );
  }
  return apiKey;
}

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
    const apiKey = getGeminiApiKey();
    const displayName = options.displayName || `Session_${options.sessionId.substring(0, 8)}`;

    // Create File Search Store using Gemini Developer API
    const response = await fetch(
      `${GEMINI_API_BASE}/fileSearchStores?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName,
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
 * This performs both upload and indexing in a single operation using
 * the uploadToFileSearchStore endpoint.
 *
 * @param options Upload options including store name and file path
 * @returns Object with fileUri and fileName
 */
export async function uploadFileToStore(
  options: UploadFileToStoreOptions
): Promise<{ fileUri: string; fileName: string }> {
  try {
    const apiKey = getGeminiApiKey();

    // Read file from filesystem
    const fileBuffer = await readFile(options.filePath);
    const fileBlob = new Blob([fileBuffer]);

    console.log('[Gemini Store] Uploading file:', {
      store: options.storeName,
      file: options.displayName,
      size: fileBuffer.length,
    });

    // Prepare multipart form data
    const formData = new FormData();
    formData.append('file', fileBlob, options.displayName);

    // Build config object for upload
    const config: any = {
      display_name: options.displayName,
    };

    // Add custom metadata if provided
    if (options.metadata) {
      config.custom_metadata = Object.entries(options.metadata).map(([key, value]) => ({
        key,
        string_value: value,
      }));
    }

    formData.append('config', JSON.stringify(config));

    // Upload using the uploadToFileSearchStore endpoint
    // Note: Upload uses different base URL (upload subdomain before v1beta)
    const response = await fetch(
      `${GEMINI_UPLOAD_BASE}/${options.storeName}:uploadToFileSearchStore?key=${apiKey}`,
      {
        method: 'POST',
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
    const apiKey = getGeminiApiKey();

    const response = await fetch(
      `${GEMINI_API_BASE}/${storeName}/files?key=${apiKey}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
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
    const apiKey = getGeminiApiKey();

    const response = await fetch(
      `${GEMINI_API_BASE}/${storeName}?key=${apiKey}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
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
