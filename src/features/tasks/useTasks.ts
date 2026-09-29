import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Task } from '@/db/types';
import { toTask, type TaskRow } from '@/db/mappers';
import { useUserId } from '@/features/auth/authContext';

const tasksKey = (userId: string) => ['tasks', userId] as const;

const msg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

async function fetchTasks(): Promise<Task[]> {
  // RLS가 본인 행만 반환한다. 살아있는 것만.
  const { data, error } = await supabase.from('tasks').select('*').is('deleted_at', null);
  if (error) throw error;
  return ((data ?? []) as TaskRow[]).map(toTask);
}

export type AddTaskInput = {
  title: string;
  dueDate: string;
  spaceId: string;
  groupId?: string | null;
};

type Ctx = { prev?: Task[] };

export function useTasks() {
  const userId = useUserId();
  const qc = useQueryClient();
  const key = tasksKey(userId);

  const query = useQuery({ queryKey: key, queryFn: fetchTasks });

  const patch = (updater: (prev: Task[]) => Task[]) =>
    qc.setQueryData<Task[]>(key, (prev) => updater(prev ?? []));

  const snapshot = async (): Promise<Ctx> => {
    await qc.cancelQueries({ queryKey: key });
    return { prev: qc.getQueryData<Task[]>(key) };
  };

  const rollback = (e: unknown, ctx: Ctx | undefined, fallback: string) => {
    if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    toast.error(msg(e, fallback));
  };

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const add = useMutation<Task, unknown, AddTaskInput, Ctx>({
    mutationFn: async ({ title, dueDate, spaceId, groupId }) => {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          space_id: spaceId,
          group_id: groupId ?? null,
          title,
          due_date: dueDate,
          position: String(Date.now()),
        })
        .select('*')
        .single();
      if (error) throw error;
      return toTask(data as TaskRow);
    },
    onMutate: async ({ title, dueDate, spaceId, groupId }) => {
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
        position: String(Date.now()),
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
      const { error } = await supabase.from('tasks').update({ deleted_at: null }).eq('id', id);
      if (error) throw error;
    },
    onSettled: invalidate,
  });

  const remove = useMutation<void, unknown, Task, Ctx>({
    mutationFn: async (task) => {
      const { error } = await supabase
        .from('tasks')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', task.id);
      if (error) throw error;
    },
    onMutate: async (task) => {
      const ctx = await snapshot();
      patch((p) => p.filter((t) => t.id !== task.id));
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

  return {
    tasks: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    addTask: (input: AddTaskInput) => add.mutate(input),
    toggleTask: (task: Task) => toggle.mutate(task),
    renameTask: (id: string, title: string) => rename.mutate({ id, title }),
    deleteTask: (task: Task) => remove.mutate(task),
    moveTaskToGroup: (id: string, groupId: string | null) => move.mutate({ id, groupId }),
  };
}
