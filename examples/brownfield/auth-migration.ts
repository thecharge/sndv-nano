/**
 * Brownfield example: Migrating authentication from JWT to session tokens.
 *
 * Brownfield = changing an existing system. Constraints are tighter
 * because you can't break what already works.
 *
 * SMEP makes this safer: attack the riskiest assumptions first.
 * If any assumption breaks, all downstream work is automatically skipped.
 *
 * Run: bun run examples/brownfield/auth-migration.ts
 */
import { Protocol, summary, type TaskContextInterface } from "@thecharge/sndv-nano";

const protocol = new Protocol(
	{
		goal: "Migrate auth from JWT to session tokens",
		constraints: [
			"Zero downtime during migration",
			"No changes to mobile client API contract",
			"Must complete within one sprint",
			"Must support rollback at any point",
		],
	},
	{ maxIterations: 15 },
);

// Risk 0.95 — if the session store is too slow, nothing else matters
protocol.addTask(
	async (ctx: TaskContextInterface) => {
		const p99LatencyMs = 35.5; // deterministic example value

		ctx.evidence("p99_latency_ms", Math.round(p99LatencyMs * 10) / 10);
		ctx.evidence("benchmark_samples", 10_000);

		if (p99LatencyMs > 50) {
			ctx.falsify(`Session store too slow: ${p99LatencyMs.toFixed(1)}ms > 50ms`);
		}
	},
	{ name: "verify_session_latency", risk: 0.95 },
);

// Risk 0.8 — data integrity during dual-write is treacherous
protocol.addTask(
	async (ctx: TaskContextInterface) => {
		const racesDetected = 0; // simulate: no races found
		const staleReads = 0;

		ctx.evidence("races_detected", racesDetected);
		ctx.evidence("stale_reads", staleReads);

		if (racesDetected > 0) ctx.falsify(`Found ${racesDetected} race conditions`);
		if (staleReads > 0) ctx.falsify(`Found ${staleReads} stale reads`);
	},
	{ name: "verify_data_integrity", risk: 0.8 },
);

// Risk 0.5 — only matters if latency is OK
protocol.addTask(
	async (ctx: TaskContextInterface) => {
		const maxConnections = 100;
		const usedUnderLoad = 85;

		ctx.evidence("pool_max", maxConnections);
		ctx.evidence("pool_used_under_load", usedUnderLoad);

		if (usedUnderLoad >= maxConnections) {
			ctx.falsify(`Pool exhausted: ${usedUnderLoad}/${maxConnections}`);
		}
	},
	{
		name: "test_pool_pressure",
		risk: 0.5,
		dependsOn: ["verify_session_latency"],
	},
);

// Risk 0.3 — only if everything else survived
protocol.addTask(
	async (ctx: TaskContextInterface) => {
		const rollbackSuccess = true;
		const usersRecovered = 1000;

		ctx.evidence("rollback_success", rollbackSuccess);
		ctx.evidence("users_recovered", usersRecovered);

		if (!rollbackSuccess) ctx.falsify("Rollback failed");
	},
	{
		name: "validate_rollback",
		risk: 0.3,
		dependsOn: ["verify_session_latency", "verify_data_integrity", "test_pool_pressure"],
	},
);

const report = await protocol.execute();
console.log(summary(report));
