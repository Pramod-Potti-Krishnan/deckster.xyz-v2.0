/**
 * File Upload API Route
 *
 * Handles file uploads via the Knowledge Service (Railway).
 * The Knowledge Service wraps all Gemini File Search operations.
 *
 * Flow:
 * 1. Authenticate user
 * 2. Validate file and session
 * 3. Get or create Knowledge Service session for the chat session
 * 4. Upload file to Knowledge Service
 * 5. Store metadata in database
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import {
  createSession,
  uploadFile,
  KnowledgeServiceError,
} from '@/lib/knowledge-service-client';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const sessionId = formData.get('sessionId') as string;
    const userId = formData.get('userId') as string;

    // 3. Validate inputs
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!sessionId || !userId) {
      return NextResponse.json(
        { error: 'Missing sessionId or userId' },
        { status: 400 }
      );
    }

    // 4. Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File size exceeds 25 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB)`,
        },
        { status: 400 }
      );
    }

    // 5. Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 6. Validate user owns session
    const chatSession = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: {
        userId: true,
        geminiStoreName: true,
        geminiStoreId: true,
      },
    });

    if (!chatSession) {
      console.log(`[Upload] Session not found: sessionId=${sessionId}, userId=${userId}`);
      return NextResponse.json(
        { error: 'Session not found — please start a conversation first' },
        { status: 404 }
      );
    }

    if (chatSession.userId !== user.id) {
      console.log(`[Upload] User mismatch: sessionId=${sessionId}, userId=${userId}, ownerUserId=${chatSession.userId}`);
      return NextResponse.json(
        { error: 'Session does not belong to this user' },
        { status: 403 }
      );
    }

    // 7. Check file count limit
    const existingFiles = await prisma.uploadedFile.count({
      where: { sessionId },
    });

    if (existingFiles >= 5) {
      return NextResponse.json(
        { error: 'Maximum 5 files per session' },
        { status: 400 }
      );
    }

    // 8. Get or create Knowledge Service session
    let storeName = chatSession.geminiStoreName;
    let storeId = chatSession.geminiStoreId;

    if (!storeName) {
      console.log(`[Upload] Creating Knowledge Service session for: ${sessionId}`);

      try {
        const ksSession = await createSession(
          user.id,
          `Session_${sessionId.substring(0, 8)}`
        );

        storeId = ksSession.session_id;
        storeName = ksSession.store_name;

        // Update chat session with store info
        await prisma.chatSession.update({
          where: { id: sessionId },
          data: {
            geminiStoreName: storeName,
            geminiStoreId: storeId,
          },
        });

        console.log(`[Upload] Knowledge Service session created: ${storeId} / ${storeName}`);
      } catch (storeError) {
        console.error('[Upload] Error creating Knowledge Service session:', storeError);
        const detail = storeError instanceof KnowledgeServiceError
          ? `${storeError.message} — ${storeError.body}`
          : storeError instanceof Error ? storeError.message : 'Unknown error';
        return NextResponse.json(
          {
            error: 'Failed to create file store. Please try again.',
            details: detail,
          },
          { status: 500 }
        );
      }
    } else {
      console.log(`[Upload] Using existing Knowledge Service session: ${storeId}`);
    }

    // 9. Create database record in 'uploading' state
    const uploadedFile = await prisma.uploadedFile.create({
      data: {
        sessionId,
        userId: user.id,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        geminiFileUri: '', // Will be updated after upload
        geminiStoreName: storeName,
        uploadStatus: 'uploading',
      },
    });

    try {
      // 10. Upload to Knowledge Service
      console.log(`[Upload] Uploading file via Knowledge Service: ${file.name}`);

      const uploadResult = await uploadFile(storeId!, file, file.name);

      console.log(`[Upload] File uploaded via Knowledge Service:`, uploadResult);

      // 11. Update database with successful upload
      const updatedFile = await prisma.uploadedFile.update({
        where: { id: uploadedFile.id },
        data: {
          geminiFileUri: uploadResult.file_uri,
          geminiFileName: uploadResult.file_name,
          uploadStatus: 'indexed',
          uploadError: null,
        },
      });

      // 12. Return success response
      return NextResponse.json({
        id: updatedFile.id,
        fileName: updatedFile.fileName,
        fileSize: updatedFile.fileSize,
        fileType: updatedFile.fileType,
        geminiFileUri: updatedFile.geminiFileUri,
        geminiFileName: updatedFile.geminiFileName,
        geminiStoreName: storeName,
        uploadedAt: updatedFile.uploadedAt,
        status: 'indexed',
      });
    } catch (uploadError) {
      console.error('[Upload] Error uploading file via Knowledge Service:', uploadError);

      const detail = uploadError instanceof KnowledgeServiceError
        ? `${uploadError.message} — ${uploadError.body}`
        : uploadError instanceof Error ? uploadError.message : 'Upload failed';

      // Update database record with error
      await prisma.uploadedFile.update({
        where: { id: uploadedFile.id },
        data: {
          uploadStatus: 'failed',
          uploadError: detail,
        },
      });

      return NextResponse.json(
        {
          error: 'Failed to upload file',
          details: detail,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Upload] Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
