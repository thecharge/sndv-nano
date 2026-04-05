/**
 * Example: PRD Review — Falsify a product requirements document.
 *
 * Instead of rubber-stamping a PRD, SMEP attacks every assumption.
 * Tasks with high risk try hardest to break the plan.
 * What survives is what you can actually build.
 *
 * Run: bun run examples/prd-review/run.ts
 */
import { DoubleLoop, type TaskContextInterface } from "@thecharge/sndv-nano";

const loop = new DoubleLoop(
	{
		goal: "Evaluate PRD for real-time collaboration",
		constraints: ["100 concurrent users", "<200ms latency", "offline support", "no data loss"],
	},
	{ maxCycles: 3 },
);

// --- FALSIFY: attack the plan ---

loop.addFalsify(
	async (ctx: TaskContextInterface) => {
		const maxEditors = 100;
		const crdtMemoryPerUserMb = 2.5;
		const totalMemoryMb = maxEditors * crdtMemoryPerUserMb;

		ctx.evidence("memory_per_user_mb", crdtMemoryPerUserMb);
		ctx.evidence("total_memory_mb", totalMemoryMb);

		if (totalMemoryMb > 200) {
			ctx.falsify(`CRDT memory grows to ${totalMemoryMb}MB for ${maxEditors} users — unacceptable`);
		}
	},
	{ name: "verify_concurrency_model", risk: 0.95 },
);

loop.addFalsify(
	async (ctx: TaskContextInterface) => {
		const serializationMs = 15;
		const networkMs = 50;
		const conflictResolutionMs = 30;
		const renderMs = 20;
		const totalMs = serializationMs + networkMs + conflictResolutionMs + renderMs;

		ctx.evidence("latency_breakdown", {
			serializationMs,
			networkMs,
			conflictResolutionMs,
			renderMs,
		});
		ctx.evidence("total_latency_ms", totalMs);

		if (totalMs > 200) {
			ctx.falsify(`Total latency ${totalMs}ms exceeds 200ms budget`);
		}
	},
	{ name: "verify_latency_budget", risk: 0.9 },
);

// --- DELIVER: build what survived ---

loop.addDeliver(
	async (ctx: TaskContextInterface) => {
		ctx.evidence("artifact", "crdt-engine-v1");
		ctx.evidence("implementation", "Yjs-based CRDT with WebSocket transport");
	},
	{ name: "implement_crdt_engine", dependsOn: ["verify_concurrency_model"] },
);

// --- VERIFY: attack what was built ---

loop.addVerify(
	async (ctx: TaskContextInterface) => {
		const offlineEdits = 50;
		const _onlineEdits = 30;
		const conflictsDetected = 3;
		const conflictsResolved = 3;

		ctx.evidence("offline_edits", offlineEdits);
		ctx.evidence("conflicts", { detected: conflictsDetected, resolved: conflictsResolved });

		if (conflictsResolved < conflictsDetected) {
			ctx.falsify(`${conflictsDetected - conflictsResolved} conflicts unresolved — data loss risk`);
		}
	},
	{ name: "verify_offline_sync", dependsOn: ["implement_crdt_engine"] },
);

const cycles = await loop.run();
console.log(loop.summarize());
console.log(`\nCompleted in ${cycles.length} cycle(s)`);
