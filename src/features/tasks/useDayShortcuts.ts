import { useEffect } from 'react';
import type { Task, TabId } from '@/db/types';
import { useUiStore } from '@/store/uiStore';

type Args = {
  /** 지금 화면의 항목들(가상 발생분 포함) — x키 토글 대상 조회에 쓴다. */
  dayTasks: Task[];
  toggleTask: (task: Task) => void;
  /** 1..n 탭 전환용 순서(있으면 1=전체, 그다음 공간들) */
  tabIds: TabId[];
  setCurrentTab: (t: TabId) => void;
};

/** 현재 화면에 그려진 항목 id를 위→아래 순서대로 읽는다.
 * 접힘·가시성·3개 렌더 분기를 그대로 반영하는 유일한 진실이라 로직을 중복하지 않는다. */
function visibleTaskIds(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-task-id]'))
    .map((el) => el.dataset.taskId)
    .filter((id): id is string => !!id);
}

/**
 * 하루 화면 키보드 단축키. ←/→(날짜)는 DayHeader가 이미 담당하므로 여기선 다루지 않는다.
 * 가드는 DayHeader와 동일: 조합키가 눌렸거나 포커스가 입력 요소면 흘려보낸다.
 */
export function useDayShortcuts({ dayTasks, toggleTask, tabIds, setCurrentTab }: Args) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;

      const store = useUiStore.getState(); // 최신 selectedTaskId (stale closure 방지)
      // 상세 모달이 열려 있으면 뒤 목록 단축키는 멈춘다(모달이 Escape를 직접 처리).
      if (store.detailTaskId) return;

      // 항목 커서 이동: DOM 순서대로 다음/이전. 없으면 j=첫, k=마지막.
      const moveCursor = (dir: 1 | -1) => {
        const ids = visibleTaskIds();
        if (ids.length === 0) return;
        const cur = store.selectedTaskId;
        const idx = cur ? ids.indexOf(cur) : -1;
        let next: string;
        if (idx === -1) next = dir === 1 ? ids[0] : ids[ids.length - 1];
        else next = ids[Math.min(ids.length - 1, Math.max(0, idx + dir))];
        store.setSelectedTaskId(next);
        document
          .querySelector<HTMLElement>(`[data-task-id="${next}"]`)
          ?.scrollIntoView({ block: 'nearest' });
      };

      switch (e.key) {
        case 'n':
          e.preventDefault();
          store.requestFocusInput();
          break;
        case 'j':
          e.preventDefault();
          moveCursor(1);
          break;
        case 'k':
          e.preventDefault();
          moveCursor(-1);
          break;
        case 'x': {
          const id = store.selectedTaskId;
          if (!id) return;
          const task = dayTasks.find((t) => t.id === id);
          if (!task) return;
          e.preventDefault();
          toggleTask(task);
          break;
        }
        case 'e': {
          const id = store.selectedTaskId;
          // 커서가 실제로 화면에 있을 때만 편집 진입(가상분 등도 data-task-id가 있으면 편집칸이 뜬다).
          if (!id || !document.querySelector(`[data-task-id="${id}"]`)) return;
          e.preventDefault();
          store.setEditingTaskId(id);
          break;
        }
        case 'Escape':
          if (store.selectedTaskId) {
            e.preventDefault();
            store.setSelectedTaskId(null);
          }
          break;
        default: {
          // 1..9 = 탭 전환
          if (e.key >= '1' && e.key <= '9') {
            const target = tabIds[Number(e.key) - 1];
            if (target != null) {
              e.preventDefault();
              setCurrentTab(target);
            }
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dayTasks, toggleTask, tabIds, setCurrentTab]);
}
