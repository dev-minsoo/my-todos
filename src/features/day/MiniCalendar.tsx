import { useState } from 'react';
import { format, isSameMonth, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { monthGridDays, shiftMonth } from '@/domain/calendar';
import { todayStr } from '@/domain/dayBoundary';
import { cn } from '@/lib/utils';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 팝오버 안의 월 격자: 달 이동 + 날짜 선택. 하루 화면 날짜 선택과 항목 이동에서 공유한다.
 * 열릴 때만 마운트되면 useState(selectedDate)가 그 날짜가 속한 달로 자동 초기화된다.
 */
export function MiniCalendar({
  selectedDate,
  onPick,
}: {
  /** 강조할 날짜('YYYY-MM-DD'). 처음 보여줄 달도 이 날짜가 속한 달로 잡는다. */
  selectedDate: string;
  onPick: (day: string) => void;
}) {
  const [anchor, setAnchor] = useState(selectedDate);
  const today = todayStr();
  const days = monthGridDays(anchor);
  const monthLabel = format(parseISO(anchor), 'yyyy년 M월', { locale: ko });

  return (
    <div className="px-2 pb-2 pt-1">
      <div className="mb-1 flex items-center justify-between px-1">
        <button
          onClick={() => setAnchor(shiftMonth(anchor, -1))}
          aria-label="이전 달"
          className="grid size-7 place-items-center rounded-md text-muted transition hover:bg-surface2 hover:text-text"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-semibold">{monthLabel}</span>
        <button
          onClick={() => setAnchor(shiftMonth(anchor, 1))}
          aria-label="다음 달"
          className="grid size-7 place-items-center rounded-md text-muted transition hover:bg-surface2 hover:text-text"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 px-0.5 pb-1">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="grid h-6 place-items-center text-[11px] font-medium text-muted">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5 px-0.5">
        {days.map((day) => {
          const dd = parseISO(day);
          const inMonth = isSameMonth(dd, parseISO(anchor));
          const selected = day === selectedDate;
          const isTod = day === today;
          return (
            <button
              key={day}
              onClick={() => onPick(day)}
              className={cn(
                'grid size-9 place-items-center rounded-lg text-sm transition',
                !inMonth && 'text-muted/50',
                selected ? 'bg-accent font-semibold text-accentFg' : 'hover:bg-surface2',
                !selected && isTod && 'font-semibold text-accent ring-1 ring-accent/40'
              )}
            >
              {format(dd, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
