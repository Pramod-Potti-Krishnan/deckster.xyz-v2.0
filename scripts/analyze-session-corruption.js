/**
 * Analyze session corruption and count affected sessions
 *
 * This script will:
 * 1. Count total sessions with presentations
 * 2. Identify potentially corrupted sessions (presentation ID doesn't match session ID)
 * 3. Show which sessions are affected
 * 4. Count ghost sessions (old empty sessions)
 */

require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function analyzeCorruption() {
  console.log('🔍 Analyzing session corruption...\n');

  try {
    // 1. Count total sessions
    const totalSessions = await prisma.chatSession.count();
    console.log(`📊 Total sessions in database: ${totalSessions}`);

    // 2. Count sessions with presentations
    const sessionsWithPresentations = await prisma.chatSession.count({
      where: {
        OR: [
          { strawmanPreviewUrl: { not: null } },
          { finalPresentationUrl: { not: null } }
        ]
      }
    });
    console.log(`🎨 Sessions with presentations: ${sessionsWithPresentations}`);

    // 3. Get all sessions with presentations
    const sessions = await prisma.chatSession.findMany({
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
        currentStage: true,
        createdAt: true,
        lastMessageAt: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // 4. Analyze which are potentially corrupted
    const corrupted = [];
    const valid = [];

    sessions.forEach(session => {
      const strawmanId = session.strawmanPreviewUrl?.match(/\/p\/([a-f0-9-]+)/)?.[1];
      const finalId = session.finalPresentationUrl?.match(/\/p\/([a-f0-9-]+)/)?.[1];

      const isCorrupted =
        (strawmanId && strawmanId !== session.id) ||
        (finalId && finalId !== session.id);

      if (isCorrupted) {
        corrupted.push({
          sessionId: session.id,
          title: session.title || 'Untitled',
          strawmanId,
          finalId,
          createdAt: session.createdAt
        });
      } else {
        valid.push(session);
      }
    });

    console.log(`\n✅ Valid sessions: ${valid.length}`);
    console.log(`❌ Corrupted sessions: ${corrupted.length}`);

    if (corrupted.length > 0) {
      console.log('\n🚨 Corrupted sessions detected:\n');
      corrupted.forEach((s, i) => {
        console.log(`${i + 1}. "${s.title}"`);
        console.log(`   Session ID:  ${s.sessionId}`);
        console.log(`   Strawman ID: ${s.strawmanId || 'none'}`);
        console.log(`   Final ID:    ${s.finalId || 'none'}`);
        console.log(`   Created:     ${s.createdAt.toLocaleDateString()}`);
        console.log('');
      });
    }

    // 5. Count ghost sessions (older than 7 days with no messages)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const ghostSessions = await prisma.chatSession.count({
      where: {
        AND: [
          { lastMessageAt: null },
          { createdAt: { lt: sevenDaysAgo } }
        ]
      }
    });

    console.log(`👻 Ghost sessions (>7 days, no messages): ${ghostSessions}`);

    // 6. Summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY:');
    console.log('='.repeat(60));
    console.log(`Total sessions:              ${totalSessions}`);
    console.log(`Sessions with presentations: ${sessionsWithPresentations}`);
    console.log(`  - Valid:                   ${valid.length}`);
    console.log(`  - Corrupted:               ${corrupted.length}`);
    console.log(`Ghost sessions (filtered):   ${ghostSessions}`);
    console.log('='.repeat(60));

    if (corrupted.length > 0) {
      console.log('\n💡 RECOMMENDATION:');
      console.log('Run the cleanup script to clear all presentation URLs.');
      console.log('This will affect ' + corrupted.length + ' corrupted sessions.');
      console.log('Users can regenerate presentations by chatting again.');
    }

  } catch (error) {
    console.error('❌ Error analyzing sessions:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

analyzeCorruption()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
