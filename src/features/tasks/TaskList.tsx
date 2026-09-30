import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Feather,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { ALL_TAB, type Group } from '@/db/types';
import { useUiStore } from '@/store/uiStore';
import { todayStr } from '@/domain/dayBoundary';
import { positionBetween } from '@/domain/order';
import {
  completionCount,
  deriveSections,
  groupSectionsBySpace,
  groupSectionsByGroup,
} from '@/domain/sections';
import type { DaySections, GroupBucket } from '@/domain/sections';
import { isVirtualOccurrence, virtualOccurrences } from '@/domain/recurrence';
import type { Task } from '@/db/types';
import { useActiveTab } from '@/features/spaces/useActiveTab';
import { useGroups } from '@/features/spaces/useGroups';
import { useRecurrences } from '@/features/spaces/useRecurrences';
import { useUserId } from '@/features/auth/authContext';
import { moveItem } from '@/features/spaces/spaceSelection';
import { cn } from '@/lib/utils';
import type { GroupOption } from './GroupMovePopover';
import type { TaskMoveProps } from './MoveTaskPopover';
import { TaskItem, type RecurrenceProps } from './TaskItem';
import { useTasks } from './useTasks';

const byPosition = (a: Group, b: Group) =>
  a.position < b.position ? -1 : a.position > b.position ? 1 : 0;

