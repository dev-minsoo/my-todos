import { describe, it, expect } from 'vitest';
import { authErrorMessage } from './authErrors';

describe('authErrorMessage', () => {
  it('이미 가입된 이메일', () => {
    expect(authErrorMessage(new Error('User already registered'))).toContain('이미 가입');
    expect(authErrorMessage({ message: 'Email address already in use' })).toContain('이미 가입');
  });

  it('약한 비밀번호', () => {
    expect(authErrorMessage(new Error('Password should be at least 6 characters'))).toContain(
      '6자 이상'
    );
  });

  it('로그인 자격 불일치', () => {
    expect(authErrorMessage(new Error('Invalid login credentials'))).toContain('맞지 않아요');
  });

  it('이메일 미확인', () => {
    expect(authErrorMessage(new Error('Email not confirmed'))).toContain('확인');
  });

  it('잘못된 이메일 형식', () => {
    expect(authErrorMessage(new Error('Unable to validate email address: invalid format'))).toContain(
      '이메일 형식'
    );
  });

  it('요청 과다', () => {
    expect(authErrorMessage(new Error('email rate limit exceeded'))).toContain('잦아요');
  });

  it('문자열 에러도 처리', () => {
    expect(authErrorMessage('Invalid login credentials')).toContain('맞지 않아요');
  });

  it('알 수 없는/빈 에러는 일반 안내', () => {
    expect(authErrorMessage(null)).toContain('다시 시도');
    expect(authErrorMessage({})).toContain('다시 시도');
    expect(authErrorMessage(new Error('some unexpected internal thing'))).toContain('다시 시도');
  });
});
