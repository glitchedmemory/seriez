# 🎨 GamePulse — UI/UX 디자인 기획서

## 1. 디자인 철학

**"경기장 전광판처럼 즉각적이고, AI 비서처럼 똑똑하며, 다크모드에 최적화된 질문 중심 경험."**

3가지 원칙:
- **Glanceable**: 1초 안에 점수·상황 파악 가능
- **Conversational**: 탭 없이 질문으로 모든 정보 접근
- **Ambient**: 앱을 켜놓기만 해도 경기 상황이 흘러들어옴

---

## 2. 컬러 시스템

### 다크 모드 (기본)

```
/* 배경 — layered darkness */
--bg-floor:      #0a0a0f     /* 최하층 — 앱 배경 */
--bg-base:        #111118     /* 기본 카드 배경 */
--bg-elevated:    #1a1a24     /* 상승된 카드 */
--bg-surface:     #222230     /* 최상층 — 인터랙션 요소 */

/* 텍스트 — off-white로 halation 방지 */
--text-primary:   #e8e8ed     /* 핵심 정보 (점수, 헤딩) */
--text-body:      #b0b0ba     /* 본문 */
--text-muted:     #6b6b78     /* 보조 정보 */

/* 액센트 */
--accent:         #7c5cfc     /* Primary — 질문/액션 */
--accent-glow:    #9d83ff     /* Hover/Active */
--live:           #22d65b     /* LIVE 상태 */
--live-glow:      #00ff66     /* LIVE 펄스 */
--warning:        #f59e0b     /* 주의 */
--danger:         #ef4444     /* 부상/위험 */

/* 팀 컬러 — 동적 (API에서 가져옴) */
/* Knicks: #f5842b / #006bb6 */
/* Spurs: #000000 / #c4ced4 */
```

### 라이트 모드 (선택)

```
--bg-floor:      #f2f1f6
--bg-base:       #ffffff
--bg-elevated:   #f8f8fc
--bg-surface:    #eeeef4
--text-primary:  #12121a
--text-body:     #4a4a58
--text-muted:    #8a8a98
```

---

## 3. 타이포그래피

| 용도 | 폰트 | 크기 | 웨이트 | 비고 |
|---|---|---|---|---|
| **경기 점수** | Inter Display | 42px | 800 | 가장 큰 요소 |
| 팀명 | Inter | 14px | 600 | 점수 옆 |
| 섹션 헤딩 | Inter | 13px | 600 | ALL CAPS, letter-spacing 0.06em |
| 질문 카드 타이틀 | Inter | 15px | 600 | |
| AI 답변 본문 | Inter | 14px | 400 | 라인하이트 1.5 |
| 스탯 수치 | Inter Display | 20px | 700 | 카드 내 |
| 스탯 레이블 | Inter | 10px | 500 | ALL CAPS, muted |
| LIVE 배지 | Inter | 9px | 700 | 펄스 애니메이션 |
| 시간·쿼터 | Inter | 12px | 500 | 탭 바 |

---

## 4. 화면 설계

### 4.1 메인 화면 — "Today's Games"

