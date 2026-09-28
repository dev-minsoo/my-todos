# Tick — 제품·기술 명세 (SPEC)

> 이 문서는 **단일 기준 문서**입니다. 다른 세션/개발자가 이 문서만 읽고 Tick을 개발할 수 있도록 자체 완결적으로 작성했습니다.
> 최종 갱신: 2026-09-28

---

## 0. 한 줄 컨셉

> **하루 한 장의 체크리스트를 공간별로.** 적으면 지금 보는 날짜·공간에 들어가고, 못 끝낸 일은 알아서 오늘로 따라온다. 지난 날을 넘겨 보면 그게 곧 기록이다.

Tick은 기존 `task-trail` 프로젝트를 **고치는 게 아니라 새로 만드는** 앱이다. task-trail은 개념 과다(이름 기반 커스텀 상태, 상태 3단계, 이력, 아카이브, 날짜 규칙)로 복잡해졌다. Tick은 개념을 최소로 줄이는 것이 최우선 원칙이다.

---

## 1. 설계 원칙

- **적는 건 빠르게, 정리는 나중에.** 입력칸은 하나, Enter로 바로 등록. 등록할 때 날짜·상태를 고르라고 하지 않는다.
- **상태는 둘뿐: 할 일 / 완료.** "진행 중"과 칸반은 넣지 않는다. 완료 여부는 `completed_at` 하나로 표현한다.
- **모든 조작은 항목 위에서 직접.** 클릭하면 그 자리에서 수정하고, 모달은 쓰지 않는다.
- **확인 창 대신 Undo 토스트.** 완료·삭제·이동은 되돌릴 수 있게 한다.
- **도메인 로직은 순수 함수 + 테스트.** 섹션 분류, 날짜 파싱, 넘어옴 계산이 여기에 들어간다. (task-trail 버그가 거의 다 이 영역에서 나왔다.)
- **모바일 폭을 먼저 설계한다.** 반응형 웹으로 폰·PC 모두 지원한다.

---

## 2. 기술 스택 (확정)

| 영역 | 선택 | 비고 |
|---|---|---|
| 빌드/프레임워크 | **Vite + React + TypeScript** | SPA, 반응형 웹. **PWA 아님** |
| 백엔드 | **Supabase** (Postgres + Auth + RLS) | 데이터의 주인은 서버 |
| 데이터 클라이언트 | **@supabase/supabase-js** | |
| 서버 상태 관리 | **TanStack Query** | 캐싱·낙관적 업데이트·롤백 |
| UI 상태 | **Zustand** | 현재 탭, 보는 날짜, Undo 대기열, 마지막 사용 공간 |
| 스타일 | **Tailwind CSS** | 유틸리티 기반 커스텀 UI |
| UI 컴포넌트 | **shadcn/ui** (Radix) | 필요한 것만 복붙: Toast(Undo), DropdownMenu(항목/공간 메뉴), Popover(날짜 선택) |
| 제스처/애니메이션 | **Framer Motion** | 스와이프, 체크→이동 layout 애니메이션, 후일 드래그 순서 |
| 날짜 | **date-fns** + 자체 한국어 파서 | "내일/금" 인식은 AI 없이 로컬 규칙 |
| 아이콘 | **lucide-react** | |
| 테스트 | **Vitest** | 도메인 순수 함수 |
| 후일(v0.3+) | `fractional-indexing` | 드래그 순서 변경 |

### 배포 (현재/미래)
- **현재:** Vite 정적 빌드 → Vercel(또는 Netlify). Supabase는 Supabase Cloud.
- **미래:** Supabase는 오픈소스라 **라즈베리파이에 셀프호스팅** 가능. 그때 프런트는 정적 파일을 파이의 nginx로 서빙. **코드 변경은 환경변수(엔드포인트) 정도**로 최소화한다.

### 이 스택으로 정해진 이유 (요약)
- 목표가 "회원가입하는 클라우드 서비스"이므로 처음부터 **서버가 데이터 주인**이다. 로컬 우선으로 시작해 나중에 진짜 동기화(기기 간 충돌 해결)를 얹는 것이 오히려 가장 어렵다.
- 서버 백엔드라 멀티기기가 자동으로 되고, 데이터가 서버에 안전하므로 **PWA가 불필요**하다(반응형 웹으로 충분).
- SSR/SEO가 필요 없는 로그인 전용 앱이라 **Next.js 대신 Vite SPA**가 가볍고, 정적 배포라 파이 셀프호스팅도 쉽다.

