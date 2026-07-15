#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PORT="${PITCHFLOW_PORT:-3211}"
URL="http://127.0.0.1:${PORT}/"
OUTPUT="${PITCHFLOW_QA_OUTPUT:-artifacts/verification/2026-07-15-pitchflow/product-reset}"
LABEL="${PITCHFLOW_QA_LABEL:-local-public}"

env PITCHFLOW_PORT="$PORT" PITCHFLOW_PUBLIC_VIEWER=1 pnpm --filter @pitchflow/web dev &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

for _ in $(seq 1 120); do
  if curl --fail --silent --show-error --max-time 2 "${URL}api/status" >/dev/null; then
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    wait "$SERVER_PID"
  fi
  sleep 0.25
done

curl --fail --silent --show-error --max-time 5 "${URL}api/status" >/dev/null
pnpm exec tsx scripts/product-reset-browser-qa.ts --url "$URL" --output "$OUTPUT" --label "$LABEL"
