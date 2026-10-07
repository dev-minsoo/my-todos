import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Ban, Check, Search, X } from 'lucide-react';
import type { Task } from '@/db/types';
import { useUiStore } from '@/store/uiStore';
import { useTasks } from '@/features/tasks/useTasks';
import { useSpaces } from '@/features/spaces/useSpaces';
import { searchTasks, type SearchFilters, type TaskStatus } from '@/domain/search';
import {
  periodRange,
  PERIOD_PRESETS,
  PERIOD_LABELS,
  type PeriodPreset,
} from '@/domain/period';
import { todayStr } from '@/domain/dayBoundary';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState } from '@/components/ErrorState';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS: { value: TaskStatus | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'open', label: '할 일' },
  { value: 'done', label: '완료' },
  { value: 'cancelled', label: '취소' },
];

const RANGE_OPTIONS: { value: PeriodPreset | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  ...PERIOD_PRESETS.map((p) => ({ value: p, label: PERIOD_LABELS[p] })),
];

/** dueDate 'YYYY-MM-DD' → 'M월 d일' (null = 날짜 미정, 파싱 실패 시 원문) */
function dueLabel(dueDate: string | null): string {
  if (dueDate == null) return '날짜 미정';
  try {
    return format(parseISO(dueDate), 'M월 d일', { locale: ko });
  } catch {
    return dueDate;
  }
}

