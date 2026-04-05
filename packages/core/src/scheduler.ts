import {
	type SchedulableTask,
	SmepErrors,
	TaskStatus,
	TERMINAL_STATUSES,
} from "@thecharge/sndv-config";

/** Validate the dependency graph: no missing deps, no cycles (Kahn's algorithm). */
export const validateGraph = (tasks: Map<string, SchedulableTask>): void => {
	const names = new Set(tasks.keys());

	for (const task of tasks.values()) {
		for (const depName of task.dependsOn) {
			if (!names.has(depName)) {
				throw SmepErrors.missingDependency(task.id, depName);
			}
		}
	}

	const inDegree = new Map<string, number>();
	const adjacencyList = new Map<string, string[]>();

	for (const taskName of names) {
		inDegree.set(taskName, 0);
		adjacencyList.set(taskName, []);
	}

	for (const task of tasks.values()) {
		for (const depName of task.dependsOn) {
			adjacencyList.get(depName)?.push(task.id);
			inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1);
		}
	}

	const zeroInDegreeQueue = [...names].filter((taskName) => inDegree.get(taskName) === 0);
	let visitedCount = 0;

	while (zeroInDegreeQueue.length > 0) {
		const currentNode = zeroInDegreeQueue.shift();
		if (currentNode === undefined) break;
		visitedCount++;
		for (const neighbor of adjacencyList.get(currentNode) ?? []) {
			const updatedDegree = (inDegree.get(neighbor) ?? 1) - 1;
			inDegree.set(neighbor, updatedDegree);
			if (updatedDegree === 0) zeroInDegreeQueue.push(neighbor);
		}
	}

	if (visitedCount !== names.size) throw SmepErrors.cycleDetected();
};

/** Return IDs of tasks that are pending with all deps verified — sorted by risk descending. */
export const readyTasks = (tasks: Map<string, SchedulableTask>): string[] => {
	const readyList: SchedulableTask[] = [];

	for (const task of tasks.values()) {
		if (task.status !== TaskStatus.PENDING) continue;
		const allDependenciesMet = task.dependsOn.every(
			(depName) => tasks.get(depName)?.status === TaskStatus.VERIFIED,
		);
		if (allDependenciesMet) readyList.push(task);
	}

	return readyList.sort((taskA, taskB) => taskB.risk - taskA.risk).map((task) => task.id);
};

/** Skip everything downstream of failed/errored tasks. Returns newly pruned IDs. */
export const propagatePruning = (tasks: Map<string, SchedulableTask>): string[] => {
	const prunedTaskIds: string[] = [];
	let hasChanges = true;

	while (hasChanges) {
		hasChanges = false;
		for (const task of tasks.values()) {
			if (task.status !== TaskStatus.PENDING) continue;
			const hasDeadUpstream = task.dependsOn.some((depName) =>
				TERMINAL_STATUSES.has(tasks.get(depName)?.status ?? TaskStatus.PENDING),
			);
			if (!hasDeadUpstream) continue;
			task.status = TaskStatus.SKIPPED;
			prunedTaskIds.push(task.id);
			hasChanges = true;
		}
	}

	return prunedTaskIds;
};
