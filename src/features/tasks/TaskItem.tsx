import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import {
  ArrowRightLeft,
  Ban,
  CheckCircle2,
  ChevronDown,
  Circle,
  GripVertical,
  Pencil,
  Plus,
  Repeat,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import type { Recurrence, RecurrenceRule, Task } from '@/db/types';
import { isVirtualOccurrence } from '@/domain/recurrence';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';
import { MoveTaskPopover, type TaskMoveProps } from './MoveTaskPopover';
import { RecurrencePopover } from './RecurrencePopover';

/** 반복 관리에 필요한 값 묶음(TaskList에서 아래로 흘려보낸다). */
export type RecurrenceProps = {
  /** 살아있는 반복 규칙들 (task.recurrenceId로 매칭) */
  recurrences: Recurrence[];
  onUpdate: (input: { id: string; title?: string; rule?: RecurrenceRule }) => void;
  onStop: (rec: Recurrence) => void;
};

/** 메모·서브태스크(인라인 펼침 패널)에 필요한 값 묶음. */
export type TaskDetailProps = {
  /** 부모 id → 서브태스크 목록(position 정렬). */
  subtasksByParent: Map<string, Task[]>;
  onAddSubtask: (parent: Task, title: string) => void;
  onEditMemo: (task: Task, memo: string) => void;
};

type Props = {
  task: Task;
  /** 넘어옴 항목이면 밀린 일수 */
  overdueDays?: number;
  onToggle?: (task: Task) => void;
  onRename?: (task: Task, title: string) => void;
  onDelete?: (task: Task) => void;
  /** 취소(두 번째 '닫힘'): 흐지부지된 할 일을 닫는다. 넘기면 우측에 취소 버튼이 뜬다. */
  onCancel?: (task: Task) => void;
  /** 취소 해제(복구): 취소된 항목을 다시 "할 일"로. 취소 섹션의 복구 버튼용. */
  onUncancel?: (task: Task) => void;
  /** 넘기면 통합 "이동"(날짜·공간·그룹) 버튼이 뜬다 */
  moveProps?: TaskMoveProps;
  /** 반복 출신 항목의 규칙 아이콘·관리 팝오버용 */
  recurrenceProps?: RecurrenceProps;
  /** 넘기면 메모·서브태스크 펼침 패널이 활성화된다(가상 발생분엔 적용 안 됨) */
  detailProps?: TaskDetailProps;
  /** 세로 리오더용 좌측 핸들을 노출한다 (open 목록에서만) */
  dragHandle?: boolean;
  /** 핸들에서 포인터를 누르면 세로 리오더 드래그를 시작한다 (Reorder.Item의 dragControls.start) */
  onDragHandlePointerDown?: (e: ReactPointerEvent) => void;
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
  onCancel,
  onUncancel,
  moveProps,
  recurrenceProps,
  detailProps,
  dragHandle,
  onDragHandlePointerDown,
}: Props) {
  const done = task.completedAt != null;
  const cancelled = task.cancelledAt != null;
  // 가상 발생분은 아직 실체화 전이라 순서변경·이동·메모/서브태스크를 걸지 않는다.
  const isVirtual = isVirtualOccurrence(task);
  const canMove = !isVirtual && moveProps != null;
  const canDetail = !isVirtual && detailProps != null;
  const recurrence =
    task.recurrenceId != null && recurrenceProps
      ? recurrenceProps.recurrences.find((r) => r.id === task.recurrenceId) ?? null
      : null;

  // 편집은 세션 UI 상태로 관리 — 우측 연필 버튼으로 진입.
  const editing = useUiStore((s) => s.editingTaskId === task.id);
  const setEditingTaskId = useUiStore((s) => s.setEditingTaskId);
  // 제목 클릭은 상세 정보 모달(읽기 전용)을 연다. 수정은 우측 연필 버튼/e키로.
  const openDetail = useUiStore((s) => s.setDetailTaskId);
  const [draft, setDraft] = useState(task.title);
  // 편집에 진입할 때마다 현재 제목으로 초기화.
  useEffect(() => {
    if (editing) setDraft(task.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const subtasks = canDetail ? detailProps!.subtasksByParent.get(task.id) ?? [] : [];
  const subTotal = subtasks.length;
  const subDone = subtasks.filter((s) => s.completedAt != null).length;
  const hasMemo = !!task.memo;
  const hasDetail = subTotal > 0 || hasMemo;
  const [expanded, setExpanded] = useState(false);

  const x = useMotionValue(0);
  // 드래그 방향에 따라 뒤 배경의 힌트가 서서히 진해진다
  const completeOpacity = useTransform(x, [0, SWIPE_DISTANCE], [0, 1]);
  const deleteOpacity = useTransform(x, [-SWIPE_DISTANCE, 0], [1, 0]);

  function startEdit() {
    setEditingTaskId(task.id);
  }

  function commit() {
    setEditingTaskId(null);
    const next = draft.trim();
    if (next && next !== task.title) onRename?.(task, next);
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
      role="listitem"
      data-task-id={task.id}
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
        drag={editing || cancelled ? false : 'x'}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.35}
        dragMomentum={false}
        style={{ x }}
        onDragEnd={handleDragEnd}
        className={cn(
          'group relative flex items-center gap-3 rounded-xl bg-surface px-3 py-2.5 transition hover:bg-surface2',
          cancelled && 'opacity-60'
        )}
      >
        {dragHandle && !isVirtual && (
          <button
            type="button"
            aria-label="순서 변경"
            title="끌어서 순서 변경"
            // 포인터 누름을 여기서 가로채 세로 리오더를 시작한다.
            // stopPropagation으로 부모의 가로 스와이프(drag='x')가 시작되지 않게 한다.
            onPointerDown={(e) => {
              e.stopPropagation();
              onDragHandlePointerDown?.(e);
            }}
            onClick={(e) => e.stopPropagation()}
            className="-ml-1 shrink-0 cursor-grab touch-none text-muted opacity-0 transition hover:text-text focus-visible:opacity-100 active:cursor-grabbing group-hover:opacity-100 max-md:opacity-100"
          >
            <GripVertical className="size-4" />
          </button>
        )}

        {cancelled ? (
          // 취소된 항목: 완료 토글 대신 복구(취소 해제) 어포던스. 완료 섹션에서
          // 체크를 다시 눌러 완료 해제하는 것과 대칭 — 상태 글리프가 곧 되돌리기 버튼.
          <motion.button
            onClick={() => onUncancel?.(task)}
            whileTap={{ scale: 0.85 }}
            aria-label="취소 해제"
            title="취소 해제(다시 할 일로)"
            className="shrink-0 text-muted transition hover:text-accent max-md:p-2"
          >
            <RotateCcw className="size-5" />
          </motion.button>
        ) : (
          <motion.button
            onClick={() => onToggle?.(task)}
            whileTap={{ scale: 0.8 }}
            aria-label={done ? '완료 해제' : '완료'}
            className={cn(
              'shrink-0 transition max-md:p-2',
              done ? 'text-accent' : 'text-muted hover:text-accent'
            )}
          >
            {done ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
          </motion.button>
        )}

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
                setEditingTaskId(null);
              }
            }}
            aria-label="할 일 수정"
            className="min-w-0 flex-1 rounded-lg bg-surface px-2 py-1 text-sm outline-none ring-1 ring-accent"
          />
        ) : (
          <button
            onClick={() => openDetail(task.id)}
            aria-label={`상세 보기: ${task.title}`}
            className={cn(
              'min-w-0 flex-1 truncate text-left text-sm',
              (done || cancelled) && 'text-muted line-through'
            )}
          >
            {task.title}
          </button>
        )}

        {/* 펼침 토글: 서브태스크 진행(완료/총계) 또는 메모 유무 점을 겸한다. */}
        {canDetail && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? '메모·하위 항목 접기' : '메모·하위 항목 펼치기'}
            aria-expanded={expanded}
            className={cn(
              'flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted transition hover:text-text',
              !hasDetail &&
                'opacity-0 focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100'
            )}
          >
            {subTotal > 0 ? (
              <span className="tabular-nums">
                {subDone}/{subTotal}
              </span>
            ) : hasMemo ? (
              <span className="size-1.5 rounded-full bg-current" aria-hidden />
            ) : null}
            <ChevronDown
              className={cn('size-4 transition-transform', expanded && 'rotate-180')}
            />
          </button>
        )}

        {task.recurrenceId != null &&
          (recurrence ? (
            <RecurrencePopover
              recurrence={recurrence}
              onUpdate={recurrenceProps!.onUpdate}
              onStop={recurrenceProps!.onStop}
            />
          ) : (
            // 규칙 객체를 못 찾으면(중단됐거나 관리 컨텍스트 밖) 정적 아이콘만.
            <span className="shrink-0 p-1 text-muted" title="반복에서 나온 할 일" aria-hidden>
              <Repeat className="size-3.5" />
            </span>
          ))}

        {overdueDays != null && overdueDays > 0 && (
          <span className="shrink-0 rounded-full bg-overdueBg px-2 py-0.5 text-[11px] font-medium text-overdueFg">
            {overdueDays}일 지남
          </span>
        )}

        {canMove && (
          <MoveTaskPopover
            task={task}
            {...moveProps!}
            align="end"
            triggerLabel="이동"
            triggerClassName="shrink-0 rounded-md p-1 text-muted opacity-0 transition hover:text-accent focus-visible:opacity-100 group-hover:opacity-100 max-md:p-2 max-md:opacity-100"
            trigger={<ArrowRightLeft className="size-4" />}
          />
        )}

        {/* 제목 수정: 제목 클릭이 상세 모달을 여므로 편집은 이 버튼(또는 e키)으로.
            모바일엔 스와이프 대체가 없어 상시 노출한다. */}
        {!editing && (
          <button
            onClick={startEdit}
            aria-label="제목 수정"
            className="shrink-0 rounded-md p-1 text-muted opacity-0 transition hover:text-accent focus-visible:opacity-100 group-hover:opacity-100 max-md:p-2 max-md:opacity-100"
          >
            <Pencil className="size-4" />
          </button>
        )}

        {/* 취소: 완료도 삭제도 아닌 '흐지부지' 닫기. 미완료·미취소 항목에만 노출.
            완료한 항목은 이미 긍정적으로 닫혔으므로 취소 버튼을 숨긴다. */}
        {!cancelled && !done && onCancel && (
          <button
            onClick={() => onCancel(task)}
            aria-label="취소"
            title="취소(흐지부지된 할 일 닫기)"
            className="shrink-0 rounded-md p-1 text-muted opacity-0 transition hover:text-amber-500 focus-visible:opacity-100 group-hover:opacity-100 max-md:p-2 max-md:opacity-100"
          >
            <Ban className="size-4" />
          </button>
        )}

        {/* 삭제 X: 데스크톱은 hover/focus로 노출. 모바일은 왼쪽 스와이프로 삭제하므로 상시 노출하지 않는다(행 정돈). */}
        <button
          onClick={() => onDelete?.(task)}
          aria-label="삭제"
          className="shrink-0 rounded-md p-1 text-muted opacity-0 transition hover:text-red-500 focus-visible:opacity-100 group-hover:opacity-100"
        >
          <X className="size-4" />
        </button>
      </motion.div>

      {/* 펼침 패널: 앞 드래그 레이어 바깥, layout 래퍼 안의 형제(스와이프에 안 먹히게).
          불투명 배경으로 뒤 스와이프 힌트를 가린다. */}
      {canDetail && expanded && (
        <div className="relative border-t border-border bg-surface px-3 py-2.5">
          <MemoEditor key={`memo-${task.id}`} task={task} onEditMemo={detailProps!.onEditMemo} />
          {subtasks.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {subtasks.map((sub) => (
                <SubtaskRow
                  key={sub.id}
                  task={sub}
                  onToggle={onToggle}
                  onRename={onRename}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          )}
          <AddSubtaskRow parent={task} onAdd={detailProps!.onAddSubtask} />
        </div>
      )}
    </motion.div>
  );
}

