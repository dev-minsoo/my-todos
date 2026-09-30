import { lazy, Suspense, useEffect } from 'react';
import { MotionConfig } from 'framer-motion';
import { QueryProvider } from '@/providers/QueryProvider';
import { AuthGate } from '@/features/auth/AuthGate';
import { SpaceSidebar } from '@/features/spaces/SpaceSidebar';
import { SpaceTabs } from '@/features/spaces/SpaceTabs';
import { SpacesManagerModal } from '@/features/spaces/SpacesManagerModal';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { TrashPage } from '@/features/trash/TrashPage';
import { CalendarPage } from '@/features/calendar/CalendarPage';
import { SearchPage } from '@/features/search/SearchPage';
import { DayHeader } from '@/features/day/DayHeader';
import { TaskList } from '@/features/tasks/TaskList';
import { TaskInput } from '@/features/tasks/TaskInput';
import { useUiStore } from '@/store/uiStore';

// 리포트는 차트 라이브러리(recharts)를 쓰므로 코드 분할 — 진입할 때만 로드한다.
const ReportPage = lazy(() => import('@/features/report/ReportPage'));

export default function App() {
  const theme = useUiStore((s) => s.theme);
  const activeView = useUiStore((s) => s.activeView);

  // 테마 선택을 <html data-theme>에 반영. 'system'이면 속성을 지워 prefers-color-scheme를 따른다.
  useEffect(() => {
    const el = document.documentElement;
    if (theme === 'system') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', theme);
  }, [theme]);

  const isDay = activeView === 'day';

  return (
    <QueryProvider>
      <AuthGate>
        {/* reducedMotion="user": OS의 '동작 줄이기' 설정을 켠 사용자에겐 애니메이션을 끈다 */}
        <MotionConfig reducedMotion="user">
        <div className="flex h-full w-full">
          {/* 데스크톱: 좌측 공간 사이드바 */}
          <SpaceSidebar />

          <div className="flex min-w-0 flex-1 flex-col">
            {/* 모바일: 상단 공간 탭 (하루 화면에서만 보인다) */}
            {isDay && (
              <div className="border-b border-border bg-surface md:hidden">
                <SpaceTabs />
              </div>
            )}

            <main className="flex-1 overflow-hidden">
              {activeView === 'settings' ? (
                <SettingsPage />
              ) : activeView === 'trash' ? (
                <TrashPage />
              ) : activeView === 'calendar' ? (
                <CalendarPage />
              ) : activeView === 'search' ? (
                <SearchPage />
              ) : activeView === 'report' ? (
                <Suspense
                  fallback={<p className="p-8 text-center text-sm text-muted">불러오는 중…</p>}
                >
                  <ReportPage />
                </Suspense>
              ) : (
                <div className="flex h-full flex-col px-4 py-6 md:px-8 md:py-8">
                  <DayHeader />
                  <div className="mt-5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
                    <TaskList />
                    <TaskInput />
                  </div>
                </div>
              )}
            </main>
          </div>

          {/* 데스크톱·모바일 공용 모달 (사이드바/상단 탭에서 연다) */}
          <SpacesManagerModal />
        </div>
        </MotionConfig>
      </AuthGate>
    </QueryProvider>
  );
}
