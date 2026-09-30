// JSON 백업의 순수 로직: 직렬화(내보내기 봉투)·검증(가져오기 파싱)·id 재매핑.
// 파일 I/O·Supabase·토스트는 여기 두지 않는다(useBackup 훅 담당). 이 파일만 Vitest로 검증.
import type { Group, Recurrence, RecurrenceRule, Space, Task } from '@/db/types';
import { parseRule } from '@/domain/recurrence';

export const BACKUP_APP = 'tick';
export const BACKUP_VERSION = 1;

/** 살아있는 데이터의 스냅샷(내보내기 대상). */
export type BackupData = {
  spaces: Space[];
  groups: Group[];
  recurrences: Recurrence[];
  tasks: Task[];
};

/** 파일로 나가는 봉투. */
export type BackupFile = {
  app: typeof BACKUP_APP;
  version: typeof BACKUP_VERSION;
  exportedAt: string; // ISO
  data: BackupData;
};

const FALLBACK_COLOR = '#2f6df6';

/** 도메인 배열에 봉투를 씌워 내보내기용 객체를 만든다. */
export function buildBackup(data: BackupData): BackupFile {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

// ---- 가져오기: 방어적 파싱 ----

export function parseBackup(raw: unknown): BackupData {
  if (!isRecord(raw)) throw new Error('백업 파일 형식이 올바르지 않아요.');
  if (raw.app !== BACKUP_APP) throw new Error('Tick 백업 파일이 아니에요.');
  if (raw.version !== BACKUP_VERSION) throw new Error('지원하지 않는 백업 버전이에요.');

  const data = raw.data;
  if (!isRecord(data)) throw new Error('백업 파일 형식이 올바르지 않아요.');

  const spaces = asArray(data.spaces);
  const groups = asArray(data.groups);
  const recurrences = asArray(data.recurrences);
  const tasks = asArray(data.tasks);
  if (!spaces || !groups || !recurrences || !tasks) {
    throw new Error('백업 파일 형식이 올바르지 않아요.');
  }

  return {
    spaces: spaces.map(normalizeSpace),
    groups: groups.map(normalizeGroup),
    recurrences: recurrences.map(normalizeRecurrence),
    tasks: tasks.map(normalizeTask),
  };
}

// ---- 가져오기: id 재매핑(추가 방식) ----

export type SpaceInsert = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  position: string;
  created_at?: string;
  deleted_at: null;
};
export type GroupInsert = {
  id: string;
  user_id: string;
  space_id: string;
  name: string;
  position: string;
  created_at?: string;
  deleted_at: null;
};
export type RecurrenceInsert = {
  id: string;
  user_id: string;
  space_id: string;
  group_id: string | null;
  title: string;
  rule: RecurrenceRule;
  start_date: string;
  position: string;
  created_at?: string;
  deleted_at: null;
};
export type TaskInsert = {
  id: string;
  user_id: string;
  space_id: string;
  group_id: string | null;
  title: string;
  due_date: string;
  completed_at: string | null;
  position: string;
  memo: string | null;
  parent_id: string | null;
  recurrence_id: string | null;
  created_at?: string;
  deleted_at: null;
};

export type ImportPayload = {
  spaces: SpaceInsert[];
  groups: GroupInsert[];
  recurrences: RecurrenceInsert[];
  tasks: TaskInsert[];
};

/**
 * 파일 데이터를 현재 계정에 "추가"할 수 있는 insert payload(snake_case)로 변환한다.
 * - 모든 id를 새로 부여하고(newId), 참조(space→task 등)를 새 id로 다시 잇는다.
 * - user_id는 현재 유저로 스탬프, deleted_at은 null.
 * - space가 없는 group/recurrence/task는 드롭, 없는 group/recurrence 참조는 null(참조 무결성).
 */
