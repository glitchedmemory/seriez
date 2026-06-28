# Tonight's Pick — 큐레이션 기획서 v2

**작성일:** 2026-06-28
**원칙:** TMDB × Anime = 절대 금지 · trending 섹션과 중복 금지

---

## 1. 개요

현재 사이트에는 이미 4개의 추천 섹션이 존재한다: For You, Trending This Week, Coming Soon, Box Office. 이들은 전부 인기/트렌드 기반이라 서로 겹치는 콘텐츠가 많다.

Tonight's Pick은 이들과 완전히 다른 포지셔닝으로, **"발견의 즐거움"**을 주는 큐레이션이다. 세 가지 전략을 조합해 매일 다른 각도로 숨은 보석을 추천한다.

---

## 2. 세 가지 전략

### A. Hidden Gem — 평점은 높은데 아는 사람이 적은 작품

TMDB discover API로 다음 조건을 충족하는 작품을 찾는다:

- 평점 ≥ 7.5
- vote_count ≤ 300 (소수의 사람만 평가 → 대중에게 덜 알려짐)
- popularity ≤ 15 (TMDB 자체 인기도 낮음)
- 장르 ≠ Animation (16) — 애니메는 AniList에서만
- 최근 10년 내 개봉작 (오래된 건 접근성이 떨어짐)

애니메는 AniList에서 동일 로직: 평점 ≥ 75%, 인기도 하위 30%, 최근 10년 내 방영작.

### B. 위클리 테마 — 이번 주의 큐레이션 각도

매주 일요일 자정(PDT)에 테마가 교체된다. 그 주 내내 같은 테마로 픽이 선정된다. 히든젬/컬트 로직 위에 테마 필터가 추가로 적용된다.

**테마 풀 (한 달 로테이션 예시):**

- 1주차: **"90년대가 남긴 것"** — 1990~1999년 개봉작, 평점 7.0+
- 2주차: **"한국이 만든 명장면"** — 한국 영화, 평점 7.5+
- 3주차: **"단 한 편의 기적"** — 감독의 필모그래피 중 유일한 장편 혹은 유일한 고평점작
- 4주차: **"오스카가 외면한 보석"** — 오스카 수상/노미 이력 없음, 평점 8.0+, vote_count ≤ 500

매월 테마 4개를 새로 구성해 지루함을 방지한다.

### C. 컬트 추천 — 평론가보다 팬들이 증명한 작품

TMDB discover API로:

- 평점 6.2~7.4 (애매한 점수대)
- 특정 장르만 대상: Horror(27), Sci-Fi(878), Thriller(53), Action(28)
- vote_count 50~300 (적당히 알려졌지만 주류는 아님)
- 장르 ≠ Animation (16)

팬덤이 형성된 컬트 작품은 종종 평론가 점수를 뛰어넘는 재발견 가치가 있다.

---

## 3. 일일 선택 알고리즘

### 3.1 전략 배분

세 전략을 랜덤으로 섞되, 한 전략이 연속 3일 이상 선택되지 않도록 조정한다.

```
今日 전략 = weightedRandom({
  hidden_gem: 40%,   // 가장 보편적 매력
  cult: 30%,         // 마니아 타겟
  weekly_theme: 30%  // 테마와 결합 (hidden_gem 또는 cult에 추가 필터)
})
```

### 3.2 시간대별 무드 가중치 (모든 전략 공통)

선정된 풀 내에서 최종 선택 시 사용자의 로컬 시간에 따라 장르 가중치를 적용한다.

| 시간대 | 무드 | 가중 장르 | 배수 |
|--------|------|----------|------|
| 06~18시 | 에너지 | Action, Adventure, Sci-Fi, Fantasy, War | ×2.0 |
| 18~22시 | 긴장감 | Thriller, Mystery, Drama, Crime, Horror | ×2.0 |
| 22~06시 | 편안함 | Comedy, Romance, Family, Documentary, Music | ×2.0 |

단, 평점 8.5+ 작품은 시간대 관계없이 항상 +가중치(×1.5)를 받는다.

### 3.3 최종 점수

```
최종점수 = 평점 × 무드가중치 × (위클리테마 해당 시 ×1.3)
```

- **히어로:** 최종 점수 1위
- **Tonight's Pick:** 최종 점수 2위 (가능하면 히어로와 다른 미디어 타입 우선)

---

## 4. 데이터 소스

| 미디어 | 소스 | API | 조건 |
|--------|------|-----|------|
| movie | TMDB | `/discover/movie` | genre≠16 |
| tv | TMDB | `/discover/tv` | genre≠16 |
| anime | AniList | GraphQL 검색 | TMDB 호출 절대 금지 |

TMDB discover 파라미터 예시 (Hidden Gem):
```
/discover/movie?sort_by=vote_average.desc&vote_count.lte=300&vote_average.gte=7.5
&with_genres≠16&primary_release_date.gte=2016-01-01&page=1
```

---

## 5. 구현 계획

### 5.1 신규 파일

- `lib/curation.ts` — 큐레이션 엔진 전체. 데이터 fetch, 필터링, 가중치 계산, 전략 로테이션, 최종 선택.
- `lib/curation-themes.ts` — 위클리 테마 정의 및 현재 주차 테마 결정 로직.

### 5.2 수정 파일

- `app/page.tsx` — trending API 대신 curation 호출로 hero/nextHero 결정.
- `components/HomeClient.tsx` — `heroPick`, `randomSeed` 로직 제거. 서버에서 받은 값만 사용.

### 5.3 데이터 흐름

```
page.tsx (서버)
  ├─ TMDB discover (Hidden Gem + Cult 조건)
  ├─ AniList 검색 (애니메 Hidden Gem)
  └─ curation-themes.ts (현재 주차 테마 결정)
            ↓
     lib/curation.ts
     ├─ 전략 랜덤 선택 (40/30/30)
     ├─ 해당 전략 풀 + 테마 필터
     ├─ 시간대 무드 가중치
     └─ hero / nextHero 결정
            ↓
     HomeClient → HeroCard
```

---

## 6. 기존 섹션과의 차별점

기존 섹션은 모두 "많이 보는 것"을 보여준다. Tonight's Pick은 **"적게 봤지만 볼 가치가 있는 것"**을 보여준다.

- For You: 인기도 기반 + 사용자 취향 반영
- Trending This Week: 현재 가장 인기 있는 작품
- Coming Soon: 개봉 예정작
- Box Office: 흥행 순위
- **Tonight's Pick → 발견형 큐레이션, 위 모든 섹션과 중복 가능성 낮음**

---

## 7. TMDB × Anime 금지 체크리스트

- [x] TMDB discover에서 `with_genres≠16`으로 애니메이션 장르 완전 제외
- [x] 애니메 Hidden Gem/Cult은 AniList GraphQL로만 조회
- [x] TMDB `/anime/` 엔드포인트 호출 없음
- [x] `anime` → `tv` 타입 변환 없음
- [x] AniList 결과는 `type: "anime"`로 마킹해 TmdbResult 호환
