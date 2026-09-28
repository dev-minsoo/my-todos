import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Space } from '@/db/types';
import { toSpace, type SpaceRow } from '@/db/mappers';
import { useUserId } from '@/features/auth/authContext';
import { nextSpacePosition } from './spaceSelection';

/** 최초 실행 시 시드되는 기본 공간 (SPEC §5) */
const DEFAULT_SPACES = [
  { name: '개인', color: '#2f6df6', position: '0000000001' },
  { name: '회사', color: '#e0663b', position: '0000000002' },
];

/** 새 공간에 돌아가며 부여할 색 */
const PALETTE = ['#2f6df6', '#e0663b', '#2fa36b', '#a855f7', '#d9a441', '#e05a8a'];

const spacesKey = (userId: string) => ['spaces', userId] as const;

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

  const add = useMutation({
    mutationFn: async (name: string) => {
      const current = qc.getQueryData<Space[]>(key) ?? [];
      const { data, error } = await supabase
        .from('spaces')
        .insert({
          user_id: userId,
          name,
          color: PALETTE[current.length % PALETTE.length],
          position: nextSpacePosition(current),
        })
        .select('*')
        .single();
      if (error) throw error;
      return toSpace(data as SpaceRow);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : '공간을 추가하지 못했습니다.'),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  return {
    spaces: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    addSpace: (name: string) => add.mutate(name),
  };
}
