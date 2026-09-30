import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { authErrorMessage } from './authErrors';

type ActionState = { loading: boolean; error: string | null };

/**
 * 계정 액션(승격/로그인/로그아웃)을 supabase.auth + 쿼리 캐시와 묶어 제공한다.
 * 세션 자체의 유지·재익명 확보는 useAuth가 담당(SIGNED_OUT → 새 익명 세션).
 */
export function useAuthActions() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<ActionState>({ loading: false, error: null });

  async function run(fn: () => Promise<void>): Promise<boolean> {
    setState({ loading: true, error: null });
    try {
      await fn();
      setState({ loading: false, error: null });
      return true;
    } catch (e) {
      setState({ loading: false, error: authErrorMessage(e) });
      return false;
    }
  }

  return {
    loading: state.loading,
    error: state.error,
    clearError: () => setState((s) => ({ ...s, error: null })),

    /**
     * 익명 계정에 이메일+비밀번호를 붙여 영속화(승격).
     * 이메일 확인 ON이면 확인 메일이 발송되고, 링크 클릭 전까지는 아직 익명이다.
     */
    register: (email: string, password: string) =>
      run(async () => {
        const { error } = await supabase.auth.updateUser(
          { email, password },
          { emailRedirectTo: window.location.origin }
        );
        if (error) throw error;
      }),

    /** 등록한 이메일로 로그인해 데이터를 복구. 현재(익명) 세션을 새 세션으로 스왑한다. */
    login: (email: string, password: string) =>
      run(async () => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // 유저가 바뀌었으니 이전(익명) 유저의 캐시를 비운다.
        queryClient.clear();
      }),

    /** 로그아웃. useAuth가 SIGNED_OUT을 받아 새 익명 세션을 자동으로 확보한다. */
    logout: () =>
      run(async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        queryClient.clear();
      }),
  };
}
