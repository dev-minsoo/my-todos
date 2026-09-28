import { useEffect, useRef, useState } from 'react';
import { Monitor, Moon, Settings, Sun } from 'lucide-react';
import { useUiStore, type Theme } from '@/store/uiStore';
import { cn } from '@/lib/utils';

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Monitor }[] = [
  { value: 'system', label: '시스템', icon: Monitor },
  { value: 'light', label: '라이트', icon: Sun },
  { value: 'dark', label: '다크', icon: Moon },
];

export function SettingsMenu() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 바깥 클릭·Escape로 닫기 (모달 없음 — 가벼운 팝오버)
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative border-t border-border px-3 py-3">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition',
          open ? 'bg-surface2 text-text' : 'text-muted hover:bg-surface2 hover:text-text'
        )}
      >
        <Settings className="size-4 shrink-0" />
        <span>설정</span>
      </button>

      {open && (
        <div className="absolute inset-x-3 bottom-full mb-2 rounded-xl border border-border bg-surface p-3 shadow-card">
          <p className="px-1 pb-2 text-xs font-medium uppercase tracking-wide text-muted">테마</p>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface2 p-1">
            {THEME_OPTIONS.map((opt) => {
              const active = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  aria-pressed={active}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-md px-2 py-2 text-xs transition',
                    active
                      ? 'bg-surface font-medium text-text shadow-soft'
                      : 'text-muted hover:text-text'
                  )}
                >
                  <opt.icon className="size-4" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
