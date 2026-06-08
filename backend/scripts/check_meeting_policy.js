require('dotenv').config();
const graphClientFactory = require('../src/services/msGraph/graphClientFactory');

async function main() {
  const organizerId = process.argv[2] || 'c94e5553-3965-412a-b328-c9fa31d925e6';
  const client = graphClientFactory.getGraphClient(null);

  try {
    console.log(`Checking organizer: ${organizerId}`);
    
    // Attempt to get the latest online meetings
    const meetings = await client.api(`/users/${organizerId}/onlineMeetings`)
      .get();
      
    if (meetings.value && meetings.value.length > 0) {
      const meeting = meetings.value[0];
      console.log("\n[LATEST ONLINE MEETING CONFIGURATION]");
      console.log(`ID: ${meeting.id}`);
      console.log(`Subject: ${meeting.subject}`);
      console.log(`Record Automatically: ${meeting.recordAutomatically}`);
      console.log(`Is Broadcast: ${meeting.isBroadcast}`);
    } else {
      console.log("No online meetings found via /onlineMeetings endpoint.");
    }
  } catch (err) {
    if (err.statusCode === 403) {
      console.error("\n[403 FORBIDDEN] Cannot read /onlineMeetings.");
      console.error("This confirms the Application Access Policy is not fully configured for OnlineMeetings API, which is why we fallback to Calendar Events.");
    } else {
      console.error(err);
    }
  }

  // Attempt to check users license
  try {
    const user = await client.api(`/users/${organizerId}?$select=assignedLicenses,assignedPlans`).get();
    console.log("\n[USER LICENSES]");
    console.log(JSON.stringify(user, null, 2));
  } catch(err) {
    console.error("Could not fetch user licenses.", err.message);
  }
}

main().catch(console.error);
