import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmdbGet } from "@/lib/tmdb";
import { anilistFetch } from "@/lib/anilist";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const TMDB_IMAGE = "https://image.tmdb.org/t/p/w500";

// AniList is rate-limited by IP (30 req/min). We share one VPS IP across every
// route, so anime thumbnail lookups used to get 429'd and blank out the cards.
// Keep the batch result in-process for 6h and fall back to stale data on 429.
const THUMB_TTL_MS = 6 * 60 * 60 * 1000;
const thumbCache = new Map<string, { at: number; map: Map<string, string | null> }>();

// In-process cache dies on every deploy/restart, which is exactly when AniList
// is most likely to be rate-limited (cold start = real request). Mirror the last
// good covers to disk so a restart can still paint posters offline.
const COVER_STORE = join(process.cwd(), ".next", "anilist-covers.json");

async function loadCoverStore(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await readFile(COVER_STORE, "utf-8"));
  } catch {
    return {};
  }
}

async function saveCoverStore(store: Record<string, string>) {
  try {
    await mkdir(join(process.cwd(), ".next"), { recursive: true });
    await writeFile(COVER_STORE, JSON.stringify(store), "utf-8");
  } catch (e) {
    console.error("[getThumbnails] cover store write failed:", e);
  }
}

// How many collections to pick randomly
const PICK_COUNT = 8;
// No minimum likes — any published collection qualifies
const MIN_LIKES = 0;
// Server cache: 30 minutes
export const revalidate = 1800;

export async function GET() {
  try {
    // Direct query. The old get_published_collections RPC was never created in
    // any migration (verified: 0 matches across supabase/migrations/, and the
    // endpoint returns PGRST202), so every request paid a ~250ms round-trip for
    // an error before falling through to this branch anyway.
    {
      const { data: fallback } = await supabase
        .from("user_lists")
        .select("id, name, user_id, created_at, published_at")
        .eq("is_published", true)
        .order("published_at", { ascending: false });

      if (!fallback?.length) {
        return NextResponse.json({ collections: [] });
      }

      // All published collections qualify (no min likes)
      const shuffled = fallback.sort(() => Math.random() - 0.5).slice(0, PICK_COUNT);
      const fbListIds = shuffled.map((l) => l.id);
      const userIds = [...new Set(shuffled.map((l) => l.user_id))];

      // Run the three lookups CONCURRENTLY — each Supabase round-trip is ~230ms,
      // so awaiting them in sequence cost ~700ms of pure latency here.
      const [{ data: likeCounts }, { data: users }, { data: fbItems }] = await Promise.all([
        supabase.from("collection_likes").select("list_id").in("list_id", fbListIds),
        supabase.from("users").select("id, username").in("id", userIds),
        supabase.from("list_items").select("list_id, tmdb_id, media_type").in("list_id", fbListIds),
      ]);

      const likeMap: Record<string, number> = {};
      for (const l of likeCounts || []) {
        likeMap[l.list_id] = (likeMap[l.list_id] || 0) + 1;
      }
      const userMap: Record<string, string> = {};
      for (const u of users || []) userMap[u.id] = u.username;
      const fbItemsByList = new Map<string, { tmdb_id: number; media_type: string }[]>();
      const fbCountByList = new Map<string, number>();
      for (const it of fbItems || []) {
        const arr = fbItemsByList.get(it.list_id) || [];
        if (arr.length < 4) arr.push({ tmdb_id: it.tmdb_id, media_type: it.media_type });
        fbItemsByList.set(it.list_id, arr);
        fbCountByList.set(it.list_id, (fbCountByList.get(it.list_id) || 0) + 1);
      }

      const enriched = await Promise.all(
        shuffled.map(async (l) => {
          const items = fbItemsByList.get(l.id) || [];
          const realCount = fbCountByList.get(l.id) ?? 0;
          const thumbs = await getThumbnails(items);
          return {
            id: l.id,
            name: l.name,
            owner: userMap[l.user_id] || "unknown",
            likesCount: likeMap[l.id] || 0,
            itemCount: realCount,
            thumbnails: thumbs,
          };
        })
      );

      return NextResponse.json({ collections: enriched.filter(c => c.itemCount > 0) });
    }
  } catch (err) {
    return NextResponse.json({ collections: [], error: "Failed to load" }, { status: 500 });
  }
}