---

## 3. 화면 구성

한 화면. 상단에 공간 탭, 그 아래 날짜 헤더, 본문에 그날의 체크리스트, 하단에 완료 카운트.

```
┌───────────────────────────────────────────┐
│  [전체]  [개인]  [회사]              +     │  ← 공간 탭 (공간 2개↑일 때 전체 표시)
├───────────────────────────────────────────┤
│  ◀   2026년 9월 28일 (오늘)          ▶     │  ← 날짜 헤더 (←→ 이동)
├───────────────────────────────────────────┤
│  ⚠ 넘어옴                                   │  ← 오늘 화면에서만: 지난 날 미완료
│   ○ 보험 서류 제출              · 2일       │
│   ○ 치과 예약 전화              · 1일       │
│                                             │
│  할 일                                      │  ← 그날(dueDate) 미완료 항목
│   ○ PR 리뷰 답변                            │
│   ○ 장보기                                  │
│                                             │
│  완료                                       │  ← 그날 체크한 항목 (취소선)
│   ✓ 커피 주문                               │
├───────────────────────────────────────────┤
│  + 할 일 추가…                        ⏎     │  ← 입력칸 (하단 고정, 연속 입력)
│  5개 중 1개 완료                            │  ← 완료 카운트
└───────────────────────────────────────────┘
```

- **섹션(넘어옴/할 일/완료)은 사용자가 고르는 상태가 아니다.** `due_date`와 `completed_at`으로부터 자동으로 나뉜다.
- **전체 탭**에서는 공간별로 묶어서 보여 준다. 각 묶음에 공간 색과 완료 카운트(`개인 1/3`)가 붙는다.
- 모바일에서는 같은 구조를 세로로. 입력칸은 하단 고정.

---

## 4. 동작 규칙

### 4.1 추가
- 입력칸에 쓰고 Enter → **지금 보고 있는 날짜와 공간**에 등록. Enter 후 포커스 유지(연속 입력).
- 전체 탭에서는 입력칸 옆 **공간 칩**으로 공간을 고른다. 기본값은 **마지막으로 쓴 공간**.
- (v0.2) 입력에 "내일 장보기", "금 발표 준비"처럼 쓰면 날짜가 인식되어 칩으로 붙는다. 칩을 누르면 해제되고 보고 있는 날짜로 들어간다. → §7.

### 4.2 완료 / 해제
- 체크박스 클릭(폰: 탭, v0.2 오른쪽 스와이프). `completed_at`에 현재 시각 기록.
- **체크한 항목은 체크한 날에 남는다.** 완료 시각의 날짜에 "완료" 섹션으로 표시된다.
- 해제하면 `completed_at = null`.
- 완료/해제는 **Undo 토스트** 대상.

### 4.3 수정 (인라인)
- 제목 클릭(폰: 탭) → 그 자리에서 편집. **Enter 저장, Esc 취소.** 모달 없음.

### 4.4 삭제
- 항목 메뉴(DropdownMenu)에서 삭제. 확인 창 대신 **Undo 토스트**.
- **소프트 삭제**: `deleted_at`에 시각 기록. 쿼리는 `deleted_at IS NULL`만 조회. Undo 시 `deleted_at = null`. (동기화/복구에 유리)

### 4.5 다른 날 / 다른 공간으로 이동
- 항목 메뉴에서 `내일로` / `날짜 선택`(Popover) / `개인으로` / `회사로`.
- (v0.2) 폰: 왼쪽 스와이프 = 내일로.
- 이동도 **Undo 토스트** 대상.

### 4.6 넘어옴 (자동 이월) — 핵심 규칙
- **넘길 때 `due_date`를 실제로 바꾸지 않는다.** 오늘 화면에서 **계산으로만** 이월해 보여 준다.
  - 이유 ①: "며칠째 밀렸는지"(`· N일`)를 알 수 있다.
  - 이유 ②: 기기마다 자정에 데이터를 고쳐 쓰다가 충돌하는 일이 없다.
- 오늘 화면의 "넘어옴" = `due_date < 오늘 AND completed_at IS NULL AND deleted_at IS NULL`. `N일 = 오늘 − due_date`.
- 지난 날 화면에서는 그날 미완료 항목을 흐리게 "오늘로 넘어감"으로 표시(실제로는 오늘의 넘어옴에 뜬다).

