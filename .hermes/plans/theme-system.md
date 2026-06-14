# Seriez Light/Dark Theme System — 기획서

## 개요
사이트 전체의 라이트/다크 테마를 사용자 설정으로 전환할 수 있는 시스템.
시력 이슈가 있는 사용자, 주간 사용자, 라이트 모드 선호자를 위해 필수 기능.

---

## 1. 아키텍처

### CSS Variables 기반
```css
:root {
  --bg-primary: #0f0f1a;
  --bg-secondary: #1a1a2e;
  --text-primary: #ffffff;
  --text-secondary: #9ca3af;
  --accent-purple: #a855f7;
  --accent-blue: #6366f1;
  /* ... 모든 색상을 변수화 */
}

[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f3f4f6;
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --accent-purple: #7c3aed;
  --accent-blue: #4f46e5;
  /* ... 라이트 모드 값 */
}
```

### Tailwind 통합
```js
// tailwind.config.js
colors: {
  'app-bg': 'var(--bg-primary)',
  'app-surface': 'var(--bg-secondary)',
  'app-text': 'var(--text-primary)',
  // ...
}
```

### 모든 하드코딩 색상을 변수로 교체
- `bg-[#0f0f1a]` → `bg-app-bg`
- `text-[#9ca3af]` → `text-app-text-secondary`
- `border-[#1a1a2e]` → `border-app-surface`
- 등 약 200+ 군데 일괄 교체

---

## 2. 테마 전환 방식

### 3단계 우선순위
1. **사용자 수동 설정** (localStorage `seriez-theme`) — 최우선
2. **시스템 설정** (`prefers-color-scheme`) — 기본값
3. **Fallback** — dark

### 감지 및 적용
```tsx
// ThemeProvider (client component)
function ThemeProvider({ children }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const stored = localStorage.getItem('seriez-theme');
    if (stored) setTheme(stored);
    else if (window.matchMedia('(prefers-color-scheme: light)').matches) setTheme('light');
    else setTheme('dark');
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('seriez-theme', theme);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
```

### 깜빡임 방지 (FOUC)
```html
<!-- <head> 인라인 스크립트 — 페이지 로드 전 실행 -->
<script>
  (function() {
    var t = localStorage.getItem('seriez-theme');
    if (!t) t = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
  })();
</script>
```

---

## 3. UI

### 위치: 설정 페이지 (Settings)
- "Appearance" 섹션 추가

### 디자인 (3가지 옵션)

**옵션 A: 토글 스위치 (추천)**
```
┌─────────────────────────────────┐
│  Appearance                     │
│                                 │
│  🌙 Dark  ━━━●━━━  ☀️ Light    │
│                                 │
└─────────────────────────────────┘
```

**옵션 B: 세그먼트 컨트롤**
```
┌─────────────────────────────────┐
│  ┌──────────┬──────────┐       │
│  │  🌙 Dark │ ☀️ Light │       │
│  └──────────┴──────────┘       │
└─────────────────────────────────┘
```

**옵션 C: 라디오 + 시스템 연동**
```
┌─────────────────────────────────┐
│  Appearance                     │
│  ○ System (auto)                │
│  ● Dark                         │
│  ○ Light                        │
└─────────────────────────────────┘
```

**권장: 옵션 A + 옵션 C 조합**
- 토글 스위치로 빠르게 Dark/Light 전환
- "System" 체크박스로 OS 설정 자동 연동

---

## 4. 구현 범위

### 1단계: 인프라 (1~2일)
- [ ] `globals.css`에 CSS 변수 정의 (dark + light)
- [ ] `tailwind.config.js`에 변수 매핑 추가
- [ ] `ThemeProvider` 컴포넌트 생성
- [ ] `<head>` FOUC 방지 스크립트 추가
- [ ] `layout.tsx`에 ThemeProvider 래핑

### 2단계: 색상 마이그레이션 (2~3일)
- [ ] 모든 하드코딩 색상 → Tailwind 변수 클래스로 교체
  - `bg-[#0f0f1a]` → `bg-app-bg`
  - `bg-[#1a1a2e]` → `bg-app-surface`
  - `text-[#9ca3af]` → `text-app-muted`
  - `text-white` → `text-app-text`
  - `border-[#1a1a2e]` → `border-app-surface`
  - `text-[#6b7280]` → 대응 변수
  - 그라데이션, 그림자, hover 색상 등 전부

### 3단계: 토글 UI (0.5일)
- [ ] Settings > Appearance 섹션
- [ ] 토글 스위치 + System 옵션
- [ ] 모바일/데스크탑 반응형

### 4단계: 검증 (0.5일)
- [ ] 모든 페이지 라이트 모드에서 확인
- [ ] 포스터/이미지 가독성 확인
- [ ] 그라데이션, 그림자 확인
- [ ] 모바일/데스크탑 확인

---

## 5. 영향 범위

| 영역 | 변경량 | 난이도 |
|------|--------|--------|
| globals.css | ~100줄 | 낮음 |
| tailwind.config.js | ~30줄 | 낮음 |
| ThemeProvider | ~50줄 | 낮음 |
| layout.tsx | ~5줄 | 낮음 |
| 컴포넌트 (~30개) | ~200군데 | 중간 |
| Settings 페이지 | ~40줄 | 낮음 |

---

## 6. 라이트 모드 예상 룩

```
┌─────────────────────────────────────┐
│  🎬 Seriez        🔍 Search...   👤 │  ← 흰색 배경, 진한 텍스트
├─────────────────────────────────────┤
│                                     │
│  TRENDING NOW                       │
│  ┌─────────────────────────────┐   │  ← 밝은 회색 카드
│  │ ★ 8.3  Widow's Bay          │   │
│  └─────────────────────────────┘   │
│                                     │
│  🎯 For You                        │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐     │
│  │    │ │    │ │    │ │    │     │  ← 포스터 그대로
│  └────┘ └────┘ └────┘ └────┘     │
│                                     │
└─────────────────────────────────────┘
```

---

## 7. 리스크
- **포스터 이미지**: TMDB 포스터는 대부분 어두운 톤 — 라이트 배경에서도 괜찮음
- **그라데이션**: 보라색 계열 그라데이션은 dark/light 모두 가독성 확보 필요
- **기존 사용자**: 기본값 dark 유지로 기존 경험 보존

---

## 예상 총 공수: 3~4일
