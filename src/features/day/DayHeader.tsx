import { useEffect, useRef, useState } from 'react';
import { format, isSameMonth, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { monthGridDays, shiftMonth } from '@/domain/calendar';
import { addDaysStr, todayStr } from '@/domain/dayBoundary';
import { PopoverMenu } from '@/components/PopoverMenu';
import { cn } from '@/lib/utils';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function relativeLabel(dateStr: string): string | null {
  const today = todayStr();
  if (dateStr === today) return '오늘';
  if (dateStr === addDaysStr(today, 1)) return '내일';
  if (dateStr === addDaysStr(today, -1)) return '어제';
  return null;
}

export function DayHeader() {
  const viewedDate = useUiStore((s) => s.viewedDate);
  const setViewedDate = useUiStore((s) => s.setViewedDate);
  const shiftDay = useUiStore((s) => s.shiftDay);
  const goToday = useUiStore((s) => s.goToday);

  const d = parseISO(viewedDate);
  const rel = relativeLabel(viewedDate);
  const main = format(d, 'M월 d일', { locale: ko });
  const weekday = format(d, 'EEEE', { locale: ko });
  const isToday = rel === '오늘';

  // ← / → 로 날짜 이동 (입력 중이거나 조합키가 눌린 경우는 무시). DayHeader는 하루 화면에서만 마운트된다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowLeft') shiftDay(-1);
      else if (e.key === 'ArrowRight') shiftDay(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shiftDay]);

  // 모바일: 헤더 영역 좌우 스와이프로 날짜 넘기기 (버튼 탭은 dx≈0이라 영향 없음).
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const s = touchStart.current;
    touchStart.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) shiftDay(dx < 0 ? 1 : -1);
  }

  return (
    <div
      className="flex items-center justify-between gap-3"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="min-w-0">
        <PopoverMenu
          align="start"
          width={288}
          triggerLabel="날짜 선택"
          triggerClassName="group flex items-baseline gap-2 rounded-lg text-left transition hover:opacity-80"
          trigger={
            <>
              <span className="text-2xl font-semibold tracking-tight">{main}</span>
              <span className="text-base font-medium text-muted">{weekday}</span>
              {rel && <span className="text-base font-medium text-accent">{rel}</span>}
              <ChevronDown className="size-4 self-center text-muted transition group-hover:text-text" />
            </>
          }
        >
          {(close) => (
            <MiniCalendar
              viewedDate={viewedDate}
              onPick={(day) => {
                setViewedDate(day);
                close();
              }}
            />
          )}
        </PopoverMenu>
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

/**
 * 팝오버 안의 월 격자: 달 이동 + 날짜 선택.
 * PopoverMenu는 열릴 때만 이 컴포넌트를 마운트하므로, useState(viewedDate)가
 * 매번 현재 보고 있는 날짜가 속한 달로 자동 초기화된다.
 */
function MiniCalendar({
  viewedDate,
  onPick,
}: {
  viewedDate: string;
  onPick: (day: string) => void;
}) {
  const [anchor, setAnchor] = useState(viewedDate);
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
          const selected = day === viewedDate;
          const isTod = day === today;
          return (
            <button
              key={day}
              onClick={() => onPick(day)}
              className={cn(
                'grid size-9 place-items-center rounded-lg text-sm transition',
                !inMonth && 'text-muted/50',
                selected
                  ? 'bg-accent font-semibold text-accentFg'
                  : 'hover:bg-surface2',
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
