/**
 * jobs/interviewCompletedScanJob.js
 *
 * Cron job that scans the database for completed interviews (i.e. where the
 * scheduled time + duration has passed) that don't have their recordings
 * and transcripts processed yet, and triggers the sync pipeline automatically.
 */
const cron = require('node-cron');
const { prisma } = require('../config/prisma');
const processingService = require('../services/processingService');
const logger = require('../config/logger');
const { ASSET_STATUS, INTERVIEW_STATUS } = require('../constants');

let job = null;

const start = () => {
  // Run every 1 minute
  job = cron.schedule('* * * * *', async () => {
    logger.info('[InterviewCompletedScanJob] Checking for completed interviews to process...');
    try {
      const now = new Date();
      
      // Find interviews with a Teams meeting that might need asset processing
      const candidatesToProcess = await prisma.interview.findMany({
        where: {
          deleted_at: null,
          teams_meeting_id: { not: null },
          status: { in: [INTERVIEW_STATUS.SCHEDULED, INTERVIEW_STATUS.IN_PROGRESS, INTERVIEW_STATUS.COMPLETED] },
        },
        include: {
          asset: true
        }
      });

      const endedInterviews = candidatesToProcess.filter(interview => {
        const startTime = new Date(interview.scheduled_time);
        const durationMs = (interview.duration_minutes || 60) * 60 * 1000;
        const endTime = new Date(startTime.getTime() + durationMs);
        
        // Add a 2-minute buffer after the scheduled end time
        const endWithBuffer = new Date(endTime.getTime() + 2 * 60 * 1000);
        
        // Process if the interview is explicitly marked COMPLETED OR if its scheduled time has passed
        const isEnded = interview.status === INTERVIEW_STATUS.COMPLETED || now >= endWithBuffer;
        
        const needsAssets = !interview.asset || 
                            interview.asset.recording_status !== ASSET_STATUS.UPLOADED ||
                            interview.asset.transcript_status !== ASSET_STATUS.UPLOADED;

        return isEnded && needsAssets;
      });

      logger.info(`[InterviewCompletedScanJob] Found ${endedInterviews.length} ended interview(s) needing asset processing.`);

      for (const interview of endedInterviews) {
        const interviewId = interview.id;
        const candidateId = interview.candidate_id;
        const meetingId = interview.teams_meeting_id;
        const organizerUserId = interview.organizer_object_id || interview.organizer_email;

        logger.info(`[InterviewCompletedScanJob] Triggering asset processing for interview ${interviewId} (Meeting: ${meetingId})`);

        // Mark interview status as COMPLETED
        await prisma.interview.update({
          where: { id: interviewId },
          data: { status: INTERVIEW_STATUS.COMPLETED }
        });

        const mapping = {
          interviewId: interviewId,
          candidateId: candidateId,
          meetingId: meetingId,
          organizerUserId: organizerUserId
        };

        // Trigger processing (idempotent & handles internal p-retry)
        processingService.processArtifacts('auto-scan', mapping, organizerUserId)
          .then(() => logger.info(`[InterviewCompletedScanJob] Successfully processed artifacts for interview ${interviewId}`))
          .catch(err => logger.error(`[InterviewCompletedScanJob] Failed to process artifacts for interview ${interviewId}: ${err.message}`));
      }
    } catch (err) {
      logger.error(`[InterviewCompletedScanJob] Cron error: ${err.message}`);
    }
  });

  logger.info('[InterviewCompletedScanJob] Interview completed scan cron started (every 1 min)');
  return job;
};

const stop = () => {
  if (job) {
    job.stop();
    logger.info('[InterviewCompletedScanJob] Cron stopped.');
  }
};

module.exports = { start, stop };
