#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEMO_DIR="$ROOT_DIR/demo-copilot"

if [[ -e "$DEMO_DIR" ]]; then
  echo "Demo workspace already exists: $DEMO_DIR"
  echo "Remove it first: rm -rf $DEMO_DIR"
  exit 1
fi

mkdir -p "$DEMO_DIR"
cd "$DEMO_DIR"

echo "[1/7] Initialize SNDV project"
sndv init --type greenfield --name copilot-demo

echo "[2/7] Scaffold copilot instructions"
sndv scaffold copilot

echo "[3/7] Generate protocol"
if [[ -n "${SNDV_LLM_API_KEY:-}" || -n "${SNDV_LLM_BASE_URL:-}" ]]; then
  echo "LLM configured: generating tasks via sndv propose"
  sndv propose --goal-file "$ROOT_DIR/demo/vision.txt" --type greenfield
else
  echo "LLM not configured: using demo protocol template"
  cp "$ROOT_DIR/demo/protocol.qmd" "$DEMO_DIR/.sndv/protocol.qmd"
fi

echo "[4/7] Open in VS Code with Copilot"
echo "- Copilot reads .github/copilot-instructions.md"
echo "- Ask it to evaluate tasks in .sndv/protocol.qmd"

echo "[5/7] Record outcomes (offline)"
sndv run --no-llm

echo "[6/7] Review memory"
sndv status
sndv memory --patterns

echo "[7/7] Graduate patterns"
sndv memory --graduate

echo "Done. Workspace at: $DEMO_DIR"