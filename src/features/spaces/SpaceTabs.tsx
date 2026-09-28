import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { ALL_TAB } from '@/db/types';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';

// TODO(v0.1): useSpaces()로 실제 공간 목록/색을 불러와 대체. 지금은 레이아웃 확인용 스텁.
const STUB_SPACES = [
  { id: 'stub-personal', name: '개인', color: '#2f6df6' },
  { id: 'stub-work', name: '회사', color: '#e0663b' },
];

export function SpaceTabs() {
  const currentTab = useUiStore((s) => s.currentTab);
  const setCurrentTab = useUiStore((s) => s.setCurrentTab);

  // 공간이 2개 이상일 때만 "전체" 탭을 보인다 (SPEC §5)
  const showAll = STUB_SPACES.length >= 2;

  return (
    <div className="flex items-center gap-1 overflow-x-auto px-2 py-2">
      {showAll && (
        <TabButton active={currentTab === ALL_TAB} onClick={() => setCurrentTab(ALL_TAB)}>
          전체
        </TabButton>
      )}
      {STUB_SPACES.map((sp) => (
        <TabButton
          key={sp.id}
          active={currentTab === sp.id}
          color={sp.color}
          onClick={() => setCurrentTab(sp.id)}
        >
          {sp.name}
        </TabButton>
      ))}
      <button
        className="ml-auto shrink-0 rounded-md p-2 text-muted hover:text-text"
        aria-label="공간 추가"
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
