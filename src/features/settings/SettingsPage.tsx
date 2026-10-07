import { Monitor, Moon, Sun } from 'lucide-react';
import { useUiStore, type Theme } from '@/store/uiStore';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
import { AccountSection } from '@/features/settings/AccountSection';
import { BackupSection } from '@/features/settings/BackupSection';

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Monitor }[] = [
  { value: 'system', label: '시스템', icon: Monitor },
  { value: 'light', label: '라이트', icon: Sun },
  { value: 'dark', label: '다크', icon: Moon },
];

const TRIAGE_OPTIONS: { value: boolean; label: string }[] = [
  { value: true, label: '켜기' },
  { value: false, label: '끄기' },
];

export function SettingsPage() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const triageEnabled = useUiStore((s) => s.morningTriageEnabled);
  const setTriageEnabled = useUiStore((s) => s.setMorningTriageEnabled);

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="설정" />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto w-full max-w-xl space-y-4">
          <AccountSection />
          <BackupSection />

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <h2 className="text-sm font-medium">테마</h2>
            <p className="mt-0.5 text-xs text-muted">화면 밝기 모드를 고르세요.</p>
            <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-xl bg-surface2 p-1">
              {THEME_OPTIONS.map((opt) => {
                const active = theme === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setTheme(opt.value)}
                    aria-pressed={active}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-lg px-2 py-3 text-sm transition',
                      active ? 'bg-surface font-medium text-text shadow-soft' : 'text-muted hover:text-text'
                    )}
                  >
                    <opt.icon className="size-5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <h2 className="text-sm font-medium">아침 정리</h2>
            <p className="mt-0.5 text-xs text-muted">
              앱을 열 때 넘어온 일이 있으면 하루 한 번 정리 화면을 띄워요.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-xl bg-surface2 p-1">
              {TRIAGE_OPTIONS.map((opt) => {
                const active = triageEnabled === opt.value;
                return (
                  <button
                    key={String(opt.value)}
                    onClick={() => setTriageEnabled(opt.value)}
                    aria-pressed={active}
                    className={cn(
                      'rounded-lg px-2 py-2 text-sm transition',
                      active ? 'bg-surface font-medium text-text shadow-soft' : 'text-muted hover:text-text'
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <h2 className="text-sm font-medium">언어</h2>
            <p className="mt-0.5 text-xs text-muted">지금은 한국어만 지원해요.</p>
            <div className="mt-3 inline-flex items-center rounded-lg bg-surface2 px-3 py-1.5 text-sm font-medium">
              한국어
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
