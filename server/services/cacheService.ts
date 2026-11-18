import crypto from 'crypto';

export const DEFAULT_MAX_ENTRIES = 250;
export const DEFAULT_MAX_MEMORY_BYTES = 2 * 1024 * 1024; // 2 MiB
export const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface CacheEntry<T> {
  value: T;
  byteSize: number;
  expiresAt: number;
}

export interface CacheStats {
  entries: number;
  memoryBytes: number;
  maxEntries: number;
  maxMemoryBytes: number;
  hits: number;
  misses: number;
  evictions: number;
}

/**
 * Deterministically canonicalizes any JSON-serializable payload by sorting object keys
 * before computing its SHA-256 hex digest.
 */
export function hashNormalizedPayload(payload: unknown): string {
  const canonicalize = (val: unknown): unknown => {
    if (Array.isArray(val)) {
      return val.map(canonicalize);
    }
    if (val !== null && typeof val === 'object') {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(val as Record<string, unknown>).sort()) {
        const v = (val as Record<string, unknown>)[key];
        if (v !== undefined) {
          sorted[key] = canonicalize(v);
        }
      }
      return sorted;
    }
    if (typeof val === 'string') {
      return val.trim().toLowerCase();
    }
    return val;
  };

  const serialized = JSON.stringify(canonicalize(payload));
  return crypto.createHash('sha256').update(serialized, 'utf8').digest('hex');
}

/**
 * Bounded in-memory LRU cache enforcing strict entry-count and byte-size ceilings
 * to remain OOM-safe under concurrent workloads.
 */
export class BoundedLruCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly maxEntries: number;
  private readonly maxMemoryBytes: number;
  private readonly ttlMs: number;
  private currentBytes = 0;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(options?: { maxEntries?: number; maxMemoryBytes?: number; ttlMs?: number }) {
    this.maxEntries = options?.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.maxMemoryBytes = options?.maxMemoryBytes ?? DEFAULT_MAX_MEMORY_BYTES;
    this.ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  }

  public get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses += 1;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      this.misses += 1;
      return undefined;
    }

    // Refresh LRU recency by moving to end of Map
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits += 1;
    return entry.value;
  }

  public set(key: string, value: T): boolean {
    const entryBytes =
      Buffer.byteLength(key, 'utf8') + Buffer.byteLength(JSON.stringify(value), 'utf8');

    // Reject single entries larger than the entire memory budget
    if (entryBytes > this.maxMemoryBytes) {
      return false;
    }

    if (this.store.has(key)) {
      this.delete(key);
    }

    // Evict LRU entries (oldest inserted/accessed first) until within both ceilings
    while (
      this.store.size >= this.maxEntries ||
      this.currentBytes + entryBytes > this.maxMemoryBytes
    ) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey === undefined) break;
      this.delete(oldestKey);
      this.evictions += 1;
    }

    this.store.set(key, {
      value,
      byteSize: entryBytes,
      expiresAt: Date.now() + this.ttlMs,
    });
    this.currentBytes += entryBytes;
    return true;
  }

  public delete(key: string): boolean {
    const existing = this.store.get(key);
    if (!existing) return false;
    this.store.delete(key);
    this.currentBytes = Math.max(0, this.currentBytes - existing.byteSize);
    return true;
  }

  public clear(): void {
    this.store.clear();
    this.currentBytes = 0;
  }

  public getStats(): CacheStats {
    return {
      entries: this.store.size,
      memoryBytes: this.currentBytes,
      maxEntries: this.maxEntries,
      maxMemoryBytes: this.maxMemoryBytes,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
    };
  }
}

export const planResponseCache = new BoundedLruCache<unknown>({
  maxEntries: DEFAULT_MAX_ENTRIES,
  maxMemoryBytes: DEFAULT_MAX_MEMORY_BYTES,
  ttlMs: DEFAULT_TTL_MS,
});
