# @thecharge/sndv-cli

CLI for SNDV. Create protocols, generate tasks, run evaluations, and manage memory from the terminal.

## Commands

| Command | Description |
|---|---|
| `sndv init` | Scaffold a new SMEP project (`.sndv/` and `protocol.qmd`) |
| `sndv run` | Execute the protocol with LLM evaluation |
| `sndv run --no-llm` | Execute offline (no LLM calls) |
| `sndv run --dry-run` | Show task graph without executing |
| `sndv status` | Show hypothesis history and patterns |
| `sndv memory --patterns` | View institutional patterns |
| `sndv memory --graduate` | Extract patterns from repeated failures |
| `sndv memory --export <id>` | Export full context for LLM prompt injection |
| `sndv task` | List, add, or remove tasks in `protocol.qmd` |
| `sndv protocol` | List, archive, or restore protocols |
| `sndv propose` | Ask the LLM to generate falsification tasks from a goal |
| `sndv scaffold` | Generate agent instruction files |
| `sndv completion` | Generate shell completion scripts |
| `sndv link` | Create a user-level symlink for the CLI |

## Usage (from source)

```bash
bun run packages/cli/src/index.ts --help

# Scaffold
bun run packages/cli/src/index.ts init --type greenfield --name my-project
cd my-project

# Run with local Ollama (default)
bun run packages/cli/src/index.ts run

# Run with OpenAI
SNDV_LLM_API_KEY=sk-... SNDV_LLM_BASE_URL=https://api.openai.com/v1 \
  bun run packages/cli/src/index.ts run

# Check results
bun run packages/cli/src/index.ts status
bun run packages/cli/src/index.ts memory --patterns
```

## Install locally (symlink)

```bash
bun run build
bun run packages/cli/src/index.ts link
sndv --help
```

Custom path:

```bash
bun run packages/cli/src/index.ts link --path ~/bin/sndv
```