export function SearchPage() {
  const setViewedDate = useUiStore((s) => s.setViewedDate);
  const setCurrentTab = useUiStore((s) => s.setCurrentTab);
  const setView = useUiStore((s) => s.setView);

  const { tasks, isLoading, error, refetch } = useTasks();
  const { spaces } = useSpaces();
  const spaceById = useMemo(() => new Map(spaces.map((s) => [s.id, s])), [spaces]);

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<TaskStatus | 'all'>('all');
  const [spaceId, setSpaceId] = useState<string | 'all'>('all');
  const [rangePreset, setRangePreset] = useState<PeriodPreset | 'all'>('all');

  const filters = useMemo<SearchFilters>(
    () => ({
      status: status === 'all' ? null : status,
      spaceIds: spaceId === 'all' ? null : new Set([spaceId]),
      range: rangePreset === 'all' ? null : periodRange(rangePreset, todayStr()),
    }),
    [status, spaceId, rangePreset]
  );
  const results = useMemo(() => searchTasks(tasks, query, filters), [tasks, query, filters]);

  const trimmed = query.trim();
  const hasActiveFilter = status !== 'all' || spaceId !== 'all' || rangePreset !== 'all';
  function resetFilters() {
    setStatus('all');
    setSpaceId('all');
    setRangePreset('all');
  }

  // 공간 세그먼트 옵션 — '전체' + 공간별(색점). 공간이 1개면 아예 노출하지 않는다.
  const spaceOptions = useMemo<{ value: string; label: string; color?: string }[]>(
    () => [
      { value: 'all', label: '전체' },
      ...spaces.map((s) => ({ value: s.id, label: s.name, color: s.color })),
    ],
    [spaces]
  );

  // 결과 클릭: 그 할 일의 공간으로 맞추고, 날짜가 있으면 그날 화면으로, 날짜 미정이면 '나중에'로 점프.
  function openTask(task: Task) {
    setCurrentTab(task.spaceId);
    if (task.dueDate == null) {
      setView('someday');
    } else {
      setViewedDate(task.dueDate);
      setView('day');
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="검색" description="제목으로 찾고 공간·기간·상태로 좁혀요." />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto w-full max-w-xl">
          {/* 검색 입력칸 */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="할 일 검색…"
              aria-label="할 일 검색"
              className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-9 text-sm outline-none transition placeholder:text-muted focus:border-accent"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="지우기"
                className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:bg-surface2 hover:text-text"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* 필터 — 상태·기간·(공간) 세그먼트. 검색어의 보조로 결과를 좁힌다. */}
          <div className="mt-3 space-y-2">
            <FilterSegment label="상태" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
            <FilterSegment
              label="기간"
              value={rangePreset}
              onChange={setRangePreset}
              options={RANGE_OPTIONS}
            />
            {spaces.length > 1 && (
              <FilterSegment label="공간" value={spaceId} onChange={setSpaceId} options={spaceOptions} />
            )}
            {hasActiveFilter && (
              <div className="flex justify-end">
                <button
                  onClick={resetFilters}
                  className="text-xs font-medium text-muted transition hover:text-text"
                >
                  필터 초기화
                </button>
              </div>
            )}
          </div>

          {/* 결과 */}
          <div className="mt-5">
            {trimmed === '' ? (
              <EmptyHint icon={<Search className="size-9 text-muted" strokeWidth={1.5} />}>
                <p className="mt-1 text-sm text-muted">제목으로 할 일을 검색해요</p>
                <p className="text-xs text-muted">
                  날짜·공간을 가로질러 찾고, 공간·기간·상태로 좁힐 수 있어요
                </p>
              </EmptyHint>
            ) : error && tasks.length === 0 ? (
              <ErrorState compact onRetry={() => refetch()} />
            ) : isLoading && tasks.length === 0 ? (
              <p role="status" className="py-10 text-center text-sm text-muted">
                불러오는 중…
              </p>
            ) : results.length === 0 ? (
              <EmptyHint icon={<Search className="size-9 text-muted" strokeWidth={1.5} />}>
                <p className="mt-1 text-sm text-muted">
                  <span className="text-text">'{trimmed}'</span>에 맞는 할 일이 없어요
                </p>
              </EmptyHint>
            ) : (
              <>
                <p className="px-1 pb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                  결과 <span className="text-muted">{results.length}</span>
                </p>
                <ul className="space-y-1.5">
                  {results.map((task) => (
                    <ResultRow
                      key={task.id}
                      task={task}
                      space={spaceById.get(task.spaceId)}
                      onOpen={() => openTask(task)}
                    />
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 검색 결과 한 행. (TaskItem을 재사용하지 않고 이 파일 안에서 가볍게 렌더한다.)
 * 제목·날짜·공간(색 점+이름)·완료 여부를 보여 주고, 누르면 그 할 일로 점프한다.
 */
function ResultRow({
  task,
  space,
  onOpen,
}: {
  task: Task;
  space: { name: string; color: string } | undefined;
  onOpen: () => void;
}) {
  const done = task.completedAt != null;
  const cancelled = task.cancelledAt != null;
  return (
    <li>
      <button
        onClick={onOpen}
        className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2.5 text-left transition hover:bg-surface2"
      >
        {/* 상태 표시 (읽기 전용): 취소 / 완료 / 할 일 */}
        {cancelled ? (
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface2 text-muted">
            <Ban className="size-3.5" />
          </span>
        ) : done ? (
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
            <Check className="size-3.5" strokeWidth={3} />
          </span>
        ) : (
          <span className="size-5 shrink-0 rounded-full border-2 border-border" aria-hidden />
        )}

        <span
          className={cn(
            'min-w-0 flex-1 truncate text-sm',
            (done || cancelled) && 'text-muted line-through'
          )}
        >
          {task.title}
        </span>

        <span className="shrink-0 text-xs text-muted">{dueLabel(task.dueDate)}</span>

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

/**
 * 검색 필터용 단일 선택 세그먼트 (라벨 + 버튼 묶음). 공용 세그먼트 컴포넌트가 없어
 * 설정/리포트의 인라인 패턴을 따른다. 옵션에 color가 있으면 앞에 색점을 찍는다(공간용).
 */
function FilterSegment<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; color?: string }[];
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-7 shrink-0 text-xs text-muted">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap gap-1 rounded-xl bg-surface2 p-1">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition',
                active ? 'bg-surface font-medium text-text shadow-soft' : 'text-muted hover:text-text'
              )}
            >
              {opt.color && (
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: opt.color }}
                  aria-hidden
                />
              )}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmptyHint({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 py-16 text-center">
      {icon}
      {children}
    </div>
  );
}
