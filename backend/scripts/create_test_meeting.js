require('dotenv').config();
process.env.TEAMS_ORGANIZER_OBJECT_ID = 'c94e5553-3965-412a-b328-c9fa31d925e6';
const axios = require('axios');

async function main() {
  console.log("--- STARTING TEST MEETING CREATION ---");

  // Create test candidate if not exists
  const { prisma } = require('../src/config/prisma');
  
  let candidateId;
  const candidate = await prisma.candidate.findFirst({ where: { email: 'dhanesh.vaishnav@kadellabs.com' }});
  
  if (candidate) {
    candidateId = candidate.id;
  } else {
    console.error("Candidate not found! Run seed or manually create one in frontend.");
    process.exit(1);
  }

  const { interviewRepository } = require('../src/repositories');
  const teamsSchedulingService = require('../src/services/teamsSchedulingService');
  
  const payload = {
    title: "Auto-Recording Test",
    candidate_id: candidateId,
    scheduled_time: new Date(Date.now() + 10 * 60000).toISOString(),
    duration_minutes: 15,
    type: 'TECHNICAL',
    priority: 'MEDIUM',
    meeting_provider: 'TEAMS',
  };
  
  const participants = [{ email: "mahima.dangi@kadellabs.com", role: "PANELIST", is_required: true }];
  
  try {
    const interview = await prisma.interview.create({
      data: {
        title: "Auto-Recording Test",
        candidate_id: candidateId,
        scheduled_time: new Date(Date.now() + 10 * 60000),
        duration_minutes: 15,
        type: 'TECHNICAL',
        priority: 'MEDIUM',
        meeting_provider: 'TEAMS',
        status: 'SCHEDULED',
        organizer_email: 'nadeem.aehmad@kadellabs.com'
      }
    });
    console.log("DB Interview Created:", interview.id);
    
    // Call Teams Graph API
    const teamsResult = await teamsSchedulingService.scheduleInterview(interview.id, {
      organizerUserId: process.env.TEAMS_ORGANIZER_OBJECT_ID || 'c94e5553-3965-412a-b328-c9fa31d925e6',
      panelists: participants.map(p => p.email)
    });
    
    console.log("\n✅ Meeting Created Successfully");
    console.log(`Interview ID: ${teamsResult.id}`);
    console.log(`Graph Event ID: ${teamsResult.graph_event_id}`);
    console.log(`Online Meeting ID: ${teamsResult.online_meeting_id}`);
    console.log(`Join URL: ${teamsResult.meeting_join_url}`);
  } catch(e) {
    console.error("Failed to create meeting", e.message);
  }
}

main().catch(console.error);
