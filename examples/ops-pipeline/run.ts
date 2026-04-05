/**
 * Example: Operations pipeline - Falsify a Kubernetes deployment plan.
 *
 * Before deploying to production, attack every assumption in the plan.
 * The Double Loop catches issues the planning phase missed.
 *
 * Run: bun run examples/ops-pipeline/run.ts
 */
import { DoubleLoop, type TaskContextInterface } from "@thecharge/sndv-nano";

const loop = new DoubleLoop(
	{
		goal: "Validate multi-region K8s deployment pipeline",
		constraints: ["Zero downtime", "Rollback <5min", "No data inconsistency", "SOC2 compliant"],
	},
	{ maxCycles: 2 },
);

// --- FALSIFY: attack the deployment plan ---

loop.addFalsify(
	async (ctx: TaskContextInterface) => {
		const healthCheckIntervalMs = 10_000;
		const canaryTrafficPercent = 5;
		const _errorRateThreshold = 0.01;
		const silentFailureModes = [
			"memory leak",
			"connection pool exhaustion",
			"gradual latency increase",
		];
		const detectable = [...silentFailureModes];

		ctx.evidence("health_check_interval_ms", healthCheckIntervalMs);
		ctx.evidence("canary_traffic_pct", canaryTrafficPercent);
		ctx.evidence("silent_failures_tested", silentFailureModes.length);
		ctx.evidence("detectable", detectable.length);

		if (detectable.length < silentFailureModes.length) {
			const missed = silentFailureModes.length - detectable.length;
			ctx.falsify(`${missed} failure mode(s) invisible to canary health checks`);
		}
	},
	{ name: "verify_canary_deployment", risk: 0.95 },
);

loop.addFalsify(
	async (ctx: TaskContextInterface) => {
		const imagePullS = 15;
		const podScheduleS = 10;
		const healthCheckS = 30;
		const trafficShiftS = 5;
		const dbRollbackS = 120;
		const totalS = imagePullS + podScheduleS + healthCheckS + trafficShiftS + dbRollbackS;

		ctx.evidence("rollback_breakdown_s", {
			imagePullS,
			podScheduleS,
			healthCheckS,
			trafficShiftS,
			dbRollbackS,
		});
		ctx.evidence("total_rollback_s", totalS);

		if (totalS > 300) {
			ctx.falsify(`Rollback takes ${totalS}s - exceeds 5 minute budget`);
		}
	},
	{ name: "verify_rollback_speed", risk: 0.9 },
);

loop.addFalsify(
	async (ctx: TaskContextInterface) => {
		const replicationLagMs = 150;
		const failoverDetectionMs = 5000;
		const inconsistencyWindowMs = replicationLagMs + failoverDetectionMs;

		ctx.evidence("replication_lag_ms", replicationLagMs);
		ctx.evidence("inconsistency_window_ms", inconsistencyWindowMs);

		if (inconsistencyWindowMs > 1000) {
			ctx.falsify(
				`${inconsistencyWindowMs}ms inconsistency window during failover - users see stale data`,
			);
		}
	},
	{ name: "verify_cross_region_consistency", risk: 0.85 },
);

// --- DELIVER: implement fixes ---

loop.addDeliver(
	async (ctx: TaskContextInterface) => {
		ctx.evidence("artifact", "enhanced-canary-config.yaml");
		ctx.evidence("changes", [
			"added memory monitoring",
			"added latency p99 check",
			"reduced interval to 5s",
		]);
	},
	{ name: "fix_canary_monitoring", dependsOn: ["verify_canary_deployment"] },
);

// --- VERIFY: attack the fixes ---

loop.addVerify(
	async (ctx: TaskContextInterface) => {
		const auditEvents = ["deploy", "rollback", "scale", "config-change"];
		const logged = auditEvents.filter(() => true);

		ctx.evidence("audit_events", auditEvents.length);
		ctx.evidence("logged", logged.length);

		if (logged.length < auditEvents.length) {
			ctx.falsify(
				`${auditEvents.length - logged.length} deploy actions not captured in audit trail`,
			);
		}
	},
	{ name: "verify_audit_trail", dependsOn: ["fix_canary_monitoring"] },
);

const _cycles = await loop.run();
console.log(loop.summarize());
