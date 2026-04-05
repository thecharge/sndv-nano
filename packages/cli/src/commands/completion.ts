import {
	buildBashCompletion,
	buildCompletionUsage,
	buildFishCompletion,
	buildZshCompletion,
	CliCompletionFormat,
	CliErrors,
} from "@thecharge/sndv-config";
import type { Command } from "./command";

export interface CompletionOpts {
	format?: CliCompletionFormat;
}

export class CompletionCommand implements Command {
	private readonly format?: CliCompletionFormat;

	constructor(opts: CompletionOpts) {
		this.format = opts.format;
	}

	execute = async (): Promise<string> => {
		if (!this.format) return buildCompletionUsage();
		if (this.format === CliCompletionFormat.BASH) return buildBashCompletion();
		if (this.format === CliCompletionFormat.ZSH) return buildZshCompletion();
		if (this.format === CliCompletionFormat.FISH) return buildFishCompletion();
		return CliErrors.invalidCompletionFormat(String(this.format)).message;
	};
}