export function TaskList() {
  const viewedDate = useUiStore((s) => s.viewedDate);

  const userId = useUserId();
  const { activeTab, spaces } = useActiveTab();
  const {
    tasks,
    recurrenceSkips,
    isLoading,
    toggleTask,
    renameTask,
    deleteTask,
    moveTaskToGroup,
    moveTaskToDate,
    moveTaskToSpace,
    reorderTask,
  } = useTasks();
  const { groups, renameGroup, deleteGroup, reorderGroups } = useGroups();
  const { recurrences, updateRecurrence, removeRecurrence } = useRecurrences();

  const today = todayStr();
  const isAll = activeTab === ALL_TAB;
  const isToday = viewedDate === today;

  // 보는 날짜의 가상 발생분을 계산해 실제 목록에 섞는다(compute-on-view).
  // 감지엔 살아있는 tasks + 그날 "건너뜀" 표식을 함께 넘겨, 이미 처리한 반복은 다시 뜨지 않게 한다.
  const dayTasks = useMemo(() => {
    const virtuals = virtualOccurrences(
      recurrences,
      [...tasks, ...recurrenceSkips],
      viewedDate,
      { userId }
    );
    return [...tasks, ...virtuals];
  }, [recurrences, tasks, recurrenceSkips, viewedDate, userId]);

  // 반복 관리 값 묶음 — 항목까지 흘려보낸다(반복 아이콘·규칙 편집·중단).
  const recurrenceProps: RecurrenceProps = {
    recurrences,
    onUpdate: updateRecurrence,
    onStop: removeRecurrence,
  };

  // 이름 수정 라우팅: 반복 출신이면 시리즈 제목을 고치고(습관은 "매일 같은 것"),
  // 이미 실체화된 실제 행이면 그 행 제목도 함께 바꾼다. 일반 항목은 그대로.
  const handleRename = (task: Task, title: string) => {
    if (task.recurrenceId != null) {
      updateRecurrence({ id: task.recurrenceId, title });
      if (!isVirtualOccurrence(task)) renameTask(task.id, title);
    } else {
      renameTask(task.id, title);
    }
  };

  // 전체 탭 상단 카운트는 현존 공간의 할 일만 센다 (삭제된 공간의 고아 태스크 제외 → 공간별 묶음과 합계 일치)
  const spaceIds = new Set(spaces.map((s) => s.id));
  const scoped = isAll
    ? dayTasks.filter((t) => spaceIds.has(t.spaceId))
    : dayTasks.filter((t) => t.spaceId === activeTab);
  const sections = deriveSections(scoped, viewedDate, today);
  const count = completionCount(sections); // 상단 진행률: 전체 합산(또는 단일 공간)
  const isEmpty = count.total === 0;
  const pct = count.total > 0 ? Math.round((count.done / count.total) * 100) : 0;
  const allDone = !isEmpty && count.done === count.total; // 오늘 다 끝냈을 때 축하 배너 조건
  // 빈 오늘에도 헤더를 유지해 첫 항목 추가 시 레이아웃이 튀지 않게 한다(빈 과거 날은 EmptyState만).
  const showHeader = !isEmpty || isToday;

  // 전체 탭에서는 공간별로 묶는다 (SPEC §82)
  const spaceGroupsView = isAll ? groupSectionsBySpace(dayTasks, spaces, viewedDate, today) : [];

  // 특정 공간: 그 공간의 살아있는 그룹(position 순). 하나라도 있으면 그룹별로 나눠 보여준다.
  const spaceGroups = isAll
    ? []
    : groups.filter((g) => g.spaceId === activeTab).slice().sort(byPosition);
  const hasGroups = spaceGroups.length > 0;
  const groupOptions: GroupOption[] = spaceGroups.map((g) => ({ id: g.id, name: g.name }));
  const buckets: GroupBucket[] = hasGroups
    ? groupSectionsByGroup(scoped, groupOptions, viewedDate, today)
    : [];

  const handlers = { onToggle: toggleTask, onRename: handleRename, onDelete: deleteTask };

  // 세로 리오더 커밋: 드롭 위치의 두 이웃 position 사이 키를 계산해 저장한다(due_date 불변).
  // 단일 공간 뷰(그리고 각 그룹 버킷)의 "할 일"에서만 쓴다. [전체] 탭·완료/넘어옴은 제외.
  const commitReorder: ReorderCommit = (movedId, before, after) =>
    reorderTask(movedId, positionBetween(before, after));
  const reorderCtl = isAll ? undefined : commitReorder;

  // 통합 이동(날짜·공간·그룹) 값 묶음 — 모든 뷰의 항목에 붙는다.
  // 그룹 목록은 전 공간을 넘기고, 팝오버가 각 항목의 spaceId로 걸러 쓴다([전체] 탭 대응).
  const moveProps: MoveProps = {
    spaces: spaces.map((s) => ({ id: s.id, name: s.name, color: s.color })),
    groups,
    today,
    onMoveToDate: moveTaskToDate,
    onMoveToSpace: moveTaskToSpace,
    onMoveToGroup: moveTaskToGroup,
  };

  const reorderAt = (from: number, to: number) =>
    reorderGroups(moveItem(spaceGroups, from, to).map((g) => g.id));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {showHeader && (
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3.5">
          {isEmpty ? (
            <>
              <span className="text-sm text-muted">할 일</span>
              <div className="h-1.5 w-28 overflow-hidden rounded-full bg-surface2" aria-hidden />
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-semibold tabular-nums">
                  {count.done}/{count.total}
                </span>
                <span className="text-xs text-muted">완료</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-muted">{pct}%</span>
                <div className="h-1.5 w-28 overflow-hidden rounded-full bg-surface2">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-2">
        {isToday && allDone && <AllDoneBanner total={count.total} />}
        {isLoading && isEmpty ? (
          <div className="flex h-full min-h-40 items-center justify-center text-sm text-muted">
            불러오는 중…
          </div>
        ) : isAll ? (
          isEmpty ? (
            <EmptyState isToday={isToday} />
          ) : (
            spaceGroupsView.map((g) => (
              <section key={g.spaceId} className="px-2 pb-1 pt-3 first:pt-1">
                <div className="flex items-center gap-2 px-3 pb-0.5">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: g.color }}
                    aria-hidden
                  />
                  <span className="text-sm font-semibold">{g.name}</span>
                  <span className="text-xs text-muted">
                    {g.count.done}/{g.count.total}
                  </span>
                </div>
                <SectionsView
                  sections={g.sections}
                  moveProps={moveProps}
                  recurrenceProps={recurrenceProps}
                  {...handlers}
                />
              </section>
            ))
          )
        ) : hasGroups ? (
          // 특정 공간 + 그룹 있음: 그룹별 접이식 섹션.
          // 과거 날짜인데 그날 항목이 하나도 없으면(모든 버킷 숨김) 빈 상태를 보여준다.
          isEmpty && !isToday ? (
            <EmptyState isToday={isToday} />
          ) : (
          <div className="pb-2">
            {buckets.map((bucket) => {
              const group = bucket.groupId
                ? spaceGroups.find((g) => g.id === bucket.groupId)
                : null;
              const idx = group ? spaceGroups.findIndex((g) => g.id === group.id) : -1;
              // 실제 그룹: 오늘엔 모두, 지난 날엔 항목이 있는 것만. 그룹 없음: 항목 있을 때만.
              const visible =
                bucket.groupId === null ? bucket.count.total > 0 : isToday || bucket.count.total > 0;
              if (!visible) return null;
              return (
                <GroupSection
                  key={bucket.groupId ?? '__none__'}
                  bucket={bucket}
                  group={group ?? null}
                  moveProps={moveProps}
                  recurrenceProps={recurrenceProps}
                  onRenameGroup={renameGroup}
                  onDeleteGroup={group ? () => deleteGroup(group) : undefined}
                  onMoveUp={group && idx > 0 ? () => reorderAt(idx, idx - 1) : undefined}
                  onMoveDown={
                    group && idx < spaceGroups.length - 1 ? () => reorderAt(idx, idx + 1) : undefined
                  }
                  reorder={reorderCtl}
                  {...handlers}
                />
              );
            })}
          </div>
          )
        ) : isEmpty ? (
          <EmptyState isToday={isToday} />
        ) : (
          // 특정 공간 + 그룹 없음 + 항목 있음: 평면 렌더(기존)
          <div className="pb-2">
            <SectionsView
              sections={sections}
              reorder={reorderCtl}
              moveProps={moveProps}
              recurrenceProps={recurrenceProps}
              {...handlers}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ isToday }: { isToday: boolean }) {
  return (
    <div className="flex min-h-40 flex-1 flex-col items-center justify-center px-4 text-center">
      {isToday ? (
        <>
          <div className="mb-3 grid size-11 place-items-center rounded-full bg-accentSoft text-accent">
            <Feather className="size-5" />
          </div>
          <p className="text-sm font-medium">오늘은 아직 비어 있어요</p>
          <p className="mt-1 text-xs text-muted">아래에 첫 할 일을 적어 보세요.</p>
        </>
      ) : (
        <>
          <div className="mb-3 grid size-11 place-items-center rounded-full bg-surface2 text-muted">
            <CalendarDays className="size-5" />
          </div>
          <p className="text-sm text-muted">이 날엔 기록된 할 일이 없어요.</p>
        </>
      )}
    </div>
  );
}

/** 오늘 할 일을 모두 끝냈을 때의 축하 배너 (오늘 화면에서만) */
function AllDoneBanner({ total }: { total: number }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-2 mb-1 mt-1 flex items-center gap-2.5 rounded-xl bg-accentSoft px-4 py-2.5"
    >
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-accentFg">
        <CheckCircle2 className="size-4" />
      </span>
      <p className="min-w-0 truncate text-sm font-medium text-accent">
        오늘 할 일을 다 끝냈어요 🎉 <span className="text-muted">· {total}개 완료</span>
      </p>
    </motion.div>
  );
}

type MoveProps = TaskMoveProps;

type SectionHandlers = {
  onToggle: (task: Task) => void;
  onRename: (task: Task, title: string) => void;
  onDelete: (task: Task) => void;
};

/** 한 그룹(접이식) 섹션: 헤더(접기·이름·카운트·관리) + 본문 */
function GroupSection({
  bucket,
  group,
  moveProps,
  recurrenceProps,
  reorder,
  onToggle,
  onRename,
  onDelete,
  onRenameGroup,
  onDeleteGroup,
  onMoveUp,
  onMoveDown,
}: {
  bucket: GroupBucket;
  group: Group | null;
  moveProps: MoveProps;
  recurrenceProps?: RecurrenceProps;
  reorder?: ReorderCommit;
  onRenameGroup: (id: string, name: string) => void;
  onDeleteGroup?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
} & SectionHandlers) {
  const collapsed = useUiStore((s) => group != null && s.collapsedGroups.includes(group.id));
  const toggleCollapsed = useUiStore((s) => s.toggleGroupCollapsed);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(group?.name ?? '');

  const canManage = group != null;

  function commitName() {
    setEditing(false);
    const next = draft.trim();
    if (group && next && next !== group.name) onRenameGroup(group.id, next);
    else setDraft(group?.name ?? '');
  }

  return (
    <section className="px-2 pt-3 first:pt-1">
      <div className="group/head flex items-center gap-1.5 px-1.5 pb-0.5">
        <button
          onClick={() => group && toggleCollapsed(group.id)}
          disabled={!canManage}
          aria-label={collapsed ? '펼치기' : '접기'}
          className="grid size-6 shrink-0 place-items-center rounded-md text-muted transition hover:bg-surface2 hover:text-text disabled:opacity-30"
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
        </button>

        {editing && group ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) commitName();
              if (e.key === 'Escape') {
                setDraft(group.name);
                setEditing(false);
              }
            }}
            aria-label="그룹 이름 수정"
            className="min-w-0 flex-1 rounded-lg bg-surface px-2 py-0.5 text-sm font-semibold outline-none ring-1 ring-accent"
          />
        ) : canManage ? (
          <button
            onClick={() => {
              setDraft(bucket.name);
              setEditing(true);
            }}
            className="min-w-0 truncate text-left text-sm font-semibold"
          >
            {bucket.name}
          </button>
        ) : (
          <span className="min-w-0 truncate text-sm font-semibold text-muted">{bucket.name}</span>
        )}

        <span className="shrink-0 text-xs text-muted">
          {bucket.count.done}/{bucket.count.total}
        </span>

        <span className="flex-1" />

        {canManage && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover/head:opacity-100 focus-within:opacity-100 max-md:opacity-100">
            <HeaderBtn label="위로" onClick={onMoveUp} disabled={!onMoveUp}>
              <ArrowUp className="size-3.5" />
            </HeaderBtn>
            <HeaderBtn label="아래로" onClick={onMoveDown} disabled={!onMoveDown}>
              <ArrowDown className="size-3.5" />
            </HeaderBtn>
            <HeaderBtn label="그룹 삭제" onClick={onDeleteGroup} danger>
              <Trash2 className="size-3.5" />
            </HeaderBtn>
          </div>
        )}
      </div>

      {!collapsed &&
        (bucket.count.total === 0 ? (
          <p className="px-3 py-2 text-xs text-muted">아직 할 일이 없어요</p>
        ) : (
          <SectionsView
            sections={bucket.sections}
            onToggle={onToggle}
            onRename={onRename}
            onDelete={onDelete}
            moveProps={moveProps}
            recurrenceProps={recurrenceProps}
            reorder={reorder}
          />
        ))}
    </section>
  );
}

function HeaderBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'grid size-6 place-items-center rounded-md text-muted transition disabled:opacity-25',
        danger ? 'hover:bg-red-500/10 hover:text-red-500' : 'hover:bg-surface2 hover:text-text'
      )}
    >
      {children}
    </button>
  );
}

/** 순서 변경 커밋: 옮긴 항목 id와 드롭 위치의 두 이웃 position */
type ReorderCommit = (movedId: string, before: string | null, after: string | null) => void;

/** 한 묶음(공간/그룹)의 남은 일/할 일/완료 섹션 */
function SectionsView({
  sections,
  onToggle,
  onRename,
  onDelete,
  moveProps,
  recurrenceProps,
  reorder,
}: {
  sections: DaySections;
  moveProps?: MoveProps;
  recurrenceProps?: RecurrenceProps;
  /** 넘기면 "할 일" 목록을 세로 드래그로 리오더할 수 있다 */
  reorder?: ReorderCommit;
} & SectionHandlers) {
  const extra = { moveProps, recurrenceProps };
  return (
    <>
      {sections.carried.length > 0 && (
        <Section title="남은 일" tone="carried" icon={CornerDownRight} count={sections.carried.length}>
          <AnimatePresence initial={false}>
            {sections.carried.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                overdueDays={t.overdueDays}
                onToggle={onToggle}
                onRename={onRename}
                onDelete={onDelete}
                {...extra}
              />
            ))}
          </AnimatePresence>
        </Section>
      )}
      {sections.open.length > 0 &&
        (reorder ? (
          <Section title="할 일">
            <ReorderList
              items={sections.open}
              onCommit={reorder}
              moveProps={moveProps}
              recurrenceProps={recurrenceProps}
              onToggle={onToggle}
              onRename={onRename}
              onDelete={onDelete}
            />
          </Section>
        ) : (
          <Section title="할 일">
            <AnimatePresence initial={false}>
              {sections.open.map((t) => (
                <TaskItem
                  key={t.id}
                  task={t}
                  onToggle={onToggle}
                  onRename={onRename}
                  onDelete={onDelete}
                  {...extra}
                />
              ))}
            </AnimatePresence>
          </Section>
        ))}
      {/* 완료 섹션은 완료한 항목이 없어도 자리를 유지한다 (그날의 완료 영역이 늘 보이도록) */}
      <Section title="완료" tone="done" count={sections.completed.length}>
        {sections.completed.length > 0 ? (
          <AnimatePresence initial={false}>
            {sections.completed.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                onToggle={onToggle}
                onRename={onRename}
                onDelete={onDelete}
                {...extra}
              />
            ))}
          </AnimatePresence>
        ) : (
          <p className="px-3 py-2 text-xs text-muted">아직 없어요</p>
        )}
      </Section>
    </>
  );
}

