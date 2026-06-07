/**
 * services/queue/schedulingWorkers.js
 *
 * BullMQ Worker processors for async scheduling tasks.
 * Includes Dead Letter Queue (DLQ) injection on terminal failures.
 */
const { Worker } = require('bullmq');
const redisClient = require('../../config/redis');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// In a real app, you would import TeamsGraphService here to perform actual tasks
// const TeamsGraphService = require('../msGraph/teamsGraphService');

const workerOptions = {
  connection: redisClient,
  concurrency: 5, // Process 5 jobs at once
};

const schedulingWorker = new Worker('schedulingQueue', async (job) => {
  console.log(`[SchedulingWorker] Processing job ${job.id} of type ${job.name}`);
  
  const { type, payload } = job.data;

  switch (type) {
    case 'SEND_INVITE':
      // await TeamsGraphService.createMeeting(payload.interviewId);
      console.log(`Sending Teams invite for interview ${payload.interviewId}`);
      break;

    case 'SEND_REMINDER':
      console.log(`Sending reminder email to ${payload.email} for interview ${payload.interviewId}`);
      break;

    case 'SYNC_GRAPH':
      console.log(`Syncing graph events for candidate ${payload.candidateId}`);
      break;

    default:
      console.warn(`[SchedulingWorker] Unknown job type: ${type}`);
  }

  return { success: true, processedAt: new Date().toISOString() };
}, workerOptions);

// Dead Letter Queue (DLQ) Implementation
// When a job exhausts all 5 exponential backoff attempts, it hits the 'failed' event.
schedulingWorker.on('failed', async (job, err) => {
  console.error(`[SchedulingWorker] Job ${job?.id} permanently failed: ${err.message}`);
  
  if (job) {
    try {
      await prisma.deadLetterJob.create({
        data: {
          job_name: job.name,
          queue_name: 'schedulingQueue',
          payload: job.data,
          error_message: err.message,
          stack_trace: err.stack,
          retry_count: job.attemptsMade,
          status: 'PENDING'
        }
      });
      console.log(`[SchedulingWorker] Job ${job.id} moved to DeadLetterJob table.`);
    } catch (dbErr) {
      console.error('[SchedulingWorker] Failed to persist DLQ entry:', dbErr);
    }
  }
});

schedulingWorker.on('completed', (job) => {
  console.log(`[SchedulingWorker] Job ${job.id} completed successfully.`);
});

module.exports = schedulingWorker;
