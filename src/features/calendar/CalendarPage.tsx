import { useState } from 'react';
import { createPortal } from 'react-dom';
import { format, getDay, getMonth, isSameMonth, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';
import { todayStr } from '@/domain/dayBoundary';
import {
  dayStat,
  daySpaceStates,
  grassGridWeeks,
  monthGridDays,
  shiftMonth,
  shiftWeek,
  weekGridDays,
  type DayStat,
} from '@/domain/calendar';
import { PageHeader } from '@/components/PageHeader';
import { virtualOccurrences } from '@/domain/recurrence';
import { useTasks } from '@/features/tasks/useTasks';
import { useActiveTab } from '@/features/spaces/useActiveTab';
import { useRecurrences } from '@/features/spaces/useRecurrences';
import { useUserId } from '@/features/auth/authContext';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const GRASS_WEEKS = 26; // 약 6개월
type Mode = 'month' | 'week' | 'grass';
/** 공간 인디케이터: done=true → 꽉 찬 점(완료), false → 빈 점(할일만) */
type SpaceDot = { id: string; color: string; done: boolean };

export function CalendarPage() {
  const setViewedDate = useUiStore((s) => s.setViewedDate);
  const setView = useUiStore((s) => s.setView);

  const userId = useUserId();
  const { tasks, recurrenceSkips } = useTasks();
  const { spaces } = useActiveTab();
  const { recurrences } = useRecurrences();

  const today = todayStr();
  const [mode, setMode] = useState<Mode>('month');
  // 항상 오늘이 속한 기간(이번 달/이번 주)부터 보여준다
  const [anchor, setAnchor] = useState(today);

  // 기록(회고)은 현재 탭과 무관하게 언제나 모든 공간을 합쳐 보여준다 (orphan만 제외)
  const spaceIds = new Set(spaces.map((s) => s.id));
  const scoped = tasks.filter((t) => spaceIds.has(t.spaceId));

  // 날짜별 가상 발생분 주입 — 반복이 그날 open/완료로 자연 집계된다(시작일 이전엔 안 뜸).
  // 규칙은 현존 공간 것만, 실체화 감지엔 tasks + "건너뜀" 표식을 함께 본다.
  const recs = recurrences.filter((r) => spaceIds.has(r.spaceId));
  const detect = [...tasks, ...recurrenceSkips];
  const withVirtual = (d: string) => [...scoped, ...virtualOccurrences(recs, detect, d, { userId })];

  const stat = (d: string) => dayStat(withVirtual(d), d, today);

  // 그날 공간별 상태를 색 점으로 (공간 정렬 순서 유지) — 완료=꽉 찬 점, 할일만=빈 점
  const dotsOf = (d: string): SpaceDot[] => {
    const byId = new Map(daySpaceStates(withVirtual(d), d, today).map((st) => [st.spaceId, st]));
    return spaces
      .filter((s) => byId.has(s.id))
      .map((s) => ({ id: s.id, color: s.color, done: byId.get(s.id)!.done }));
  };

  const shift = (delta: number) =>
    setAnchor((a) => (mode === 'month' ? shiftMonth(a, delta) : shiftWeek(a, delta)));

  const days = mode === 'week' ? weekGridDays(anchor) : mode === 'month' ? monthGridDays(anchor) : [];

  const label =
    mode === 'grass'
      ? ''
      : mode === 'month'
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
          {/* 컨트롤: 월/주/잔디 토글 + 기간 이동 */}
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-full bg-surface2 p-1">
              <ModeButton active={mode === 'month'} onClick={() => setMode('month')}>
                월
              </ModeButton>
              <ModeButton active={mode === 'week'} onClick={() => setMode('week')}>
                주
              </ModeButton>
              <ModeButton active={mode === 'grass'} onClick={() => setMode('grass')}>
                잔디
              </ModeButton>
            </div>

            {mode === 'grass' ? (
              <span className="text-sm text-muted">최근 6개월</span>
            ) : (
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
            )}
          </div>

          {mode === 'month' && (
            <MonthGrid
              days={days}
              anchor={anchor}
              today={today}
              stat={stat}
              dots={dotsOf}
              onOpen={openDay}
            />
          )}
          {mode === 'week' && (
            <WeekList days={days} today={today} stat={stat} dots={dotsOf} onOpen={openDay} />
          )}
          {mode === 'grass' && (
            <GrassGrid weeks={grassGridWeeks(today, GRASS_WEEKS)} today={today} stat={stat} onOpen={openDay} />
          )}

          {mode !== 'grass' && <DotLegend />}
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

/** 공간 점 하나: 완료가 있으면 꽉 참, 할일만 있으면 테두리만(빈 점) */
function Dot({ color, done, size }: { color: string; done: boolean; size: 'sm' | 'md' }) {
  return (
    <span
      className={cn('rounded-full', size === 'sm' ? 'size-1.5' : 'size-2')}
      style={done ? { background: color } : { boxShadow: `inset 0 0 0 1.5px ${color}` }}
    />
  );
}

/** 점 의미 범례 */
function DotLegend() {
  return (
    <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ background: 'var(--accent)' }} />
        완료
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ boxShadow: 'inset 0 0 0 1.5px var(--accent)' }} />
        할 일만
      </span>
    </div>
  );
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
            <Dot key={dot.id} color={dot.color} done={dot.done} size="sm" />
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
                  <Dot key={dot.id} color={dot.color} done={dot.done} size="md" />
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

