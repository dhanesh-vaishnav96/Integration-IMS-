require('dotenv').config();
const graphClientFactory = require('./src/services/msGraph/graphClientFactory');

async function test() {
  try {
    const client = graphClientFactory.getGraphClient(null);
    const organizerId = process.env.TEAMS_ORGANIZER_OBJECT_ID;
    
    console.log("Fetching onlineMeetings to get the ID...");
    const joinUrl = "https://teams.microsoft.com/l/meetup-join/19%3ameeting_NjVhN2I1ZWUtN2EyNS00OTJhLWI5NmYtMWYwMTczNWFjYmE5%40thread.v2/0?context=%7b%22Tid%22%3a%2289bbc8b6-9f88-4e35-a3bd-15a8fa916d6d%22%2c%22Oid%22%3a%22c94e5553-3965-412a-b328-c9fa31d925e6%22%7d";
    
    // Instead of fetch, since $filter doesn't work well without exact match
    // Wait, the online meeting ID for our direct one was returned earlier!
    const meetingId = "MSpjOTRlNTU1My0zOTY1LTQxMmEtYjMyOC1jOWZhMzFkOTI1ZTYqMCoqMTk6bWVldGluZ19NVFl5TXpaaE1Ua3RZVGRqTXkwME5XVTVMVGhoTURjdFlXWmxNelZoWVRrNFkySmhAdGhyZWFkLnYy";
    
    console.log("Patching the meeting...");
    const res = await client.api(`/users/${organizerId}/onlineMeetings/${meetingId}`).patch({
       recordAutomatically: false
    });
    
    console.log("✅ PATCH SUCCESS!");
    console.log(res);
  } catch (err) {
    console.error("❌ FAILED!");
    console.error(err.message);
  }
}
test();
