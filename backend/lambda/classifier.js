/**
 * classifier.js — Rule-Based Complaint Classifier
 * ==================================================
 * Classifies an English-translated complaint into one of 6 categories
 * using keyword matching in priority order (NO AI/LLM used).
 *
 * Categories (checked in this order):
 *   1. OnlineFinancialFraud
 *   2. CybercrimeNonFinancial
 *   3. DomesticViolence
 *   4. ConsumerComplaint
 *   5. EmploymentLabourDispute
 *   6. PropertyDispute
 *
 * Matching strategy (in order):
 *   1. Exact multi-word keyword match
 *   2. Hindi / Tamil transliteration stems
 *   3. Partial matching for compound words (word-boundary aware)
 *
 * Approach: Priority-ordered keyword scan — first match wins.
 * Runtime: Node.js 18.x (pure logic, no AWS services)
 */

'use strict';

// ---------------------------------------------------------------------------
// Keyword dictionaries — checked in strict priority order
// Each category has: exact keywords, transliteration stems, and partial stems
// ---------------------------------------------------------------------------
const CATEGORY_KEYWORDS = [
  {
    category: 'OnlineFinancialFraud',
    keywords: [
      'upi fraud',
      'bank fraud',
      'phishing',
      'otp scam',
      'credit card fraud',
      'online payment',
      'money stolen',
      'debit card',
      'netbanking',
      'wallet fraud',
    ],
    // Hindi/Tamil transliterations that may survive Amazon Translate
    transliterations: [
      'dhokha', 'thagee', 'thagi', 'paisa chori', 'bank se chori',
      'fraud', 'scam', 'otp', 'thiruttu', 'matripu', 'vaangi',
    ],
    // Partial stems for compound words (matched with word boundaries)
    partials: ['fraud', 'scam', 'phish', 'stolen', 'cheat'],
  },
  {
    category: 'CybercrimeNonFinancial',
    keywords: [
      'hacking',
      'account hacked',
      'fake profile',
      'cyberbullying',
      'stalking online',
      'morphed photo',
      'sextortion',
      'blackmail online',
      'data stolen',
      'identity theft',
    ],
    transliterations: [
      'hack', 'hacking', 'blackmail', 'dhamki', 'stalking',
      'nakli profile', 'photo morphing', 'tholil', 'mirattal',
    ],
    partials: ['hack', 'stalk', 'morphe', 'bully', 'blackmail', 'threat'],
  },
  {
    category: 'DomesticViolence',
    keywords: [
      'husband',
      'wife',
      'spouse',
      'domestic abuse',
      'family violence',
      'dowry',
      'in-laws',
      'assault at home',
      'marital abuse',
      'physical abuse',
    ],
    transliterations: [
      'pati', 'patni', 'dahej', 'sasural', 'maar peet',
      'maarpeet', 'ghar mein hinsa', 'kanavan', 'manaivi',
      'varadhatchanai', 'kudumba vanmurai', 'kodungol',
    ],
    partials: ['violen', 'abus', 'dowry', 'beat', 'assault', 'torture'],
  },
  {
    category: 'ConsumerComplaint',
    keywords: [
      'product',
      'service',
      'refund',
      'defective',
      'cheated',
      'overcharged',
      'e-commerce',
      'warranty',
      'seller',
      'delivery not received',
    ],
    transliterations: [
      'saman kharab', 'paisa vapas', 'refund nahi', 'warranty',
      'nakli saman', 'porutkal', 'thirauppi', 'kaalaavadhi',
    ],
    partials: ['refund', 'defect', 'warrant', 'deliver', 'overcharg'],
  },
  {
    category: 'EmploymentLabourDispute',
    keywords: [
      'salary not paid',
      'fired',
      'wrongful termination',
      'workplace harassment',
      'provident fund',
      'overtime',
      'labour',
      'employer',
      'wages',
      'layoff',
    ],
    transliterations: [
      'tankhah', 'vetan', 'naukri se nikala', 'kaam se nikala',
      'mazdoor', 'sambalam', 'velai', 'samba', 'ooziyam',
    ],
    partials: ['salary', 'wage', 'fired', 'terminat', 'employ', 'labour', 'labor'],
  },
  {
    category: 'PropertyDispute',
    keywords: [
      'land',
      'property',
      'encroachment',
      'rent',
      'eviction',
      'boundary dispute',
      'illegal possession',
      'landlord',
      'tenant',
      'registry fraud',
    ],
    transliterations: [
      'zameen', 'jamin', 'makaan', 'kirayedaar', 'kabza',
      'nilam', 'sothu', 'veedu', 'patta', 'vaadagai',
    ],
    partials: ['land', 'propert', 'evict', 'encroach', 'tenant', 'landlord'],
  },
];

const DEFAULT_CATEGORY = 'ConsumerComplaint';

// ---------------------------------------------------------------------------
// Matching helpers
// ---------------------------------------------------------------------------

/**
 * Check if text contains a keyword as a substring (exact multi-word match).
 */
function exactMatch(text, keyword) {
  return text.includes(keyword);
}

/**
 * Check if any word in the text starts with a partial stem.
 * This handles compound words: e.g. "cyberfraud" matches stem "fraud",
 * "unfired" matches stem "fired".
 */
function partialMatch(text, stem) {
  // Use word-boundary-aware regex: stem can appear as a word or
  // as part of a compound word (at least 3-char stems to avoid false positives)
  if (stem.length < 3) return false;
  try {
    const re = new RegExp('(?:^|\\s|[^a-z])' + escapeRegex(stem), 'i');
    return re.test(text);
  } catch {
    return text.includes(stem);
  }
}

/** Escape special regex characters in a literal string */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify a complaint into one of the 6 predefined categories.
 *
 * Matching order per category:
 *   1. Exact multi-word keywords (highest confidence)
 *   2. Hindi / Tamil transliteration stems (high confidence)
 *   3. Partial / compound-word stems (medium confidence)
 *
 * First category with any match wins (priority order).
 *
 * @param {string} englishText - Complaint text translated to English
 * @returns {{ category: string, confidence: number, matchedKeyword: string | null }}
 */
function classifyComplaint(englishText) {
  const text = (englishText || '').toLowerCase();

  for (const entry of CATEGORY_KEYWORDS) {
    const { category, keywords, transliterations, partials } = entry;

    // Pass 1 — exact keyword match (confidence 1.0)
    for (const keyword of keywords) {
      if (exactMatch(text, keyword)) {
        return { category, confidence: 1.0, matchedKeyword: keyword };
      }
    }

    // Pass 2 — transliteration match (confidence 0.85)
    if (transliterations) {
      for (const stem of transliterations) {
        if (exactMatch(text, stem)) {
          return { category, confidence: 0.85, matchedKeyword: stem };
        }
      }
    }

    // Pass 3 — partial / compound-word match (confidence 0.7)
    if (partials) {
      for (const stem of partials) {
        if (partialMatch(text, stem)) {
          return { category, confidence: 0.7, matchedKeyword: stem };
        }
      }
    }
  }

  // No keyword matched — fall back to default
  return {
    category: DEFAULT_CATEGORY,
    confidence: 0,
    matchedKeyword: null,
  };
}

module.exports = { classifyComplaint };
