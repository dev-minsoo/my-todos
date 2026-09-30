import { useState } from 'react';
import { toast } from 'sonner';
import { LogOut, Mail, MailCheck, ShieldCheck, Loader2 } from 'lucide-react';
import { useSession } from '@/features/auth/authContext';
import { useAuthActions } from '@/features/auth/useAuthActions';
import { cn } from '@/lib/utils';

const CARD = 'rounded-2xl border border-border bg-surface p-5 shadow-card';
const FIELD =
  'w-full rounded-xl bg-bg px-3 py-2.5 text-sm outline-none ring-1 ring-border transition focus:ring-accent placeholder:text-muted disabled:opacity-50';
const PRIMARY_BTN =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accentFg transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 설정 안의 계정 섹션. 익명이면 계정 만들기(승격)/로그인, 영속 계정이면 이메일 표시+로그아웃.
 * 모달 없이 페이지 안 인라인 폼으로만 조작한다(프로젝트 원칙: 모달 없음).
 */
export function AccountSection() {
  const session = useSession();
  const user = session?.user;
  const isAnon = user?.is_anonymous ?? true;
  const email = user?.email ?? null;

  if (!isAnon && email) return <RegisteredView email={email} />;
  return <AnonView />;
}

function RegisteredView({ email }: { email: string }) {
  const { logout, loading } = useAuthActions();

  return (
    <section className={CARD}>
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-accent" />
        <h2 className="text-sm font-medium">계정</h2>
      </div>
      <p className="mt-0.5 text-xs text-muted">
        이 이메일로 로그인하면 어느 기기에서든 같은 데이터를 볼 수 있어요.
      </p>

      <div className="mt-3 flex items-center gap-2 rounded-xl bg-surface2 px-3 py-2.5 text-sm">
        <Mail className="size-4 shrink-0 text-muted" />
        <span className="min-w-0 flex-1 truncate font-medium">{email}</span>
      </div>

      <button
        type="button"
        onClick={() => logout()}
        disabled={loading}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted transition hover:bg-surface2 hover:text-text disabled:opacity-50"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
        로그아웃
      </button>
      <p className="mt-2 text-xs text-muted">
        로그아웃하면 새 익명 세션으로 시작해요. 다시 로그인하면 데이터가 돌아옵니다.
      </p>
    </section>
  );
}

type Mode = 'register' | 'login';

function AnonView() {
  const { register, login, loading, error, clearError } = useAuthActions();
  const [mode, setMode] = useState<Mode>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);

  const trimmed = email.trim();
  const emailOk = EMAIL_RE.test(trimmed);
  const pwOk = mode === 'login' ? password.length > 0 : password.length >= 6;
  const canSubmit = emailOk && pwOk && !loading;

  function switchMode(next: Mode) {
    setMode(next);
    setPassword('');
    clearError();
  }

  async function submit() {
    if (!canSubmit) return;
    if (mode === 'register') {
      const ok = await register(trimmed, password);
      if (ok) {
        setSentTo(trimmed);
        setPassword('');
      }
    } else {
      const ok = await login(trimmed, password);
      // 성공 시 세션이 스왑되며 이 컴포넌트가 RegisteredView로 다시 그려진다.
      if (ok) toast('로그인했어요. 데이터를 불러옵니다.');
    }
  }

  // 승격 요청 후: 확인 메일 안내(확인 ON이라 링크 클릭 전까지는 아직 익명).
  if (sentTo) {
    return (
      <section className={CARD}>
        <div className="flex items-center gap-2">
          <MailCheck className="size-4 text-accent" />
          <h2 className="text-sm font-medium">확인 메일을 보냈어요</h2>
        </div>
        <p className="mt-2 text-sm">
          <span className="font-medium">{sentTo}</span>로 확인 메일을 보냈어요.
        </p>
        <p className="mt-1 text-xs text-muted">
          메일의 링크를 눌러 등록을 마치면, 다른 기기에서도 이 이메일로 로그인해 같은 데이터를 볼 수
          있어요. (메일이 안 보이면 스팸함도 확인해 주세요.)
        </p>
        <button
          type="button"
          onClick={() => {
            setSentTo(null);
            switchMode('register');
          }}
          className="mt-3 text-xs font-medium text-accent hover:underline"
        >
          다른 이메일로 다시 시도
        </button>
      </section>
    );
  }

  return (
    <section className={CARD}>
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-muted" />
        <h2 className="text-sm font-medium">계정 만들기</h2>
      </div>
      <p className="mt-0.5 text-xs text-muted">
        {mode === 'register'
          ? '지금은 익명이라 이 브라우저에만 데이터가 있어요. 이메일을 등록하면 안전하게 보관되고 다른 기기에서도 볼 수 있어요.'
          : '이미 등록한 이메일로 로그인해 데이터를 되찾으세요.'}
      </p>

      <form
        className="mt-3 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) clearError();
          }}
          placeholder="이메일"
          aria-label="이메일"
          disabled={loading}
          className={FIELD}
        />
        <input
          type="password"
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) clearError();
          }}
          placeholder={mode === 'register' ? '비밀번호 (6자 이상)' : '비밀번호'}
          aria-label="비밀번호"
          disabled={loading}
          className={FIELD}
        />

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button type="submit" disabled={!canSubmit} className={cn(PRIMARY_BTN, 'w-full')}>
          {loading && <Loader2 className="size-4 animate-spin" />}
          {mode === 'register' ? '이메일로 등록' : '로그인'}
        </button>
      </form>

      <div className="mt-3 text-center text-xs text-muted">
        {mode === 'register' ? (
          <>
            이미 계정이 있어요?{' '}
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="font-medium text-accent hover:underline"
            >
              로그인
            </button>
          </>
        ) : (
          <>
            계정이 없어요?{' '}
            <button
              type="button"
              onClick={() => switchMode('register')}
              className="font-medium text-accent hover:underline"
            >
              계정 만들기
            </button>
          </>
        )}
      </div>
    </section>
  );
}
