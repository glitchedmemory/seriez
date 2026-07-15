#!/usr/bin/env python3
"""CDN Cache Warming Script for Seriez — 20,000 titles with checkpoint support."""
import subprocess, json, concurrent.futures, os, sys, time

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
CONCURRENT = int(os.environ.get("WARM_CONCURRENT", "15"))

CHECKPOINT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".warm-checkpoints")
CHECKPOINT_FILE = os.path.join(CHECKPOINT_DIR, "warm-cursor.txt")

def load_checkpoint():
    """Return the last completed URL index, or 0 if starting fresh."""
    try:
        with open(CHECKPOINT_FILE, "r") as f:
            idx = int(f.read().strip())
            print(f"Resuming from checkpoint: URL #{idx+1}")
            return idx
    except (FileNotFoundError, ValueError):
        return 0

def save_checkpoint(idx):
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)
    with open(CHECKPOINT_FILE, "w") as f:
        f.write(str(idx))

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
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)

    print("=== Seriez CDN Cache Warming (20K, checkpointed) ===")
    print(f"Pages: movies={MOVIE_PAGES}, tv={TV_PAGES}, anime={ANIME_PAGES}, workers={CONCURRENT}")

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

    start_idx = load_checkpoint()
    urls = urls[start_idx:]
    if start_idx > 0:
        print(f"Skipping first {start_idx} URLs (already done)")

    done = [start_idx]
    total = start_idx + len(urls)
    errors = [0]

    def warm(url):
        r = None
        for attempt in range(2):
            r = subprocess.run(["curl", "-s", "-o", "/dev/null", "-m", "15", url], timeout=20)
            if r.returncode == 0:
                break
            if attempt == 0:
                time.sleep(0.5)
        done[0] += 1
        if r is not None and r.returncode != 0:
            errors[0] += 1
        save_checkpoint(done[0])
        if done[0] % 100 == 0:
            print(f"  {done[0]}/{total} (errors: {errors[0]})", flush=True)

    print(f"Warming {len(urls)} URLs with {CONCURRENT} workers...")
    start_time = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=CONCURRENT) as ex:
        list(ex.map(warm, urls))

    elapsed = time.time() - start_time
    print(f"Done! {done[0]}/{total} pages in {elapsed:.0f}s, {errors[0]} errors.")
    # Clear checkpoint on success
    save_checkpoint(total)
    os.remove(CHECKPOINT_FILE)

if __name__ == "__main__":
    main()
