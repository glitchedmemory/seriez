#!/usr/bin/env python3
"""CDN Cache Warming Script for Seriez — 20,000 titles (movies + TV + anime)."""
import subprocess, json, concurrent.futures, os

TMDB_KEY = os.environ.get("TMDB_API_KEY", "")
if not TMDB_KEY:
    for path in [".env.local", ".env.production"]:
        result = os.popen(f"grep TMDB_API_KEY {path} 2>/dev/null | cut -d= -f2").read().strip()
        if result:
            TMDB_KEY = result
            break

DOMAIN = os.environ.get("WARM_DOMAIN", "https://seriez.app")
MOVIE_PAGES = int(os.environ.get("WARM_MOVIE_PAGES", "335"))
TV_PAGES = int(os.environ.get("WARM_TV_PAGES", "335"))
ANIME_PAGES = int(os.environ.get("WARM_ANIME_PAGES", "132"))
CONCURRENT = int(os.environ.get("WARM_CONCURRENT", "50"))

def fetch_tmdb(endpoint, pages):
    ids = []
    for p in range(1, pages+1):
        r = subprocess.run(["curl", "-s", "-m", "10",
            f"https://api.themoviedb.org/3/{endpoint}?api_key={TMDB_KEY}&page={p}"],
            capture_output=True, text=True)
        try:
            data = json.loads(r.stdout)
            ids.extend([str(m["id"]) for m in data.get("results", [])])
        except Exception:
            pass
    return ids

def fetch_anilist(pages):
    ids = []
    for p in range(1, pages+1):
        r = subprocess.run(["curl", "-s", "-m", "10", "https://graphql.anilist.co",
            "-H", "Content-Type: application/json",
            "-d", json.dumps({"query": f"query {{ Page(page: {p}, perPage: 50) {{ media(sort: POPULARITY_DESC, type: ANIME) {{ id }} }} }}"})],
            capture_output=True, text=True)
        try:
            data = json.loads(r.stdout)
            ids.extend([str(m["id"]) for m in data.get("data",{}).get("Page",{}).get("media",[])])
        except Exception:
            pass
    return ids

def main():
    print("=== Seriez CDN Cache Warming (20K) ===")
    print(f"Pages: movies={MOVIE_PAGES}, tv={TV_PAGES}, anime={ANIME_PAGES}")

    movies = fetch_tmdb("movie/popular", MOVIE_PAGES)
    tv = fetch_tmdb("tv/popular", TV_PAGES)
    anime = fetch_anilist(ANIME_PAGES)
    print(f"IDs: {len(movies)} movies, {len(tv)} TV, {len(anime)} anime = {len(movies)+len(tv)+len(anime)} total")

    urls = [f"{DOMAIN}/title/{mid}" for mid in movies]
    urls += [f"{DOMAIN}/title/{tid}?type=tv" for tid in tv]
    urls += [f"{DOMAIN}/title/{tid}/season/1" for tid in tv]
    urls += [f"{DOMAIN}/title/{aid}?type=anime" for aid in anime]
    urls.append(f"{DOMAIN}/")
    urls.append(f"{DOMAIN}/search")
    print(f"Total URLs: {len(urls)}")

    done = [0]
    def warm(url):
        subprocess.run(["curl", "-s", "-o", "/dev/null", "-m", "15", url], timeout=20)
        done[0] += 1
        if done[0] % 500 == 0:
            print(f"  {done[0]}/{len(urls)}")

    print(f"Warming with {CONCURRENT} workers...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=CONCURRENT) as ex:
        list(ex.map(warm, urls))

    print(f"✓ Done! Warmed {len(urls)} pages.")

if __name__ == "__main__":
    main()
