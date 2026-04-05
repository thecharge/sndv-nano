import { beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { QmdKnowledgeGraph } from "../src/graph";
import { parseQmdString } from "../src/parser";

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

describe("parseQmdString", () => {
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

// ---------------------------------------------------------------------------
// Knowledge Graph
// ---------------------------------------------------------------------------

const SAMPLE_QMD_A = `---
goal: Auth migration
type: brownfield
constraints:
  - Zero downtime
  - No API changes
---

# Task: verify_session_latency
risk: 0.95

Check session store latency.

# Task: verify_data_integrity
risk: 0.8

Check dual-write consistency.
`;

const SAMPLE_QMD_B = `---
goal: Feature flag system
type: greenfield
---

# Task: verify_toggle_speed
risk: 0.9

Benchmark flag evaluation latency.

# Task: verify_rollout_safety
risk: 0.7
depends_on: [verify_toggle_speed]

Test gradual rollout.
`;

const SAMPLE_QMD_C = `---
goal: Deploy pipeline
type: brownfield
---

# Task: verify_canary
risk: 0.95
depends_on: [verify_session_latency]

Canary deployment verification (cross-doc dep).
`;

describe("QmdKnowledgeGraph", () => {
	let graph: QmdKnowledgeGraph;

	beforeEach(() => {
		graph = new QmdKnowledgeGraph();
	});

	// --- Index & Retrieval ---

	test("adds and retrieves documents", () => {
		graph.addDocument("auth.qmd", SAMPLE_QMD_A);
		graph.addDocument("flags.qmd", SAMPLE_QMD_B);

		expect(graph.size).toBe(2);
		const authNode = graph.getDocument("auth.qmd");
		expect(authNode?.document.frontmatter.goal).toBe("Auth migration");
	});

	test("removes documents", () => {
		graph.addDocument("auth.qmd", SAMPLE_QMD_A);
		expect(graph.removeDocument("auth.qmd")).toBe(true);
		expect(graph.size).toBe(0);
		expect(graph.getDocument("auth.qmd")).toBeUndefined();
	});

	test("finds document by task name", () => {
		graph.addDocument("auth.qmd", SAMPLE_QMD_A);
		graph.addDocument("flags.qmd", SAMPLE_QMD_B);

		const result = graph.findDocumentByTask("verify_toggle_speed");
		expect(result?.id).toBe("flags.qmd");
	});

	test("lists all documents", () => {
		graph.addDocument("auth.qmd", SAMPLE_QMD_A);
		graph.addDocument("flags.qmd", SAMPLE_QMD_B);

		const allDocs = graph.getAllDocuments();
		expect(allDocs).toHaveLength(2);
	});

	// --- Cross-document edges ---

	test("detects cross-document dependencies", () => {
		graph.addDocument("auth.qmd", SAMPLE_QMD_A);
		graph.addDocument("deploy.qmd", SAMPLE_QMD_C);

		const edges = graph.allEdges;
		expect(edges).toHaveLength(1);
		expect(edges[0].from).toBe("deploy.qmd");
		expect(edges[0].to).toBe("auth.qmd");
		expect(edges[0].sourceTask).toBe("verify_canary");
		expect(edges[0].targetTask).toBe("verify_session_latency");
	});

	test("getDependents returns downstream documents", () => {
		graph.addDocument("auth.qmd", SAMPLE_QMD_A);
		graph.addDocument("deploy.qmd", SAMPLE_QMD_C);

		const dependents = graph.getDependents("auth.qmd");
		expect(dependents).toHaveLength(1);
		expect(dependents[0].id).toBe("deploy.qmd");
	});

	test("getDependencies returns upstream documents", () => {
		graph.addDocument("auth.qmd", SAMPLE_QMD_A);
		graph.addDocument("deploy.qmd", SAMPLE_QMD_C);

		const deps = graph.getDependencies("deploy.qmd");
		expect(deps).toHaveLength(1);
		expect(deps[0].id).toBe("auth.qmd");
	});

	// --- Search ---

	test("text search matches goal", () => {
		graph.addDocument("auth.qmd", SAMPLE_QMD_A);
		graph.addDocument("flags.qmd", SAMPLE_QMD_B);

		const results = graph.search({ text: "Auth migration" });
		expect(results.length).toBeGreaterThan(0);
		expect(results[0].node.id).toBe("auth.qmd");
		expect(results[0].matchedFields).toContain("text");
	});

	test("text search matches task names", () => {
		graph.addDocument("auth.qmd", SAMPLE_QMD_A);
		graph.addDocument("flags.qmd", SAMPLE_QMD_B);

		const results = graph.search({ text: "toggle_speed" });
		expect(results.length).toBeGreaterThan(0);
		expect(results[0].node.id).toBe("flags.qmd");
	});

	test("frontmatter search matches exact values", () => {
		graph.addDocument("auth.qmd", SAMPLE_QMD_A);
		graph.addDocument("flags.qmd", SAMPLE_QMD_B);

		const results = graph.search({ frontmatter: { type: "brownfield" } });
		expect(results.length).toBe(1);
		expect(results[0].node.id).toBe("auth.qmd");
	});

	test("taskName search finds documents containing that task", () => {
		graph.addDocument("auth.qmd", SAMPLE_QMD_A);
		graph.addDocument("flags.qmd", SAMPLE_QMD_B);

		const results = graph.search({ taskName: "verify_data" });
		expect(results.length).toBe(1);
		expect(results[0].node.id).toBe("auth.qmd");
	});

	test("minRisk search filters by task risk", () => {
		graph.addDocument("auth.qmd", SAMPLE_QMD_A);
		graph.addDocument("flags.qmd", SAMPLE_QMD_B);

		const results = graph.search({ minRisk: 0.95 });
		expect(results.length).toBe(1);
		expect(results[0].node.id).toBe("auth.qmd");
	});

	test("tag search matches document tags", () => {
		graph.addDocument("auth.qmd", SAMPLE_QMD_A);
		graph.addDocument("flags.qmd", SAMPLE_QMD_B);

		const results = graph.search({ tags: ["brownfield"] });
		expect(results.length).toBe(1);
		expect(results[0].node.id).toBe("auth.qmd");
	});

	test("combined search scores multiple criteria", () => {
		graph.addDocument("auth.qmd", SAMPLE_QMD_A);
		graph.addDocument("flags.qmd", SAMPLE_QMD_B);

		const results = graph.search({
			text: "migration",
			frontmatter: { type: "brownfield" },
		});
		expect(results.length).toBeGreaterThan(0);
		expect(results[0].node.id).toBe("auth.qmd");
		expect(results[0].score).toBeGreaterThan(0);
	});

	test("search with no filters returns all documents", () => {
		graph.addDocument("auth.qmd", SAMPLE_QMD_A);
		graph.addDocument("flags.qmd", SAMPLE_QMD_B);

		const results = graph.search({});
		expect(results).toHaveLength(2);
	});

	test("search respects limit", () => {
		graph.addDocument("auth.qmd", SAMPLE_QMD_A);
		graph.addDocument("flags.qmd", SAMPLE_QMD_B);
		graph.addDocument("deploy.qmd", SAMPLE_QMD_C);

		const results = graph.search({ limit: 1 });
		expect(results).toHaveLength(1);
	});

	// --- Persistence ---

	test("saves and loads index", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "qmd-graph-"));
		const indexPath = join(tempDir, "index.json");

		graph.addDocument("auth.qmd", SAMPLE_QMD_A);
		graph.addDocument("flags.qmd", SAMPLE_QMD_B);
		await graph.saveIndex(indexPath);

		const loadedGraph = new QmdKnowledgeGraph();
		await loadedGraph.loadIndex(indexPath);

		expect(loadedGraph.size).toBe(2);
		expect(loadedGraph.getDocument("auth.qmd")?.document.frontmatter.goal).toBe("Auth migration");
	});

	// --- Directory indexing ---

	test("indexes directory of .qmd files", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "qmd-dir-"));

		await writeFile(join(tempDir, "auth.qmd"), SAMPLE_QMD_A);
		await writeFile(join(tempDir, "flags.qmd"), SAMPLE_QMD_B);
		await mkdir(join(tempDir, "sub"));
		await writeFile(join(tempDir, "sub", "deploy.qmd"), SAMPLE_QMD_C);

		const indexed = await graph.indexDirectory(tempDir);
		expect(indexed).toBe(3);
		expect(graph.size).toBe(3);

		// Verify relative path ids
		expect(graph.getDocument("auth.qmd")).toBeDefined();
		expect(graph.getDocument(join("sub", "deploy.qmd"))).toBeDefined();
	});
});
