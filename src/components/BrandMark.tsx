import { cn } from '@/lib/utils';

/**
 * My Todos 브랜드 마크 — lucide `face-slightly-smiling` 아이콘(ISC, 자유 사용).
 * 설치된 lucide-react(0.451.0)에는 이 아이콘이 없어 공식 SVG를 그대로 인라인한다.
 * 색은 currentColor(= accent 사각형 위의 accentFg)를 따른다.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-5', className)}
      aria-hidden
    >
      <path d="M15 10V9" />
      <path d="M16.472 15a6 6 0 01-8.943 0" />
      <path d="M9 10V9" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}
