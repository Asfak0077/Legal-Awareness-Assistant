/**
 * translator.js — Translation via Amazon Translate
 * ===================================================
 * Handles two translation tasks:
 * 1. Translating the user's complaint from their language → English
 * 2. Translating the generated draft from English → user's language
 *
 * Quality improvements:
 *   - Custom terminology for Indian legal terms (FIR, PIL, complainant, etc.)
 *   - TerminologyNames parameter passed to TranslateText when available
 *
 * AWS Service: Amazon Translate (TranslateText API)
 * Runtime: Node.js 18.x (AWS SDK v3)
 */

'use strict';

const {
  TranslateClient,
  TranslateTextCommand,
} = require('@aws-sdk/client-translate');

// ---------------------------------------------------------------------------
// Client — reused across warm Lambda invocations
// ---------------------------------------------------------------------------
const translate = new TranslateClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});

// ---------------------------------------------------------------------------
// Custom terminology for legal terms
// ---------------------------------------------------------------------------
// If you have uploaded a custom terminology file to Amazon Translate,
// set the env var LEGAL_TERMINOLOGY_NAME to its name.
// e.g. LEGAL_TERMINOLOGY_NAME=legal-terms-india
//
// The terminology CSV should contain legal terms that should NOT be
// translated or should be translated in a specific way:
//   en,hi
//   FIR,FIR
//   PIL,PIL
//   complainant,शिकायतकर्ता
//   grievance,शिकायत
//   redressal,निवारण
//   magistrate,मजिस्ट्रेट
//   affidavit,शपथ पत्र
//
// Upload with:
//   aws translate import-terminology \
//     --name legal-terms-india \
//     --merge-strategy OVERWRITE \
//     --terminology-data Format=CSV,file://legal-terminology.csv
// ---------------------------------------------------------------------------
const TERMINOLOGY_NAME = process.env.LEGAL_TERMINOLOGY_NAME || null;

// Legal terms that must be preserved as-is across translations
// (used as pre/post processing when custom terminology is not available)
const PRESERVE_TERMS = [
  'FIR', 'PIL', 'NCW', 'NCR', 'IPC', 'CrPC', 'BNS', 'BNSS',
  'IT Act', 'RTI', 'DGP', 'SP', 'DSP', 'SHO', 'IO',
];

// Regex to find preserved terms in text
const PRESERVE_REGEX = new RegExp(
  '\\b(' + PRESERVE_TERMS.map(t => t.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')).join('|') + ')\\b',
  'g'
);

// ---------------------------------------------------------------------------
// Core helper
// ---------------------------------------------------------------------------

/**
 * Translate text between any two languages via Amazon Translate.
 * Uses custom terminology when available for better legal term handling.
 *
 * @param {string} text               - Text to translate
 * @param {string} sourceLanguageCode - ISO 639-1 source language code (e.g. 'ta', 'hi')
 * @param {string} targetLanguageCode - ISO 639-1 target language code (e.g. 'en')
 * @returns {Promise<string>} Translated text
 * @throws {Error} If the Translate call fails (AWS details are NOT exposed)
 */
async function translateText(text, sourceLanguageCode, targetLanguageCode) {
  // No-op when source and target are the same
  if (sourceLanguageCode === targetLanguageCode) {
    return text;
  }

  try {
    // Build the command params
    const params = {
      Text: text,
      SourceLanguageCode: sourceLanguageCode,
      TargetLanguageCode: targetLanguageCode,
    };

    // Attach custom terminology if configured
    if (TERMINOLOGY_NAME) {
      params.TerminologyNames = [TERMINOLOGY_NAME];
    }

    const command = new TranslateTextCommand(params);
    const response = await translate.send(command);

    let translated = response.TranslatedText;

    // Post-processing: restore legal acronyms that may have been garbled
    // Only applies when translating TO English (acronyms are English)
    if (targetLanguageCode === 'en') {
      translated = restoreLegalTerms(text, translated);
    }

    return translated;
  } catch (err) {
    console.error(
      `[translator] Translate error (${sourceLanguageCode} → ${targetLanguageCode}):`,
      err,
    );
    throw new Error('Translation failed. Please try again later.');
  }
}

/**
 * Post-process: if the original text contained legal acronyms in English
 * (common in Indian multilingual text, e.g. "FIR दर्ज करें"), ensure
 * they survive in the translated output.
 */
function restoreLegalTerms(originalText, translatedText) {
  const found = originalText.match(PRESERVE_REGEX);
  if (!found) return translatedText;

  let result = translatedText;
  for (const term of found) {
    // If the term is missing from translated text, it was likely garbled
    if (!result.includes(term)) {
      // Try to find a garbled version (lowercase or partial) and replace
      const lowerRe = new RegExp(term.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'i');
      if (lowerRe.test(result)) {
        result = result.replace(lowerRe, term);
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Convenience wrappers
// ---------------------------------------------------------------------------

/**
 * Translate text from any supported language to English.
 *
 * @param {string} text               - Text in the source language
 * @param {string} sourceLanguageCode - ISO 639-1 code of the source language
 * @returns {Promise<string>} English translation
 */
async function translateToEnglish(text, sourceLanguageCode) {
  if (sourceLanguageCode === 'en') return text;
  return translateText(text, sourceLanguageCode, 'en');
}

/**
 * Translate English text to the specified target language.
 *
 * @param {string} text               - English text to translate
 * @param {string} targetLanguageCode - ISO 639-1 code of the target language
 * @returns {Promise<string>} Translated text in the target language
 */
async function translateFromEnglish(text, targetLanguageCode) {
  if (targetLanguageCode === 'en') return text;
  return translateText(text, 'en', targetLanguageCode);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = { translateText, translateToEnglish, translateFromEnglish };
