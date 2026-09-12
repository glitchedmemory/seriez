#!/usr/bin/env node
/**
 * AniList 인기 상위 N개 애니의 detail + episodes를 DB(anime_season_cache)에 백필.
 *
 * rate limit 안 걸리게:
 *  - 동시 요청 1개(순차)
 *  - 요청 사이 450ms 지연 (~2.2 req/s, AniList 무료 API 한도 내)
 *  - 429 응답 시 지수 백오프 + 60초 대기
 *
 * 이미 detail이 저장된 행은 건너뜀(중복 호출 방지).
 * 용량: detail ~4.5KB/행 + episodes ~8KB/행 → 1000개 약 12MB (Supabase 500MB의 2.4%).
 */
const { Client } = require("pg");

const PG = {
  host: "aws-1-us-west-2.pooler.supabase.com",
  port: 5432,
  database: "postgres",
  user: "postgres.zntyjtjodyzizoafxord",
  password: "Djfbm99#HoH4",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
};

const ANILIST_HEADERS = {
  "Content-Type": "application/json",
  Origin: "https://anilist.co",
  Referer: "https://anilist.co/",
};

const TARGET = parseInt(process.argv[2] || "1000", 10);
// AniList 무료 API 한도는 분당 ~30개(정상 시 최대 90개). 2000ms 간격 = 분당 30개로
// 안전선에 맞춤. 429가 반복되면 아래 백오프에서 60초까지 쉼.
const DELAY_MS = 2000; // ~0.5 req/s = 30 req/min

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function anilistQuery(query, variables, retries = 5) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: ANILIST_HEADERS,
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 429) {
        // AniList가 rate limit를 걸면 최소 30초, 최대 90초 쉬기 (누적)
        const wait = Math.min(90000, 5000 * Math.pow(2, attempt - 1));
        console.log(`  [429] 대기 ${wait / 1000}s (시도 ${attempt}/${retries})`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        await sleep(1000 * attempt);
        continue;
      }
      return await res.json();
    } catch (e) {
      console.log(`  [error] ${e.message} (시도 ${attempt})`);
      await sleep(1500 * attempt);
    }
  }
  return null;
}

// 인기 상위 N개 AniList ID 수집 (POPULARITY_DESC)
async function collectPopularIds(n) {
  const ids = [];
  const perPage = 50;
  const pages = Math.ceil(n / perPage);
  for (let page = 1; page <= pages; page++) {
    const q = `query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){media(sort:POPULARITY_DESC,type:ANIME){id}}}`;
    const json = await anilistQuery(q, { page, perPage });
    const media = json?.data?.Page?.media || [];
    for (const m of media) ids.push(m.id);
    console.log(`  [수집] page ${page}/${pages} → 누적 ${ids.length}개`);
    await sleep(DELAY_MS);
  }
  return ids.slice(0, n);
}

const DETAIL_QUERY = `query($id:Int){Media(id:$id,type:ANIME){
  id idMal title{romaji english native} description coverImage{extraLarge large} bannerImage
  averageScore popularity seasonYear season format status episodes duration genres
  tags{name rank} studios(sort:FAVOURITES_DESC){nodes{name isAnimationStudio}}
  staff(sort:RELEVANCE,perPage:8){nodes{id name{full} primaryOccupations image{medium}}}
  characters(sort:ROLE,perPage:15){edges{role node{name{full} image{medium}} voiceActors(language:JAPANESE){name{full} image{medium}}}}
  recommendations(sort:RATING_DESC,perPage:12){nodes{mediaRecommendation{id title{romaji english} coverImage{extraLarge} averageScore seasonYear genres}}}
  trailer{id site thumbnail}
  relations{edges{relationType node{id title{romaji english} type format season seasonYear startDate{year month day} status}}}
  streamingEpisodes{title thumbnail url site}
}}`;

function formatSeason(s) {
  if (!s) return "";
  return { WINTER: "Winter", SPRING: "Spring", SUMMER: "Summer", FALL: "Fall" }[s] || s;
}
function formatStatus(s) {
  if (!s) return "";
  return { FINISHED: "Finished", RELEASING: "Releasing", NOT_YET_RELEASED: "Not Yet Released" }[s] || s;
}

