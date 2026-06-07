const axios = require('axios');
const candidateId = '103c969b-e764-4ab9-9c89-c15099305638'; // John Doe

async function testInterviews() {
  let createdInterviewId;
  const baseUrl = 'http://localhost:5000/api/v1/interviews';

  try {
    console.log('--- POST /api/v1/interviews ---');
    const payload = {
      candidate_id: candidateId,
      scheduled_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      duration_minutes: 60,
      organizer_email: 'admin@test.com',
      interviewer_email: 'interviewer@test.com'
    };
    console.log('Payload:', payload);
    const postRes = await axios.post(baseUrl, payload);
    console.log(`Status: ${postRes.status}`);
    console.log('Response:', JSON.stringify(postRes.data, null, 2));
    createdInterviewId = postRes.data.data.id || postRes.data.data._id;

    console.log('\n--- GET /api/v1/interviews ---');
    const getRes = await axios.get(baseUrl);
    console.log(`Status: ${getRes.status}`);
    console.log(`Total count: ${getRes.data.data?.pagination?.total || getRes.data.data?.data?.length}`);
    console.log('Sample Response:', JSON.stringify(getRes.data.data?.data?.[0], null, 2));

    console.log(`\n--- PUT /api/v1/interviews/${createdInterviewId} ---`);
    const putPayload = { duration_minutes: 90 };
    console.log('Payload:', putPayload);
    const putRes = await axios.put(`${baseUrl}/${createdInterviewId}`, putPayload);
    console.log(`Status: ${putRes.status}`);
    console.log('Response:', JSON.stringify(putRes.data, null, 2));

    console.log(`\n--- DELETE /api/v1/interviews/${createdInterviewId} ---`);
    const delRes = await axios.delete(`${baseUrl}/${createdInterviewId}`);
    console.log(`Status: ${delRes.status}`);
    console.log('Response:', JSON.stringify(delRes.data, null, 2));

  } catch (error) {
    console.error('API Error:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
  }
}

testInterviews();
