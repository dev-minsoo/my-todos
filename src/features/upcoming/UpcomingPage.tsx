import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarClock, Repeat } from 'lucide-react';
import { ALL_TAB, type Task } from '@/db/types';
import { useUiStore } from '@/store/uiStore';
import { todayStr, daysBetween } from '@/domain/dayBoundary';
import { upcomingDays } from '@/domain/upcoming';
import { useActiveTab } from '@/features/spaces/useActiveTab';
import { useRecurrences } from '@/features/spaces/useRecurrences';
import { useUserId } from '@/features/auth/authContext';
import { useTasks } from '@/features/tasks/useTasks';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState } from '@/components/ErrorState';
import { cn } from '@/lib/utils';

const SPAN_OPTIONS = [7, 14, 30] as const;
type Span = (typeof SPAN_OPTIONS)[number];

/** 날짜 헤더 — 내일/모레는 상대어 + 날짜를 함께, 그 밖엔 'M월 d일 (요일)'. */
function dayHeading(today: string, d: string): string {
  const full = format(parseISO(d), 'M월 d일 (EEE)', { locale: ko });
  const diff = daysBetween(today, d);
  if (diff === 1) return `내일 · ${full}`;
  if (diff === 2) return `모레 · ${full}`;
  return full;
}

/**
 * '앞으로' 미리보기 — 오늘 이후 예정(날짜 있는 할 일 + 반복 발생분)을 날짜별로 펼친 읽기 전용 페이지.
 *
 * - 하루 화면은 하루씩만 보여 줘 내일·모레 뭐가 몰리는지 안 보인다. 여기서 7/14/30일을 한눈에 본다.
 * - 저장하지 않는 파생 뷰(upcomingDays 순수 함수). 넘어옴·반복과 같은 compute-on-view 사상.
 * - 행은 가볍게(제목·공간·반복 표시)만 보여 주고, 탭하면 그 공간·그 날짜의 하루 화면으로 점프한다.
 *   조작(체크/이동/스와이프)은 하루 화면에서 — 미리보기 성격을 유지한다.
 * - 공간 스코프는 하루 화면과 동일(활성 탭). 오늘·날짜 미정('나중에')은 각각 하루·someday가 담당 → 제외.
 */
