#!/usr/bin/env bash
# Forbidden-pattern grep gate. Run in CI before any test suite to catch
# classes of bug that we never want to merge.
#
# Add new patterns here when a class of bug is identified. Use EXACT-MATCH
# regexes (not substring matches that false-positive on similar-looking
# safe code) — see docs/strategy/07-e2e-testing.md §"Phase 5".
#
# Exits 0 if clean, 1 if anything forbidden was found.

set -uo pipefail

EXIT=0

print_violation() {
  echo "──────────────────────────────────────────────────────────"
  echo "FORBIDDEN: $1"
  echo "──────────────────────────────────────────────────────────"
  echo "$2"
  echo
}

# ─── 1. medipyxis identity leak ───────────────────────────────────────────
# The medipyxis account is a separate company and must never appear in
# AuditHalo source. Docs intentionally reference the name to explain the
# rule itself, so docs/ is excluded from the scan.
matches=$(grep -rnE "medipyxis(man)?" src/ scripts/ e2e/ ci/ --exclude=forbidden-patterns.sh 2>/dev/null || true)
if [ -n "$matches" ]; then
  print_violation "'medipyxis' identity reference in tracked source" "$matches"
  EXIT=1
fi

# ─── 2. E2E test credentials hardcoded in production source ───────────────
# Test credentials must come from env vars only. The seed script
# (scripts/seed-e2e-users.ts) is allowed to reference the @audithalo.test
# email pattern since it CREATES them. Spec files in e2e/ are allowed too.
matches=$(grep -rnE "@audithalo\.test" src/ --exclude=forbidden-patterns.sh 2>/dev/null || true)
if [ -n "$matches" ]; then
  print_violation "@audithalo.test test email referenced in src/ — should be env var only" "$matches"
  EXIT=1
fi

# ─── 3. Skip-hook flags in committed code ─────────────────────────────────
# --no-verify in shell scripts means bypassing pre-commit / pre-push hooks.
# Should never be committed; if needed for emergency, use it interactively.
# Skip ci/ — that's where this gate lives and meta-discusses the pattern.
matches=$(grep -rn -- "--no-verify" .github/ scripts/ 2>/dev/null || true)
if [ -n "$matches" ]; then
  print_violation "--no-verify flag in committed scripts" "$matches"
  EXIT=1
fi

if [ $EXIT -eq 0 ]; then
  echo "✓ ci/forbidden-patterns.sh: no violations found."
fi

exit $EXIT
