/**
 * scripts/test-graph-scheduling.js
 *
 * Isolated test script to validate REAL Microsoft Teams scheduling flow
 * and calendar blocking via Graph API.
 *
 * Run: node scripts/test-graph-scheduling.js
 * Cleanup: node scripts/test-graph-scheduling.js --cleanup
 */

require('dotenv').config();
const { prisma } = require('../src/config/prisma');
const { getGraphClient } = require('../src/services/msGraph/graphClientFactory');

const PANELIST_EMAIL = 'nadeem.aehmad@kadellabs.com';
const CANDIDATE_EMAIL = 'dhanesh.vaishnav@kadellabs.com';
const ORGANIZER_ID = 'nadeem.aehmad@kadellabs.com'; // Testing UPN/Email fallback

// Target Time: 10 June 2026, 11:00 AM to 12:00 PM IST
// IST is UTC+5:30. 11:00 AM IST = 05:30 AM UTC.
const START_TIME_UTC = '2026-06-10T05:30:00Z';
const END_TIME_UTC = '2026-06-10T06:30:00Z';

const isCleanup = process.argv.includes('--cleanup');

async function mask(str) {
  if (!str) return 'NOT_SET';
  if (str.length <= 4) return '****';
  return str.substring(0, 4) + '*'.repeat(str.length - 8) + str.substring(str.length - 4);
}

async function verifyEnvironment() {
  console.log('\n--- VERIFYING ENVIRONMENT ---');
  console.log(`AUTH_MODE: ${process.env.AUTH_MODE}`);
  console.log(`GRAPH_ORGANIZER_USER_ID: ${ORGANIZER_ID}`);
  console.log(`AZURE_CLIENT_ID: ${await mask(process.env.AZURE_CLIENT_ID)}`);
  console.log(`AZURE_TENANT_ID: ${await mask(process.env.AZURE_TENANT_ID)}`);
  console.log(`AZURE_CLIENT_SECRET: ${await mask(process.env.AZURE_CLIENT_SECRET)}`);
  
  if (!ORGANIZER_ID) {
    throw new Error('GRAPH_ORGANIZER_USER_ID is missing from .env');
  }
}

async function runCleanup(client) {
  console.log('\n--- CLEANUP MODE ---');
  
  const testCandidate = await prisma.candidate.findUnique({
    where: { email: CANDIDATE_EMAIL }
  });

  if (testCandidate) {
    const testInterviews = await prisma.interview.findMany({
      where: {
        candidate_id: testCandidate.id,
        scheduled_time: new Date(START_TIME_UTC)
      }
    });

    for (const interview of testInterviews) {
      console.log(`Found DB record: ${interview.id}`);
      if (interview.teams_meeting_id) {
        try {
          console.log(`Deleting Teams Meeting: /users/${ORGANIZER_ID}/onlineMeetings/${interview.teams_meeting_id}`);
          await client.api(`/users/${ORGANIZER_ID}/onlineMeetings/${interview.teams_meeting_id}`).delete();
          console.log('✅ Teams meeting deleted from Graph.');
        } catch (err) {
          console.error(`⚠️ Failed to delete Teams meeting: ${err.message}`);
        }
      }
      
      // Attempt to find and delete calendar events for panelist
      try {
        console.log(`Looking for calendar events on ${PANELIST_EMAIL}`);
        const events = await client.api(`/users/${PANELIST_EMAIL}/calendar/events`)
            .filter(`subject eq 'Interview: dhanesh.vaishnav@kadellabs.com — Panelist'`)
            .get();
            
        for (const ev of events.value) {
          console.log(`Deleting Calendar Event: ${ev.id}`);
          await client.api(`/users/${PANELIST_EMAIL}/calendar/events/${ev.id}`).delete();
          console.log('✅ Calendar event deleted.');
        }
      } catch(err) {
        console.error(`⚠️ Failed to delete calendar events: ${err.message}`);
      }

      await prisma.interview.delete({ where: { id: interview.id } });
      console.log(`✅ DB record deleted.`);
    }
  }
  
  console.log('\n✅ Cleanup complete.');
}

