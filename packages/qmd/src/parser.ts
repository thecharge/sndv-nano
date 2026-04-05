import { readFile } from "node:fs/promises";
import type { QmdDocument, QmdTask } from "@thecharge/sndv-config";

/** Parse a QMD file from disk. */
export const parseQmd = async (filePath: string): Promise<QmdDocument> => {
	const raw = await readFile(filePath, "utf-8");
	return parseQmdString(raw);
};

/** Parse a QMD string directly. */
export const parseQmdString = (raw: string): QmdDocument => {
	const { frontmatter, body } = extractFrontmatter(raw);
	const tasks = extractTasks(body);
	return { frontmatter, tasks, body };
};

// --- Private helpers ---

const extractFrontmatter = (
	raw: string,
): {
	frontmatter: Record<string, unknown>;
	body: string;
} => {
	const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	if (!match) return { frontmatter: {}, body: raw };
	return { frontmatter: parseSimpleYaml(match[1]), body: match[2] };
};

const parseSimpleYaml = (yaml: string): Record<string, unknown> => {
	const result: Record<string, unknown> = {};
	let currentKey = "";
	let currentArray: string[] | null = null;

	for (const line of yaml.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;

		const arrayItemMatch = trimmed.match(/^-\s+(.+)$/);
		if (arrayItemMatch && currentArray) {
			currentArray.push(arrayItemMatch[1].replace(/^["']|["']$/g, ""));
			continue;
		}

		if (currentArray) {
			result[currentKey] = currentArray;
			currentArray = null;
		}

		const keyValueMatch = trimmed.match(/^(\w[\w_]*)\s*:\s*(.*)$/);
		if (!keyValueMatch) continue;

		const [, key, value] = keyValueMatch;
		if (!value) {
			currentKey = key;
			currentArray = [];
			continue;
		}

		result[key] = parseValue(value);
	}

	if (currentArray) result[currentKey] = currentArray;
	return result;
};

const parseValue = (rawValue: string): unknown => {
	const trimmed = rawValue.trim().replace(/^["']|["']$/g, "");
	if (trimmed === "true") return true;
	if (trimmed === "false") return false;
	const numericValue = Number(trimmed);
	if (!Number.isNaN(numericValue) && trimmed !== "") return numericValue;
	return trimmed;
};

const extractTasks = (body: string): QmdTask[] => {
	const sections = body.split(/^#\s+Task:\s+/m).slice(1);

	return sections.map((section) => {
		const lines = section.split("\n");
		const name = lines[0].trim();
		let risk = 0.5;
		let dependsOn: string[] = [];
		const descriptionLines: string[] = [];

		for (const line of lines.slice(1)) {
			const riskMatch = line.match(/^risk:\s*([\d.]+)/);
			if (riskMatch) {
				risk = parseFloat(riskMatch[1]);
				continue;
			}

			const dependencyMatch = line.match(/^depends_on:\s*\[([^\]]*)\]/);
			if (dependencyMatch) {
				dependsOn = dependencyMatch[1]
					.split(",")
					.map((dependency) => dependency.trim())
					.filter(Boolean);
				continue;
			}

			if (line.trim()) descriptionLines.push(line.trim());
		}

		return { name, risk, dependsOn, description: descriptionLines.join("\n") };
	});
};
