// 트래킹 변경 시 LibraryClient에 알림
export const LIBRARY_REFRESH_EVENT = "seriez:library-refresh";

export function notifyLibraryRefresh() {
  window.dispatchEvent(new CustomEvent(LIBRARY_REFRESH_EVENT));
}
