# CLAUDE.md — Tick 개발 진입 문서

이 파일은 개발 세션이 자동으로 읽는 짧은 진입 문서다. **상세 명세는 [`SPEC.md`](./SPEC.md)에 있으니 작업 전 반드시 읽을 것.**

## 무엇을 만드나

**Tick** — "하루 한 장의 체크리스트를 공간별로." 적으면 지금 보는 날짜·공간에 들어가고, 못 끝낸 일은 계산으로 오늘에 따라온다(넘어옴). 지난 날을 넘겨 보면 그게 곧 기록이다.

기존 `task-trail`을 고치지 않고 새로 만드는 앱. task-trail은 개념 과다로 복잡해졌다. **개념 최소화가 최우선 원칙.**

## 핵심 원칙 (어기지 말 것)

- **상태는 둘뿐: 할 일 / 완료** (`completed_at`으로만 표현). "진행 중"·칸반·커스텀 상태 없음.
- **적는 건 빠르게** — 입력칸 하나, Enter로 즉시 등록. 등록 시 날짜·상태 고르라 하지 않음.
- **모달 없음** — 조작은 항목 위에서 직접(인라인 수정). 확인 창 대신 **Undo 토스트**.
- **넘어옴은 저장이 아니라 계산** — `due_date`를 실제로 바꾸지 않는다.
- **소프트 삭제** — `deleted_at` 사용, 쿼리는 `deleted_at IS NULL`.
- **도메인 로직은 순수 함수 + Vitest 테스트** (섹션 분류, 날짜 파싱, 넘어옴 계산).
- **task-trail의 추가 개념(진행 중/아카이브/이력/이름 기반 상태)을 사용자 요청 없이 다시 넣지 말 것.**

## 스택 (확정)

- **Vite + React + TypeScript** — SPA, 반응형 웹. **PWA 아님.**
- **Supabase** (Postgres + Auth + RLS) — 데이터 주인은 서버. 후일 라즈베리파이 셀프호스팅(코드 동일).
- **@supabase/supabase-js** + **TanStack Query** (캐싱·낙관적 업데이트·롤백)
- **Zustand** (UI 상태) · **Tailwind + shadcn/ui** (Toast/DropdownMenu/Popover)
- **Framer Motion** (스와이프·애니메이션) · **date-fns** (+자체 한국어 파서) · **lucide-react** · **Vitest**
- 후일: `fractional-indexing`(v0.3 순서)

## 데이터 모델 (요약)

- `spaces(id, user_id, name, color, position, created_at, updated_at, deleted_at)`
- `tasks(id, user_id, space_id, title, due_date, completed_at, position, created_at, updated_at, deleted_at)`
- 모든 테이블 RLS `user_id = auth.uid()`. 마이그레이션이 스키마 단일 출처. `supabase gen types`로 타입 자동 생성.

## 지금 단계

**v0.1 (핵심):** 익명 로그인 · 하루 화면(오늘)+←→ 이동 · 추가/체크/인라인 수정/삭제 · 넘어옴 계산 · 공간(개인/회사 시드, 탭[전체|개인|회사]) · Undo 토스트 · 완료 카운트 · 반응형 · Vercel 배포.
전체 로드맵은 SPEC §12.

## 작업 규칙

- 아키텍처를 바꾸는 큰 결정(스택 변경, PWA 재도입, Next.js 전환 등)은 **사용자 승인 후** 진행.
- 커밋은 사용자가 요청할 때만.
- 프로젝트 초기 상태이므로, 구현 시작 전에 어디까지 스캐폴딩할지 사용자와 맞출 것.
