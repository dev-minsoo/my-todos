import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { useActiveTab } from '@/features/spaces/useActiveTab';
import { targetSpaceId } from '@/features/spaces/spaceSelection';
import { useTasks } from './useTasks';

export function TaskInput() {
  const [value, setValue] = useState('');
  const viewedDate = useUiStore((s) => s.viewedDate);
  const lastSpaceId = useUiStore((s) => s.lastSpaceId);
  const setLastSpaceId = useUiStore((s) => s.setLastSpaceId);

  const { activeTab, spaces } = useActiveTab();
  const { addTask } = useTasks();

  const spaceId = targetSpaceId(activeTab, spaces, lastSpaceId);
  const disabled = !spaceId;

  function submit() {
    const title = value.trim();
    if (!title || !spaceId) return;
    // 지금 보는 날짜·공간에 들어간다. (v0.2) "내일/금" 파싱은 이후 dueDate 보정으로.
    addTask({ title, dueDate: viewedDate, spaceId });
    setLastSpaceId(spaceId);
    setValue('');
  }

  return (
    <div className="border-t border-border p-3">
      <div className="flex items-center gap-2 rounded-xl bg-bg px-3 py-2.5 ring-1 ring-transparent transition focus-within:ring-accent">
        <Plus className="size-4 shrink-0 text-muted" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // 한글 등 IME 조합 중 Enter는 무시 (조합 확정 Enter가 submit을 겹쳐 마지막 글자가 중복되는 문제 방지)
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit();
          }}
          disabled={disabled}
          placeholder={disabled ? '공간을 먼저 만들어 주세요' : '할 일 추가…'}
          aria-label="할 일 추가"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted disabled:opacity-50"
        />
      </div>
    </div>
  );
}
