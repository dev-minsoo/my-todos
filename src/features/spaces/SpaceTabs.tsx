import { useState } from 'react';
import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { ALL_TAB } from '@/db/types';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';
import { useSpaces } from './useSpaces';
import { useActiveTab } from './useActiveTab';

export function SpaceTabs() {
  const setCurrentTab = useUiStore((s) => s.setCurrentTab);
  const { addSpace } = useSpaces();
  const { activeTab, spaces } = useActiveTab();

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  // 공간이 2개 이상일 때만 "전체" 탭을 보인다 (SPEC §5)
  const showAll = spaces.length >= 2;

  function commitAdd() {
    const n = name.trim();
    if (n) addSpace(n);
    setName('');
    setAdding(false);
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-2.5">
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

      {adding ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) commitAdd();
            if (e.key === 'Escape') {
              setName('');
              setAdding(false);
            }
          }}
          onBlur={commitAdd}
          placeholder="새 공간"
          aria-label="새 공간 이름"
          className="ml-1 w-28 shrink-0 rounded-full bg-bg px-3 py-1.5 text-sm outline-none ring-1 ring-border transition focus:ring-accent"
        />
      ) : (
        <button
          className="ml-auto shrink-0 rounded-full p-2 text-muted transition hover:bg-surface2 hover:text-text"
          aria-label="공간 추가"
          onClick={() => setAdding(true)}
        >
          <Plus className="size-4" />
        </button>
      )}
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
