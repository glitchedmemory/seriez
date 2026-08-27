# RLS 진단 결과 요약 (2026-08-08)

## 근본 원인
Seriez의 기록 저장(`media_trackings` 시청/별점, `reviews` 리뷰)이 **모두 실패**하고 있었습니다.
DB에 아무 기록도 안 쌓였고, 그 때문에 For You가 개인화를 못 하고 트렌딩으로 fallback했습니다.

## 왜 실패했나
Supabase RLS(Row Level Security) 정책 때문입니다:

- `media_trackings` INSERT 정책: `auth.role() = 'authenticated' AND auth.uid() = username`
- `reviews` INSERT 정책: `auth.role() = 'authenticated'`

서버 코드(`/api/track`, `/api/reviews`)는 저장할 때 **service_role 키**를 사용합니다.
그런데 `service_role`은 `auth.role()`이 `'authenticated'`가 아니므로 위 정책에 **거부**당합니다 (`42501: RLS violation`).

즉, **서버의 기록 저장은 항상 RLS에 막혀 조용히 실패**했고, 클라이언트는 catch에 삼켜져
아무 에러 없이 넘어갔습니다. → 사용자는 저장된 줄 알지만 DB엔 안 쌓임.

## 해결책
`media_trackings`·`reviews`의 쓰기(INSERT/UPDATE/DELETE) 정책에 **service_role 허용 OR 조건**을 추가합니다.

```sql
-- 예시: 기존 정책을 service_role 포함으로 확장
create policy "service_role bypass" on public.media_trackings
  for all to service_role using (true) with check (true);

create policy "service_role bypass" on public.reviews
  for all to service_role using (true) with check (true);
```

이렇게 하면:
- **service_role(서버)**: 전부 통과 → 기록이 정상 저장됨
- **일반 사용자(authenticated)**: 기존 정책 그대로 → 자기 기록만 가능
- **비로그인(anon)**: 기존대로 차단

## 영향
- 시청 상태 / 별점 / 리뷰가 **모두 정상 저장**됩니다
- For You가 **기록 기반 개인화 추천**을 드디어 표시
- 기존 사용자 RLS 보안은 그대로 유지 (service_role만 추가 허용)
