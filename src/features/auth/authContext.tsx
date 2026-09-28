import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';

/** AuthGate가 세션 확보 후 children에 주입한다. children 안에서는 항상 non-null. */
export const AuthContext = createContext<Session | null>(null);

export function useSession(): Session | null {
  return useContext(AuthContext);
}

/** 현재 로그인한 유저 id. AuthGate 내부에서는 항상 존재한다. */
export function useUserId(): string {
  const session = useContext(AuthContext);
  if (!session) throw new Error('useUserId는 AuthGate 내부에서만 사용할 수 있습니다.');
  return session.user.id;
}
