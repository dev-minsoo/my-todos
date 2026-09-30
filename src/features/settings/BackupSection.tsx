import { useRef } from 'react';
import { Download, Upload, Loader2, DatabaseBackup } from 'lucide-react';
import { useBackup } from '@/features/settings/useBackup';

const CARD = 'rounded-2xl border border-border bg-surface p-5 shadow-card';
const PRIMARY_BTN =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accentFg transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';
const GHOST_BTN =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text transition hover:bg-surface2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';

/**
 * 설정 안의 백업 섹션. 내 데이터를 JSON 파일로 내보내고 다시 가져온다(수동 안전망).
 * 가져오기는 기존 데이터를 지우지 않고 "추가"한다(비파괴) → 확인창 없음(프로젝트 원칙: 모달 없음).
 */
export function BackupSection() {
  const { exporting, importing, exportBackup, importBackup } = useBackup();
  const fileRef = useRef<HTMLInputElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 다시 고를 수 있게 리셋
    if (file) void importBackup(file);
  }

  return (
    <section className={CARD}>
      <div className="flex items-center gap-2">
        <DatabaseBackup className="size-4 text-accent" />
        <h2 className="text-sm font-medium">백업</h2>
      </div>
      <p className="mt-0.5 text-xs text-muted">
        내 데이터(공간·할 일·그룹·반복)를 파일로 내려받아 보관하고, 언제든 다시 불러올 수 있어요.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => exportBackup()} disabled={exporting} className={PRIMARY_BTN}>
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          내보내기
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className={GHOST_BTN}
        >
          {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          가져오기
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={onPick}
          className="hidden"
        />
      </div>

      <p className="mt-2 text-xs text-muted">
        가져오기는 기존 데이터를 지우지 않고 <span className="font-medium text-text">추가</span>합니다.
      </p>
    </section>
  );
}
