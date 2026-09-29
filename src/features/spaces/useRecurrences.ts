import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Recurrence, RecurrenceRule } from '@/db/types';
import { toRecurrence, type RecurrenceRow } from '@/db/mappers';
import { useUserId } from '@/features/auth/authContext';
import { maxValidPosition, positionAfter } from '@/domain/order';

const recurrencesKey = (userId: string) => ['recurrences', userId] as const;

function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

async function fetchRecurrences(): Promise<Recurrence[]> {
  // RLS가 본인 행만 반환. 살아있는 것만.
  const { data, error } = await supabase.from('recurrences').select('*').is('deleted_at', null);
  if (error) throw error;
  return ((data ?? []) as RecurrenceRow[]).map(toRecurrence);
}

export type AddRecurrenceInput = {
  spaceId: string;
  groupId?: string | null;
  title: string;
  rule: RecurrenceRule;
  startDate: string;
};

type AddVars = AddRecurrenceInput & { position: string };
type Ctx = { prev?: Recurrence[] };

export function useRecurrences() {
  const userId = useUserId();
  const qc = useQueryClient();
  const key = recurrencesKey(userId);

  const query = useQuery({ queryKey: key, queryFn: fetchRecurrences });

  const current = () => qc.getQueryData<Recurrence[]>(key) ?? [];
  const patch = (updater: (prev: Recurrence[]) => Recurrence[]) =>
    qc.setQueryData<Recurrence[]>(key, (prev) => updater(prev ?? []));
  const snapshot = async (): Promise<Ctx> => {
    await qc.cancelQueries({ queryKey: key });
    return { prev: qc.getQueryData<Recurrence[]>(key) };
  };
  const rollback = (e: unknown, ctx: Ctx | undefined, fallback: string) => {
    if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    toast.error(errMsg(e, fallback));
  };
  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  // 순서: 살아있는 반복 전체의 맨 끝 다음 키(fractional index). v1엔 재정렬 UI 없음.
  const nextPosition = (): string =>
    positionAfter(maxValidPosition(current().map((r) => r.position)));

  // 낙관적 add — 생성 즉시 그 날짜에 가상 발생분이 떠야 하므로(가상분은 이 캐시에서 계산).
  const add = useMutation<Recurrence, unknown, AddVars, Ctx>({
    mutationFn: async ({ spaceId, groupId, title, rule, startDate, position }) => {
      const { data, error } = await supabase
        .from('recurrences')
        .insert({
          user_id: userId,
          space_id: spaceId,
          group_id: groupId ?? null,
          title,
          rule,
          start_date: startDate,
          position,
        })
        .select('*')
        .single();
      if (error) throw error;
      return toRecurrence(data as RecurrenceRow);
    },
    onMutate: async ({ spaceId, groupId, title, rule, startDate, position }) => {
      const ctx = await snapshot();
      const now = new Date().toISOString();
      const optimistic: Recurrence = {
        id: `temp-${crypto.randomUUID()}`,
        userId,
        spaceId,
        groupId: groupId ?? null,
        title,
        rule,
        startDate,
        position,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      patch((prev) => [...prev, optimistic]);
      return ctx;
    },
    onError: (e, _v, ctx) => rollback(e, ctx, '반복을 추가하지 못했습니다.'),
    onSettled: invalidate,
  });

  // 제목·규칙 수정 (습관은 "매일 같은 것"이므로 시리즈 전체를 고친다 — 인스턴스별 분기 없음).
  const update = useMutation<
    void,
    unknown,
    { id: string; title?: string; rule?: RecurrenceRule },
    Ctx
  >({
    mutationFn: async ({ id, title, rule }) => {
      const fields: Record<string, unknown> = {};
      if (title !== undefined) fields.title = title;
      if (rule !== undefined) fields.rule = rule;
      const { error } = await supabase.from('recurrences').update(fields).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, title, rule }) => {
      const ctx = await snapshot();
      patch((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, ...(title !== undefined ? { title } : {}), ...(rule !== undefined ? { rule } : {}) }
            : r
        )
      );
      return ctx;
    },
    onError: (e, _v, ctx) => rollback(e, ctx, '반복을 수정하지 못했습니다.'),
    onSettled: invalidate,
  });

  const restore = useMutation<void, unknown, string>({
    mutationFn: async (id) => {
      const { error } = await supabase.from('recurrences').update({ deleted_at: null }).eq('id', id);
      if (error) throw error;
    },
    onSettled: invalidate,
  });

  const remove = useMutation<void, unknown, Recurrence, Ctx>({
    mutationFn: async (rec) => {
      const { error } = await supabase
        .from('recurrences')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', rec.id);
      if (error) throw error;
    },
    onMutate: async (rec) => {
      const ctx = await snapshot();
      patch((prev) => prev.filter((r) => r.id !== rec.id));
      return ctx;
    },
    onError: (e, _v, ctx) => rollback(e, ctx, '반복을 중단하지 못했습니다.'),
    onSuccess: (_d, rec) => {
      // 규칙만 중단 — 이미 실체화된 지난 할 일은 기록에 그대로 남는다.
      toast('반복을 중단했어요', {
        description: rec.title,
        action: { label: '실행 취소', onClick: () => restore.mutate(rec.id) },
      });
    },
    onSettled: invalidate,
  });

  return {
    recurrences: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    addRecurrence: (input: AddRecurrenceInput) =>
      add.mutate({ ...input, position: nextPosition() }),
    updateRecurrence: (input: { id: string; title?: string; rule?: RecurrenceRule }) =>
      update.mutate(input),
    removeRecurrence: (rec: Recurrence) => remove.mutate(rec),
  };
}
