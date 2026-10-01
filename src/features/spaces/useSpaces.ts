import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Space } from '@/db/types';
import { toSpace, type SpaceRow } from '@/db/mappers';
import { useUserId } from '@/features/auth/authContext';
import { SPACE_PALETTE, nextSpacePosition, positionAt } from './spaceSelection';

/** 최초 실행 시 시드되는 기본 공간 (SPEC §5) */
const DEFAULT_SPACES = [
  { name: '개인', color: '#2f6df6', position: '0000000001' },
  { name: '회사', color: '#e0663b', position: '0000000002' },
];

const spacesKey = (userId: string) => ['spaces', userId] as const;

function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

function bySortablePosition(a: Space, b: Space): number {
  return a.position < b.position ? -1 : a.position > b.position ? 1 : 0;
}

async function fetchSpaces(userId: string): Promise<Space[]> {
  const { data, error } = await supabase
    .from('spaces')
    .select('*')
    .is('deleted_at', null)
    .order('position', { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as SpaceRow[];
  if (rows.length > 0) return rows.map(toSpace);

  // 최초 실행: 기본 공간 시드 후 반환
  const seed = DEFAULT_SPACES.map((s) => ({ ...s, user_id: userId }));
  const { data: inserted, error: seedErr } = await supabase.from('spaces').insert(seed).select('*');
  if (seedErr) throw seedErr;
  return ((inserted ?? []) as SpaceRow[]).map(toSpace);
}

export function useSpaces() {
  const userId = useUserId();
  const qc = useQueryClient();
  const key = spacesKey(userId);

  const query = useQuery({ queryKey: key, queryFn: () => fetchSpaces(userId) });

  type Ctx = { prev?: Space[] };
  const current = () => qc.getQueryData<Space[]>(key) ?? [];
  const patch = (updater: (prev: Space[]) => Space[]) =>
    qc.setQueryData<Space[]>(key, (prev) => updater(prev ?? []));
  const snapshot = async (): Promise<Ctx> => {
    await qc.cancelQueries({ queryKey: key });
    return { prev: qc.getQueryData<Space[]>(key) };
  };
  const rollback = (e: unknown, ctx: Ctx | undefined, fallback: string) => {
    if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    toast.error(errMsg(e, fallback));
  };
  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const add = useMutation<Space, unknown, { name: string; color?: string }, Ctx>({
    mutationFn: async ({ name, color }) => {
      const list = current();
      const { data, error } = await supabase
        .from('spaces')
        .insert({
          user_id: userId,
          name,
          color: color ?? SPACE_PALETTE[list.length % SPACE_PALETTE.length],
          position: nextSpacePosition(list),
        })
        .select('*')
        .single();
      if (error) throw error;
      return toSpace(data as SpaceRow);
    },
    onError: (e) => toast.error(errMsg(e, '공간을 추가하지 못했습니다.')),
    onSettled: invalidate,
  });

  const update = useMutation<void, unknown, { id: string; name?: string; color?: string }, Ctx>({
    mutationFn: async ({ id, name, color }) => {
      const payload: Record<string, string> = {};
      if (name !== undefined) payload.name = name;
      if (color !== undefined) payload.color = color;
      if (Object.keys(payload).length === 0) return;
      const { error } = await supabase.from('spaces').update(payload).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, name, color }) => {
      const ctx = await snapshot();
      patch((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, ...(name !== undefined ? { name } : {}), ...(color !== undefined ? { color } : {}) }
            : s
        )
      );
      return ctx;
    },
    onError: (e, _v, ctx) => rollback(e, ctx, '공간을 수정하지 못했습니다.'),
    onSettled: invalidate,
  });

  const restore = useMutation<void, unknown, string>({
    mutationFn: async (id) => {
      const { error } = await supabase.from('spaces').update({ deleted_at: null }).eq('id', id);
      if (error) throw error;
    },
    onSettled: invalidate,
  });

  const remove = useMutation<void, unknown, Space, Ctx>({
    mutationFn: async (space) => {
      const { error } = await supabase
        .from('spaces')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', space.id);
      if (error) throw error;
    },
    onMutate: async (space) => {
      const ctx = await snapshot();
      patch((prev) => prev.filter((s) => s.id !== space.id));
      return ctx;
    },
    onError: (e, _v, ctx) => rollback(e, ctx, '공간을 삭제하지 못했습니다.'),
    onSuccess: (_d, space) => {
      toast('공간을 삭제했어요', {
        description: space.name,
        action: { label: '실행 취소', onClick: () => restore.mutate(space.id) },
      });
    },
    onSettled: invalidate,
  });

  const reorder = useMutation<void, unknown, string[], Ctx>({
    mutationFn: async (orderedIds) => {
      // 새 순서대로 position을 1..n으로 확정 기록.
      // (캐시는 onMutate에서 이미 낙관적으로 바뀌므로 diff를 캐시로 계산하면 안 된다 — 항상 순서대로 쓴다.)
      for (let i = 0; i < orderedIds.length; i++) {
        const { error } = await supabase
          .from('spaces')
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
          .map((s) => (posOf.has(s.id) ? { ...s, position: posOf.get(s.id)! } : s))
          .slice()
          .sort(bySortablePosition)
      );
      return ctx;
    },
    onError: (e, _v, ctx) => rollback(e, ctx, '순서를 바꾸지 못했습니다.'),
    onSettled: invalidate,
  });

  return {
    spaces: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    addSpace: (input: { name: string; color?: string }) => add.mutate(input),
    updateSpace: (input: { id: string; name?: string; color?: string }) => update.mutate(input),
    deleteSpace: (space: Space) => remove.mutate(space),
    reorderSpaces: (orderedIds: string[]) => reorder.mutate(orderedIds),
  };
}
