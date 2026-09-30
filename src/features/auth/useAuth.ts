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
    // 재익명 확보 중복 방지 가드 (SIGNED_OUT과 초기 로드가 겹치지 않게)
    let ensuring = false;

    async function ensureAnonymous() {
      if (ensuring) return;
      ensuring = true;
      try {
        const { data: anon, error: signInError } = await supabase.auth.signInAnonymously();
        if (signInError) throw signInError;
        if (mounted && anon.session) setSession(anon.session);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : '로그인에 실패했습니다.');
      } finally {
        ensuring = false;
      }
    }

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          await ensureAnonymous();
        } else if (mounted) {
          setSession(data.session);
        }
        if (mounted) setLoading(false);
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : '로그인에 실패했습니다.');
          setLoading(false);
        }
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (!mounted) return;
      setSession(next);
      // 로그아웃되면 막다른 화면 대신 새 익명 세션을 자동으로 확보한다.
      if (event === 'SIGNED_OUT' && !next) void ensureAnonymous();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, loading, error };
}
