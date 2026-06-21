# Seriez Admin 기능 확장 기획서

## Phase 1 — 검색 분석 대시보드

### API: `GET /api/admin/search-analytics`

**기존 자산:** `search_logs` 테이블 + `/api/trending-searches` (유저용) 이미 존재

**응답 데이터:**
- `top_queries`: [{query, count}] — 최근 30일 검색 Top 50
- `daily_volume`: [{date, count}] — 최근 30일 일별 검색량
- `zero_result`: [{query, count}] — 결과 0건 검색어 (TMDB 커버리지 부족 감지)
- `total_searches`: 최근 30일 총 검색 수

**SQL 로직:**
```
top_queries: SELECT query, COUNT(*) FROM search_logs WHERE created_at > NOW()-30 GROUP BY query ORDER BY count DESC LIMIT 50
daily_volume: SELECT DATE(created_at), COUNT(*) FROM search_logs WHERE created_at > NOW()-30 GROUP BY DATE ORDER BY date
zero_result: [별도 API 연동 또는 result_count=0 조건]
```

### AdminPanel UI 추가

| 요소 | 설명 |
|------|------|
| Section 탭 | "Search" 추가 (기존 Dashboard/Reports/Users/Content/Sanctions/Audit 옆) |
| 인기 검색어 | Top 20 리스트 (query + count badge) |
| 검색량 추이 | 30일 라인 차트 (간단한 SVG 바 차트) |
| 제로 결과 | 리스트 + TMDB 검색 가능성 표시 |

### 변경 파일 목록
- `app/api/admin/search-analytics/route.ts` (신규)
- `app/profile/page.tsx` — AdminPanel에 Section + UI 추가

---

## Phase 2 — 인기 콘텐츠 지표

### API: `GET /api/admin/popular-content`

**응답 데이터:**
- `most_tracked`: [{tmdb_id, media_type, title, poster, count}] — 트래킹 많은 순 Top 50
- `most_reviewed`: [{tmdb_id, title, count, avg_rating}] — 리뷰 많은 순 Top 50
- `most_collected`: [{tmdb_id, title, count}] — 컬렉션 포함 많은 순 Top 50

**SQL 로직:**
```
most_tracked: SELECT tmdb_id, media_type, COUNT(*) c FROM media_trackings GROUP BY tmdb_id, media_type ORDER BY c DESC LIMIT 50
most_reviewed: SELECT tmdb_id, media_type, COUNT(*) c, AVG(rating) r FROM reviews GROUP BY tmdb_id, media_type ORDER BY c DESC LIMIT 50
most_collected: SELECT tmdb_id, media_type, COUNT(*) c FROM list_items GROUP BY tmdb_id, media_type ORDER BY c DESC LIMIT 50
```
각 결과에 TMDB API로 title + poster enrich.

### AdminPanel UI 추가

| 요소 | 설명 |
|------|------|
| Section 탭 | "Popular" 추가 |
| Top Tracked | 포스터+제목+트래킹 수 리스트 |
| Top Reviewed | 포스터+제목+리뷰 수+평균 별점 리스트 |
| Top Collected | 포스터+제목+컬렉션 포함 수 리스트 |

### 변경 파일 목록
- `app/api/admin/popular-content/route.ts` (신규)
- `app/profile/page.tsx` — Section + UI 추가

---

## Phase 3 — 유저 활동 지표

### API: `GET /api/admin/user-activity`

**응답 데이터:**
- `dau`: [{date, count}] — 최근 30일 일간 활성 유저 (tracking/review/comment 중 하나라도 한 unique user)
- `most_active`: [{username, action_count, last_active}] — 최근 7일 활동 많은 유저 Top 20
- `signup_trend`: [{date, count}] — 최근 30일 일별 가입자

**SQL 로직:**
```
dau: UNION ALL로 media_trackings.updated_at + reviews.created_at + review_comments.created_at 의 DISTINCT username, DATE
most_active: 각 테이블에서 username별 count 합산 후 정렬
signup_trend: SELECT DATE(created_at), COUNT(*) FROM users WHERE created_at > NOW()-30 GROUP BY DATE
```

### AdminPanel UI 추가

| 요소 | 설명 |
|------|------|
| Section 탭 | "Activity" 추가 |
| DAU 차트 | 30일 라인/바 차트 |
| 가입자 추이 | 30일 바 차트 |
| 활성 유저 | Top 20 유저 리스트 + 활동 수 |

### 변경 파일 목록
- `app/api/admin/user-activity/route.ts` (신규)
- `app/profile/page.tsx` — Section + UI 추가

---

## Phase 4 — 사이트 공지 발송

### API: `POST /api/admin/announce`

**Request body:**
```
{ "message": "공지 내용", "type": "announcement" }
```

**처리 로직:**
- notifications 테이블에 모든 유저 대상으로 INSERT
- type = "announcement", target_user = 각 user.username

**기존 자산:** notifications 테이블 이미 존재, 유저 알림 시스템 이미 구현됨

### AdminPanel UI 추가

| 요소 | 설명 |
|------|------|
| Section 탭 | "Announce" 추가 |
| 텍스트 입력 | 메시지 입력 필드 |
| 전송 버튼 | "Send to All Users" |
| 전송 결과 | 성공 건수 / 실패 표시 |

### 변경 파일 목록
- `app/api/admin/announce/route.ts` (신규)
- `app/profile/page.tsx` — Section + UI 추가
