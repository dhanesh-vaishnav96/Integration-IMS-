require('dotenv').config();
const graphClientFactory = require('./src/services/msGraph/graphClientFactory');

async function test() {
  try {
    const client = graphClientFactory.getGraphClient(null);
    const organizerId = process.env.TEAMS_ORGANIZER_OBJECT_ID;
    
    console.log("1. Creating onlineMeeting directly...");
    const meetingData = {
      startDateTime: new Date().toISOString(),
      endDateTime: new Date(Date.now() + 3600000).toISOString(),
      subject: "Direct OnlineMeeting Test",
      recordAutomatically: true
    };
    const onlineMeeting = await client.api(`/users/${organizerId}/onlineMeetings`).post(meetingData);
    console.log("✅ Created OnlineMeeting:", onlineMeeting.joinWebUrl);
    
    console.log("2. Creating calendar event with onlineMeetingUrl...");
    const eventPayload = {
      subject: "Test Linked Meeting",
      start: { dateTime: meetingData.startDateTime, timeZone: 'UTC' },
      end: { dateTime: meetingData.endDateTime, timeZone: 'UTC' },
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness',
      onlineMeetingUrl: onlineMeeting.joinWebUrl // Will Graph accept this?
    };
    
    const event = await client.api(`/users/${organizerId}/calendar/events`).post(eventPayload);
    console.log("✅ Created Calendar Event!");
    console.log("Event Join URL:", event.onlineMeeting.joinUrl);
    
    if (event.onlineMeeting.joinUrl === onlineMeeting.joinWebUrl) {
       console.log("🎉 SUCCESS: The URLs match! The calendar event linked to our manual meeting!");
    } else {
       console.log("❌ FAILED: The URLs do not match! Exchange generated a new meeting.");
    }
  } catch (err) {
    console.error("❌ ERROR:", err.message);
    if (err.body) console.error(err.body);
  }
}
test();
