import { appendFile, readFile, writeFile } from "node:fs/promises";

/** Append a single record as one JSON line to a JSONL file. */
export const appendJsonl = async (filePath: string, record: unknown): Promise<void> => {
	await appendFile(filePath, `${JSON.stringify(record)}\n`, "utf-8");
};

/** Append multiple records as JSON lines in a single write. */
export const appendJsonlBatch = async (filePath: string, records: unknown[]): Promise<void> => {
	if (records.length === 0) return;
	const chunk = `${records.map((r) => JSON.stringify(r)).join("\n")}\n`;
	await appendFile(filePath, chunk, "utf-8");
};

/** Read all records from a JSONL file. Skips blank/malformed lines. */
export const readJsonl = async <T>(filePath: string): Promise<T[]> => {
	try {
		const raw = await readFile(filePath, "utf-8");
		return parseJsonlString<T>(raw);
	} catch {
		return [];
	}
};

/** Parse JSONL string content into typed records. */
export const parseJsonlString = <T>(raw: string): T[] => {
	const results: T[] = [];
	for (const line of raw.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			results.push(JSON.parse(trimmed));
		} catch {
			// Skip malformed lines — partial writes from interrupted flushes
		}
	}
	return results;
};

/** Overwrite a JSONL file atomically with the given records. */
export const writeJsonl = async (filePath: string, records: unknown[]): Promise<void> => {
	const content =
		records.map((r) => JSON.stringify(r)).join("\n") + (records.length > 0 ? "\n" : "");
	await writeFile(filePath, content, "utf-8");
};
