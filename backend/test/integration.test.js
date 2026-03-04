/**
 * integration.test.js — Jest Integration Tests for Lambda Handler
 * =================================================================
 * Tests the full complaint-processing pipeline with mocked AWS SDK calls.
 * Validates: language detection → translation → classification →
 *            DynamoDB mapping → draft generation → localized translation.
 *
 * Run:  cd backend && npm test
 */

'use strict';

// ---------------------------------------------------------------------------
// AWS SDK Mocks — intercept all send() calls
// ---------------------------------------------------------------------------
const mockSend = jest.fn();

// Mock Comprehend
jest.mock('@aws-sdk/client-comprehend', () => ({
  ComprehendClient: jest.fn(() => ({ send: mockSend })),
  DetectDominantLanguageCommand: jest.fn((params) => ({
    _type: 'DetectDominantLanguage',
    _params: params,
  })),
}));

// Mock Translate
jest.mock('@aws-sdk/client-translate', () => ({
  TranslateClient: jest.fn(() => ({ send: mockSend })),
  TranslateTextCommand: jest.fn((params) => ({
    _type: 'TranslateText',
    _params: params,
  })),
}));

// Mock DynamoDB
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({ send: mockSend })),
  GetItemCommand: jest.fn((params) => ({
    _type: 'GetItem',
    _params: params,
  })),
}));

// ---------------------------------------------------------------------------
// Import handler AFTER mocks are in place
// ---------------------------------------------------------------------------
const { handler } = require('../lambda/handler');