export function remapForImport(
  data: BackupData,
  newId: () => string,
  userId: string
): ImportPayload {
  const spaceIdMap = new Map<string, string>();
  const groupIdMap = new Map<string, string>();
  const recIdMap = new Map<string, string>();
  const taskIdMap = new Map<string, string>();
  for (const s of data.spaces) if (!spaceIdMap.has(s.id)) spaceIdMap.set(s.id, newId());
  for (const g of data.groups) if (!groupIdMap.has(g.id)) groupIdMap.set(g.id, newId());
  for (const r of data.recurrences) if (!recIdMap.has(r.id)) recIdMap.set(r.id, newId());
  // 서브태스크가 parent_id로 task를 참조하므로 task도 미리 새 id를 부여해 둔다.
  // 살아남는 task(공간이 남는)만 매핑 → 드롭되는 부모를 참조하면 그 자식도 같은 공간이라 함께 드롭됨.
  for (const t of data.tasks)
    if (spaceIdMap.has(t.spaceId) && !taskIdMap.has(t.id)) taskIdMap.set(t.id, newId());

  const withCreatedAt = (createdAt: string) => (createdAt ? { created_at: createdAt } : {});

  const spaces: SpaceInsert[] = data.spaces.map((s) => ({
    id: spaceIdMap.get(s.id)!,
    user_id: userId,
    name: s.name,
    color: s.color,
    position: s.position,
    ...withCreatedAt(s.createdAt),
    deleted_at: null,
  }));

  const groups: GroupInsert[] = data.groups
    .filter((g) => spaceIdMap.has(g.spaceId))
    .map((g) => ({
      id: groupIdMap.get(g.id)!,
      user_id: userId,
      space_id: spaceIdMap.get(g.spaceId)!,
      name: g.name,
      position: g.position,
      ...withCreatedAt(g.createdAt),
      deleted_at: null,
    }));

  const recurrences: RecurrenceInsert[] = data.recurrences
    .filter((r) => spaceIdMap.has(r.spaceId))
    .map((r) => ({
      id: recIdMap.get(r.id)!,
      user_id: userId,
      space_id: spaceIdMap.get(r.spaceId)!,
      group_id: r.groupId != null ? recMapOrNull(groupIdMap, r.groupId) : null,
      title: r.title,
      rule: r.rule,
      start_date: r.startDate,
      position: r.position,
      ...withCreatedAt(r.createdAt),
      deleted_at: null,
    }));

  const tasks: TaskInsert[] = data.tasks
    .filter((t) => spaceIdMap.has(t.spaceId))
    .map((t) => ({
      id: taskIdMap.get(t.id)!,
      user_id: userId,
      space_id: spaceIdMap.get(t.spaceId)!,
      group_id: t.groupId != null ? recMapOrNull(groupIdMap, t.groupId) : null,
      title: t.title,
      due_date: t.dueDate,
      completed_at: t.completedAt,
      position: t.position,
      memo: t.memo,
      // 부모가 드롭됐거나 참조가 깨졌으면 null(최상위로 승격) — 고아 방지.
      parent_id: t.parentId != null ? recMapOrNull(taskIdMap, t.parentId) : null,
      recurrence_id: t.recurrenceId != null ? recMapOrNull(recIdMap, t.recurrenceId) : null,
      ...withCreatedAt(t.createdAt),
      deleted_at: null,
    }));

  return { spaces, groups, recurrences, tasks };
}

function recMapOrNull(map: Map<string, string>, oldId: string): string | null {
  return map.get(oldId) ?? null;
}

// ---- 내부 헬퍼 ----

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asArray(v: unknown): unknown[] | null {
  return Array.isArray(v) ? v : null;
}

function reqStr(r: Record<string, unknown>, key: string): string {
  const v = r[key];
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error('백업 파일 형식이 올바르지 않아요.');
  }
  return v;
}

function optStr(r: Record<string, unknown>, key: string, fallback = ''): string {
  const v = r[key];
  return typeof v === 'string' ? v : fallback;
}

function nullableStr(r: Record<string, unknown>, key: string): string | null {
  const v = r[key];
  return typeof v === 'string' ? v : null;
}

function requireRecord(v: unknown): Record<string, unknown> {
  if (!isRecord(v)) throw new Error('백업 파일 형식이 올바르지 않아요.');
  return v;
}

function normalizeSpace(raw: unknown): Space {
  const r = requireRecord(raw);
  return {
    id: reqStr(r, 'id'),
    userId: optStr(r, 'userId'),
    name: reqStr(r, 'name'),
    color: optStr(r, 'color', FALLBACK_COLOR),
    position: optStr(r, 'position'),
    createdAt: optStr(r, 'createdAt'),
    updatedAt: optStr(r, 'updatedAt'),
    deletedAt: nullableStr(r, 'deletedAt'),
  };
}

function normalizeGroup(raw: unknown): Group {
  const r = requireRecord(raw);
  return {
    id: reqStr(r, 'id'),
    userId: optStr(r, 'userId'),
    spaceId: reqStr(r, 'spaceId'),
    name: reqStr(r, 'name'),
    position: optStr(r, 'position'),
    createdAt: optStr(r, 'createdAt'),
    updatedAt: optStr(r, 'updatedAt'),
    deletedAt: nullableStr(r, 'deletedAt'),
  };
}

function normalizeRecurrence(raw: unknown): Recurrence {
  const r = requireRecord(raw);
  return {
    id: reqStr(r, 'id'),
    userId: optStr(r, 'userId'),
    spaceId: reqStr(r, 'spaceId'),
    groupId: nullableStr(r, 'groupId'),
    title: reqStr(r, 'title'),
    rule: parseRule(r.rule), // jsonb 방어적 파싱(불량 → 매일 폴백)
    startDate: reqStr(r, 'startDate'),
    position: optStr(r, 'position'),
    createdAt: optStr(r, 'createdAt'),
    updatedAt: optStr(r, 'updatedAt'),
    deletedAt: nullableStr(r, 'deletedAt'),
  };
}

function normalizeTask(raw: unknown): Task {
  const r = requireRecord(raw);
  return {
    id: reqStr(r, 'id'),
    userId: optStr(r, 'userId'),
    spaceId: reqStr(r, 'spaceId'),
    groupId: nullableStr(r, 'groupId'),
    title: reqStr(r, 'title'),
    dueDate: reqStr(r, 'dueDate'),
    completedAt: nullableStr(r, 'completedAt'),
    position: optStr(r, 'position'),
    memo: nullableStr(r, 'memo'),
    parentId: nullableStr(r, 'parentId'),
    recurrenceId: nullableStr(r, 'recurrenceId'),
    createdAt: optStr(r, 'createdAt'),
    updatedAt: optStr(r, 'updatedAt'),
    deletedAt: nullableStr(r, 'deletedAt'),
  };
}
