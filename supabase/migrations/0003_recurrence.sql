-- My Todos v0.x: 반복(recurring) 할 일 규칙
-- 적용 방법 (0001/0002와 동일):
--   A) Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 실행
--   B) supabase CLI: `supabase db push`
--
-- 반복 = "매일 운동", "월·수·금 약" 처럼 정기적으로 뜨는 일의 규칙만 저장한다.
-- 발생분(occurrence)은 저장하지 않는다. 화면을 그릴 때 "보는 날짜"에 맞는 규칙을
-- 가상 할 일로 계산해 주입하고(compute-on-view), 사용자가 건드리는 순간에만
-- 실제 tasks 행으로 실체화(materialize)한다.
--
-- 상태 개념이 아니다(상태는 여전히 할 일/완료 둘뿐). 미완료는 넘어오지 않는다(습관형).
-- 소프트 삭제 규칙은 0001과 동일.

-- ─────────────────────────────────────────────
-- recurrences (spaces/groups 패턴을 그대로 미러)
-- ─────────────────────────────────────────────
create table if not exists public.recurrences (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  space_id    uuid not null references public.spaces(id) on delete cascade,
  group_id    uuid references public.groups(id) on delete set null,  -- null = 그룹 없음
  title       text not null,
  rule        jsonb not null,          -- {type:'daily'} | {type:'weekly', weekdays:[0..6]}
  start_date  date not null,           -- 이 날짜부터 발생 (보통 생성한 날)
  position    text not null,           -- fractional index (순서)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz              -- 소프트 삭제 (null = 살아있음)
);

create index if not exists recurrences_space_idx
  on public.recurrences (space_id) where deleted_at is null;

drop trigger if exists recurrences_set_updated_at on public.recurrences;
create trigger recurrences_set_updated_at
  before update on public.recurrences
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────
-- tasks.recurrence_id (널 허용 = "반복에서 나온 것이 아님")
--   반복 규칙을 소프트 삭제해도 이미 실체화된 행은 그대로 남는다(기록 보존).
--   on delete set null 은 반복을 하드 삭제할 때의 안전망.
--   deriveSections는 recurrence_id 가 있는 행을 carried(넘어옴)에서 제외한다(습관형).
-- ─────────────────────────────────────────────
alter table public.tasks
  add column if not exists recurrence_id uuid references public.recurrences(id) on delete set null;

create index if not exists tasks_recurrence_idx
  on public.tasks (recurrence_id) where deleted_at is null;

-- ─────────────────────────────────────────────
-- Row Level Security: 본인 데이터만
-- ─────────────────────────────────────────────
alter table public.recurrences enable row level security;

drop policy if exists "recurrences own rows" on public.recurrences;
create policy "recurrences own rows" on public.recurrences
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
