#!/usr/bin/env bash
# ============================================================
# deploy.sh — One-command deployment for Legal Awareness System
# ============================================================
# Automates CloudFormation deploy → DynamoDB seed → frontend
# API URL patch → S3 upload → prints website URL.
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# Prerequisites:
#   - AWS CLI v2 configured (aws configure)
#   - Node.js 18+  (for npm install)
#   - Region: ap-south-1 (Mumbai)
# ============================================================

set -euo pipefail

# ---- Configuration ----
STACK_NAME="legal-awareness"
REGION="ap-south-1"
TEMPLATE_FILE="infra/template.yaml"
SEED_FILE="infra/dynamodb-seed.json"
FRONTEND_DIR="frontend"
FRONTEND_HTML="frontend/index.html"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ---- Helper functions ----
info()    { echo -e "${CYAN}[INFO]${NC}  $1"; }
success() { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
fail()    { echo -e "${RED}[FAIL]${NC}  $1"; exit 1; }

# ---- Pre-flight checks ----
info "Running pre-flight checks..."

command -v aws >/dev/null 2>&1   || fail "AWS CLI not found. Install: https://aws.amazon.com/cli/"
command -v node >/dev/null 2>&1  || fail "Node.js not found. Install: https://nodejs.org/"
command -v npm >/dev/null 2>&1   || fail "npm not found. Install Node.js 18+."

aws sts get-caller-identity --region "$REGION" >/dev/null 2>&1 \
  || fail "AWS CLI not configured. Run: aws configure"

[ -f "$TEMPLATE_FILE" ] || fail "Template not found: $TEMPLATE_FILE (run from project root)"
[ -f "$SEED_FILE" ]     || fail "Seed file not found: $SEED_FILE"
[ -d "$FRONTEND_DIR" ]  || fail "Frontend directory not found: $FRONTEND_DIR"

success "Pre-flight checks passed."
echo ""

# ============================================================
# Step 1: Install backend dependencies
# ============================================================
info "Step 1/6 — Installing backend dependencies..."

cd backend && npm install --production --silent 2>&1 | tail -3
cd ..

success "Backend dependencies installed."
echo ""

# ============================================================
# Step 2: Deploy CloudFormation stack
# ============================================================
info "Step 2/6 — Deploying CloudFormation stack '${STACK_NAME}'..."
info "This may take 2–5 minutes on first deploy."

aws cloudformation deploy \
  --template-file "$TEMPLATE_FILE" \
  --stack-name "$STACK_NAME" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --region "$REGION" \
  --no-fail-on-empty-changeset

success "CloudFormation stack deployed."
echo ""

# ============================================================
# Step 3: Retrieve stack outputs
# ============================================================
info "Step 3/6 — Retrieving stack outputs..."

API_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiGatewayUrl'].OutputValue" \
  --output text)

S3_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='S3WebsiteUrl'].OutputValue" \
  --output text)

LAMBDA_ARN=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='LambdaFunctionArn'].OutputValue" \
  --output text)

# Extract bucket name from the S3 website URL
# Format: http://BUCKET.s3-website.REGION.amazonaws.com
BUCKET_NAME=$(echo "$S3_URL" | sed -E 's|https?://([^.]+)\.s3.*|\1|')

[ -n "$API_URL" ]    || fail "Could not retrieve ApiGatewayUrl from stack outputs."
[ -n "$S3_URL" ]     || fail "Could not retrieve S3WebsiteUrl from stack outputs."
[ -n "$BUCKET_NAME" ] || fail "Could not extract S3 bucket name."

success "Outputs retrieved:"
echo "       API URL:     $API_URL"
echo "       S3 Website:  $S3_URL"
echo "       Lambda ARN:  $LAMBDA_ARN"
echo "       S3 Bucket:   $BUCKET_NAME"
echo ""

# ============================================================
# Step 4: Seed DynamoDB
# ============================================================
info "Step 4/6 — Seeding DynamoDB table with legal mappings..."

aws dynamodb batch-write-item \
  --request-items "file://$SEED_FILE" \
  --region "$REGION" \
  > /dev/null

success "DynamoDB seeded with 6 category mappings."
echo ""

# ============================================================
# Step 5: Patch API URL into frontend
# ============================================================
info "Step 5/6 — Patching API URL into frontend..."

if grep -q "YOUR_API_GATEWAY_URL/analyze" "$FRONTEND_HTML"; then
  # macOS-compatible sed (uses '' for in-place with no backup)
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|YOUR_API_GATEWAY_URL/analyze|${API_URL}|g" "$FRONTEND_HTML"
  else
    sed -i "s|YOUR_API_GATEWAY_URL/analyze|${API_URL}|g" "$FRONTEND_HTML"
  fi
  success "API URL patched in $FRONTEND_HTML"
else
  warn "Placeholder not found — API URL may already be set. Skipping patch."
fi
echo ""

# ============================================================
# Step 6: Upload frontend to S3
# ============================================================
info "Step 6/6 — Uploading frontend to S3 bucket '${BUCKET_NAME}'..."

aws s3 sync "$FRONTEND_DIR/" "s3://${BUCKET_NAME}/" \
  --region "$REGION" \
  --delete \
  --cache-control "max-age=60" \
  | tail -10

success "Frontend uploaded to S3."
echo ""

# ============================================================
# Done!
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
success "🎉 Deployment complete!"
echo ""
echo "  🌐 Website:   $S3_URL"
echo "  🔗 API:       $API_URL"
echo "  λ  Lambda:    $LAMBDA_ARN"
echo ""
echo "  Open the website URL above in your browser to start."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
warn "⚠️  This tool provides awareness only — NOT legal advice."
