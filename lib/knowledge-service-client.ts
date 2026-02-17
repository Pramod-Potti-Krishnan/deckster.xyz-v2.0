/**
 * Knowledge Service Client
 *
 * Wraps the Railway-hosted Knowledge Service REST API that handles
 * all Gemini File Search operations (session/store creation, file uploads).
 *
 * Replaces direct Gemini API calls via gemini-store-manager.ts.
 */

import { config } from '@/lib/config';

const BASE_URL = config.api.knowledgeServiceUrl;

export interface KnowledgeSession {
  session_id: string;
  store_name: string;
}

export interface KnowledgeFileUpload {
  file_name: string;
  file_uri: string;
  session_id: string;
}

/**
 * Create a new Knowledge Service session (maps to a Gemini File Search Store).
 *
 * @param userId  User ID to associate with the session
 * @param sessionName  Optional display name for the session
 * @returns session_id and store_name from the Knowledge Service
 */
export async function createSession(
  userId: string,
  sessionName?: string
): Promise<KnowledgeSession> {
  const response = await fetch(`${BASE_URL}/api/v1/sessions/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      session_name: sessionName,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new KnowledgeServiceError(
      `Failed to create session: ${response.status}`,
      response.status,
      body
    );
  }

  return response.json();
}

/**
 * Upload a file to an existing Knowledge Service session.
 *
 * @param sessionId  Session ID returned from createSession
 * @param file       File blob to upload
 * @param fileName   Original file name
 * @returns file_name, file_uri, and session_id from the Knowledge Service
 */
export async function uploadFile(
  sessionId: string,
  file: Blob,
  fileName: string
): Promise<KnowledgeFileUpload> {
  const formData = new FormData();
  formData.append('session_id', sessionId);
  formData.append('file', file, fileName);

  const response = await fetch(
    `${BASE_URL}/api/v1/files/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new KnowledgeServiceError(
      `Failed to upload file: ${response.status}`,
      response.status,
      body
    );
  }

  return response.json();
}

/**
 * Custom error class that surfaces Knowledge Service error codes
 * (e.g. SESSION_NOT_FOUND, UPLOAD_FAILED).
 */
export class KnowledgeServiceError extends Error {
  public readonly status: number;
  public readonly body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = 'KnowledgeServiceError';
    this.status = status;
    this.body = body;
  }
}
