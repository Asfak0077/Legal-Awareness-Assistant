/**
 * mapper.js — DynamoDB Legal Mapping Retrieval
 * ===============================================
 * Retrieves legal information from the DynamoDB 'LegalMapping' table:
 * - Relevant Constitutional articles (14, 19, 21, 21A) for the category
 * - Suggested government authority based on category + pilot state (TN, MH, UP)
 * - Related legal provisions and descriptions
 *
 * AWS Service: Amazon DynamoDB (GetItem)
 * Runtime: Node.js 18.x (AWS SDK v3)
 */

'use strict';

const {
  DynamoDBClient,
  GetItemCommand,
} = require('@aws-sdk/client-dynamodb');

// ---------------------------------------------------------------------------
// Client — reused across warm Lambda invocations
// ---------------------------------------------------------------------------
const dynamo = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});

const TABLE_NAME = process.env.LEGAL_TABLE_NAME || 'LegalMapping';

// ---------------------------------------------------------------------------
// State → DynamoDB attribute key mapping
// ---------------------------------------------------------------------------
const STATE_AUTHORITY_KEY = {
  TN: 'Authority_TN',
  MH: 'Authority_MH',
  UP: 'Authority_UP',
};

// ---------------------------------------------------------------------------
// Fallback defaults (ConsumerComplaint)
// ---------------------------------------------------------------------------
const DEFAULTS = {
  category: 'ConsumerComplaint',
  articleNumber: 'Article 14 & Article 21',
  articleExplanation:
    'Article 14 ensures every person is treated equally under the law, including as a buyer of goods and services. ' +
    'Article 21 protects your right to a dignified life, which includes not being cheated by sellers or service providers.',
  relevantLaw: 'Consumer Protection Act, 2019',
  authority: 'State Consumer Disputes Redressal Commission',
  portalLink: 'https://consumerhelpline.gov.in',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safely extract a string attribute from a DynamoDB item */
function str(item, key) {
  return item[key] && item[key].S ? item[key].S : null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch legal mapping data for a given category and state.
 *
 * @param {string} category  - One of the 6 complaint category keys
 * @param {string} stateCode - Pilot state code: 'TN' | 'MH' | 'UP'
 * @returns {Promise<{
 *   category: string,
 *   articleNumber: string,
 *   articleExplanation: string,
 *   relevantLaw: string,
 *   authority: string,
 *   portalLink: string
 * }>}
 * @throws {Error} If the DynamoDB call fails (AWS details are NOT exposed)
 */
async function getLegalMapping(category, stateCode) {
  // --- DEBUG: log the exact key and table for troubleshooting ---
  console.log('[mapper] GetItem request:', JSON.stringify({
    TableName: TABLE_NAME,
    Key: { Category: { S: category } },
    stateCode,
  }));

  // Validate category is not empty
  if (!category || typeof category !== 'string') {
    console.error('[mapper] Invalid category:', JSON.stringify(category));
    return { ...DEFAULTS };
  }

  try {
    const command = new GetItemCommand({
      TableName: TABLE_NAME,
      Key: {
        Category: { S: category },
      },
    });

    const response = await dynamo.send(command);

    // --- DEBUG: log whether an item was found ---
    console.log('[mapper] GetItem response:', JSON.stringify({
      found: !!response.Item,
      returnedCategory: response.Item ? str(response.Item, 'Category') : null,
    }));

    // If item not found, return defaults
    if (!response.Item) {
      console.warn(
        `[mapper] No DynamoDB item found for category "${category}". Using defaults.`,
      );
      console.warn(
        '[mapper] ⚠️  Category key is CASE-SENSITIVE. Verify it matches seed data exactly.',
      );
      console.warn(
        '[mapper] Valid categories: OnlineFinancialFraud, CybercrimeNonFinancial, DomesticViolence, ConsumerComplaint, EmploymentLabourDispute, PropertyDispute',
      );
      return { ...DEFAULTS };
    }

    const item = response.Item;

    // Select the authority for the requested state
    const authorityKey = STATE_AUTHORITY_KEY[stateCode] || STATE_AUTHORITY_KEY.TN;
    const authority = str(item, authorityKey) || DEFAULTS.authority;

    return {
      category: str(item, 'Category') || category,
      articleNumber: str(item, 'ArticleNumber') || DEFAULTS.articleNumber,
      articleExplanation: str(item, 'ArticleExplanation') || DEFAULTS.articleExplanation,
      relevantLaw: str(item, 'RelevantLaw') || DEFAULTS.relevantLaw,
      authority,
      portalLink: str(item, 'PortalLink') || DEFAULTS.portalLink,
    };
  } catch (err) {
    console.error('[mapper] DynamoDB error:', err);
    throw new Error('Failed to retrieve legal mapping. Please try again later.');
  }
}

module.exports = { getLegalMapping };
