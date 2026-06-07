/**
 * controllers/verificationController.js
 *
 * Phase 1 Integration Verification Controller
 *
 * Provides a set of diagnostic endpoints to validate the entire
 * Teams scheduling flow without running a full integration test.
 *
 * Routes (all mounted under /api/v1/verify):
 *   GET  /verify/graph-token     — Confirm MSAL token acquisition works
 *   GET  /verify/graph-connection — Full Graph API connectivity check
 *   POST /verify/teams-meeting   — Test Teams meeting creation (dry-run option)
 *   POST /verify/calendar-block  — Test calendar blocking for a single email
 *   GET  /verify/flow-status     — Complete pre-flight checklist status
 *   GET  /verify/interview/:id   — Deep inspect a specific interview record
 *
 * DEV ONLY — not exposed in production routes if NODE_ENV=production.
 */

'use strict';

const asyncHandler        = require('../utils/asyncHandler');
const { sendSuccess }     = require('../helpers/responseHelper');
const tokenManager        = require('../services/token/tokenManager');
const graphMeetingService = require('../services/msGraph/graphMeetingService');
const calendarBlockingService = require('../services/msGraph/calendarBlockingService');
const teamsGraphService   = require('../services/msGraph/teamsGraphService');
const { interviewRepository, candidateRepository } = require('../repositories');
const config              = require('../config/env');
const logger              = require('../config/logger');
const AppError            = require('../utils/AppError');
const { HTTP_STATUS }     = require('../constants');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const maskToken = (token) =>
  token ? `${token.substring(0, 8)}...${token.slice(-6)} (${token.length} chars)` : 'MISSING';

const boolCheck = (val, label) => ({
  label,
  status: val ? '✅ OK' : '❌ MISSING',
  value:  val  ? '(set)'  : '(not set)',
});

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/verify/graph-token
 *
 * Verifies that MSAL can acquire an access token from Azure AD.
 * This is the first thing to check when debugging Graph API failures.
 *
 * What it checks:
 *  - AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID are set
 *  - MSAL can reach login.microsoftonline.com
 *  - Client credentials flow succeeds
 *  - Returns token metadata (masked — not the full token)
 */
const verifyGraphToken = asyncHandler(async (req, res) => {
  const start = Date.now();
  logger.info('[Verify] Checking Graph token acquisition...');

  // Config pre-check
  const configChecks = {
    AZURE_CLIENT_ID:     !!config.msGraph.clientId,
    AZURE_CLIENT_SECRET: !!config.msGraph.clientSecret,
    AZURE_TENANT_ID:     !!config.msGraph.tenantId,
    AUTH_MODE:           config.msGraph.authMode,
    GRAPH_ORGANIZER_USER_ID: !!config.msGraph.organizerUserId,
    DEV_BYPASS_AUTH:     process.env.DEV_BYPASS_AUTH === 'true',
  };

  const missingVars = Object.entries(configChecks)
    .filter(([k, v]) => v === false)
    .map(([k]) => k);

  if (missingVars.length > 0) {
    logger.error(`[Verify] Missing config vars: ${missingVars.join(', ')}`);
    return res.status(400).json({
      success: false,
      step:    'config_check',
      message: `Missing required env vars: ${missingVars.join(', ')}`,
      configChecks,
      fix:     'Update backend/.env with real Azure credentials.',
    });
  }

  // Attempt token acquisition
  try {
    const token    = await tokenManager.getAccessToken(null);
    const duration = Date.now() - start;

    logger.info(`[Verify] ✅ Graph token acquired in ${duration}ms`);

    return sendSuccess(res, '✅ Graph token acquired successfully.', {
      tokenPreview:  maskToken(token),
      authMode:      config.msGraph.authMode,
      tenantId:      config.msGraph.tenantId,
      clientId:      config.msGraph.clientId,
      acquiredInMs:  duration,
      configChecks,
    });
  } catch (err) {
    logger.error(`[Verify] ❌ Token acquisition failed: ${err.message}`);
    return res.status(502).json({
      success:  false,
      step:     'token_acquisition',
      message:  err.message,
      fix:      getTokenErrorFix(err.message),
      configChecks,
    });
  }
});