/** 잔디(기여 그래프): 요일(행) × 주(열) 작은 사각형, 완료율에 따라 진해진다 */
function GrassGrid({
  weeks,
  today,
  stat,
  onOpen,
}: {
  weeks: string[][];
  today: string;
  stat: (d: string) => DayStat;
  onOpen: (d: string) => void;
}) {
  // 달이 바뀌는 첫 열에만 월 라벨을 단다
  const monthLabels = weeks.map((col, i) => {
    const m = getMonth(parseISO(col[0]));
    const prev = i > 0 ? getMonth(parseISO(weeks[i - 1][0])) : -1;
    return m !== prev ? format(parseISO(col[0]), 'M월', { locale: ko }) : '';
  });

  // 호버(또는 포커스)한 칸 하나에 대해서만 커스텀 툴팁을 띄운다 (칸 위치는 rect로 잡아 포털로 렌더)
  const [hover, setHover] = useState<{ date: string; rect: DOMRect } | null>(null);

  return (
    <div className="overflow-x-auto pb-1">
      <div className="inline-block">
        {/* 월 라벨 */}
        <div className="flex gap-1">
          <div className="w-6 shrink-0" />
          {monthLabels.map((m, i) => (
            <div key={i} className="relative h-4 w-3 shrink-0">
              {m && (
                <span className="absolute left-0 top-0 whitespace-nowrap text-[10px] leading-none text-muted">
                  {m}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* 요일 라벨 + 주 열들 */}
        <div className="flex gap-1">
          <div className="flex w-6 shrink-0 flex-col gap-1">
            {WEEKDAYS.map((w, r) => (
              <div key={w} className="flex size-3 items-center justify-end text-[10px] leading-none text-muted">
                {r % 2 === 1 ? w : ''}
              </div>
            ))}
          </div>
          {weeks.map((col, i) => (
            <div key={i} className="flex shrink-0 flex-col gap-1">
              {col.map((d) => (
                <GrassCell
                  key={d}
                  date={d}
                  stat={stat(d)}
                  today={today}
                  onOpen={onOpen}
                  onHover={setHover}
                />
              ))}
            </div>
          ))}
        </div>

        {hover && <GrassTooltip date={hover.date} stat={stat(hover.date)} rect={hover.rect} />}

        {/* 범례 */}
        <div className="mt-3 flex items-center gap-1.5 pl-7 text-[10px] text-muted">
          <span>적음</span>
          {[0, 18, 45, 70, 100].map((p) => (
            <span
              key={p}
              className="size-3 rounded-[3px] bg-surface2"
              style={
                p > 0
                  ? { backgroundColor: `color-mix(in srgb, var(--accent) ${p}%, transparent)` }
                  : undefined
              }
            />
          ))}
          <span>많음</span>
        </div>
      </div>
    </div>
  );
}

function GrassCell({
  date,
  stat,
  today,
  onOpen,
  onHover,
}: {
  date: string;
  stat: DayStat;
  today: string;
  onOpen: (d: string) => void;
  onHover: (h: { date: string; rect: DOMRect } | null) => void;
}) {
  const future = date > today;
  const pct = heatPct(stat);
  const label = `${format(parseISO(date), 'M월 d일', { locale: ko })} · ${
    stat.total > 0 ? `${stat.done}/${stat.total} 완료` : '할 일 없음'
  }`;
  const show = (e: { currentTarget: HTMLElement }) =>
    onHover({ date, rect: e.currentTarget.getBoundingClientRect() });
  return (
    <button
      type="button"
      disabled={future}
      onClick={() => onOpen(date)}
      onMouseEnter={show}
      onMouseLeave={() => onHover(null)}
      onFocus={show}
      onBlur={() => onHover(null)}
      aria-label={label}
      className={cn(
        'size-3 rounded-[3px] bg-surface2 transition',
        future ? 'opacity-40' : 'hover:ring-1 hover:ring-accent',
        date === today && 'ring-1 ring-accent'
      )}
      style={
        pct > 0
          ? { backgroundColor: `color-mix(in srgb, var(--accent) ${pct}%, transparent)` }
          : undefined
      }
    />
  );
}

/** 잔디 칸 위에 뜨는 커스텀 툴팁 (포털 — 가로 스크롤 컨테이너에 잘리지 않게). */
function GrassTooltip({ date, stat, rect }: { date: string; stat: DayStat; rect: DOMRect }) {
  const d = parseISO(date);
  const dateLabel = format(d, 'M월 d일 (EEE)', { locale: ko });
  const detail =
    stat.total > 0 ? `${stat.done}/${stat.total} 완료 · ${Math.round(stat.rate * 100)}%` : '할 일 없음';

  // 칸 위 중앙에 띄우되, 화면 위쪽이면 아래로 뒤집고 좌우로는 화면 안에 물린다.
  const above = rect.top > 64;
  const half = 92; // 대략적인 툴팁 반너비 (좌우 클램프용)
  const left = Math.min(Math.max(rect.left + rect.width / 2, half + 4), window.innerWidth - half - 4);
  const top = above ? rect.top - 8 : rect.bottom + 8;

  return createPortal(
    <div
      role="tooltip"
      className={cn(
        'pointer-events-none fixed z-50 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs shadow-lg',
        above && '-translate-y-full'
      )}
      style={{ left, top }}
    >
      <div className="font-medium text-text">{dateLabel}</div>
      <div className="mt-0.5 text-muted">{detail}</div>
    </div>,
    document.body
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
