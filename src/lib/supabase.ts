import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** .env.local이 채워졌는지 여부. AuthGate에서 안내에 사용 */
export const isSupabaseConfigured = Boolean(url && anonKey);

// 환경변수가 없어도 앱이 죽지 않도록 더미 값으로 생성한다(AuthGate가 안내 화면 표시).
export const supabase = createClient(url || 'http://localhost:54321', anonKey || 'public-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
