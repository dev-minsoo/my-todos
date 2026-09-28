import { CheckCircle2, Circle } from 'lucide-react';
import type { Task } from '@/db/types';
import { cn } from '@/lib/utils';

type Props = {
  task: Task;
  /** 넘어옴 항목이면 밀린 일수 */
  overdueDays?: number;
  onToggle?: (task: Task) => void;
};

export function TaskItem({ task, overdueDays, onToggle }: Props) {
  const done = task.completedAt != null;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <button
        onClick={() => onToggle?.(task)}
        aria-label={done ? '완료 해제' : '완료'}
        className="shrink-0 text-muted"
      >
        {done ? <CheckCircle2 className="size-5 text-accent" /> : <Circle className="size-5" />}
      </button>
      <span className={cn('flex-1 text-sm', done && 'text-muted line-through')}>{task.title}</span>
      {overdueDays != null && overdueDays > 0 && (
        <span className="shrink-0 text-xs text-muted">· {overdueDays}일</span>
      )}
    </div>
  );
}
