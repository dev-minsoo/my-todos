import type { ReactNode } from 'react';
import { ALL_TAB } from '@/db/types';
import { useUiStore } from '@/store/uiStore';
import { todayStr } from '@/domain/dayBoundary';
import { completionCount, deriveSections } from '@/domain/sections';
import { useSpaces } from '@/features/spaces/useSpaces';
import { resolveActiveTab } from '@/features/spaces/spaceSelection';
import { TaskItem } from './TaskItem';
import { useTasks } from './useTasks';

export function TaskList() {
  const viewedDate = useUiStore((s) => s.viewedDate);
  const currentTab = useUiStore((s) => s.currentTab);

  const { spaces } = useSpaces();
  const { tasks, isLoading, toggleTask, renameTask, deleteTask } = useTasks();

  const activeTab = resolveActiveTab(currentTab, spaces);
  const scoped = activeTab === ALL_TAB ? tasks : tasks.filter((t) => t.spaceId === activeTab);

  const today = todayStr();
  const sections = deriveSections(scoped, viewedDate, today);
  const count = completionCount(sections);
  const isEmpty = count.total === 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {isLoading && isEmpty ? (
          <div className="flex h-full min-h-40 items-center justify-center text-sm text-muted">
            불러오는 중…
          </div>
        ) : isEmpty ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center px-4 text-center text-sm text-muted">
            <p>할 일이 없습니다.</p>
            <p className="mt-1 text-xs">아래에 적어 보세요.</p>
          </div>
        ) : (
          <>
            {sections.carried.length > 0 && (
              <Section title="넘어옴">
                {sections.carried.map((t) => (
                  <TaskItem
                    key={t.id}
                    task={t}
                    overdueDays={t.overdueDays}
                    onToggle={toggleTask}
                    onRename={renameTask}
                    onDelete={deleteTask}
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
                    onToggle={toggleTask}
                    onRename={renameTask}
                    onDelete={deleteTask}
                  />
                ))}
              </Section>
            )}
            {sections.completed.length > 0 && (
              <Section title="완료">
                {sections.completed.map((t) => (
                  <TaskItem
                    key={t.id}
                    task={t}
                    onToggle={toggleTask}
                    onRename={renameTask}
                    onDelete={deleteTask}
                  />
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
