/**
 * Verify Presentation Persistence
 *
 * This script checks if presentation URLs are being saved correctly to the database.
 * Run this after creating a new presentation to verify the fix is working.
 *
 * Usage:
 *   node scripts/verify-presentation-persistence.js [session_id]
 *
 * If no session_id is provided, it will check the most recent session.
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyPersistence() {
  const sessionId = process.argv[2]; // Optional: specific session ID to check

  console.log('🔍 Verifying Presentation Persistence...\n');

  try {
    let session;

    if (sessionId) {
      // Check specific session
      console.log(`📌 Checking session: ${sessionId}\n`);
      session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        include: {
          stateCache: true
        }
      });

      if (!session) {
        console.error(`❌ Session not found: ${sessionId}`);
        return;
      }
    } else {
      // Check most recent active session
      console.log('📌 Checking most recent active session...\n');
      session = await prisma.chatSession.findFirst({
        where: { status: 'active' },
        orderBy: { createdAt: 'desc' },
        include: {
          stateCache: true
        }
      });

      if (!session) {
        console.error('❌ No active sessions found');
        return;
      }
    }

    // Display session info
    console.log('📊 Session Information:');
    console.log('━'.repeat(60));
    console.log(`ID:           ${session.id}`);
    console.log(`Title:        ${session.title || '(untitled)'}`);
    console.log(`Created:      ${session.createdAt.toLocaleString()}`);
    console.log(`Status:       ${session.status}`);
    console.log(`Stage:        ${session.currentStage}`);
    console.log('');

    // Check presentation URLs
    console.log('🎯 Presentation URLs:');
    console.log('━'.repeat(60));

    const hasStrawman = !!session.strawmanPreviewUrl;
    const hasFinal = !!session.finalPresentationUrl;

    console.log(`Strawman URL:  ${hasStrawman ? '✅ Present' : '❌ Missing'}`);
    if (hasStrawman) {
      console.log(`  └─ URL: ${session.strawmanPreviewUrl.substring(0, 80)}...`);
      console.log(`  └─ ID:  ${session.strawmanPresentationId || '(none)'}`);
    }

    console.log(`Final URL:     ${hasFinal ? '✅ Present' : '❌ Missing'}`);
    if (hasFinal) {
      console.log(`  └─ URL: ${session.finalPresentationUrl.substring(0, 80)}...`);
      console.log(`  └─ ID:  ${session.finalPresentationId || '(none)'}`);
    }

    console.log(`Slide Count:   ${session.slideCount || '(none)'}`);
    console.log('');

    // Check state cache
    console.log('💾 State Cache:');
    console.log('━'.repeat(60));
    if (session.stateCache) {
      console.log('✅ State cache exists');
      console.log(`Active Version: ${session.stateCache.activeVersion || '(not set)'}`);
      console.log(`Has Slide Structure: ${session.stateCache.slideStructure ? 'Yes' : 'No'}`);
      console.log(`Has Current Status: ${session.stateCache.currentStatus ? 'Yes' : 'No'}`);
    } else {
      console.log('⚠️  State cache is NULL (will be created on first update)');
    }
    console.log('');

    // Diagnosis
    console.log('🔬 Diagnosis:');
    console.log('━'.repeat(60));

    if (!hasStrawman && !hasFinal) {
      console.log('❌ PROBLEM: No presentation URLs found');
      console.log('   This suggests presentations are still not being saved.');
      console.log('   Possible causes:');
      console.log('   - Session was created before fix was deployed');
      console.log('   - onSessionStateChange callback is not being triggered');
      console.log('   - API update is failing (check browser console for errors)');
    } else if (hasStrawman && !hasFinal) {
      console.log('✅ Strawman presentation saved successfully');
      console.log('   This session is at the strawman stage.');
      console.log('   Final presentation will be saved when user approves strawman.');
    } else if (hasFinal) {
      console.log('✅ Final presentation saved successfully');
      console.log('   This session has a complete final presentation.');
      if (hasStrawman) {
        console.log('   Strawman is also preserved for reference.');
      }
    }

    // Count messages
    const messageCount = await prisma.chatMessage.count({
      where: { sessionId: session.id }
    });
    console.log(`\n📨 Messages: ${messageCount} saved`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

verifyPersistence()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
