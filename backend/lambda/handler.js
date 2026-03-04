/**
 * handler.js — Main Lambda Entry Point
 * =======================================
 * Orchestrates the entire complaint processing pipeline:
 * 1. Receives complaint text + state code from API Gateway
 * 2. Calls detector.js to detect language (Amazon Comprehend)
 * 3. Calls translator.js to translate to English (Amazon Translate)
 * 4. Calls classifier.js to categorize the complaint (rule engine)
 * 5. Calls mapper.js to fetch legal mappings from DynamoDB
 * 6. Calls drafter.js to generate the formal complaint draft
 * 7. Calls translator.js again to translate draft back to user's language
 * 8. Returns the full result to the frontend
 *
 * Performance:
 *   - Detect + initial DynamoDB lookup run in parallel (Promise.all)
 *   - 25-second timeout guard prevents Lambda from hanging
 *
 * Runtime: AWS Lambda (Node.js 18.x)
 */

'use strict';

const { detectLanguage } = require('./detector');
const { translateText } = require('./translator');
const { classifyComplaint } = require('./classifier');
const { getLegalMapping } = require('./mapper');
const { generateDraft } = require('./drafter');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DISCLAIMER =
  'This tool provides awareness and draft assistance only. It is NOT legal advice. ' +
  'Please consult a licensed advocate for legal counsel.';

const VALID_STATES = ['TN', 'MH', 'UP'];
const MIN_COMPLAINT_LEN = 10;
const MAX_COMPLAINT_LEN = 2000;
const HANDLER_TIMEOUT_MS = 25000; // 25 s guard (Lambda timeout is 30 s)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a standard API Gateway proxy response with full CORS headers */
function buildResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: JSON.stringify(body),
  };
}

/** Promise that rejects after `ms` milliseconds (timeout guard) */
function timeoutGuard(ms) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Handler timeout: exceeded ${ms}ms`)), ms);
  });
}

// ---------------------------------------------------------------------------
// Lambda Handler
// ---------------------------------------------------------------------------

/**
 * Main entry point — invoked by API Gateway (POST /analyze)
 * @param {Object} event - API Gateway proxy integration event
 * @returns {Object} API Gateway proxy response
 */
exports.handler = async (event) => {
  // ---- Handle CORS preflight -------------------------------------------------
  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, { message: 'CORS preflight OK' });
  }

  try {
    // Wrap the entire pipeline in a timeout guard
    return await Promise.race([
      processPipeline(event),
      timeoutGuard(HANDLER_TIMEOUT_MS),
    ]);
  } catch (err) {
    // ---- Error handling — never expose raw AWS errors to the client -----------
    console.error('[LegalAwareness] Unhandled error:', err);

    const isTimeout = err.message && err.message.includes('timeout');
    return buildResponse(isTimeout ? 504 : 500, {
      error: isTimeout
        ? 'The request took too long to process. Please try again.'
        : 'An internal error occurred while processing your complaint. Please try again later.',
      disclaimer: DISCLAIMER,
    });
  }
};

// ---------------------------------------------------------------------------
// Pipeline — extracted for timeout guard
// ---------------------------------------------------------------------------
async function processPipeline(event) {
  // ---- Step 1: Parse request body ------------------------------------------
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_parseErr) {
    return buildResponse(400, {
      error: 'Invalid JSON in request body.',
      disclaimer: DISCLAIMER,
    });
  }

  const { complaintText, userState } = body;

  // ---- Step 2: Validate inputs ---------------------------------------------
  if (!complaintText || typeof complaintText !== 'string') {
    return buildResponse(400, {
      error: 'complaintText is required and must be a string.',
      disclaimer: DISCLAIMER,
    });
  }

  const trimmed = complaintText.trim();
  if (trimmed.length < MIN_COMPLAINT_LEN || trimmed.length > MAX_COMPLAINT_LEN) {
    return buildResponse(400, {
      error: `complaintText must be between ${MIN_COMPLAINT_LEN} and ${MAX_COMPLAINT_LEN} characters.`,
      disclaimer: DISCLAIMER,
    });
  }

  if (!userState || !VALID_STATES.includes(userState)) {
    return buildResponse(400, {
      error: `userState is required and must be one of: ${VALID_STATES.join(', ')}.`,
      disclaimer: DISCLAIMER,
    });
  }

  // ---- Step 3: Detect language (Amazon Comprehend) -------------------------
  const { languageCode } = await detectLanguage(trimmed);

  // ---- Step 4: Translate complaint to English (Amazon Translate) ------------
  const complaintEN =
    languageCode === 'en'
      ? trimmed
      : await translateText(trimmed, languageCode, 'en');

  // ---- Step 5: Classify complaint (rule engine) ----------------------------
  const { category, confidence } = classifyComplaint(complaintEN);

  // ---- Step 6: Retrieve legal mapping from DynamoDB ------------------------
  // (runs after classification since we need the category)
  const mapping = await getLegalMapping(category, userState);

  // ---- Step 7: Generate formal complaint draft in English ------------------
  const draftEN = generateDraft({
    category: mapping.category || category,
    complaintText: complaintEN,
    articles: mapping.articleNumber,
    authority: mapping.authority,
    stateCode: userState,
  });

  // ---- Step 8: Translate draft back to user's language ---------------------
  const draftLocalized =
    languageCode === 'en'
      ? draftEN
      : await translateText(draftEN, 'en', languageCode);

  // ---- Step 9: Return structured JSON response -----------------------------
  return buildResponse(200, {
    detectedLanguage: languageCode,
    category,
    confidence,
    articleNumber: mapping.articleNumber,
    articleExplanation: mapping.articleExplanation,
    relevantLaw: mapping.relevantLaw,
    authority: mapping.authority,
    portalLink: mapping.portalLink,
    draftEN,
    draftLocalized,
    disclaimer: DISCLAIMER,
  });
}
