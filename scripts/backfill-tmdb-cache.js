#!/usr/bin/env node
/**
 * TMDB 인기 상위 영화/TV 백필.
 *
 * 방식: 실제 운영 중인 localhost:3000 서버에 페이지를 직접 접속해서
 * getMovieDetail/getSeasonData가 실행되게 한다. 이러면 가공 로직이 배포 코드와
 * 100% 일치하고, 결과가 tmdb_cache DB에 자동 저장된다.
 *
 * 대상: 영화 2500개 + TV 2500개 (각 시즌 1개).
 *
 * rate limit 안 걸리게:
 *  - 순차 접속, 요청 사이 지연
 *  - localhost 접속이라 외부 TMDB rate limit은 서버 자체가 처리
 */

const TARGET_MOVIE = parseInt(process.argv[2] || "2500", 10);
const TARGET_TV = parseInt(process.argv[3] || "2500", 10);
const DELAY_MS = 120; // 페이지 접속 간격 (서버 부하 방지)

const TMDB_BASE = "https://api.themoviedb.org/3";
const API_KEY = process.env.TMDB_API_KEY;
if (!API_KEY) { console.error("TMDB_API_KEY 환경변수 필요"); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// TMDB 인기 목록 수집 (movie/tv 각각 popularity.desc)
async function tmdbGet(path, retries = 4) {
  for (let a = 1; a <= retries; a++) {
    try {
      const url = `${TMDB_BASE}${path}${path.includes("?") ? "&" : "?"}api_key=${API_KEY}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (res.status === 429) {
        const w = Math.min(30000, 2000 * Math.pow(2, a - 1));
        await sleep(w);
        continue;
      }
      if (!res.ok) { await sleep(1000 * a); continue; }
      return await res.json();
    } catch (e) {
      await sleep(1000 * a);
    }
  }
  return null;
}

async function collectPopular(mediaType, target) {
  const ids = [];
  const perPage = 20;
  const pages = Math.ceil(target / perPage);
  for (let page = 1; page <= pages; page++) {
    const json = await tmdbGet(`/${mediaType}/popular?page=${page}`);
    const results = json?.results || [];
    for (const r of results) ids.push(r.id);
    if (ids.length % 500 < 30) console.log(`  [수집] ${mediaType} page ${page}/${pages} → ${ids.length}개`);
    await sleep(300);
  }
  return ids.slice(0, target);
}

async function warmPage(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    return res.status;
  } catch {
    return 0;
  }
}

async function main() {
  console.log(`=== TMDB 백필 시작: 영화 ${TARGET_MOVIE}, TV ${TARGET_TV} ===`);
  const start = Date.now();

  // 1. 인기 영화 ID 수집
  console.log("[1/4] 영화 인기 ID 수집 중...");
  const movieIds = await collectPopular("movie", TARGET_MOVIE);
  console.log(`  영화 ${movieIds.length}개 수집 완료`);

  // 2. 인기 TV ID 수집
  console.log("[2/4] TV 인기 ID 수집 중...");
  const tvIds = await collectPopular("tv", TARGET_TV);
  console.log(`  TV ${tvIds.length}개 수집 완료`);

  // 3. 영화 백필 (localhost 접속 → getMovieDetail 실행 → DB 저장)
  console.log("[3/4] 영화 백필 중...");
  let mOk = 0, mFail = 0;
  for (let i = 0; i < movieIds.length; i++) {
    const code = await warmPage(`http://127.0.0.1:3000/movie/${movieIds[i]}`);
    if (code === 200) mOk++; else mFail++;
    if ((i + 1) % 200 === 0) {
      const el = ((Date.now() - start) / 1000 / 60).toFixed(1);
      console.log(`  영화 ${i + 1}/${movieIds.length} (성공 ${mOk}, 실패 ${mFail}) — ${el}분`);
    }
    await sleep(DELAY_MS);
  }

  // 4. TV 백필 (season 1 접속)
  console.log("[4/4] TV 백필 중...");
  let tOk = 0, tFail = 0;
  for (let i = 0; i < tvIds.length; i++) {
    const code = await warmPage(`http://127.0.0.1:3000/tv/${tvIds[i]}/season/1`);
    if (code === 200) tOk++; else tFail++;
    if ((i + 1) % 200 === 0) {
      const el = ((Date.now() - start) / 1000 / 60).toFixed(1);
      console.log(`  TV ${i + 1}/${tvIds.length} (성공 ${tOk}, 실패 ${tFail}) — ${el}분`);
    }
    await sleep(DELAY_MS);
  }

  const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);
  console.log(`\n=== 완료 ===`);
  console.log(`영화: 성공 ${mOk}, 실패 ${mFail}`);
  console.log(`TV: 성공 ${tOk}, 실패 ${tFail}`);
  console.log(`총 소요: ${elapsed}분`);
}

main().catch((e) => { console.error("치명적 오류:", e); process.exit(1); });
