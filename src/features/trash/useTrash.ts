import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Space, Task } from '@/db/types';
import { toSpace, toTask, type SpaceRow, type TaskRow } from '@/db/mappers';
import { useUserId } from '@/features/auth/authContext';

const trashTasksKey = (userId: string) => ['trash-tasks', userId] as const;
const trashSpacesKey = (userId: string) => ['trash-spaces', userId] as const;
const tasksKey = (userId: string) => ['tasks', userId] as const;
const spacesKey = (userId: string) => ['spaces', userId] as const;

const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

async function fetchDeletedTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as TaskRow[]).map(toTask);
}

async function fetchDeletedSpaces(): Promise<Space[]> {
  const { data, error } = await supabase
    .from('spaces')
    .select('*')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as SpaceRow[]).map(toSpace);
}

/**
 * 휴지통: 소프트 삭제(`deleted_at`)된 할 일·공간을 보고 복구하거나 영구 삭제한다.
 * - 복구: `deleted_at = null` → 살아있는 목록으로 되돌아온다.
 * - 영구 삭제: DB에서 하드 삭제(되돌릴 수 없음). 공간은 `on delete cascade`로 그 공간의 할 일도 함께 지워진다.
 */
export function useTrash(enabled = true) {
  const userId = useUserId();
  const qc = useQueryClient();

  // 휴지통이 열렸을 때만 조회한다 (닫혀 있으면 백그라운드 fetch 없음, 열 때마다 신선하게).
  const tasksQuery = useQuery({ queryKey: trashTasksKey(userId), queryFn: fetchDeletedTasks, enabled });
  const spacesQuery = useQuery({ queryKey: trashSpacesKey(userId), queryFn: fetchDeletedSpaces, enabled });

  // 휴지통 조회 무효화
  const invalidateTasks = () => qc.invalidateQueries({ queryKey: trashTasksKey(userId) });
  const invalidateSpaces = () => qc.invalidateQueries({ queryKey: trashSpacesKey(userId) });
  // 살아있는 목록도 무효화(복구/공간 cascade 반영)
  const invalidateLiveTasks = () => qc.invalidateQueries({ queryKey: tasksKey(userId) });
  const invalidateLiveSpaces = () => qc.invalidateQueries({ queryKey: spacesKey(userId) });

  const restoreTask = useMutation<void, unknown, string>({
    mutationFn: async (id) => {
      const { error } = await supabase.from('tasks').update({ deleted_at: null }).eq('id', id);
      if (error) throw error;
    },
    onError: (e) => toast.error(errMsg(e, '복구하지 못했습니다.')),
    onSuccess: () => toast('할 일을 복구했어요'),
    onSettled: () => {
      invalidateTasks();
      invalidateLiveTasks();
    },
  });

  const purgeTask = useMutation<void, unknown, string>({
    mutationFn: async (id) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onError: (e) => toast.error(errMsg(e, '영구 삭제하지 못했습니다.')),
    onSettled: invalidateTasks,
  });

  const restoreSpace = useMutation<void, unknown, string>({
    mutationFn: async (id) => {
      const { error } = await supabase.from('spaces').update({ deleted_at: null }).eq('id', id);
      if (error) throw error;
    },
    onError: (e) => toast.error(errMsg(e, '복구하지 못했습니다.')),
    onSuccess: () => toast('공간을 복구했어요'),
    onSettled: () => {
      invalidateSpaces();
      invalidateLiveSpaces();
    },
  });

  const purgeSpace = useMutation<void, unknown, string>({
    mutationFn: async (id) => {
      // on delete cascade: 이 공간의 할 일도 DB에서 함께 삭제된다.
      const { error } = await supabase.from('spaces').delete().eq('id', id);
      if (error) throw error;
    },
    onError: (e) => toast.error(errMsg(e, '영구 삭제하지 못했습니다.')),
    onSettled: () => {
      invalidateSpaces();
      invalidateTasks();
      invalidateLiveTasks();
    },
  });

  const empty = useMutation<void, unknown, void>({
    mutationFn: async () => {
      // 공간 먼저: cascade로 딸린 할 일까지 정리된 뒤, 남은 삭제 할 일을 비운다.
      const delSpaces = await supabase.from('spaces').delete().not('deleted_at', 'is', null);
      if (delSpaces.error) throw delSpaces.error;
      const delTasks = await supabase.from('tasks').delete().not('deleted_at', 'is', null);
      if (delTasks.error) throw delTasks.error;
    },
    onError: (e) => toast.error(errMsg(e, '휴지통을 비우지 못했습니다.')),
    onSuccess: () => toast('휴지통을 비웠어요'),
    onSettled: () => {
      invalidateTasks();
      invalidateSpaces();
      invalidateLiveTasks();
      invalidateLiveSpaces();
    },
  });

  const deletedTasks = tasksQuery.data ?? [];
  const deletedSpaces = spacesQuery.data ?? [];

  return {
    deletedTasks,
    deletedSpaces,
    total: deletedTasks.length + deletedSpaces.length,
    isLoading: tasksQuery.isLoading || spacesQuery.isLoading,
    error: tasksQuery.error ?? spacesQuery.error,
    /** 두 조회(할 일·공간)를 함께 다시 불러온다. ErrorState "다시 시도"용. */
    refetch: () => Promise.all([tasksQuery.refetch(), spacesQuery.refetch()]),
    restoreTask: (id: string) => restoreTask.mutate(id),
    purgeTask: (id: string) => purgeTask.mutate(id),
    restoreSpace: (id: string) => restoreSpace.mutate(id),
    purgeSpace: (id: string) => purgeSpace.mutate(id),
    emptyTrash: () => empty.mutate(),
  };
}
