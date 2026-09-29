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
  position: string; // fractional index (v0.1: created_at 순)
  createdAt: string; // ISO
  updatedAt: string; // ISO
  deletedAt: string | null; // ISO, null = 살아있음 (소프트 삭제)
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
