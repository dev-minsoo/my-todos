import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { addDaysStr, todayStr } from '@/domain/dayBoundary';

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
  const main = format(d, 'yyyy년 M월 d일', { locale: ko });
  const suffix = rel ?? format(d, '(EEE)', { locale: ko });

  return (
    <div className="flex items-center justify-between px-3 py-2">
      <button
        onClick={() => shiftDay(-1)}
        aria-label="이전 날"
        className="rounded-md p-2 text-muted hover:text-text"
      >
        <ChevronLeft className="size-5" />
      </button>
      <button onClick={goToday} className="text-center" aria-label="오늘로">
        <div className="text-sm font-semibold">{main}</div>
        <div className="text-xs text-muted">{suffix}</div>
      </button>
      <button
        onClick={() => shiftDay(1)}
        aria-label="다음 날"
        className="rounded-md p-2 text-muted hover:text-text"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
