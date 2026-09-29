import { useState } from 'react';
import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { CheckCircle2, Circle, FolderInput, Trash2, X } from 'lucide-react';
import type { Task } from '@/db/types';
import { cn } from '@/lib/utils';
import { GroupMovePopover, type GroupOption } from './GroupMovePopover';

type Props = {
  task: Task;
  /** 넘어옴 항목이면 밀린 일수 */
  overdueDays?: number;
  onToggle?: (task: Task) => void;
  onRename?: (id: string, title: string) => void;
  onDelete?: (task: Task) => void;
  /** 이동 대상이 될 그룹들 (넘기면 그룹 이동 버튼이 뜬다) */
  groupOptions?: GroupOption[];
  onMoveToGroup?: (taskId: string, groupId: string | null) => void;
  onCreateGroupAndMove?: (taskId: string, name: string) => void;
};

// 스와이프 판정 임계: 이동 거리(px) 또는 튕기는 속도(px/s)
const SWIPE_DISTANCE = 80;
const SWIPE_VELOCITY = 600;

export function TaskItem({
  task,
  overdueDays,
  onToggle,
  onRename,
  onDelete,
  groupOptions,
  onMoveToGroup,
  onCreateGroupAndMove,
}: Props) {
  const done = task.completedAt != null;
  const canMove = groupOptions != null && onMoveToGroup != null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);

  const x = useMotionValue(0);
  // 드래그 방향에 따라 뒤 배경의 힌트가 서서히 진해진다
  const completeOpacity = useTransform(x, [0, SWIPE_DISTANCE], [0, 1]);
  const deleteOpacity = useTransform(x, [-SWIPE_DISTANCE, 0], [1, 0]);

  function startEdit() {
    setDraft(task.title);
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== task.title) onRename?.(task.id, next);
    else setDraft(task.title);
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    const { offset, velocity } = info;
    // 오른쪽 → 완료 토글, 왼쪽 → 삭제. due_date는 건드리지 않는다.
    if (offset.x > SWIPE_DISTANCE || (offset.x > 24 && velocity.x > SWIPE_VELOCITY)) {
      onToggle?.(task);
    } else if (offset.x < -SWIPE_DISTANCE || (offset.x < -24 && velocity.x < -SWIPE_VELOCITY)) {
      onDelete?.(task);
    }
    // dragConstraints {left:0,right:0} 가 손을 떼면 스프링으로 제자리에 되돌린다
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-xl"
    >
      {/* 뒤 레이어: 스와이프 방향 힌트 (오른쪽=완료, 왼쪽=삭제) */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-between px-4"
        aria-hidden
      >
        <motion.span style={{ opacity: completeOpacity }} className="text-accent">
          <CheckCircle2 className="size-5" />
        </motion.span>
        <motion.span style={{ opacity: deleteOpacity }} className="text-red-500">
          <Trash2 className="size-5" />
        </motion.span>
      </div>

      {/* 앞 레이어: 실제 항목. 불투명 배경으로 뒤 힌트를 평소엔 가린다. */}
      <motion.div
        drag={editing ? false : 'x'}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.35}
        dragMomentum={false}
        style={{ x }}
        onDragEnd={handleDragEnd}
        className="group relative flex items-center gap-3 rounded-xl bg-surface px-3 py-2 transition hover:bg-surface2"
      >
        <motion.button
          onClick={() => onToggle?.(task)}
          whileTap={{ scale: 0.8 }}
          aria-label={done ? '완료 해제' : '완료'}
          className={cn(
            'shrink-0 transition',
            done ? 'text-accent' : 'text-muted hover:text-accent'
          )}
        >
          {done ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
        </motion.button>

        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) commit();
              if (e.key === 'Escape') {
                setDraft(task.title);
                setEditing(false);
              }
            }}
            aria-label="할 일 수정"
            className="min-w-0 flex-1 rounded-lg bg-surface px-2 py-1 text-sm outline-none ring-1 ring-accent"
          />
        ) : (
          <button
            onClick={startEdit}
            className={cn(
              'min-w-0 flex-1 truncate text-left text-sm',
              done && 'text-muted line-through'
            )}
          >
            {task.title}
          </button>
        )}

        {overdueDays != null && overdueDays > 0 && (
          <span className="shrink-0 rounded-full bg-overdueBg px-2 py-0.5 text-[11px] font-medium text-overdueFg">
            {overdueDays}일 지남
          </span>
        )}

        {canMove && (
          <GroupMovePopover
            groups={groupOptions!}
            currentGroupId={task.groupId}
            onSelect={(groupId) => onMoveToGroup!(task.id, groupId)}
            onCreate={
              onCreateGroupAndMove ? (name) => onCreateGroupAndMove(task.id, name) : undefined
            }
            align="end"
            triggerLabel="그룹 이동"
            triggerClassName="shrink-0 rounded-md p-1 text-muted opacity-0 transition hover:text-accent focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
            trigger={<FolderInput className="size-4" />}
          />
        )}

        <button
          onClick={() => onDelete?.(task)}
          aria-label="삭제"
          className="shrink-0 rounded-md p-1 text-muted opacity-0 transition hover:text-red-500 focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
        >
          <X className="size-4" />
        </button>
      </motion.div>
    </motion.div>
  );
}
