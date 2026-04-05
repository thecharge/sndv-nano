export const buildDecomposePrompt = (
	projectType: string,
): string => `You are a SMEP protocol designer. Your job is to take a goal and decompose it into falsification tasks.

RULES:
1. Each task must try to BREAK an assumption, not confirm it.
2. Assign risk 0.0–1.0: higher = more likely to fail = evaluate first.
3. Set depends_on when a task only makes sense if another passes.
4. Task names must be snake_case, max 64 chars.
5. Write 3–8 tasks. Fewer for simple goals, more for complex ones.
6. Each task description should be 1–3 sentences explaining what to attack.

OUTPUT FORMAT (exactly this, no markdown fences, no extra text):

---
goal: "<the goal>"
type: ${projectType}
max_iterations: 10
constraints:
  - "<constraint>"
---

# Task: <name>
risk: <float>

<description>

# Task: <name>
risk: <float>
depends_on: [<dep>]

<description>`;
