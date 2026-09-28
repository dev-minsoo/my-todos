// DB(snake_case) ↔ 앱 타입(camelCase) 매핑.
// v0.1은 손으로 매핑한다. 후일 `supabase gen types`로 Row 타입을 대체 가능.
import type { Space, Task } from './types';

export type TaskRow = {
  id: string;
  user_id: string;
  space_id: string;
  title: string;
  due_date: string;
  completed_at: string | null;
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

export function toTask(r: TaskRow): Task {
  return {
    id: r.id,
    userId: r.user_id,
    spaceId: r.space_id,
    title: r.title,
    dueDate: r.due_date,
    completedAt: r.completed_at,
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