const ANILIST_API = "https://graphql.anilist.co";

async function getThumbnails(items: { tmdb_id: number; media_type: string }[]): Promise<(string | null)[]> {
  if (items.length === 0) return [];

  // Split: anime → AniList, everything else → TMDB
  const animeItems = items.filter((i) => i.media_type === "anime");
  const tmdbItems = items.filter((i) => i.media_type !== "anime");

  const posterMap = new Map<string, string | null>();

  // ── Anime: batch AniList query ──
  if (animeItems.length > 0) {
    try {
      const ids = animeItems.map((i) => i.tmdb_id);
      const query = `query($ids:[Int]){Page(perPage:50){media(id_in:$ids,type:ANIME){id coverImage{extraLarge}}}}`;

      // AniList rate-limits by IP (30 req/min). The VPS shares one IP across all
      // routes, so a 429 here used to blank out every anime thumbnail. Cache the
      // batch result for 6h, then retry with backoff before giving up.
      const batchKey = `anilist-thumbs:${ids.slice().sort((a, b) => a - b).join(",")}`;
      const cached = thumbCache.get(batchKey);
      if (cached && Date.now() - cached.at < THUMB_TTL_MS) {
        for (const [k, v] of cached.map) posterMap.set(k, v);
      } else {
        let res: Response | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          res = await anilistFetch(query, { ids }, { revalidate: 21600 });
          if (res.ok) break;
          // 429 → wait out the rate-limit window (AniList resets per minute)
          if (res.status === 429) {
            console.warn(`[getThumbnails] AniList 429, retry ${attempt + 1}/3`);
            await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
            continue;
          }
          break;
        }

        if (res?.ok) {
          const json = await res.json();
          const collected = new Map<string, string | null>();
          for (const m of json.data?.Page?.media || []) {
            collected.set(`anime:${m.id}`, m.coverImage?.extraLarge || null);
          }
          for (const [k, v] of collected) posterMap.set(k, v);
          thumbCache.set(batchKey, { at: Date.now(), map: collected });
          // Persist only real URLs so a restart never resurrects nulls
          const store = await loadCoverStore();
          let dirty = false;
          for (const [k, v] of collected) {
            if (v && store[k] !== v) {
              store[k] = v;
              dirty = true;
            }
          }
          if (dirty) await saveCoverStore(store);
        } else if (cached) {
          // Rate-limited or failed → serve the stale copy rather than nothing
          for (const [k, v] of cached.map) posterMap.set(k, v);
        } else {
          // Cold start + AniList down → fall back to the last covers we saved
          const store = await loadCoverStore();
          let hit = 0;
          for (const item of animeItems) {
            const saved = store[`anime:${item.tmdb_id}`];
            if (saved) {
              posterMap.set(`anime:${item.tmdb_id}`, saved);
              hit++;
            }
          }
          console.error(
            `[getThumbnails] AniList unavailable (${res?.status}), disk fallback ${hit}/${animeItems.length}`
          );
        }
      }
    } catch (e) {
      console.error("[getThumbnails] AniList error:", e);
    }
    // Fill missing with null
    for (const item of animeItems) {
      if (!posterMap.has(`anime:${item.tmdb_id}`)) {
        posterMap.set(`anime:${item.tmdb_id}`, null);
      }
    }
  }

  // ── TMDB: keep existing logic ──
  if (tmdbItems.length > 0) {
    await Promise.all(
      tmdbItems.map(async (item) => {
        try {
          const d = await tmdbGet(`/${item.media_type}/${item.tmdb_id}`);
          posterMap.set(`tmdb:${item.tmdb_id}:${item.media_type}`, d.poster_path ? `${TMDB_IMAGE}${d.poster_path}` : null);
        } catch {
          posterMap.set(`tmdb:${item.tmdb_id}:${item.media_type}`, null);
        }
      })
    );
  }

  // ── Reassemble in original order ──
  return items.map((item) => {
    if (item.media_type === "anime") {
      return posterMap.get(`anime:${item.tmdb_id}`) ?? null;
    }
    return posterMap.get(`tmdb:${item.tmdb_id}:${item.media_type}`) ?? null;
  });
}
