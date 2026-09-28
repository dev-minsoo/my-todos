import { ALL_TAB, type Space, type TabId } from '@/db/types';

/**
 * 저장된 currentTab을 실제 공간 목록에 비추어 유효한 탭으로 보정한다.
 * - '전체'는 공간이 2개 이상일 때만 유효. 1개면 그 공간, 0개면 '전체'로 폴백.
 * - 존재하지 않는 공간 id(과거 세션의 잔재 등)는 위 규칙으로 폴백.
 */
export function resolveActiveTab(currentTab: TabId, spaces: Space[]): TabId {
  const fallback: TabId = spaces.length >= 2 ? ALL_TAB : (spaces[0]?.id ?? ALL_TAB);
  if (currentTab === ALL_TAB) {
    return spaces.length >= 2 ? ALL_TAB : fallback;
  }
  return spaces.some((s) => s.id === currentTab) ? currentTab : fallback;
}

/**
 * 새 할 일이 들어갈 대상 공간을 고른다.
 * - 특정 공간 탭이면 그 공간.
 * - '전체'면 마지막에 쓴 공간(유효할 때) 아니면 첫 공간.
 */
export function targetSpaceId(
  activeTab: TabId,
  spaces: Space[],
  lastSpaceId: string | null
): string | null {
  if (activeTab !== ALL_TAB) return activeTab;
  if (lastSpaceId && spaces.some((s) => s.id === lastSpaceId)) return lastSpaceId;
  return spaces[0]?.id ?? null;
}

/** 새 공간의 position(자리값). v0.1은 0-패딩 정수 문자열로 순서만 유지. */
export function nextSpacePosition(spaces: Space[]): string {
  const max = spaces.reduce((m, s) => Math.max(m, Number(s.position) || 0), 0);
  return String(max + 1).padStart(10, '0');
}

/** position 문자열(0-패딩 정수). 순서 재배치 시 1..n으로 정규화할 때 쓴다. */
export function positionAt(index: number): string {
  return String(index + 1).padStart(10, '0');
}

/** 공간 포인트 컬러 팔레트 (추가·수정 시 기본값과 색 선택 스와치). */
export const SPACE_PALETTE = [
  '#4f46e5',
  '#2f6df6',
  '#0ea5e9',
  '#2fa36b',
  '#d9a441',
  '#e0663b',
  '#e05a8a',
  '#a855f7',
];

/** 배열에서 from 위치 항목을 to 위치로 옮긴 새 배열. 범위를 벗어나면 원본을 복제해 그대로 반환. */
export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from < 0 || from >= arr.length || to < 0 || to >= arr.length || from === to) {
    return arr.slice();
  }
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
