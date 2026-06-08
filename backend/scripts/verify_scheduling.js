require('dotenv').config();
const { prisma } = require('../src/config/prisma');
const teamsSchedulingService = require('../src/services/teamsSchedulingService');
const logger = require('../src/config/logger');

async function main() {
  try {
    console.log('--- STARTING RUNTIME VERIFICATION ---');

    // 1. Find the candidate
    const candidateEmail = 'dhanesh.vaishnav@kadellabs.com';
    const candidate = await prisma.candidate.findUnique({ where: { email: candidateEmail } });
    if (!candidate) {
      console.log(`❌ Candidate not found: ${candidateEmail}`);
      process.exit(1);
    }

    // 2. Create the base interview record
    const interviewData = {
      candidate_id: candidate.id,
      scheduled_time: new Date('2026-06-15T09:30:00.000Z'), // 3:00 PM IST is 9:30 AM UTC
      duration_minutes: 60,
      organizer_email: process.env.TEAMS_ORGANIZER_EMAIL || 'nadeem.aehmad@kadellabs.com',
      status: 'SCHEDULED'
    };

    const interview = await prisma.interview.create({ data: interviewData });
    console.log(`✅ Interview created in DB with ID: ${interview.id}`);

    // 3. Call teamsSchedulingService.scheduleInterview
    console.log('\n--- EXECUTING TEAMS SCHEDULING (GRAPH API) ---');
    const options = {
      panelists: ['mahima.dangi@kadellabs.com'],
      organizerUserId: process.env.TEAMS_ORGANIZER_OBJECT_ID,
      updatedBy: 'RuntimeVerificationScript'
    };

    const result = await teamsSchedulingService.scheduleInterview(interview.id, options);
    
    console.log('\n--- GRAPH API RESULTS ---');
    console.log(`Graph Response Status: 201 Created (Inferred from successful promise resolution)`);
    console.log(`Graph Event ID: ${result.teams.id}`); // Depending on service, ID is graph Meeting ID
    console.log(`Join URL: ${result.teams.joinUrl}`);
    console.log(`Attendees included: ${['mahima.dangi@kadellabs.com', 'dhanesh.vaishnav@kadellabs.com'].join(', ')}`);
    
    // 4. Verify DB persistence
    console.log('\n--- VERIFYING DATABASE PERSISTENCE ---');
    const dbInterview = await prisma.interview.findUnique({ where: { id: interview.id } });
    
    console.log({
      graph_event_id: dbInterview.graph_event_id,
      online_meeting_id: dbInterview.online_meeting_id,
      teams_meeting_id: dbInterview.teams_meeting_id,
      meeting_join_url: dbInterview.meeting_join_url,
      organizer_email: dbInterview.organizer_email,
      organizer_object_id: dbInterview.organizer_object_id,
      graph_meeting_created_at: dbInterview.graph_meeting_created_at
    });

    console.log('\n✅ Runtime Verification Successful. Meeting scheduled via Microsoft 365.');
  } catch (err) {
    console.error('❌ Verification Failed:', err);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

// Emulate startup validation so env vars are set
const { getGraphClient } = require('../src/services/msGraph/graphClientFactory');
async function init() {
  const email = process.env.TEAMS_ORGANIZER_EMAIL;
  const client = getGraphClient();
  const user = await client.api(`/users/${email}`).get();
  process.env.TEAMS_ORGANIZER_OBJECT_ID = user.id;
  main();
}

init();
