import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ALL_TAB, type TabId } from '@/db/types';
import { addDaysStr, todayStr } from '@/domain/dayBoundary';

/** 테마 선택: 시스템 따름 / 라이트 강제 / 다크 강제 */
export type Theme = 'system' | 'light' | 'dark';

type UiState = {
  /** 현재 탭 (전체 또는 공간 id) */
  currentTab: TabId;
  /** 보고 있는 날짜 'YYYY-MM-DD' (앱을 열면 항상 오늘로 시작) */
  viewedDate: string;
  /** 마지막으로 사용한 공간 id (추가 시 기본 공간) */
  lastSpaceId: string | null;
  /** 테마 선택 (기본: 시스템 따름) */
  theme: Theme;
  /** 데스크톱 사이드바 접힘 여부 (아이콘 레일) */
  sidebarCollapsed: boolean;
  /** 공간 관리 모달 열림 여부 (세션 한정 — 저장 안 함) */
  spacesManagerOpen: boolean;

  setCurrentTab: (t: TabId) => void;
  setViewedDate: (d: string) => void;
  goToday: () => void;
  shiftDay: (delta: number) => void;
  setLastSpaceId: (id: string) => void;
  setTheme: (t: Theme) => void;
  toggleSidebar: () => void;
  openSpacesManager: () => void;
  closeSpacesManager: () => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      currentTab: ALL_TAB,
      viewedDate: todayStr(),
      lastSpaceId: null,
      theme: 'system',
      sidebarCollapsed: false,
      spacesManagerOpen: false,

      setCurrentTab: (t) => set({ currentTab: t }),
      setViewedDate: (d) => set({ viewedDate: d }),
      goToday: () => set({ viewedDate: todayStr() }),
      shiftDay: (delta) => set((s) => ({ viewedDate: addDaysStr(s.viewedDate, delta) })),
      setLastSpaceId: (id) => set({ lastSpaceId: id }),
      setTheme: (t) => set({ theme: t }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      openSpacesManager: () => set({ spacesManagerOpen: true }),
      closeSpacesManager: () => set({ spacesManagerOpen: false }),
    }),
    {
      name: 'tick-ui',
      // viewedDate·spacesManagerOpen은 저장하지 않는다 → 열 때마다 오늘/모달 닫힘 상태로 시작
      partialize: (s) => ({
        currentTab: s.currentTab,
        lastSpaceId: s.lastSpaceId,
        theme: s.theme,
        sidebarCollapsed: s.sidebarCollapsed,
      }),
    }
  )
);
