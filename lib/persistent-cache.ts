import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const CACHE_DIR = path.join(process.cwd(), ".cache");

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 16);
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
  } catch {
    // no cache or stale
  }

  const data = await fn();
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(data));
  return data;
}
