import { useState } from 'react';
import { format, getDay, isSameMonth, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';
import { todayStr } from '@/domain/dayBoundary';
import {
  completedSpaceIds,
  dayStat,
  monthGridDays,
  shiftMonth,
  shiftWeek,
  weekGridDays,
  type DayStat,
} from '@/domain/calendar';
import { PageHeader } from '@/components/PageHeader';
import { useTasks } from '@/features/tasks/useTasks';
import { useActiveTab } from '@/features/spaces/useActiveTab';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
type Mode = 'month' | 'week';
type SpaceDot = { id: string; color: string };

export function CalendarPage() {
  const setViewedDate = useUiStore((s) => s.setViewedDate);
  const setView = useUiStore((s) => s.setView);

  const { tasks } = useTasks();
  const { spaces } = useActiveTab();

  const today = todayStr();
  const [mode, setMode] = useState<Mode>('month');
  // 항상 오늘이 속한 기간(이번 달/이번 주)부터 보여준다
  const [anchor, setAnchor] = useState(today);

  // 기록(회고)은 현재 탭과 무관하게 언제나 모든 공간을 합쳐 보여준다 (orphan만 제외)
  const spaceIds = new Set(spaces.map((s) => s.id));
  const scoped = tasks.filter((t) => spaceIds.has(t.spaceId));

  const days = mode === 'month' ? monthGridDays(anchor) : weekGridDays(anchor);
  const stat = (d: string) => dayStat(scoped, d, today);

  // 그날 완료한 공간들을 색 점으로 (공간 정렬 순서 유지) — 항상 표시
  const dotsOf = (d: string): SpaceDot[] => {
    const done = new Set(completedSpaceIds(scoped, d));
    return spaces.filter((s) => done.has(s.id)).map((s) => ({ id: s.id, color: s.color }));
  };

  const shift = (delta: number) =>
    setAnchor((a) => (mode === 'month' ? shiftMonth(a, delta) : shiftWeek(a, delta)));

  const label =
    mode === 'month'
      ? format(parseISO(anchor), 'yyyy년 M월', { locale: ko })
      : `${format(parseISO(days[0]), 'M월 d일', { locale: ko })} – ${format(
          parseISO(days[6]),
          'M월 d일',
          { locale: ko }
        )}`;

  const openDay = (date: string) => {
    setViewedDate(date);
    setView('day');
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="기록" description="지난 날의 완료를 한눈에 돌아봐요." />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto w-full max-w-2xl">
          {/* 컨트롤: 월/주 토글 + 기간 이동 */}
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-full bg-surface2 p-1">
              <ModeButton active={mode === 'month'} onClick={() => setMode('month')}>
                월
              </ModeButton>
              <ModeButton active={mode === 'week'} onClick={() => setMode('week')}>
                주
              </ModeButton>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{label}</span>
              <div className="flex items-center gap-0.5 rounded-full border border-border bg-surface p-1">
                <NavBtn label="이전" onClick={() => shift(-1)}>
                  <ChevronLeft className="size-4" />
                </NavBtn>
                <button
                  onClick={() => setAnchor(today)}
                  className="rounded-full px-2.5 py-1 text-xs font-medium text-text transition hover:bg-surface2"
                >
                  오늘
                </button>
                <NavBtn label="다음" onClick={() => shift(1)}>
                  <ChevronRight className="size-4" />
                </NavBtn>
              </div>
            </div>
          </div>

          {mode === 'month' ? (
            <MonthGrid
              days={days}
              anchor={anchor}
              today={today}
              stat={stat}
              dots={dotsOf}
              onOpen={openDay}
            />
          ) : (
            <WeekList days={days} today={today} stat={stat} dots={dotsOf} onOpen={openDay} />
          )}
        </div>
      </div>
    </div>
  );
}

/** 완료율을 히트맵 농도(%)로 단계화 — accent 위에 얹는 알파 */
function heatPct(s: DayStat): number {
  if (s.total === 0) return 0;
  if (s.rate >= 1) return 100;
  if (s.rate >= 0.66) return 70;
  if (s.rate >= 0.34) return 45;
  return 18;
}

function MonthGrid({
  days,
  anchor,
  today,
  stat,
  dots,
  onOpen,
}: {
  days: string[];
  anchor: string;
  today: string;
  stat: (d: string) => DayStat;
  dots: (d: string) => SpaceDot[];
  onOpen: (d: string) => void;
}) {
  const anchorDate = parseISO(anchor);
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 pb-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={cn('py-1 text-center text-xs font-medium', i === 0 ? 'text-red-500' : 'text-muted')}
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => (
          <DayCell
            key={d}
            date={d}
            stat={stat(d)}
            dots={dots(d)}
            inMonth={isSameMonth(parseISO(d), anchorDate)}
            isToday={d === today}
            onClick={() => onOpen(d)}
          />
        ))}
      </div>
    </div>
  );
}

