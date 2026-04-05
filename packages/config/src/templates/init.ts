export const buildGreenfieldTemplate = (): string => `---
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

export const buildBrownfieldTemplate = (): string => `---
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
