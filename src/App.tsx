import { useEffect } from 'react';
import { QueryProvider } from '@/providers/QueryProvider';
import { AuthGate } from '@/features/auth/AuthGate';
import { SpaceSidebar } from '@/features/spaces/SpaceSidebar';
import { SpaceTabs } from '@/features/spaces/SpaceTabs';
import { SpacesManagerModal } from '@/features/spaces/SpacesManagerModal';
import { DayHeader } from '@/features/day/DayHeader';
import { TaskList } from '@/features/tasks/TaskList';
import { TaskInput } from '@/features/tasks/TaskInput';
import { useUiStore } from '@/store/uiStore';

export default function App() {
  const theme = useUiStore((s) => s.theme);

  // 테마 선택을 <html data-theme>에 반영. 'system'이면 속성을 지워 prefers-color-scheme를 따른다.
  useEffect(() => {
    const el = document.documentElement;
    if (theme === 'system') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <QueryProvider>
      <AuthGate>
        <div className="flex h-full w-full">
          {/* 데스크톱: 좌측 공간 사이드바 */}
          <SpaceSidebar />

          <div className="flex min-w-0 flex-1 flex-col">
            {/* 모바일: 상단 공간 탭 (사이드바 대체) */}
            <div className="border-b border-border bg-surface md:hidden">
              <SpaceTabs />
            </div>

            <main className="flex-1 overflow-hidden">
              <div className="flex h-full flex-col px-4 py-6 md:px-8 md:py-8">
                <DayHeader />
                <div className="mt-5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
                  <TaskList />
                  <TaskInput />
                </div>
              </div>
            </main>
          </div>

          {/* 데스크톱·모바일 공용 공간 관리 모달 (사이드바/상단 탭에서 연다) */}
          <SpacesManagerModal />
        </div>
      </AuthGate>
    </QueryProvider>
  );
}