function DayCell({
  date,
  stat,
  dots,
  inMonth,
  isToday,
  onClick,
}: {
  date: string;
  stat: DayStat;
  dots: SpaceDot[];
  inMonth: boolean;
  isToday: boolean;
  onClick: () => void;
}) {
  const pct = heatPct(stat);
  const dark = pct >= 66; // 진한 배경 위에는 흰 글씨
  const dayNum = format(parseISO(date), 'd');
  // 칸이 작아 최대 4개까지, 넘치면 앞 3개 + "+N"
  const shownDots = dots.length > 4 ? dots.slice(0, 3) : dots;
  const extra = dots.length - shownDots.length;

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border text-sm transition hover:border-border',
        isToday ? 'border-accent' : 'border-transparent',
        !inMonth && 'opacity-40'
      )}
      style={
        pct > 0
          ? { backgroundColor: `color-mix(in srgb, var(--accent) ${pct}%, transparent)` }
          : undefined
      }
    >
      <span className={cn('font-medium leading-none', dark ? 'text-white' : 'text-text')}>
        {dayNum}
      </span>
      {shownDots.length > 0 && (
        <span className="flex items-center gap-0.5" aria-hidden>
          {shownDots.map((dot) => (
            <span key={dot.id} className="size-1.5 rounded-full" style={{ background: dot.color }} />
          ))}
          {extra > 0 && (
            <span className={cn('text-[9px] leading-none', dark ? 'text-white/80' : 'text-muted')}>
              +{extra}
            </span>
          )}
        </span>
      )}
      {stat.total > 0 && (
        <span className={cn('text-[10px] leading-none', dark ? 'text-white/80' : 'text-muted')}>
          {stat.done}/{stat.total}
        </span>
      )}
    </button>
  );
}

function WeekList({
  days,
  today,
  stat,
  dots,
  onOpen,
}: {
  days: string[];
  today: string;
  stat: (d: string) => DayStat;
  dots: (d: string) => SpaceDot[];
  onOpen: (d: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      {days.map((d) => {
        const s = stat(d);
        const pd = parseISO(d);
        const isToday = d === today;
        const pct = s.total > 0 ? Math.round(s.rate * 100) : 0;
        const dayDots = dots(d);
        const shownDots = dayDots.length > 5 ? dayDots.slice(0, 4) : dayDots;
        const extra = dayDots.length - shownDots.length;
        return (
          <button
            key={d}
            onClick={() => onOpen(d)}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl border bg-surface px-3 py-2.5 text-left transition hover:bg-surface2',
              isToday ? 'border-accent' : 'border-border'
            )}
          >
            <div className="w-11 shrink-0">
              <div
                className={cn('text-xs', getDay(pd) === 0 ? 'text-red-500' : 'text-muted')}
              >
                {format(pd, 'EEE', { locale: ko })}
              </div>
              <div className="text-lg font-semibold leading-tight">{format(pd, 'd')}</div>
            </div>
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface2">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            {shownDots.length > 0 && (
              <span className="flex shrink-0 items-center gap-1" aria-hidden>
                {shownDots.map((dot) => (
                  <span key={dot.id} className="size-2 rounded-full" style={{ background: dot.color }} />
                ))}
                {extra > 0 && <span className="text-[10px] text-muted">+{extra}</span>}
              </span>
            )}
            <span className="shrink-0 text-sm text-muted">
              {s.total > 0 ? `${s.done}/${s.total}` : '—'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full px-3.5 py-1 text-sm transition',
        active ? 'bg-surface font-medium text-text shadow-sm' : 'text-muted hover:text-text'
      )}
    >
      {children}
    </button>
  );
}

function NavBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="grid size-7 place-items-center rounded-full text-muted transition hover:bg-surface2 hover:text-text"
    >
      {children}
    </button>
  );
}