### 4.7 날짜 이동 / 기록
- 날짜 헤더의 ◀ ▶(폰: 헤더 좌우 스와이프)로 날짜 이동.
- **완료 기록 화면을 따로 두지 않는다.** ◀로 지난 날들을 넘겨 보면 그날 완료한 항목이 그대로 남아 있어 그게 곧 기록이다.

### 4.8 Undo 토스트
- 완료·삭제·이동에 대해 토스트에 "실행 취소" 버튼. 일정 시간(예: 6초) 뒤 사라진다.
- 구현: 낙관적 업데이트로 UI 먼저 바꾸고 서버 반영. Undo는 역연산(또는 소프트 삭제 되돌리기). 서버 실패 시 롤백.

### 4.9 완료 카운트
- 하단에 그날 기준 "N개 중 M개 완료". 전체 탭에서는 공간별 카운트 + 합산.

### 4.10 순서 (v0.1 / v0.3)
- v0.1: `created_at` 오름차순. `position`(fractional index) 컬럼은 예약만.
- v0.3: 드래그로 순서 변경 → `fractional-indexing`으로 한 행만 update.

---

## 5. 공간 (Space)

- 할 일은 **반드시 하나의 공간에 속한다.** 태그(여러 개 붙는 분류)가 아니라 **경계**다.
- **개인 / 회사**는 첫 실행 시드일 뿐, 사용자가 직접 만들고 고칠 수 있다(예: 사이드 프로젝트, 이사 준비).
- **그룹 = 멤버가 있는 공간.** 지금 공간 개념을 넣어 두면 후일 그룹은 여기에 `space_members`와 권한만 더하면 된다. **UI 용어는 "그룹"이 아니라 "공간"** (후일 공유 시 "공유 공간"으로 자연스럽게 이어짐).

### 공간에서 할 수 있는 것
| 동작 | 설명 |
|---|---|
| 만들기 | 탭 끝의 `+`. 이름 + 색 |
| 수정 | 이름, 색 변경 (탭 길게 누르기/우클릭 메뉴) |
| 순서 변경 | 탭 순서 = 공간 순서 |
| 삭제 | 남은 할 일을 **다른 공간으로 옮길지 / 함께 지울지** 선택. Undo 가능 |

### 규칙
- **공간은 최소 하나** 있어야 한다. 마지막 공간은 삭제 불가.
- **공간이 하나뿐이면 탭을 숨긴다.** "전체" 탭은 공간 2개 이상일 때만 보인다. (공간을 안 쓰는 사람에겐 그냥 단순 체크리스트)
- 공간이 많아지면 탭 가로 스크롤. 편한 범위는 4~5개.
- **각 공간에 색**을 하나씩. 지금 어느 공간인지 한눈에.
- 별도 설정 화면을 만들지 않는다(탭 인라인 관리).

### 탭 동작
- 앱을 열면 **마지막으로 보던 탭**이 열린다.
- 탭 순서: `전체`가 맨 앞, 그다음 공간 순서.
- 넘어옴·완료 카운트는 **공간마다 따로** 계산(회사 화면에 개인 일이 넘어오지 않는다).
- **제스처 충돌 주의:** 좌우 스와이프는 항목(완료/내일로)에 쓴다. 그래서 **탭 전환은 탭 클릭으로만**, **날짜 이동은 날짜 헤더 스와이프/화살표로** 영역을 나눈다.

---

## 6. 인증 (Auth)

- **v0.1: 익명 로그인.** 첫 로드 시 `supabase.auth.signInAnonymously()`로 익명 세션 확보. 가입 UI 없이 바로 쓸 수 있고, 데이터는 서버에 안전하게 저장된다.
- **v0.2: 이메일 가입/로그인.** 익명 세션을 이메일 계정으로 **승격**(Supabase의 anonymous→permanent linking). RLS는 익명 유저에도 `auth.uid()`로 동일 적용된다.
- 모든 테이블 RLS: `user_id = auth.uid()`.

---

## 7. 날짜 인식 규칙 (v0.2, 순수 함수)

입력 문자열에서 날짜 토큰을 찾아 `due_date`로 해석하고, 토큰을 제목에서 제거해 칩으로 표시한다. **AI 없이 규칙 기반.** 애매하면 파싱하지 않고 보고 있는 날짜로 둔다.

