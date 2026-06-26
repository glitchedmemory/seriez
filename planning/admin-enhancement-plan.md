# Admin Enhancement Plan — Seriez

## Current Issues
- `/admin/reports` has 3 tabs crammed into one page (Reports, Sanctions, Audit Log)
- Two separate user tables: `/admin/users` and the old Users tab inside `/admin/reports`
- Old `AdminPanel` component still referenced from `app/profile/page.tsx` (line 661)
- No analytics, no charts, no data export
- English-only hardcoded strings in some places

## Phase 1 — Structure Cleanup (Safe, no new features)

### 1.1 Remove old AdminPanel
- Remove `import AdminPanel` and `<AdminPanel>` usage from `app/profile/page.tsx`
- (Do NOT delete the component file — just in case)

### 1.2 Split /admin/reports into independent pages
- Create `/admin/moderation/page.tsx` — content reports only
- Create `/admin/sanctions/page.tsx` — sanctions management
- Create `/admin/audit/page.tsx` — audit log only
- Keep `/admin/reports` as a redirect to `/admin/moderation`

### 1.3 Update sidebar navigation
- Dashboard → `/admin`
- Users → `/admin/users`
- Moderation → `/admin/moderation`
- Sanctions → `/admin/sanctions`
- Audit Log → `/admin/audit`

### 1.4 i18n all text
- Add all admin UI strings to messages/*.json (all 7 languages)
- Replace hardcoded English with `t("admin.*")` keys

## Phase 2 — Dashboard Enhancement

### 2.1 New stats
- Daily Active Users (30-day trend)
- Today's activity counts (trackings, reviews, comments)
- Recent signups (last 5)

### 2.2 Add simple SVG sparkline charts
- DAU trend line
- Signup trend line

### 2.3 i18n

## Phase 3 — Content Analytics

### 3.1 New page: `/admin/analytics`
- Trending searches (from search_logs)
- Zero-result searches (TMDB coverage gaps)
- Most tracked titles
- Most reviewed titles
- Average ratings distribution

### 3.2 i18n

## Phase 4 — User Management Upgrades

### 4.1 Add to /admin/users
- Bulk selection (checkboxes) for mass actions
- CSV export button
- Last active column

### 4.2 Add to /admin/users/[username]
- Activity timeline (recent tracking/reviews/comments)
- Export this user's data

### 4.3 i18n

---

## Files NOT to touch
- All non-admin pages (/, /search, /library, /feed, /profile, /person, /title, /info, etc.)
- All API routes except the ones explicitly listed per phase
- Database schema (read-only, no migrations)
- proxy.ts, TabBar.tsx (already modified for admin access control)
- layout.tsx, AdminAwareLayout.tsx (already configured)

## Implementation rule
- Each phase: implement → build → deploy → test → confirm
- Do NOT proceed to next phase until current phase is confirmed working
- All UI text: English in code + all 7 languages in messages/*.json
