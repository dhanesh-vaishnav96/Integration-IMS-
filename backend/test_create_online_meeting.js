require('dotenv').config();
const graphClientFactory = require('./src/services/msGraph/graphClientFactory');

async function test() {
  try {
    const client = graphClientFactory.getGraphClient(null);
    const organizerId = process.env.TEAMS_ORGANIZER_OBJECT_ID;
    
    console.log("Creating onlineMeeting directly...");
    const meetingData = {
      startDateTime: new Date().toISOString(),
      endDateTime: new Date(Date.now() + 3600000).toISOString(),
      subject: "Direct OnlineMeeting Test",
      recordAutomatically: true
    };
    
    const res = await client.api(`/users/${organizerId}/onlineMeetings`).post(meetingData);
    console.log("✅ SUCCESS!");
    console.log(JSON.stringify(res, null, 2));
    
  } catch (err) {
    console.error("❌ FAILED!");
    console.error(err.message);
    if (err.body) console.error(err.body);
  }
}
test();
