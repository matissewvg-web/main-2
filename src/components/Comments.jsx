import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Send, Trash2, MessageSquare } from 'lucide-react';
import { api } from '../api';
import { useData, useToast } from '../store';
import { timeAgo } from '../util';
import { Avatar } from './ui';

// Renders "@naam" mentions highlighted. React escapes the rest of the text.
function Body({ text, users }) {
  const names = users.flatMap((u) => [u.username, u.name.split(' ')[0]]).filter(Boolean);
  if (!names.length) return text;
  const alt = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const split = new RegExp(`(@(?:${alt})\\b)`, 'gi');
  const isMention = new RegExp(`^@(?:${alt})$`, 'i');
  return text.split(split).map((part, i) => (isMention.test(part) ? <span key={i} className="mention">{part}</span> : part));
}

/** Discussion thread under a task, project, document, meeting, brainstorm or contact. */
export default function Comments({ entity, id }) {
  const { users, maps, me, commentsVersion } = useData();
  const toast = useToast();
  const [list, setList] = useState(null);
  const [text, setText] = useState('');
  const [suggest, setSuggest] = useState(null);
  const ref = useRef(null);
  const caret = useRef(null);

  // Put the cursor right after an inserted @mention before the next keystroke arrives.
  useLayoutEffect(() => {
    if (caret.current != null && ref.current) {
      ref.current.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  }, [text]);

  useEffect(() => {
    if (!id) return;
    api.get(`/comments?entity=${entity}&entity_id=${id}`).then(setList).catch(() => setList([]));
  }, [entity, id, commentsVersion]);

  const onChange = (e) => {
    const v = e.target.value;
    setText(v);
    const m = /@(\w*)$/.exec(v.slice(0, e.target.selectionStart));
    setSuggest(m ? users.filter((u) => u.active && u.id !== me.id && (u.name.toLowerCase().startsWith(m[1].toLowerCase()) || u.username.toLowerCase().startsWith(m[1].toLowerCase()))) : null);
  };
  const insertMention = (u) => {
    const el = ref.current;
    const pos = el.selectionStart;
    const before = text.slice(0, pos).replace(/@(\w*)$/, `@${u.name.split(' ')[0]} `);
    caret.current = before.length;
    setText(before + text.slice(pos));
    setSuggest(null);
    el.focus();
  };

  const send = async () => {
    if (!text.trim()) return;
    try {
      await api.post('/comments', { entity, entity_id: id, body: text.trim() });
      setText('');
      setSuggest(null);
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const remove = (c) => api.del(`/comments/${c.id}`).catch((e) => toast(e.message, 'error'));

  if (!id) return null;
  return (
    <div className="comments">
      <div className="row gap-s card-title"><MessageSquare size={15} /><strong>Reacties</strong>{list?.length > 0 && <span className="count">{list.length}</span>}</div>
      {list?.map((c) => (
        <div key={c.id} className="comment">
          <Avatar user={maps.users[c.created_by]} size={26} />
          <div className="grow">
            <div className="row gap-s"><strong className="small">{maps.users[c.created_by]?.name || 'Onbekend'}</strong><span className="muted small">{timeAgo(c.created_at)}</span><span className="grow" />
              {(c.created_by === me.id || me.role === 'admin') && <button className="icon-btn ghost" title="Verwijderen" onClick={() => remove(c)}><Trash2 size={13} /></button>}
            </div>
            <div className="comment-body"><Body text={c.body} users={users} /></div>
          </div>
        </div>
      ))}
      <div className="comment-new">
        <Avatar user={me} size={26} />
        <div className="grow comment-input">
          <textarea
            ref={ref}
            rows={2}
            value={text}
            onChange={onChange}
            placeholder="Schrijf een reactie… Gebruik @naam om iemand te noemen. Ctrl+Enter = versturen"
            onKeyDown={(e) => {
              if (suggest?.length && (e.key === 'Enter' || e.key === 'Tab')) { e.preventDefault(); insertMention(suggest[0]); return; }
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
              if (e.key === 'Escape') setSuggest(null);
            }}
          />
          {suggest?.length > 0 && (
            <div className="mention-pop">
              {suggest.slice(0, 5).map((u) => <button type="button" key={u.id} onMouseDown={(e) => { e.preventDefault(); insertMention(u); }}><Avatar user={u} size={18} /> {u.name}</button>)}
            </div>
          )}
        </div>
        <button className="btn btn-primary btn-sm" disabled={!text.trim()} onClick={send}><Send size={14} /></button>
      </div>
    </div>
  );
}
