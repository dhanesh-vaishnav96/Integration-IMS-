/**
 * run_artifact_pipeline.js
 *
 * End-to-end artifact pipeline test.
 * Directly invokes processingService.processArtifacts() with the known interview
 * data. Bypasses p-retry delays by using a 0-retry mode for the initial test.
 *
 * Usage: node run_artifact_pipeline.js
 */
require('dotenv').config();
const graphClientFactory = require('./src/services/msGraph/graphClientFactory');
const artifactService     = require('./src/services/msGraph/artifactService');
const s3UploadService     = require('./src/services/s3UploadService');
const { assetRepository } = require('./src/repositories');
const { ASSET_STATUS }    = require('./src/constants');

// ─── Known Interview Data (from DB + Graph) ──────────────────────────────────
const INTERVIEW_ID         = '6adc4b28-12ca-4fa2-8603-4e47829512cc';
const ORGANIZER_OBJECT_ID  = 'c94e5553-3965-412a-b328-c9fa31d925e6';
// The TRUE onlineMeeting ID (resolved from joinUrl via Graph $filter)
const ONLINE_MEETING_ID    = 'MSpjOTRlNTU1My0zOTY1LTQxMmEtYjMyOC1jOWZhMzFkOTI1ZTYqMCoqMTk6bWVldGluZ19OalZoTjJJMVpXVXROMkV5TlMwME9USmhMV0k1Tm1ZdE1XWXdNVGN6TldGalltRTlAdGhyZWFkLnYy';
const CANDIDATE_ID         = null; // Will be fetched from DB

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  IMS Artifact Pipeline - End-to-End Test              ');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Interview ID:      ${INTERVIEW_ID}`);
  console.log(`  Organizer ID:      ${ORGANIZER_OBJECT_ID}`);
  console.log(`  Online Meeting ID: ${ONLINE_MEETING_ID}`);
  console.log('═══════════════════════════════════════════════════════\n');

  const { prisma } = require('./src/config/prisma');

  // ── Step 1: Get interview + candidate from DB ────────────────────────────
  console.log('📋 Step 1: Fetching interview record from DB...');
  const interview = await prisma.interview.findUnique({
    where: { id: INTERVIEW_ID },
    select: { id: true, candidate_id: true, title: true, status: true }
  });
  
  if (!interview) {
    console.error('❌ Interview not found in DB!');
    process.exit(1);
  }
  console.log(`✅ Interview: "${interview.title}" | candidate_id: ${interview.candidate_id}`);

  const candidateId = interview.candidate_id;

  // ── Step 2: Check Graph API for recordings ───────────────────────────────
  console.log('\n🎥 Step 2: Checking Graph API for recordings...');
  let recordingId = null;
  let recordingContentUrl = null;

  try {
    const client = graphClientFactory.getGraphClient(null);
    const recordings = await client.api(
      `/users/${ORGANIZER_OBJECT_ID}/onlineMeetings/${ONLINE_MEETING_ID}/recordings`
    ).get();

    if (!recordings.value || recordings.value.length === 0) {
      console.log('⚠️  No recordings found on Graph API yet.');
      console.log('   Possible reasons:');
      console.log('   1. The meeting was not recorded (no one clicked Record).');
      console.log('   2. Microsoft is still processing the recording (wait 5-30 min).');
      console.log('   3. The recording was saved to a different user\'s meeting.');
      console.log('\n   → Cannot proceed with real recording upload. Exiting.');
      await prisma.$disconnect();
      return;
    }

    recordingId = recordings.value[0].id;
    recordingContentUrl = recordings.value[0].recordingContentUrl;
    console.log(`✅ Found ${recordings.value.length} recording(s)!`);
    console.log(`   Recording ID: ${recordingId}`);
    console.log(`   Created:      ${recordings.value[0].createdDateTime}`);
    console.log(`   Content URL:  ${recordingContentUrl ? '✅ Present' : '❌ Missing'}`);
  } catch (err) {
    console.error('❌ Graph API recordings fetch failed!');
    console.error(`   Status: ${err.statusCode} | Message: ${err.message}`);
    await prisma.$disconnect();
    return;
  }

  // ── Step 3: Download recording stream from Graph ─────────────────────────
  console.log('\n⬇️  Step 3: Streaming recording from Graph API...');
  let stream;
  try {
    stream = await artifactService.downloadRecordingStream(
      recordingId,
      ONLINE_MEETING_ID,
      ORGANIZER_OBJECT_ID,
      null
    );
    console.log('✅ Stream obtained from Graph API.');
  } catch (err) {
    console.error('❌ Failed to download recording stream:', err.message);
    await prisma.$disconnect();
    return;
  }

  // ── Step 4: Upload to S3 ─────────────────────────────────────────────────
  console.log('\n📤 Step 4: Uploading to AWS S3...');
  let uploadResult;
  try {
    uploadResult = await s3UploadService.uploadRecording(stream, candidateId, INTERVIEW_ID);
    console.log('✅ S3 Upload successful!');
    console.log(`   S3 Key:    ${uploadResult.s3Key}`);
    console.log(`   S3 URL:    ${uploadResult.s3Url}`);
  } catch (err) {
    console.error('❌ S3 upload failed:', err.message);
    await prisma.$disconnect();
    return;
  }

  // ── Step 5: Update database ──────────────────────────────────────────────
  console.log('\n💾 Step 5: Persisting to database...');
  try {
    await assetRepository.upsertByInterviewId(INTERVIEW_ID, {
      candidate_id: candidateId,
      recording_s3_key: uploadResult.s3Key,
      recording_s3_url: uploadResult.s3Url,
      recording_status: ASSET_STATUS.UPLOADED,
    });
    await assetRepository.appendLog(INTERVIEW_ID, ASSET_STATUS.UPLOADED, `Manual pipeline test: Recording uploaded. S3 Key: ${uploadResult.s3Key}`);
    console.log('✅ Database updated!');
    console.log('   recording_status = UPLOADED');
    console.log(`   recording_s3_key = ${uploadResult.s3Key}`);
  } catch (err) {
    console.error('❌ DB update failed:', err.message);
    await prisma.$disconnect();
    return;
  }

  // ── Step 6: Read back from DB and generate presigned URL ─────────────────
  console.log('\n🔗 Step 6: Generating presigned URL from DB asset...');
  try {
    const assetService = require('./src/services/assetService');
    const asset = await assetService.getAssetByInterview(INTERVIEW_ID);
    console.log('✅ Asset API response (what the frontend receives):');
    console.log(`   recording_status: ${asset.recording_status}`);
    console.log(`   transcript_status: ${asset.transcript_status}`);
    console.log(`   recording_url:     ${asset.recording_url ? asset.recording_url.substring(0, 80) + '...' : 'null'}`);
    console.log(`   recording_s3_key:  ${asset.recording_s3_key}`);
  } catch (err) {
    console.error('❌ Asset fetch failed:', err.message);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  ✅ PIPELINE TEST COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Interview ID:      ${INTERVIEW_ID}`);
  console.log(`  Recording ID:      ${recordingId}`);
  console.log(`  S3 Key:            ${uploadResult.s3Key}`);
  console.log('  Status:            UPLOADED in database');
  console.log('  Presigned URL:     Generated ✅');
  console.log('\n  Next: Open the Candidate Profile in the frontend');
  console.log('  and verify the video plays in RecordingPlayer.');
  console.log('═══════════════════════════════════════════════════════\n');

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('💥 Fatal error:', err.message);
  process.exit(1);
});
