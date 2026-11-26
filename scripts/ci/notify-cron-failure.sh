#!/usr/bin/env bash
# Alert step of a failed cron job — run it from a step with `if: failure()`.
#
#   scripts/ci/notify-cron-failure.sh
#
# Env: GITHUB_WORKFLOW, GITHUB_JOB, GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID (set by GitHub Actions),
#      FAILED_ROUTES (optional: the `failed_routes` output of scripts/ci/run-crons.sh),
#      CRON_SECRET and VERCEL_APP_URL (GitHub secrets; both optional here).
#
# 1. Always writes an `::error` annotation: the run is red and the annotation names the job, whatever happens next.
# 2. Then asks the app to post to Slack / Discord: POST ${VERCEL_APP_URL}/api/cron/notify-failure with the cron secret
#    (the app owns the webhook, SLACK_WEBHOOK_URL / DISCORD_WEBHOOK_URL on Vercel: no URL is copied into GitHub).
# TOLERANT by design: if the secrets are missing or the app is unreachable (it may be the very reason the cron failed) this
# step only warns and exits 0. The job is already failed by the step that failed; this step never changes that.

set -u

workflow="${GITHUB_WORKFLOW:-unknown workflow}"
job="${GITHUB_JOB:-unknown job}"
routes="${FAILED_ROUTES:-}"
run_url="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-unknown/unknown}/actions/runs/${GITHUB_RUN_ID:-0}"

echo "::error title=Cron job failed::${workflow} / ${job} failed${routes:+ (${routes})} - ${run_url}"

if [ -z "${CRON_SECRET:-}" ] || [ -z "${VERCEL_APP_URL:-}" ]; then
  echo "::warning title=Failure alert not sent::CRON_SECRET / VERCEL_APP_URL are not set; the red run and the annotation above are the only signal"
  exit 0
fi

payload="$(jq -nc \
  --arg workflow "$workflow" \
  --arg job "$job" \
  --arg route "$routes" \
  --arg runUrl "$run_url" \
  '{workflow: $workflow, job: $job, route: $route, runUrl: $runUrl}')"
if [ -z "$payload" ]; then
  echo "::warning title=Failure alert not sent::could not build the JSON payload (jq missing?)"
  exit 0
fi

base="${VERCEL_APP_URL%/}"
code="$(curl -sS --max-time 20 -o /dev/null -w '%{http_code}' \
  -X POST \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  --data "$payload" \
  "${base}/api/cron/notify-failure")"
rc=$?

case "$code" in
  2??) [ "$rc" -eq 0 ] && { echo "failure alert delivered (HTTP ${code})"; exit 0; } ;;
esac

echo "::warning title=Failure alert not delivered::POST /api/cron/notify-failure answered HTTP ${code} (curl exit ${rc}); the red run is the signal"
exit 0
