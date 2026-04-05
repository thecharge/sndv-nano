import { describe, expect, test } from "bun:test";
import { parseQmdString } from "@thecharge/sndv-qmd";

describe("QMD Parser", () => {
	// ===== Happy flows =====

	test("parses frontmatter with all fields", () => {
		const doc = parseQmdString(`---
goal: Ship it
type: greenfield
max_iterations: 10
constraints:
  - No downtime
  - No API changes
---

Body text.`);

		expect(doc.frontmatter.goal).toBe("Ship it");
		expect(doc.frontmatter.type).toBe("greenfield");
		expect(doc.frontmatter.max_iterations).toBe(10);
		expect(doc.frontmatter.constraints).toEqual(["No downtime", "No API changes"]);
	});

	test("parses tasks with risk and dependencies", () => {
		const doc = parseQmdString(`---
goal: Test
---

# Task: verify_api
risk: 0.9

Check backward compatibility.

# Task: run_tests
risk: 0.5
depends_on: [verify_api]

Run the full test suite.
`);

		expect(doc.tasks).toHaveLength(2);
		expect(doc.tasks[0].name).toBe("verify_api");
		expect(doc.tasks[0].risk).toBe(0.9);
		expect(doc.tasks[0].description).toContain("backward compatibility");
		expect(doc.tasks[1].dependsOn).toEqual(["verify_api"]);
	});

	// ===== Side flows =====

	test("handles empty document", () => {
		const doc = parseQmdString("");
		expect(doc.frontmatter).toEqual({});
		expect(doc.tasks).toHaveLength(0);
	});

	test("handles document with no frontmatter", () => {
		const doc = parseQmdString("# Task: solo\nrisk: 0.5\n\nJust one task.");
		expect(doc.tasks).toHaveLength(1);
		expect(doc.tasks[0].name).toBe("solo");
	});

	test("parses boolean values in frontmatter", () => {
		const doc = parseQmdString(`---
strict: true
draft: false
---`);
		expect(doc.frontmatter.strict).toBe(true);
		expect(doc.frontmatter.draft).toBe(false);
	});

	test("parses quoted string values", () => {
		const doc = parseQmdString(`---
goal: "Ship the feature"
---`);
		expect(doc.frontmatter.goal).toBe("Ship the feature");
	});

	// ===== Critical paths =====

	test("task with no risk defaults to 0.5", () => {
		const doc = parseQmdString(`---
goal: Test
---

# Task: no_risk_specified

Just a description.`);

		expect(doc.tasks[0].risk).toBe(0.5);
	});

	test("task with multiple dependencies", () => {
		const doc = parseQmdString(`---
goal: Test
---

# Task: final
risk: 0.3
depends_on: [a, b, c]

Depends on everything.`);

		expect(doc.tasks[0].dependsOn).toEqual(["a", "b", "c"]);
	});
});
