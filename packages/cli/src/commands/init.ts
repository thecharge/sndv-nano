import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	buildBrownfieldTemplate,
	buildGreenfieldTemplate,
	DEFAULT_MAX_SHORT_TERM_ENTRIES,
	ProjectType,
	SNDV_DIR_NAME,
} from "@thecharge/sndv-config";
import type { Command } from "./command";

export interface InitOpts {
	projectDir: string;
	type: ProjectType;
	name?: string;
}

/** Initialize a new SMEP project. Creates config dir and template QMD. */
export class InitCommand implements Command {
	private readonly projectDir: string;
	private readonly type: ProjectType;
	private readonly name?: string;

	constructor(opts: InitOpts) {
		this.projectDir = opts.projectDir;
		this.type = opts.type;
		this.name = opts.name;
	}

	execute = async (): Promise<string> => {
		const sndvDir = join(this.projectDir, SNDV_DIR_NAME);
		await mkdir(sndvDir, { recursive: true });
		await mkdir(join(sndvDir, "long-term"), { recursive: true });

		const template =
			this.type === ProjectType.BROWNFIELD ? buildBrownfieldTemplate() : buildGreenfieldTemplate();
		const qmdPath = join(sndvDir, "protocol.qmd");
		await writeFile(qmdPath, template, "utf-8");

		const config = {
			name: this.name ?? "my-project",
			type: this.type,
			memoryDir: SNDV_DIR_NAME,
			maxShortTermEntries: DEFAULT_MAX_SHORT_TERM_ENTRIES,
		};
		await writeFile(join(sndvDir, "config.json"), JSON.stringify(config, null, 2), "utf-8");

		return qmdPath;
	};
}
