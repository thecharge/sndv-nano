import { type ExecutionReport, REPORT_SEPARATOR, type TaskResult } from "@thecharge/sndv-config";

export const isVerified = (report: ExecutionReport): boolean => report.status === "verified";

/** Human-readable summary of the execution report. */
export const summary = (report: ExecutionReport): string => {
	const statusCounts = countByStatus(report.taskResults);

	const lines = [
		REPORT_SEPARATOR,
		"SMEP Execution Report",
		REPORT_SEPARATOR,
		`Goal:        ${report.hypothesisGoal}`,
		`Outcome:     ${report.status.toUpperCase()}`,
		`Iterations:  ${report.iterations}`,
		`Duration:    ${(report.totalDurationMs / 1000).toFixed(2)}s`,
		`Tasks:       ${report.taskResults.length}`,
		`  verified:  ${statusCounts.verified ?? 0}`,
		`  falsified: ${statusCounts.falsified ?? 0}`,
		`  errored:   ${statusCounts.errored ?? 0}`,
		`  skipped:   ${statusCounts.skipped ?? 0}`,
		REPORT_SEPARATOR,
	];

	if (report.constraints.length > 0) {
		lines.push("Constraints:");
		for (const constraintText of report.constraints) lines.push(`  · ${constraintText}`);
		lines.push("");
	}

	if (report.prunedPaths.length > 0) {
		lines.push("Pruned paths:");
		for (const prunedName of report.prunedPaths) lines.push(`  ✗ ${prunedName}`);
		lines.push("");
	}

	if (report.survivingPath.length > 0) {
		lines.push("Surviving path:");
		for (const survivingName of report.survivingPath) lines.push(`  ✓ ${survivingName}`);
	}

	return lines.join("\n");
};

const countByStatus = (results: TaskResult[]): Record<string, number> => {
	const counts: Record<string, number> = {};
	for (const result of results) {
		counts[result.status] = (counts[result.status] ?? 0) + 1;
	}
	return counts;
};
