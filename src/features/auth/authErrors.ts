/**
 * Supabase 인증 에러를 사용자용 한국어 메시지로 매핑하는 순수 함수.
 * (인증 SDK 호출 자체는 순수하지 않으니, 테스트는 이 매핑만 대상으로 한다.)
 */
export function authErrorMessage(e: unknown): string {
  const msg = extractMessage(e);
  const raw = msg.toLowerCase();

  if (!raw) return '문제가 생겼어요. 잠시 후 다시 시도해 주세요.';

  if (
    raw.includes('already registered') ||
    raw.includes('already been registered') ||
    raw.includes('already in use') ||
    raw.includes('already exists') ||
    raw.includes('identity is already linked')
  ) {
    return '이미 가입된 이메일이에요. 로그인해 주세요.';
  }
  if (
    raw.includes('weak password') ||
    raw.includes('at least 6') ||
    raw.includes('should be at least') ||
    raw.includes('password should')
  ) {
    return '비밀번호는 6자 이상이어야 해요.';
  }
  if (raw.includes('invalid login credentials') || raw.includes('invalid credentials')) {
    return '이메일 또는 비밀번호가 맞지 않아요.';
  }
  if (raw.includes('email not confirmed') || raw.includes('not confirmed')) {
    return '이메일 확인이 아직 안 됐어요. 받은 메일의 링크를 눌러 주세요.';
  }
  if (
    raw.includes('unable to validate email') ||
    raw.includes('invalid email') ||
    raw.includes('valid email')
  ) {
    return '이메일 형식이 올바르지 않아요.';
  }
  if (
    raw.includes('rate limit') ||
    raw.includes('too many') ||
    raw.includes('for security purposes')
  ) {
    return '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.';
  }
  if (raw.includes('network') || raw.includes('failed to fetch')) {
    return '네트워크 연결을 확인해 주세요.';
  }

  return '문제가 생겼어요. 잠시 후 다시 시도해 주세요.';
}

/** 에러 객체/문자열에서 메시지 문자열을 최대한 안전하게 뽑아낸다. */
function extractMessage(e: unknown): string {
  if (e == null) return '';
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;
  if (typeof e === 'object') {
    const obj = e as { message?: unknown; error_description?: unknown };
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error_description === 'string') return obj.error_description;
  }
  return '';
}
