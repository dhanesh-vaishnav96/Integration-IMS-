require('dotenv').config();
const graphClientFactory = require('./src/services/msGraph/graphClientFactory');

async function test() {
  try {
    const client = graphClientFactory.getGraphClient(null);
    const organizerId = process.env.TEAMS_ORGANIZER_OBJECT_ID;
    
    console.log("Testing /onlineMeetings API...");
    const res = await client.api(`/users/${organizerId}/onlineMeetings`).get();
    console.log("✅ SUCCESS! Application Access Policy is working.");
    console.log(res);
  } catch (err) {
    console.error("❌ FAILED!");
    if (err.statusCode === 403) {
       console.error("403 Forbidden. Application Access Policy is STILL missing.");
    } else {
       console.error(err.message);
    }
  }
}
test();
