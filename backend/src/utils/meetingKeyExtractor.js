/**
 * src/utils/meetingKeyExtractor.js
 *
 * Extracts a stable, canonical key from a Microsoft Teams meeting URL.
 *
 * Problem:
 *   Microsoft Graph callRecord webhooks and the Teams scheduling API both
 *   return joinWebUrl values, but they can differ in query parameters,
 *   encoding, and trailing slashes. A direct string comparison fails.
 *
 * Solution:
 *   Extract the invariant meeting thread identifier embedded in every Teams URL:
 *     Pattern: "19:meeting_{uuid}@thread.v2"
 *
 * Examples that all produce the same key:
 *   https://teams.microsoft.com/l/meetup-join/19%3Ameeting_abc123%40thread.v2/0?context=...
 *   https://teams.microsoft.com/l/meetup-join/19:meeting_abc123@thread.v2/0
 *   https://teams.live.com/meet/19:meeting_abc123@thread.v2?p=xxx
 *
 * All produce: "19:meeting_abc123@thread.v2"
 *
 * This key is stored in Interview.normalized_meeting_key and used for
 * fast indexed lookups from Graph callRecord webhooks (no regex queries).
 */

const THREAD_PATTERN = /19[:%3A]{1,3}meeting_[a-zA-Z0-9_-]+[%40@]thread\.v2/i;

/**
 * Extracts the canonical meeting key from a Teams join URL.
 *
 * @param {string|null} joinUrl - The Teams meeting URL (encoded or decoded)
 * @returns {string|null} The canonical key (e.g., "19:meeting_abc@thread.v2") or null
 */
const extractMeetingKey = (joinUrl) => {
  if (!joinUrl || typeof joinUrl !== 'string') return null;

  // First decode URI encoding (%3A → :, %40 → @)
  let decoded;
  try {
    decoded = decodeURIComponent(joinUrl);
  } catch {
    decoded = joinUrl; // Fallback if already decoded or malformed
  }

  const match = decoded.match(THREAD_PATTERN);
  if (!match) return null;

  // Normalize: ensure proper characters (decode any remaining encoding)
  return match[0]
    .replace(/%3A/gi, ':')
    .replace(/%40/gi, '@')
    .toLowerCase();
};

/**
 * Validates that the extracted key has the expected format.
 * Use during ETL to flag malformed records.
 *
 * @param {string} key
 * @returns {boolean}
 */
const isValidMeetingKey = (key) => {
  if (!key) return false;
  return /^19:meeting_[a-z0-9_-]+@thread\.v2$/.test(key);
};

module.exports = { extractMeetingKey, isValidMeetingKey };
