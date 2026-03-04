# 🇮🇳 Multilingual Legal Awareness & Complaint Assistance System

> Helping Indian citizens understand their Constitutional rights and file formal complaints — in any of India's 22 scheduled languages.

---

## ⚠️ Disclaimer

**This tool provides legal awareness and draft assistance only. It is NOT legal advice.
Please consult a licensed advocate for professional legal counsel.**

---

## 1. Project Overview

Millions of Indian citizens face legal issues every day — fraud, harassment, domestic violence, consumer disputes — but most do not know which Constitutional article protects them, which government authority to approach, or how to write a formal complaint. Language barriers make this even harder when official processes are in English or Hindi. This system bridges that gap by accepting a complaint written in **any of India's 22 scheduled languages**, automatically detecting the language, translating it, classifying the issue, and mapping it to the relevant Constitutional rights and state-specific authorities.

The system is designed to run entirely on the **AWS Free Tier** with no paid AI/LLM services. It uses Amazon Comprehend for language detection, Amazon Translate for multilingual support, a rule-based keyword engine for classification, DynamoDB for legal mappings, and a template engine that generates a ready-to-submit formal complaint letter — translated back into the citizen's own language. The pilot covers three states (Tamil Nadu, Maharashtra, Uttar Pradesh) and six complaint categories spanning cyber fraud, domestic violence, consumer rights, employment disputes, and property issues.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER (Any Indian Language)                  │
│              Writes complaint in Tamil / Hindi / Marathi / etc.     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  POST /analyze
                               ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────────────┐
│   S3 Bucket  │──────▶│ API Gateway  │──────▶│    AWS Lambda        │
│   (Frontend) │       │  (REST API)  │       │   (Node.js 18.x)    │
│              │       │  Stage: prod │       │                      │
│  index.html  │       └──────────────┘       │  ┌────────────────┐  │
│  result.html │                              │  │ 1. DETECT LANG │◀─┼── Amazon Comprehend
│  css/style.css│                              │  │    (detector)  │  │
└──────────────┘                              │  ├────────────────┤  │
                                              │  │ 2. TRANSLATE   │◀─┼── Amazon Translate
                                              │  │    → English   │  │
                                              │  ├────────────────┤  │
                                              │  │ 3. CLASSIFY    │  │
                                              │  │  (rule engine) │  │   10 keywords × 6 categories
                                              │  ├────────────────┤  │
                                              │  │ 4. MAP RIGHTS  │◀─┼── DynamoDB (LegalMapping)
                                              │  │  Articles +    │  │   Art. 14, 19, 21, 21A
                                              │  │  Authority     │  │   State-specific authorities
                                              │  ├────────────────┤  │
                                              │  │ 5. DRAFT       │  │
                                              │  │  (template)    │  │   Formal complaint letter
                                              │  ├────────────────┤  │
                                              │  │ 6. TRANSLATE   │◀─┼── Amazon Translate
                                              │  │    → User Lang │  │
                                              │  └────────────────┘  │
                                              └──────────┬───────────┘
                                                         │
                                                         ▼
                                              JSON Response to Frontend
                                              {
                                                detectedLanguage, category,
                                                articleNumber, articleExplanation,
                                                authority, portalLink,
                                                draftEN, draftLocalized,
                                                disclaimer
                                              }
