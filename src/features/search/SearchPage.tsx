import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Check, Search, X } from 'lucide-react';
import type { Task } from '@/db/types';
import { useUiStore } from '@/store/uiStore';
import { useTasks } from '@/features/tasks/useTasks';
import { useSpaces } from '@/features/spaces/useSpaces';
import { searchTasks } from '@/domain/search';
import { PageHeader } from '@/components/PageHeader';
import { cn } from '@/lib/utils';

/** dueDate 'YYYY-MM-DD' → 'M월 d일' (파싱 실패 시 원문) */
function dueLabel(dueDate: string): string {
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

  const { tasks, isLoading } = useTasks();
  const { spaces } = useSpaces();
  const spaceById = useMemo(() => new Map(spaces.map((s) => [s.id, s])), [spaces]);

  const [query, setQuery] = useState('');
  const results = useMemo(() => searchTasks(tasks, query), [tasks, query]);

  const trimmed = query.trim();

  // 결과 클릭: 그 할 일의 날짜·공간으로 점프한 뒤 하루 화면으로 전환한다.
  function openTask(task: Task) {
    setViewedDate(task.dueDate);
    setCurrentTab(task.spaceId);
    setView('day');
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="검색" description="날짜·공간과 무관하게 제목으로 할 일을 찾아요." />

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

          {/* 결과 */}
          <div className="mt-5">
            {trimmed === '' ? (
              <EmptyHint icon={<Search className="size-9 text-muted" strokeWidth={1.5} />}>
                <p className="mt-1 text-sm text-muted">제목으로 할 일을 검색해요</p>
                <p className="text-xs text-muted">날짜·공간을 가로질러 찾고, 눌러서 그날로 이동해요</p>
              </EmptyHint>
            ) : isLoading && tasks.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">불러오는 중…</p>
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
  return (
    <li>
      <button
        onClick={onOpen}
        className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2.5 text-left transition hover:bg-surface2"
      >
        {/* 완료 여부 표시 (읽기 전용) */}
        {done ? (
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
            <Check className="size-3.5" strokeWidth={3} />
          </span>
        ) : (
          <span className="size-5 shrink-0 rounded-full border-2 border-border" aria-hidden />
        )}

        <span className={cn('min-w-0 flex-1 truncate text-sm', done && 'text-muted line-through')}>
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

function EmptyHint({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 py-16 text-center">
      {icon}
      {children}
    </div>
  );
}
