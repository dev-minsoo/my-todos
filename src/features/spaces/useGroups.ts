import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Group } from '@/db/types';
import { toGroup, type GroupRow } from '@/db/mappers';
import { useUserId } from '@/features/auth/authContext';
import { positionAt } from './spaceSelection';

const groupsKey = (userId: string) => ['groups', userId] as const;

function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

function bySortablePosition(a: Group, b: Group): number {
  return a.position < b.position ? -1 : a.position > b.position ? 1 : 0;
}

/** 한 공간 안 그룹들의 다음 position (0-패딩 정수 문자열). 공간별로 독립. */
function nextPosition(groupsInSpace: Group[]): string {
  const max = groupsInSpace.reduce((m, g) => Math.max(m, Number(g.position) || 0), 0);
  return String(max + 1).padStart(10, '0');
}

async function fetchGroups(): Promise<Group[]> {
  // RLS가 본인 행만 반환. 살아있는 것만, position 순.
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .is('deleted_at', null)
    .order('position', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as GroupRow[]).map(toGroup);
}

export function useGroups() {
  const userId = useUserId();
  const qc = useQueryClient();
  const key = groupsKey(userId);

  const query = useQuery({ queryKey: key, queryFn: fetchGroups });

  type Ctx = { prev?: Group[] };
  const current = () => qc.getQueryData<Group[]>(key) ?? [];
  const patch = (updater: (prev: Group[]) => Group[]) =>
    qc.setQueryData<Group[]>(key, (prev) => updater(prev ?? []));
  const snapshot = async (): Promise<Ctx> => {
    await qc.cancelQueries({ queryKey: key });
    return { prev: qc.getQueryData<Group[]>(key) };
  };
  const rollback = (e: unknown, ctx: Ctx | undefined, fallback: string) => {
    if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    toast.error(errMsg(e, fallback));
  };
  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const add = useMutation<Group, unknown, { spaceId: string; name: string }, Ctx>({
    mutationFn: async ({ spaceId, name }) => {
      const inSpace = current().filter((g) => g.spaceId === spaceId);
      const { data, error } = await supabase
        .from('groups')
        .insert({ user_id: userId, space_id: spaceId, name, position: nextPosition(inSpace) })
        .select('*')
        .single();
      if (error) throw error;
      return toGroup(data as GroupRow);
    },
    onError: (e) => toast.error(errMsg(e, '그룹을 추가하지 못했습니다.')),
    onSettled: invalidate,
  });

  const rename = useMutation<void, unknown, { id: string; name: string }, Ctx>({
    mutationFn: async ({ id, name }) => {
      const { error } = await supabase.from('groups').update({ name }).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, name }) => {
      const ctx = await snapshot();
      patch((prev) => prev.map((g) => (g.id === id ? { ...g, name } : g)));
      return ctx;
    },
    onError: (e, _v, ctx) => rollback(e, ctx, '그룹 이름을 바꾸지 못했습니다.'),
    onSettled: invalidate,
  });

  const restore = useMutation<void, unknown, string>({
    mutationFn: async (id) => {
      const { error } = await supabase.from('groups').update({ deleted_at: null }).eq('id', id);
      if (error) throw error;
    },
    onSettled: invalidate,
  });

  const remove = useMutation<void, unknown, Group, Ctx>({
    mutationFn: async (group) => {
      const { error } = await supabase
        .from('groups')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', group.id);
      if (error) throw error;
    },
    onMutate: async (group) => {
      const ctx = await snapshot();
      patch((prev) => prev.filter((g) => g.id !== group.id));
      return ctx;
    },
    onError: (e, _v, ctx) => rollback(e, ctx, '그룹을 삭제하지 못했습니다.'),
    onSuccess: (_d, group) => {
      // 그룹만 삭제 — 그 안의 할 일은 "미분류"로 흘러간다(계산). 복구하면 원래대로.
      toast('그룹을 삭제했어요', {
        description: `${group.name} · 할 일은 미분류로 이동`,
        action: { label: '실행 취소', onClick: () => restore.mutate(group.id) },
      });
    },
    onSettled: invalidate,
  });

  const reorder = useMutation<void, unknown, string[], Ctx>({
    // orderedIds: 한 공간 안 그룹들의 새 순서. position을 1..n으로 확정 기록(공간별 독립이라 충돌 무해).
    mutationFn: async (orderedIds) => {
      for (let i = 0; i < orderedIds.length; i++) {
        const { error } = await supabase
          .from('groups')
          .update({ position: positionAt(i) })
          .eq('id', orderedIds[i]);
        if (error) throw error;
      }
    },
    onMutate: async (orderedIds) => {
      const ctx = await snapshot();
      const posOf = new Map(orderedIds.map((id, i) => [id, positionAt(i)]));
      patch((prev) =>
        prev
          .map((g) => (posOf.has(g.id) ? { ...g, position: posOf.get(g.id)! } : g))
          .slice()
          .sort(bySortablePosition)
      );
      return ctx;
    },
    onError: (e, _v, ctx) => rollback(e, ctx, '그룹 순서를 바꾸지 못했습니다.'),
    onSettled: invalidate,
  });

  return {
    groups: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    addGroup: (input: { spaceId: string; name: string }) => add.mutate(input),
    /** 생성된 그룹을 반환 — "새 그룹으로 이동"처럼 생성 직후 id가 필요할 때 */
    createGroup: (input: { spaceId: string; name: string }) => add.mutateAsync(input),
    renameGroup: (id: string, name: string) => rename.mutate({ id, name }),
    deleteGroup: (group: Group) => remove.mutate(group),
    reorderGroups: (orderedIds: string[]) => reorder.mutate(orderedIds),
  };
}
