#!/bin/sh
# tealtiger-scan.sh — Shared entrypoint for TealTiger CI/CD integrations
# All CI/CD integrations (GitHub Action, GitLab CI, CircleCI Orb) delegate to this script.
# Configuration is read from TEALTIGER_* environment variables.
#
# Exit codes:
#   0 — scan passed (no violations, or TEALTIGER_FAIL_ON_FINDING=false)
#   1 — scan found violations and TEALTIGER_FAIL_ON_FINDING=true
#   2 — invalid configuration (missing scan path, invalid values, CLI not found)

set -e

# ── Defaults ──────────────────────────────────────────────────────────────────
TEALTIGER_GUARDRAILS="${TEALTIGER_GUARDRAILS:-pii,prompt-injection,content-moderation}"
TEALTIGER_SENSITIVITY="${TEALTIGER_SENSITIVITY:-medium}"
TEALTIGER_FAIL_ON_FINDING="${TEALTIGER_FAIL_ON_FINDING:-true}"
TEALTIGER_REPORT_FORMAT="${TEALTIGER_REPORT_FORMAT:-json}"
TEALTIGER_REPORT_OUTPUT="${TEALTIGER_REPORT_OUTPUT:-./tealtiger-report}"

# ── Validation helpers ────────────────────────────────────────────────────────
error_exit() {
  echo "Error: $1" >&2
  exit 2
}

# ── Validate TEALTIGER_SCAN_PATH ──────────────────────────────────────────────
if [ -z "${TEALTIGER_SCAN_PATH}" ]; then
  error_exit "TEALTIGER_SCAN_PATH is required but not set or empty"
fi

if [ ! -e "${TEALTIGER_SCAN_PATH}" ]; then
  error_exit "Scan path does not exist: ${TEALTIGER_SCAN_PATH}"
fi

# ── Validate TEALTIGER_SENSITIVITY ────────────────────────────────────────────
case "${TEALTIGER_SENSITIVITY}" in
  low|medium|high) ;;
  *) error_exit "Invalid sensitivity '${TEALTIGER_SENSITIVITY}'. Must be low, medium, or high" ;;
esac

# ── Validate TEALTIGER_REPORT_FORMAT ──────────────────────────────────────────
case "${TEALTIGER_REPORT_FORMAT}" in
  json|junit|sarif) ;;
  *) error_exit "Invalid report format '${TEALTIGER_REPORT_FORMAT}'. Must be json, junit, or sarif" ;;
esac

# ── Validate TEALTIGER_GUARDRAILS ─────────────────────────────────────────────
remaining="${TEALTIGER_GUARDRAILS}"
while [ -n "${remaining}" ]; do
  # Extract the first guardrail (before the first comma)
  guardrail="${remaining%%,*}"

  # Trim leading/trailing whitespace
  guardrail=$(echo "${guardrail}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

  case "${guardrail}" in
    pii|prompt-injection|content-moderation) ;;
    *) error_exit "Invalid guardrail '${guardrail}'. Valid: pii, prompt-injection, content-moderation" ;;
  esac

  # Remove the processed guardrail from remaining
  if [ "${remaining}" = "${remaining#*,}" ]; then
    # No more commas — we're done
    break
  fi
  remaining="${remaining#*,}"
done

# ── Check TealTiger CLI availability ──────────────────────────────────────────
if ! npx tealtiger --version >/dev/null 2>&1; then
  error_exit "TealTiger CLI not found. Ensure you are running inside the TealTiger Docker image"
fi

# ── Create output directory ───────────────────────────────────────────────────
mkdir -p "${TEALTIGER_REPORT_OUTPUT}"

# ── Run guardrail scan ────────────────────────────────────────────────────────
scan_exit=0
npx tealtiger scan \
  --path "${TEALTIGER_SCAN_PATH}" \
  --guardrails "${TEALTIGER_GUARDRAILS}" \
  --sensitivity "${TEALTIGER_SENSITIVITY}" \
  --format "${TEALTIGER_REPORT_FORMAT}" \
  --output "${TEALTIGER_REPORT_OUTPUT}/scan-report" || scan_exit=$?

# ── Run policy test (if policy file is set) ───────────────────────────────────
policy_exit=0
if [ -n "${TEALTIGER_POLICY_FILE}" ]; then
  npx tealtiger test "${TEALTIGER_POLICY_FILE}" \
    --format "${TEALTIGER_REPORT_FORMAT}" \
    --output "${TEALTIGER_REPORT_OUTPUT}/policy-report" || policy_exit=$?
fi

# ── Merge exit codes and determine final result ──────────────────────────────
# Any non-zero exit from scan or policy means violations were found.
if [ "${scan_exit}" -ne 0 ] || [ "${policy_exit}" -ne 0 ]; then
  if [ "${TEALTIGER_FAIL_ON_FINDING}" = "true" ]; then
    exit 1
  fi
fi

exit 0
