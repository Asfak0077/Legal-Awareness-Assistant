/**
 * detector.js — Language Detection via Amazon Comprehend
 * ========================================================
 * Detects the dominant language of the user's complaint text.
 * Supports all 22 scheduled Indian languages.
 * Returns the ISO 639-1 language code (e.g., 'ta' for Tamil, 'hi' for Hindi).
 *
 * Troubleshooting:
 *   - Confidence threshold raised to 0.8 to reduce false positives
 *   - Raw Comprehend response is logged for debugging
 *   - If top language is below threshold, checks for an Indian-language
 *     runner-up before falling back to English
 *
 * AWS Service: Amazon Comprehend (DetectDominantLanguage API)
 * Runtime: Node.js 18.x (AWS SDK v3)
 */

'use strict';

const {
  ComprehendClient,
  DetectDominantLanguageCommand,
} = require('@aws-sdk/client-comprehend');

// ---------------------------------------------------------------------------
// Client — reused across warm Lambda invocations
// ---------------------------------------------------------------------------
const comprehend = new ComprehendClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});

const MIN_CONFIDENCE = 0.8; // raised from 0.7 → 0.8 for accuracy
const DEFAULT_LANGUAGE = 'en';

// Indian-language ISO 639-1 codes (22 scheduled languages + common variants)
const INDIAN_LANG_CODES = new Set([
  'hi', 'ta', 'te', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa', 'or',
  'as', 'ur', 'ne', 'si', 'sa', 'ks', 'sd', 'kok', 'mni', 'doi',
  'bho', 'mai',
]);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect the dominant language of the given text using Amazon Comprehend.
 *
 * @param {string} text - Raw complaint text in any supported language
 * @returns {Promise<{ languageCode: string, score: number }>}
 *   languageCode — ISO 639-1 code (e.g. "ta", "hi", "mr", "en")
 *   score        — Comprehend confidence score (0–1)
 * @throws {Error} If the Comprehend call fails (AWS details are NOT exposed)
 */
async function detectLanguage(text) {
  try {
    const command = new DetectDominantLanguageCommand({ Text: text });
    const response = await comprehend.send(command);

    const languages = response.Languages;

    // --- DEBUG: log raw Comprehend response for troubleshooting ---
    console.log('[detector] Raw Comprehend response:', JSON.stringify({
      inputLength: text.length,
      languagesReturned: languages ? languages.length : 0,
      languages: languages || [],
    }));

    // If Comprehend returned no results, fall back to English
    if (!languages || languages.length === 0) {
      console.warn('[detector] Comprehend returned empty languages array. Falling back to "en".');
      return { languageCode: DEFAULT_LANGUAGE, score: 0 };
    }

    // Languages are returned sorted by score descending — take the top result
    const top = languages[0];
    const languageCode = top.LanguageCode;
    const score = top.Score;

    console.log(`[detector] Top language: ${languageCode} (score: ${score.toFixed(4)}, threshold: ${MIN_CONFIDENCE})`);

    // If confidence meets threshold, return it
    if (score >= MIN_CONFIDENCE) {
      return { languageCode, score };
    }

    // --- Fallback: check if a known Indian language is the runner-up ---
    // Sometimes short or mixed text causes 'en' to rank first with low
    // confidence, while the actual Indian language is second.
    console.warn(`[detector] Top score ${score.toFixed(4)} < threshold ${MIN_CONFIDENCE}. Checking runner-up...`);

    for (let i = 0; i < languages.length; i++) {
      const lang = languages[i];
      if (INDIAN_LANG_CODES.has(lang.LanguageCode) && lang.Score >= MIN_CONFIDENCE * 0.75) {
        console.log(`[detector] Runner-up Indian language found: ${lang.LanguageCode} (score: ${lang.Score.toFixed(4)})`);
        return { languageCode: lang.LanguageCode, score: lang.Score };
      }
    }

    console.warn('[detector] No confident language detected. Falling back to "en".');
    return { languageCode: DEFAULT_LANGUAGE, score };
  } catch (err) {
    console.error('[detector] Comprehend error:', err);
    throw new Error('Language detection failed. Please try again later.');
  }
}

module.exports = { detectLanguage };
