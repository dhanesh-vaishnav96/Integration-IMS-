const fetch = require('node-fetch'); // or native fetch if Node 18+

async function run() {
  const payload = {
    title: "Auto-Recording Verification Test",
    candidate_id: "6adc4b28-12ca-4fa2-8603-4e47829512cc", // Dummy or actual candidate ID, might fail validation if strict
    scheduled_time: new Date(Date.now() + 3600000).toISOString(),
    duration_minutes: 15,
    type: "TECHNICAL",
    interviewer_email: "mahima.dangi@kadellabs.com",
    panelists: ["dhanesh.vaishnav@kadellabs.com"]
  };

  try {
    console.log("Triggering scheduling API...");
    // Let's assume candidate creation or we just use raw emails if API allows
    // Wait, the API requires a candidate ID that exists in DB.
    // Instead of hitting the API, let's just invoke the service directly!
  } catch (err) {
    console.error(err);
  }
}
run();
