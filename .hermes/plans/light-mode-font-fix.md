# Seriez Light Mode Font Color Fix — 실행 계획

## 개요

35개 파일, 약 180개 이상의 `text-white` 하드코딩을 CSS 변수 기반으로 교체하여
Light Mode에서 모든 텍스트가 정상적으로 보이도록 수정.

---

## 현재 테마 구조 (양호함)

`globals.css`의 CSS 변수는 이미 잘 분리되어 있음:

| 변수 | Dark (`:root`) | Light (`.light`) |
|---|---|---|
| `--text-primary` | `#ffffff` | `#1a1a2e` |
| `--text-secondary` | `#9ca3af` | `#6b5e7a` |
| `--bg-primary` | `#0f0f1a` | `#f9f7f5` |
| `--bg-card` | `#1a1a2e` | `#ffffff` |
| `--bg-surface` | `#25253a` | `#f3f0ed` |
| `--border-color` | `#2a2a45` | `#e8e3de` |

문제는 컴포넌트들이 이 변수를 무시하고 하드코딩된 다크모드 색상을 직접 사용한다는 것.

---

## 교체 규칙

### ✅ 변경: `text-white` → `text-text-primary`
- 모든 **헤딩**(h1, h2, h3, strong)
- 모든 **일반 텍스트**(span, p, label 등) — 컬러 배경 위가 아닌 경우
- `bg-bg-card`, `bg-bg-primary`, `bg-bg-surface` 컨텍스트 내 텍스트
- `bg-[#0f0f1a]`, `bg-[#1a1a2e]`, `bg-[#25253a]` 하드코딩 배경도 같이 `bg-bg-primary`/`bg-bg-card`/`bg-bg-surface`로 변경

### 🛑 유지: `text-white` (컬러 배경 위)
- `bg-accent text-white` — 보라색 액센트 배경 + 흰색 글씨 (양 모드에서 가독성 OK)
- `bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white` — 그라디언트 배경
- `bg-red-600 text-white`, `bg-gold text-black` — 이미 양 모드 고려된 조합
- `bg-[#2d2d4a]` (hover 전용) — 다크모드 전용 hover 효과

### ⚠️ 특수 케이스
- `text-white/50`, `text-white/70` 등 opacity 버전 → `text-text-primary/50`, `text-text-primary/70` 등
- `hover:text-white` (text-secondary에서 hover 시) → 유지 (hover 효과)
- `text-white/10`, `text-white/15`, `text-white/20` (포스터 플레이스홀더) → `text-text-primary/10` 등

---

## 파일별 작업 목록

### Phase 1 — 핵심 페이지 (사용자 노출도 최상)

#### 1. `app/profile/page.tsx` (24개소)
- [ ] h1/h2/strong → `text-text-primary`
- [ ] 일반 span → `text-text-primary`
- [ ] `text-white/50`, `text-white/70` → `text-text-primary/50` 등
- [ ] `text-white/15` (포스터 플레이스홀더) → `text-text-primary/10`
- [ ] `ring-[#0f0f1a]` → `ring-bg-primary`
- [ ] `bg-[#2d2d4a]` skeleton → `bg-bg-surface`
- 🛑 유지: `bg-accent text-white`, `bg-[#6366f1] to-[#a855f7] text-white`

#### 2. `app/profile/settings/page.tsx` (15개소)
- [ ] h1, span 텍스트 → `text-text-primary`
- [ ] input의 `text-white` → `text-text-primary`
- [ ] Settings/Change Profile/Appearance 등 레이블 → `text-text-primary`
- 🛑 유지: `bg-accent text-white`

#### 3. `app/profile/settings/change-profile/page.tsx` (8개소)
- [ ] h1, h2, strong → `text-text-primary`
- [ ] `ring-[#0f0f1a]` → `ring-bg-primary`
- 🛑 유지: bg-gradient 위 avatars, SVG icon (크기가 작아서 OK)

