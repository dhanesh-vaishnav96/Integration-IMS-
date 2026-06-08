const { prisma } = require('../src/config/prisma');

async function main() {
  const interview = await prisma.interview.findFirst({
    orderBy: { created_at: 'desc' }
  });

  if (interview) {
    console.log(`Interview ID: ${interview.id}`);
    console.log(`Graph Event ID: ${interview.graph_event_id}`);
    console.log(`Online Meeting ID: ${interview.online_meeting_id}`);
    console.log(`Join URL: ${interview.meeting_join_url}`);
    console.log(`Organizer: ${interview.organizer_object_id}`);
  } else {
    console.log("No interviews found in the DB.");
  }
}

main().catch(console.error);
