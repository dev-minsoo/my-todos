import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { ALL_TAB } from '@/db/types';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';
import { useSpaces } from './useSpaces';
import { resolveActiveTab } from './spaceSelection';

export function SpaceTabs() {
  const currentTab = useUiStore((s) => s.currentTab);
  const setCurrentTab = useUiStore((s) => s.setCurrentTab);
  const { spaces, addSpace } = useSpaces();

  const activeTab = resolveActiveTab(currentTab, spaces);

  // 저장된 탭이 무효(과거 세션 잔재 등)이거나 규칙에 안 맞으면 스토어를 보정한다.
  useEffect(() => {
    if (spaces.length > 0 && activeTab !== currentTab) setCurrentTab(activeTab);
  }, [activeTab, currentTab, spaces.length, setCurrentTab]);

  // 공간이 2개 이상일 때만 "전체" 탭을 보인다 (SPEC §5)
  const showAll = spaces.length >= 2;

  function handleAdd() {
    const name = window.prompt('새 공간 이름')?.trim();
    if (name) addSpace(name);
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto px-2 py-2">
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
      <button
        className="ml-auto shrink-0 rounded-md p-2 text-muted hover:text-text"
        aria-label="공간 추가"
        onClick={handleAdd}
      >
        <Plus className="size-4" />
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
        'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition',
        active ? 'bg-text text-surface' : 'text-muted hover:text-text'
      )}
    >
      {color && <span className="size-2 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  );
}
