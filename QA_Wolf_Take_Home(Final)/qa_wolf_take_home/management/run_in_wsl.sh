#!/usr/bin/env bash
set -euo pipefail

# run_in_wsl.sh
# Helper to run the project's tests inside WSL/Linux.
# Place this script in the repository under management/ and run it from within WSL.
# Usage:
#   From WSL when the repo is on the Windows mount: bash /mnt/c/Users/Dell/Downloads/QA_Wolf_Take_Home(1)/qa_wolf_take_home/management/run_in_wsl.sh
#   Or copy the repo into WSL home and run: ./management/run_in_wsl.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Repository root (WSL view): $REPO_ROOT"
cd "$REPO_ROOT"

echo "Checking Node and npm versions..."
node --version || { echo "Node is not installed in WSL. Install Node (e.g. via nvm or apt) and re-run."; exit 1; }
npm --version || { echo "npm is not available; ensure Node/npm are installed."; exit 1; }

# Install dependencies using npm ci if possible. Fall back to npm install.
if [ -f package-lock.json ]; then
  echo "Installing dependencies with npm ci..."
  npm ci || npm install
else
  echo "Installing dependencies with npm install..."
  npm install
fi

# Playwright browsers: optional but recommended. Skip by setting SKIP_PW=1
if [ "${SKIP_PW:-0}" != "1" ]; then
  echo "Installing Playwright browsers (this may take a while)..."
  # --with-deps is helpful on some Linux systems; try it first, fall back to normal install
  npx playwright install --with-deps || npx playwright install || true
else
  echo "Skipping Playwright browsers installation (SKIP_PW=1)"
fi

# Run the node built-in test runner over the test folder
echo "Running tests: node --test ./test/*.test.js"
node --test ./test/*.test.js

EXIT_CODE=$?

echo "Tests completed with exit code: $EXIT_CODE"
exit $EXIT_CODE
