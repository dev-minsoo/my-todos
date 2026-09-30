import { describe, expect, it } from 'vitest';
import { isLocalHost } from './LocalBanner';

describe('isLocalHost', () => {
  it('루프백이면 로컬', () => {
    expect(isLocalHost('localhost')).toBe(true);
    expect(isLocalHost('127.0.0.1')).toBe(true);
    expect(isLocalHost('::1')).toBe(true);
    expect(isLocalHost('[::1]')).toBe(true);
  });

  it('배포 주소는 로컬이 아님', () => {
    expect(isLocalHost('my-todos-minsoo.vercel.app')).toBe(false);
    expect(isLocalHost('example.com')).toBe(false);
  });
});
