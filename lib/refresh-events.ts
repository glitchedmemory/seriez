// 트래킹 성공 시 My List 데이터 prefetch (브라우저 캐시)
export function prefetchLibrary(username: string, status: string) {
  const url = `/api/library?username=${encodeURIComponent(username)}&status=${status}&page=1&limit=50`;
  fetch(url, { priority: "low" as any }).catch(() => {});
}
