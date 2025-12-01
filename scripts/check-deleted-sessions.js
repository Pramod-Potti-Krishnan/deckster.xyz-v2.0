/**
 * Check deleted sessions status in database
 */

require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDeletedSessions() {
  console.log('🔍 Checking session statuses...\n');

  try {
    // Count by status
    const active = await prisma.chatSession.count({
      where: { status: 'active' }
    });

    const deleted = await prisma.chatSession.count({
      where: { status: 'deleted' }
    });

    const other = await prisma.chatSession.count({
      where: { status: { notIn: ['active', 'deleted'] } }
    });

    const total = await prisma.chatSession.count();

    console.log('📊 Session Status Counts:');
    console.log(`   Total:   ${total}`);
    console.log(`   Active:  ${active}`);
    console.log(`   Deleted: ${deleted}`);
    console.log(`   Other:   ${other}`);

    // Show last 10 sessions with their statuses
    const recent = await prisma.chatSession.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
      }
    });

    console.log('\n📝 Recent 30 Sessions:');
    recent.forEach((s, i) => {
      const statusIcon = s.status === 'active' ? '✅' : s.status === 'deleted' ? '🗑️' : '❓';
      console.log(`${i + 1}. ${statusIcon} [${s.status}] "${s.title || 'Untitled'}" (${s.createdAt.toLocaleDateString()})`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkDeletedSessions()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