/** 메모 편집 — 멀티라인이라 Enter 제출 없음(blur 저장, Escape 되돌림). */
function MemoEditor({
  task,
  onEditMemo,
}: {
  task: Task;
  onEditMemo: (task: Task, memo: string) => void;
}) {
  const [draft, setDraft] = useState(task.memo ?? '');
  // 외부에서 memo가 바뀌면(복원·다른 기기) 반영.
  useEffect(() => {
    setDraft(task.memo ?? '');
  }, [task.memo]);
  return (
    <textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if ((draft.trim() || null) !== (task.memo ?? null)) onEditMemo(task, draft);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setDraft(task.memo ?? '');
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
      rows={2}
      placeholder="메모"
      aria-label="메모"
      className="w-full resize-y rounded-lg bg-bg px-2 py-1.5 text-sm outline-none ring-1 ring-transparent transition placeholder:text-muted focus:ring-accent"
    />
  );
}

/** 서브태스크 한 줄 — 체크/인라인 수정/삭제. 스와이프·이동·반복 없는 경량 행. */
function SubtaskRow({
  task,
  onToggle,
  onRename,
  onDelete,
}: {
  task: Task;
  onToggle?: (task: Task) => void;
  onRename?: (task: Task, title: string) => void;
  onDelete?: (task: Task) => void;
}) {
  const done = task.completedAt != null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);

  function startEdit() {
    setDraft(task.title);
    setEditing(true);
  }
  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== task.title) onRename?.(task, next);
    else setDraft(task.title);
  }

  return (
    <li className="group/sub flex items-center gap-2 rounded-lg px-1 py-1 transition hover:bg-surface2">
      <button
        onClick={() => onToggle?.(task)}
        aria-label={done ? '완료 해제' : '완료'}
        className={cn(
          'shrink-0 transition',
          done ? 'text-accent' : 'text-muted hover:text-accent'
        )}
      >
        {done ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}
      </button>
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
          aria-label="하위 항목 수정"
          className="min-w-0 flex-1 rounded-md bg-surface px-1.5 py-0.5 text-sm outline-none ring-1 ring-accent"
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
      <button
        onClick={() => onDelete?.(task)}
        aria-label="하위 항목 삭제"
        className="shrink-0 rounded-md p-0.5 text-muted opacity-0 transition hover:text-red-500 focus-visible:opacity-100 group-hover/sub:opacity-100 max-md:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </li>
  );
}

/** 서브태스크 추가 입력 — Enter(IME 가드)로 등록 후 비운다. */
function AddSubtaskRow({
  parent,
  onAdd,
}: {
  parent: Task;
  onAdd: (parent: Task, title: string) => void;
}) {
  const [value, setValue] = useState('');
  function submit() {
    const title = value.trim();
    if (!title) return;
    onAdd(parent, title);
    setValue('');
  }
  return (
    <div className="mt-1.5 flex items-center gap-2 px-1">
      <Plus className="size-3.5 shrink-0 text-muted" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit();
        }}
        placeholder="하위 항목 추가"
        aria-label="하위 항목 추가"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
      />
    </div>
  );
}
