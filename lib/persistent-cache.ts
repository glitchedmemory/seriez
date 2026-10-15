import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const CACHE_DIR = path.join(process.cwd(), ".cache");

// Per-namespace cap on the number of cached files. This is the real guard
// against the 1.8M-file / 9.8GB runaway: tmdbGet generates an unbounded
// number of distinct URLs, so TTL alone (write-only, never deletes) let
// files accumulate forever. A hard count cap keeps the cache bounded no
// matter how many distinct keys flow through.
//   - tmdbGet: high traffic, keep 10000 (mostly 2B/30KB files → ~300MB)
//   - enrichAnimeRelationsAniList: medium, 2000
//   - everything else (personalized / small): 1000
const NAMESPACE_CAP: Record<string, number> = {
  tmdbGet: 10000,
  enrichAnimeRelationsAniList: 2000,
};
const DEFAULT_CAP = 1000;

function capFor(namespace: string): number {
  return NAMESPACE_CAP[namespace] ?? DEFAULT_CAP;
}

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 16);
}

// Evict oldest files in `namespace` until it drops to `max` entries.
// Runs every EVICT_INTERVAL writes (deterministic, not probabilistic) so we
// don't stat/readdir the directory on every single cache write while still
// guaranteeing the namespace is trimmed regularly. The old 1-in-100 dice roll
// let namespaces sit permanently above their cap.
//
// Additionally a global sweep (SWEEP_EVERY writes) drops files whose TTL has
// elapsed but which are never looked up again - those were the real runaway
// source, since TTL deletion only happened on a cache hit.
const EVICT_INTERVAL = 500;
const SWEEP_EVERY = EVICT_INTERVAL * 12;
let writesSinceEvict = 0;
let writesSinceSweep = 0;
async function maybeEvict(namespace: string, max: number): Promise<void> {
  writesSinceEvict++;
  writesSinceSweep++;
  const doSweep = writesSinceSweep >= SWEEP_EVERY;
  if (writesSinceEvict < EVICT_INTERVAL && !doSweep) return;
  if (writesSinceEvict >= EVICT_INTERVAL) writesSinceEvict = 0;
  if (doSweep) writesSinceSweep = 0;

  try {
    const entries = await fs.readdir(CACHE_DIR);
    const files = entries
      .filter((f) => f.startsWith(`${namespace}_`) && f.endsWith(".json"))
      .map((f) => path.join(CACHE_DIR, f));

    // Global sweep: remove any cached file whose own TTL has long elapsed and
    // which is never requested again (the unbounded-growth path).
    if (doSweep) {
      const now = Date.now();
      await Promise.all(
        entries
          .filter((f) => f.endsWith(".json"))
          .map(async (f) => {
            const full = path.join(CACHE_DIR, f);
            try {
              const st = await fs.stat(full);
              // 7 days is a safe ceiling: no cache entry in this app has a TTL
              // anywhere near that, so anything older is dead weight.
              if (now - st.mtimeMs > 7 * 86400000) await fs.unlink(full);
            } catch {
              /* best effort */
            }
          })
      );
    }

    if (files.length <= max) return;

    // Oldest first (mtime ascending), delete the overflow.
    const withMtime = await Promise.all(
      files.map(async (f) => {
        try {
          const st = await fs.stat(f);
          return { f, mtime: st.mtimeMs };
        } catch {
          return { f, mtime: Number.POSITIVE_INFINITY };
        }
      })
    );
    withMtime.sort((a, b) => a.mtime - b.mtime);
    const toDelete = withMtime.slice(0, files.length - max);

    await Promise.all(
      toDelete.map(({ f }) => fs.unlink(f).catch(() => {}))
    );
  } catch {
    // Eviction is best-effort; never let it break the actual lookup.
  }
}

export async function persistentCache<T>(
  namespace: string,
  keyParts: unknown[],
  ttlSeconds: number,
  fn: () => Promise<T>,
): Promise<T> {
  const key = hashKey(namespace + ":" + JSON.stringify(keyParts));
  const file = path.join(CACHE_DIR, `${namespace}_${key}.json`);

  try {
    const stat = await fs.stat(file);
    const age = (Date.now() - stat.mtimeMs) / 1000;
    if (age < ttlSeconds) {
      return JSON.parse(await fs.readFile(file, "utf-8"));
    }
    // Stale: delete it so it doesn't linger on disk past its TTL.
    await fs.unlink(file).catch(() => {});
  } catch {
    // no cache or stale
  }

  const data = await fn();
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(data));

  // Bound the namespace by count (see NAMESPACE_CAP above).
  await maybeEvict(namespace, capFor(namespace));

  return data;
}
