// 앱 도메인 타입. Supabase 스키마와 1:1 대응(camelCase 매핑).
// DB 연동 시 `supabase gen types`로 생성한 Database 타입을 여기서 매핑한다.

export type Task = {
  id: string;
  userId: string;
  spaceId: string;
  groupId: string | null; // 속한 그룹, null = 그룹 없음
  title: string;
  dueDate: string; // 'YYYY-MM-DD'
  completedAt: string | null; // ISO, null = 할 일
  cancelledAt: string | null; // ISO, null = 취소 아님 (completedAt과 대칭·상호배타인 두 번째 '닫힘' 상태)
  position: string; // fractional index (v0.1: created_at 순)
  memo: string | null; // 자유 메모, null = 없음 (최상위 task에만)
  parentId: string | null; // 서브태스크면 부모 task id, null = 최상위
  recurrenceId: string | null; // 이 할 일을 낳은 반복 규칙, null = 반복에서 나온 것 아님
  createdAt: string; // ISO
  updatedAt: string; // ISO
  deletedAt: string | null; // ISO, null = 살아있음 (소프트 삭제)
};

/**
 * 반복 규칙. jsonb라 유니온을 넓혀도 마이그레이션이 필요 없다.
 * - daily: 매일.
 * - weekly: 특정 요일. interval(생략·1 = 매주, 2 = 격주, 3… = N주마다) — 시작일이 든 주를 0으로 센다.
 * - monthly: 매월 day일(1~31). 그 달에 없는 날(31일 등)은 말일로 당긴다.
 * - everyNDays: 시작일 기준 interval일마다.
 */
export type RecurrenceRule =
  | { type: 'daily' }
  | { type: 'weekly'; weekdays: number[]; interval?: number }
  | { type: 'monthly'; day: number }
  | { type: 'everyNDays'; interval: number };

/**
 * 반복 할 일의 규칙(예: "매일 운동", "월·수·금 약").
 * 발생분은 저장하지 않고 보는 날짜에 가상으로 계산한다(compute-on-view).
 */
export type Recurrence = {
  id: string;
  userId: string;
  spaceId: string;
  groupId: string | null;
  title: string;
  rule: RecurrenceRule;
  startDate: string; // 'YYYY-MM-DD', 이 날짜부터 발생
  position: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

/** 공간 안의 하위 묶음(예: 개인>건강, 회사>A프로젝트). 상태 개념이 아닌 분류 축. */
export type Group = {
  id: string;
  userId: string;
  spaceId: string;
  name: string;
  position: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type Space = {
  id: string;
  userId: string;
  name: string;
  color: string;
  position: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export const ALL_TAB = 'all' as const;

/** 현재 탭: '전체' 또는 특정 공간 id */
export type TabId = typeof ALL_TAB | string;
