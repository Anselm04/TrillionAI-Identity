#!/usr/bin/env bash
# Offline-first, zero-hosting qualification for TrillionAI Identity.
# Never deploys, modifies Supabase or invokes external paid providers.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "[Identity] Local source qualification; no production actions"
test "$(node --version)" = v22.23.5
test "$(npm --version)" = 10.9.9
node --version
npm --version
cd "$ROOT"
for lock in backend/package-lock.json web/package-lock.json flutter/pubspec.lock; do
  test -f "$lock"
  git ls-files --error-unmatch -- "$lock" >/dev/null
done
git diff --exit-code HEAD -- backend/package-lock.json web/package-lock.json flutter/pubspec.lock

run_js() {
  local project="$1"
  echo "[Identity] Qualifying $project"
  cd "$ROOT/$project"
  if [[ "$project" == "backend" ]]; then
    npm ci --ignore-scripts --no-audit --no-fund
  else
    npm ci --no-audit --no-fund
  fi
  npm run check
  if [[ "$project" == "backend" ]]; then
    npm run test:offline
  fi
  npm test
  npm run build
  git diff --exit-code HEAD -- package-lock.json
}
echo "[Identity] Qualifying OAuth PKCE SDK"
node --experimental-strip-types --test "$ROOT/sdk/test/oauth.test.mts"
run_js backend
run_js web
if command -v flutter >/dev/null 2>&1; then
  echo "[Identity] Flutter SDK found; running Dart tests"
  cd "$ROOT/flutter"
  flutter --version --machine | node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{const v=JSON.parse(s);if(v.frameworkVersion!=="3.50.1"||v.dartSdkVersion!=="3.14.0")process.exitCode=1;});'
  flutter pub get --enforce-lockfile
  flutter analyze --no-fatal-infos
  flutter test
else
  echo "[Identity] SKIPPED flutter analyze/test: Flutter SDK not installed"
  echo "[Identity] This run cannot certify the entire repository"
  exit 2
fi
cd "$ROOT"
git diff --exit-code HEAD -- backend/package-lock.json web/package-lock.json flutter/pubspec.lock
echo "[Identity] Local build checks completed. Disposable PostgreSQL qualification is separate: scripts/qualify-recovery-postgres.sh. Real Auth/SMTP/tenant integration is still separately required."