/**
 * GET /api/v1/verify/graph-connection
 *
 * Acquires a token AND makes a live Graph API call to verify full connectivity.
 * In application mode: calls GET /organization
 */
const verifyGraphConnection = asyncHandler(async (req, res) => {
  logger.info('[Verify] Testing full Graph API connection...');

  const result = await graphMeetingService.verifyConnection(null);

  return sendSuccess(res, '✅ Graph API connection verified.', {
    ...result,
    hint: 'Token acquisition + Graph API call both succeeded. You are ready to create Teams meetings.',
  });
});

/**
 * POST /api/v1/verify/teams-meeting
 *
 * Creates a real (or dry-run) Teams meeting to verify the Graph meetings API.
 *
 * Body:
 *   {
 *     dry_run?:          boolean  — if true, skip actual API call, return mock
 *     organizer_user_id?: string  — AAD object ID of organizer (application mode)
 *     subject?:          string   — custom subject line
 *   }
 */
const verifyTeamsMeeting = asyncHandler(async (req, res) => {
  const {
    dry_run = false,
    organizer_user_id = config.msGraph.organizerUserId,
    subject = `[VERIFY TEST] Teams Meeting — ${new Date().toISOString()}`,
  } = req.body;

  if (dry_run) {
    logger.info('[Verify] Teams meeting dry-run requested — skipping Graph call.');
    return sendSuccess(res, '✅ Dry-run: Teams meeting payload validated (no API call made).', {
      dry_run: true,
      would_call: `POST /users/${organizer_user_id || 'me'}/onlineMeetings`,
      payload: {
        subject,
        startDateTime: new Date().toISOString(),
        endDateTime:   new Date(Date.now() + 3600000).toISOString(),
      },
      warning: organizer_user_id ? null : '⚠️ GRAPH_ORGANIZER_USER_ID not set — will fail in application mode.',
    });
  }

  if (!organizer_user_id && config.msGraph.authMode === 'application') {
    return res.status(400).json({
      success: false,
      message: 'organizer_user_id is required in application mode.',
      fix:     'Pass organizer_user_id in body, or set GRAPH_ORGANIZER_USER_ID in .env',
    });
  }

  const start = Date.now();
  logger.info(`[Verify] Creating test Teams meeting | organizer: ${organizer_user_id || 'delegated /me'}`);

  const now   = new Date();
  const end   = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour test meeting

  const meeting = await teamsGraphService.createMeeting(
    {
      subject,
      startDateTime: now.toISOString(),
      endDateTime:   end.toISOString(),
      attendees:     [],
    },
    organizer_user_id,
    null
  );

  logger.info(`[Verify] ✅ Test meeting created | id: ${meeting.id} | joinUrl: ${meeting.joinUrl ? 'present' : 'MISSING'}`);

  return sendSuccess(res, '✅ Test Teams meeting created successfully!', {
    meetingId:    meeting.id,
    joinUrl:      meeting.joinUrl || meeting.joinWebUrl,
    subject:      meeting.subject,
    startDateTime: meeting.startDateTime,
    endDateTime:   meeting.endDateTime,
    createdInMs:  Date.now() - start,
    note:         'This is a test meeting. Delete it from Teams if needed.',
  });
});

/**
 * POST /api/v1/verify/calendar-block
 *
 * Tests Outlook calendar event creation for a single panelist email.
 *
 * Body:
 *   {
 *     panelist_email: string   — the email to test blocking
 *     dry_run?:       boolean
 *   }
 */
