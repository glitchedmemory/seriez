# Bingr 추천 시스템 기획서

> 작성일: 2026-06-06 | 상태: Draft

---

## 1. 현재 상태 분석

**현재 `/api/for-you` 로직:**
1. 사용자의 리뷰(rated) → TMDB에서 장르 추출 (2x 가중치)
2. 사용자의 tracking(watching/completed) → TMDB에서 장르 추출 (1x 가중치)
3. 사용자의 plan_to_watch → TMDB에서 장르 추출 (0.5x 가중치)
4. 상위 3개 장르로 `discoverByGenres()` 호출 → TMDB `/discover` API
5. 이미 본 작품 제외 → 랜덤 셔플 → 상위 10개 반환

**문제점:**
- **장르 기반 단일 전략**: "SF 좋아하니까 SF 추천" — 지나치게 단순
- **TMDB similar/recommendations API 미사용**: 특정 작품 기반 추천 없음
- **랜덤 셔플**: 같은 장르 내에서 품질 순서가 아닌 무작위
- **설명 부재**: "왜 이 작품을 추천하는지" 알 수 없음
- **신규 유저**: 데이터 없으면 빈 화면 (자동으로 트렌딩 fallback 중)

---

## 2. 목표

> "이 사이트 왜 쓰냐" → "여기 추천이 진짜 잘 맞네"

- **개인화**: 내가 본/평가한 작품과 진짜 비슷한 작품을 추천
- **이유 설명**: "Backrooms를 좋아하니까" 같은 구체적 이유
- **신규 유저 대응**: 데이터 없어도 볼 만한 추천 제공
- **다양성 vs 정확성**: 장르에 갇히지 않고 새로운 발견 기회

---

## 3. 추천 엔진 설계

### 3.1 Multi-Source Pipeline

```
사용자 데이터
    │
    ├── Source A: TMDB Similar API ──────┐
    │   (per-title: /movie/{id}/similar) │
    │                                    ├── Dedup + Score → Top N
    ├── Source B: TMDB Recommendations ──┤
    │   (per-title: /movie/{id}/recommendations)
    │                                    │
    ├── Source C: Genre Discovery ───────┤
    │   (/discover with top genres)      │
    │                                    │
    └── Source D: Trending Discovery ────┘
        (신규 유저 fallback)
```

### 3.2 Source A — Similar Titles (가중치: 3x)

**대상**: 사용자가 4점 이상 평가한 작품 (최대 5개)

```
for each top-rated title:
  call /movie/{id}/similar (또는 /tv/{id}/similar)
  → 최대 20개 결과 수집
```

**장점**: "이 영화 좋아했으면 이것도 좋아할 거예요" — 가장 직관적

### 3.3 Source B — TMDB Recommendations (가중치: 2x)

**대상**: 사용자가 4점 이상 평가한 작품 (최대 5개)

```
for each top-rated title:
  call /movie/{id}/recommendations
  → 최대 20개 결과 수집
```

**장점**: TMDB의 자체 추천 알고리즘 활용 (similar보다 넓은 범위)

### 3.4 Source C — Genre Discovery (가중치: 1x)

**대상**: 장르 점수 기준 상위 3개 장르

```
기존 discoverByGenres() 로직 유지
→ 장르 기반 /discover API
```

**장점**: 장르 내 다양성 확보, similar에 없는 신작 발견

### 3.5 Source D — Trending (가중치: 0.5x, 신규 유저 전용)

**대상**: 데이터가 3개 미만인 신규 유저

```
trending API + 사용자 장르 선호도(온보딩) 혼합
```

---

## 4. 스코어링 알고리즘

각 후보 타이틀에 점수 부여:

```
SCORE = (
  source_weight × 10                    // 출처 신뢰도
  + (tmdb_rating - 7.0) × 2             // TMDB 평점 보정
  + log(vote_count + 1) × 0.5           // 인기도 (로그 스케일)
  + genre_match × 3                      // 장르 일치도 (0~1)
  + recency_bonus                        // 최신작 보너스 (2025~2026)
  - already_shown_penalty × 100          // 이미 추천했던 작품 배제
)
```

**정렬**: SCORE 내림차순 → 상위 10개 반환

---

## 5. 추천 이유 (Recommendation Reason)

각 추천에 `reason` 필드 추가:

| 유형 | 예시 |
|------|------|
| Source A | "Because you rated Backrooms ★4.5" |
| Source B | "Recommended based on Obsession" |
| Source C | "Since you like Horror movies" |
| Source D | "Trending this week" |

프론트에서 "For You" 섹션의 각 카드에 이유 표시.

---

## 6. 신규 유저 (Cold Start)

**Flow:**
1. 온보딩에서 선택한 장르 → Source C만 사용
2. 추천 3개 미만이면 Source D(Trending) 보충
3. 3개 이상 평가하면 자동으로 Source A+B 활성화

---

## 7. 구현 Phase

### Phase A — 백엔드 개선 (예상: 1-2시간)

- `/api/for-you` 로직 교체
  - `fetchSimilarTitles()`: per-title similar API 호출
  - `fetchRecommendations()`: per-title recommendations API 호출
  - `scoreAndRank()`: 점수 계산 + 정렬
  - `addReasons()`: 추천 이유 생성
- 기존 `discoverByGenres()` 는 Source C로 유지
- Rated IDs 제외 로직 유지

### Phase B — 프론트엔드 (예상: 30분)

- `HomeClient`의 "For You" 섹션에서 `reason` 표시
- 각 카드: "Because you liked Backrooms" 같은 부제목
- 빈 상태: "Rate 3+ titles to unlock personalized picks"

### Phase C — 테스트 & 튜닝 (예상: 30분)

- 평가 3개 이상 있는 계정으로 추천 품질 확인
- 추천 결과 다양성 체크 (같은 장르만 나오는지)
- API 응답 속도 확인 (TMDB similar 호출 병렬화)

---

## 8. 기대 효과

- **추천 정확도**: similar API 도입으로 "장르 추천" 대비 체감 품질 ↑
- **이유 설명**: 사용자 신뢰도 ↑ (왜 이게 나왔는지 알면 수용률 증가)
- **재방문**: 좋은 추천 = 서비스 이용 빈도 증가

---

## 9. 진행 전 확인사항

TMDB similar/recommendations API는 하루 호출량이 detail API에 비해 적습니다.
사용자당 최대 5작품 × 2 API × 20결과 = 200개 결과 획득.
Rate limit 영향 최소화를 위해 응답을 1시간 캐싱(`next: { revalidate: 3600 }`) 적용 예정입니다.