```

### Complaint Categories

| # | Category | Constitutional Articles | Relevant Law |
|---|----------|------------------------|-------------|
| 1 | Online Financial Fraud | Article 21 | IT Act 2000 (Sec 43, 66, 66C, 66D) |
| 2 | Cybercrime (Non-Financial) | Articles 19 & 21 | IT Act 2000 (Sec 66E, 67, 67A, 67B) |
| 3 | Domestic Violence | Article 21 | DV Act, 2005 |
| 4 | Consumer Complaint | Articles 14 & 21 | Consumer Protection Act, 2019 |
| 5 | Employment / Labour Dispute | Articles 14 & 19 | Industrial Disputes Act, 1947 |
| 6 | Property Dispute | Articles 14 & 21 | Transfer of Property Act, 1882 |

### Pilot States

- **Tamil Nadu (TN)** — Cyber Crime Wing, State Consumer Commission, Women's Commission, Labour Dept, Revenue Dept
- **Maharashtra (MH)** — Maharashtra Cyber, State Consumer Commission, Women's Commission, Labour Dept, Revenue Dept
- **Uttar Pradesh (UP)** — UP Cyber Crime, State Consumer Commission, Women's Commission, Labour Dept, Revenue Dept

---

## 3. Tech Stack (AWS Free Tier)

| Layer | Service |
|-------|---------|
| Frontend | S3 Static Website Hosting |
| API | Amazon API Gateway (REST) |
| Compute | AWS Lambda (Node.js 18.x, 256 MB, 30 s) |
| Language Detection | Amazon Comprehend |
| Translation | Amazon Translate |
| Database | Amazon DynamoDB (PAY_PER_REQUEST) |
| Security | AWS IAM (least-privilege) |
| Logging | Amazon CloudWatch |

---

## 4. Project Structure

```
legal-awareness-system/
├── frontend/
│   ├── index.html             # Complaint input form (multilingual)
│   ├── result.html            # Results display (cards + copy-draft)
│   └── css/
│       └── style.css          # Responsive mobile-first CSS
├── backend/
│   ├── lambda/
│   │   ├── handler.js         # Lambda entry point — 9-step orchestrator
│   │   ├── detector.js        # Amazon Comprehend language detection
│   │   ├── translator.js      # Amazon Translate wrapper
│   │   ├── classifier.js      # Rule-based keyword classifier
│   │   ├── mapper.js          # DynamoDB legal mapping retrieval
│   │   └── drafter.js         # Formal complaint draft generator
│   ├── package.json           # Dependencies (AWS SDK v3 + Jest)
│   └── test/
│       └── integration.test.js # 10 Jest integration tests
├── infra/
│   ├── template.yaml          # SAM / CloudFormation template
│   ├── dynamodb-seed.json     # Seed data (6 categories × 3 states)
│   └── iam-policy.json        # Least-privilege IAM policy reference
├── deploy.sh                  # One-command deployment script
└── README.md
```

---

## 5. Setup Prerequisites

Before deploying, ensure you have:

| Requirement | Version | Check |
|-------------|---------|-------|
| **Node.js** | 18.x or later | `node --version` |
| **npm** | 9.x or later | `npm --version` |
| **AWS CLI** | 2.x (configured) | `aws sts get-caller-identity` |
| **AWS SAM CLI** *(optional)* | 1.x | `sam --version` |
| **AWS Account** | Free Tier eligible | — |

> Configure the AWS CLI with `aws configure` — use region **ap-south-1** (Mumbai).

---

## 6. Step-by-Step Deployment

### a. Clone the repository

```bash
git clone <your-repo-url>
cd legal-awareness-system
```

### b. Install backend dependencies

```bash
cd backend && npm install
cd ..
```

### c. Deploy infrastructure via CloudFormation

```bash
aws cloudformation deploy \
  --template-file infra/template.yaml \
  --stack-name legal-awareness \
  --capabilities CAPABILITY_IAM \
  --region ap-south-1
```

> This creates the DynamoDB table, Lambda function, API Gateway, S3 bucket, and IAM role.

### d. Retrieve stack outputs

```bash
aws cloudformation describe-stacks \
  --stack-name legal-awareness \
  --region ap-south-1 \
  --query "Stacks[0].Outputs" \
  --output table
```

Note down:
- **ApiGatewayUrl** — e.g. `https://abc123.execute-api.ap-south-1.amazonaws.com/prod/analyze`
- **S3WebsiteUrl** — e.g. `http://legal-awareness-frontend-123456789012.s3-website.ap-south-1.amazonaws.com`

