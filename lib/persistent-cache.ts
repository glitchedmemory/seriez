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
// Runs probabilistically on write (1% of the time) so we don't stat/readdir
// the (up to 10k-file) directory on every single cache write. Worst case the
// namespace overshoots briefly before the next eviction pass trims it.
let evictionNonce = 0;
async function maybeEvict(namespace: string, max: number): Promise<void> {
  evictionNonce++;
  if (evictionNonce % 100 !== 0) return;

  try {
    const entries = await fs.readdir(CACHE_DIR);
    const files = entries
      .filter((f) => f.startsWith(`${namespace}_`) && f.endsWith(".json"))
      .map((f) => path.join(CACHE_DIR, f));

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