export function UpcomingPage() {
  const setViewedDate = useUiStore((s) => s.setViewedDate);
  const setCurrentTab = useUiStore((s) => s.setCurrentTab);
  const setView = useUiStore((s) => s.setView);

  const { activeTab, spaces } = useActiveTab();
  const { tasks, recurrenceSkips, isLoading, error, refetch } = useTasks();
  const { recurrences } = useRecurrences();
  const userId = useUserId();

  const [span, setSpan] = useState<Span>(7);

  const today = todayStr();
  const isAll = activeTab === ALL_TAB;
  const spaceById = useMemo(() => new Map(spaces.map((s) => [s.id, s])), [spaces]);

  // 공간 스코프 — 하루 화면과 동일하게 활성 탭을 따른다(tasks·recurrences 둘 다).
  const spaceIds = useMemo(() => new Set(spaces.map((s) => s.id)), [spaces]);
  const scopedTasks = useMemo(
    () =>
      isAll
        ? tasks.filter((t) => spaceIds.has(t.spaceId))
        : tasks.filter((t) => t.spaceId === activeTab),
    [tasks, isAll, spaceIds, activeTab]
  );
  const scopedRecs = useMemo(
    () =>
      isAll
        ? recurrences.filter((r) => spaceIds.has(r.spaceId))
        : recurrences.filter((r) => r.spaceId === activeTab),
    [recurrences, isAll, spaceIds, activeTab]
  );

  const groups = useMemo(
    () =>
      upcomingDays({
        tasks: scopedTasks,
        recurrences: scopedRecs,
        recurrenceSkips,
        today,
        span,
        userId,
      }),
    [scopedTasks, scopedRecs, recurrenceSkips, today, span, userId]
  );

  // 결과 클릭: 그 할 일의 공간으로 맞추고 그 날짜의 하루 화면으로 점프(가상 발생분은 그 화면에서 실체화됨).
  function jumpTo(task: Task, date: string) {
    setCurrentTab(task.spaceId);
    setViewedDate(date);
    setView('day');
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="앞으로" description="다가올 날짜별로 예정된 할 일을 미리 봐요." />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-6">
        <div className="mx-auto w-full max-w-xl">
          {/* 기간 토글 — 오늘 이후 7/14/30일 */}
          <div className="flex items-center gap-2 pb-4">
            <span className="shrink-0 text-xs text-muted">기간</span>
            <div className="flex min-w-0 flex-1 gap-1 rounded-xl bg-surface2 p-1">
              {SPAN_OPTIONS.map((opt) => {
                const active = span === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => setSpan(opt)}
                    aria-pressed={active}
                    className={cn(
                      'flex-1 rounded-lg px-2.5 py-1 text-xs transition',
                      active
                        ? 'bg-surface font-medium text-text shadow-soft'
                        : 'text-muted hover:text-text'
                    )}
                  >
                    {opt}일
                  </button>
                );
              })}
            </div>
          </div>

          {error && tasks.length === 0 ? (
            <ErrorState compact onRetry={() => refetch()} />
          ) : isLoading && tasks.length === 0 ? (
            <p role="status" className="py-10 text-center text-sm text-muted">
              불러오는 중…
            </p>
          ) : groups.length === 0 ? (
            <EmptyHint />
          ) : (
            <div className="space-y-5">
              {groups.map(({ date, items }) => (
                <section key={date}>
                  <div className="flex items-center gap-2 px-1 pb-1.5">
                    <span className="text-sm font-semibold">{dayHeading(today, date)}</span>
                    <span className="text-xs tabular-nums text-muted">{items.length}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {items.map((task) => (
                      <UpcomingRow
                        key={task.id}
                        task={task}
                        space={spaceById.get(task.spaceId)}
                        onOpen={() => jumpTo(task, date)}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 앞으로 미리보기의 가벼운 행 (SearchPage의 ResultRow와 동형).
 * 제목 + 반복 표시 + 공간 색점·이름. 누르면 그 날짜의 하루 화면으로 점프한다. TaskItem/스와이프는 쓰지 않는다.
 */
function UpcomingRow({
  task,
  space,
  onOpen,
}: {
  task: Task;
  space: { name: string; color: string } | undefined;
  onOpen: () => void;
}) {
  const recurring = task.recurrenceId != null;
  return (
    <li>
      <button
        onClick={onOpen}
        className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2.5 text-left transition hover:bg-surface2"
      >
        <span className="size-5 shrink-0 rounded-full border-2 border-border" aria-hidden />

        <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>

        {recurring && (
          <span
            className="grid size-5 shrink-0 place-items-center text-muted"
            title="반복"
            aria-label="반복"
          >
            <Repeat className="size-3.5" />
          </span>
        )}

        {space && (
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
            <span className="size-2.5 rounded-full" style={{ background: space.color }} aria-hidden />
            <span className="max-w-[7rem] truncate">{space.name}</span>
          </span>
        )}
      </button>
    </li>
  );
}

/** 빈 상태 — 예정된 날짜 있는 할 일/반복이 없을 때. */
function EmptyHint() {
  return (
    <div className="flex flex-col items-center gap-1 py-16 text-center">
      <div className="mb-2 grid size-11 place-items-center rounded-full bg-surface2 text-muted">
        <CalendarClock className="size-5" />
      </div>
      <p className="text-sm font-medium">앞으로 예정된 할 일이 없어요</p>
      <p className="text-xs text-muted">날짜를 지정한 할 일과 반복만 여기에 보여요.</p>
    </div>
  );
}
