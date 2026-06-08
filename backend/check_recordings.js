require('dotenv').config();
const graphClientFactory = require('./src/services/msGraph/graphClientFactory');

// From the DB query:
const ORGANIZER_OBJECT_ID = 'c94e5553-3965-412a-b328-c9fa31d925e6';
const INTERVIEW_ID        = '6adc4b28-12ca-4fa2-8603-4e47829512cc';
const JOIN_URL            = 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_NjVhN2I1ZWUtN2EyNS00OTJhLWI5NmYtMWYwMTczNWFjYmE5%40thread.v2/0?context=%7b%22Tid%22%3a%2289bbc8b6-9f88-4e35-a3bd-15a8fa916d6d%22%2c%22Oid%22%3a%22c94e5553-3965-412a-b328-c9fa31d925e6%22%7d';

async function main() {
  const client = graphClientFactory.getGraphClient(null);

  // Step 1: Resolve the actual onlineMeeting ID from the joinUrl
  console.log('🔍 Step 1: Resolving onlineMeeting by joinWebUrl...');
  let onlineMeetingId = null;
  try {
    const filter = encodeURIComponent(`JoinWebUrl eq '${JOIN_URL}'`);
    const res = await client.api(`/users/${ORGANIZER_OBJECT_ID}/onlineMeetings?$filter=${filter}`).get();
    if (res.value && res.value.length > 0) {
      onlineMeetingId = res.value[0].id;
      console.log('✅ Resolved onlineMeeting ID:', onlineMeetingId);
      console.log('   recordAutomatically:', res.value[0].recordAutomatically);
    } else {
      console.log('⚠️  No onlineMeeting found for this joinUrl. The stored meeting may be Calendar-API-only.');
    }
  } catch (err) {
    console.error('❌ Filter query failed:', err.message);
  }

  if (!onlineMeetingId) {
    console.log('\n📋 Checking all recent online meetings for this organizer...');
    try {
      const res = await client.api(`/users/${ORGANIZER_OBJECT_ID}/onlineMeetings`).get();
      console.log('Online meetings returned:', res['@odata.count'] || res.value?.length);
    } catch (err) {
      console.error('❌ List meetings failed:', err.message);
    }
    return;
  }

  // Step 2: Fetch recordings
  console.log('\n🎥 Step 2: Fetching recordings...');
  try {
    const recordings = await client.api(
      `/users/${ORGANIZER_OBJECT_ID}/onlineMeetings/${onlineMeetingId}/recordings`
    ).get();

    if (!recordings.value || recordings.value.length === 0) {
      console.log('⚠️  No recordings found. The recording may still be processing (can take 5-30 min after meeting ends).');
    } else {
      console.log(`✅ Found ${recordings.value.length} recording(s):`);
      recordings.value.forEach((r, i) => {
        console.log(`\n  Recording ${i + 1}:`);
        console.log('    ID:', r.id);
        console.log('    createdDateTime:', r.createdDateTime);
        console.log('    recordingContentUrl:', r.recordingContentUrl ? r.recordingContentUrl.substring(0, 80) + '...' : 'N/A');
        console.log('    Full object keys:', Object.keys(r));
      });
    }
  } catch (err) {
    console.error('❌ Recordings fetch failed!');
    console.error('   Status:', err.statusCode);
    console.error('   Message:', err.message);
    if (err.body) {
      try { console.error('   Body:', JSON.stringify(JSON.parse(err.body), null, 2)); }
      catch { console.error('   Body:', err.body); }
    }
  }

  // Step 3: Fetch transcripts
  console.log('\n📝 Step 3: Fetching transcripts...');
  try {
    const transcripts = await client.api(
      `/users/${ORGANIZER_OBJECT_ID}/onlineMeetings/${onlineMeetingId}/transcripts`
    ).get();

    if (!transcripts.value || transcripts.value.length === 0) {
      console.log('⚠️  No transcripts found yet.');
    } else {
      console.log(`✅ Found ${transcripts.value.length} transcript(s):`);
      transcripts.value.forEach((t, i) => {
        console.log(`\n  Transcript ${i + 1}:`);
        console.log('    ID:', t.id);
        console.log('    createdDateTime:', t.createdDateTime);
        console.log('    contentUrl:', t.transcriptContentUrl ? t.transcriptContentUrl.substring(0, 80) + '...' : 'N/A');
      });
    }
  } catch (err) {
    console.error('❌ Transcripts fetch failed:', err.message);
  }
}

main().catch(console.error);