| 토큰 | 해석 (오늘=T) |
|---|---|
| 오늘 | T |
| 내일 | T+1 |
| 모레 | T+2 |
| 글피 | T+3 |
| 다음 주 / 담주 | T+7 |
| 월·화·수·목·금·토·일 (또는 "월요일"…) | 가장 가까운 해당 요일. 오늘이 그 요일이면 오늘 |
| N일 뒤 / N일 후 | T+N |
| M/D, MM/DD | 그 날짜(이미 지났으면 내년) |

- 칩을 누르면 해제 → `due_date = 보고 있는 날짜`.

---

## 8. 데이터 모델

Postgres(Supabase). 모든 테이블에 RLS(`user_id = auth.uid()`)와 동기화 대비 필드(`updated_at`, `deleted_at`)를 둔다. 마이그레이션이 **스키마의 단일 출처**이며, `supabase gen types`로 TS 타입을 자동 생성해 수동 캐스트를 없앤다.

```sql
-- spaces
create table spaces (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  color       text not null,            -- hex 또는 토큰
  position    text not null,            -- fractional index (탭 순서)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz               -- 소프트 삭제
);

-- tasks
create table tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  space_id     uuid not null references spaces(id) on delete cascade,
  title        text not null,
  due_date     date not null,           -- v0.1: 항상 존재 (날짜 없는 일 없음)
  completed_at timestamptz,             -- null = 할 일, 값 = 완료(그 시각의 날짜에 표시)
  position     text not null,           -- fractional index (v0.1: created_at 순 사용)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- RLS (두 테이블 공통 패턴)
alter table spaces enable row level security;
alter table tasks  enable row level security;
create policy "own rows" on spaces using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on tasks  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- updated_at 자동 갱신 트리거 권장
```

- `status` 컬럼을 두지 않는다. 완료는 `completed_at` 하나로. (이름 기반 상태/FK 문제 원천 차단)
- 메모·반복·태그는 필요해질 때 컬럼으로 추가.
- **날짜 없는 "언젠가" 항목은 v0.1에 없다** (모든 task에 `due_date`).
- **하루 기준은 자정(로컬).** 후일 "하루 시작 시각"(예: 새벽 4시) 설정을 위해 경계 계산을 한 함수(`dayBoundary`)에 모은다.
- **시드:** 최초 로그인 후 공간이 0개면 클라이언트가 `개인`/`회사` 두 공간을 생성(후일 DB 트리거로 이동 가능).

### 앱 타입 (예시)
```ts
type Task = {
  id: string; userId: string; spaceId: string;
  title: string; dueDate: string;          // 'YYYY-MM-DD'
  completedAt: string | null;              // ISO or null
  position: string;
  createdAt: string; updatedAt: string; deletedAt: string | null;
};
type Space = {
  id: string; userId: string; name: string; color: string; position: string;
  createdAt: string; updatedAt: string; deletedAt: string | null;
};
```

---

## 9. 도메인 로직 (순수 함수 · Vitest 필수)

UI/DB와 분리된 순수 함수로 두고 테스트한다. 데이터는 서버에서 받아온 배열이며(개인용이라 규모 작음), 아래 함수들이 화면에 필요한 섹션을 계산한다.

- `deriveSections(tasks, viewedDate, today)` → `{ carried, open, completed }`
  - `open` = `dueDate == viewedDate && !completedAt`
  - `carried`(viewedDate == today일 때만) = `dueDate < today && !completedAt`, 각 항목에 `overdueDays`
  - `completed` = `completedAt`의 날짜(dayBoundary 기준) == viewedDate
- `completionCount(sections)` → `{ total, done }`
- `dayBoundary` — 로컬 자정 기준 날짜 계산(후일 "하루 시작 시각" 설정 반영 지점)
- `parseDate(input, today)` → `{ dueDate, cleanTitle }` (§7, v0.2)
- `order` — position 정렬/삽입(v0.3)

---

## 10. 데이터 흐름

- **읽기:** TanStack Query가 `deleted_at IS NULL` task를 공간(또는 전체) 단위로 fetch → `deriveSections`로 화면 구성.
- **쓰기:** 추가/체크/수정/삭제/이동은 **낙관적 업데이트**(캐시 먼저 갱신) 후 Supabase 반영. 실패 시 롤백. Undo는 역연산/소프트삭제 되돌리기.
- **UI 상태(Zustand):** 현재 탭(공간 id 또는 전체), 보는 날짜, Undo 대기열, 마지막 사용 공간. (localStorage로 마지막 탭/공간 지속)

