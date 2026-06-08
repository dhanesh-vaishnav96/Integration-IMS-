require('dotenv').config();
const { prisma } = require('./src/config/prisma');


async function main() {
  const latest = await prisma.interview.findFirst({
    where: {
      online_meeting_id: { not: null },
      deleted_at: null
    },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      title: true,
      online_meeting_id: true,
      graph_event_id: true,
      organizer_email: true,
      organizer_object_id: true,
      meeting_join_url: true,
      scheduled_time: true,
      status: true,
      recording_status: true,
      transcript_status: true
    }
  });

  if (!latest) {
    console.log('❌ No interview with Teams meeting found.');
    return;
  }

  console.log('✅ Latest Interview with Teams Meeting:');
  console.log(JSON.stringify(latest, null, 2));

  // Also check if an asset record already exists
  const asset = await prisma.interviewAsset.findFirst({
    where: { interview_id: latest.id }
  });

  if (asset) {
    console.log('\n📦 Existing Asset Record:');
    console.log(JSON.stringify(asset, null, 2));
  } else {
    console.log('\n⚠️  No asset record found for this interview yet.');
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
