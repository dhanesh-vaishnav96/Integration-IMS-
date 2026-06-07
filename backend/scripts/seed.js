/**
 * scripts/seed.js
 *
 * Database seeding script for development and testing.
 *
 * What it seeds:
 *  - 5 sample candidates (various roles and skills)
 *  - 6 sample interviews (linked to the above candidates)
 *
 * Usage:
 *   node scripts/seed.js           (seeds the database)
 *   node scripts/seed.js --clear   (clears all collections first, then seeds)
 *
 * IMPORTANT: Never run this against production.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { Candidate } = require('../src/models/Candidate');
const { Interview } = require('../src/models/Interview');
const { InterviewAsset } = require('../src/models/InterviewAsset');
const { INTERVIEW_STATUS, ASSET_STATUS } = require('../src/constants');
const logger = require('../src/config/logger');

const CLEAR = process.argv.includes('--clear');

// ─── Sample Data ───────────────────────────────────────────────────────────

const CANDIDATES = [
  {
    name: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    phone: '+91-9876543210',
    job_role: 'Senior React Developer',
    years_of_experience: 5,
    skills: ['React', 'TypeScript', 'Node.js', 'AWS', 'GraphQL'],
    status: 'ACTIVE',
    createdBy: 'admin@company.com',
  },
  {
    name: 'Rahul Mehta',
    email: 'rahul.mehta@example.com',
    phone: '+91-9123456789',
    job_role: 'Backend Engineer',
    years_of_experience: 3,
    skills: ['Java', 'Spring Boot', 'PostgreSQL', 'Docker', 'Kubernetes'],
    status: 'ACTIVE',
    createdBy: 'admin@company.com',
  },
  {
    name: 'Ananya Krishnan',
    email: 'ananya.k@example.com',
    phone: '+91-8765432109',
    job_role: 'DevOps Engineer',
    years_of_experience: 4,
    skills: ['AWS', 'Terraform', 'Kubernetes', 'CI/CD', 'Python'],
    status: 'ACTIVE',
    createdBy: 'admin@company.com',
  },
  {
    name: 'Arjun Patel',
    email: 'arjun.patel@example.com',
    phone: '+91-7654321098',
    job_role: 'Full Stack Developer',
    years_of_experience: 2,
    skills: ['React', 'Node.js', 'MongoDB', 'Express', 'REST APIs'],
    status: 'HIRED',
    createdBy: 'admin@company.com',
  },
  {
    name: 'Sneha Joshi',
    email: 'sneha.joshi@example.com',
    phone: '+91-6543210987',
    job_role: 'Data Engineer',
    years_of_experience: 6,
    skills: ['Python', 'PySpark', 'Kafka', 'AWS Glue', 'Snowflake'],
    status: 'ON_HOLD',
    createdBy: 'admin@company.com',
  },
];

const buildInterviews = (candidateIds) => {
  const now = new Date();
  const future = (days) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const past = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  return [
    {
      candidate_id: candidateIds[0],
      organizer_email: 'hr@company.com',
      interviewer_email: 'tech.lead@company.com',
      scheduled_time: future(2),
      duration_minutes: 60,
      status: INTERVIEW_STATUS.SCHEDULED,
      meeting_provider: 'TEAMS',
      createdBy: 'hr@company.com',
    },
    {
      candidate_id: candidateIds[1],
      organizer_email: 'hr@company.com',
      interviewer_email: 'backend.lead@company.com',
      scheduled_time: future(5),
      duration_minutes: 90,
      status: INTERVIEW_STATUS.SCHEDULED,
      meeting_provider: 'TEAMS',
      teams_meeting_id: 'mock-teams-meeting-001',
      meeting_join_url: 'https://teams.microsoft.com/l/meetup-join/mock-001',
      createdBy: 'hr@company.com',
    },
    {
      candidate_id: candidateIds[2],
      organizer_email: 'hr@company.com',
      interviewer_email: 'devops.lead@company.com',
      scheduled_time: past(3),
      duration_minutes: 60,
      status: INTERVIEW_STATUS.COMPLETED,
      meeting_provider: 'TEAMS',
      teams_meeting_id: 'mock-teams-meeting-002',
      meeting_join_url: 'https://teams.microsoft.com/l/meetup-join/mock-002',
      createdBy: 'hr@company.com',
    },
    {
      candidate_id: candidateIds[3],
      organizer_email: 'hr@company.com',
      interviewer_email: 'fullstack.lead@company.com',
      scheduled_time: past(10),
      duration_minutes: 45,
      status: INTERVIEW_STATUS.COMPLETED,
      meeting_provider: 'TEAMS',
      teams_meeting_id: 'mock-teams-meeting-003',
      meeting_join_url: 'https://teams.microsoft.com/l/meetup-join/mock-003',
      createdBy: 'hr@company.com',
    },
    {
      candidate_id: candidateIds[4],
      organizer_email: 'hr@company.com',
      interviewer_email: 'data.lead@company.com',
      scheduled_time: past(1),
      duration_minutes: 60,
      status: INTERVIEW_STATUS.CANCELLED,
      meeting_provider: 'TEAMS',
      createdBy: 'hr@company.com',
    },
    {
      candidate_id: candidateIds[0],
      organizer_email: 'hr@company.com',
      interviewer_email: 'cto@company.com',
      scheduled_time: future(7),
      duration_minutes: 30,
      status: INTERVIEW_STATUS.SCHEDULED,
      meeting_provider: 'TEAMS',
      createdBy: 'hr@company.com',
    },
  ];
};

const buildAssets = (interviews) => {
  // Only create assets for COMPLETED interviews
  return interviews
    .filter((i) => i.status === INTERVIEW_STATUS.COMPLETED)
    .map((interview) => ({
      interview_id: interview._id,
      candidate_id: interview.candidate_id,
      recording_s3_key: `${interview.candidate_id}/${interview._id}/recording.mp4`,
      recording_s3_url: `https://s3.amazonaws.com/interview-assets/${interview.candidate_id}/${interview._id}/recording.mp4`,
      transcript_s3_key: `${interview.candidate_id}/${interview._id}/transcript.txt`,
      transcript_s3_url: `https://s3.amazonaws.com/interview-assets/${interview.candidate_id}/${interview._id}/transcript.txt`,
      recording_status: ASSET_STATUS.UPLOADED,
      transcript_status: ASSET_STATUS.UPLOADED,
      processing_logs: [
        { status: ASSET_STATUS.PENDING, message: 'Webhook received', timestamp: new Date() },
        { status: ASSET_STATUS.PROCESSING, message: 'Downloading from Graph API', timestamp: new Date() },
        { status: ASSET_STATUS.UPLOADED, message: 'Successfully uploaded to S3', timestamp: new Date() },
      ],
    }));
};

// ─── Main Seed Function ─────────────────────────────────────────────────────

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    logger.info(`Connected to MongoDB: ${mongoose.connection.host}`);

    if (CLEAR) {
      logger.info('Clearing existing data...');
      await Promise.all([
        Candidate.deleteMany({}),
        Interview.deleteMany({}),
        InterviewAsset.deleteMany({}),
      ]);
      logger.info('Collections cleared.');
    }

    // Seed Candidates
    logger.info('Seeding candidates...');
    const createdCandidates = await Candidate.insertMany(CANDIDATES);
    const candidateIds = createdCandidates.map((c) => c._id);
    logger.info(`✓ Created ${createdCandidates.length} candidates`);

    // Seed Interviews
    logger.info('Seeding interviews...');
    const interviewDocs = buildInterviews(candidateIds);
    const createdInterviews = await Interview.insertMany(interviewDocs);
    logger.info(`✓ Created ${createdInterviews.length} interviews`);

    // Seed Assets (only for completed interviews)
    logger.info('Seeding interview assets...');
    const assetDocs = buildAssets(createdInterviews);
    const createdAssets = await InterviewAsset.insertMany(assetDocs);
    logger.info(`✓ Created ${createdAssets.length} interview assets`);

    // Summary
    logger.info('\n=== Seed Summary ===');
    logger.info(`Candidates: ${createdCandidates.length}`);
    createdCandidates.forEach((c) => logger.info(`  - [${c._id}] ${c.name} (${c.email})`));
    logger.info(`Interviews: ${createdInterviews.length}`);
    logger.info(`Assets:     ${createdAssets.length}`);
    logger.info('=== Seeding Complete ===');

  } catch (error) {
    logger.error(`Seed failed: ${error.message}`);
    if (error.code === 11000) {
      logger.error('Duplicate key error. Run with --clear flag to reset data first.');
      logger.error('Command: node scripts/seed.js --clear');
    }
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed.');
    process.exit(0);
  }
};

seed();
