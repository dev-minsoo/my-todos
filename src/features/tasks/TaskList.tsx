import type { ReactNode } from 'react';
import type { Task } from '@/db/types';
import { useUiStore } from '@/store/uiStore';
import { todayStr } from '@/domain/dayBoundary';
import { completionCount, deriveSections } from '@/domain/sections';
import { TaskItem } from './TaskItem';

export function TaskList() {
  const viewedDate = useUiStore((s) => s.viewedDate);

  // TODO(v0.1): useTasks()로 실제 task를 불러와 대체. 지금은 빈 배열로 도메인 로직만 연결.
  const tasks: Task[] = [];
  const today = todayStr();
  const sections = deriveSections(tasks, viewedDate, today);
  const count = completionCount(sections);

  const isEmpty =
    sections.carried.length + sections.open.length + sections.completed.length === 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center px-4 text-center text-sm text-muted">
            <p>할 일이 없습니다.</p>
            <p className="mt-1 text-xs">아래에 적어 보세요. (데이터 연동 예정)</p>
          </div>
        ) : (
          <>
            {sections.carried.length > 0 && (
              <Section title="넘어옴">
                {sections.carried.map((t) => (
                  <TaskItem key={t.id} task={t} overdueDays={t.overdueDays} />
                ))}
              </Section>
            )}
            {sections.open.length > 0 && (
              <Section title="할 일">
                {sections.open.map((t) => (
                  <TaskItem key={t.id} task={t} />
                ))}
              </Section>
            )}
            {sections.completed.length > 0 && (
              <Section title="완료">
                {sections.completed.map((t) => (
                  <TaskItem key={t.id} task={t} />
                ))}
              </Section>
            )}
          </>
        )}
      </div>
      <div className="px-4 py-2 text-xs text-muted">
        {count.total}개 중 {count.done}개 완료
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="py-1">
      <h2 className="px-4 pb-1 pt-3 text-xs font-medium text-muted">{title}</h2>
      <div>{children}</div>
    </section>
  );
}
