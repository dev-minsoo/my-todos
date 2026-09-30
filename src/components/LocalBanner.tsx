/** 루프백에서만 참. 배포 주소(vercel.app 등)는 배너를 띄우지 않는다. */
export function isLocalHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

/** localhost에서 개발 중일 때만 보이는 상단 띠. */
export function LocalBanner() {
  if (typeof window === 'undefined' || !isLocalHost(window.location.hostname)) return null;

  return (
    <div
      role="status"
      className="flex shrink-0 items-center justify-center gap-2.5 bg-amber-400 px-3 py-2 text-amber-950"
    >
      <span className="rounded-md bg-amber-950 px-2 py-0.5 text-[11px] font-bold tracking-[0.14em] text-amber-200">
        LOCAL
      </span>
      <span className="text-sm font-semibold">{window.location.host}</span>
    </div>
  );
}