### e. Seed DynamoDB with legal mappings

```bash
aws dynamodb batch-write-item \
  --request-items file://infra/dynamodb-seed.json \
  --region ap-south-1
```

### f. Update the API URL in the frontend

Open `frontend/index.html` and replace the placeholder:

```javascript
// Find this line (~line 91):
const API_URL = 'YOUR_API_GATEWAY_URL/analyze';

// Replace with the ApiGatewayUrl from step d:
const API_URL = 'https://abc123.execute-api.ap-south-1.amazonaws.com/prod/analyze';
```

### g. Upload the frontend to S3

```bash
# Get the bucket name from the S3WebsiteUrl (or from CloudFormation outputs)
aws s3 sync frontend/ s3://legal-awareness-frontend-<ACCOUNT_ID>/ \
  --region ap-south-1
```

### h. Open the application

Visit the **S3WebsiteUrl** from step d in your browser. You should see the complaint form.

---

## 7. Automated Deployment

Instead of manual steps c–h, run the included deployment script:

```bash
chmod +x deploy.sh
./deploy.sh
```

The script deploys the stack, seeds DynamoDB, patches the API URL into the frontend, uploads to S3, and prints the website URL.

---

## 8. Testing

### Run the Jest test suite

```bash
cd backend
npm test
```

**10 tests** covering the full pipeline:

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | Tamil Financial Fraud | Tamil text, state TN | category=OnlineFinancialFraud, lang=ta |
| 2 | Hindi Domestic Violence | Hindi text, state UP | category=DomesticViolence, lang=hi |
| 3 | Marathi Consumer Complaint | Marathi text, state MH | category=ConsumerComplaint, lang=mr |
| 4 | English Labour Dispute | English text, state TN | category=EmploymentLabourDispute, lang=en |
| 5 | Invalid State (KA) | Any text, state KA | HTTP 400 |
| 6 | CORS Preflight | OPTIONS request | HTTP 200 |
| 7 | Missing Complaint Text | No complaintText field | HTTP 400 |
| 8 | Too-Short Complaint | 2-char text | HTTP 400 |
| 9 | Invalid JSON Body | Malformed JSON | HTTP 400 |
| 10 | AWS Service Failure | Comprehend throws | HTTP 500 |

All AWS SDK calls are mocked — no AWS credentials needed for tests.

---

## 9. Hard Constraints

- ❌ **No legal advice** — awareness and drafts only
- ❌ **No personal data storage** — no names, phone numbers, or addresses persisted
- ❌ **No Bedrock, OpenAI, or paid LLMs** — rule-based classification only
- ❌ **No case tracking or follow-ups**
- ✅ **Disclaimer on every screen** (English + Hindi)
- ✅ **AWS Free Tier only**
- ✅ **Least-privilege IAM** — only `comprehend:DetectDominantLanguage`, `translate:TranslateText`, `dynamodb:GetItem`, CloudWatch Logs

---

## 10. Contributing

Contributions are welcome! Here's how you can help:

1. **Fork** this repository
2. **Create a feature branch**: `git checkout -b feature/add-new-state`
3. **Make your changes** and add tests
4. **Run the test suite**: `cd backend && npm test`
5. **Commit** with a clear message: `git commit -m "feat: add Karnataka (KA) state support"`
6. **Push** to your fork: `git push origin feature/add-new-state`
7. **Open a Pull Request** describing what you changed and why

### Ideas for contribution

- Add more pilot states (KA, DL, WB, KL, etc.)
- Add new complaint categories (e.g., Environmental, RTI)
- Improve keyword dictionaries for better classification accuracy
- Add accessibility features (screen reader support, high contrast mode)
- Add unit tests for individual modules (detector, translator, classifier, mapper, drafter)

---

## 11. License

MIT

---

> **⚠️ Reminder:** This system provides legal awareness and draft assistance only. It is NOT legal advice. Please consult a licensed advocate for professional legal counsel.
