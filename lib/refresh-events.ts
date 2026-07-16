// 트래킹 변경 시 LibraryClient에 알림
const STALE_KEY = "seriez:library-stale";

export function markLibraryStale() {
  sessionStorage.setItem(STALE_KEY, "1");
}

export function consumeLibraryStale(): boolean {
  if (sessionStorage.getItem(STALE_KEY)) {
    sessionStorage.removeItem(STALE_KEY);
    return true;
  }
  return false;
}
