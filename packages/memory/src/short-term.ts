/**
 * Short-term memory - in-memory only, dies when process exits.
 *
 * This is ctx.evidence() and ctx.shared from the runtime.
 * Fast map with LRU eviction. No persistence.
 */
export class ShortTermMemory {
	private readonly entries = new Map<string, unknown>();
	private readonly maxEntries: number;

	constructor(maxEntries = 100) {
		this.maxEntries = maxEntries;
	}

	async get(key: string): Promise<unknown | undefined> {
		return this.entries.get(key);
	}

	async set(key: string, value: unknown): Promise<void> {
		if (this.entries.size >= this.maxEntries && !this.entries.has(key)) {
			const oldest = this.entries.keys().next().value;
			if (oldest !== undefined) this.entries.delete(oldest);
		}
		this.entries.set(key, value);
	}

	async delete(key: string): Promise<boolean> {
		return this.entries.delete(key);
	}

	async list(): Promise<Array<{ key: string; value: unknown }>> {
		return [...this.entries.entries()].map(([key, value]) => ({ key, value }));
	}

	async clear(): Promise<void> {
		this.entries.clear();
	}

	get size(): number {
		return this.entries.size;
	}
}
