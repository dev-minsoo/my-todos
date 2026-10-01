import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useUserId } from '@/features/auth/authContext';

const noteKey = (userId: string) => ['note', userId] as const;

const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** 전역 단일 노트의 본문을 읽어 온다. 아직 없으면 빈 문자열. */
async function fetchNote(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('notes')
    .select('content')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.content ?? '';
}

/**
 * 메모 탭의 전역 단일 마크다운 문서(유저당 1행).
 * - 조회: notes 테이블의 한 행 content.
 * - 저장: upsert(onConflict: user_id) — 처음이면 insert, 이후엔 update.
 *   디바운스·충돌 방지는 호출부(MemoPage)가 맡고, 여기선 "쓰면 저장"만 책임진다.
 */
export function useNote() {
  const userId = useUserId();
  const qc = useQueryClient();

  const query = useQuery({ queryKey: noteKey(userId), queryFn: () => fetchNote(userId) });

  const save = useMutation<void, unknown, string>({
    mutationFn: async (content) => {
      const { error } = await supabase
        .from('notes')
        .upsert({ user_id: userId, content }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    // 저장 성공은 조용히(자동 저장이라 매번 토스트를 띄우지 않는다). 실패만 알린다.
    onError: (e) => toast.error(errMsg(e, '메모를 저장하지 못했습니다.')),
    onSuccess: (_d, content) => {
      // 서버 재조회 없이 캐시를 방금 저장한 값으로 맞춰 둔다(깜빡임 방지).
      qc.setQueryData(noteKey(userId), content);
    },
  });

  return {
    content: query.data ?? '',
    isLoading: query.isLoading,
    isSaving: save.isPending,
    // save.mutate는 react-query가 참조를 고정해 준다 → 디바운스/플러시 effect 의존성으로 안전.
    saveNote: save.mutate,
  };
}
