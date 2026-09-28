import { QueryProvider } from '@/providers/QueryProvider';
import { AuthGate } from '@/features/auth/AuthGate';
import { SpaceTabs } from '@/features/spaces/SpaceTabs';
import { DayHeader } from '@/features/day/DayHeader';
import { TaskList } from '@/features/tasks/TaskList';
import { TaskInput } from '@/features/tasks/TaskInput';

export default function App() {
  return (
    <QueryProvider>
      <AuthGate>
        <div className="mx-auto flex h-full max-w-lg flex-col bg-surface">
          <header className="border-b border-border">
            <SpaceTabs />
            <DayHeader />
          </header>
          <main className="flex flex-1 flex-col overflow-hidden">
            <TaskList />
          </main>
          <TaskInput />
        </div>
      </AuthGate>
    </QueryProvider>
  );
}
