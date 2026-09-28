import { useState } from 'react';
import type { ReactNode } from 'react';
import { Check, Layers, Plus } from 'lucide-react';
import { ALL_TAB } from '@/db/types';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';
import { useSpaces } from './useSpaces';
import { useActiveTab } from './useActiveTab';
import { SettingsMenu } from '@/features/settings/SettingsMenu';

export function SpaceSidebar() {
  const setCurrentTab = useUiStore((s) => s.setCurrentTab);
  const { addSpace } = useSpaces();
  const { activeTab, spaces } = useActiveTab();

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  // 공간이 2개 이상일 때만 "전체"를 보인다 (SPEC §5)
  const showAll = spaces.length >= 2;

  function commitAdd() {
    const n = name.trim();
    if (n) addSpace(n);
    setName('');
    setAdding(false);
  }

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid size-7 place-items-center rounded-lg bg-accent text-accentFg">
          <Check className="size-4" strokeWidth={3} />
        </span>
        <span className="text-lg font-semibold tracking-tight">Tick</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <p className="px-3 pb-1.5 pt-2 text-xs font-medium uppercase tracking-wide text-muted">
          공간
        </p>

        {showAll && (
          <NavItem active={activeTab === ALL_TAB} onClick={() => setCurrentTab(ALL_TAB)}>
            <Layers className="size-4 shrink-0 text-muted" />
            <span>전체</span>
          </NavItem>
        )}

        {spaces.map((sp) => (
          <NavItem key={sp.id} active={activeTab === sp.id} onClick={() => setCurrentTab(sp.id)}>
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: sp.color }}
              aria-hidden
            />
            <span className="truncate">{sp.name}</span>
          </NavItem>
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
            placeholder="새 공간 이름"
            aria-label="새 공간 이름"
            className="mt-1 w-full rounded-lg bg-bg px-3 py-2 text-sm outline-none ring-1 ring-border transition focus:ring-accent"
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-surface2 hover:text-text"
          >
            <Plus className="size-4 shrink-0" />
            <span>공간 추가</span>
          </button>
        )}
      </nav>

      <SettingsMenu />
    </aside>
  );
}

function NavItem({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition',
        active ? 'bg-accentSoft font-medium text-accent' : 'text-text hover:bg-surface2'
      )}
    >
      {children}
    </button>
  );
}
