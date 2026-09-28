import type { ReactNode } from 'react';
import { Check, Layers, PanelLeftClose, PanelLeftOpen, Plus, Settings2 } from 'lucide-react';
import { ALL_TAB } from '@/db/types';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';
import { useActiveTab } from './useActiveTab';
import { SettingsMenu } from '@/features/settings/SettingsMenu';

export function SpaceSidebar() {
  const setCurrentTab = useUiStore((s) => s.setCurrentTab);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const openManager = useUiStore((s) => s.openSpacesManager);
  const { activeTab, spaces } = useActiveTab();

  // 공간이 2개 이상일 때만 "전체"를 보인다 (SPEC §5)
  const showAll = spaces.length >= 2;

  return (
    <aside
      className={cn(
        'hidden shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 md:flex',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* 헤더: 브랜드 + 접기/펼치기 */}
      <div className={cn('flex items-center px-3 py-5', collapsed ? 'justify-center' : 'justify-between pl-5')}>
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-lg bg-accent text-accentFg">
              <Check className="size-4" strokeWidth={3} />
            </span>
            <span className="text-lg font-semibold tracking-tight">Tick</span>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
          className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-surface2 hover:text-text"
        >
          {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
        </button>
      </div>

      <nav className={cn('flex-1 overflow-y-auto pb-4', collapsed ? 'px-2' : 'px-3')}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            {showAll && (
              <RailButton label="전체" active={activeTab === ALL_TAB} onClick={() => setCurrentTab(ALL_TAB)}>
                <Layers className="size-4 text-muted" />
              </RailButton>
            )}
            {spaces.map((sp) => (
              <RailButton
                key={sp.id}
                label={sp.name}
                active={activeTab === sp.id}
                onClick={() => setCurrentTab(sp.id)}
              >
                <span className="size-3 rounded-full" style={{ background: sp.color }} />
              </RailButton>
            ))}
            <RailButton label="공간 관리" onClick={openManager}>
              <Plus className="size-4" />
            </RailButton>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-3 pb-1.5 pt-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">공간</span>
              <button
                onClick={openManager}
                aria-label="공간 관리"
                className="grid size-6 place-items-center rounded-md text-muted transition hover:bg-surface2 hover:text-text"
              >
                <Settings2 className="size-4" />
              </button>
            </div>

            {showAll && (
              <NavItem active={activeTab === ALL_TAB} onClick={() => setCurrentTab(ALL_TAB)}>
                <Layers className="size-4 shrink-0 text-muted" />
                <span>전체</span>
              </NavItem>
            )}

            {spaces.map((sp) => (
              <NavItem key={sp.id} active={activeTab === sp.id} onClick={() => setCurrentTab(sp.id)}>
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: sp.color }} aria-hidden />
                <span className="truncate">{sp.name}</span>
              </NavItem>
            ))}

            <button
              onClick={openManager}
              className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-surface2 hover:text-text"
            >
              <Plus className="size-4 shrink-0" />
              <span>공간 추가</span>
            </button>
          </>
        )}
      </nav>

      <SettingsMenu collapsed={collapsed} />
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

function RailButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'grid size-10 place-items-center rounded-xl transition',
        active ? 'bg-accentSoft text-accent' : 'text-muted hover:bg-surface2 hover:text-text'
      )}
    >
      {children}
    </button>
  );
}