#### 4. `components/HomeClient.tsx` (14개소)
- [ ] h2 섹션 타이틀 → `text-text-primary`
- [ ] 포스터 카드 타이틀 → `text-text-primary`
- [ ] search input → `text-text-primary`
- [ ] 트렌딩 탭 active/inactive — `text-text-primary` + `text-text-secondary`로 변경
- 🛑 유지: `bg-accent` 기반 뱃지

#### 5. `components/DetailClient.tsx` (12개소)
- [ ] h1, h2 → `text-text-primary`
- [ ] cast 이름 → `text-text-primary`
- [ ] scroll 버튼 → `text-text-primary`
- [ ] recommended 타이틀 → `text-text-primary`
- 🛑 유지: `bg-accent text-white`

#### 6. `components/SeasonClient.tsx` (21개소)
- [ ] h1, h2, h3 → `text-text-primary`
- [ ] episode 타이틀, cast 이름 → `text-text-primary`
- [ ] scroll 버튼 → `text-text-primary`
- [ ] season 선택기 hover → `hover:text-text-primary`
- 🛑 유지: `bg-accent text-white`

#### 7. `components/AnimeDetailClient.tsx` (22개소)
- [ ] h1, h2 → `text-text-primary`
- [ ] episode/character 타이틀 → `text-text-primary`
- 🛑 유지: `bg-accent text-white`

### Phase 2 — 기능 페이지

#### 8. `app/login/page.tsx` (6개소)
- [ ] h1 → `text-text-primary`
- [ ] input → `text-text-primary`
- 🛑 유지: `bg-accent text-white`

#### 9. `app/signup/page.tsx` (5개소)
- [ ] h1 → `text-text-primary`
- [ ] input → `text-text-primary`
- 🛑 유지: `bg-accent text-white`

#### 10. `app/search/page.tsx` (4개소)
- [ ] input → `text-text-primary`
- [ ] 결과 타이틀 → `text-text-primary`
- [ ] 플레이스홀더 `text-white/20` → `text-text-primary/10`

#### 11. `app/onboarding/page.tsx` (9개소)
- [ ] h2, p 타이틀 → `text-text-primary`
- [ ] input → `text-text-primary`
- 🛑 유지: `bg-accent text-white`, 그라디언트 버튼

#### 12. `app/feed/page.tsx` (3개소)
- [ ] h2 → `text-text-primary`
- [ ] username → `text-text-primary`
- [ ] 플레이스홀더 → `text-text-primary/10`

### Phase 3 — History & 기타 컴포넌트

#### 13. `app/history/HistoryClient.tsx` (5개소)
- [ ] h1, h2 → `text-text-primary`
- [ ] Taste Profile 배지 → `text-text-primary` (이미 `bg-accent`)
- [ ] `bg-[#0a0a14]` → `bg-bg-primary`
- [ ] `text-[#e5e7eb]` → `text-text-primary`

#### 14. `app/history/WatchList.tsx` (3개소)
- [ ] h2, p → `text-text-primary`
- [ ] `text-white/60` → `text-text-primary/60`
- [ ] `divide-[#1a1a2e]` → `divide-border`

#### 15. `app/history/PosterCalendar.tsx` (4개소)
- [ ] h2 → `text-text-primary`
- [ ] `text-white/60` → `text-text-primary/60`
- 🛑 유지: `bg-accent text-white`

#### 16. `app/history/DayPopup.tsx` (5개소)
- [ ] h3, span → `text-text-primary`
- [ ] `text-white/60` → `text-text-primary/60`
- [ ] `bg-[#2d2d4a]` → `bg-bg-surface`

#### 17. `app/history/TopGenres.tsx` (2개소)
- [ ] h3 → `text-text-primary`
- [ ] `bg-[#1e1b4b]` (genre badge) → `bg-accent/15`

