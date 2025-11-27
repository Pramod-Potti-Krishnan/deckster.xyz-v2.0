/**
 * Fix corrupted Krishna session presentation URLs
 *
 * This script clears the corrupted presentation URLs from the Krishna session
 * (ID: 530458be-a1af-43c4-b728-20b24b096ef6) which was showing Earthworms presentation
 * instead of Krishna presentation.
 */

require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixKrishnaSession() {
  const sessionId = '530458be-a1af-43c4-b728-20b24b096ef6';

  console.log('🔧 Fixing Krishna session database corruption...');
  console.log(`Session ID: ${sessionId}`);

  try {
    // First, show current state
    const before = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        title: true,
        strawmanPreviewUrl: true,
        finalPresentationUrl: true,
        currentStage: true,
      }
    });

    console.log('\n📊 BEFORE:');
    console.log(JSON.stringify(before, null, 2));

    // Clear corrupted URLs and reset stage
    const result = await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        strawmanPreviewUrl: null,
        finalPresentationUrl: null,
        currentStage: 1, // Reset to initial stage
      },
      select: {
        id: true,
        title: true,
        strawmanPreviewUrl: true,
        finalPresentationUrl: true,
        currentStage: true,
      }
    });

    console.log('\n✅ AFTER:');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n🎉 Database corruption fixed! The session can now regenerate presentations correctly.');

  } catch (error) {
    console.error('❌ Error fixing session:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixKrishnaSession()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
