export const buildClaudeInstructions = (
	projectName: string,
): string => `## SNDV Protocol - ${projectName}

This project uses SNDV for falsification-first structured execution.
You are the evaluator - do not call \`sndv run\` (that invokes a second LLM).

### Before building

1. Run \`sndv status\` to check hypothesis state and prior runs
2. Run \`sndv memory --patterns\` to see what has failed before - avoid those
3. Read \`.sndv/protocol.qmd\` to see tasks ordered by risk

### Workflow

- Work through tasks in risk order (highest risk first)
- For each task, try to BREAK the assumption - not confirm it
- If you falsify a task, skip all tasks that depend on it
- Build only what survives falsification
- After finishing, run \`sndv memory --graduate\` to extract patterns

### Creating a new protocol

If no \`.sndv/\` directory exists, run \`sndv init\` first.
Edit \`.sndv/protocol.qmd\` to define your goal, constraints, and tasks.
Each task needs a \`risk\` score (0.0–1.0) and a description of what to try to break.

### Recording results

Run \`sndv run --no-llm\` to record the protocol execution offline.
Run \`sndv memory --graduate\` to extract institutional patterns.
`;

export const buildCopilotInstructions = (): string => `## SNDV Protocol

This project uses SNDV for structured falsification-first execution.
SNDV is installed globally via \`bun link\` from the sndv-nano repository.

### Commands

- \`sndv status\` - show hypothesis state and run history
- \`sndv memory --patterns\` - list recurring failure patterns (avoid repeating these)
- \`sndv memory --export <id>\` - export full context for a hypothesis
- \`sndv run --no-llm\` - record protocol execution offline (no LLM call)
- \`sndv memory --graduate\` - extract patterns from session data

### Workflow

1. Run \`sndv status\` first
2. Run \`sndv memory --patterns\` to see past failures
3. Read \`.sndv/protocol.qmd\` for task list ordered by risk
4. For each task (highest risk first), try to falsify the assumption
5. Build only what survives
6. Run \`sndv memory --graduate\` when done

### Creating a protocol

Run \`sndv init\` to create \`.sndv/protocol.qmd\`, then edit it with your goal, constraints, and tasks.

Do NOT run \`sndv run\` - that calls a second LLM. You are the evaluator.
`;

export const buildAgentsInstructions = (): string => `## SNDV Protocol

This project uses SNDV for structured falsification-first execution.
SNDV is installed globally (\`sndv\` command available in shell).

### Before building

1. \`sndv status\` - check hypothesis state
2. \`sndv memory --patterns\` - see repeated failures (do NOT repeat these)
3. Read \`.sndv/protocol.qmd\` - tasks ordered by risk

### Workflow

- Work tasks in risk order, highest first
- Try to BREAK each assumption, not confirm it
- Skip dependent tasks if a task is falsified
- Build only what survives
- \`sndv memory --graduate\` when finished

### Creating a protocol

If \`.sndv/\` does not exist: \`sndv init --type greenfield --name my-project\`
Edit \`.sndv/protocol.qmd\` with your goal, constraints, and risk-ordered tasks.

### Recording

- \`sndv run --no-llm\` - record execution offline
- \`sndv memory --graduate\` - extract patterns from sessions

Do NOT run \`sndv run\` (calls a second LLM - you are the evaluator).
`;
