#!/usr/bin/env bash
# Calls Vercel cron routes from GitHub Actions (.github/workflows/scheduled-crons.yml).
#
#   scripts/ci/run-crons.sh <strict|lenient> /api/cron/<name> [/api/cron/<name> ...]
#
# Env: CRON_SECRET and VERCEL_APP_URL (GitHub secrets, both required).
#      CRON_CURL_MAX_TIME  per-call timeout in seconds (default 90).
#
# Every path is called, whatever happens to the previous one. A call fails on a curl error (timeout, DNS, TLS) or on any
# HTTP status that is not 2xx.
#   strict  (money crons)   -> `::error` annotation per failure and EXIT 1: the job and the run go red, and the workflow's
#                              `if: failure()` step (scripts/ci/notify-cron-failure.sh) alerts. A money cron never fails silently.
#   lenient (everything else) -> `::warning` annotation per failure, exit 0: one flaky housekeeping route does not hide the
#                              others, but the failure is on the run page and in the step summary instead of an `echo WARN`.
# No retry on purpose: a money route may still be running when curl gives up, a blind retry could overlap it. The next
# scheduled run is the retry.
#
# Outputs: `failed_routes=<comma separated paths>` in $GITHUB_OUTPUT, a table in $GITHUB_STEP_SUMMARY.
# Never prints the secret; the response body of a FAILED call is printed truncated, with control characters and `::`
# removed so that a response can not inject workflow commands into the log.

set -u

mode="${1:-}"
[ "$#" -gt 0 ] && shift

if [ "$mode" != "strict" ] && [ "$mode" != "lenient" ]; then
  echo "::error title=run-crons::the first argument must be 'strict' or 'lenient'"
  exit 2
fi
if [ "$#" -eq 0 ]; then
  echo "::error title=run-crons::no cron path given"
  exit 2
fi
if [ -z "${CRON_SECRET:-}" ] || [ -z "${VERCEL_APP_URL:-}" ]; then
  echo "::error title=Cron secrets missing::Set GitHub secrets CRON_SECRET and VERCEL_APP_URL"
  exit 1
fi

base="${VERCEL_APP_URL%/}"
max_time="${CRON_CURL_MAX_TIME:-90}"
body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT

failed=""
summary=""

for path in "$@"; do
  echo "-> GET ${path}"
  : > "$body_file"
  code="$(curl -sS --max-time "$max_time" -o "$body_file" -w '%{http_code}' \
    -H "Authorization: Bearer ${CRON_SECRET}" "${base}${path}")"
  rc=$?

  case "$code" in
    2??) http_ok=1 ;;
    *) http_ok=0 ;;
  esac

  if [ "$rc" -eq 0 ] && [ "$http_ok" -eq 1 ]; then
    echo "   ok (HTTP ${code})"
    summary="${summary}| \`${path}\` | ok (HTTP ${code}) |
"
    continue
  fi

  snippet="$(head -c 200 "$body_file" 2>/dev/null | tr -c '[:print:]' ' ' | sed 's/::/: :/g')"
  failed="${failed:+${failed},}${path}"
  summary="${summary}| \`${path}\` | **FAILED** (HTTP ${code}, curl exit ${rc}) |
"
  if [ "$mode" = "strict" ]; then
    echo "::error title=Money cron failed (${path})::HTTP ${code}, curl exit ${rc} ${snippet}"
  else
    echo "::warning title=Cron failed (${path})::HTTP ${code}, curl exit ${rc} ${snippet}"
  fi
done

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "failed_routes=${failed}" >> "$GITHUB_OUTPUT"
fi
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### Cron calls (${mode})"
    echo ""
    echo "| Route | Result |"
    echo "| --- | --- |"
    printf '%s' "$summary"
  } >> "$GITHUB_STEP_SUMMARY"
fi

if [ -n "$failed" ] && [ "$mode" = "strict" ]; then
  echo "::error title=Money crons failed::${failed}"
  exit 1
fi
exit 0