#### 18. `app/history/WatchGraph.tsx` (1개소)
- [ ] h2 → `text-text-primary`
- [ ] `backgroundColor: "#1a1a2e"` → `var(--bg-card)` (or keep, recharts doesn't support CSS vars well)
- [ ] `fill: "#6b7280"` tick → 중립 색상으로 OK

### Phase 4 — 공유 컴포넌트

#### 19. `components/ReviewSection.tsx` (20개소)
- [ ] h2, username, 리뷰 텍스트 → `text-text-primary`
- [ ] input → `text-text-primary`
- [ ] `bg-bg-surface text-white` input → `text-text-primary`
- 🛑 유지: avatar `bg-gradient`, `bg-accent text-white`, `bg-red-600 text-white`

#### 20. `components/LibraryClient.tsx` (12개소)
- [ ] h2, p → `text-text-primary`
- [ ] 컬렉션 이름 → `text-text-primary`
- [ ] input → `text-text-primary`
- [ ] 플레이스홀더 → `text-text-primary/20`
- 🛑 유지: `bg-accent text-white`, `bg-red-500 text-white`

#### 21. `components/CollectionClient.tsx` (10개소)
- [ ] h1, h2, p → `text-text-primary`
- [ ] input → `text-text-primary`
- 🛑 유지: `bg-accent text-white`, avatar gradient

#### 22-35. 나머지 컴포넌트
- `components/HeroCard.tsx` (6개소) — h2, p → `text-text-primary` / 유지: `bg-white/10` 위 텍스트
- `components/TabBar.tsx` (7개소) — username, initial → `text-text-primary`
- `components/GenreChips.tsx` (2개소) — 🛑 대부분 유지 (active/inactive 패턴)
- `components/PosterStack.tsx` (4개소) — drop-shadow 조합이므로 신중히
- `components/PosterCard.tsx` (2개소) → `text-text-primary`
- `components/PersonClient.tsx` (5개소) → `text-text-primary`
- `components/RouletteCard.tsx` (5개소) → `text-text-primary`
- `components/StreamingTop10.tsx` (3개소) → `text-text-primary`
- `components/EmptyState.tsx` (2개소) → `text-text-primary`
- `components/ErrorBoundary.tsx` (2개소) → `text-text-primary`
- `components/ScrollToTop.tsx` (1개소) → 🛑 유지 (accent 배경)
- `components/PublishedCollections.tsx` (4개소) → `text-text-primary`
- `components/PosterImage.tsx` (1개소) → `text-text-primary/20`
- `components/TMDBRatingChart.tsx` (2개소) → `text-text-primary/30`
- `app/admin/reports/page.tsx` (1개소) → `text-text-primary`, `bg-[#0a0a1a]` → `bg-bg-primary`

---

## 추가 개선: globals.css Light Mode 조정

Light mode 변수 일부 미세 조정 제안:
- `--text-secondary: #6b5e7a` → `#5a5070` (대비 약간 높임)
- `--border-color: #e8e3de` → `#ddd8d3` (좀 더 선명한 경계선)

---

## 실행 후 검증 체크리스트

- [ ] `npm run build` 통과
- [ ] Light Mode 전환 후 모든 페이지 텍스트 가시성 확인
- [ ] Dark Mode 전환 후 기존 디자인 깨짐 없는지 확인
- [ ] accent 버튼, red 버튼 텍스트 정상 표시 확인
- [ ] hover:text-white 효과 정상 작동 확인

---

## 변경하지 않는 것들 (의도적 유지)

1. `bg-accent text-white` / `bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white` — 컬러 배경 + 흰색은 양 모드 OK
2. `bg-red-600 text-white` — 삭제 버튼
3. `bg-gold text-black` — 이미 고대비 조합
4. `hover:text-white` — 상호작용 효과로 유지
5. SVG 아이콘의 `text-white` — 크기가 작아 가시성 영향 미미
6. `text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]` — 포스터 위 오버레이 텍스트 (어두운 이미지 위)

---

## 예상 작업 시간
- Phase 1: 30분 (가장 복잡하고 중요한 파일들)
- Phase 2: 15분
- Phase 3: 15분
- Phase 4: 15분
- 검증: 10분
- **총 예상: 약 1시간 30분**
