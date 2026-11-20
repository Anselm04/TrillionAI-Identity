#!/usr/bin/env bash
# Offline-first, zero-hosting qualification for TrillionAI Identity.
# Never deploys, modifies Supabase or invokes external paid providers.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "[Identity] Local source qualification; no production actions"
node --version
npm --version

run_js() {
  local project="$1"
  echo "[Identity] Qualifying $project"
  cd "$ROOT/$project"
  if [[ ! -f package-lock.json ]]; then
    echo "[Identity] $project lockfile missing; generating locally (requires npm registry connectivity)"
    npm install --package-lock-only --ignore-scripts --no-audit --no-fund
  fi
  npm ci --no-audit --no-fund
  npm run check
  npm test
  npm run build
}
run_js backend
run_js web
if command -v flutter >/dev/null 2>&1; then
  echo "[Identity] Flutter SDK found; running Dart tests"
  cd "$ROOT/flutter"
  flutter pub get
  flutter analyze
  flutter test
else
  echo "[Identity] SKIPPED flutter analyze/test: Flutter SDK not installed"
  echo "[Identity] This run cannot certify the entire repository"
  exit 2
fi
echo "[Identity] Local build checks completed. Real Auth/SMTP/tenant integration is still separately required."