```
┌─────────────────────────────────────┐
│  ────────────────────────────────   │ ← Status Bar
│                                     │
│  GamePulse                          │ ← 로고 (작게, muted)
│                                     │
│  ┌  LIVE SCORES  ─────────────────┐ │
│  │                                │ │
│  │  ┌──────────────────────────┐  │ │  ← Bento Grid
│  │  │ 🟢 LIVE  Q4  4:12       │  │ │
│  │  │                          │  │ │
│  │  │  NYK    102              │  │ │    42px 점수
│  │  │  SAS     98              │  │ │
│  │  │                          │  │ │
│  │  │  🔥 B.BRUNSON  34pts    │  │ │    핵심 스탯
│  │  │  🔥 V.WEMBANYAMA 28pts  │  │ │
│  │  │                          │  │ │
│  │  │  [💬 Ask about game]    │  │ │    질문 트리거
│  │  └──────────────────────────┘  │ │
│  │                                │ │
│  │  ┌────────┐  ┌────────┐       │ │  작은 카드
│  │  │ 📊     │  │ 🏥     │       │ │
│  │  │ Stats  │  │Injuries│       │ │
│  │  └────────┘  └────────┘       │ │
│  │                                │ │
│  └────────────────────────────────┘ │
│                                     │
│  ┌  📌 QUESTIONS YOU'LL ASK  ─────┐ │  ← Pre-cached cards
│  │                                │ │
│  │  💭 Why are Spurs losing?      │ │
│  │     3PT 6-22 · TO 18 · Wemby 4PF
│  │                                │ │
│  │  💭 Brunson career high?       │ │
│  │     34pts · 70% FG · 5 3PT    │ │
│  │                                │ │
│  │  💭 Betting line movement?     │ │
│  │     NYK -1.5 → -3.5           │ │
│  │  ──────────────────────────── │ │
│  └────────────────────────────────┘ │
│                                     │
│  ┌────────────────────────────────┐ │
│  │ 💬 Ask anything about today... │ │  ← Floating input
│  └────────────────────────────────┘ │
│                                     │
│  [🏠]  [🔍]  [💬]  [👤]  [⚙️]     │ ← Tab Bar
└─────────────────────────────────────┘
```

**동작**:
- 상단 LIVE SCORES 카드: 탭하면 경기 상세로
- QUESTIONS YOU'LL ASK: 수직 스크롤, 각 카드 탭하면 AI 답변 확장
- 하단 질문 입력: 키보드 올리면 채팅 모드로 전환

### 4.2 경기 상세 화면 — "Game Pulse"

```
┌─────────────────────────────────────┐
│  ← Back        NYK vs SAS          │
│                                     │
│  ┌────────────────────────────────┐ │
│  │        🟢 LIVE  Q4  4:12       │ │
│  │                                │ │
│  │   NYK               SAS       │ │
│  │   102                98        │ │  ← 42px 점수
│  │                                │ │
│  │  ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░    │ │  ← 점유율/모멘텀 바
│  │         NYK 61%                │ │
│  │                                │ │
│  │  ┌─────────┐ ┌─────────┐      │ │
│  │  │ PTS │FG%│ │ PTS │FG%│      │ │  ← Bento stat cards
│  │  │ 34 │70%│ │ 28 │52%│      │ │
│  │  │Brunson │ │Wemby  │      │ │
│  │  └─────────┘ └─────────┘      │ │
│  │  ┌─────────┐ ┌─────────┐      │ │
│  │  │ REB │AST│ │ REB │BLK│      │ │
│  │  │  8 │ 5 │ │ 12 │ 4 │      │ │
│  │  └─────────┘ └─────────┘      │ │
│  └────────────────────────────────┘ │
│                                     │
│  ┌─ 📊 TEAM STATS ────────────────┐│
│  │  FG%  48%  ┃  43%             ││
│  │  3PT%  38%  ┃  27%            ││
│  │  TO    9    ┃  18             ││
│  │  REB   42   ┃  38             ││
│  └────────────────────────────────┘│
│                                     │
│  ┌─ ⏱️ TIMELINE ─────────────────┐│
│  │  ● Q1 8:14 Brunson 3PT        ││
│  │  ○ Q2 4:22 Wemby Block        ││
│  │  ● Q3 4:18 NYK 12-0 RUN 🔥   ││
│  │  ● Q4 6:02 Brunson 30pts      ││
│  │  ● Q4 2:01 Brunson 40pts 🚀   ││
│  └────────────────────────────────┘│
│                                     │
│  ┌─ 💰 ODDS ──────────────────────┐│
│  │  Spread:  NYK -3.5  (opened -1.5)
│  │  ML:      NYK -165 / SAS +145 ││
│  │  O/U:     218.5                ││
│  └────────────────────────────────┘│
└─────────────────────────────────────┘
```

**제스처**:
- 좌우 스와이프: 다른 라이브 경기로 전환
- 위로 스크롤: 더 많은 상세 정보
- 타임라인 탭: 해당 이벤트 AI 설명 팝업

### 4.3 질문 화면 — "Ask GamePulse"

