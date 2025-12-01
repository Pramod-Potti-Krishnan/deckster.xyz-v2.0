/**
 * Check Elephant session data in database
 */

require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkElephantSession() {
  const sessionId = '4e2ef7e6-801e-4e88-8b30-4d3c342f5d19';

  console.log('🔍 Checking Elephant session data...\n');

  try {
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        title: true,
        currentStage: true,
        strawmanPreviewUrl: true,
        strawmanPresentationId: true,
        finalPresentationUrl: true,
        finalPresentationId: true,
        slideCount: true,
        stateCache: true,
        createdAt: true,
        lastMessageAt: true,
      }
    });

    if (!session) {
      console.error('❌ Session not found!');
      return;
    }

    console.log('📊 Session Data:');
    console.log(JSON.stringify(session, null, 2));

    console.log('\n🎯 Key Fields:');
    console.log(`Title: ${session.title}`);
    console.log(`Current Stage: ${session.currentStage}`);
    console.log(`Strawman URL: ${session.strawmanPreviewUrl || '(null)'}`);
    console.log(`Final URL: ${session.finalPresentationUrl || '(null)'}`);
    console.log(`State Cache: ${JSON.stringify(session.stateCache, null, 2)}`);

    console.log('\n🔎 Diagnosis:');
    if (!session.strawmanPreviewUrl && !session.finalPresentationUrl) {
      console.log('❌ PROBLEM: Both strawman and final URLs are null!');
      console.log('This session has no presentation data saved.');
    } else if (session.strawmanPreviewUrl && !session.finalPresentationUrl) {
      console.log('✅ Strawman exists, final does not (expected for approved strawman)');
      console.log('Restoration should show strawman, not final!');
    } else if (session.finalPresentationUrl) {
      console.log('✅ Final presentation exists');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkElephantSession()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
