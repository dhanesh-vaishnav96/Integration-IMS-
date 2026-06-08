require('dotenv').config();
const graphClientFactory = require('./src/services/msGraph/graphClientFactory');

const ORGANIZER_OBJECT_ID = 'c94e5553-3965-412a-b328-c9fa31d925e6';

async function main() {
  const client = graphClientFactory.getGraphClient(null);

  // Fetch all online meetings for the organizer
  console.log('📋 Listing all online meetings for organizer...');
  try {
    const res = await client.api(`/users/${ORGANIZER_OBJECT_ID}/onlineMeetings`).get();
    const meetings = res.value || [];
    console.log(`Found ${meetings.length} online meeting(s).`);

    for (const m of meetings) {
      console.log(`\n  Meeting: ${m.subject}`);
      console.log(`    ID: ${m.id}`);
      console.log(`    Start: ${m.startDateTime}`);
      console.log(`    End:   ${m.endDateTime}`);

      // Check for recordings on each meeting
      try {
        const recs = await client.api(`/users/${ORGANIZER_OBJECT_ID}/onlineMeetings/${m.id}/recordings`).get();
        if (recs.value && recs.value.length > 0) {
          console.log(`    🎥 RECORDINGS FOUND: ${recs.value.length}`);
          recs.value.forEach(r => {
            console.log(`       Recording ID: ${r.id}`);
            console.log(`       Created: ${r.createdDateTime}`);
            console.log(`       Content URL: ${r.recordingContentUrl ? '✅ Present' : '❌ Missing'}`);
          });
        } else {
          console.log(`    📭 No recordings`);
        }
      } catch (e) {
        console.log(`    ❌ Recording check failed: ${e.message}`);
      }
    }
  } catch (err) {
    console.error('❌ Failed:', err.message);
  }
}

main().catch(console.error);