/**
 * "할 일"(open) 목록의 세로 드래그 리오더.
 * - framer-motion Reorder로 순서를 즉시 보여주고(로컬 미러), 드롭 시점에 두 이웃 사이 키만 저장.
 * - Reorder.Item은 dragListener=false — 좌측 GripVertical 핸들에서만 드래그가 시작된다.
 *   그래서 TaskItem의 가로 스와이프(완료/삭제, drag='x')와 충돌하지 않는다.
 */
function ReorderList({
  items,
  onCommit,
  moveProps,
  recurrenceProps,
  onToggle,
  onRename,
  onDelete,
}: {
  items: Task[];
  onCommit: ReorderCommit;
  moveProps?: MoveProps;
  recurrenceProps?: RecurrenceProps;
} & SectionHandlers) {
  const [order, setOrder] = useState<Task[]>(items);
  const orderRef = useRef(order);
  orderRef.current = order;

  // 서버(캐시) 순서가 바뀌면 로컬 미러를 맞춘다. 드래그 중엔 items가 그대로라 리셋되지 않는다.
  const syncKey = items.map((t) => `${t.id}:${t.position}`).join('|');
  useEffect(() => {
    setOrder(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey]);

  const commit = (movedId: string) => {
    const arr = orderRef.current;
    const i = arr.findIndex((t) => t.id === movedId);
    if (i < 0) return;
    const before = arr[i - 1]?.position ?? null;
    const after = arr[i + 1]?.position ?? null;
    const cur = arr[i].position;
    // 순서가 그대로면(이미 이웃 사이에 정렬돼 있으면) 저장하지 않는다 — 클릭/미세 드래그 no-op 방지.
    if ((before == null || before < cur) && (after == null || cur < after)) return;
    onCommit(movedId, before, after);
  };

  return (
    <Reorder.Group
      as="div"
      axis="y"
      values={order}
      onReorder={setOrder}
      className="flex flex-col gap-0.5"
    >
      {order.map((task) => (
        <ReorderRow
          key={task.id}
          task={task}
          onCommit={() => commit(task.id)}
          moveProps={moveProps}
          recurrenceProps={recurrenceProps}
          onToggle={onToggle}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </Reorder.Group>
  );
}

/** 리오더 목록의 한 행: 핸들에서만 드래그를 시작하고, 드롭되면 새 position을 커밋한다. */
function ReorderRow({
  task,
  onCommit,
  moveProps,
  recurrenceProps,
  onToggle,
  onRename,
  onDelete,
}: {
  task: Task;
  onCommit: () => void;
  moveProps?: MoveProps;
  recurrenceProps?: RecurrenceProps;
} & SectionHandlers) {
  const controls = useDragControls();
  return (
    <Reorder.Item as="div" value={task} dragListener={false} dragControls={controls} onDragEnd={onCommit}>
      <TaskItem
        task={task}
        onToggle={onToggle}
        onRename={onRename}
        onDelete={onDelete}
        moveProps={moveProps}
        recurrenceProps={recurrenceProps}
        dragHandle
        onDragHandlePointerDown={(e: ReactPointerEvent) => controls.start(e)}
      />
    </Reorder.Item>
  );
}

function Section({
  title,
  count,
  tone,
  icon: Icon,
  children,
}: {
  title: string;
  /** 제목 옆 개수 (0이면 숨김) */
  count?: number;
  /** carried=넘어옴(따뜻한 강조), done=완료(살짝 후퇴) */
  tone?: 'carried' | 'done';
  icon?: LucideIcon;
  children: ReactNode;
}) {
  const warm = tone === 'carried';
  return (
    <section className="px-2 py-1">
      <div className="flex items-center gap-1.5 px-3 pb-1 pt-2">
        {Icon && <Icon className={cn('size-3.5', warm ? 'text-overdueFg' : 'text-muted')} />}
        <h2
          className={cn('text-xs font-medium tracking-wide', warm ? 'text-overdueFg' : 'text-muted')}
        >
          {title}
        </h2>
        {count != null && count > 0 && (
          <span className={cn('text-xs tabular-nums', warm ? 'text-overdueFg' : 'text-muted')}>
            {count}
          </span>
        )}
      </div>
      <div className={cn('flex flex-col gap-0.5', tone === 'done' && 'opacity-70')}>{children}</div>
    </section>
  );
}
