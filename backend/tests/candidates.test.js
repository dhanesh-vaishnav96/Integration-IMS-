const request = require('supertest');
const app = require('../src/app');
const mongoose = require('mongoose');

describe('Candidate API Endpoints', () => {
  let candidateId;

  // Ideally, use an in-memory mongoDB here for pure unit tests
  
  it('should create a new candidate', async () => {
    const res = await request(app)
      .post('/api/v1/candidates')
      .send({
        name: 'John Test',
        email: 'johntest@example.com',
        phone: '+1234567890',
        job_role: 'Backend Engineer',
        years_of_experience: 5,
      });
      
    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('John Test');
    candidateId = res.body.data._id;
  });

  it('should fetch all candidates', async () => {
    const res = await request(app).get('/api/v1/candidates');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body.data.candidates)).toBeTruthy();
  });

  it('should prevent duplicate emails', async () => {
    const res = await request(app)
      .post('/api/v1/candidates')
      .send({
        name: 'Jane Test',
        email: 'johntest@example.com', // Duplicate
        job_role: 'QA Engineer',
      });
    expect(res.statusCode).toEqual(409); // Conflict
  });
});
