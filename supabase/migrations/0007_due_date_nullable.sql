-- My Todos v0.x: 날짜 미정 할 일 ('나중에' 목록)
-- 적용 방법 (0001~0006과 동일):
--   A) Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 실행
--   B) supabase CLI: `supabase db push` (프로젝트는 `npm run db:push`)
--
-- 개념을 새로 만들지 않는다. "나중에"는 새 상태축이 아니라 날짜의 부재(due_date = null)다.
-- 상태는 여전히 할 일/완료(+취소)뿐이고, 넘어옴은 due_date < today 비교라 null은 자연히 빠진다
-- (날짜 미정은 영원히 넘어오지 않는다). due_date 를 nullable 로 풀어 "언젠가 할 일"을 담는다.
--   · null = 날짜 미정('나중에'), 전용 화면(someday)에서 공간별로 모아 본다.
--   · 완료/취소하면 completed_at/cancelled_at 이 찍혀 그 '날'의 기록으로 자연 귀속된다.
-- 기존 복합 인덱스 tasks_space_due_idx (space_id, due_date) 는 btree 가 null 을 색인하므로 그대로 유효.
-- RLS 는 기존 for-all 정책이 커버하므로 추가 정책이 필요 없다. (비파괴 — not null 제약 해제만)

-- ─────────────────────────────────────────────
-- tasks.due_date 의 not null 제약 해제 (null = 날짜 미정)
-- ─────────────────────────────────────────────
alter table public.tasks
  alter column due_date drop not null;