// ---------------------------------------------------------------------------
// DynamoDB seed items (matching infra/dynamodb-seed.json)
// ---------------------------------------------------------------------------
const DB_ITEMS = {
  OnlineFinancialFraud: {
    Category: { S: 'OnlineFinancialFraud' },
    ArticleNumber: { S: 'Article 21' },
    ArticleExplanation: { S: 'Article 21 guarantees every person the right to live with dignity and personal safety.' },
    RelevantLaw: { S: 'Information Technology Act, 2000 (Sections 43, 66, 66C, 66D)' },
    Authority_TN: { S: 'Tamil Nadu Police - Cyber Crime Wing, CB-CID, Chennai' },
    Authority_MH: { S: 'Maharashtra Cyber Department, BKC Cyber Police Station, Mumbai' },
    Authority_UP: { S: 'Uttar Pradesh Police - Cyber Crime Police Station, Lucknow' },
    PortalLink: { S: 'https://cybercrime.gov.in' },
  },
  DomesticViolence: {
    Category: { S: 'DomesticViolence' },
    ArticleNumber: { S: 'Article 21' },
    ArticleExplanation: { S: 'Article 21 guarantees your right to live with dignity, safety, and freedom from violence.' },
    RelevantLaw: { S: 'Protection of Women from Domestic Violence Act, 2005' },
    Authority_TN: { S: 'Tamil Nadu State Commission for Women, Chennai & Protection Officer, District Magistrate Office' },
    Authority_MH: { S: 'Maharashtra State Commission for Women, Mumbai & Protection Officer, District Magistrate Office' },
    Authority_UP: { S: 'Uttar Pradesh State Commission for Women, Lucknow & Protection Officer, District Magistrate Office' },
    PortalLink: { S: 'http://www.ncw.nic.in/ncw-cells/complaint-registration' },
  },
  ConsumerComplaint: {
    Category: { S: 'ConsumerComplaint' },
    ArticleNumber: { S: 'Article 14 & Article 21' },
    ArticleExplanation: { S: 'Article 14 ensures every person is treated equally under the law.' },
    RelevantLaw: { S: 'Consumer Protection Act, 2019' },
    Authority_TN: { S: 'Tamil Nadu State Consumer Disputes Redressal Commission, Chennai' },
    Authority_MH: { S: 'Maharashtra State Consumer Disputes Redressal Commission, Mumbai' },
    Authority_UP: { S: 'Uttar Pradesh State Consumer Disputes Redressal Commission, Lucknow' },
    PortalLink: { S: 'https://consumerhelpline.gov.in' },
  },
  EmploymentLabourDispute: {
    Category: { S: 'EmploymentLabourDispute' },
    ArticleNumber: { S: 'Article 14 & Article 19' },
    ArticleExplanation: { S: 'Article 14 ensures all workers are treated equally under the law.' },
    RelevantLaw: { S: 'Industrial Disputes Act, 1947' },
    Authority_TN: { S: 'Office of the Labour Commissioner, Tamil Nadu Labour Department, Chennai' },
    Authority_MH: { S: 'Office of the Labour Commissioner, Maharashtra Labour Department, Mumbai' },
    Authority_UP: { S: 'Office of the Labour Commissioner, Uttar Pradesh Labour Department, Lucknow' },
    PortalLink: { S: 'https://labour.gov.in/grievance' },
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a mock API Gateway event */
function makeEvent(body, method = 'POST') {
  return {
    httpMethod: method,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  };
}

/** Parse the response body */
function parseBody(response) {
  return JSON.parse(response.body);
}

/**
 * Configure mockSend to route by command type.
 * @param {string} lang       — ISO 639-1 code Comprehend should return
 * @param {string} translated — English text Translate should return
 * @param {string} category   — DynamoDB category key to look up
 * @param {string} [backTranslated] — localized draft (defaults to 'LOCALIZED_DRAFT')
 */
function setupMocks(lang, translated, category, backTranslated) {
  mockSend.mockImplementation((cmd) => {
    // Comprehend — DetectDominantLanguage
    if (cmd._type === 'DetectDominantLanguage') {
      return Promise.resolve({
        Languages: [{ LanguageCode: lang, Score: 0.99 }],
      });
    }

    // Translate — TranslateText
    if (cmd._type === 'TranslateText') {
      // If translating TO English → return the English text
      if (cmd._params.TargetLanguageCode === 'en') {
        return Promise.resolve({ TranslatedText: translated });
      }
      // If translating FROM English (back-translation) → return localized
      return Promise.resolve({
        TranslatedText: backTranslated || 'LOCALIZED_DRAFT',
      });
    }

    // DynamoDB — GetItem
    if (cmd._type === 'GetItem') {
      const item = DB_ITEMS[category];
      return Promise.resolve({ Item: item || null });
    }

    return Promise.reject(new Error('Unexpected command type: ' + cmd._type));
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Legal Awareness Handler — Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // Test 1 — Tamil Financial Fraud (TN)
  // =========================================================================
  test('Test 1: Tamil Financial Fraud — detects Tamil, classifies as OnlineFinancialFraud', async () => {
    // "50,000 rupees stolen from my bank account" — translated to English
    const englishText = 'My bank account had 50,000 rupees stolen through UPI fraud';

    setupMocks('ta', englishText, 'OnlineFinancialFraud');

    const event = makeEvent({
      complaintText: 'என் வங்கி கணக்கிலிருந்து 50,000 ரூபாய் திருடப்பட்டது',
      userState: 'TN',
    });

    const response = await handler(event);
    const body = parseBody(response);

    expect(response.statusCode).toBe(200);
    expect(body.detectedLanguage).toBe('ta');
    expect(body.category).toBe('OnlineFinancialFraud');
    expect(body.articleNumber).toBe('Article 21');
    expect(body.relevantLaw).toContain('Information Technology Act');
    expect(body.authority).toContain('Tamil Nadu');
    expect(body.portalLink).toBe('https://cybercrime.gov.in');
    expect(body.draftEN).toBeDefined();
    expect(body.draftEN.length).toBeGreaterThan(0);
    expect(body.draftLocalized).toBeDefined();
    expect(body.disclaimer).toContain('NOT legal advice');
    expect(body.confidence).toBeDefined();
  });

  // =========================================================================
  // Test 2 — Hindi Domestic Violence (UP)
  // =========================================================================
  test('Test 2: Hindi Domestic Violence — detects Hindi, classifies as DomesticViolence', async () => {
    // "My husband beats me daily and harasses me for dowry"
    const englishText =
      'My husband beats me every day and harasses me for dowry';

    setupMocks('hi', englishText, 'DomesticViolence');

    const event = makeEvent({
      complaintText: 'मेरे पति मुझे रोज मारते हैं और दहेज के लिए परेशान करते हैं',
      userState: 'UP',
    });

    const response = await handler(event);
    const body = parseBody(response);

    expect(response.statusCode).toBe(200);
    expect(body.detectedLanguage).toBe('hi');
    expect(body.category).toBe('DomesticViolence');
    expect(body.articleNumber).toBe('Article 21');
    expect(body.relevantLaw).toContain('Domestic Violence');
    expect(body.authority).toContain('Uttar Pradesh');
    expect(body.portalLink).toContain('ncw.nic.in');
    expect(body.draftEN).toBeDefined();
    expect(body.draftLocalized).toBeDefined();
    expect(body.disclaimer).toContain('NOT legal advice');
  });

  // =========================================================================
  // Test 3 — Marathi Consumer Complaint (MH)
  // =========================================================================
  test('Test 3: Marathi Consumer Complaint — detects Marathi, classifies as ConsumerComplaint', async () => {
    // "I got a defective product and refund was denied"
    const englishText =
      'I received a defective product and the seller denied my refund';

    setupMocks('mr', englishText, 'ConsumerComplaint');

    const event = makeEvent({
      complaintText: 'मला खराब उत्पादन मिळाले आणि परतावा नाकारला',
      userState: 'MH',
    });

    const response = await handler(event);
    const body = parseBody(response);

    expect(response.statusCode).toBe(200);
    expect(body.detectedLanguage).toBe('mr');
    expect(body.category).toBe('ConsumerComplaint');
    expect(body.articleNumber).toBe('Article 14 & Article 21');
    expect(body.relevantLaw).toContain('Consumer Protection Act');
    expect(body.authority).toContain('Maharashtra');
    expect(body.portalLink).toBe('https://consumerhelpline.gov.in');
    expect(body.draftEN).toBeDefined();
    expect(body.draftLocalized).toBeDefined();
  });

  // =========================================================================
  // Test 4 — English Labour Dispute (TN)
  // =========================================================================
  test('Test 4: English Labour Dispute — detects English, classifies as EmploymentLabourDispute', async () => {
    // English input — no translation needed (detected as 'en')
    const complaintText = 'My employer has not paid my salary for 3 months';

    setupMocks('en', complaintText, 'EmploymentLabourDispute');

    const event = makeEvent({
      complaintText,
      userState: 'TN',
    });

    const response = await handler(event);
    const body = parseBody(response);

    expect(response.statusCode).toBe(200);
    expect(body.detectedLanguage).toBe('en');
    expect(body.category).toBe('EmploymentLabourDispute');
    expect(body.articleNumber).toBe('Article 14 & Article 19');
    expect(body.relevantLaw).toContain('Industrial Disputes Act');
    expect(body.authority).toContain('Tamil Nadu');
    expect(body.portalLink).toBe('https://labour.gov.in/grievance');

    // For English input, draftEN and draftLocalized should be identical
    expect(body.draftEN).toBe(body.draftLocalized);

    // Translate should NOT have been called (both input and draft are English)
    const translateCalls = mockSend.mock.calls.filter(
      ([cmd]) => cmd._type === 'TranslateText'
    );
    expect(translateCalls).toHaveLength(0);
  });

  // =========================================================================
  // Test 5 — Invalid State (should return 400)
  // =========================================================================
  test('Test 5: Invalid state code KA — returns HTTP 400', async () => {
    const event = makeEvent({
      complaintText: 'test complaint text for validation',
      userState: 'KA',
    });

    const response = await handler(event);
    const body = parseBody(response);

    expect(response.statusCode).toBe(400);
    expect(body.error).toMatch(/userState/i);
    expect(body.error).toContain('TN');
    expect(body.error).toContain('MH');
    expect(body.error).toContain('UP');
    expect(body.disclaimer).toContain('NOT legal advice');

    // No AWS service should have been called
    expect(mockSend).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Additional edge-case tests
  // =========================================================================

  test('CORS preflight OPTIONS returns 200', async () => {
    const event = { httpMethod: 'OPTIONS', body: null };
    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(response.headers['Access-Control-Allow-Methods']).toContain('POST');
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('Missing complaintText returns 400', async () => {
    const event = makeEvent({ userState: 'TN' });
    const response = await handler(event);
    const body = parseBody(response);

    expect(response.statusCode).toBe(400);
    expect(body.error).toMatch(/complaintText/i);
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('Complaint text too short returns 400', async () => {
    const event = makeEvent({ complaintText: 'hi', userState: 'TN' });
    const response = await handler(event);
    const body = parseBody(response);

    expect(response.statusCode).toBe(400);
    expect(body.error).toMatch(/between/i);
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('Invalid JSON body returns 400', async () => {
    const event = {
      httpMethod: 'POST',
      body: '{ broken json [[[',
      headers: { 'Content-Type': 'application/json' },
    };
    const response = await handler(event);
    const body = parseBody(response);

    expect(response.statusCode).toBe(400);
    expect(body.error).toMatch(/invalid json/i);
  });

  test('AWS service failure returns 500', async () => {
    mockSend.mockRejectedValue(new Error('Comprehend service unavailable'));

    const event = makeEvent({
      complaintText: 'My employer has not paid my salary for 3 months',
      userState: 'TN',
    });

    const response = await handler(event);
    const body = parseBody(response);

    expect(response.statusCode).toBe(500);
    expect(body.error).toMatch(/internal error/i);
    expect(body.disclaimer).toContain('NOT legal advice');
  });
});
