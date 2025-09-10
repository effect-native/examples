#!/usr/bin/env bash

set -euo pipefail

# Pull latest commits from nkzw-tech/expo-app-template into templates/expo-app
# Preserves history via git subtree and filters out upstream's internal `templates/` dir.

# Config (override via env vars)
UPSTREAM_URL=${UPSTREAM_URL:-"https://github.com/nkzw-tech/expo-app-template.git"}
PREFIX=${PREFIX:-"templates/expo-app"}

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || { echo "Not a git repo" >&2; exit 1; })
cd "$ROOT"

if [ ! -d "$PREFIX" ]; then
  echo "Error: prefix '$PREFIX' does not exist in this repo." >&2
  echo "Hint: import it first, e.g. via git subtree add --prefix=$PREFIX ..." >&2
  exit 1
fi

# Stash local changes to avoid interference
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Stashing local changes..."
  git stash push -u -m "wip: stash before updating $PREFIX" >/dev/null 2>&1 || true
fi

TMPDIR=$(mktemp -d)
cleanup() { rm -rf "$TMPDIR" || true; }
trap cleanup EXIT

echo "Preparing filtered upstream..."
git clone --mirror "$UPSTREAM_URL" "$TMPDIR/upstream.git" >/dev/null
git clone "$TMPDIR/upstream.git" "$TMPDIR/work" >/dev/null

cd "$TMPDIR/work"

# Detect default branch
if DEFAULT_BRANCH=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null); then
  DEFAULT_BRANCH=${DEFAULT_BRANCH#origin/}
else
  DEFAULT_BRANCH=main
fi

# Filter out the upstream's internal templates directory from entire history
if git filter-repo --version >/dev/null 2>&1; then
  # Prefer git filter-repo if available (faster, safer)
  git filter-repo --quiet --path templates --invert-paths || true
else
  # Fallback to filter-branch
  git filter-branch -f --index-filter 'git rm -r --cached --ignore-unmatch templates' --prune-empty -- --all >/dev/null 2>&1 || true
  git for-each-ref --format='delete %(refname)' refs/original/ | git update-ref --stdin >/dev/null 2>&1 || true
  git reflog expire --expire=now --all >/dev/null 2>&1 || true
  git gc --prune=now --aggressive >/dev/null 2>&1 || true
fi

cd "$ROOT"

echo "Pulling latest upstream into '$PREFIX' via subtree..."
git subtree pull --prefix="$PREFIX" "$TMPDIR/work" "$DEFAULT_BRANCH" -m "chore(templates): update expo-app-template to latest (history preserved; upstream templates/ removed)"

echo "Done. Review the merge and push when ready."

