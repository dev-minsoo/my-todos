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
    <div className="group flex items-center gap-3 px-4 py-2.5">
      <button
        onClick={() => onToggle?.(task)}
        aria-label={done ? '완료 해제' : '완료'}
        className="shrink-0 text-muted"
      >
        {done ? <CheckCircle2 className="size-5 text-accent" /> : <Circle className="size-5" />}
      </button>

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft(task.title);
              setEditing(false);
            }
          }}
          aria-label="할 일 수정"
          className="min-w-0 flex-1 rounded bg-bg px-1.5 py-0.5 text-sm outline-none"
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
        <span className="shrink-0 text-xs text-muted">· {overdueDays}일</span>
      )}

      <button
        onClick={() => onDelete?.(task)}
        aria-label="삭제"
        className="shrink-0 text-muted transition hover:text-text"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
