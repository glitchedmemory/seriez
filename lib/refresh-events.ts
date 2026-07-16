// 전역 이벤트: 트래킹 변경 시 LibraryClient에 알림
export const LIBRARY_REFRESH_EVENT = "seriez:library-refresh";

export function notifyLibraryRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(LIBRARY_REFRESH_EVENT));
  }
}
