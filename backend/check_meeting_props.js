require('dotenv').config();
const graphClientFactory = require('./src/services/msGraph/graphClientFactory');

async function test() {
  try {
    const client = graphClientFactory.getGraphClient(null);
    const organizerId = process.env.TEAMS_ORGANIZER_OBJECT_ID;
    
    // Hardcoded join URL from the previous logs
    const joinUrl = "https://teams.microsoft.com/l/meetup-join/19%3ameeting_NjVhN2I1ZWUtN2EyNS00OTJhLWI5NmYtMWYwMTczNWFjYmE5%40thread.v2/0?context=%7b%22Tid%22%3a%2289bbc8b6-9f88-4e35-a3bd-15a8fa916d6d%22%2c%22Oid%22%3a%22c94e5553-3965-412a-b328-c9fa31d925e6%22%7d";
    
    console.log("Fetching onlineMeeting by joinWebUrl...");
    const res = await client.api(`/users/${organizerId}/onlineMeetings?$filter=JoinWebUrl eq '${joinUrl}'`).get();
    console.log("Response:", JSON.stringify(res, null, 2));
    
  } catch (err) {
    console.error(err);
  }
}
test();
