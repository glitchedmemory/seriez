"use client";

import { useEffect, useRef } from "react";

/**
 * HumanProof — 클라이언트에서 "진짜 사람"임을 증명하는 신호를 서버로 보냅니다.
 *
 * 진짜 사람만 충족하는 조건 (모두 만족해야 POST):
 *   1. React/JS가 실제로 실행됨 (헤드리스 봇은 이 코드를 못 돌림)
 *   2. 마우스/터치/스크롤 등 실제 상호작용 1회 이상
 *   3. 최소 체류시간(MIN_DWELL_MS) 경과
 *
 * 이 세 조건을 모두 통과한 방문만 /api/human-proof로 기록되어,
 * "진짜 사람 방문자 수"를 정확히 셀 수 있습니다.
 */

const MIN_DWELL_MS = 3000; // 최소 체류시간 3초
const MIN_MOVES = 3; // 최소 마우스/터치 움직임 횟수 (봇 우회 방지용으로 3회 상향)

export default function HumanProof() {
  const fired = useRef(false);
  const moveCount = useRef(0); // 실제 마우스/터치 이동만 카운트

  useEffect(() => {
    if (fired.current) return;

    const pageLoadedAt = Date.now();
    let sendCleanup: (() => void) | null = null;

    const recordInteraction = () => {
      moveCount.current += 1;
    };

    // 봇이 흉내내기 어려운 "실제 마우스/터치 이동" 이벤트만 카운트
    // (mousemove: 데스크톱 마우스, touchmove: 모바일 터치 드래그)
    const moveEvents: (keyof WindowEventMap)[] = ["mousemove", "touchmove"];
    for (const ev of moveEvents) {
      window.addEventListener(ev, recordInteraction, { passive: true });
    }

    const sendProof = () => {
      if (fired.current) return;
      if (moveCount.current < MIN_MOVES) return;
      if (Date.now() - pageLoadedAt < MIN_DWELL_MS) return;
      fired.current = true;

      const payload = {
        path: window.location.pathname,
        referrer: document.referrer || null,
        locale: document.documentElement.lang || null,
        mouseEventCount: moveCount.current,
        pageLoadedAt: new Date(pageLoadedAt).toISOString(),
      };

      // sendBeacon: 페이지 이탈/새로고침에도 유실되지 않음
      try {
        const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/human-proof", blob);
        } else {
          fetch("/api/human-proof", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        fetch("/api/human-proof", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {});
      }

      if (sendCleanup) sendCleanup();
    };

    // 체류시간 + 상호작용 모두 충족하는 순간 전송
    // 500ms마다 체크 (최악의 경우 500ms 지연, 정확도에 영향 없음)
    const interval = setInterval(sendProof, 500);

    // 마지막 방어: 충분히 오래 머물렀다면 이벤트가 없어도 1회 확정
    // (단, 상호작용 0이면 봇일 수 있으므로 이 조건은 제거하고 위 sendProof의 interaction 체크로만 판단)

    sendCleanup = () => {
      clearInterval(interval);
      for (const ev of moveEvents) {
        window.removeEventListener(ev, recordInteraction);
      }
    };

    // 30초 후에는 확정/포기 여부와 무관하게 정리
    const hardTimeout = setTimeout(() => {
      if (sendCleanup) sendCleanup();
    }, 30000);

    return () => {
      clearInterval(interval);
      clearTimeout(hardTimeout);
      if (sendCleanup) sendCleanup();
    };
  }, []);

  return null;
}
