-- My Todos v0.x: 메모 탭 (전역 단일 마크다운 문서)
-- 적용 방법 (0001~0005와 동일):
--   A) Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 실행
--   B) supabase CLI: `supabase db push` (프로젝트는 `npm run db:push`)
--
-- 할 일별 메모(tasks.memo)와 다른 것: 앱 전체에서 한 장만 쓰는 자유 마크다운 노트다.
-- 유저당 한 행(user_id unique) — 단일 문서라 소프트 삭제(deleted_at)가 필요 없다.
-- RLS 는 다른 테이블과 동일한 for-all 정책(user_id = auth.uid())을 쓴다.

-- ─────────────────────────────────────────────
-- notes (유저당 1행)
-- ─────────────────────────────────────────────
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  content     text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────
-- Row Level Security: 본인 노트만 접근
-- ─────────────────────────────────────────────
alter table public.notes enable row level security;

drop policy if exists "notes own rows" on public.notes;
create policy "notes own rows" on public.notes
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
