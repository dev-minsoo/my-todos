import { useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { CalendarOff, ChevronDown, Inbox, Plus } from 'lucide-react';
import { ALL_TAB, type Task } from '@/db/types';
import { useUiStore } from '@/store/uiStore';
import { todayStr } from '@/domain/dayBoundary';
import { somedayTasks } from '@/domain/someday';
import { useActiveTab } from '@/features/spaces/useActiveTab';
import { useGroups } from '@/features/spaces/useGroups';
import { targetSpaceId } from '@/features/spaces/spaceSelection';
import { SpacePickerPopover } from '@/features/spaces/SpacePickerPopover';
import { TaskItem, type TaskDetailProps } from '@/features/tasks/TaskItem';
import { TaskDetailModal } from '@/features/tasks/TaskDetailModal';
import type { TaskMoveProps } from '@/features/tasks/MoveTaskPopover';
import { useTasks } from '@/features/tasks/useTasks';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState } from '@/components/ErrorState';

/** TaskItem에 흘려보내는 공통 핸들러(완료·수정·삭제·취소·복구). TaskList의 묶음과 동일. */
type ListHandlers = {
  onToggle: (task: Task) => void;
  onRename: (task: Task, title: string) => void;
  onDelete: (task: Task) => void;
  onCancel: (task: Task) => void;
  onUncancel: (task: Task) => void;
};

/**
 * '나중에' 전용 페이지 — 날짜 미정(dueDate == null) + 열린 할 일만 모은 인박스.
 *
 * - 날짜 미정 항목은 넘어옴 계산(dueDate < today)에서 자연 제외돼 하루 화면·달력엔 안 뜬다.
 * - 완료/취소하면 completionDay/cancellationDay 기준으로 "그날 화면"의 완료·취소 섹션에
 *   귀속되고(= somedayTasks 필터에서 빠짐) 이 목록에서 사라진다 — 처리하는 순간 그날 기록이 된다.
 * - 날짜를 정하는 건 항목의 "이동" 팝오버("오늘로"/날짜 선택)로 한다. 리오더·그룹·반복 UI는 넣지 않는다
 *   (날짜 미정엔 넘어옴/반복이 무의미, 그룹은 이동으로).
 *
 * 스코프는 하루 화면과 동일하게 활성 탭을 따른다: 특정 공간 탭이면 평면, [전체]면 공간별로 묶는다.
 */
export function SomedayPage() {
  const detailTaskId = useUiStore((s) => s.detailTaskId);
  const setDetailTaskId = useUiStore((s) => s.setDetailTaskId);

  const { activeTab, spaces } = useActiveTab();
  const {
    tasks,
    subtasksByParent,
    isLoading,
    error,
    refetch,
    toggleTask,
    renameTask,
    deleteTask,
    cancelTask,
    uncancelTask,
    addSubtask,
    updateMemo,
    moveTaskToDate,
    moveTaskToSpace,
    moveTaskToGroup,
  } = useTasks();
  const { groups } = useGroups();

  const today = todayStr();
  const isAll = activeTab === ALL_TAB;

  // 날짜 미정 + 열린 항목만. 공간 스코프는 하루 화면과 동일(활성 탭).
  const list = useMemo(() => somedayTasks(tasks), [tasks]);
  const spaceIds = useMemo(() => new Set(spaces.map((s) => s.id)), [spaces]);
  const scoped = isAll
    ? list.filter((t) => spaceIds.has(t.spaceId))
    : list.filter((t) => t.spaceId === activeTab);

  // [전체] 탭: 공간 순서대로 묶고, 항목 없는 공간은 생략.
  const bySpace = isAll
    ? spaces
        .map((sp) => ({ space: sp, items: scoped.filter((t) => t.spaceId === sp.id) }))
        .filter((g) => g.items.length > 0)
    : [];

  // TaskItem에 흘려보낼 핸들러·값 묶음 — TaskList와 동일 구성(단, 반복/리오더 제외).
  const handlers: ListHandlers = {
    onToggle: toggleTask,
    onRename: (task, title) => renameTask(task.id, title),
    onDelete: deleteTask,
    onCancel: cancelTask,
    onUncancel: uncancelTask,
  };
  const moveProps: TaskMoveProps = {
    spaces: spaces.map((s) => ({ id: s.id, name: s.name, color: s.color })),
    groups,
    today,
    onMoveToDate: moveTaskToDate,
    onMoveToSpace: moveTaskToSpace,
    onMoveToGroup: moveTaskToGroup,
  };
  const detailProps: TaskDetailProps = {
    subtasksByParent,
    onAddSubtask: addSubtask,
    onEditMemo: (task, memo) => updateMemo(task.id, memo),
  };

  const isEmpty = scoped.length === 0;

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="나중에" description="날짜를 아직 안 정한 할 일을 모아 둬요." />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-6">
        <div className="mx-auto w-full max-w-xl">
          {error && tasks.length === 0 ? (
            <ErrorState compact onRetry={() => refetch()} />
          ) : isLoading && tasks.length === 0 ? (
            <p role="status" className="py-10 text-center text-sm text-muted">
              불러오는 중…
            </p>
          ) : isEmpty ? (
            <EmptyHint />
          ) : isAll ? (
            <div className="space-y-5">
              {bySpace.map(({ space, items }) => (
                <section key={space.id}>
                  <div className="flex items-center gap-2 px-1 pb-1.5">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: space.color }}
                      aria-hidden
                    />
                    <span className="text-sm font-semibold">{space.name}</span>
                    <span className="text-xs tabular-nums text-muted">{items.length}</span>
                  </div>
                  <ItemList
                    items={items}
                    handlers={handlers}
                    moveProps={moveProps}
                    detailProps={detailProps}
                  />
                </section>
              ))}
            </div>
          ) : (
            <ItemList
              items={scoped}
              handlers={handlers}
              moveProps={moveProps}
              detailProps={detailProps}
            />
          )}
        </div>
      </div>

      <SomedayInput activeTab={activeTab} />

      <TaskDetailModal
        taskId={detailTaskId}
        tasks={tasks}
        spaces={spaces}
        groups={groups}
        subtasksByParent={subtasksByParent}
        onCancel={cancelTask}
        onUncancel={uncancelTask}
        onClose={() => setDetailTaskId(null)}
      />
    </div>
  );
}

