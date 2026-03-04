# Legal-Awareness-Assistant
🇮🇳 Legal Awareness Assistant — AI-powered multilingual legal awareness &amp; complaint drafting tool for Indian citizens, built on AWS Serverless (free tier)


# ⚖️ Legal Awareness Assistant
### AI-Powered Multilingual Legal Awareness & Complaint Assistance System

[![AWS](https://img.shields.io/badge/AWS-Serverless-orange?logo=amazon-aws)](https://aws.amazon.com)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-green?logo=node.js)](https://nodejs.org)
[![Languages](https://img.shields.io/badge/Languages-22%20Indian-blue)](https://aws.amazon.com/translate)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

> ⚠️ **Disclaimer:** This tool provides legal awareness and complaint drafting
> assistance only. It is **NOT legal advice**. Please consult a licensed advocate
> for legal counsel.
>
> यह उपकरण केवल जागरूकता और ड्राफ्ट सहायता प्रदान करता है।
> यह कानूनी सलाह नहीं है।

---

## 🌟 What is Legal Awareness Assistant?

Legal Awareness Assistant is a free, serverless, AI-powered tool that helps
Indian citizens navigate the legal system — without needing a lawyer to get
started.

A citizen types their complaint in **any Indian language**. The system:
- Detects their language automatically
- Classifies the type of legal problem
- Explains which **Constitutional rights** protect them
- Tells them **which government authority** to approach in their state
- Generates a **ready-to-submit formal complaint letter** in their own language

No legal jargon. No personal data stored. Completely free.

---

## 🎯 The Problem It Solves

Most Indian citizens face these barriers when seeking justice:

| Problem | How This Tool Helps |
|---|---|
| Unaware of constitutional rights | Maps complaint to relevant articles |
| Language barrier | Supports all 22 Indian languages |
| Don't know which authority to contact | State-aware authority mapping |
| Can't write a formal complaint | Auto-generates structured draft letter |
| Fear of legal complexity | Simple, friendly, plain-language interface |

---

## 🏗️ Architecture
```
User types complaint (any Indian language)
              ↓
   S3 Static Website (Frontend)
              ↓
   API Gateway (REST — POST /analyze)
              ↓
       AWS Lambda (Node.js 18.x)
              ↓
   Amazon Comprehend ──► Detect Language
              ↓
   Amazon Translate  ──► Convert to English
              ↓
   Rule Engine       ──► Classify Complaint
              ↓
   DynamoDB          ──► Fetch Legal Mapping
              ↓
   Template Engine   ──► Generate Draft Letter
              ↓
   Amazon Translate  ──► Translate Back to User's Language
              ↓
      Response shown to User
```

---

## 🗂️ Complaint Categories

| Category | Constitutional Article | Primary Law |
|---|---|---|
| Online Financial Fraud | Article 21 | IT Act 2000 |
| Cybercrime (Non-financial) | Article 19 & 21 | IT Act 2000 |
| Domestic Violence | Article 21 | DV Act 2005 |
| Consumer Complaint | Article 14 & 21 | Consumer Protection Act 2019 |
| Employment / Labour Dispute | Article 14 & 19 | Industrial Disputes Act 1947 |
| Property Dispute | Article 14 & 21 | Transfer of Property Act 1882 |

---

## 🗺️ Pilot States (MVP)

| State | Code | Status |
|---|---|---|
| Tamil Nadu | TN | ✅ Live |
| Maharashtra | MH | ✅ Live |
| Uttar Pradesh | UP | ✅ Live |
| 25 more states | — | 🔜 Roadmap |

---

## ☁️ AWS Services Used

| Service | Purpose | Cost |
|---|---|---|
| S3 | Frontend static hosting | Free tier |
| API Gateway | REST API endpoint | Free tier |
| Lambda | Core processing logic | Free tier |
| DynamoDB | Legal knowledge base | Free tier |
| Comprehend | Language detection | Free tier |
| Translate | 22-language support | Free tier |
| IAM | Least-privilege security | Free |
| CloudWatch | Logging & monitoring | Free tier |

**Total infrastructure cost: $0** for hackathon and demo usage.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18 or higher
- AWS CLI installed and configured
- AWS account (free tier is sufficient)
```bash
node --version   # must be 18+
aws --version    # must be installed
aws configure    # set up your credentials
```

### Deploy in 5 Steps

**Step 1 — Clone the repository**
```bash
git clone https://github.com/yourusername/legal-awareness-assistant.git
cd legal-awareness-assistant
```

**Step 2 — Install dependencies**
```bash
cd backend && npm install && cd ..
```

**Step 3 — Package Lambda code**
```bash
aws cloudformation package \
  --template-file infra/template.yaml \
  --s3-bucket YOUR-S3-BUCKET-NAME \
  --output-template-file infra/template-packaged.yaml \
  --region ap-south-1
```

**Step 4 — Deploy infrastructure**
```bash
aws cloudformation deploy \
  --template-file infra/template-packaged.yaml \
  --stack-name legal-awareness \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --region ap-south-1
```

**Step 5 — Seed the legal knowledge base**
```bash
aws dynamodb batch-write-item \
  --request-items file://infra/dynamodb-seed.json \
  --region ap-south-1
```

### Get Your Live URLs
```bash
aws cloudformation describe-stacks \
  --stack-name legal-awareness \
  --query "Stacks[0].Outputs" \
  --region ap-south-1
```

### Connect and Deploy Frontend
```bash
# 1. Update API URL in frontend/index.html
# Replace YOUR_API_GATEWAY_URL with the ApiGatewayUrl from above

# 2. Upload to S3
aws s3 sync frontend/ s3://YOUR-FRONTEND-BUCKET \
  --region ap-south-1
```

---

## 🧪 Test Cases

| Language | Sample Input | Expected Category |
|---|---|---|
| Tamil | என் வங்கி கணக்கிலிருந்து பணம் திருடப்பட்டது | Online Financial Fraud |
| Hindi | मेरे पति मुझे रोज मारते हैं | Domestic Violence |
| Marathi | खराब उत्पादन मिळाले, परतावा नाकारला | Consumer Complaint |
| English | My employer has not paid salary for 3 months | Employment Labour Dispute |

---

## 📁 Project Structure
```
legal-awareness-assistant/
├── frontend/
│   ├── index.html          # Complaint input form
│   ├── result.html         # Results & draft display
│   ├── css/
│   │   └── style.css       # Responsive mobile-first styles
│   └── js/
│       └── app.js          # API communication
│
├── backend/
│   ├── lambda/
│   │   ├── handler.js      # Main Lambda entry point
│   │   ├── detector.js     # Language detection (Comprehend)
│   │   ├── translator.js   # Translation (Translate)
│   │   ├── classifier.js   # Rule-based complaint classifier
│   │   ├── mapper.js       # DynamoDB legal mapping retrieval
│   │   └── drafter.js      # Formal complaint draft generator
│   └── package.json
│
├── infra/
│   ├── template.yaml           # CloudFormation template
│   ├── template-packaged.yaml  # Packaged template (generated)
│   ├── dynamodb-seed.json      # Legal knowledge base seed data
│   └── iam-policy.json         # IAM least-privilege policy
│
└── README.md
```

---

## 🔐 Privacy & Security

- ✅ No personal data stored anywhere
- ✅ No names, phone numbers or addresses saved
- ✅ Session-based processing only — nothing persists
- ✅ IAM least-privilege roles on all services
- ✅ API Gateway rate limiting enabled
- ✅ Input validation on all user inputs
- ✅ No raw legal interpretation provided

---

## 🔮 Roadmap

- [ ] Support all 28 Indian states
- [ ] Voice input in Indian languages
- [ ] WhatsApp bot integration
- [ ] District-level authority database
- [ ] Legal helpline directory integration
- [ ] Case reference number generation
- [ ] Offline PWA support
- [ ] Analytics dashboard for grievance trends

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create your feature branch
```bash
   git checkout -b feature/add-karnataka-support
```
3. Commit your changes
```bash
   git commit -m "Add Karnataka state authority mapping"
```
4. Push and open a Pull Request
```bash
   git push origin feature/add-karnataka-support
```

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

## ⚖️ Legal Disclaimer

This system provides **legal awareness and complaint drafting assistance only**.
It is **NOT a substitute for legal advice**.
Always consult a licensed advocate for legal counsel.
The developers are not responsible for any actions taken based on
this tool's output.

---

*🇮🇳 न्याय सबके लिए — Justice for Every Indian Citizen*
