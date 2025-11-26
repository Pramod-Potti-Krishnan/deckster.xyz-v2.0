/**
 * File Upload API Route (NEW ARCHITECTURE)
 *
 * Handles direct file uploads to Google Gemini File API via Vertex AI.
 * Creates and manages File Search Stores per session.
 *
 * Flow:
 * 1. Authenticate user
 * 2. Validate file and session
 * 3. Get or create File Search Store for session
 * 4. Upload file directly to Gemini
 * 5. Store metadata in database
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  createFileSearchStore,
  uploadFileToStore,
  withRetry,
} from '@/lib/gemini-store-manager';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(req: NextRequest) {
  let tempPath: string | null = null;

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
          error: `File size exceeds 20 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB)`,
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

    if (!chatSession || chatSession.userId !== user.id) {
      return NextResponse.json(
        { error: 'Invalid session' },
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

    // 8. Get or create File Search Store for session
    let storeName = chatSession.geminiStoreName;
    let storeId = chatSession.geminiStoreId;

    if (!storeName) {
      console.log(`[Upload] Creating new File Search Store for session: ${sessionId}`);

      try {
        const store = await createFileSearchStore({
          sessionId,
          userId: user.id,
          displayName: `Session_${sessionId.substring(0, 8)}`,
        });

        storeName = store.storeName;
        storeId = store.storeId;

        // Update session with store info
        await prisma.chatSession.update({
          where: { id: sessionId },
          data: {
            geminiStoreName: storeName,
            geminiStoreId: storeId,
          },
        });

        console.log(`[Upload] Created File Search Store: ${storeName}`);
      } catch (storeError) {
        console.error('[Upload] Error creating File Search Store:', storeError);
        return NextResponse.json(
          {
            error: 'Failed to create File Search Store. Please check your Google Cloud configuration.',
            details: storeError instanceof Error ? storeError.message : 'Unknown error',
          },
          { status: 500 }
        );
      }
    } else {
      console.log(`[Upload] Using existing File Search Store: ${storeName}`);
    }

    // 9. Save file temporarily
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    tempPath = join(tmpdir(), `upload_${Date.now()}_${sanitizedFileName}`);
    await writeFile(tempPath, buffer);

    console.log(`[Upload] Saved temporary file: ${tempPath}`);

    // 10. Create database record in 'uploading' state
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
      // 11. Upload to Gemini File Search Store with retry
      console.log(`[Upload] Uploading file to Gemini: ${file.name}`);

      const uploadResult = await withRetry(
        () =>
          uploadFileToStore({
            storeName: storeName!,
            filePath: tempPath!,
            displayName: file.name,
            metadata: {
              session_id: sessionId,
              user_id: userId,
              original_filename: file.name,
              mime_type: file.type,
              file_size: file.size.toString(),
            },
          }),
        3, // maxRetries
        1000 // initial delay
      );

      console.log(`[Upload] File uploaded to Gemini:`, uploadResult);

      // 12. Update database with successful upload
      const updatedFile = await prisma.uploadedFile.update({
        where: { id: uploadedFile.id },
        data: {
          geminiFileUri: uploadResult.fileUri,
          geminiFileName: uploadResult.fileName,
          uploadStatus: 'indexed',
          uploadError: null,
        },
      });

      // 13. Return success response
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
      console.error('[Upload] Error uploading file to Gemini:', uploadError);

      // Update database record with error
      await prisma.uploadedFile.update({
        where: { id: uploadedFile.id },
        data: {
          uploadStatus: 'failed',
          uploadError: uploadError instanceof Error ? uploadError.message : 'Upload failed',
        },
      });

      return NextResponse.json(
        {
          error: 'Failed to upload file to Gemini',
          details: uploadError instanceof Error ? uploadError.message : 'Unknown error',
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
  } finally {
    // Cleanup temp file
    if (tempPath) {
      try {
        await unlink(tempPath);
        console.log(`[Upload] Cleaned up temporary file: ${tempPath}`);
      } catch (cleanupError) {
        console.warn('[Upload] Failed to cleanup temp file:', cleanupError);
      }
    }
  }
}