```
┌─────────────────────────────────────┐
│  ← Back                            │
│                                     │
│  ┌─ 🏀 NYK 102 — 98 SAS ─────────┐│ ← 경기 컨텍스트 바
│  │  Q4 4:12  ·  Brunson 34pts    ││
│  └────────────────────────────────┘│
│                                     │
│  ┌────────────────────────────────┐ │
│  │                                │ │
│  │   🤔  What do you want to      │ │  ← 질문 입력
│  │       know about this game?    │ │
│  │   ┌────────────────────────┐   │ │
│  │   │ Brunson stats?         │   │ │  ← 예시 텍스트, 페이드
│  │   └────────────────────────┘   │ │
│  │                                │ │
│  │  ┌──────┐ ┌──────┐ ┌──────┐   │ │  ← Quick Chip
│  │  │Score │ │Stats │ │Odds  │   │ │
│  │  └──────┘ └──────┘ └──────┘   │ │
│  │  ┌──────┐ ┌──────┐ ┌────────┐ │ │
│  │  │Injury│ │Stream│ │Compare │ │ │
│  │  └──────┘ └──────┘ └────────┘ │ │
│  └────────────────────────────────┘ │
│                                     │
│  ┌────────────────────────────────┐ │
│  │  📌 QUICK ANSWERS             │ │
│  │                                │ │
│  │  ┌────────────────────────┐   │ │  ← Pre-cached card
│  │  │ 🔥 Top scorer tonight  │   │ │
│  │  │ Brunson 34pts (12-18)  │   │ │
│  │  │ Wemby 28pts (11-21)    │   │ │
│  │  └────────────────────────┘   │ │
│  │  ┌────────────────────────┐   │ │
│  │  │ 📊 FG% comparison      │   │ │
│  │  │ NYK 48% — SAS 43%      │   │ │
│  │  └────────────────────────┘   │ │
│  │  ┌────────────────────────┐   │ │
│  │  │ ⚡ Momentum tracker     │   │ │
│  │  │ Last 5min: NYK +8      │   │ │
│  │  └────────────────────────┘   │ │
│  └────────────────────────────────┘ │
│                                     │
│  [🎤 Voice]  ┌──────────────────┐  │ │ ← 음성 입력 버튼
│              │ Type question... │  │ │
│              └──────────────────┘  │ │
└─────────────────────────────────────┘
```

### 4.4 AI 답변 — "Rich Answer Card"

```
┌─────────────────────────────────────┐
│                                     │
│  You:                               │
│  "왜 Spurs가 지고 있어?"           │ ← 사용자 메시지 (우측)
│                                     │
│  GamePulse:                         │
│  ┌────────────────────────────────┐ │
│  │  Spurs는 3가지 요인으로        │ │  ← AI 답변 (좌측)
│  │  열세입니다:                   │ │
│  │                                │ │
│  │  ┌─────────────────────────┐   │ │  ← Rich Inline Cards
│  │  │ 🎯 3-POINT SHOOTING     │   │ │
│  │  │                         │   │ │
│  │  │  Spurs    6-22  27%    │   │ │
│  │  │  Season avg   36%      │   │ │
│  │  │  ▓▓▓▓░░░░░░░░░░░░░░   │   │ │
│  │  └─────────────────────────┘   │ │
│  │  ┌─────────────────────────┐   │ │
│  │  │ ⚠️ TURNOVERS            │   │ │
│  │  │                         │   │ │
│  │  │  18   vs  9             │   │ │
│  │  │  SAS      NYK          │   │ │
│  │  │  ▓▓▓▓▓▓  ▓▓▓▓         │   │ │
│  │  └─────────────────────────┘   │ │
│  │  ┌─────────────────────────┐   │ │
│  │  │ 🏥 FOUL TROUBLE         │   │ │
│  │  │                         │   │ │
│  │  │  Wemby  4 PF            │   │ │
│  │  │  Q3 only 8 min played   │   │ │
│  │  │  🟡🟡🟡🟡⚪⚪          │   │ │
│  │  └─────────────────────────┘   │ │
│  │                                │ │
│  │  종합: 3점 난조 + 실책 +      │ │
│  │  수비 핵심 파울 트러블.        │ │
│  │  4Q에 Wemby 복귀했지만         │ │
│  │  공격 리듬 회복 필요.          │ │
│  │                                │ │
│  │  ┌──────┐ ┌──────┐ ┌──────┐   │ │  ← Follow-up Chips
│  │  │Odds? │ │Stream│ │H2H?  │   │ │
│  │  └──────┘ └──────┘ └──────┘   │ │
│  └────────────────────────────────┘ │
│                                     │
│  ┌────────────────────────────────┐ │
│  │ 💬 Ask follow-up...            │ │
│  └────────────────────────────────┘ │
│                                     │
│  [👍] [👎] [📋 Copy]                │  ← 피드백
└─────────────────────────────────────┘
```

