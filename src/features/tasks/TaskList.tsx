import type { ReactNode } from 'react';
import { ALL_TAB } from '@/db/types';
import { useUiStore } from '@/store/uiStore';
import { todayStr } from '@/domain/dayBoundary';
import { completionCount, deriveSections, groupSectionsBySpace } from '@/domain/sections';
import type { DaySections } from '@/domain/sections';
import type { Task } from '@/db/types';
import { useActiveTab } from '@/features/spaces/useActiveTab';
import { TaskItem } from './TaskItem';
import { useTasks } from './useTasks';

export function TaskList() {
  const viewedDate = useUiStore((s) => s.viewedDate);

  const { activeTab, spaces } = useActiveTab();
  const { tasks, isLoading, toggleTask, renameTask, deleteTask } = useTasks();

  const today = todayStr();
  const isAll = activeTab === ALL_TAB;

  const scoped = isAll ? tasks : tasks.filter((t) => t.spaceId === activeTab);
  const sections = deriveSections(scoped, viewedDate, today);
  const count = completionCount(sections); // 상단 진행률: 전체 합산(또는 단일 공간)
  const isEmpty = count.total === 0;
  const pct = count.total > 0 ? Math.round((count.done / count.total) * 100) : 0;

  // 전체 탭에서는 공간별로 묶는다 (SPEC §82)
  const groups = isAll ? groupSectionsBySpace(tasks, spaces, viewedDate, today) : [];

  const handlers = { onToggle: toggleTask, onRename: renameTask, onDelete: deleteTask };

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
        ) : isEmpty ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center px-4 text-center text-sm text-muted">
            <p>할 일이 없습니다.</p>
            <p className="mt-1 text-xs">아래에 적어 보세요.</p>
          </div>
        ) : isAll ? (
          groups.map((g) => (
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
        ) : (
          <SectionsView sections={sections} {...handlers} />
        )}
      </div>
    </div>
  );
}

type SectionHandlers = {
  onToggle: (task: Task) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (task: Task) => void;
};

/** 한 묶음(단일 공간 또는 전체 탭의 공간별 묶음)의 넘어옴/할 일/완료 섹션 */
function SectionsView({
  sections,
  onToggle,
  onRename,
  onDelete,
}: { sections: DaySections } & SectionHandlers) {
  return (
    <>
      {sections.carried.length > 0 && (
        <Section title="넘어옴">
          {sections.carried.map((t) => (
            <TaskItem
              key={t.id}
              task={t}
              overdueDays={t.overdueDays}
              onToggle={onToggle}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </Section>
      )}
      {sections.open.length > 0 && (
        <Section title="할 일">
          {sections.open.map((t) => (
            <TaskItem key={t.id} task={t} onToggle={onToggle} onRename={onRename} onDelete={onDelete} />
          ))}
        </Section>
      )}
      {/* 완료 섹션은 완료한 항목이 없어도 자리를 유지한다 (그날의 완료 영역이 늘 보이도록) */}
      <Section title="완료">
        {sections.completed.length > 0 ? (
          sections.completed.map((t) => (
            <TaskItem key={t.id} task={t} onToggle={onToggle} onRename={onRename} onDelete={onDelete} />
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
