#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-worldcup-sweepstake-2026}"
ALERT_EMAIL="${2:-}"
CHANNEL_DISPLAY_NAME="${3:-World Cup Ingest Ops Email}"
POLICY_DISPLAY_NAME="World Cup ingestLiveScores failures"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POLICY_TEMPLATE="${SCRIPT_DIR}/ingest-failure-alert-policy.json"

if [[ -z "${ALERT_EMAIL}" ]]; then
  cat <<USAGE
Usage:
  bash ops/monitoring/setup-ingest-alerting.sh <project_id> <alert_email> [channel_display_name]

Example:
  bash ops/monitoring/setup-ingest-alerting.sh worldcup-sweepstake-2026 ops@company.com
USAGE
  exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "ERROR: gcloud CLI is required. Install it first, then rerun." >&2
  exit 1
fi

ACTIVE_ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -n 1 || true)"
if [[ -z "${ACTIVE_ACCOUNT}" ]]; then
  echo "ERROR: No active gcloud account. Run: gcloud auth login" >&2
  exit 1
fi

if [[ ! -f "${POLICY_TEMPLATE}" ]]; then
  echo "ERROR: Missing policy template at ${POLICY_TEMPLATE}" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

CHANNEL_FILE="${TMP_DIR}/notification-channel.json"
cat > "${CHANNEL_FILE}" <<JSON
{
  "type": "email",
  "displayName": "${CHANNEL_DISPLAY_NAME}",
  "labels": {
    "email_address": "${ALERT_EMAIL}"
  },
  "enabled": true
}
JSON

echo "[1/4] Resolving notification channel for ${ALERT_EMAIL}..."
CHANNEL_NAME="$(gcloud beta monitoring channels list \
  --project="${PROJECT_ID}" \
  --filter="type=\"email\" AND labels.email_address=\"${ALERT_EMAIL}\"" \
  --format='value(name)' \
  --limit=1)"

if [[ -z "${CHANNEL_NAME}" ]]; then
  CHANNEL_NAME="$(gcloud beta monitoring channels create \
    --project="${PROJECT_ID}" \
    --channel-content-from-file="${CHANNEL_FILE}" \
    --format='value(name)')"
  echo "Created notification channel: ${CHANNEL_NAME}"
else
  echo "Reusing existing notification channel: ${CHANNEL_NAME}"
fi

POLICY_FILE="${TMP_DIR}/alert-policy.json"
sed \
  -e "s|__PROJECT_ID__|${PROJECT_ID}|g" \
  -e "s|__NOTIFICATION_CHANNEL__|${CHANNEL_NAME}|g" \
  "${POLICY_TEMPLATE}" > "${POLICY_FILE}"

echo "[2/4] Resolving alert policy..."
POLICY_NAME="$(gcloud monitoring policies list \
  --project="${PROJECT_ID}" \
  --filter="displayName=\"${POLICY_DISPLAY_NAME}\"" \
  --format='value(name)' \
  --limit=1)"

if [[ -z "${POLICY_NAME}" ]]; then
  POLICY_NAME="$(gcloud monitoring policies create \
    --project="${PROJECT_ID}" \
    --policy-from-file="${POLICY_FILE}" \
    --format='value(name)')"
  echo "Created alert policy: ${POLICY_NAME}"
else
  POLICY_NAME="$(gcloud monitoring policies update "${POLICY_NAME}" \
    --project="${PROJECT_ID}" \
    --policy-from-file="${POLICY_FILE}" \
    --format='value(name)')"
  echo "Updated alert policy: ${POLICY_NAME}"
fi

echo "[3/4] Setup complete."
echo "  PROJECT_ID=${PROJECT_ID}"
echo "  NOTIFICATION_CHANNEL=${CHANNEL_NAME}"
echo "  ALERT_POLICY=${POLICY_NAME}"

echo "[4/4] Synthetic alert test command:"
echo "  gcloud logging write ingestLiveScores-test \"[ingest] scheduled ingest failed: synthetic test\" --severity=ERROR --project=${PROJECT_ID}"

echo "Then check Cloud Monitoring incidents and your email notification channel."