---

## 5. 핵심 UI 컴포넌트

### 5.1 Live Score Card

```
┌──────────────────────────────┐
│  🟢 LIVE  Q4 4:12           │ ← Pulsing dot (CSS animation)
│                              │
│  [Knicks logo] 102           │ ← 팀 컬러 좌측 액센트 바
│  [Spurs logo]   98           │
│                              │
│  🔥 Brunson  34 PTS 12-18   │ ← 플레이어 하이라이트
│     Wemby    28 PTS 11-21   │
│                              │
│  ───────────────────────────│
│  💬 Ask about this game  →  │ ← 터치 영역 (전체 카드)
└──────────────────────────────┘
```

**스펙**:
- 배경: `--bg-elevated` (#1a1a24)
- 좌측 테두리: 각 팀 컬러 3px vertical bar (Knicks 오렌지 + Spurs 실버)
- LIVE dot: `--live` (#22d65b), `box-shadow: 0 0 8px var(--live-glow)`, 2s pulse
- 카드 radius: 16px
- 터치 시: scale 0.98, 150ms ease-out

### 5.2 Player Stat Bento Card

```
┌──────────────┐
│  B. BRUNSON  │ ← 10px, ALL CAPS, muted
│     34       │ ← 20px, Display, bold
│    POINTS    │ ← 9px, ALL CAPS, muted, letter-spacing 0.08em
│              │
│  FG  12-18   │ ← 12px
│  3PT  5-7    │
│              │
│  vs avg +20% │ ← 10px, green (양수)
└──────────────┘
```

**스펙**:
- 배경: `--bg-base` (#111118)
- border: 1px solid `--bg-surface`
- 상단에 팀 컬러 2px 액센트 라인
- radius: 12px

### 5.3 Question Chip

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  🏆 Score    │  │  📊 Stats    │  │  💰 Odds     │
└──────────────┘  └──────────────┘  └──────────────┘
```

**스펙**:
- 배경: `--bg-surface`
- 텍스트: `--text-body`
- 터치/활성화: 배경 `--accent`, 텍스트 white
- radius: 20px (pill)
- 패딩: 8px 16px
- transition: 150ms

### 5.4 Timeline Event

```
● Q3 4:18 ──── NYK 12-0 RUN ──── 🔥
  │
  ○ Q2 4:22  Wemby Block #1
  │
  ● Q1 8:14  Brunson 3PT (NYK 8-2)
```

**스펙**:
- 세로 라인: 1px `--bg-surface`
- 이벤트 dot: 8px circle, 팀 컬러
- 주요 이벤트: dot 10px + glow
- 탭: AI 설명 바텀시트
- 폰트: 11px, `--text-body` (일반) / `--text-primary` (주요)

### 5.5 Answer Rich Card

```
┌──────────────────────────────┐
│  📊 FG% COMPARISON          │ ← 아이콘 + 타이틀 (13px, bold)
│                              │
│  NYK  48%  ████████░░░░░░   │ ← 팀컬러 프로그레스 바
│  SAS  43%  ███████░░░░░░░   │
│                              │
│  ──────────────────────     │
│  Knicks가 5%p 더 효율적인   │ ← AI 코멘트 (12px, body)
│  슈팅. 특히 페인트존 62%.   │
└──────────────────────────────┘
```

---

## 6. 모션 & 마이크로인터랙션

### 6.1 LIVE 펄스 인디케이터

```css
@keyframes live-pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 var(--live-glow); }
  50%      { opacity: 0.6; box-shadow: 0 0 12px 2px var(--live-glow); }
}
/* 2초 주기, ease-in-out */
```

### 6.2 점수 변경 애니메이션

- 점수가 바뀔 때: 숫자 색상이 팀 컬러로 300ms 깜빡임 → 원래 색으로 복귀
- 스프링 애니메이션 (scale 1 → 1.15 → 1, 400ms)

### 6.3 카드 확장

- 탭 시: accordion 방식으로 아래로 확장 (max-height transition, 300ms)
- 부드러운 ease-out, 높이 자연스럽게

### 6.4 새 정보 진입

- 새로운 answer card: 아래에서 slide up + fade in (300ms, 50px 오프셋)
- AI 텍스트: 한 글자씩 스트리밍되지 않고 **청크 단위로 fade in** (가독성 우선)

### 6.5 스와이프 경기 전환

- 좌우 스와이프: spring physics (200ms)
- 인디케이터: 작은 dot 페이지네이션
- 햅틱: UIImpactFeedback (iOS)

---

## 7. 접근성

| 요소 | 기준 |
|---|---|
| 색상 대비 | 모든 텍스트 ≥ 4.5:1 (WCAG AA) |
| 터치 타겟 | 최소 44×44px (Apple HIG) |
| 다이나믹 타입 | 시스템 폰트 사이즈 조정 반영 |
| VoiceOver | 모든 카드에 accessibilityLabel |
| 모션 감소 | prefers-reduced-motion 시 애니메이션 비활성화 |

---

## 8. 반응형 브레이크포인트

| 뷰포트 | 레이아웃 |
|---|---|
| 320-428px (iPhone) | 단일 컬럼. 경기 카드 전체 너비 |
| 429-768px (iPad Mini) | 2컬럼 bento grid |
| 769px+ (iPad Pro) | 사이드바 + 메인 2컬럼. 왼쪽에 질문 히스토리 |
| 1024px+ (Desktop) | 3컬럼: 질문 입력 | 메인 피드 | 컨텍스트 패널 |

---

## 9. 기술 구현 (Next.js + Tailwind v4)

```tsx
// 예시: LiveScoreCard 컴포넌트
<article className={cn(
  "relative overflow-hidden rounded-2xl",
  "bg-bg-elevated border border-bg-surface",
  "active:scale-[0.98] transition-transform duration-150",
)}>
  {/* 좌측 팀컬러 액센트 */}
  <div className="absolute left-0 top-0 bottom-0 w-[3px] flex flex-col">
    <div className="flex-1" style={{ background: awayColor }} />
    <div className="flex-1" style={{ background: homeColor }} />
  </div>
  
  {/* LIVE 인디케이터 */}
  <div className="flex items-center gap-2 px-4 pt-3">
    <span className="w-2 h-2 rounded-full bg-live animate-pulse-live" />
    <span className="text-[9px] font-bold text-live tracking-[0.1em] uppercase">
      LIVE
    </span>
    <span className="text-xs text-text-muted ml-auto">
      Q4 4:12
    </span>
  </div>
  
  {/* 점수 */}
  <div className="px-4 py-2">
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold text-text-primary">NYK</span>
      <span className="text-[42px] font-extrabold text-text-primary tabular-nums">
        102
      </span>
    </div>
    {/* ... */}
  </div>
</article>
```

---

## 10. 디자인 레퍼런스

| 앱/트렌드 | 적용할 요소 |
|---|---|
| **theScore** | 다크 전용, 카드 기반 피드, 팀 컬러 액센트 |
| **SofaScore** | Bento stat cards, 프로그레스 바, 선수 비교 |
| **Perplexity AI** | Rich inline cards, follow-up chips, 소스 인용 |
| **Apple Sports** | 초미니멀 점수 표시, 햅틱, 다이나믹 아일랜드 |
| **2026 Bento Grid** | 모듈형 통계 카드, 비대칭 그리드 |
| **2026 Dark Mode** | Layered darkness, off-white 텍스트, 네온 액센트 |
| **Conversational UI** | Intent shortcuts, rich embedded cards, streaming markdown |