const verifyCalendarBlock = asyncHandler(async (req, res) => {
  const { panelist_email, dry_run = false } = req.body;

  if (!panelist_email) {
    return res.status(400).json({
      success: false,
      message: 'panelist_email is required.',
    });
  }

  if (dry_run) {
    return sendSuccess(res, '✅ Dry-run: calendar block payload validated.', {
      dry_run:    true,
      would_call: `POST /users/${panelist_email}/calendar/events`,
      note:       'Requires Calendars.ReadWrite (Application) permission with admin consent.',
    });
  }

  logger.info(`[Verify] Testing calendar block for: ${panelist_email}`);

  const now     = new Date();
  const end     = new Date(now.getTime() + 30 * 60 * 1000); // 30 min test block
  const results = await calendarBlockingService.blockPanelistCalendars(
    [panelist_email],
    {
      subject:        '[VERIFY TEST] Calendar Block Test',
      startDateTime:  now.toISOString(),
      endDateTime:    end.toISOString(),
      joinUrl:        'https://teams.microsoft.com/verify-test',
      organizerEmail: 'verify-test@system.local',
    },
    null
  );

  const result = results[0];
  const status = result?.success ? 200 : 502;

  return res.status(status).json({
    success:       result?.success || false,
    message:       result?.success
      ? `✅ Calendar blocked for ${panelist_email}`
      : `❌ Calendar block failed for ${panelist_email}`,
    result,
    required_permission: 'Calendars.ReadWrite (Application, admin consented)',
  });
});

/**
 * GET /api/v1/verify/flow-status
 *
 * Pre-flight checklist: checks all configuration and connectivity
 * required for the full Phase 1 flow to work.
 */
const verifyFlowStatus = asyncHandler(async (req, res) => {
  logger.info('[Verify] Running Phase 1 pre-flight checklist...');

  const checks = {
    environment: {
      NODE_ENV:            process.env.NODE_ENV || 'development',
      DEV_BYPASS_AUTH:     boolCheck(process.env.DEV_BYPASS_AUTH === 'true', 'Dev auth bypass'),
      AUTH_MODE:           { label: 'Auth mode', value: config.msGraph.authMode, status: '✅ OK' },
    },
    azure_credentials: {
      AZURE_TENANT_ID:          boolCheck(!!config.msGraph.tenantId,     'Azure Tenant ID'),
      AZURE_CLIENT_ID:          boolCheck(!!config.msGraph.clientId,     'Azure Client ID'),
      AZURE_CLIENT_SECRET:      boolCheck(!!config.msGraph.clientSecret, 'Azure Client Secret'),
      GRAPH_ORGANIZER_USER_ID:  boolCheck(!!config.msGraph.organizerUserId, 'Organizer AAD Object ID'),
    },
    database: null,
    graph_token: null,
  };

  // DB check
  try {
    const { prisma } = require('../config/prisma');
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: '✅ OK', message: 'PostgreSQL (RDS) connected' };
  } catch (err) {
    checks.database = { status: '❌ FAIL', message: `DB connection failed: ${err.message}` };
  }

  // Token check (only if credentials are all set)
  const credsMissing = !config.msGraph.tenantId || !config.msGraph.clientId || !config.msGraph.clientSecret;
  if (credsMissing) {
    checks.graph_token = { status: '⏭️ SKIPPED', message: 'Azure credentials missing — fix those first.' };
  } else {
    try {
      await tokenManager.getAccessToken(null);
      checks.graph_token = { status: '✅ OK', message: 'MSAL token acquired successfully.' };
    } catch (err) {
      checks.graph_token = {
        status:  '❌ FAIL',
        message: err.message,
        fix:     getTokenErrorFix(err.message),
      };
    }
  }

  // Overall readiness
  const allOk = checks.database?.status === '✅ OK'
    && checks.graph_token?.status === '✅ OK'
    && !!config.msGraph.tenantId
    && !!config.msGraph.clientId
    && !!config.msGraph.clientSecret;

  const organizerWarning = !config.msGraph.organizerUserId && config.msGraph.authMode === 'application'
    ? '⚠️  GRAPH_ORGANIZER_USER_ID is not set. Teams meeting creation will fail in application mode unless organizer_user_id is supplied per-request.'
    : null;

  return sendSuccess(res, allOk ? '✅ All Phase 1 checks passed.' : '⚠️ Some checks failed — see details.', {
    ready: allOk,
    checks,
    warning: organizerWarning,
    nextStep: allOk
      ? 'Run the full flow: Create Candidate → Create Interview → POST /api/v1/teams/schedule'
      : 'Fix the failing checks above, then re-run this endpoint.',
    endpoints: {
      token_test:       'GET /api/v1/verify/graph-token',
      connection_test:  'GET /api/v1/verify/graph-connection',
      meeting_test:     'POST /api/v1/verify/teams-meeting',
      calendar_test:    'POST /api/v1/verify/calendar-block',
    },
  });
});

