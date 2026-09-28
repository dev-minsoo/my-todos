import { useEffect } from 'react';
import { useUiStore } from '@/store/uiStore';
import { useSpaces } from './useSpaces';
import { resolveActiveTab } from './spaceSelection';
import type { Space, TabId } from '@/db/types';

/**
 * 현재 탭을 공간 목록에 비추어 유효한 값으로 해석하고,
 * 저장된 탭이 유효 범위를 벗어났으면 조용히 바로잡는다(치유).
 * 사이드바·상단 탭·리스트·입력이 같은 결과를 공유하도록 한 곳에 둔다.
 */
export function useActiveTab(): {
  activeTab: TabId;
  spaces: Space[];
  isLoading: boolean;
} {
  const currentTab = useUiStore((s) => s.currentTab);
  const setCurrentTab = useUiStore((s) => s.setCurrentTab);

  const { spaces, isLoading } = useSpaces();
  const activeTab = resolveActiveTab(currentTab, spaces);

  useEffect(() => {
    if (spaces.length > 0 && activeTab !== currentTab) setCurrentTab(activeTab);
  }, [activeTab, currentTab, spaces.length, setCurrentTab]);

  return { activeTab, spaces, isLoading };
}
