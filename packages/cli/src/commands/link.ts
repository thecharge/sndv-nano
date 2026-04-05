import { lstat, mkdir, readlink, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
	buildLinkAlreadyLinked,
	buildLinkConflict,
	buildLinkSuccess,
	CLI_DEFAULT_SYMLINK_PATH,
	CLI_DIST_RELATIVE_PATH,
	CLI_LOCAL_BIN_DIR,
	CliErrors,
} from "@thecharge/sndv-config";
import type { Command } from "./command";

export interface LinkOpts {
	projectDir: string;
	linkPath?: string;
}

export class LinkCommand implements Command {
	private readonly projectDir: string;
	private readonly linkPath?: string;

	constructor(opts: LinkOpts) {
		this.projectDir = opts.projectDir;
		this.linkPath = opts.linkPath;
	}

	execute = async (): Promise<string> => {
		const targetPath = join(this.projectDir, CLI_DIST_RELATIVE_PATH);
		const targetExists = await pathExists(targetPath);
		if (!targetExists) return CliErrors.linkTargetMissing(targetPath).message;

		const binDir = expandHome(CLI_LOCAL_BIN_DIR);
		try {
			await mkdir(binDir, { recursive: true });
		} catch {
			return CliErrors.linkDirCreateFailed(binDir).message;
		}

		const linkPath = expandHome(this.linkPath ?? CLI_DEFAULT_SYMLINK_PATH);
		const linkStat = await lstatSafe(linkPath);

		if (linkStat?.isSymbolicLink()) {
			const currentTarget = await readlink(linkPath);
			if (currentTarget === targetPath) return buildLinkAlreadyLinked(linkPath);
			return buildLinkConflict(linkPath);
		}

		if (linkStat) return buildLinkConflict(linkPath);

		try {
			await symlink(targetPath, linkPath);
			return buildLinkSuccess(linkPath, targetPath);
		} catch {
			return CliErrors.linkFailed(linkPath).message;
		}
	};
}

const expandHome = (pathValue: string): string => {
	if (!pathValue.startsWith("~/")) return pathValue;
	return join(homedir(), pathValue.slice(2));
};

const pathExists = async (pathValue: string): Promise<boolean> => {
	try {
		await lstat(pathValue);
		return true;
	} catch {
		return false;
	}
};

const lstatSafe = async (pathValue: string): Promise<ReturnType<typeof lstat> | null> => {
	try {
		return await lstat(pathValue);
	} catch {
		return null;
	}
};
