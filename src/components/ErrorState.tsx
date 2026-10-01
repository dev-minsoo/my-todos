import { useState } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 데이터를 불러오지 못했을 때의 공통 상태 UI. 조용히 빈 화면으로 떨어지지 않게
 * "불러오지 못했어요 · 다시 시도" 어포던스를 보여 준다.
 * onRetry가 Promise를 돌려주면(쿼리 refetch) 버튼이 완료될 때까지 회전 아이콘으로 재시도 중을 알린다.
 * compact: 페이지 안 좁은 영역(검색·휴지통·리포트)용으로 세로 여백을 줄인다.
 */
export function ErrorState({
  onRetry,
  title = '불러오지 못했어요',
  description = '네트워크를 확인하고 다시 시도해 주세요.',
  compact = false,
}: {
  onRetry: () => void | Promise<unknown>;
  title?: string;
  description?: string;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  function retry() {
    if (busy) return;
    const result = onRetry();
    // refetch는 Promise를 돌려준다 — 끝날 때까지 재시도 중 표시(성공 시 이 컴포넌트는 사라진다).
    if (result && typeof (result as Promise<unknown>).finally === 'function') {
      setBusy(true);
      (result as Promise<unknown>).finally(() => setBusy(false));
    }
  }

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center px-4 text-center',
        compact ? 'py-14' : 'min-h-40 flex-1 py-16'
      )}
    >
      <div className="mb-3 grid size-11 place-items-center rounded-full bg-red-500/10 text-red-500">
        <AlertCircle className="size-5" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted">{description}</p>
      <button
        type="button"
        onClick={retry}
        disabled={busy}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-surface2 px-3.5 py-2 text-sm font-medium text-text transition hover:bg-border disabled:opacity-60"
      >
        <RotateCcw className={cn('size-4', busy && 'animate-spin')} />
        다시 시도
      </button>
    </div>
  );
}
