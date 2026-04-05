import { copyFile, mkdir, readdir, readFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { SNDV_DIR_NAME } from "@thecharge/sndv-config";
import { parseQmd } from "@thecharge/sndv-qmd";

export interface ProtocolOpts {
	projectDir: string;
	action: string;
	name?: string;
}

export const PROTOCOL_USAGE = `sndv protocol <action> [options]

Actions:
  list                   List current and archived protocols
  archive [--name <n>]   Archive the current protocol (optional name)
  restore --name <n>     Restore an archived protocol as current`;

const archiveDir = (projectDir: string): string => join(projectDir, SNDV_DIR_NAME, "archive");

const currentQmd = (projectDir: string): string => join(projectDir, SNDV_DIR_NAME, "protocol.qmd");

export const protocol = async (opts: ProtocolOpts): Promise<string> => {
	if (opts.action === "list") return listProtocols(opts.projectDir);
	if (opts.action === "archive") return archiveProtocol(opts);
	if (opts.action === "restore") return restoreProtocol(opts);
	return PROTOCOL_USAGE;
};

const listProtocols = async (projectDir: string): Promise<string> => {
	const lines: string[] = [];

	try {
		const doc = await parseQmd(currentQmd(projectDir));
		const goal = String(doc.frontmatter.goal ?? "Unnamed");
		const taskCount = doc.tasks.length;
		lines.push(`Current: ${goal} (${taskCount} tasks)`);
	} catch {
		lines.push("Current: (none)");
	}

	const dir = archiveDir(projectDir);
	try {
		const files = await readdir(dir);
		const qmdFiles = files.filter((f) => f.endsWith(".qmd")).sort();
		if (qmdFiles.length > 0) {
			lines.push("\nArchived:");
			for (const file of qmdFiles) {
				const doc = await parseQmd(join(dir, file));
				const goal = String(doc.frontmatter.goal ?? "Unnamed");
				const name = file.replace(/\.qmd$/, "");
				lines.push(`  ${name}: ${goal} (${doc.tasks.length} tasks)`);
			}
		}
	} catch {
		/* no archive dir yet */
	}

	return lines.join("\n");
};

const archiveProtocol = async (opts: ProtocolOpts): Promise<string> => {
	const src = currentQmd(opts.projectDir);

	try {
		await readFile(src, "utf-8");
	} catch {
		return "Error: no current protocol.qmd to archive";
	}

	const dir = archiveDir(opts.projectDir);
	await mkdir(dir, { recursive: true });

	const archiveName = opts.name ?? `protocol-${Date.now()}`;
	if (!isValidArchiveName(archiveName)) {
		return "Error: archive name must be alphanumeric with dashes/underscores";
	}
	const dest = join(dir, `${archiveName}.qmd`);

	try {
		await readFile(dest, "utf-8");
		return `Error: archive "${archiveName}" already exists`;
	} catch {
		/* does not exist, good */
	}

	await copyFile(src, dest);
	return `Archived current protocol as "${archiveName}"`;
};

const restoreProtocol = async (opts: ProtocolOpts): Promise<string> => {
	if (!opts.name) return "Error: --name is required for protocol restore";
	if (!isValidArchiveName(opts.name)) {
		return "Error: archive name must be alphanumeric with dashes/underscores";
	}

	const src = join(archiveDir(opts.projectDir), `${opts.name}.qmd`);

	try {
		await readFile(src, "utf-8");
	} catch {
		return `Error: archived protocol "${opts.name}" not found`;
	}

	const dest = currentQmd(opts.projectDir);

	try {
		await readFile(dest, "utf-8");
		const backupName = `protocol-${Date.now()}`;
		const backupDest = join(archiveDir(opts.projectDir), `${backupName}.qmd`);
		await mkdir(archiveDir(opts.projectDir), { recursive: true });
		await rename(dest, backupDest);
	} catch {
		/* no current protocol to backup */
	}

	await copyFile(src, dest);
	return `Restored protocol "${opts.name}" as current`;
};

const isValidArchiveName = (name: string): boolean => /^[a-zA-Z0-9_-]+$/.test(name);
