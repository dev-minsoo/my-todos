-- My Todos v0.x: 할 일 "취소" 상태
-- 적용 방법 (0001~0004와 동일):
--   A) Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 실행
--   B) supabase CLI: `supabase db push` (프로젝트는 `npm run db:push`)
--
-- 개념을 새로 만들지 않는다. "취소"는 워크플로 상태(진행 중 등)가 아니라
-- 완료(completed_at)와 대칭인 두 번째 '닫힘' 상태다. 완료도 삭제도 아닌 채
-- 흐지부지 넘어오기만 하는 할 일을 멈추되(넘어옴 제외) 기록으로 남긴다.
--   · completed_at 과 상호배타: 둘 중 하나만 값을 가진다(앱 레이어가 보장).
--   · 취소한 '날'(cancelled_at 의 로컬 날짜)의 "취소" 섹션에 흐리게 남는다.
--   · 완료 카운트에는 포함하지 않는다.
-- RLS 는 기존 for-all 정책이 새 컬럼까지 커버하므로 추가 정책이 필요 없다.

-- ─────────────────────────────────────────────
-- tasks.cancelled_at (널 = 취소 아님). completed_at 과 대칭.
-- ─────────────────────────────────────────────
alter table public.tasks
  add column if not exists cancelled_at timestamptz;
