import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Placeholder } from '@tiptap/extension-placeholder';
import {
  Bold, Italic, Underline, Strikethrough, Heading1, Heading2, List, ListOrdered, ListChecks,
  Quote, Link2, Undo2, Redo2, ListPlus, Minus,
} from 'lucide-react';
import { cx } from '../util';

function Btn({ on, onClick, title, children, disabled }) {
  return (
    <button
      type="button"
      className={cx('tb-btn', on && 'on')}
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/**
 * Notion-style text editor. `onChange` receives HTML. `onMakeTask` (optional)
 * turns the selected text into a task.
 */
export default function RichEditor({ value, onChange, placeholder = 'Begin met typen…', onMakeTask, autofocus }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    autofocus: autofocus ? 'end' : false,
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor }) => onChange?.(editor.isEmpty ? '' : editor.getHTML()),
  });

  // Replace content when a different document is loaded or a colleague saved.
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    if ((value || '') !== (editor.isEmpty ? '' : editor.getHTML())) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value, editor]);

  const [linkDraft, setLinkDraft] = useState(null);

  if (!editor) return null;
  const c = () => editor.chain().focus();

  const setLink = () => setLinkDraft(editor.getAttributes('link').href || '');
  const applyLink = () => {
    const url = (linkDraft || '').trim();
    if (!url) c().extendMarkRange('link').unsetLink().run();
    else c().extendMarkRange('link').setLink({ href: /^(https?:|mailto:)/.test(url) ? url : `https://${url}` }).run();
    setLinkDraft(null);
  };

  const makeTask = () => {
    const { from, to } = editor.state.selection;
    let text = editor.state.doc.textBetween(from, to, ' ').trim();
    if (!text) {
      // No selection: use the current line/paragraph.
      text = editor.state.selection.$from.parent.textContent.trim();
    }
    if (text) onMakeTask(text);
  };

  return (
    <div className="rich">
      <div className="toolbar">
        <Btn title="Kop 1" on={editor.isActive('heading', { level: 1 })} onClick={() => c().toggleHeading({ level: 1 }).run()}><Heading1 size={16} /></Btn>
        <Btn title="Kop 2" on={editor.isActive('heading', { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()}><Heading2 size={16} /></Btn>
        <span className="tb-sep" />
        <Btn title="Vet (Ctrl+B)" on={editor.isActive('bold')} onClick={() => c().toggleBold().run()}><Bold size={16} /></Btn>
        <Btn title="Cursief (Ctrl+I)" on={editor.isActive('italic')} onClick={() => c().toggleItalic().run()}><Italic size={16} /></Btn>
        <Btn title="Onderstrepen (Ctrl+U)" on={editor.isActive('underline')} onClick={() => c().toggleUnderline().run()}><Underline size={16} /></Btn>
        <Btn title="Doorhalen" on={editor.isActive('strike')} onClick={() => c().toggleStrike().run()}><Strikethrough size={16} /></Btn>
        <span className="tb-sep" />
        <Btn title="Opsomming" on={editor.isActive('bulletList')} onClick={() => c().toggleBulletList().run()}><List size={16} /></Btn>
        <Btn title="Genummerde lijst" on={editor.isActive('orderedList')} onClick={() => c().toggleOrderedList().run()}><ListOrdered size={16} /></Btn>
        <Btn title="Checklist" on={editor.isActive('taskList')} onClick={() => c().toggleTaskList().run()}><ListChecks size={16} /></Btn>
        <Btn title="Citaat" on={editor.isActive('blockquote')} onClick={() => c().toggleBlockquote().run()}><Quote size={16} /></Btn>
        <Btn title="Scheidingslijn" onClick={() => c().setHorizontalRule().run()}><Minus size={16} /></Btn>
        <Btn title="Link" on={editor.isActive('link')} onClick={setLink}><Link2 size={16} /></Btn>
        <span className="tb-sep" />
        <Btn title="Ongedaan maken (Ctrl+Z)" disabled={!editor.can().undo()} onClick={() => c().undo().run()}><Undo2 size={16} /></Btn>
        <Btn title="Opnieuw (Ctrl+Y)" disabled={!editor.can().redo()} onClick={() => c().redo().run()}><Redo2 size={16} /></Btn>
        {onMakeTask && (
          <>
            <span className="tb-grow" />
            <button type="button" className="btn btn-sm" onMouseDown={(e) => e.preventDefault()} onClick={makeTask} title="Maak een taak van de geselecteerde tekst of huidige regel">
              <ListPlus size={14} /> Maak taak
            </button>
          </>
        )}
      </div>
      {linkDraft !== null && (
        <div className="link-bar">
          <input
            autoFocus
            placeholder="https://… (leeg = link verwijderen)"
            value={linkDraft}
            onChange={(e) => setLinkDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
              if (e.key === 'Escape') setLinkDraft(null);
            }}
          />
          <button type="button" className="btn btn-sm btn-primary" onClick={applyLink}>Opslaan</button>
          <button type="button" className="btn btn-sm" onClick={() => setLinkDraft(null)}>Annuleren</button>
        </div>
      )}
      <EditorContent editor={editor} className="rich-content" />
    </div>
  );
}
