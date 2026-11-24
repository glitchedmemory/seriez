/**
 * 애니 에피소드 썸네일 백필 v2 (안전 모드)
 *
 * 원칙
 *  1) 확실히 같은 작품·같은 회차라고 검증된 것만 채운다. 애매하면 절대 채우지 않는다.
 *     채울 수 없는 작품은 지금처럼 "No preview"로 남긴다.
 *  2) TMDB 는 애니에 절대 사용하지 않는다 (실사 썸네일 혼입 방지).
 *  3) 영화(MOVIE)·뮤직(MUSIC)은 대상에서 제외한다.
 *  4) 시즌이 통합된 작품(우리 26화 vs TVmaze 180화)은 건드리지 않는다.
 *
 * 확장 규칙
 *  우리 목록이 1화부터 연속이고, 원본이 그 뒤를 이어줄 때만 화수를 늘린다.
 *
 * 실행
 *   node scripts/backfill-thumbs-v2.mjs --dry
 *   node scripts/backfill-thumbs-v2.mjs --limit 50
 *   node scripts/backfill-thumbs-v2.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const LIMIT = (() => {
  const i = args.indexOf("--limit");
  return i >= 0 ? parseInt(args[i + 1], 10) : 0;
})();
// 중단 지점부터 이어서 실행 (이미 처리한 작품을 다시 조회하지 않는다)
const SKIP = (() => {
  const i = args.indexOf("--skip");
  return i >= 0 ? parseInt(args[i + 1], 10) : 0;
})();

const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] ||= m[2].trim();
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function jget(url) {
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (r.status === 429) { await sleep(3000 * (a + 1)); continue; }
      if (!r.ok) return null;
      return await r.json();
    } catch { await sleep(1200 * (a + 1)); }
  }
  return null;
}

const SEASON_MARKERS = /(\bseason\s*\d+\b|\b\d+(st|nd|rd|th)\s+season\b|\bpart\s*\d+\b|\bfinal\s+season\b|\bthe\s+movie\b|\bmovie\b|\bova\b|\bona\b|\bspecials?\b|\bsecond\s+season\b|\bthird\s+season\b|\bfourth\s+season\b|\bfinal\b)/i;
const baseTitle = (t) => (t || "").replace(SEASON_MARKERS, " ").replace(/[-–:]\s*$/, " ").replace(/\s*[-–:]\s*(the\s+)?movie.*$/i, " ").replace(/\s+/g, " ").trim();
const seasonNumber = (t) => {
  let m = t.match(/season\s*(\d+)/i); if (m) return parseInt(m[1], 10);
  if (/\b(2nd|second)\s+season\b/i.test(t)) return 2;
  if (/\b(3rd|third)\s+season\b/i.test(t)) return 3;
  if (/\b(4th|fourth)\s+season\b/i.test(t)) return 4;
  m = t.match(/\bpart\s*(\d+)\b/i); if (m) return parseInt(m[1], 10);
  return 1;
};
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

const TV_FORMATS = new Set(["TV", "TV_SHORT", "ONA", "OVA", "SPECIAL"]);

async function findTvmaze(titles, ourEps) {
  const ourNums = new Set(ourEps.map((e) => e.number));
  const ourMax = Math.max(0, ...ourNums);
  if (ourMax === 0) return null;

  let sequential = true;
  for (let i = 1; i <= ourMax; i++) if (!ourNums.has(i)) { sequential = false; break; }

  for (const raw of titles) {
    if (!raw) continue;
    const cands = (await jget("https://api.tvmaze.com/search/shows?q=" + encodeURIComponent(raw))) || [];
    await sleep(850);
    if (cands.length === 0) continue;

    const base = norm(baseTitle(raw));
    if (!base) continue;
    const sNum = seasonNumber(raw);

    for (const c of cands.slice(0, 4)) {
      const show = c?.show;
      // TVmaze 검색 결과에 show 가 null 인 항목이 섞여 온다 (실제로 발생함).
      if (!show || !show.name) continue;
      const cn = norm(show.name);

      // 제목이 정확히 같아야 한다.
      // 접두사 허용은 "Bubble"(영화) → "Bubble Guppies"(유아용) 같은 오매칭을 만든다.
      if (cn !== base) continue;

      // TVmaze 는 애니메이션 타입만 신뢰 (실사 드라마 차단)
      if (show.type && show.type !== "Animation") continue;

      const cSn = seasonNumber(show.name);
      if (cSn !== sNum && /\bseason\b|\bpart\b|\d(st|nd|rd|th)\s+season\b/i.test(show.name)) continue;

      const te = (await jget(`https://api.tvmaze.com/shows/${show.id}/episodes`)) || [];
      await sleep(850);
      if (te.length === 0) continue;

      const img = te.filter((e) => e.image);
      if (img.length === 0) continue;

      const tvMax = Math.max(...te.map((e) => e.number));
      const overlap = img.filter((e) => ourNums.has(e.number)).length;

      // 우리 목록과 겹치는 썸네일이 있어야 같은 작품으로 확신할 수 있다
      if (overlap === 0) continue;

      const expandable =
        sequential &&
        tvMax > ourMax &&
        te.length <= ourMax * 2.5;

      return { show, eps: te, img, expandable, tvMax, overlap };
    }
  }
  return null;
}

async function main() {
  console.log(DRY ? "=== DRY RUN (DB 쓰기 없음) ===" : "=== 실제 반영 ===");

  let rows = [];
  for (let from = 0; ; from += 500) {
    let data = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await supabase.from("anime_season_cache")
        .select("anilist_id, episodes, detail").not("episodes", "is", null)
        .order("anilist_id").range(from, from + 499);
      if (!res.error) { data = res.data; break; }
      if (!/timeout/i.test(res.error.message)) { console.error(res.error.message); process.exit(1); }
      await sleep(2500);
    }
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 500) break;
  }
  console.log(`전체 캐시: ${rows.length}`);

  const targets = [];
  for (const r of rows) {
    const eps = Array.isArray(r.episodes) ? r.episodes : [];
    if (eps.length === 0 || eps.length > 100) continue;
    const fmt = String(r.detail?.format || "").toUpperCase();
    if (!TV_FORMATS.has(fmt)) continue;
    if (eps.filter((e) => !e.thumbnail).length === 0) continue;
    targets.push({ id: r.anilist_id, eps, detail: r.detail || {}, pop: Number(r.detail?.popularity) || 0 });
  }
  targets.sort((a, b) => b.pop - a.pop);
  console.log(`대상: ${targets.length}개\n`);

  const all = targets.slice(SKIP);
  const work = LIMIT > 0 ? all.slice(0, LIMIT) : all;
  let thumbShows = 0, thumbEps = 0, expandedShows = 0, expandedEps = 0, fail = 0;
  const log = [];

  for (let i = 0; i < work.length; i++) {
    const t = work[i];
    const d = t.detail;
    const titles = [d.title, d.titleRomaji, d.titleEnglish, d.titleNative].filter(Boolean);
    if (titles.length === 0) { fail++; continue; }

    let found = null;
    try {
      found = await findTvmaze(titles, t.eps);
    } catch (e) {
      // 한 작품에서 예외가 나도 전체 백필이 멈추지 않게 한다.
      fail++;
      log.push(`${t.id}\t${d.title}\t예외 ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    if (!found) { fail++; log.push(`${t.id}\t${d.title}\t불가`); continue; }

    const ourNums = new Set(t.eps.map((e) => e.number));
    const ourMax = Math.max(...ourNums);
    let filled = 0;
    const merged = t.eps.map((e) => {
      if (e.thumbnail) return e;
      const hit = found.img.find((x) => x.number === e.number);
      if (hit) { filled++; return { ...e, thumbnail: hit.image }; }
      return e;
    });

    let added = 0;
    if (found.expandable) {
      const extra = found.img
        .filter((e) => e.number > ourMax && e.number <= found.tvMax)
        .sort((a, b) => a.number - b.number);
      for (const e of extra) {
        const tv = found.eps.find((x) => x.number === e.number);
        merged.push({
          title: tv?.name || `Episode ${e.number}`,
          number: e.number,
          airDate: tv?.airdate || "",
          duration: tv?.runtime || d.duration || 0,
          synopsis: "",
          thumbnail: e.image,
          titleJapanese: "",
        });
        added++;
      }
    }

    if (filled === 0 && added === 0) { fail++; log.push(`${t.id}\t${d.title}\t변화없음`); continue; }

    if (!DRY) {
      const { error } = await supabase.from("anime_season_cache")
        .upsert({ anilist_id: t.id, episodes: merged, updated_at: new Date().toISOString() },
                { onConflict: "anilist_id" });
      if (error) { fail++; log.push(`${t.id}\t${d.title}\t저장실패 ${error.message}`); continue; }
    }

    thumbShows++;
    thumbEps += filled;
    if (added > 0) { expandedShows++; expandedEps += added; }
    log.push(`${t.id}\t${d.title}\t썸네일+${filled} 확장+${added}`);
    console.log(`[${i + 1}/${work.length}] ${d.title} — 썸네일 ${filled}개${added ? `, 화수 ${added}개 추가` : ""}`);
    await sleep(600);
  }

  console.log("\n=== 결과 ===");
  console.log(`썸네일 채운 작품: ${thumbShows}`);
  console.log(`채운 썸네일: ${thumbEps}`);
  console.log(`에피소드 확장한 작품: ${expandedShows} (${expandedEps}화 추가)`);
  console.log(`제외/실패: ${fail}`);

  const out = path.join(process.cwd(), `backfill-${Date.now()}.log`);
  fs.writeFileSync(out, log.join("\n"), "utf8");
  console.log(`\n로그: ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
