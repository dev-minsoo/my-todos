import { useState } from 'react';
import { CheckCircle2, Circle, X } from 'lucide-react';
import type { Task } from '@/db/types';
import { cn } from '@/lib/utils';

type Props = {
  task: Task;
  /** 넘어옴 항목이면 밀린 일수 */
  overdueDays?: number;
  onToggle?: (task: Task) => void;
  onRename?: (id: string, title: string) => void;
  onDelete?: (task: Task) => void;
};

export function TaskItem({ task, overdueDays, onToggle, onRename, onDelete }: Props) {
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
    if (next && next !== task.title) onRename?.(task.id, next);
    else setDraft(task.title);
  }

  return (
    <div className="group flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-surface2">
      <button
        onClick={() => onToggle?.(task)}
        aria-label={done ? '완료 해제' : '완료'}
        className={cn(
          'shrink-0 transition',
          done ? 'text-accent' : 'text-muted hover:text-accent'
        )}
      >
        {done ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
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

      <button
        onClick={() => onDelete?.(task)}
        aria-label="삭제"
        className="shrink-0 rounded-md p-1 text-muted opacity-0 transition hover:text-red-500 focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
