import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Task } from '@/db/types';
import { toTask, type TaskRow } from '@/db/mappers';
import { useUserId } from '@/features/auth/authContext';
import { addDaysStr, todayStr } from '@/domain/dayBoundary';
import { maxValidPosition, positionAfter } from '@/domain/order';
import { isVirtualOccurrence } from '@/domain/recurrence';

const tasksKey = (userId: string) => ['tasks', userId] as const;
// 반복 발생분을 그날 "건너뜀"으로 남긴 소프트 삭제 행(표식) 전용 캐시.
const taskSkipsKey = (userId: string) => ['taskSkips', userId] as const;

const msg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** 이동 토스트용 날짜 라벨. 오늘/내일/어제는 상대어로, 그 밖은 'M월 d일'. */
function moveDateLabel(dateStr: string): string {
  const today = todayStr();
  if (dateStr === today) return '오늘';
  if (dateStr === addDaysStr(today, 1)) return '내일';
  if (dateStr === addDaysStr(today, -1)) return '어제';
  return format(parseISO(dateStr), 'M월 d일', { locale: ko });
}

async function fetchTasks(): Promise<Task[]> {
  // RLS가 본인 행만 반환한다. 살아있는 것만.
  const { data, error } = await supabase.from('tasks').select('*').is('deleted_at', null);
  if (error) throw error;
  return ((data ?? []) as TaskRow[]).map(toTask);
}

/**
 * "건너뜀" 표식 — 반복 발생분을 그날 삭제(건너뜀)로 남긴 소프트 삭제 행만 가져온다.
 * 화면엔 안 뜨지만(삭제 상태) virtualOccurrences가 그날 가상분을 다시 만들지 않도록
 * 유지해야 하는 값이다. 본 tasks 쿼리(살아있는 것만)와 분리해 "tasks=살아있음" 계약을
 * 지킨다(검색·섹션 등 기존 소비처가 삭제 행을 보지 않는다). 마이그레이션(0003) 전에는
 * recurrence_id 컬럼이 없어 이 쿼리만 조용히 실패하고 [] 로 떨어진다(핵심 목록은 무사).
 */
async function fetchSkipMarkers(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .not('recurrence_id', 'is', null)
    .not('deleted_at', 'is', null);
  if (error) throw error;
  return ((data ?? []) as TaskRow[]).map(toTask);
}

export type AddTaskInput = {
  title: string;
  dueDate: string;
  spaceId: string;
  groupId?: string | null;
};

/** 내부 뮤테이션 입력: addTask가 현재 목록 맨 끝 다음 position을 미리 계산해 넣는다. */
type AddVars = AddTaskInput & { position: string };

type Ctx = { prev?: Task[] };

