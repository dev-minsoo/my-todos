import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type AuthState = {
  session: Session | null;
  loading: boolean;
  error: string | null;
};

/**
 * v0.1: 첫 로드 시 익명 로그인으로 세션을 확보한다.
 * v0.2에서 이메일 계정으로 승격(anonymous → permanent) 예정.
 */
export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError('Supabase 환경변수가 없습니다. .env.example을 .env.local로 복사해 값을 채우세요.');
      setLoading(false);
      return;
    }

    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        let current = data.session;
        if (!current) {
          const { data: anon, error: signInError } = await supabase.auth.signInAnonymously();
          if (signInError) throw signInError;
          current = anon.session;
        }
        if (mounted) {
          setSession(current);
          setLoading(false);
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : '로그인에 실패했습니다.');
          setLoading(false);
        }
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (mounted) setSession(next);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, loading, error };
}
