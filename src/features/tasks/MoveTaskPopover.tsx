import { useState, type ReactNode } from 'react';
import { CalendarClock, CalendarDays, Check, ChevronDown } from 'lucide-react';
import type { Group, Task } from '@/db/types';
import { NO_GROUP_NAME } from '@/domain/sections';
import { addDaysStr } from '@/domain/dayBoundary';
import { PopoverMenu } from '@/components/PopoverMenu';
import { MiniCalendar } from '@/features/day/MiniCalendar';
import type { SpaceOption } from '@/features/spaces/SpacePickerPopover';
import { cn } from '@/lib/utils';

/** 항목을 다른 날/공간/그룹으로 옮기는 데 필요한 값 묶음. TaskList → 항목까지 흘려보낸다. */
export type TaskMoveProps = {
  /** 이동 대상이 될 공간들(탭 순서) */
  spaces: SpaceOption[];
  /** 전 공간의 살아있는 그룹들 — 팝오버가 task.spaceId로 걸러 쓴다 */
  groups: Group[];
  /** '내일로'의 기준이 되는 오늘 날짜('YYYY-MM-DD') */
  today: string;
  onMoveToDate: (task: Task, dueDate: string) => void;
  onMoveToSpace: (task: Task, spaceId: string, spaceName: string) => void;
  onMoveToGroup: (taskId: string, groupId: string | null) => void;
};

type Props = TaskMoveProps & {
  task: Task;
  trigger: ReactNode;
  triggerClassName?: string;
  triggerLabel: string;
  align?: 'start' | 'end';
};

const SECTION_LABEL = 'px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted';
const MENU_ITEM = 'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-surface2';

const byPosition = (a: Group, b: Group) =>
  a.position < b.position ? -1 : a.position > b.position ? 1 : 0;

/**
 * 항목 행의 통합 "이동" 팝오버: 날짜(내일로 / 날짜 선택) · 공간 · 그룹을 한 곳에서.
 * 명시적 이동이라 날짜 이동은 due_date를, 공간 이동은 space_id(+그룹 초기화)를 실제로 바꾼다.
 * (자동 넘어옴만 계산으로 두고 저장하지 않는다 — 여기선 사용자가 직접 옮기는 것.)
 */
export function MoveTaskPopover({
  task,
  today,
  spaces,
  groups,
  onMoveToDate,
  onMoveToSpace,
  onMoveToGroup,
  trigger,
  triggerClassName,
  triggerLabel,
  align = 'end',
}: Props) {
  const [showCal, setShowCal] = useState(false);
  const tomorrow = addDaysStr(today, 1);
  const spaceGroups = groups
    .filter((g) => g.spaceId === task.spaceId)
    .slice()
    .sort(byPosition);

  return (
    <PopoverMenu
      trigger={trigger}
      triggerClassName={triggerClassName}
      triggerLabel={triggerLabel}
      align={align}
      width={288}
      onOpenChange={(open) => {
        if (!open) setShowCal(false);
      }}
    >
      {(close) => (
        <>
          {/* 날짜 */}
          <p className={SECTION_LABEL}>날짜</p>
          <button
            role="menuitem"
            onClick={() => {
              onMoveToDate(task, tomorrow);
              close();
            }}
            className={MENU_ITEM}
          >
            <CalendarClock className="size-4 shrink-0 text-muted" />
            <span>내일로</span>
          </button>
          <button
            role="menuitem"
            aria-expanded={showCal}
            onClick={() => setShowCal((v) => !v)}
            className={MENU_ITEM}
          >
            <CalendarDays className="size-4 shrink-0 text-muted" />
            <span className="flex-1">날짜 선택</span>
            <ChevronDown
              className={cn('size-4 shrink-0 text-muted transition', showCal && 'rotate-180')}
            />
          </button>
          {showCal && (
            <MiniCalendar
              selectedDate={task.dueDate}
              onPick={(day) => {
                onMoveToDate(task, day);
                close();
              }}
            />
          )}

          {/* 공간 */}
          <div className="border-t border-border">
            <p className={SECTION_LABEL}>공간</p>
            <div className="max-h-48 overflow-y-auto">
              {spaces.map((s) => {
                const selected = s.id === task.spaceId;
                return (
                  <button
                    key={s.id}
                    role="menuitem"
                    onClick={() => {
                      onMoveToSpace(task, s.id, s.name);
                      close();
                    }}
                    className={cn(MENU_ITEM, selected && 'font-medium')}
                  >
                    <Check
                      className={cn(
                        'size-4 shrink-0 text-accent',
                        selected ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: s.color }}
                      aria-hidden
                    />
                    <span className="truncate">{s.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 그룹 (이 공간에 그룹이 있을 때만) */}
          {spaceGroups.length > 0 && (
            <div className="border-t border-border">
              <p className={SECTION_LABEL}>그룹</p>
              <div className="max-h-48 overflow-y-auto">
                {[{ id: '__none__', name: NO_GROUP_NAME }, ...spaceGroups].map((o) => {
                  const gid = o.id === '__none__' ? null : o.id;
                  const selected = gid === task.groupId;
                  return (
                    <button
                      key={o.id}
                      role="menuitem"
                      onClick={() => {
                        onMoveToGroup(task.id, gid);
                        close();
                      }}
                      className={cn(MENU_ITEM, selected && 'font-medium text-accent')}
                    >
                      <Check
                        className={cn('size-4 shrink-0', selected ? 'opacity-100' : 'opacity-0')}
                      />
                      <span className="truncate">{o.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </PopoverMenu>
  );
}
