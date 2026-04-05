import type { QmdDocument } from "@thecharge/sndv-config";

/** A node in the knowledge graph — one indexed QMD document. */
export interface QmdNode {
	/** Absolute file path (or virtual id for string-loaded docs). */
	id: string;
	/** Parsed document. */
	document: QmdDocument;
	/** All tags found in frontmatter (e.g. constraints, type). */
	tags: string[];
	/** Task names defined in this document. */
	taskNames: string[];
	/** Last modified timestamp (ISO string). */
	lastModified: string;
}

/** An edge between two QMD nodes (cross-document dependency). */
export interface QmdEdge {
	/** Source document id. */
	from: string;
	/** Target document id. */
	to: string;
	/** Task in source that depends on task in target. */
	sourceTask: string;
	/** Task in target that is depended upon. */
	targetTask: string;
}

/** Search query for QMD documents. */
export interface QmdSearchQuery {
	/** Free-text search across goal, task names, descriptions. */
	text?: string;
	/** Match documents with this frontmatter key=value. */
	frontmatter?: Record<string, unknown>;
	/** Match documents containing a task with this name. */
	taskName?: string;
	/** Match documents where any task has risk >= threshold. */
	minRisk?: number;
	/** Match documents tagged with these values. */
	tags?: string[];
	/** Maximum results to return. */
	limit?: number;
}

/** A search result with relevance score. */
export interface QmdSearchResult {
	node: QmdNode;
	/** 0-1 relevance score (higher = more relevant). */
	score: number;
	/** Which fields matched. */
	matchedFields: string[];
}

/** Serializable index for disk persistence. */
export interface QmdIndexData {
	version: 1;
	nodes: QmdNode[];
	edges: QmdEdge[];
	indexedAt: string;
}
