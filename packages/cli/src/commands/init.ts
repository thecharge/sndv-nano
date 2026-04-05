import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_MAX_SHORT_TERM_ENTRIES, ProjectType, SNDV_DIR_NAME } from "@thecharge/sndv-config";

const GREENFIELD_TEMPLATE = `---
goal: "Your goal here"
type: greenfield
max_iterations: 10
constraints:
  - "Constraint 1"
  - "Constraint 2"
---

# Task: verify_assumption
risk: 0.9

Describe what you're trying to break here.

# Task: integration_check
risk: 0.5
depends_on: [verify_assumption]

Verify integration after the main assumption holds.
`;

const BROWNFIELD_TEMPLATE = `---
goal: "Migrate/refactor your existing system"
type: brownfield
max_iterations: 15
constraints:
  - "Zero downtime"
  - "No breaking changes to public API"
  - "Must be backwards compatible"
---

# Task: verify_compatibility
risk: 0.95

Try to break backwards compatibility with existing consumers.

# Task: verify_data_integrity
risk: 0.8

Try to break data integrity during migration.

# Task: verify_rollback
risk: 0.6
depends_on: [verify_compatibility, verify_data_integrity]

Verify the rollback path works if anything goes wrong.
`;

export interface InitOpts {
	projectDir: string;
	type: ProjectType;
	name?: string;
}

/** Initialize a new SMEP project. Creates config dir and template QMD. */
export const init = async (opts: InitOpts): Promise<string> => {
	const sndvDir = join(opts.projectDir, SNDV_DIR_NAME);
	await mkdir(sndvDir, { recursive: true });
	await mkdir(join(sndvDir, "long-term"), { recursive: true });

	const template = opts.type === ProjectType.BROWNFIELD ? BROWNFIELD_TEMPLATE : GREENFIELD_TEMPLATE;
	const qmdPath = join(sndvDir, "protocol.qmd");
	await writeFile(qmdPath, template, "utf-8");

	const config = {
		name: opts.name ?? "my-project",
		type: opts.type,
		memoryDir: SNDV_DIR_NAME,
		maxShortTermEntries: DEFAULT_MAX_SHORT_TERM_ENTRIES,
	};
	await writeFile(join(sndvDir, "config.json"), JSON.stringify(config, null, 2), "utf-8");

	return qmdPath;
};
