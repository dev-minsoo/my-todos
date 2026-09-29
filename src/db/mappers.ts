// DB(snake_case) ↔ 앱 타입(camelCase) 매핑.
// v0.1은 손으로 매핑한다. 후일 `supabase gen types`로 Row 타입을 대체 가능.
import type { Group, Recurrence, Space, Task } from './types';
import { parseRule } from '@/domain/recurrence';

export type TaskRow = {
  id: string;
  user_id: string;
  space_id: string;
  group_id: string | null;
  title: string;
  due_date: string;
  completed_at: string | null;
  position: string;
  recurrence_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type GroupRow = {
  id: string;
  user_id: string;
  space_id: string;
  name: string;
  position: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SpaceRow = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  position: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type RecurrenceRow = {
  id: string;
  user_id: string;
  space_id: string;
  group_id: string | null;
  title: string;
  rule: unknown; // jsonb — 도메인에서 방어적으로 파싱한다
  start_date: string;
  position: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export function toTask(r: TaskRow): Task {
  return {
    id: r.id,
    userId: r.user_id,
    spaceId: r.space_id,
    groupId: r.group_id ?? null, // 마이그레이션 전(컬럼 없음)에도 안전
    title: r.title,
    dueDate: r.due_date,
    completedAt: r.completed_at,
    position: r.position,
    recurrenceId: r.recurrence_id ?? null, // 마이그레이션 전(컬럼 없음)에도 안전
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}

export function toGroup(r: GroupRow): Group {
  return {
    id: r.id,
    userId: r.user_id,
    spaceId: r.space_id,
    name: r.name,
    position: r.position,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}

export function toSpace(r: SpaceRow): Space {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    color: r.color,
    position: r.position,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}

export function toRecurrence(r: RecurrenceRow): Recurrence {
  return {
    id: r.id,
    userId: r.user_id,
    spaceId: r.space_id,
    groupId: r.group_id ?? null,
    title: r.title,
    rule: parseRule(r.rule), // jsonb 방어적 파싱(불량 → 매일 폴백)
    startDate: r.start_date,
    position: r.position,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}