export function useTasks() {
  const userId = useUserId();
  const qc = useQueryClient();
  const key = tasksKey(userId);
  const skipsKey = taskSkipsKey(userId);

  const query = useQuery({ queryKey: key, queryFn: fetchTasks });
  // 건너뜀 표식 전용. 실패해도(마이그레이션 전) 조용히 [] — 핵심 목록과 독립.
  const skipQuery = useQuery({ queryKey: skipsKey, queryFn: fetchSkipMarkers });

  const patch = (updater: (prev: Task[]) => Task[]) =>
    qc.setQueryData<Task[]>(key, (prev) => updater(prev ?? []));

  const patchSkips = (updater: (prev: Task[]) => Task[]) =>
    qc.setQueryData<Task[]>(skipsKey, (prev) => updater(prev ?? []));

  const snapshot = async (): Promise<Ctx> => {
    await qc.cancelQueries({ queryKey: key });
    return { prev: qc.getQueryData<Task[]>(key) };
  };

  const snapshotSkips = async (): Promise<Ctx> => {
    await qc.cancelQueries({ queryKey: skipsKey });
    return { prev: qc.getQueryData<Task[]>(skipsKey) };
  };

  const rollback = (e: unknown, ctx: Ctx | undefined, fallback: string) => {
    if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    toast.error(msg(e, fallback));
  };

  const rollbackSkips = (e: unknown, ctx: Ctx | undefined, fallback: string) => {
    if (ctx?.prev) qc.setQueryData(skipsKey, ctx.prev);
    toast.error(msg(e, fallback));
  };

  const invalidate = () => qc.invalidateQueries({ queryKey: key });
  const invalidateSkips = () => qc.invalidateQueries({ queryKey: skipsKey });

  // 새 항목이 들어갈 버킷(같은 공간·그룹)의 살아있는 항목 중 맨 끝 다음 position.
  // fractional index라 다른 행은 건드리지 않고 항상 맨 뒤에 붙는다.
  const nextTaskPosition = (spaceId: string, groupId: string | null): string => {
    const all = qc.getQueryData<Task[]>(key) ?? [];
    const positions = all
      .filter(
        (t) =>
          t.deletedAt == null &&
          t.parentId == null && // 서브태스크는 부모의 버킷 순서에 끼지 않는다
          t.spaceId === spaceId &&
          (t.groupId ?? null) === groupId
      )
      .map((t) => t.position);
    return positionAfter(maxValidPosition(positions));
  };

  // 한 부모 아래 서브태스크들의 맨 끝 다음 position.
  const nextSubtaskPosition = (parentId: string): string => {
    const all = qc.getQueryData<Task[]>(key) ?? [];
    const positions = all
      .filter((t) => t.deletedAt == null && t.parentId === parentId)
      .map((t) => t.position);
    return positionAfter(maxValidPosition(positions));
  };

  const add = useMutation<Task, unknown, AddVars, Ctx>({
    mutationFn: async ({ title, dueDate, spaceId, groupId, position }) => {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          space_id: spaceId,
          group_id: groupId ?? null,
          title,
          due_date: dueDate,
          position,
        })
        .select('*')
        .single();
      if (error) throw error;
      return toTask(data as TaskRow);
    },
    onMutate: async ({ title, dueDate, spaceId, groupId, position }) => {
      const ctx = await snapshot();
      const now = new Date().toISOString();
      const optimistic: Task = {
        id: `temp-${crypto.randomUUID()}`,
        userId,
        spaceId,
        groupId: groupId ?? null,
        title,
        dueDate,
        completedAt: null,
        position,
        memo: null,
        parentId: null,
        recurrenceId: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      patch((p) => [...p, optimistic]);
      return ctx;
    },
    onError: (e, _v, ctx) => rollback(e, ctx, '추가하지 못했습니다.'),
    onSettled: invalidate,
  });

  // 서브태스크 추가 — 부모의 공간·그룹·날짜를 물려받고 parent_id를 세팅한다.
  // 서브태스크도 그냥 task 행이라 toggle/rename/remove(+Undo)를 그대로 재사용한다(새 개념 아님).
  const addSub = useMutation<Task, unknown, { parent: Task; title: string; position: string }, Ctx>({
    mutationFn: async ({ parent, title, position }) => {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          space_id: parent.spaceId,
          group_id: parent.groupId,
          due_date: parent.dueDate,
          parent_id: parent.id,
          title,
          position,
        })
        .select('*')
        .single();
      if (error) throw error;
      return toTask(data as TaskRow);
    },
    onMutate: async ({ parent, title, position }) => {
      const ctx = await snapshot();
      const now = new Date().toISOString();
      const optimistic: Task = {
        id: `temp-${crypto.randomUUID()}`,
        userId,
        spaceId: parent.spaceId,
        groupId: parent.groupId,
        title,
        dueDate: parent.dueDate,
        completedAt: null,
        position,
        memo: null,
        parentId: parent.id,
        recurrenceId: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      patch((p) => [...p, optimistic]);
      return ctx;
    },
    onError: (e, _v, ctx) => rollback(e, ctx, '하위 항목을 추가하지 못했습니다.'),
    onSettled: invalidate,
  });

  // 메모 편집 — 빈 문자열은 null로 저장(입력칸 호출부에서 trim). due_date·상태 불변.
  const memoMut = useMutation<void, unknown, { id: string; memo: string | null }, Ctx>({
    mutationFn: async ({ id, memo }) => {
      const { error } = await supabase.from('tasks').update({ memo }).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, memo }) => {
      const ctx = await snapshot();
      patch((p) => p.map((t) => (t.id === id ? { ...t, memo } : t)));
      return ctx;
    },
    onError: (e, _v, ctx) => rollback(e, ctx, '메모를 저장하지 못했습니다.'),
    onSettled: invalidate,
  });

  // 항목을 다른 그룹으로 이동 (groupId === null → 그룹 없음). due_date는 건드리지 않는다.
  const move = useMutation<void, unknown, { id: string; groupId: string | null }, Ctx>({
    mutationFn: async ({ id, groupId }) => {
      const { error } = await supabase.from('tasks').update({ group_id: groupId }).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, groupId }) => {
      const ctx = await snapshot();
      patch((p) => p.map((t) => (t.id === id ? { ...t, groupId } : t)));
      return ctx;
    },
    onError: (e, _v, ctx) => rollback(e, ctx, '옮기지 못했습니다.'),
    onSettled: invalidate,
  });

  // 다른 날로 이동 — 사용자가 직접 옮기는 명시적 이동이므로 due_date를 실제로 바꾼다.
  // (자동 넘어옴은 계산이라 저장하지 않지만, 이건 사용자가 고른 이동이다.)
  // showUndo=true인 정방향 이동만 되돌리기 토스트를 띄우고, 되돌리기(역방향)는 조용히 실행한다.
  const moveDate = useMutation<
    void,
    unknown,
    { id: string; dueDate: string; prevDate: string; showUndo: boolean },
    Ctx
  >({
    mutationFn: async ({ id, dueDate }) => {
      const { error } = await supabase.from('tasks').update({ due_date: dueDate }).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, dueDate }) => {
      const ctx = await snapshot();
      patch((p) => p.map((t) => (t.id === id ? { ...t, dueDate } : t)));
      return ctx;
    },
    onError: (e, _v, ctx) => rollback(e, ctx, '옮기지 못했습니다.'),
    onSuccess: (_d, { id, dueDate, prevDate, showUndo }) => {
      if (!showUndo) return;
      toast(`${moveDateLabel(dueDate)}로 옮김`, {
        action: {
          label: '실행 취소',
          onClick: () =>
            moveDate.mutate({ id, dueDate: prevDate, prevDate: dueDate, showUndo: false }),
        },
      });
    },
    onSettled: invalidate,
  });

  // 다른 공간으로 이동 — space_id를 바꾸고 group_id는 초기화한다(옛 그룹은 옛 공간 소속이라 무의미).
  const moveSpace = useMutation<
    void,
    unknown,
    {
      id: string;
      spaceId: string;
      groupId: string | null;
      prevSpaceId: string;
      prevGroupId: string | null;
      spaceName: string;
      showUndo: boolean;
    },
    Ctx
  >({
    mutationFn: async ({ id, spaceId, groupId }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ space_id: spaceId, group_id: groupId })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, spaceId, groupId }) => {
      const ctx = await snapshot();
      patch((p) => p.map((t) => (t.id === id ? { ...t, spaceId, groupId } : t)));
      return ctx;
    },
    onError: (e, _v, ctx) => rollback(e, ctx, '옮기지 못했습니다.'),
    onSuccess: (_d, { id, spaceId, groupId, prevSpaceId, prevGroupId, spaceName, showUndo }) => {
      if (!showUndo) return;
      toast(`${spaceName} 공간으로 옮김`, {
        action: {
          label: '실행 취소',
          onClick: () =>
            // 되돌리기: 이전 공간·그룹을 그대로 복원(조용히).
            moveSpace.mutate({
              id,
              spaceId: prevSpaceId,
              groupId: prevGroupId,
              prevSpaceId: spaceId,
              prevGroupId: groupId,
              spaceName,
              showUndo: false,
            }),
        },
      });
    },
    onSettled: invalidate,
  });

  // 드래그로 순서 변경 — position만 저장한다. due_date·completed_at은 절대 건드리지 않는다.
  // 두 이웃 사이 키는 order.ts로 미리 계산해 넘긴다(다른 행은 update하지 않는다).
  const reorder = useMutation<void, unknown, { id: string; position: string }, Ctx>({
    mutationFn: async ({ id, position }) => {
      const { error } = await supabase.from('tasks').update({ position }).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, position }) => {
      const ctx = await snapshot();
      patch((p) => p.map((t) => (t.id === id ? { ...t, position } : t)));
      return ctx;
    },
    onError: (e, _v, ctx) => rollback(e, ctx, '순서를 바꾸지 못했습니다.'),
    onSettled: invalidate,
  });

  const toggle = useMutation<void, unknown, Task, Ctx>({
    mutationFn: async (task) => {
      const completed_at = task.completedAt ? null : new Date().toISOString();
      const { error } = await supabase.from('tasks').update({ completed_at }).eq('id', task.id);
      if (error) throw error;
    },
    onMutate: async (task) => {
      const ctx = await snapshot();
      const completedAt = task.completedAt ? null : new Date().toISOString();
      patch((p) => p.map((t) => (t.id === task.id ? { ...t, completedAt } : t)));
      return ctx;
    },
    onError: (e, _v, ctx) => rollback(e, ctx, '상태를 바꾸지 못했습니다.'),
    onSettled: invalidate,
  });

  const rename = useMutation<void, unknown, { id: string; title: string }, Ctx>({
    mutationFn: async ({ id, title }) => {
      const { error } = await supabase.from('tasks').update({ title }).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, title }) => {
      const ctx = await snapshot();
      patch((p) => p.map((t) => (t.id === id ? { ...t, title } : t)));
      return ctx;
    },
    onError: (e, _v, ctx) => rollback(e, ctx, '수정하지 못했습니다.'),
    onSettled: invalidate,
  });

  const restore = useMutation<void, unknown, string>({
    mutationFn: async (id) => {
      // 부모를 되살리면 함께 삭제됐던 서브태스크(parent_id=id)도 같이 되살린다.
      const { error } = await supabase
        .from('tasks')
        .update({ deleted_at: null })
        .or(`id.eq.${id},parent_id.eq.${id}`);
      if (error) throw error;
    },
    // 되살리면 건너뜀 표식이 사라지므로(살아나거나 목록으로 복귀) 두 캐시 모두 갱신.
    onSettled: () => {
      invalidate();
      invalidateSkips();
    },
  });

  const remove = useMutation<void, unknown, Task, Ctx>({
    mutationFn: async (task) => {
      // 부모를 지우면 서브태스크(parent_id=task.id)도 함께 소프트 삭제한다.
      const { error } = await supabase
        .from('tasks')
        .update({ deleted_at: new Date().toISOString() })
        .or(`id.eq.${task.id},parent_id.eq.${task.id}`);
      if (error) throw error;
    },
    onMutate: async (task) => {
      const ctx = await snapshot();
      patch((p) => p.filter((t) => t.id !== task.id && t.parentId !== task.id));
      return ctx;
    },
    onError: (e, _v, ctx) => rollback(e, ctx, '삭제하지 못했습니다.'),
    onSuccess: (_d, task) => {
      toast('삭제됨', {
        action: { label: '실행 취소', onClick: () => restore.mutate(task.id) },
      });
    },
    onSettled: invalidate,
  });

  // 가상 발생분을 체크 = 그날치를 실제 행으로 굳히면서 완료로 저장(실체화).
  // 이후엔 평범한 완료 task라 토글·집계·기록이 그대로 재사용된다.
  const materializeComplete = useMutation<Task, unknown, Task, Ctx>({
    mutationFn: async (virt) => {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          space_id: virt.spaceId,
          group_id: virt.groupId,
          title: virt.title,
          due_date: virt.dueDate,
          position: virt.position,
          recurrence_id: virt.recurrenceId,
          completed_at: new Date().toISOString(),
        })
        .select('*')
        .single();
      if (error) throw error;
      return toTask(data as TaskRow);
    },
    onMutate: async (virt) => {
      const ctx = await snapshot();
      const now = new Date().toISOString();
      // 낙관적으로 실제(완료) 행을 심는다 — 이 행이 그날 발생분을 감지해 가상분을 밀어낸다.
      const optimistic: Task = {
        ...virt,
        id: `temp-${crypto.randomUUID()}`,
        completedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      patch((p) => [...p, optimistic]);
      return ctx;
    },
    onError: (e, _v, ctx) => rollback(e, ctx, '완료 처리하지 못했습니다.'),
    onSettled: invalidate,
  });

  // 가상 발생분을 삭제 = 그날만 "건너뜀". 실제 행을 소프트 삭제 상태로 바로 심어
  // (deleted_at 세팅) virtualOccurrences가 그날 다시 만들지 않게 한다.
  const skipVirtual = useMutation<Task, unknown, Task, Ctx>({
    mutationFn: async (virt) => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          space_id: virt.spaceId,
          group_id: virt.groupId,
          title: virt.title,
          due_date: virt.dueDate,
          position: virt.position,
          recurrence_id: virt.recurrenceId,
          deleted_at: now,
        })
        .select('*')
        .single();
      if (error) throw error;
      return toTask(data as TaskRow);
    },
    onMutate: async (virt) => {
      const ctx = await snapshotSkips();
      const now = new Date().toISOString();
      // 표식(삭제된 행)을 건너뜀 캐시에 낙관적으로 넣는다 → 가상분이 즉시 사라진다.
      const marker: Task = {
        ...virt,
        id: `temp-${crypto.randomUUID()}`,
        deletedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      patchSkips((p) => [...p, marker]);
      return ctx;
    },
    onError: (e, _v, ctx) => rollbackSkips(e, ctx, '건너뛰지 못했습니다.'),
    onSuccess: (row) => {
      toast('오늘은 건너뛰었어요', {
        action: { label: '실행 취소', onClick: () => restore.mutate(row.id) },
      });
    },
    onSettled: invalidateSkips,
  });

  // 최상위 task만 노출한다(서브태스크는 아래 subtasksByParent로 분리) — 검색·리포트·달력·
  // 섹션 등 모든 소비처가 useTasks().tasks 하나를 공유하므로 여기서 한 번만 나누면 무영향.
  // ref 안정성을 위해 memoize(매 렌더 새 배열이면 하위 memo가 다 깨진다).
  const parentTasks = useMemo(
    () => (query.data ?? []).filter((t) => t.parentId == null),
    [query.data]
  );
  const subtasksByParent = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of query.data ?? []) {
      if (t.parentId == null) continue;
      const arr = map.get(t.parentId);
      if (arr) arr.push(t);
      else map.set(t.parentId, [t]);
    }
    for (const arr of map.values())
      arr.sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0));
    return map;
  }, [query.data]);

  return {
    tasks: parentTasks,
    /** 부모 id → 그 아래 서브태스크 목록(position 정렬). TaskItem 펼침 패널에서 쓴다. */
    subtasksByParent,
    /** 그날 "건너뜀"으로 남은 소프트 삭제 표식. virtualOccurrences 감지용으로만 쓴다. */
    recurrenceSkips: skipQuery.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    addTask: (input: AddTaskInput) =>
      add.mutate({ ...input, position: nextTaskPosition(input.spaceId, input.groupId ?? null) }),
    // 가상 발생분이면 실체화(완료로 굳힘), 아니면 평범한 토글.
    toggleTask: (task: Task) =>
      isVirtualOccurrence(task) ? materializeComplete.mutate(task) : toggle.mutate(task),
    renameTask: (id: string, title: string) => rename.mutate({ id, title }),
    // 가상 발생분이면 그날만 건너뜀(표식), 아니면 평범한 소프트 삭제.
    deleteTask: (task: Task) =>
      isVirtualOccurrence(task) ? skipVirtual.mutate(task) : remove.mutate(task),
    moveTaskToGroup: (id: string, groupId: string | null) => move.mutate({ id, groupId }),
    /** 다른 날로 이동(명시적) — due_date를 바꾸고 되돌리기 토스트를 띄운다. */
    moveTaskToDate: (task: Task, dueDate: string) => {
      if (dueDate === task.dueDate) return;
      moveDate.mutate({ id: task.id, dueDate, prevDate: task.dueDate, showUndo: true });
    },
    /** 다른 공간으로 이동 — space_id 변경 + 그룹 초기화. 같은 공간이면 no-op(그룹 보존). */
    moveTaskToSpace: (task: Task, spaceId: string, spaceName: string) => {
      if (spaceId === task.spaceId) return;
      moveSpace.mutate({
        id: task.id,
        spaceId,
        groupId: null,
        prevSpaceId: task.spaceId,
        prevGroupId: task.groupId,
        spaceName,
        showUndo: true,
      });
    },
    /** 순서 변경: order.ts로 계산한 새 position 키를 저장(due_date 불변). */
    reorderTask: (id: string, position: string) => reorder.mutate({ id, position }),
    /** 서브태스크 추가 — 부모 아래 맨 끝에 붙인다. */
    addSubtask: (parent: Task, title: string) =>
      addSub.mutate({ parent, title, position: nextSubtaskPosition(parent.id) }),
    /** 메모 저장 — 빈 값은 null로 지운다. */
    updateMemo: (id: string, memo: string) => memoMut.mutate({ id, memo: memo.trim() || null }),
  };
}
