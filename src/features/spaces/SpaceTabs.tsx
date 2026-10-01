import type { ReactNode } from 'react';
import { CalendarDays, Clock, NotebookPen, Settings, Settings2, Trash2 } from 'lucide-react';
import { ALL_TAB } from '@/db/types';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';
import { useActiveTab } from './useActiveTab';

export function SpaceTabs() {
  const setCurrentTab = useUiStore((s) => s.setCurrentTab);
  const openManager = useUiStore((s) => s.openSpacesManager);
  const setView = useUiStore((s) => s.setView);
  const { activeTab, spaces } = useActiveTab();

  // 공간이 2개 이상일 때만 "전체" 탭을 보인다 (SPEC §5)
  const showAll = spaces.length >= 2;

  return (
    <div className="flex items-center gap-1.5 px-3 py-2.5">
      <div className="flex flex-1 items-center gap-1.5 overflow-x-auto">
        {showAll && (
          <TabButton active={activeTab === ALL_TAB} onClick={() => setCurrentTab(ALL_TAB)}>
            전체
          </TabButton>
        )}
        {spaces.map((sp) => (
          <TabButton
            key={sp.id}
            active={activeTab === sp.id}
            color={sp.color}
            onClick={() => setCurrentTab(sp.id)}
          >
            {sp.name}
          </TabButton>
        ))}
      </div>

      <button
        className="shrink-0 rounded-full p-2.5 text-muted transition hover:bg-surface2 hover:text-text"
        aria-label="나중에"
        onClick={() => setView('someday')}
      >
        <Clock className="size-5" />
      </button>
      <button
        className="shrink-0 rounded-full p-2.5 text-muted transition hover:bg-surface2 hover:text-text"
        aria-label="메모"
        onClick={() => setView('memo')}
      >
        <NotebookPen className="size-5" />
      </button>
      <button
        className="shrink-0 rounded-full p-2.5 text-muted transition hover:bg-surface2 hover:text-text"
        aria-label="기록"
        onClick={() => setView('calendar')}
      >
        <CalendarDays className="size-5" />
      </button>
      <button
        className="shrink-0 rounded-full p-2.5 text-muted transition hover:bg-surface2 hover:text-text"
        aria-label="공간 관리"
        onClick={() => openManager()}
      >
        <Settings2 className="size-5" />
      </button>
      <button
        className="shrink-0 rounded-full p-2.5 text-muted transition hover:bg-surface2 hover:text-text"
        aria-label="휴지통"
        onClick={() => setView('trash')}
      >
        <Trash2 className="size-5" />
      </button>
      <button
        className="shrink-0 rounded-full p-2.5 text-muted transition hover:bg-surface2 hover:text-text"
        aria-label="설정"
        onClick={() => setView('settings')}
      >
        <Settings className="size-5" />
      </button>
    </div>
  );
}

function TabButton({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition',
        active ? 'bg-accentSoft font-medium text-accent' : 'text-muted hover:bg-surface2 hover:text-text'
      )}
    >
      {color && <span className="size-2 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  );
}
