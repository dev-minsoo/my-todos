import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ALL_TAB, type TabId } from '@/db/types';
import { addDaysStr, todayStr } from '@/domain/dayBoundary';

/** 테마 선택: 시스템 따름 / 라이트 강제 / 다크 강제 */
export type Theme = 'system' | 'light' | 'dark';

/** 본문에 표시할 화면 (하루 / 기록 달력 / 검색 / 설정 / 휴지통) */
export type AppView = 'day' | 'calendar' | 'search' | 'settings' | 'trash';

type UiState = {
  /** 현재 탭 (전체 또는 공간 id) */
  currentTab: TabId;
  /** 보고 있는 날짜 'YYYY-MM-DD' (앱을 열면 항상 오늘로 시작) */
  viewedDate: string;
  /** 마지막으로 사용한 공간 id (추가 시 기본 공간) */
  lastSpaceId: string | null;
  /** 공간별로 마지막에 쓴 대상 그룹 id (null = 그룹 없음) — 입력 기본값 */
  lastGroupBySpace: Record<string, string | null>;
  /** 접어 둔 그룹 id 목록 */
  collapsedGroups: string[];
  /** 테마 선택 (기본: 시스템 따름) */
  theme: Theme;
  /** 데스크톱 사이드바 접힘 여부 (아이콘 레일) */
  sidebarCollapsed: boolean;
  /** 지금 보는 화면 (세션 한정 — 항상 하루 화면으로 시작) */
  activeView: AppView;
  /** 공간 관리 모달 열림 여부 (세션 한정 — 저장 안 함) */
  spacesManagerOpen: boolean;
  /** 모달을 열 때 '새 공간 추가' 폼을 펼친 채로 시작할지 (추가 버튼으로 열면 true) */
  spacesManagerAddOpen: boolean;

  setCurrentTab: (t: TabId) => void;
  setViewedDate: (d: string) => void;
  goToday: () => void;
  shiftDay: (delta: number) => void;
  setLastSpaceId: (id: string) => void;
  setLastGroup: (spaceId: string, groupId: string | null) => void;
  toggleGroupCollapsed: (groupId: string) => void;
  setTheme: (t: Theme) => void;
  toggleSidebar: () => void;
  setView: (v: AppView) => void;
  openSpacesManager: (options?: { add?: boolean }) => void;
  closeSpacesManager: () => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      currentTab: ALL_TAB,
      viewedDate: todayStr(),
      lastSpaceId: null,
      lastGroupBySpace: {},
      collapsedGroups: [],
      theme: 'system',
      sidebarCollapsed: false,
      activeView: 'day',
      spacesManagerOpen: false,
      spacesManagerAddOpen: false,

      setCurrentTab: (t) => set({ currentTab: t }),
      setViewedDate: (d) => set({ viewedDate: d }),
      goToday: () => set({ viewedDate: todayStr() }),
      shiftDay: (delta) => set((s) => ({ viewedDate: addDaysStr(s.viewedDate, delta) })),
      setLastSpaceId: (id) => set({ lastSpaceId: id }),
      setLastGroup: (spaceId, groupId) =>
        set((s) => ({ lastGroupBySpace: { ...s.lastGroupBySpace, [spaceId]: groupId } })),
      toggleGroupCollapsed: (groupId) =>
        set((s) => ({
          collapsedGroups: s.collapsedGroups.includes(groupId)
            ? s.collapsedGroups.filter((id) => id !== groupId)
            : [...s.collapsedGroups, groupId],
        })),
      setTheme: (t) => set({ theme: t }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setView: (v) => set({ activeView: v }),
      openSpacesManager: (options) =>
        set({ spacesManagerOpen: true, spacesManagerAddOpen: !!options?.add }),
      closeSpacesManager: () => set({ spacesManagerOpen: false }),
    }),
    {
      name: 'tick-ui',
      // viewedDate·activeView·모달 상태는 저장하지 않는다 → 열 때마다 오늘·하루 화면으로 시작
      partialize: (s) => ({
        currentTab: s.currentTab,
        lastSpaceId: s.lastSpaceId,
        lastGroupBySpace: s.lastGroupBySpace,
        collapsedGroups: s.collapsedGroups,
        theme: s.theme,
        sidebarCollapsed: s.sidebarCollapsed,
      }),
    }
  )
);
