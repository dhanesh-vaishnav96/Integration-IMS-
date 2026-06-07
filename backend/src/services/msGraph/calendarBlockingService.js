/**
 * services/msGraph/calendarBlockingService.js
 *
 * Creates Outlook Calendar events on selected panelists' calendars
 * after a Teams meeting is created for an interview.
 *
 * Design Decisions:
 * ─────────────────────────────────────────────────────────────────
 * 1. APPLICATION MODE ONLY (Phase 1):
 *    Uses POST /users/{panelistEmail}/calendar/events which requires
 *    the Calendars.ReadWrite (Application) permission with admin consent.
 *    No delegated user session is needed.
 *
 * 2. FAILURE ISOLATION — Per-Panelist:
 *    Each panelist's event creation runs independently via Promise.allSettled().
 *    One failing panelist (e.g., external email, missing permission) does NOT
 *    abort the others or fail the Teams meeting creation.
 *
 * 3. DUPLICATE PREVENTION:
 *    Callers are responsible for ensuring this is only invoked once per interview.
 *    teamsSchedulingService already guards via: if (interview.teams_meeting_id) → 409.
 *
 * 4. EXTERNAL TENANT HANDLING:
 *    External/guest user emails return 400/403/404 from Graph.
 *    These are caught per-panelist with a descriptive hint logged at WARN level.
 *
 * Required Azure App Permissions (Application type, admin consent):
 *   • Calendars.ReadWrite — create/delete events on any user's calendar
 *
 * Graph Endpoint Used:
 *   POST /users/{panelistEmail}/calendar/events
 *   DELETE /users/{panelistEmail}/calendar/events/{eventId}
 */

'use strict';

const { getGraphClient } = require('./graphClientFactory');
const logger = require('../../config/logger');

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Build the Outlook calendar event payload.
 * Sets showAs=busy to block the panelist's time slot.
 *
 * @param {Object} p
 * @param {string} p.subject        - Meeting subject (e.g. "Interview: Jane — SDE")
 * @param {string} p.startDateTime  - ISO 8601 UTC start time
 * @param {string} p.endDateTime    - ISO 8601 UTC end time
 * @param {string} p.joinUrl        - Teams meeting join URL
 * @param {string} p.organizerEmail - Organizer email for display in body
 * @returns {Object} Graph calendar event body
 */
const buildEventPayload = ({ subject, startDateTime, endDateTime, joinUrl, organizerEmail }) => ({
  subject,
  start: {
    dateTime: startDateTime,
    timeZone: 'UTC',
  },
  end: {
    dateTime: endDateTime,
    timeZone: 'UTC',
  },
  location: {
    displayName: 'Microsoft Teams',
  },
  body: {
    contentType: 'HTML',
    content: `
      <p>You have been selected as a <strong>panelist</strong> for this interview session.</p>
      <p><strong>Join Microsoft Teams Meeting:</strong><br/>
        <a href="${joinUrl}">${joinUrl}</a>
      </p>
      <p>Organized by: ${organizerEmail || 'HR Team'}</p>
      <p style="color:#888;font-size:12px;">
        This event was automatically created by the Interview Management System.
      </p>
    `,
  },
  // Mark time as busy — this is the core "calendar blocking" behaviour
  showAs: 'busy',
  // Do NOT set isOnlineMeeting=true here — this would try to create a NEW Teams meeting.
  // We link to the existing meeting via joinUrl in the body instead.
  isOnlineMeeting: false,
  reminderMinutesBeforeStart: 15,
});

/**
 * Map Graph API status codes to human-readable hints for the log.
 */
const getStatusHint = (statusCode) => {
  switch (statusCode) {
    case 400: return 'Invalid request — user may be an external/guest account not supported for direct calendar write.';
    case 401: return 'Unauthorized — application token may be expired or invalid.';
    case 403: return 'Missing Calendars.ReadWrite (Application) permission, or admin consent not granted.';
    case 404: return 'User not found in tenant — verify the panelist email/UPN is correct.';
    case 429: return 'Graph API rate-limited — consider adding retry logic for high-volume scenarios.';
    default:  return '';
  }
};

// ─── Service ──────────────────────────────────────────────────────────────────

