import type { QmdNode, QmdSearchQuery, QmdSearchResult } from "./graph-types";

// ---------------------------------------------------------------------------
// Search - query the knowledge graph
// ---------------------------------------------------------------------------

/** Search a collection of graph nodes with a structured query. */
export const searchNodes = (nodes: Iterable<QmdNode>, query: QmdSearchQuery): QmdSearchResult[] => {
	const results: QmdSearchResult[] = [];
	const maxResults = query.limit ?? 50;

	for (const node of nodes) {
		const { score, matchedFields } = scoreNode(node, query);
		if (score > 0 || !hasQueryFilters(query)) {
			results.push({ node, score: Math.min(score, 1.0), matchedFields });
		}
	}

	results.sort((a, b) => b.score - a.score);
	return results.slice(0, maxResults);
};

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const hasQueryFilters = (query: QmdSearchQuery): boolean =>
	!!(
		query.text ||
		query.frontmatter ||
		query.taskName ||
		query.minRisk !== undefined ||
		query.tags
	);

const scoreNode = (
	node: QmdNode,
	query: QmdSearchQuery,
): { score: number; matchedFields: string[] } => {
	const matchedFields: string[] = [];
	let score = 0;

	const textScore = query.text ? scoreTextMatch(node, query.text) : 0;
	if (textScore > 0) {
		score += textScore;
		matchedFields.push("text");
	}

	const fmScore = query.frontmatter ? scoreFrontmatterMatch(node, query.frontmatter) : 0;
	if (fmScore > 0) {
		score += fmScore;
		matchedFields.push("frontmatter");
	}

	if (query.taskName) {
		const taskLower = query.taskName.toLowerCase();
		const matched = node.taskNames.some((n) => n.toLowerCase().includes(taskLower));
		if (matched) {
			score += 1.0;
			matchedFields.push("taskName");
		}
	}

	if (query.minRisk !== undefined) {
		const highRisk = node.document.tasks.filter((t) => t.risk >= (query.minRisk ?? 0));
		if (highRisk.length > 0) {
			score += 0.5 * (highRisk.length / Math.max(node.document.tasks.length, 1));
			matchedFields.push("risk");
		}
	}

	if (query.tags && query.tags.length > 0) {
		const tagMatches = query.tags.filter((tag) =>
			node.tags.some((nt) => nt.toLowerCase() === tag.toLowerCase()),
		);
		if (tagMatches.length > 0) {
			score += tagMatches.length / query.tags.length;
			matchedFields.push("tags");
		}
	}

	return { score, matchedFields };
};

export const scoreTextMatch = (node: QmdNode, searchText: string): number => {
	const lower = searchText.toLowerCase();
	let score = 0;

	const goal = String(node.document.frontmatter.goal ?? "").toLowerCase();
	if (goal.includes(lower)) score += 0.8;

	for (const task of node.document.tasks) {
		if (task.name.toLowerCase().includes(lower)) score += 0.6;
		if (task.description.toLowerCase().includes(lower)) score += 0.3;
	}

	if (node.document.body.toLowerCase().includes(lower)) score += 0.2;

	return Math.min(score, 1.0);
};

export const scoreFrontmatterMatch = (node: QmdNode, queryFm: Record<string, unknown>): number => {
	let matched = 0;
	const total = Object.keys(queryFm).length;
	if (total === 0) return 0;

	for (const [key, value] of Object.entries(queryFm)) {
		const nodeVal = node.document.frontmatter[key];
		if (nodeVal === value) {
			matched++;
			continue;
		}
		if (typeof nodeVal === "string" && typeof value === "string") {
			if (nodeVal.toLowerCase().includes(value.toLowerCase())) matched += 0.5;
		}
	}

	return matched / total;
};
