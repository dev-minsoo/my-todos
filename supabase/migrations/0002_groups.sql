-- My Todos v0.x: 공간 안의 "그룹"(하위 묶음) 추가
-- 적용 방법 (0001과 동일):
--   A) Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 실행
--   B) supabase CLI: `supabase db push`
--
-- 그룹 = 한 공간 안에서 할 일을 나누는 축(예: 개인>건강, 회사>A프로젝트).
-- 상태 개념이 아니다(상태는 여전히 할 일/완료 둘뿐). 소프트 삭제 규칙은 0001과 동일.

-- ─────────────────────────────────────────────
-- groups (spaces 패턴을 그대로 미러)
-- ─────────────────────────────────────────────
create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  space_id    uuid not null references public.spaces(id) on delete cascade,
  name        text not null,
  position    text not null,          -- 순서 (0-패딩 정수 문자열)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz             -- 소프트 삭제 (null = 살아있음)
);

create index if not exists groups_space_idx
  on public.groups (space_id) where deleted_at is null;

drop trigger if exists groups_set_updated_at on public.groups;
create trigger groups_set_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────
-- tasks.group_id (널 허용 = "그룹 없음")
--   그룹을 소프트 삭제해도 이 FK는 그대로다. 클라이언트가 "살아있는 그룹에 없는
--   group_id"를 그룹 없음으로 취급한다. on delete set null 은 그룹을 하드 삭제할 때의 안전망.
-- ─────────────────────────────────────────────
alter table public.tasks
  add column if not exists group_id uuid references public.groups(id) on delete set null;

create index if not exists tasks_group_idx
  on public.tasks (group_id) where deleted_at is null;

-- ─────────────────────────────────────────────
-- Row Level Security: 본인 데이터만
-- ─────────────────────────────────────────────
alter table public.groups enable row level security;

drop policy if exists "groups own rows" on public.groups;
create policy "groups own rows" on public.groups
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
