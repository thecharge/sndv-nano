import { join } from "node:path";
import { buildSystemPrompt, LlmClient } from "@thecharge/sndv-adapter";
import { type QmdTask, SNDV_DIR_NAME, type TaskFn, VerdictStatus } from "@thecharge/sndv-config";
import { MemoryRepository } from "@thecharge/sndv-memory";
import { Protocol, summary } from "@thecharge/sndv-nano";
import { parseQmd } from "@thecharge/sndv-qmd";
import type { Command } from "./command";

export interface RunOpts {
	projectDir: string;
	qmdPath?: string;
	dryRun?: boolean;
	noLlm?: boolean;
}

/** Load protocol from QMD and execute - with LLM by default. */
export class RunCommand implements Command {
	private readonly projectDir: string;
	private readonly qmdPath?: string;
	private readonly dryRun?: boolean;
	private readonly noLlm?: boolean;

	constructor(opts: RunOpts) {
		this.projectDir = opts.projectDir;
		this.qmdPath = opts.qmdPath;
		this.dryRun = opts.dryRun;
		this.noLlm = opts.noLlm;
	}

	execute = async (): Promise<string> => {
		const qmdPath = this.qmdPath ?? join(this.projectDir, SNDV_DIR_NAME, "protocol.qmd");
		const document = await parseQmd(qmdPath);

		const goal = String(document.frontmatter.goal ?? "Unnamed protocol");
		const constraints = (document.frontmatter.constraints as string[]) ?? [];
		const maxIterations = Number(document.frontmatter.max_iterations ?? 20);
		const hypothesisId = goal.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);

		const memoryRepository = new MemoryRepository({ root: join(this.projectDir, SNDV_DIR_NAME) });
		await memoryRepository.init();
		const memoryContext = await memoryRepository.exportForLlm(hypothesisId);

		const systemPrompt = buildSystemPrompt({
			goal,
			constraints,
			tasks: document.tasks.map((task) => ({
				name: task.name,
				risk: task.risk,
				dependsOn: task.dependsOn,
			})),
		});

		const protocol = new Protocol({ goal, constraints }, { maxIterations });
		const llmClient = this.noLlm ? null : new LlmClient();

		for (const task of document.tasks) {
			const taskFunction = llmClient
				? createLlmTask(task, llmClient, systemPrompt, memoryContext)
				: createOfflineTask(task);

			protocol.addTask(taskFunction, {
				name: task.name,
				risk: task.risk,
				dependsOn: task.dependsOn,
			});
		}

		if (this.dryRun) return protocol.visualize();

		const report = await protocol.execute();

		await memoryRepository.sessions.recordRun(hypothesisId, {
			goal,
			status: report.status,
			durationMs: report.totalDurationMs,
			iterations: report.iterations,
			survivingPath: report.survivingPath,
			prunedPaths: report.prunedPaths,
			taskResults: report.taskResults,
		});

		return summary(report);
	};
}

const createLlmTask = (
	task: QmdTask,
	llmClient: LlmClient,
	systemPrompt: string,
	memoryContext: string,
): TaskFn => {
	const fn: TaskFn = async (ctx) => {
		console.log(`  [LLM] Evaluating: ${task.name}...`);
		const verdict = await llmClient.judgeTask(
			systemPrompt,
			task.name,
			task.description,
			memoryContext,
		);
		ctx.evidence("llm_status", verdict.status);
		ctx.evidence("llm_reason", verdict.reason ?? "");
		for (const [key, val] of Object.entries(verdict.evidence)) {
			ctx.evidence(key, val);
		}
		if (verdict.status === VerdictStatus.FALSIFIED) {
			ctx.falsify(verdict.reason ?? "LLM determined task is falsified");
		}
	};
	Object.defineProperty(fn, "name", { value: task.name });
	return fn;
};

const createOfflineTask = (task: QmdTask): TaskFn => {
	const fn: TaskFn = async (ctx) => {
		ctx.evidence("description", task.description);
		ctx.evidence("source", "qmd-offline");
	};
	Object.defineProperty(fn, "name", { value: task.name });
	return fn;
};
