-- My Todos v0.1 초기 스키마
-- 적용 방법 (둘 중 하나):
--   A) Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 실행
--   B) supabase CLI: `supabase db push` (마이그레이션으로 관리)
--
-- 스키마의 단일 출처는 이 마이그레이션 파일이다.
-- 이후 `supabase gen types typescript`로 src/db/types 의 Database 타입을 생성한다.

create extension if not exists "pgcrypto";

-- updated_at 자동 갱신 트리거 함수
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────
-- spaces
-- ─────────────────────────────────────────────
create table if not exists public.spaces (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  color       text not null,
  position    text not null,          -- fractional index (탭 순서)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz             -- 소프트 삭제 (null = 살아있음)
);

create index if not exists spaces_user_idx
  on public.spaces (user_id) where deleted_at is null;

drop trigger if exists spaces_set_updated_at on public.spaces;
create trigger spaces_set_updated_at
  before update on public.spaces
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────
-- tasks
-- ─────────────────────────────────────────────
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  space_id     uuid not null references public.spaces(id) on delete cascade,
  title        text not null,
  due_date     date not null,         -- v0.1: 항상 존재 (날짜 없는 일 없음)
  completed_at timestamptz,           -- null = 할 일, 값 = 완료(그 시각의 날짜에 표시)
  position     text not null,         -- fractional index (v0.1: created_at 순 사용)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index if not exists tasks_user_idx
  on public.tasks (user_id) where deleted_at is null;
create index if not exists tasks_space_due_idx
  on public.tasks (space_id, due_date) where deleted_at is null;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────
-- Row Level Security: 본인 데이터만 접근 (익명 유저 포함)
-- ─────────────────────────────────────────────
alter table public.spaces enable row level security;
alter table public.tasks  enable row level security;

drop policy if exists "spaces own rows" on public.spaces;
create policy "spaces own rows" on public.spaces
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "tasks own rows" on public.tasks;
create policy "tasks own rows" on public.tasks
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
