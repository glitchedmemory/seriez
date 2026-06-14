# 프로필 페이지 Light Mode 컬러 개선 기획서

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 프로필 페이지의 모든 컴포넌트(StreamingTop10, RouletteCard, Join Seriez 등)가 Light 모드에서도 완벽한 가시성을 갖도록 하드코딩된 색상을 시맨틱 변수로 교체

**Architecture:** Tailwind v4 CSS 변수 기반. `light.css`에 정의된 `--text-primary: #1a1a2e`(진남색), `--text-secondary: #6b5e7a`(자줏빛 회색) 등을 사용. 어두운 배경 컴포넌트는 `text-white` 또는 하드코딩 밝은 색상으로 오버라이드.

**Tech Stack:** Next.js 16, React, Tailwind CSS v4, CSS custom properties

---

## 진단: Light 모드에서 가시성 문제가 있는 섹션

### 🔴 심각 (텍스트 거의 안 보임)

| 섹션 | 파일 | 문제 |
|---|---|---|
| **RouletteCard** | `components/RouletteCard.tsx` | `text-text-primary`(`#1a1a2e`)를 `#1a1a3e`/`#13132e` 배경 위에 사용 → 동일 계열 진남색, 식별 불가 |
| **Join Seriez** | `app/profile/page.tsx:451-452` | `text-text-primary`를 `#4c1d95`→`#7c3aed` 그라데이션 위에 사용 → 어두운 텍스트 × 어두운 배경 |
| **SPIN 버튼** | `components/RouletteCard.tsx:82,106` | `text-text-primary`를 `#6366f1`→`#818cf8` 인디고 그라데이션 위에 사용 → 낮은 대비 |

### 🟡 보통 (흐릿하게 보임)

| 섹션 | 파일 | 문제 |
|---|---|---|
| **StreamingTop10 토글** | `components/StreamingTop10.tsx:166,176` | 비활성 텍스트 `#6b7280` 하드코딩 → Light 모드에서 중간 회색 |
| **StreamingTop10 랭크** | `components/StreamingTop10.tsx:227-234` | 2위 `#9ca3af`, 3위 `#d97706`, 4위+ `#6b7280` 하드코딩 → 흰 배경에 중간톤 |
| **StreamingTop10 로고** | `components/StreamingTop10.tsx:201-202` | 비활성 `opacity:0.45` + `grayscale(100%)` → 흰 배경에서 거의 소멸 |
| **StreamingTop10 빈포스터** | `components/StreamingTop10.tsx:255` | `text-[#4b5563]` on `bg-bg-primary`(`#f9f7f5`) → 비슷한 톤끼리 블렌딩 |

### 🟢 경미

| 섹션 | 파일 | 문제 |
|---|---|---|
| **AdSense placeholder** | `app/profile/page.tsx:339` | `border-border`(`#e8e3de`) 점선 → `#f9f7f5` 배경에서 매우 희미 |
| **Divider** | `app/history/HistoryClient.tsx:148` | `bg-border`(`#e8e3de`) → 구분선이 거의 안 보임 |

---

## 개선안

### Task 1: RouletteCard — 어두운 배경에 `text-white` 적용

**Objective:** `RouletteCard`의 모든 텍스트를 어두운 그라데이션 배경에서 읽을 수 있게 수정

**Files:** `components/RouletteCard.tsx`

**변경 내역:**

```
[IDLE 상태]
- line 69: text-text-primary → text-white
- line 74: text-text-secondary → text-white/70
- line 82: text-text-primary → text-white  (SPIN 버튼)

[MESSAGE 상태]
- line 102: text-text-secondary → text-white/70
- line 106: text-text-primary → text-white  (Try Again 버튼)

[RESULT 상태]
- line 159: text-text-primary → text-white (타이틀)
- line 167: text-accent-light → text-[#c4b5fd] (연도)
- line 170: text-text-secondary → text-white/50 (런타임)
- line 174: text-gold → text-amber-400 (별점)
- line 189: text-text-secondary → text-white/50 (장르)
- line 200: text-accent-light → text-[#c4b5fd] (태그라인)
- line 202: text-text-secondary → text-white/60 (줄거리)
```

### Task 2: Join Seriez — 게스트 섹션 텍스트 색상 수정

**Objective:** 어두운 그라데이션 배경 위 텍스트를 밝은 색으로 변경

**Files:** `app/profile/page.tsx`

**변경 내역:**

```
- line 451: text-text-primary → text-white  (Join Seriez 타이틀)
- line 452: text-text-primary/70 → text-white/70  (설명)
```

나머지 요소들(`text-3xl`, `bg-white text-[#7c3aed]` 버튼)은 이미 시각적으로 문제없음.

### Task 3: StreamingTop10 — 하드코딩 색상 시맨틱 변수화

**Objective:** `StreamingTop10`의 하드코딩된 gray/color 값을 Light 모드에서도 잘 보이도록 수정

**Files:** `components/StreamingTop10.tsx`

**변경 내역:**

```
[토글 버튼 - Movies/TV Shows]
- line 166 (Movies 비활성): color: "#6b7280" → color: "var(--text-secondary)"
- line 176 (TV Shows 비활성): color: "#6b7280" → color: "var(--text-secondary)"

[랭크 번호]
- line 231 (2위): "#9ca3af" → "var(--text-secondary)"  (더 진한 자줏빛 회색)
- line 233 (3위): "#d97706" → "#b45309"  (더 진한 호박색)
- line 234 (4위+): "#6b7280" → "var(--text-secondary)"

[비활성 로고]
- line 201 (opacity): opacity: isActive ? 1 : 0.45 → opacity: isActive ? 1 : 0.35
  // grayscale 그대로 유지; opacity만 살짝 줄여서 inactive일 때 더 연하게

[빈 포스터 플레이스홀더]
- line 255: text-[#4b5563] → text-text-secondary
```

### Task 4: AdSense / Divider — 경계선 대비 강화 (선택사항)

**Objective:** 점선 border와 divider가 Light 모드에서도 구분선 역할을 하도록 대비 개선

**Files:** `app/profile/page.tsx`, `app/history/HistoryClient.tsx`

**변경 내역:**

```
[AdSense placeholder]
- line 339: border-border → border-text-secondary/20
  // #e8e3de 대신 #6b5e7a 20% → 연보라색 점선으로 존재감 확보

[Divider]
- line 148: bg-border → bg-text-secondary/15
  // #e8e3de 대신 더 진한 연보라색
```

---

## 적용 파일 요약

| 파일 | 변경 수 | 위험도 |
|---|---|---|
| `components/RouletteCard.tsx` | ~13 라인 | 낮음 (배경이 항상 dark이므로 `text-white`가 양 테마에서 잘 보임) |
| `app/profile/page.tsx` | 2 라인 | 낮음 |
| `components/StreamingTop10.tsx` | 6 라인 | 낮음 (`var()`가 양 테마에서 해석됨) |
| `app/history/HistoryClient.tsx` | 1 라인 | 낮음 |

## 검증 방법

1. `npm run build` → 빌드 성공 확인
2. `seriez.app` Light 모드에서 프로필 페이지 접속
3. 각 섹션 육안 확인: StreamingTop10 랭크/토글, RouletteCard 텍스트, Join Seriez 텍스트
4. Dark 모드에서도 회귀 없음 확인 (`text-white`는 Dark 모드 배경에서도 잘 보임)
