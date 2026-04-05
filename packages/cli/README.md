# @thecharge/sndv-cli

CLI interface for SNDV — run SMEP protocols from the terminal.

## Commands

| Command | Description |
|---------|-------------|
| `sndv init <name>` | Scaffold a new SMEP project with protocol.qmd template |
| `sndv run` | Execute the protocol with LLM evaluation |
| `sndv run --no-llm` | Execute offline (no LLM calls) |
| `sndv run --dry-run` | Show task graph without executing |
| `sndv status` | Show hypothesis history and patterns |
| `sndv memory --patterns` | View institutional patterns |
| `sndv memory --graduate` | Extract patterns from repeated failures |
| `sndv memory --export <id>` | Export full context for LLM prompt injection |

## Usage

```bash
# Scaffold
bun run packages/cli/src/index.ts init my-project
cd my-project

# Edit .sndv/protocol.qmd with your tasks

# Run with local Ollama (default)
bun run packages/cli/src/index.ts run

# Run with OpenAI
SNDV_LLM_API_KEY=sk-... SNDV_LLM_BASE_URL=https://api.openai.com/v1 \
  bun run packages/cli/src/index.ts run

# Check results
bun run packages/cli/src/index.ts status
bun run packages/cli/src/index.ts memory --patterns
```
