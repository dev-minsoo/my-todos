import { useEditor, EditorContent, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import './memoEditor.css';

const PLACEHOLDER = '마크다운으로 자유롭게 적어 보세요. # 제목, - 목록, [ ] 체크, **굵게** 모두 바로 서식이 돼요.';

/**
 * 메모 인라인 WYSIWYG 에디터(TipTap v3). 적는 즉시 서식이 적용되고(작성/미리보기 분리 없음),
 * 상단 툴바 버튼은 커서 위치의 활성 서식을 하이라이트로 보여 준다. 저장은 마크다운 문자열로 라운드트립.
 * 번들이 커서 MemoPage에서 lazy로 코드 분할한다.
 *
 * initialContent는 마운트 시 한 번만 읽는다(전역 단일 문서 → 외부에서 바뀔 일 없음).
 */
export default function MemoEditor({
  initialContent,
  onChange,
}: {
  initialContent: string;
  onChange: (markdown: string) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow' },
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: PLACEHOLDER }),
      Markdown.configure({ html: false, transformPastedText: true, transformCopiedText: true }),
    ],
    content: initialContent,
    editorProps: {
      attributes: { class: 'memo-prose' },
    },
    // 생성 시 content 주입은 update를 발생시키지 않으므로, 하이드레이션으로 저장이 트리거되지 않는다.
    onUpdate: ({ editor }) => {
      // tiptap-markdown이 editor.storage.markdown에 getMarkdown을 붙인다(타입 보강이 안 잡혀 수동 캐스트).
      const storage = editor.storage as { markdown?: { getMarkdown: () => string } };
      const markdown = storage.markdown?.getMarkdown();
      if (markdown !== undefined) onChange(markdown);
    },
  });

  return (
    <div className="flex h-full flex-col">
      {editor && <Toolbar editor={editor} />}
      <div className="min-h-0 flex-1 cursor-text overflow-y-auto px-5 py-4">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
}

/** 상단 서식 툴바. 커서 위치의 활성 서식에 따라 버튼이 하이라이트된다. */
function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      strike: editor.isActive('strike'),
      code: editor.isActive('code'),
      h1: editor.isActive('heading', { level: 1 }),
      h2: editor.isActive('heading', { level: 2 }),
      bullet: editor.isActive('bulletList'),
      ordered: editor.isActive('orderedList'),
      task: editor.isActive('taskList'),
      quote: editor.isActive('blockquote'),
      link: editor.isActive('link'),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('링크 URL', prev ?? 'https://');
    if (url === null) return; // 취소
    const chain = editor.chain().focus().extendMarkRange('link');
    if (url === '') chain.unsetLink().run();
    else chain.setLink({ href: url }).run();
  };

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto border-b border-border px-2 py-1.5">
      <Btn label="굵게 (⌘B)" active={s.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="size-4" />
      </Btn>
      <Btn label="기울임 (⌘I)" active={s.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="size-4" />
      </Btn>
      <Btn
        label="취소선 (⌘⇧S)"
        active={s.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="size-4" />
      </Btn>
      <Btn label="인라인 코드 (⌘E)" active={s.code} onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code className="size-4" />
      </Btn>

      <Sep />

      <Btn
        label="제목 1 (⌘⌥1)"
        active={s.h1}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="size-4" />
      </Btn>
      <Btn
        label="제목 2 (⌘⌥2)"
        active={s.h2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="size-4" />
      </Btn>

      <Sep />

      <Btn
        label="글머리 목록 (⌘⇧8)"
        active={s.bullet}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-4" />
      </Btn>
      <Btn
        label="번호 목록 (⌘⇧7)"
        active={s.ordered}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-4" />
      </Btn>
      <Btn
        label="체크리스트 (⌘⇧9)"
        active={s.task}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        <ListChecks className="size-4" />
      </Btn>

      <Sep />

      <Btn
        label="인용 (⌘⇧B)"
        active={s.quote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="size-4" />
      </Btn>
      <Btn label="링크" active={s.link} onClick={setLink}>
        <LinkIcon className="size-4" />
      </Btn>

      <Sep />

      <Btn label="실행 취소 (⌘Z)" disabled={!s.canUndo} onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 className="size-4" />
      </Btn>
      <Btn
        label="다시 실행 (⌘⇧Z)"
        disabled={!s.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 className="size-4" />
      </Btn>
    </div>
  );
}

function Btn({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      // 버튼을 눌러도 에디터의 현재 선택을 잃지 않도록 mousedown 기본동작을 막는다.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-md transition',
        active ? 'bg-accentSoft text-accent' : 'text-muted hover:bg-surface2 hover:text-text',
        disabled && 'pointer-events-none opacity-40'
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />;
}
