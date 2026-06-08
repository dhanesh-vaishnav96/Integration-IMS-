require('dotenv').config();
const { prisma } = require('./src/config/prisma');

async function main() {
  const interviews = await prisma.interview.findMany({
    where: { deleted_at: null },
    orderBy: { created_at: 'desc' },
    take: 5,
    select: {
      id: true,
      title: true,
      online_meeting_id: true,
      meeting_join_url: true,
      organizer_object_id: true,
      scheduled_time: true,
      status: true,
      candidate: { select: { id: true, name: true } }
    }
  });

  console.log('=== Recent Interviews ===');
  interviews.forEach((i, idx) => {
    console.log(`\n[${idx + 1}] ${i.title}`);
    console.log(`    ID:           ${i.id}`);
    console.log(`    Status:       ${i.status}`);
    console.log(`    Scheduled:    ${i.scheduled_time}`);
    console.log(`    Candidate:    ${i.candidate?.name || 'N/A'} (${i.candidate?.id || 'N/A'})`);
    console.log(`    Join URL:     ${i.meeting_join_url || '❌ MISSING'}`);
    console.log(`    Online Mtg:   ${i.online_meeting_id ? i.online_meeting_id.substring(0, 60) + '...' : '❌ MISSING'}`);
  });

  await prisma.$disconnect();
}
main().catch(console.error);
