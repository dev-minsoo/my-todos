import { useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { ALL_TAB, type Group } from '@/db/types';
import { useUiStore } from '@/store/uiStore';
import { todayStr } from '@/domain/dayBoundary';
import {
  completionCount,
  deriveSections,
  groupSectionsBySpace,
  groupSectionsByGroup,
} from '@/domain/sections';
import type { DaySections, GroupBucket } from '@/domain/sections';
import type { Task } from '@/db/types';
import { useActiveTab } from '@/features/spaces/useActiveTab';
import { useGroups } from '@/features/spaces/useGroups';
import { moveItem } from '@/features/spaces/spaceSelection';
import { cn } from '@/lib/utils';
import type { GroupOption } from './GroupMovePopover';
import { TaskItem } from './TaskItem';
import { useTasks } from './useTasks';

const byPosition = (a: Group, b: Group) =>
  a.position < b.position ? -1 : a.position > b.position ? 1 : 0;

export function TaskList() {
  const viewedDate = useUiStore((s) => s.viewedDate);

  const { activeTab, spaces } = useActiveTab();
  const { tasks, isLoading, toggleTask, renameTask, deleteTask, moveTaskToGroup } = useTasks();
  const { groups, renameGroup, deleteGroup, reorderGroups } = useGroups();

  const today = todayStr();
  const isAll = activeTab === ALL_TAB;
  const isToday = viewedDate === today;

  // 전체 탭 상단 카운트는 현존 공간의 할 일만 센다 (삭제된 공간의 고아 태스크 제외 → 공간별 묶음과 합계 일치)
  const spaceIds = new Set(spaces.map((s) => s.id));
  const scoped = isAll
    ? tasks.filter((t) => spaceIds.has(t.spaceId))
    : tasks.filter((t) => t.spaceId === activeTab);
  const sections = deriveSections(scoped, viewedDate, today);
  const count = completionCount(sections); // 상단 진행률: 전체 합산(또는 단일 공간)
  const isEmpty = count.total === 0;
  const pct = count.total > 0 ? Math.round((count.done / count.total) * 100) : 0;

  // 전체 탭에서는 공간별로 묶는다 (SPEC §82)
  const spaceGroupsView = isAll ? groupSectionsBySpace(tasks, spaces, viewedDate, today) : [];

  // 특정 공간: 그 공간의 살아있는 그룹(position 순). 하나라도 있으면 그룹별로 나눠 보여준다.
  const spaceGroups = isAll
    ? []
    : groups.filter((g) => g.spaceId === activeTab).slice().sort(byPosition);
  const hasGroups = spaceGroups.length > 0;
  const groupOptions: GroupOption[] = spaceGroups.map((g) => ({ id: g.id, name: g.name }));
  const buckets: GroupBucket[] = hasGroups
    ? groupSectionsByGroup(scoped, groupOptions, viewedDate, today)
    : [];

  const handlers = { onToggle: toggleTask, onRename: renameTask, onDelete: deleteTask };

  // 그룹 이동 핸들러 (그룹이 있는 특정 공간에서만 항목에 붙는다).
  // 새 그룹 생성은 목록이 아니라 입력칸 위 대상 그룹 셀렉트에서만 한다 → 여기선 이동만.
  const moveProps: MoveProps = {
    groupOptions,
    onMoveToGroup: moveTaskToGroup,
  };

  const reorderAt = (from: number, to: number) =>
    reorderGroups(moveItem(spaceGroups, from, to).map((g) => g.id));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!isEmpty && (
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3.5">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium">할 일</span>
            <span className="text-xs text-muted">
              {count.done}/{count.total} 완료
            </span>
          </div>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface2">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        {isLoading && isEmpty ? (
          <div className="flex h-full min-h-40 items-center justify-center text-sm text-muted">
            불러오는 중…
          </div>
        ) : isAll ? (
          isEmpty ? (
            <EmptyState />
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
                <SectionsView sections={g.sections} {...handlers} />
              </section>
            ))
          )
        ) : hasGroups ? (
          // 특정 공간 + 그룹 있음: 그룹별 접이식 섹션 + 새 그룹 추가
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
                  onRenameGroup={renameGroup}
                  onDeleteGroup={group ? () => deleteGroup(group) : undefined}
                  onMoveUp={group && idx > 0 ? () => reorderAt(idx, idx - 1) : undefined}
                  onMoveDown={
                    group && idx < spaceGroups.length - 1 ? () => reorderAt(idx, idx + 1) : undefined
                  }
                  {...handlers}
                />
              );
            })}
          </div>
        ) : isEmpty ? (
          <EmptyState />
        ) : (
          // 특정 공간 + 그룹 없음 + 항목 있음: 평면 렌더(기존)
          <div className="pb-2">
            <SectionsView sections={sections} {...handlers} />
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-40 flex-1 flex-col items-center justify-center px-4 text-center text-sm text-muted">
      <p>할 일이 없습니다.</p>
      <p className="mt-1 text-xs">아래에 적어 보세요.</p>
    </div>
  );
}

type MoveProps = {
  groupOptions: GroupOption[];
  onMoveToGroup: (taskId: string, groupId: string | null) => void;
};

type SectionHandlers = {
  onToggle: (task: Task) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (task: Task) => void;
};

/** 한 그룹(접이식) 섹션: 헤더(접기·이름·카운트·관리) + 본문 */
function GroupSection({
  bucket,
  group,
  moveProps,
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

/** 한 묶음(공간/그룹)의 남은 일/할 일/완료 섹션 */
function SectionsView({
  sections,
  onToggle,
  onRename,
  onDelete,
  moveProps,
}: { sections: DaySections; moveProps?: MoveProps } & SectionHandlers) {
  const extra = moveProps
    ? {
        groupOptions: moveProps.groupOptions,
        onMoveToGroup: moveProps.onMoveToGroup,
      }
    : {};
  return (
    <>
      {sections.carried.length > 0 && (
        <Section title="남은 일">
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
        </Section>
      )}
      {sections.open.length > 0 && (
        <Section title="할 일">
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
        </Section>
      )}
      {/* 완료 섹션은 완료한 항목이 없어도 자리를 유지한다 (그날의 완료 영역이 늘 보이도록) */}
      <Section title="완료">
        {sections.completed.length > 0 ? (
          sections.completed.map((t) => (
            <TaskItem
              key={t.id}
              task={t}
              onToggle={onToggle}
              onRename={onRename}
              onDelete={onDelete}
              {...extra}
            />
          ))
        ) : (
          <p className="px-3 py-2 text-xs text-muted">아직 없어요</p>
        )}
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-2 py-1">
      <h2 className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted">
        {title}
      </h2>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}