/** 날짜 미정 항목 목록 — TaskItem 재사용(토글·수정·삭제·취소·이동·상세·메모/서브태스크). */
function ItemList({
  items,
  handlers,
  moveProps,
  detailProps,
}: {
  items: Task[];
  handlers: ListHandlers;
  moveProps: TaskMoveProps;
  detailProps: TaskDetailProps;
}) {
  return (
    <div role="list" className="flex flex-col gap-0.5">
      <AnimatePresence initial={false}>
        {items.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            moveProps={moveProps}
            detailProps={detailProps}
            {...handlers}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

/** 빈 상태 — 할 일을 아래 입력칸에 적으라는 안내. */
function EmptyHint() {
  return (
    <div className="flex flex-col items-center gap-1 py-16 text-center">
      <div className="mb-2 grid size-11 place-items-center rounded-full bg-surface2 text-muted">
        <Inbox className="size-5" />
      </div>
      <p className="text-sm font-medium">아직 담아 둔 일이 없어요</p>
      <p className="text-xs text-muted">날짜는 안 정했지만 언젠가 할 일을 아래에 적어 보세요.</p>
    </div>
  );
}

/**
 * '나중에' 입력칸 — 제목만 적으면 날짜 미정(dueDate: null)으로 등록된다.
 * 대상 공간은 하루 화면 입력과 동일 규칙(활성 탭 / [전체]면 마지막 공간, 칩으로 변경).
 * 그룹은 null 고정(필요하면 항목의 이동으로), 반복은 날짜 미정엔 무의미해 넣지 않는다.
 */
function SomedayInput({ activeTab }: { activeTab: string }) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSpaceId = useUiStore((s) => s.lastSpaceId);
  const setLastSpaceId = useUiStore((s) => s.setLastSpaceId);

  const { spaces } = useActiveTab();
  const { addTask } = useTasks();

  const spaceId = targetSpaceId(activeTab, spaces, lastSpaceId);
  const disabled = !spaceId;

  const isAll = activeTab === ALL_TAB;
  const showSpaceChip = isAll && !!spaceId;
  const currentSpace = spaceId ? spaces.find((s) => s.id === spaceId) ?? null : null;

  function submit() {
    const title = value.trim();
    if (!title || !spaceId) return;
    addTask({ title, dueDate: null, spaceId, groupId: null });
    setLastSpaceId(spaceId);
    setValue('');
    inputRef.current?.focus();
  }

  const canSubmit = !disabled && value.trim().length > 0;

  return (
    <div className="border-t border-border bg-surface p-3">
      <div className="mx-auto w-full max-w-xl">
        {showSpaceChip && currentSpace && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5 px-1">
            <SpacePickerPopover
              spaces={spaces.map((s) => ({ id: s.id, name: s.name, color: s.color }))}
              currentSpaceId={spaceId}
              onSelect={(id) => setLastSpaceId(id)}
              align="start"
              triggerLabel="추가할 공간"
              triggerClassName="inline-flex items-center gap-1 rounded-full bg-surface2 px-2.5 py-1 text-xs font-medium text-text transition hover:bg-border"
              trigger={
                <>
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: currentSpace.color }}
                    aria-hidden
                  />
                  <span className="max-w-[8rem] truncate">{currentSpace.name}</span>
                  <ChevronDown className="size-3 text-muted" />
                </>
              }
            />
          </div>
        )}
        <div className="flex items-center gap-2 rounded-xl bg-bg px-3 py-2.5 ring-1 ring-transparent transition focus-within:ring-accent">
          <CalendarOff className="size-4 shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit();
            }}
            disabled={disabled}
            placeholder={disabled ? '공간을 먼저 만들어 주세요' : '날짜 미정 할 일 추가…'}
            aria-label="날짜 미정 할 일 추가"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted disabled:opacity-50"
          />
          {canSubmit && (
            <button
              type="button"
              onClick={submit}
              aria-label="추가"
              className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-accentFg transition hover:opacity-90 active:scale-95 md:size-7"
            >
              <Plus className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
