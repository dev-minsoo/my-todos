import { ArrowLeft } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';

/** 설정·휴지통 같은 하위 페이지 상단 헤더. 뒤로 가면 하루 화면으로 돌아간다. */
export function PageHeader({ title, description }: { title: string; description?: string }) {
  const setView = useUiStore((s) => s.setView);
  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-4 md:px-8">
      <button
        onClick={() => setView('day')}
        aria-label="뒤로"
        className="-ml-1 grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface2 hover:text-text"
      >
        <ArrowLeft className="size-5" />
      </button>
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-xs text-muted">{description}</p>}
      </div>
    </div>
  );
}
