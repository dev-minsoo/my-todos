import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  ArrowDown,
  ArrowUp,
  Ban,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  CornerDownRight,
  Feather,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { ALL_TAB, type Group } from '@/db/types';
import { useUiStore } from '@/store/uiStore';
import { todayStr } from '@/domain/dayBoundary';
import { formatDaySummary, type SummaryBlock } from '@/domain/summary';
import { positionBetween } from '@/domain/order';
import {
  completionCount,
  deriveSections,
  groupSectionsBySpace,
  groupSectionsByGroup,
  hasAnyItems,
  NUDGE_OVERDUE_DAYS,
} from '@/domain/sections';
import type { DaySections, GroupBucket, SpaceGroup } from '@/domain/sections';
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
import { TaskItem, type RecurrenceProps, type TaskDetailProps } from './TaskItem';
import { TaskDetailModal } from './TaskDetailModal';
import { ErrorState } from '@/components/ErrorState';
import { useTasks } from './useTasks';

const byPosition = (a: Group, b: Group) =>
  a.position < b.position ? -1 : a.position > b.position ? 1 : 0;

export function TaskList() {
  const viewedDate = useUiStore((s) => s.viewedDate);
  // 상세 정보 모달: 항목 제목 클릭으로 열린다(읽기 전용). store 기반이라 프롭 스레딩 없이 한 곳에서 렌더.
  const detailTaskId = useUiStore((s) => s.detailTaskId);
  const setDetailTaskId = useUiStore((s) => s.setDetailTaskId);
  // 헤더의 전체 펼치기/접기 — 공간·그룹 섹션을 한 번에 연다/닫는다(할 일 메모·하위 패널은 대상 아님).
  const collapseAll = useUiStore((s) => s.collapseAll);
  const expandAll = useUiStore((s) => s.expandAll);

  const userId = useUserId();
  const { activeTab, spaces } = useActiveTab();
  const {
    tasks,
    subtasksByParent,
    recurrenceSkips,
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

  // 메모·서브태스크 값 묶음 — recurrenceProps와 같은 경로로 항목까지 흘려보낸다.
  const detailProps: TaskDetailProps = {
    subtasksByParent,
    onAddSubtask: addSubtask,
    onEditMemo: (task, memo) => updateMemo(task.id, memo),
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
  const count = completionCount(sections); // 상단 진행률: 전체 합산(또는 단일 공간). 취소는 미포함.
  // "보여 줄 게 있나"(취소 포함) vs "진행률에 셀 게 있나"(취소 제외)를 분리한다.
  // 취소만 있는 날·공간·그룹도 "취소" 섹션은 보여 주되, 진행률 바는 0/0으로 뜨지 않게 한다.
  const isEmpty = !hasAnyItems(sections);
  const noCountable = count.total === 0;
  const pct = count.total > 0 ? Math.round((count.done / count.total) * 100) : 0;
  const allDone = count.total > 0 && count.done === count.total; // 오늘 다 끝냈을 때 축하 배너 조건
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

  // 전체 접기/펼치기 대상: [전체] 탭은 공간 섹션, 특정 공간 탭은 그 공간의 그룹 섹션.
  // (평면 뷰 — 그룹 없는 단일 공간 — 는 접을 게 없어 버튼을 숨긴다.)
  const collapseTargets = isAll
    ? { spaceIds: spaceGroupsView.map((sv) => sv.spaceId), groupIds: [] as string[] }
    : { spaceIds: [] as string[], groupIds: spaceGroups.map((g) => g.id) };
  const showCollapseControls =
    collapseTargets.spaceIds.length + collapseTargets.groupIds.length > 0;

  const handlers = {
    onToggle: toggleTask,
    onRename: handleRename,
    onDelete: deleteTask,
    onCancel: cancelTask,
    onUncancel: uncancelTask,
  };

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

  // 보고 있는 날의 체크리스트를 텍스트로 클립보드에 복사(스탠드업·메신저 공유용).
  // [전체] 탭이면 공간별 블록, 특정 공간이면 평면. 날짜 라벨은 fmtDay 선례와 동일 포맷.
  const copySummary = async () => {
    const blocks: SummaryBlock[] = isAll
      ? spaceGroupsView.map((sv) => ({ title: sv.name, sections: sv.sections }))
      : [{ sections }];
    const label = format(parseISO(viewedDate), 'M월 d일 (EEE)', { locale: ko });
    const text = formatDaySummary(label, blocks);
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(text);
      toast('오늘 요약을 복사했어요');
    } catch {
      toast.error('복사하지 못했어요');
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {showHeader && (
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3.5">
          {noCountable ? (
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
                {/* 오늘 요약 복사: 보고 있는 날의 체크리스트를 텍스트로 클립보드에 담는다. */}
                <button
                  type="button"
                  onClick={copySummary}
                  aria-label="오늘 요약 복사"
                  title="오늘 요약 복사"
                  className="rounded-md p-1 text-muted transition hover:text-text"
                >
                  <Copy className="size-4" />
                </button>
                {/* 전체 펼치기/접기: 공간·그룹 섹션을 한 번에 연다/닫는다(현재 뷰의 섹션만). */}
                {showCollapseControls && (
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => expandAll(collapseTargets.spaceIds, collapseTargets.groupIds)}
                      aria-label="전체 펼치기"
                      title="전체 펼치기"
                      className="rounded-md p-1 text-muted transition hover:text-text"
                    >
                      <ChevronsUpDown className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => collapseAll(collapseTargets.spaceIds, collapseTargets.groupIds)}
                      aria-label="전체 접기"
                      title="전체 접기"
                      className="rounded-md p-1 text-muted transition hover:text-text"
                    >
                      <ChevronsDownUp className="size-4" />
                    </button>
                  </div>
                )}
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
          <div
            role="status"
            className="flex h-full min-h-40 items-center justify-center text-sm text-muted"
          >
            불러오는 중…
          </div>
        ) : error && isEmpty ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isAll ? (
          isEmpty ? (
            <EmptyState isToday={isToday} />
          ) : (
            spaceGroupsView.map((sv) => {
              // 각 공간의 살아있는 그룹(position 순). 그룹이 있으면 공간 안을 그룹으로 다시 나눈다.
              const spGroups = groups
                .filter((g) => g.spaceId === sv.spaceId)
                .slice()
                .sort(byPosition);
              // 그룹 버킷: 빈 그룹은 감춰 개관을 가볍게 유지(관리는 각 공간 탭에서).
              const spBuckets =
                spGroups.length > 0
                  ? groupSectionsByGroup(
                      scoped.filter((t) => t.spaceId === sv.spaceId),
                      spGroups.map((g) => ({ id: g.id, name: g.name })),
                      viewedDate,
                      today
                    ).filter((b) => hasAnyItems(b.sections))
                  : null;
              return (
                <SpaceSection
                  key={sv.spaceId}
                  space={sv}
                  buckets={spBuckets}
                  spaceGroups={spGroups}
                  moveProps={moveProps}
                  recurrenceProps={recurrenceProps}
                  detailProps={detailProps}
                  onRenameGroup={renameGroup}
                  {...handlers}
                />
              );
            })
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
              // (취소만 있는 그룹도 "항목 있음"으로 쳐서 취소 섹션을 보여 준다.)
              const hasItems = hasAnyItems(bucket.sections);
              const visible = bucket.groupId === null ? hasItems : isToday || hasItems;
              if (!visible) return null;
              return (
                <GroupSection
                  key={bucket.groupId ?? '__none__'}
                  bucket={bucket}
                  group={group ?? null}
                  moveProps={moveProps}
                  recurrenceProps={recurrenceProps}
                  detailProps={detailProps}
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
              detailProps={detailProps}
              {...handlers}
            />
          </div>
        )}
      </div>

      <TaskDetailModal
        taskId={detailTaskId}
        tasks={dayTasks}
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
      role="status"
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

/**
 * [전체] 탭의 한 공간 묶음: 헤더(접기·색·이름·카운트) + 내용. 그룹처럼 접을 수 있다.
 * 공간에 그룹이 있으면(`buckets`) 그 아래를 다시 그룹 소제목으로 나눠 보인다(그룹도 접기 가능).
 * 그룹 관리(이름 수정·순서·삭제)는 개관을 가볍게 두려고 여기선 감추고, 해당 공간 탭에서만 한다.
 */
function SpaceSection({
  space,
  buckets,
  spaceGroups,
  moveProps,
  recurrenceProps,
  detailProps,
  onRenameGroup,
  onToggle,
  onRename,
  onDelete,
  onCancel,
  onUncancel,
}: {
  space: SpaceGroup;
  /** 그룹이 있는 공간의 그룹별 버킷(빈 그룹 제외). 그룹이 없으면 null → 평면 렌더. */
  buckets: GroupBucket[] | null;
  spaceGroups: Group[];
  moveProps: MoveProps;
  recurrenceProps?: RecurrenceProps;
  detailProps?: TaskDetailProps;
  onRenameGroup: (id: string, name: string) => void;
} & SectionHandlers) {
  const collapsed = useUiStore((s) => s.collapsedSpaces.includes(space.spaceId));
  const toggleCollapsed = useUiStore((s) => s.toggleSpaceCollapsed);
  return (
    <section className="px-2 pb-1 pt-3 first:pt-1">
      <button
        onClick={() => toggleCollapsed(space.spaceId)}
        aria-label={collapsed ? '펼치기' : '접기'}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-2 rounded-md px-1.5 py-0.5 text-left transition hover:bg-surface2"
      >
        <span className="grid size-5 shrink-0 place-items-center text-muted">
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
        </span>
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ background: space.color }}
          aria-hidden
        />
        <span className="text-sm font-semibold">{space.name}</span>
        <span className="text-xs text-muted">
          {space.count.done}/{space.count.total}
        </span>
      </button>
      {!collapsed &&
        (buckets ? (
          // 공간→그룹 2단 중첩: 그룹 소제목은 공간 헤더 아래로 살짝 들여쓴다.
          <div className="pl-2">
            {buckets.map((bucket) => (
              <GroupSection
                key={bucket.groupId ?? '__none__'}
                bucket={bucket}
                group={
                  bucket.groupId ? spaceGroups.find((g) => g.id === bucket.groupId) ?? null : null
                }
                manageable={false}
                moveProps={moveProps}
                recurrenceProps={recurrenceProps}
                detailProps={detailProps}
                onRenameGroup={onRenameGroup}
                onToggle={onToggle}
                onRename={onRename}
                onDelete={onDelete}
                onCancel={onCancel}
                onUncancel={onUncancel}
              />
            ))}
          </div>
        ) : (
          <SectionsView
            sections={space.sections}
            moveProps={moveProps}
            recurrenceProps={recurrenceProps}
            detailProps={detailProps}
            onToggle={onToggle}
            onRename={onRename}
            onDelete={onDelete}
            onCancel={onCancel}
            onUncancel={onUncancel}
          />
        ))}
    </section>
  );
}

type SectionHandlers = {
  onToggle: (task: Task) => void;
  onRename: (task: Task, title: string) => void;
  onDelete: (task: Task) => void;
  onCancel: (task: Task) => void;
  onUncancel: (task: Task) => void;
};

/** 한 그룹(접이식) 섹션: 헤더(접기·이름·카운트·관리) + 본문 */
function GroupSection({
  bucket,
  group,
  moveProps,
  recurrenceProps,
  detailProps,
  reorder,
  onToggle,
  onRename,
  onDelete,
  onCancel,
  onUncancel,
  onRenameGroup,
  onDeleteGroup,
  onMoveUp,
  onMoveDown,
  manageable = true,
}: {
  bucket: GroupBucket;
  group: Group | null;
  moveProps: MoveProps;
  recurrenceProps?: RecurrenceProps;
  detailProps?: TaskDetailProps;
  reorder?: ReorderCommit;
  onRenameGroup: (id: string, name: string) => void;
  onDeleteGroup?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  /** false면 그룹 관리(이름 수정·순서·삭제)를 감춘다 — [전체] 탭 개관용. 접기는 유지. */
  manageable?: boolean;
} & SectionHandlers) {
  const collapsed = useUiStore((s) => group != null && s.collapsedGroups.includes(group.id));
  const toggleCollapsed = useUiStore((s) => s.toggleGroupCollapsed);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(group?.name ?? '');

  const isReal = group != null;
  const canManage = isReal && manageable;

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
          disabled={!isReal}
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
        (hasAnyItems(bucket.sections) ? (
          <SectionsView
            sections={bucket.sections}
            onToggle={onToggle}
            onRename={onRename}
            onDelete={onDelete}
            onCancel={onCancel}
            onUncancel={onUncancel}
            moveProps={moveProps}
            recurrenceProps={recurrenceProps}
            detailProps={detailProps}
            reorder={reorder}
          />
        ) : (
          <p className="px-3 py-2 text-xs text-muted">아직 할 일이 없어요</p>
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
  onCancel,
  onUncancel,
  moveProps,
  recurrenceProps,
  detailProps,
  reorder,
}: {
  sections: DaySections;
  moveProps?: MoveProps;
  recurrenceProps?: RecurrenceProps;
  detailProps?: TaskDetailProps;
  /** 넘기면 "할 일" 목록을 세로 드래그로 리오더할 수 있다 */
  reorder?: ReorderCommit;
} & SectionHandlers) {
  // 항목에 공통으로 흘려보내는 핸들러·값 묶음(완료·취소 포함).
  const extra = { onToggle, onRename, onDelete, onCancel, onUncancel, moveProps, recurrenceProps, detailProps };
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
                onNudgeToSomeday={
                  moveProps && t.overdueDays >= NUDGE_OVERDUE_DAYS
                    ? (task) => moveProps.onMoveToDate(task, null)
                    : undefined
                }
                {...extra}
              />
            ))}
          </AnimatePresence>
        </Section>
      )}
      {sections.open.length > 0 &&
        (reorder ? (
          <Section title="할 일">
            <ReorderList items={sections.open} onCommit={reorder} {...extra} />
          </Section>
        ) : (
          <Section title="할 일">
            <AnimatePresence initial={false}>
              {sections.open.map((t) => (
                <TaskItem key={t.id} task={t} {...extra} />
              ))}
            </AnimatePresence>
          </Section>
        ))}
      {/* 완료한 항목이 있을 때만 완료 섹션을 보인다 (없으면 아예 감춘다) */}
      {sections.completed.length > 0 && (
        <Section title="완료" tone="done" count={sections.completed.length}>
          <AnimatePresence initial={false}>
            {sections.completed.map((t) => (
              <TaskItem key={t.id} task={t} {...extra} />
            ))}
          </AnimatePresence>
        </Section>
      )}
      {/* 취소한 항목(두 번째 '닫힘'): 완료와 별도 섹션, 흐리게·취소선. 완료 카운트엔 안 섞인다. */}
      {sections.cancelled.length > 0 && (
        <Section title="취소" tone="cancelled" icon={Ban} count={sections.cancelled.length}>
          <AnimatePresence initial={false}>
            {sections.cancelled.map((t) => (
              <TaskItem key={t.id} task={t} {...extra} />
            ))}
          </AnimatePresence>
        </Section>
      )}
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
  detailProps,
  onToggle,
  onRename,
  onDelete,
  onCancel,
  onUncancel,
}: {
  items: Task[];
  onCommit: ReorderCommit;
  moveProps?: MoveProps;
  recurrenceProps?: RecurrenceProps;
  detailProps?: TaskDetailProps;
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
      role="presentation"
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
          detailProps={detailProps}
          onToggle={onToggle}
          onRename={onRename}
          onDelete={onDelete}
          onCancel={onCancel}
          onUncancel={onUncancel}
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
  detailProps,
  onToggle,
  onRename,
  onDelete,
  onCancel,
  onUncancel,
}: {
  task: Task;
  onCommit: () => void;
  moveProps?: MoveProps;
  recurrenceProps?: RecurrenceProps;
  detailProps?: TaskDetailProps;
} & SectionHandlers) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      as="div"
      role="presentation"
      value={task}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onCommit}
    >
      <TaskItem
        task={task}
        onToggle={onToggle}
        onRename={onRename}
        onDelete={onDelete}
        onCancel={onCancel}
        onUncancel={onUncancel}
        moveProps={moveProps}
        recurrenceProps={recurrenceProps}
        detailProps={detailProps}
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
  /** carried=넘어옴(따뜻한 강조), done=완료(살짝 후퇴), cancelled=취소(흐림) */
  tone?: 'carried' | 'done' | 'cancelled';
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
      <div role="list" className={cn('flex flex-col gap-0.5', tone === 'done' && 'opacity-70')}>
        {children}
      </div>
    </section>
  );
}
