import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import type { QmdDocument } from "@thecharge/sndv-config";
import { searchNodes } from "./graph-search";
import type {
	QmdEdge,
	QmdIndexData,
	QmdNode,
	QmdSearchQuery,
	QmdSearchResult,
} from "./graph-types";
import { parseQmd, parseQmdString } from "./parser";

export type { QmdEdge, QmdIndexData, QmdNode, QmdSearchQuery, QmdSearchResult };

// ---------------------------------------------------------------------------
// Knowledge Graph
// ---------------------------------------------------------------------------

export class QmdKnowledgeGraph {
	private nodes = new Map<string, QmdNode>();
	private edges: QmdEdge[] = [];
	private taskToDocument = new Map<string, string>();

	get size(): number {
		return this.nodes.size;
	}
	get allEdges(): readonly QmdEdge[] {
		return this.edges;
	}

	/** Add a QMD document to the graph by string content. */
	addDocument = (id: string, raw: string, lastModified?: string): QmdNode => {
		const document = parseQmdString(raw);
		return this.addParsed(id, document, lastModified);
	};

	/** Add an already-parsed QMD document to the graph. */
	addParsed = (id: string, document: QmdDocument, lastModified?: string): QmdNode => {
		const tags = this.extractTags(document);
		const taskNames = document.tasks.map((task) => task.name);
		const node: QmdNode = {
			id,
			document,
			tags,
			taskNames,
			lastModified: lastModified ?? new Date().toISOString(),
		};

		this.nodes.set(id, node);
		for (const taskName of taskNames) {
			this.taskToDocument.set(taskName, id);
		}
		this.rebuildEdges();
		return node;
	};

	removeDocument = (id: string): boolean => {
		const node = this.nodes.get(id);
		if (!node) return false;
		for (const taskName of node.taskNames) {
			this.taskToDocument.delete(taskName);
		}
		this.nodes.delete(id);
		this.rebuildEdges();
		return true;
	};

	getDocument = (id: string): QmdNode | undefined => this.nodes.get(id);
	getAllDocuments = (): QmdNode[] => [...this.nodes.values()];

	findDocumentByTask = (taskName: string): QmdNode | undefined => {
		const docId = this.taskToDocument.get(taskName);
		if (!docId) return undefined;
		return this.nodes.get(docId);
	};

	getDependents = (id: string): QmdNode[] => {
		const ids = new Set<string>();
		for (const edge of this.edges) {
			if (edge.to !== id) continue;
			ids.add(edge.from);
		}
		return [...ids].map((depId) => this.nodes.get(depId)!).filter(Boolean);
	};

	getDependencies = (id: string): QmdNode[] => {
		const ids = new Set<string>();
		for (const edge of this.edges) {
			if (edge.from !== id) continue;
			ids.add(edge.to);
		}
		return [...ids].map((depId) => this.nodes.get(depId)!).filter(Boolean);
	};

	/** Search the knowledge graph. Delegates to graph-search module. */
	search = (query: QmdSearchQuery): QmdSearchResult[] => searchNodes(this.nodes.values(), query);

	// --- Persistence ---

	saveIndex = async (filePath: string): Promise<void> => {
		const data: QmdIndexData = {
			version: 1,
			nodes: [...this.nodes.values()],
			edges: [...this.edges],
			indexedAt: new Date().toISOString(),
		};
		await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
	};

	loadIndex = async (filePath: string): Promise<void> => {
		const raw = await readFile(filePath, "utf-8");
		const data: QmdIndexData = JSON.parse(raw);
		this.nodes.clear();
		this.edges = [];
		this.taskToDocument.clear();

		for (const node of data.nodes) {
			this.nodes.set(node.id, node);
			for (const taskName of node.taskNames) {
				this.taskToDocument.set(taskName, node.id);
			}
		}
		this.edges = data.edges;
	};

	indexDirectory = async (dirPath: string): Promise<number> => {
		const qmdFiles = await this.findQmdFiles(dirPath);
		let count = 0;

		for (const filePath of qmdFiles) {
			const document = await parseQmd(filePath);
			const fileStat = await stat(filePath);
			this.addParsed(relative(dirPath, filePath), document, fileStat.mtime.toISOString());
			count++;
		}

		return count;
	};

	// --- Private ---

	private extractTags = (document: QmdDocument): string[] => {
		const tags: string[] = [];
		if (typeof document.frontmatter.type === "string") tags.push(document.frontmatter.type);
		if (Array.isArray(document.frontmatter.tags))
			tags.push(...document.frontmatter.tags.map(String));
		if (Array.isArray(document.frontmatter.constraints)) tags.push("has-constraints");
		return tags;
	};

	private rebuildEdges = (): void => {
		this.edges = [];
		for (const node of this.nodes.values()) {
			for (const task of node.document.tasks) {
				for (const depName of task.dependsOn) {
					const targetId = this.taskToDocument.get(depName);
					if (!targetId) continue;
					if (targetId === node.id) continue;
					this.edges.push({
						from: node.id,
						to: targetId,
						sourceTask: task.name,
						targetTask: depName,
					});
				}
			}
		}
	};

	private findQmdFiles = async (dirPath: string): Promise<string[]> => {
		const results: string[] = [];
		const entries = await readdir(dirPath, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = join(dirPath, entry.name);
			if (entry.isDirectory()) {
				results.push(...(await this.findQmdFiles(fullPath)));
				continue;
			}
			if (extname(entry.name) !== ".qmd") continue;
			results.push(fullPath);
		}

		return results;
	};
}
