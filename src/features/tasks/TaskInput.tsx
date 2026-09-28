import { useState } from 'react';

export function TaskInput() {
  const [value, setValue] = useState('');

  function submit() {
    const title = value.trim();
    if (!title) return;
    // TODO(v0.1): useTasks().add({ title, dueDate: viewedDate, spaceId })로 등록 + 낙관적 업데이트.
    //   (v0.2) parseDate로 "내일/금" 인식 후 dueDate 보정.
    setValue('');
  }

  return (
    <div className="border-t border-border bg-surface px-3 py-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        placeholder="+ 할 일 추가…"
        aria-label="할 일 추가"
        className="w-full rounded-lg bg-bg px-3 py-2.5 text-sm outline-none placeholder:text-muted"
      />
    </div>
  );
}
