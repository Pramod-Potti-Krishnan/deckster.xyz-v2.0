/**
 * Complete session cleanup - Remove ALL corrupted presentation data
 *
 * This script will:
 * 1. Clear ALL presentation URLs from the database
 * 2. Reset currentStage to 1 for affected sessions
 * 3. Show before/after counts
 *
 * This ensures a clean slate - all future presentations will be saved correctly.
 */

require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupAllCorruptedSessions() {
  console.log('🧹 Starting complete session cleanup...\n');

  try {
    // 1. Count sessions that will be affected
    const affectedCount = await prisma.chatSession.count({
      where: {
        OR: [
          { strawmanPreviewUrl: { not: null } },
          { finalPresentationUrl: { not: null } }
        ]
      }
    });

    console.log(`📊 Sessions with presentations: ${affectedCount}`);

    if (affectedCount === 0) {
      console.log('✅ No sessions to clean up. Database is already clean!');
      return;
    }

    // 2. Get list of affected sessions for logging
    const affectedSessions = await prisma.chatSession.findMany({
      where: {
        OR: [
          { strawmanPreviewUrl: { not: null } },
          { finalPresentationUrl: { not: null } }
        ]
      },
      select: {
        id: true,
        title: true,
        strawmanPreviewUrl: true,
        finalPresentationUrl: true,
      }
    });

    console.log('\n📝 Sessions to be cleaned:\n');
    affectedSessions.forEach((session, i) => {
      console.log(`${i + 1}. "${session.title || 'Untitled'}"`);
      console.log(`   Session ID: ${session.id}`);
    });

    console.log('\n🚀 Proceeding with cleanup...\n');

    // 3. Clear ALL presentation URLs and reset stage
    const result = await prisma.chatSession.updateMany({
      where: {
        OR: [
          { strawmanPreviewUrl: { not: null } },
          { finalPresentationUrl: { not: null } }
        ]
      },
      data: {
        strawmanPreviewUrl: null,
        finalPresentationUrl: null,
        currentStage: 1, // Reset to initial stage
      }
    });

    console.log(`✅ Cleaned ${result.count} sessions`);

    // 4. Verify cleanup
    const remainingCount = await prisma.chatSession.count({
      where: {
        OR: [
          { strawmanPreviewUrl: { not: null } },
          { finalPresentationUrl: { not: null } }
        ]
      }
    });

    console.log(`\n📊 Verification:`);
    console.log(`   Before cleanup: ${affectedCount} sessions with presentations`);
    console.log(`   After cleanup:  ${remainingCount} sessions with presentations`);

    if (remainingCount === 0) {
      console.log('\n🎉 SUCCESS! All presentation URLs cleared from database.');
      console.log('Users can regenerate presentations by chatting again.');
    } else {
      console.warn('\n⚠️ Warning: Some sessions still have presentation URLs.');
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanupAllCorruptedSessions()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
