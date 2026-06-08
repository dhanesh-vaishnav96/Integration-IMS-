require('dotenv').config();

const graphClientFactory = require('../src/services/msGraph/graphClientFactory');

async function main() {
  const meetingId = process.argv[2];
  let organizerId = process.argv[3] || process.env.TEAMS_ORGANIZER_OBJECT_ID;
  
  if (!meetingId) {
    console.error("Usage: node verify_artifacts.js <online_meeting_id> [organizer_object_id]");
    process.exit(1);
  }

  const client = graphClientFactory.getGraphClient(null);

  console.log("--- GRAPH API VERIFICATION ---");
  console.log(`Organizer: ${organizerId}`);
  console.log(`Meeting ID: ${meetingId}`);

  try {
    // 1. Check Recording
    console.log("\n[Checking Recordings]");
    const recordingsUrl = `/users/${organizerId}/onlineMeetings/${meetingId}/recordings`;
    const recordings = await client.api(recordingsUrl).get();
    
    if (recordings.value && recordings.value.length > 0) {
      console.log("✅ Recording exists!");
      console.log(JSON.stringify(recordings.value, null, 2));
    } else {
      console.log("❌ No recordings found. (If meeting just ended, it may take 2-5 minutes to process)");
    }

    // 2. Check Transcript
    console.log("\n[Checking Transcripts]");
    const transcriptsUrl = `/users/${organizerId}/onlineMeetings/${meetingId}/transcripts`;
    const transcripts = await client.api(transcriptsUrl).get();
    
    if (transcripts.value && transcripts.value.length > 0) {
      console.log("✅ Transcript exists!");
      console.log(JSON.stringify(transcripts.value, null, 2));
    } else {
      console.log("❌ No transcripts found.");
    }

  } catch (err) {
    console.error("\n[Graph API Error]");
    if (err.statusCode === 403) {
      console.error("403 Forbidden. Application does not have required permissions.");
      console.error("Missing scopes: OnlineMeetingArtifact.Read.All, OnlineMeetingTranscript.Read.All");
    } else {
      console.error(err.message);
      console.error(err);
    }
  }
}

main().catch(console.error);