async function executeTest() {
  let finalStatus = {
    organizerLookup: 'NO',
    calendarAccess: 'NO',
    calendarBlocked: 'NO',
    teamsCreated: 'NO',
    dbPersisted: 'NO',
    permissionGaps: 'None'
  };

  try {
    await verifyEnvironment();

    console.log('\n--- INITIALIZING GRAPH CLIENT ---');
    const client = getGraphClient();
    console.log('✅ Graph client initialized');

    if (isCleanup) {
      await runCleanup(client);
      return;
    }

    console.log('\n--- STEP 1: TEST USER LOOKUP ---');
    try {
      console.log(`Endpoint: GET /users/${ORGANIZER_ID}`);
      const organizer = await client.api(`/users/${ORGANIZER_ID}`).get();
      console.log(`✅ Organizer found!`);
      console.log(`  Organizer object type: User (verified by endpoint)`);
      console.log(`  Organizer display name: ${organizer.displayName}`);
      console.log(`  Organizer mail: ${organizer.mail}`);
      console.log(`  UPN: ${organizer.userPrincipalName}`);
      console.log(`  ID: ${organizer.id}`);
      console.log(`  AccountEnabled: ${organizer.accountEnabled}`);
      
      finalStatus.organizerLookup = 'YES';
    } catch (err) {
      if (err.statusCode === 404) {
        console.log(`⚠️ /users endpoint returned 404. Checking /directoryObjects to identify object type...`);
        try {
          console.log(`Endpoint: GET /directoryObjects/${ORGANIZER_ID}`);
          const dirObj = await client.api(`/directoryObjects/${ORGANIZER_ID}`).get();
          console.log(`❌ This organizer ID is not a User Object ID.`);
          console.log(`   It actually belongs to object type: ${dirObj['@odata.type']}`);
          if (dirObj.displayName) console.log(`   Display Name: ${dirObj.displayName}`);
          if (dirObj.appId) console.log(`   App ID: ${dirObj.appId}`);
          
          throw new Error(`Invalid Object Type. The provided ID corresponds to ${dirObj['@odata.type']}, not a User.`);
        } catch (dirErr) {
          throw new Error(`Graph Directory Object Lookup Failed:\nCode: ${dirErr.code || dirErr.body?.error?.code}\nMessage: ${dirErr.message}`);
        }
      } else {
        console.error(err);
        finalStatus.permissionGaps = err.code || err.body?.error?.code || 'User.Read.All missing';
        throw new Error(`Graph User Lookup Failed:\nEndpoint: /users/${ORGANIZER_ID}\nCode: ${err.code || err.body?.error?.code}\nMessage: ${err.message}`);
      }
    }

    console.log('\n--- STEP 2: TEST CALENDAR ACCESS ---');
    try {
      console.log(`Endpoint: GET /users/${ORGANIZER_ID}/calendar`);
      const calendar = await client.api(`/users/${ORGANIZER_ID}/calendar`).get();
      console.log(`✅ Calendar accessible!`);
      console.log(`  Calendar Name: ${calendar.name}`);
      console.log(`  Owner: ${calendar.owner?.address}`);
      finalStatus.calendarAccess = 'YES';
    } catch (err) {
      console.error(err);
      finalStatus.permissionGaps = err.code || err.body?.error?.code || 'Calendars.Read missing';
      throw new Error(`Graph Calendar Access Failed:\nEndpoint: /users/${ORGANIZER_ID}/calendar\nCode: ${err.code || err.body?.error?.code}\nMessage: ${err.message}`);
    }

    console.log('\n--- PREP: DB CHECKS ---');
    let candidate = await prisma.candidate.findUnique({ where: { email: CANDIDATE_EMAIL }});
    if (!candidate) {
      console.log('Creating test candidate...');
      candidate = await prisma.candidate.create({
        data: {
          name: 'dhanesh.vaishnav@kadellabs.com',
          email: CANDIDATE_EMAIL,
          job_role: 'Panelist'
        }
      });
    }

    const existingInterviews = await prisma.interview.findMany({
      where: {
        candidate_id: candidate.id,
        scheduled_time: new Date(START_TIME_UTC)
      }
    });

    for (const existing of existingInterviews) {
      console.log(`Found existing test interview: ${existing.id}. Deleting before test...`);
      await prisma.interview.delete({ where: { id: existing.id } });
    }

    const interview = await prisma.interview.create({
      data: {
        candidate_id: candidate.id,
        organizer_email: 'test.admin@kadellabs.com',
        scheduled_time: new Date(START_TIME_UTC),
        duration_minutes: 60,
        type: 'TECHNICAL',
        status: 'SCHEDULED'
      }
    });
    console.log(`✅ Created pending DB interview: ${interview.id}`);

    console.log('\n--- STEP 3: TEAMS SCHEDULING (SKIPPED) ---');
    console.log('Skipping online meeting creation to isolate calendar blocking test.');
    finalStatus.teamsCreated = 'SKIPPED';

    console.log('\n--- STEP 4: CREATE CALENDAR BLOCK ---');
    let eventId;
    let meetingJoinUrl = null;
    const eventPayload = {
      subject: 'IMS Interview - With Teams',
      start: { dateTime: START_TIME_UTC, timeZone: 'UTC' },
      end: { dateTime: END_TIME_UTC, timeZone: 'UTC' },
      location: { displayName: 'Microsoft Teams' },
      attendees: [
        {
          emailAddress: { address: CANDIDATE_EMAIL, name: 'Candidate' },
          type: 'required'
        }
      ],
      body: {
        contentType: 'HTML',
        content: `Please join the IMS Interview session.`
      },
      showAs: 'busy',
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness'
    };
    try {
      console.log(`Endpoint: POST /users/${PANELIST_EMAIL}/calendar/events`);
      console.log(`Payload: ${JSON.stringify(eventPayload, null, 2)}`);
      
      const event = await client.api(`/users/${PANELIST_EMAIL}/calendar/events`).post(eventPayload);
      eventId = event.id;
      
      if (event.onlineMeeting && event.onlineMeeting.joinUrl) {
        meetingJoinUrl = event.onlineMeeting.joinUrl;
      }
      
      console.log(`\n✅ Calendar Event Blocked!`);
      console.log(`Raw Response (partial):`);
      console.log(`  ID: ${eventId}`);
      console.log(`  Status: ${event.showAs}`);
      console.log(`  Join URL: ${meetingJoinUrl || 'MISSING (Check licensing or provider settings)'}`);
      finalStatus.calendarBlocked = 'YES';
    } catch (err) {
      console.error(err);
      finalStatus.permissionGaps = err.code || err.body?.error?.code || 'Calendars.ReadWrite missing';
      throw new Error(`Graph Calendar Block Failed:\nEndpoint: /users/${PANELIST_EMAIL}/calendar/events\nCode: ${err.code || err.body?.error?.code}\nMessage: ${err.message}`);
    }

    console.log('\n--- STEP 5: VERIFY ONLINE MEETING PROPERTIES ---');
    if (meetingJoinUrl) {
      try {
        console.log(`Endpoint: GET /users/${PANELIST_EMAIL}/onlineMeetings?$filter=JoinWebUrl eq '${meetingJoinUrl}'`);
        const onlineMeetings = await client.api(`/users/${PANELIST_EMAIL}/onlineMeetings`)
          .filter(`JoinWebUrl eq '${meetingJoinUrl}'`)
          .get();
        
        if (onlineMeetings.value && onlineMeetings.value.length > 0) {
          const meeting = onlineMeetings.value[0];
          console.log(`✅ Found onlineMeeting object corresponding to calendar event!`);
          console.log(`  Meeting ID: ${meeting.id}`);
          console.log(`  Record Automatically (current): ${meeting.recordAutomatically}`);
          
          console.log(`\nAttempting to PATCH recordAutomatically = true...`);
          try {
            await client.api(`/users/${PANELIST_EMAIL}/onlineMeetings/${meeting.id}`)
              .patch({ recordAutomatically: true });
            console.log(`✅ Successfully updated recordAutomatically to TRUE!`);
            finalStatus.autoRecordPossible = 'YES';
          } catch (patchErr) {
            console.error(`❌ Failed to PATCH onlineMeeting: ${patchErr.message}`);
            finalStatus.autoRecordPossible = `NO (PATCH Failed: ${patchErr.code || 'Unknown'})`;
          }
        } else {
          console.log(`❌ Could not find onlineMeeting object using filter.`);
          finalStatus.autoRecordPossible = 'NO (Meeting not found)';
        }
      } catch (err) {
        console.error(`❌ Failed to query onlineMeetings endpoint: ${err.message}`);
        finalStatus.autoRecordPossible = `NO (GET Failed: ${err.code || 'Unknown'})`;
      }
    } else {
      finalStatus.autoRecordPossible = 'NO (No Join URL)';
    }

    console.log('\n--- STEP 6: PERSIST DB METADATA ---');
    const updated = await prisma.interview.update({
      where: { id: interview.id },
      data: {
        graph_event_id: eventId,
        meeting_join_url: meetingJoinUrl
      }
    });
    console.log(`✅ DB Persisted Successfully!`);
    finalStatus.dbPersisted = 'YES';

    console.log('\n========================================');
    console.log('            FINAL SUMMARY               ');
    console.log('========================================');
    console.log('RESULT:                 DONE');
    console.log(`Organizer Lookup:       ${finalStatus.organizerLookup}`);
    console.log(`Calendar Access:        ${finalStatus.calendarAccess}`);
    console.log(`Calendar Blocking:      ${finalStatus.calendarBlocked}`);
    console.log(`Teams Meeting:          ${meetingJoinUrl ? 'AUTO-GENERATED' : 'SKIPPED'}`);
    console.log(`Auto Record Possible:   ${finalStatus.autoRecordPossible}`);
    console.log(`Database Update:        ${finalStatus.dbPersisted}`);
    console.log('========================================');

  } catch (err) {
    console.error('\n========================================');
    console.error('            FINAL SUMMARY               ');
    console.error('========================================');
    console.error('RESULT:                 FAIL ❌');
    console.error(`Organizer Lookup:       ${finalStatus.organizerLookup}`);
    console.error(`Calendar Access:        ${finalStatus.calendarAccess}`);
    console.error(`Calendar Blocking:      ${finalStatus.calendarBlocked}`);
    console.error(`Teams Meeting:          ${finalStatus.teamsCreated}`);
    console.error(`Database Update:        ${finalStatus.dbPersisted}`);
    console.error('\nGraph Errors:');
    console.error(err.message);
    console.error('========================================');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

executeTest();