async function fetchDetail(id) {
  const json = await anilistQuery(DETAIL_QUERY, { id });
  const m = json?.data?.Media;
  if (!m) return null;
  const characters = (m.characters?.edges || []).map((e) => ({
    name: e.node?.name?.full || "Unknown",
    role: e.role || "",
    voiceActor: e.voiceActors?.[0]?.name?.full || "",
    image: e.node?.image?.medium || null,
  }));
  const staff = (m.staff?.nodes || []).map((s) => ({
    id: s.id,
    name: s.name?.full || "Unknown",
    role: (s.primaryOccupations || [])[0] || "Staff",
    image: s.image?.medium || null,
  }));
  const studios = (m.studios?.nodes || []).filter((s) => s.isAnimationStudio).map((s) => s.name);
  const recommendations = (m.recommendations?.nodes || [])
    .map((n) => {
      const r = n.mediaRecommendation;
      if (!r) return null;
      return {
        id: r.id,
        title: r.title?.english || r.title?.romaji || "Unknown",
        poster: r.coverImage?.extraLarge || r.coverImage?.large || null,
        rating: Math.round((r.averageScore / 10) * 10) / 10 || 0,
        year: r.seasonYear || 0,
        genres: (r.genres || []).slice(0, 4),
      };
    })
    .filter(Boolean);
  const relations = (m.relations?.edges || [])
    .filter((e) => e.node?.type === "ANIME" && (e.relationType === "SEQUEL" || e.relationType === "PREQUEL"))
    .map((e) => ({
      id: e.node.id,
      title: e.node.title?.english || e.node.title?.romaji || "Unknown",
      type: e.node.type || "ANIME",
      format: e.node.format || "",
      seasonYear: e.node.seasonYear || null,
      status: e.node.status || "",
    }));
  return {
    id: m.id,
    idMal: m.idMal || 0,
    title: m.title?.english || m.title?.romaji || "Unknown",
    titleRomaji: m.title?.romaji || "",
    titleNative: m.title?.native || "",
    titles: {},
    overview: (m.description || "").replace(/<br\s*\/?>/gi, " ").replace(/ {2,}/g, " ").trim(),
    poster: m.coverImage?.extraLarge || m.coverImage?.large || "",
    backdrop: m.bannerImage || "",
    rating: Math.round(((m.averageScore || 0) / 10) * 10) / 10,
    popularity: m.popularity || 0,
    year: m.seasonYear || 0,
    season: formatSeason(m.season),
    format: m.format || "TV",
    status: formatStatus(m.status),
    episodes: m.episodes || 0,
    duration: m.duration || 0,
    genres: m.genres || [],
    tags: (m.tags || []).filter((t) => !t.isGeneralSpoiler && !t.isMediaSpoiler).sort((a, b) => b.rank - a.rank).slice(0, 8).map((t) => ({ name: t.name, rank: t.rank })),
    studios,
    staff,
    characters,
    recommendations,
    trailer: null,
    trailers: [],
    relations,
  };
}

async function main() {
  const client = new Client(PG);
  await client.connect();
  console.log(`=== 인기 상위 ${TARGET}개 백필 시작 ===`);

  // 1. 인기 ID 수집
  console.log("[1/3] 인기 애니 ID 수집 중...");
  const ids = await collectPopularIds(TARGET);
  console.log(`  수집 완료: ${ids.length}개`);

  // 2. 이미 detail 저장된 행 식별 (건너뛸 것)
  const existing = new Set();
  const exRes = await client.query("SELECT anilist_id FROM anime_season_cache WHERE detail IS NOT NULL");
  exRes.rows.forEach((r) => existing.add(r.anilist_id));
  console.log(`  이미 detail 저장된 행: ${existing.size}개 (건너뜀)`);

  // 3. 순차 백필 + rate limit 지연
  let done = 0, skipped = 0, failed = 0;
  const start = Date.now();
  for (const id of ids) {
    if (existing.has(id)) { skipped++; continue; }
    const detail = await fetchDetail(id);
    if (detail) {
      await client.query(
        `INSERT INTO anime_season_cache (anilist_id, detail, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (anilist_id) DO UPDATE SET detail = EXCLUDED.detail, updated_at = NOW()`,
        [id, JSON.stringify(detail)]
      );
      done++;
    } else {
      failed++;
    }
    if ((done + skipped + failed) % 20 === 0) {
      const el = ((Date.now() - start) / 1000).toFixed(0);
      console.log(`  진행: ${done + skipped + failed}/${ids.length} (저장 ${done}, 건너뜀 ${skipped}, 실패 ${failed}) — ${el}s 경과`);
    }
    await sleep(DELAY_MS);
  }

  const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);
  console.log(`\n=== 완료 ===`);
  console.log(`저장: ${done}, 건너뜀: ${skipped}, 실패: ${failed}`);
  console.log(`소요: ${elapsed}분`);

  await client.end();
}

main().catch((e) => { console.error("치명적 오류:", e); process.exit(1); });
