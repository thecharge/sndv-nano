/**
 * Example: Customer support pipeline — Falsify an AI support system.
 *
 * Before deploying AI customer support, attack every assumption.
 * This uses the Double Loop with memory to learn across runs.
 *
 * Run: bun run examples/customer-support/run.ts
 */

import { MemoryRepository } from "@thecharge/sndv-memory";
import { DoubleLoop, type TaskContext } from "@thecharge/sndv-nano";

const hypothesisId = "ai-customer-support-v1";

// Load memory from previous runs (if any)
const mem = new MemoryRepository({ root: "/tmp/sndv-customer-support" });
await mem.init();
const priorContext = await mem.exportForLlm(hypothesisId);

if (priorContext !== "No prior context for this hypothesis.") {
	console.log("Loading prior context:");
	console.log(priorContext);
	console.log("---\n");
}

const loop = new DoubleLoop(
	{
		goal: "Validate AI customer support pipeline",
		constraints: [
			"Escalate to human in <30s when confidence <70%",
			"No policy hallucinations",
			"500 concurrent conversations",
			"CSAT >= 4.2/5.0",
			"Zero PII in logs",
		],
	},
	{ maxCycles: 2 },
);

// --- FALSIFY: attack the AI support plan ---

loop.addFalsify(
	async (ctx: TaskContext) => {
		const testCases = [
			{ query: "What's the refund policy for Product X?", productExists: false },
			{ query: "My warranty expired but I want replacement", policyChanged: true },
			{ query: "Do you price-match competitors?", noPolicyExists: true },
		];

		let hallucinations = 0;
		for (const tc of testCases) {
			const wouldHallucinate = tc.productExists === false || tc.noPolicyExists;
			if (wouldHallucinate) hallucinations++;
		}

		// Simulate: with RAG grounding, hallucinations drop
		const withRag = Math.max(0, hallucinations - 2);

		ctx.evidence("test_cases", testCases.length);
		ctx.evidence("raw_hallucinations", hallucinations);
		ctx.evidence("with_rag_grounding", withRag);

		if (withRag > 0) {
			ctx.falsify(`${withRag} hallucination(s) even with RAG grounding`);
		}
	},
	{ name: "verify_hallucination_guard", risk: 0.95 },
);

loop.addFalsify(
	async (ctx: TaskContext) => {
		const confidenceScoringMs = 50;
		const queueLookupMs = 100;
		const agentAvailCheckMs = 200;
		const contextHandoffMs = 500;
		const totalMs = confidenceScoringMs + queueLookupMs + agentAvailCheckMs + contextHandoffMs;

		ctx.evidence("escalation_breakdown_ms", {
			confidenceScoringMs,
			queueLookupMs,
			agentAvailCheckMs,
			contextHandoffMs,
		});
		ctx.evidence("total_escalation_ms", totalMs);

		if (totalMs > 30_000) {
			ctx.falsify(`Escalation takes ${totalMs}ms — exceeds 30s budget`);
		}
	},
	{ name: "verify_escalation_latency", risk: 0.9 },
);

loop.addFalsify(
	async (ctx: TaskContext) => {
		const piiFormats = [
			"4111-1111-1111-1111",
			"4111 1111 1111 1111",
			"411111111111",
			"123-45-6789",
			"123 45 6789",
			"+1 (555) 123-4567",
		];
		const scrubbed = piiFormats.filter(() => true);
		const missed = piiFormats.length - scrubbed.length;

		ctx.evidence("pii_formats_tested", piiFormats.length);
		ctx.evidence("scrubbed", scrubbed.length);
		ctx.evidence("missed", missed);

		if (missed > 0) {
			ctx.falsify(`PII scrubber missed ${missed} format(s) — compliance violation`);
		}
	},
	{ name: "verify_pii_handling", risk: 0.9 },
);

// --- DELIVER: implement the pipeline ---

loop.addDeliver(
	async (ctx: TaskContext) => {
		ctx.evidence("artifact", "support-pipeline-v1");
		ctx.evidence("components", [
			"RAG retriever",
			"confidence scorer",
			"PII scrubber",
			"escalation queue",
		]);
	},
	{ name: "build_pipeline", dependsOn: ["verify_hallucination_guard", "verify_pii_handling"] },
);

// --- VERIFY: attack what was built ---

loop.addVerify(
	async (ctx: TaskContext) => {
		const _sampleConversations = 100;
		const aiCsat = 4.3;
		const humanCsat = 4.5;
		const baseline = 4.2;

		ctx.evidence("ai_csat", aiCsat);
		ctx.evidence("human_csat", humanCsat);
		ctx.evidence("baseline", baseline);

		if (aiCsat < baseline) {
			ctx.falsify(`AI CSAT ${aiCsat} below ${baseline} baseline`);
		}
	},
	{ name: "verify_csat_impact", dependsOn: ["build_pipeline"] },
);

const cycles = await loop.run();
console.log(loop.summarize());

// Persist results to memory for next run
await mem.sessions.recordRun(hypothesisId, {
	goal: "Validate AI customer support pipeline",
	status: loop.status,
	durationMs: cycles.reduce((sum, c) => sum + c.durationMs, 0),
	iterations: cycles.length,
	survivingPath: [],
	prunedPaths: [],
	taskResults: cycles.flatMap((c) => Object.values(c.phaseReports).flatMap((r) => r.taskResults)),
});

console.log("\nResults saved to memory. Run again to see context accumulate.");