/**
 * GET /api/v1/verify/interview/:id
 *
 * Deep-inspects an interview record: DB data + Graph meeting status.
 * Useful for debugging after a schedule attempt.
 */
const verifyInterview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  logger.info(`[Verify] Deep-inspecting interview: ${id}`);

  const interview = await interviewRepository.findById(id);
  if (!interview) {
    return res.status(404).json({ success: false, message: `Interview ${id} not found in DB.` });
  }

  const candidate = await candidateRepository.findById(
    interview.candidate_id?._id || interview.candidate_id
  );

  let graphMeeting = null;
  let graphError   = null;

  if (interview.teams_meeting_id) {
    try {
      graphMeeting = await teamsGraphService.getMeeting(
        interview.teams_meeting_id,
        config.msGraph.organizerUserId,
        null
      );
    } catch (err) {
      graphError = { message: err.message, hint: 'Meeting may have been deleted from Teams side.' };
    }
  }

  return sendSuccess(res, 'Interview inspection complete.', {
    db: {
      id:               interview.id || interview._id,
      status:           interview.status,
      scheduled_time:   interview.scheduled_time,
      duration_minutes: interview.duration_minutes,
      organizer_email:  interview.organizer_email,
      interviewer_email: interview.interviewer_email,
      teams_meeting_id: interview.teams_meeting_id  || '(not set)',
      meeting_join_url: interview.meeting_join_url  || '(not set)',
      candidate_id:     interview.candidate_id?._id || interview.candidate_id,
    },
    candidate: candidate ? {
      id:    candidate.id || candidate._id,
      name:  candidate.name,
      email: candidate.email,
    } : null,
    graph: {
      meeting:      graphMeeting,
      error:        graphError,
      join_url_ok:  !!graphMeeting?.joinUrl || !!graphMeeting?.joinWebUrl,
    },
    diagnosis: {
      has_teams_meeting: !!interview.teams_meeting_id,
      graph_accessible:  !!graphMeeting && !graphError,
      ready_to_join:     !!(interview.meeting_join_url),
    },
  });
});

// ─── Error Fix Helper ─────────────────────────────────────────────────────────

const getTokenErrorFix = (message = '') => {
  if (message.includes('AADSTS700016')) return 'AZURE_CLIENT_ID is incorrect. Verify App Registration in Azure Portal.';
  if (message.includes('AADSTS7000215')) return 'AZURE_CLIENT_SECRET is incorrect or expired. Generate a new secret in Azure Portal.';
  if (message.includes('AADSTS90002')) return 'AZURE_TENANT_ID is incorrect. Copy it from Azure Portal → Entra ID → Overview.';
  if (message.includes('AADSTS65001')) return 'Admin consent not granted. Go to Azure Portal → App Registration → API Permissions → Grant admin consent.';
  if (message.includes('ENOTFOUND') || message.includes('network')) return 'Network error — check internet connectivity and firewall rules.';
  return 'Check Azure Portal credentials and try again.';
};

module.exports = {
  verifyGraphToken,
  verifyGraphConnection,
  verifyTeamsMeeting,
  verifyCalendarBlock,
  verifyFlowStatus,
  verifyInterview,
};