const calendarBlockingService = {

  /**
   * blockPanelistCalendars()
   *
   * Creates an Outlook calendar event on each panelist's calendar.
   * Runs all panelists concurrently. Per-panelist failures are logged
   * and isolated — they do NOT propagate to the caller.
   *
   * @param {string[]} panelistEmails  - UPNs / email addresses of panelists to block
   * @param {Object}   meetingDetails  - { subject, startDateTime, endDateTime, joinUrl, organizerEmail }
   * @param {string|null} userCacheKey - Delegated session key (null = application mode)
   * @returns {Promise<Array>} Results: [{ email, success, eventId? } | { email, success, error }]
   */
  async blockPanelistCalendars(panelistEmails, meetingDetails, userCacheKey = null) {
    if (!Array.isArray(panelistEmails) || panelistEmails.length === 0) {
      logger.info('[CalendarBlocking] No panelists specified — skipping calendar blocking step.');
      return [];
    }

    // Deduplicate in case caller sends duplicates
    const uniqueEmails = [...new Set(panelistEmails.map((e) => e.trim().toLowerCase()))];

    logger.info(
      `[CalendarBlocking] Blocking calendars for ${uniqueEmails.length} panelist(s): [${uniqueEmails.join(', ')}]`
    );

    const client    = getGraphClient(userCacheKey);
    const payload   = buildEventPayload(meetingDetails);

    // Run all panelists concurrently; failures are isolated per panelist
    const settled = await Promise.allSettled(
      uniqueEmails.map((email) => this._createEventForPanelist(client, email, payload))
    );

    // Build structured result report
    const report = settled.map((result, idx) => {
      const email = uniqueEmails[idx];
      if (result.status === 'fulfilled') {
        const eventId = result.value?.id;
        logger.info(
          `[CalendarBlocking] ✅ Blocked | panelist: ${email} | eventId: ${eventId}`
        );
        return { email, success: true, eventId };
      } else {
        const errMsg = result.reason?.message || String(result.reason);
        logger.warn(
          `[CalendarBlocking] ⚠️ Failed | panelist: ${email} | reason: ${errMsg}`
        );
        return { email, success: false, error: errMsg };
      }
    });

    const ok   = report.filter((r) => r.success).length;
    const fail = report.filter((r) => !r.success).length;
    logger.info(
      `[CalendarBlocking] Summary — ✅ ${ok} succeeded, ❌ ${fail} failed out of ${uniqueEmails.length} panelist(s).`
    );

    return report;
  },

  /**
   * _createEventForPanelist()
   *
   * Internal: posts a calendar event to a single panelist's calendar.
   * Throws a descriptive Error on failure (caught by Promise.allSettled above).
   *
   * @param {Object} client       - Authenticated Graph SDK client
   * @param {string} panelistEmail
   * @param {Object} payload      - Pre-built event body
   * @returns {Object} Created Graph event ({ id, subject, ... })
   */
  async _createEventForPanelist(client, panelistEmail, payload) {
    logger.debug(`[CalendarBlocking] → Creating event for panelist: ${panelistEmail}`);

    try {
      const event = await client
        .api(`/users/${panelistEmail}/calendar/events`)
        .post(payload);

      return event;
    } catch (err) {
      const statusCode  = err.statusCode || err.status || 0;
      const graphCode   = err.body?.error?.code   || err.code    || 'UNKNOWN';
      const graphMsg    = err.body?.error?.message || err.message || 'Unknown Graph error';
      const hint        = getStatusHint(statusCode);

      // Build a rich error message for the log and the results report
      const detail = `[HTTP ${statusCode}] Graph code: ${graphCode} — ${graphMsg}${hint ? ` | Hint: ${hint}` : ''}`;
      logger.warn(`[CalendarBlocking] Graph error for ${panelistEmail}: ${detail}`);

      // Re-throw so Promise.allSettled captures it as 'rejected'
      throw new Error(detail);
    }
  },

  /**
   * removeCalendarEvent()
   *
   * Deletes a previously-created panelist calendar event (e.g. on interview cancellation).
   * Best-effort: a failure here is logged at WARN but does NOT throw.
   *
   * @param {string}      panelistEmail
   * @param {string}      eventId        - Graph event ID stored after blockPanelistCalendars()
   * @param {string|null} userCacheKey
   */
  async removeCalendarEvent(panelistEmail, eventId, userCacheKey = null) {
    if (!eventId) {
      logger.debug(
        `[CalendarBlocking] removeCalendarEvent: no eventId for ${panelistEmail} — skipping.`
      );
      return;
    }

    logger.info(
      `[CalendarBlocking] Removing calendar event | panelist: ${panelistEmail} | eventId: ${eventId}`
    );

    try {
      const client = getGraphClient(userCacheKey);
      await client.api(`/users/${panelistEmail}/calendar/events/${eventId}`).delete();
      logger.info(`[CalendarBlocking] ✅ Event removed for ${panelistEmail}`);
    } catch (err) {
      const statusCode = err.statusCode || err.status || 0;
      if (statusCode === 404) {
        logger.warn(
          `[CalendarBlocking] Event ${eventId} already gone for ${panelistEmail} (404) — treating as success.`
        );
      } else {
        logger.warn(
          `[CalendarBlocking] ⚠️ Could not remove event ${eventId} for ${panelistEmail}: ${err.message}`
        );
      }
    }
  },
};

module.exports = calendarBlockingService;
