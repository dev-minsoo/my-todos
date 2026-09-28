import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ALL_TAB, type TabId } from '@/db/types';
import { addDaysStr, todayStr } from '@/domain/dayBoundary';

type UiState = {
  /** 현재 탭 (전체 또는 공간 id) */
  currentTab: TabId;
  /** 보고 있는 날짜 'YYYY-MM-DD' (앱을 열면 항상 오늘로 시작) */
  viewedDate: string;
  /** 마지막으로 사용한 공간 id (추가 시 기본 공간) */
  lastSpaceId: string | null;

  setCurrentTab: (t: TabId) => void;
  setViewedDate: (d: string) => void;
  goToday: () => void;
  shiftDay: (delta: number) => void;
  setLastSpaceId: (id: string) => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      currentTab: ALL_TAB,
      viewedDate: todayStr(),
      lastSpaceId: null,

      setCurrentTab: (t) => set({ currentTab: t }),
      setViewedDate: (d) => set({ viewedDate: d }),
      goToday: () => set({ viewedDate: todayStr() }),
      shiftDay: (delta) => set((s) => ({ viewedDate: addDaysStr(s.viewedDate, delta) })),
      setLastSpaceId: (id) => set({ lastSpaceId: id }),
    }),
    {
      name: 'tick-ui',
      // viewedDate는 저장하지 않는다 → 항상 오늘로 열림
      partialize: (s) => ({ currentTab: s.currentTab, lastSpaceId: s.lastSpaceId }),
    }
  )
);
