/**
 * drafter.js — Complaint Draft Template Engine
 * ===============================================
 * Generates a structured formal complaint draft in English using
 * template-based string interpolation (NO LLM).
 *
 * The draft includes:
 * - Today's date (dynamic)
 * - Subject line based on complaint category
 * - Formal salutation to the appropriate authority
 * - Body with complaint summary and Constitutional article reference
 * - Category-specific relief sought
 * - Closing with standard legal phrasing
 * - Mandatory disclaimer
 *
 * Runtime: Node.js 18.x (pure logic, no AWS services)
 */

'use strict';

// ---------------------------------------------------------------------------
// Human-readable category labels
// ---------------------------------------------------------------------------
const CATEGORY_LABELS = {
  OnlineFinancialFraud: 'Online Financial Fraud',
  CybercrimeNonFinancial: 'Cybercrime (Non-Financial)',
  DomesticViolence: 'Domestic Violence',
  ConsumerComplaint: 'Consumer Complaint',
  EmploymentLabourDispute: 'Employment / Labour Dispute',
  PropertyDispute: 'Property Dispute',
};

// ---------------------------------------------------------------------------
// Category-specific "Relief Sought" text
// ---------------------------------------------------------------------------
const RELIEF_SOUGHT = {
  OnlineFinancialFraud:
    '1. Register an FIR under the relevant sections of the Information Technology Act, 2000.\n' +
    '2. Initiate an investigation to trace the fraudulent transaction and identify the perpetrators.\n' +
    '3. Coordinate with the concerned bank/payment gateway to freeze the suspicious account and facilitate recovery of the lost amount.\n' +
    '4. Provide a copy of the FIR for my records.',

  CybercrimeNonFinancial:
    '1. Register an FIR under the relevant sections of the Information Technology Act, 2000.\n' +
    '2. Investigate the cybercrime, including preservation of digital evidence.\n' +
    '3. Take appropriate action to remove or block the offending content from the internet.\n' +
    '4. Ensure the safety and privacy of the complainant during the investigation.',

  DomesticViolence:
    '1. Register the complaint under the Protection of Women from Domestic Violence Act, 2005.\n' +
    '2. Issue a protection order to ensure the safety of the complainant.\n' +
    '3. Direct the respondent to provide monetary relief as per Section 20 of the Act.\n' +
    '4. Arrange for shelter and support services if required.',

  ConsumerComplaint:
    '1. Register this consumer complaint for adjudication under the Consumer Protection Act, 2019.\n' +
    '2. Direct the opposite party to provide a full refund or replacement as applicable.\n' +
    '3. Award appropriate compensation for the loss, inconvenience, and mental agony suffered.\n' +
    '4. Impose penalties on the opposite party for unfair trade practices, if established.',

  EmploymentLabourDispute:
    '1. Register this complaint and initiate conciliation proceedings under the Industrial Disputes Act, 1947.\n' +
    '2. Direct the employer to clear all pending dues including wages, overtime, and statutory benefits.\n' +
    '3. Investigate any violation of labour laws and take appropriate enforcement action.\n' +
    '4. Ensure reinstatement or adequate compensation as per the applicable provisions.',

  PropertyDispute:
    '1. Conduct an inquiry into the property dispute and verify the title/ownership records.\n' +
    '2. Issue appropriate orders to restrain any illegal encroachment or unauthorized possession.\n' +
    '3. Direct the concerned party to restore lawful possession to the rightful owner.\n' +
    '4. Ensure the matter is resolved in accordance with the Transfer of Property Act, 1882.',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format today's date as "DD Month YYYY" */
function formatDate() {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = months[now.getMonth()];
  const yyyy = now.getFullYear();
  return `${dd} ${mm} ${yyyy}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a formal complaint draft in English.
 *
 * @param {Object} params
 * @param {string} params.category       - Category key (e.g. "OnlineFinancialFraud")
 * @param {string} params.complaintText  - English complaint summary from the user
 * @param {string} params.articles       - Constitutional article(s) (e.g. "Article 21")
 * @param {string} params.authority      - Name of the target government authority
 * @param {string} params.stateCode      - Pilot state code ("TN" | "MH" | "UP")
 * @returns {string} Complete formatted complaint draft
 */
function generateDraft({ category, complaintText, articles, authority, stateCode }) {
  const date = formatDate();
  const categoryLabel = CATEGORY_LABELS[category] || category;
  const reliefText = RELIEF_SOUGHT[category] || RELIEF_SOUGHT.ConsumerComplaint;
  const articleRef = articles || 'the applicable Articles';
  const authorityName = authority || 'The Concerned Authority';

  const draft =
`${date}

To,
The ${authorityName}

Subject: Formal Complaint Regarding ${categoryLabel}

Respected Sir/Madam,

I am writing to bring to your attention a matter that I believe violates my fundamental rights as guaranteed under ${articleRef} of the Constitution of India.

COMPLAINT DETAILS:
${complaintText}

[Note: The complainant should add specific details such as dates, locations, names of involved parties, and any supporting evidence or reference numbers.]

RELIEF SOUGHT:
I respectfully request your office to:
${reliefText}

DECLARATION:
I declare that the information provided above is true and correct to the best of my knowledge and belief. I understand that any false statement may result in legal consequences.

Yours sincerely,
[Complainant Name]
[Contact Information]
[Address]

Date: ${date}

---
DISCLAIMER: This draft is generated for awareness and assistance purposes only. It does NOT constitute legal advice. Please consult a licensed advocate for legal counsel before submitting this complaint.`;

  return draft;
}

module.exports = { generateDraft };
