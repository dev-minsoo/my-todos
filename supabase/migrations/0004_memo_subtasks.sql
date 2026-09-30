-- My Todos v0.x: 메모 + 서브태스크
-- 적용 방법 (0001~0003과 동일):
--   A) Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 실행
--   B) supabase CLI: `supabase db push` (프로젝트는 `npm run db:push`)
--
-- 개념을 새로 만들지 않는다. 서브태스크도 그냥 tasks 행이다
-- (상태는 여전히 할 일/완료 둘뿐). 계층은 parent_id 자기참조 컬럼 하나로 표현하고,
-- 화면에서는 useTasks가 부모(parent_id is null)/자식으로 한 번만 나눠 소비처에 넘긴다.
-- 메모는 최상위 task의 자유 텍스트 컬럼 하나. RLS는 기존 for-all 정책이 새 컬럼까지 커버.

-- ─────────────────────────────────────────────
-- tasks.memo (널 = 메모 없음). 최상위 task에만 쓰지만 컬럼 제약은 걸지 않는다.
-- ─────────────────────────────────────────────
alter table public.tasks
  add column if not exists memo text;

-- ─────────────────────────────────────────────
-- tasks.parent_id (널 = 최상위). 자기참조.
--   on delete cascade: 부모를 하드 삭제(휴지통 비우기)하면 서브태스크도 함께 정리.
--   소프트 삭제(deleted_at)/복원의 부모↔자식 동반은 애플리케이션(useTasks)이 .or()로 처리.
-- ─────────────────────────────────────────────
alter table public.tasks
  add column if not exists parent_id uuid references public.tasks(id) on delete cascade;

create index if not exists tasks_parent_idx
  on public.tasks (parent_id) where deleted_at is null;
