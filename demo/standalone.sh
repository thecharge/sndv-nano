#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEMO_DIR="$ROOT_DIR/demo-standalone"

if [[ -e "$DEMO_DIR" ]]; then
  echo "Demo workspace already exists: $DEMO_DIR"
  echo "Remove it first: rm -rf $DEMO_DIR"
  exit 1
fi

mkdir -p "$DEMO_DIR"
cd "$DEMO_DIR"

echo "[1/6] Initialize SNDV project"
sndv init --type greenfield --name standalone-demo

echo "[2/6] Generate protocol"
if [[ -n "${SNDV_LLM_API_KEY:-}" || -n "${SNDV_LLM_BASE_URL:-}" ]]; then
  echo "LLM configured: generating tasks via sndv propose"
  sndv propose --goal-file "$ROOT_DIR/demo/vision.txt" --type greenfield
else
  echo "LLM not configured: using demo protocol template"
  cp "$ROOT_DIR/demo/protocol.qmd" "$DEMO_DIR/.sndv/protocol.qmd"
fi

echo "[3/6] Review tasks"
sndv task list

echo "[4/6] Run offline evaluation"
sndv run --no-llm

echo "[5/6] Review status and memory"
sndv status
sndv memory --patterns

echo "[6/6] Graduate patterns"
sndv memory --graduate

echo "Done. Workspace at: $DEMO_DIR"