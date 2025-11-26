import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Cleanup abandoned draft sessions
 *
 * GET  - Dry run mode: Shows what would be deleted without actually deleting
 * POST - Actual deletion: Deletes abandoned draft sessions
 *
 * Cron schedule: Daily at 2 AM UTC (0 2 * * *)
 *
 * A draft session is considered "abandoned" if:
 * - status = 'draft'
 * - lastMessageAt IS NULL (no messages ever sent)
 * - created_at > 24 hours ago
 */

const ABANDONMENT_THRESHOLD_HOURS = parseInt(
  process.env.SESSION_CLEANUP_THRESHOLD_HOURS || '24',
  10
)

/**
 * GET - Dry run mode
 * Shows what would be deleted without actually deleting anything
 * Useful for monitoring and testing
 */
export async function GET(req: NextRequest) {
  try {
    const cutoffTime = new Date(
      Date.now() - ABANDONMENT_THRESHOLD_HOURS * 60 * 60 * 1000
    )

    console.log('[Cleanup Dry Run] Starting')
    console.log('[Cleanup Dry Run] Cutoff time:', cutoffTime.toISOString())
    console.log('[Cleanup Dry Run] Threshold:', ABANDONMENT_THRESHOLD_HOURS, 'hours')

    // Find abandoned draft sessions
    const abandonedSessions = await prisma.chatSession.findMany({
      where: {
        status: 'draft',
        lastMessageAt: null, // No messages ever sent
        createdAt: {
          lt: cutoffTime // Older than threshold
        }
      },
      select: {
        id: true,
        userId: true,
        createdAt: true,
        uploadedFiles: {
          select: {
            id: true,
            fileName: true,
            fileSize: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    const sessionDetails = abandonedSessions.map(s => ({
      id: s.id,
      userId: s.userId,
      createdAt: s.createdAt.toISOString(),
      ageHours: Math.floor((Date.now() - s.createdAt.getTime()) / (1000 * 60 * 60)),
      fileCount: s.uploadedFiles.length,
      totalFileSize: s.uploadedFiles.reduce((sum, f) => sum + (f.fileSize || 0), 0)
    }))

    console.log(`[Cleanup Dry Run] Found ${abandonedSessions.length} abandoned sessions`)

    return NextResponse.json({
      dryRun: true,
      thresholdHours: ABANDONMENT_THRESHOLD_HOURS,
      cutoffTime: cutoffTime.toISOString(),
      wouldDelete: abandonedSessions.length,
      totalFiles: sessionDetails.reduce((sum, s) => sum + s.fileCount, 0),
      totalSizeMB: (sessionDetails.reduce((sum, s) => sum + s.totalFileSize, 0) / 1024 / 1024).toFixed(2),
      sessions: sessionDetails
    })

  } catch (error) {
    console.error('[Cleanup Dry Run] Error:', error)
    return NextResponse.json(
      {
        error: 'Dry run failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST - Actual deletion
 * Deletes abandoned draft sessions and related data
 * Protected by CRON_SECRET for security
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Verify cron secret (security)
    const authHeader = req.headers.get('authorization')
    const expectedSecret = process.env.CRON_SECRET

    if (!expectedSecret) {
      console.error('[Cleanup] CRON_SECRET not configured')
      return NextResponse.json(
        { error: 'Server misconfiguration - CRON_SECRET not set' },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${expectedSecret}`) {
      console.warn('[Cleanup] Unauthorized access attempt')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const cutoffTime = new Date(
      Date.now() - ABANDONMENT_THRESHOLD_HOURS * 60 * 60 * 1000
    )

    console.log('[Cleanup] Starting session cleanup job')
    console.log('[Cleanup] Cutoff time:', cutoffTime.toISOString())
    console.log('[Cleanup] Threshold:', ABANDONMENT_THRESHOLD_HOURS, 'hours')

    // 2. Find abandoned draft sessions
    const abandonedSessions = await prisma.chatSession.findMany({
      where: {
        status: 'draft',
        lastMessageAt: null,
        createdAt: {
          lt: cutoffTime
        }
      },
      select: {
        id: true,
        userId: true,
        createdAt: true,
        geminiStoreName: true,
        uploadedFiles: {
          select: {
            id: true,
            geminiFileUri: true,
            geminiStoreName: true
          }
        }
      }
    })

    console.log(`[Cleanup] Found ${abandonedSessions.length} abandoned draft sessions`)

    if (abandonedSessions.length === 0) {
      return NextResponse.json({
        success: true,
        cleaned: 0,
        message: 'No abandoned sessions found'
      })
    }

    const sessionIds = abandonedSessions.map(s => s.id)

    // 3. Delete related data (cascade will handle most, but explicit for clarity)

    // Delete uploaded files (database records only - Gemini files auto-expire after 48h)
    const deletedFiles = await prisma.uploadedFile.deleteMany({
      where: { sessionId: { in: sessionIds } }
    })

    // Delete messages (shouldn't exist for draft sessions, but just in case)
    const deletedMessages = await prisma.chatMessage.deleteMany({
      where: { sessionId: { in: sessionIds } }
    })

    // Delete state cache
    const deletedCache = await prisma.sessionStateCache.deleteMany({
      where: { sessionId: { in: sessionIds } }
    })

    // 4. Delete sessions
    const deletedSessions = await prisma.chatSession.deleteMany({
      where: { id: { in: sessionIds } }
    })

    // 5. Collect statistics
    const stats = {
      sessionsDeleted: deletedSessions.count,
      filesDeleted: deletedFiles.count,
      messagesDeleted: deletedMessages.count,
      cacheDeleted: deletedCache.count,
      oldestSessionAge: Math.max(
        ...abandonedSessions.map(s =>
          Math.floor((Date.now() - s.createdAt.getTime()) / (1000 * 60 * 60))
        )
      ),
      uniqueUsers: new Set(abandonedSessions.map(s => s.userId)).size
    }

    console.log('[Cleanup] ✅ Cleanup completed:', stats)

    // Note: Gemini File Search Stores and files will auto-expire after 48h
    // No need to explicitly delete them via Google Cloud API
    const storesAffected = new Set(
      abandonedSessions
        .map(s => s.geminiStoreName)
        .filter(Boolean)
    ).size

    if (storesAffected > 0) {
      console.log(`[Cleanup] ℹ️  ${storesAffected} Gemini stores affected (will auto-expire in 48h)`)
    }

    return NextResponse.json({
      success: true,
      thresholdHours: ABANDONMENT_THRESHOLD_HOURS,
      cutoffTime: cutoffTime.toISOString(),
      ...stats,
      geminiStoresAffected: storesAffected,
      sessions: abandonedSessions.map(s => ({
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        ageHours: Math.floor((Date.now() - s.createdAt.getTime()) / (1000 * 60 * 60)),
        fileCount: s.uploadedFiles.length
      }))
    })

  } catch (error) {
    console.error('[Cleanup] Error:', error)
    return NextResponse.json(
      {
        error: 'Cleanup failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
