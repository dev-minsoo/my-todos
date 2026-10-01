import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Ban, CalendarDays, CheckCircle2, Circle, Repeat, RotateCcw } from 'lucide-react';
import type { Group, Space, Task } from '@/db/types';
import { daysBetween, todayStr } from '@/domain/dayBoundary';
import { isVirtualOccurrence } from '@/domain/recurrence';
import { Modal } from '@/components/Modal';
import { cn } from '@/lib/utils';

type Props = {
  /** 열려는 항목 id (null = 닫힘). uiStore.detailTaskId를 그대로 받는다. */
  taskId: string | null;
  /** 그날 화면의 항목들(가상 발생분 포함) — id로 조회. */
  tasks: Task[];
  spaces: Space[];
  groups: Group[];
  subtasksByParent: Map<string, Task[]>;
  /** 취소(두 번째 '닫힘') — 완료도 삭제도 아닌 흐지부지 닫기. */
  onCancel: (task: Task) => void;
  /** 취소 해제(복구) — 다시 "할 일"로. */
  onUncancel: (task: Task) => void;
  onClose: () => void;
};

const fmtDay = (s: string) => format(parseISO(s), 'M월 d일 (EEE)', { locale: ko });

/**
 * 할 일 상세 "정보" 모달 — 읽기 전용.
 * 편집(제목·메모·서브태스크)은 항목 행(인라인·펼침 패널)에서 하고, 여기선 한눈에 보기만 한다.
 * 조작 기본은 여전히 인라인이며, 이 모달은 정보 열람 용도로만 연다.
 */
export function TaskDetailModal({
  taskId,
  tasks,
  spaces,
  groups,
  subtasksByParent,
  onCancel,
  onUncancel,
  onClose,
}: Props) {
  const task = taskId ? tasks.find((t) => t.id === taskId) ?? null : null;
  // 열려던 항목이 사라졌으면(삭제·동기화) 조용히 닫힌다.
  return (
    <Modal open={task != null} onClose={onClose} title={task?.title ?? ''}>
      {task && (
        <Body
          task={task}
          spaces={spaces}
          groups={groups}
          subtasksByParent={subtasksByParent}
          onCancel={onCancel}
          onUncancel={onUncancel}
        />
      )}
    </Modal>
  );
}

function Body({
  task,
  spaces,
  groups,
  subtasksByParent,
  onCancel,
  onUncancel,
}: {
  task: Task;
  spaces: Space[];
  groups: Group[];
  subtasksByParent: Map<string, Task[]>;
  onCancel: (task: Task) => void;
  onUncancel: (task: Task) => void;
}) {
  const done = task.completedAt != null;
  const cancelled = task.cancelledAt != null;
  const isVirtual = isVirtualOccurrence(task);
  const space = spaces.find((s) => s.id === task.spaceId) ?? null;
  const group = task.groupId ? groups.find((g) => g.id === task.groupId) ?? null : null;
  const subtasks = subtasksByParent.get(task.id) ?? [];
  const subDone = subtasks.filter((s) => s.completedAt != null).length;
  // 넘어옴(며칠 지남)은 행 배지와 같은 기준: 오늘까지 밀린 달력 일수(미완료·미취소일 때만).
  const overdue = done || cancelled ? 0 : Math.max(0, daysBetween(task.dueDate, todayStr()));

  return (
    <div className="space-y-4 text-sm">
      {/* 상태: 완료 / 취소됨 / 미완료 */}
      <div className="flex items-center gap-2">
        {cancelled ? (
          <Ban className="size-4 shrink-0 text-muted" />
        ) : done ? (
          <CheckCircle2 className="size-4 shrink-0 text-accent" />
        ) : (
          <Circle className="size-4 shrink-0 text-muted" />
        )}
        <span className={cn('font-medium', done && !cancelled && 'text-accent', cancelled && 'text-muted line-through')}>
          {cancelled ? '취소됨' : done ? '완료' : '미완료'}
        </span>
        {cancelled && task.cancelledAt ? (
          <span className="text-xs text-muted">
            · {format(parseISO(task.cancelledAt), 'M월 d일 HH:mm', { locale: ko })}
          </span>
        ) : done && task.completedAt ? (
          <span className="text-xs text-muted">
            · {format(parseISO(task.completedAt), 'M월 d일 HH:mm', { locale: ko })}
          </span>
        ) : null}
      </div>

      {/* 날짜 + 넘어옴 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-muted">
          <CalendarDays className="size-4" />
          {fmtDay(task.dueDate)}
        </span>
        {overdue > 0 && (
          <span className="rounded-full bg-overdueBg px-2 py-0.5 text-[11px] font-medium text-overdueFg">
            {overdue}일 지남
          </span>
        )}
      </div>

      {/* 공간 · 그룹 */}
      {space && (
        <div className="flex items-center gap-1.5">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: space.color }}
            aria-hidden
          />
          <span>{space.name}</span>
          {group && <span className="text-muted">› {group.name}</span>}
        </div>
      )}

      {isVirtual ? (
        <div className="flex items-start gap-2 rounded-lg bg-surface2 px-3 py-2 text-xs text-muted">
          <Repeat className="mt-0.5 size-3.5 shrink-0" />
          <p>반복에서 나온 할 일이에요. 체크하거나 수정하면 그날의 실제 항목으로 저장돼요.</p>
        </div>
      ) : (
        <>
          {/* 메모 */}
          <section>
            <h3 className="mb-1 text-xs font-medium text-muted">메모</h3>
            {task.memo ? (
              <p className="whitespace-pre-wrap rounded-lg bg-bg px-3 py-2">{task.memo}</p>
            ) : (
              <p className="text-muted">없음</p>
            )}
          </section>

          {/* 하위 항목 */}
          <section>
            <h3 className="mb-1 flex items-center gap-2 text-xs font-medium text-muted">
              하위 항목
              {subtasks.length > 0 && (
                <span className="tabular-nums">
                  {subDone}/{subtasks.length}
                </span>
              )}
            </h3>
            {subtasks.length > 0 ? (
              <ul className="space-y-1">
                {subtasks.map((s) => {
                  const sdone = s.completedAt != null;
                  return (
                    <li key={s.id} className="flex items-center gap-2">
                      {sdone ? (
                        <CheckCircle2 className="size-4 shrink-0 text-accent" />
                      ) : (
                        <Circle className="size-4 shrink-0 text-muted" />
                      )}
                      <span className={cn('min-w-0 truncate', sdone && 'text-muted line-through')}>
                        {s.title}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-muted">없음</p>
            )}
          </section>
        </>
      )}

      {/* 액션: 취소(미완료만) / 복구(취소됨). 완료한 항목엔 안 보인다(이미 긍정적으로 닫힘). */}
      {(cancelled || !done) && (
        <div className="flex border-t border-border pt-3">
          {cancelled ? (
            <button
              type="button"
              onClick={() => onUncancel(task)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted transition hover:bg-surface2 hover:text-text"
            >
              <RotateCcw className="size-4" />
              복구
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onCancel(task)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted transition hover:bg-amber-500/10 hover:text-amber-500"
            >
              <Ban className="size-4" />
              취소
            </button>
          )}
        </div>
      )}

      {/* 만든 날 */}
      {task.createdAt && (
        <p className="border-t border-border pt-3 text-xs text-muted">
          {format(parseISO(task.createdAt), 'yyyy년 M월 d일', { locale: ko })}에 만듦
        </p>
      )}
    </div>
  );
}
