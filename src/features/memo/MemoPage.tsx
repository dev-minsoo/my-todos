import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useNote } from './useNote';

// WYSIWYG 에디터(TipTap)는 번들이 커서 코드 분할 — 메모 탭에 들어올 때만 로드.
const MemoEditor = lazy(() => import('./MemoEditor'));

/** 입력이 멈추고 이 시간(ms) 뒤 자동 저장한다. */
const AUTOSAVE_MS = 600;

export function MemoPage() {
  const { content, isLoading, isSaving, saveNote } = useNote();

  const [dirty, setDirty] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const pending = useRef<string | null>(null);

  // 대기 중인 저장을 즉시 흘려보낸다(탭 떠날 때 마지막 <600ms 입력 손실 방지).
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (pending.current !== null) {
      saveNote(pending.current);
      pending.current = null;
      setDirty(false);
    }
  }, [saveNote]);

  useEffect(() => () => flush(), [flush]);

  // 에디터가 바뀔 때마다 디바운스 타이머를 리셋한다. 저장은 사용자가 실제로 고칠 때만 일어난다
  // (초기 content 주입은 onUpdate를 발생시키지 않음 → 빈 값 덮어쓰기 없음).
  const handleChange = useCallback(
    (markdown: string) => {
      pending.current = markdown;
      setDirty(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (pending.current !== null) {
          saveNote(pending.current);
          pending.current = null;
          setDirty(false);
        }
      }, AUTOSAVE_MS);
    },
    [saveNote]
  );

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="메모"
        description="할 일과 상관없이 자유롭게 적는 공간이에요. 적으면 바로 서식이 적용되고 자동 저장돼요."
      />

      <div className="min-h-0 flex-1 overflow-hidden px-4 py-5 md:px-8 md:py-6">
        <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
          <div className="mb-3 flex items-center justify-end">
            <SaveStatus isSaving={isSaving} dirty={dirty} />
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-surface shadow-card focus-within:border-accent">
            {isLoading ? (
              <p className="py-10 text-center text-sm text-muted">불러오는 중…</p>
            ) : (
              <Suspense
                fallback={<p className="py-10 text-center text-sm text-muted">에디터 준비 중…</p>}
              >
                <MemoEditor initialContent={content} onChange={handleChange} />
              </Suspense>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SaveStatus({ isSaving, dirty }: { isSaving: boolean; dirty: boolean }) {
  if (isSaving) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted">
        <Loader2 className="size-3.5 animate-spin" />
        저장 중…
      </span>
    );
  }
  if (dirty) {
    return <span className="text-xs text-muted">곧 저장돼요…</span>;
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      <Check className="size-3.5 text-accent" />
      저장됨
    </span>
  );
}