---

## 11. 폴더 구조 (제안)

```
tick/
├── SPEC.md                  # 이 문서
├── CLAUDE.md                # 개발 세션 진입 문서
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── .env.example             # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├── supabase/
│   └── migrations/          # 스키마 단일 출처
│       └── 0001_init.sql
├── public/
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css            # tailwind
    ├── lib/
    │   ├── supabase.ts       # 클라이언트
    │   └── utils.ts
    ├── db/
    │   └── types.ts          # supabase gen types + 앱 타입
    ├── domain/               # 순수 함수 (Vitest)
    │   ├── sections.ts        + sections.test.ts
    │   ├── dateParse.ts       + dateParse.test.ts   (v0.2)
    │   ├── dayBoundary.ts
    │   └── order.ts           (v0.3)
    ├── store/
    │   └── uiStore.ts         # Zustand
    ├── providers/
    │   └── QueryProvider.tsx  # TanStack Query
    ├── features/
    │   ├── auth/    ├─ useAuth.ts (익명 세션 보장) ├─ AuthGate.tsx
    │   ├── tasks/   ├─ useTasks.ts (쿼리/뮤테이션) ├─ TaskList/TaskItem/TaskInput.tsx
    │   ├── spaces/  ├─ useSpaces.ts ├─ SpaceTabs.tsx ├─ SpaceManageMenu.tsx
    │   └── day/     └─ DayHeader.tsx (←→ 날짜 이동)
    └── components/ui/         # shadcn (toast, dropdown-menu, popover …)
```

---

## 12. 단계별 로드맵

| 단계 | 범위 |
|---|---|
| **v0.1 (핵심)** | Supabase 스키마+RLS · 익명 로그인 · 하루 화면(오늘) + ←→ 날짜 이동 · 추가/체크/인라인 수정/삭제 · 넘어옴 자동 계산 · 공간(개인/회사 시드, 탭[전체\|개인\|회사], 공간 추가/수정/삭제) · Undo 토스트(낙관적+롤백) · 완료 카운트 · 반응형(모바일 우선) · Vercel 배포 |
| **v0.2** | 한국어 날짜 인식(§7) · 다른 날/공간 이동(메뉴+스와이프) · 스와이프 제스처(완료/내일로)·애니메이션 · 하루 시작 시각 설정 · 이메일 회원가입(익명 승격) · JSON 백업 내보내기 |
| **v0.3** | 드래그 순서 변경(`fractional-indexing`) · 키보드 단축키(`n` 추가, `j`/`k` 이동, `x` 완료, `e` 편집, `1~` 탭, `←→` 날짜) |
| **v0.4** | 라즈베리파이 셀프호스팅(Supabase self-host) 배포 옵션 · (선택) 오프라인 캐시 강화 |
| **이후** | 메모 · 반복 · 검색 · 날짜 없는 "나중에" 목록 · **그룹**(멤버 있는 공유 공간: `space_members` + 권한) |

---

## 13. 짚어 둘 위험 요소 / 결정 근거

- **동기화를 나중에 얹지 않고 처음부터 서버 백엔드**로 간다 → 진짜 동기화의 난제(기기 간 충돌)를 회피.
- **넘어옴은 저장이 아니라 계산** → 자정 데이터 조작 충돌·이월 버그 원천 차단.
- **소프트 삭제(`deleted_at`)** → Undo와 후일 동기화 복구에 모두 유리.
- **마이그레이션 = 스키마 단일 출처**, `supabase gen types`로 타입 자동화 → task-trail식 수동 캐스트/타입 불일치 방지.

---

## 14. 개발 규칙

- 이 SPEC의 결정에서 출발한다. **task-trail의 추가 개념(커스텀 상태, 진행 중, 아카이브 등)을 사용자가 요청하지 않는 한 다시 넣지 않는다.**
- 도메인 로직은 순수 함수 + Vitest 테스트를 먼저.
- 아키텍처를 바꾸는 큰 결정(예: 스택 변경, PWA 재도입, Next.js 전환)은 **사용자 승인 후** 진행.
- 커밋은 사용자가 요청할 때만.
