import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { addDaysStr, todayStr } from '@/domain/dayBoundary';
import { cn } from '@/lib/utils';

function relativeLabel(dateStr: string): string | null {
  const today = todayStr();
  if (dateStr === today) return '오늘';
  if (dateStr === addDaysStr(today, 1)) return '내일';
  if (dateStr === addDaysStr(today, -1)) return '어제';
  return null;
}

export function DayHeader() {
  const viewedDate = useUiStore((s) => s.viewedDate);
  const shiftDay = useUiStore((s) => s.shiftDay);
  const goToday = useUiStore((s) => s.goToday);

  const d = parseISO(viewedDate);
  const rel = relativeLabel(viewedDate);
  const main = format(d, 'M월 d일', { locale: ko });
  const weekday = format(d, 'EEEE', { locale: ko });
  const isToday = rel === '오늘';

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="flex items-baseline gap-2 truncate text-2xl font-semibold tracking-tight">
          {main}
          {rel && <span className="text-base font-medium text-accent">{rel}</span>}
        </h1>
        <p className="mt-0.5 text-sm text-muted">{weekday}</p>
      </div>

      {/* 이전 · 오늘 · 다음 세그먼트 컨트롤 */}
      <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-surface p-1">
        <button
          onClick={() => shiftDay(-1)}
          aria-label="이전 날"
          className="grid size-8 place-items-center rounded-full text-muted transition hover:bg-surface2 hover:text-text"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          onClick={goToday}
          disabled={isToday}
          className={cn(
            'rounded-full px-3 py-1 text-sm font-medium transition',
            isToday ? 'cursor-default text-muted' : 'text-text hover:bg-surface2'
          )}
        >
          오늘
        </button>
        <button
          onClick={() => shiftDay(1)}
          aria-label="다음 날"
          className="grid size-8 place-items-center rounded-full text-muted transition hover:bg-surface2 hover:text-text"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
    </div>
  );
}
