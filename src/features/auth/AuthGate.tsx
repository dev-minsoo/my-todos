import type { ReactNode } from 'react';
import { useAuth } from './useAuth';
import { AuthContext } from './authContext';

/** 세션이 확보되면 children을 렌더. 로딩/설정 안내 화면 담당. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading, error } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted">불러오는 중…</div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-lg font-semibold">연결이 필요합니다</p>
        <p className="text-sm text-muted">{error}</p>
        <p className="text-xs text-muted">
          자세한 설정은 <code>.env.example</code>과 <code>SPEC.md</code>를 참고하세요.
        </p>
      </div>
    );
  }

  if (!session) {
    // 로그아웃 직후 새 익명 세션을 확보하는 짧은 과도기 — 막다른 문구 대신 로딩 표시.
    return (
      <div className="flex h-full items-center justify-center text-muted">불러오는 중…</div>
    );
  }

  return <AuthContext.Provider value={session}>{children}</AuthContext.Provider>;
}
