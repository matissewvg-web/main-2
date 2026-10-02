import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, CheckSquare, FolderKanban, User, NotebookPen, Folder, Plus, LayoutDashboard, Settings, File as FileIcon } from 'lucide-react';
import { api } from '../api';
import { useData } from '../store';
import { cx, fileKind, fmtDate, PROJECT_STATUS, TASK_STATUS } from '../util';

const KIND = {
  task: { icon: CheckSquare, label: 'Taak' },
  project: { icon: FolderKanban, label: 'Project' },
  contact: { icon: User, label: 'Contact' },
  meeting: { icon: NotebookPen, label: 'Vergadering' },
  folder: { icon: Folder, label: 'Map' },
  file: { icon: FileIcon, label: 'Bestand' },
};

export default function CommandPalette({ onClose, go, openTask }) {
  const { maps } = useData();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [sel, setSel] = useState(0);
  const listRef = useRef(null);

  const actions = useMemo(() => [
    { label: 'Nieuwe taak', icon: Plus, run: () => openTask({}) },
    { label: 'Nieuw project', icon: Plus, run: () => go('projects', { new: true }) },
    { label: 'Nieuw contact', icon: Plus, run: () => go('contacts', { new: true }) },
    { label: 'Nieuwe vergadering', icon: Plus, run: () => go('meetings', { new: true }) },
    { label: 'Ga naar Vandaag', icon: LayoutDashboard, run: () => go('dashboard') },
    { label: 'Ga naar Taken', icon: CheckSquare, run: () => go('tasks') },
    { label: 'Ga naar Projecten', icon: FolderKanban, run: () => go('projects') },
    { label: 'Ga naar Contacten', icon: User, run: () => go('contacts') },
    { label: 'Ga naar Vergaderingen', icon: NotebookPen, run: () => go('meetings') },
    { label: 'Ga naar Bestanden', icon: Folder, run: () => go('files') },
    { label: 'Instellingen', icon: Settings, run: () => go('settings') },
  ], [go, openTask]);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(() => api.get(`/search?q=${encodeURIComponent(q.trim())}`).then(setResults).catch(() => {}), 150);
    return () => clearTimeout(t);
  }, [q]);

  const items = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const acts = actions.filter((a) => !ql || a.label.toLowerCase().includes(ql)).map((a) => ({ ...a, kind: 'action' }));
    const describe = (r) => {
      if (r.kind === 'task') return [TASK_STATUS[r.status]?.label, r.deadline && `deadline ${fmtDate(r.deadline)}`].filter(Boolean).join(' · ');
      if (r.kind === 'project') return PROJECT_STATUS[r.status]?.label;
      if (r.kind === 'meeting') return [r.date && fmtDate(r.date), r.snippet].filter(Boolean).join(' · ');
      return r.sub;
    };
    return [...results.map((r) => ({ ...r, sub: describe(r) })), ...acts];
  }, [results, actions, q]);

  useEffect(() => setSel(0), [items.length]);
  useEffect(() => {
    listRef.current?.querySelector('.cmd-item.sel')?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  const run = (item) => {
    onClose();
    if (item.kind === 'action') return item.run();
    if (item.kind === 'task') return openTask(maps.tasks[item.id] || { id: item.id });
    if (item.kind === 'project') return go('projects', { id: item.id });
    if (item.kind === 'contact') return go('contacts', { id: item.id });
    if (item.kind === 'meeting') return go('meetings', { id: item.id });
    if (item.kind === 'folder') return go('files', { path: item.path });
    if (item.kind === 'file') return go('files', { path: item.parent, highlight: item.title });
  };

  const onKey = (e) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter' && items[sel]) { e.preventDefault(); run(items[sel]); }
  };

  return (
    <div className="modal-backdrop cmd-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cmd">
        <div className="cmd-input">
          <Search size={18} />
          <input autoFocus placeholder="Zoek taken, projecten, contacten, notities, bestanden…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} />
          <kbd>Esc</kbd>
        </div>
        <div className="cmd-list" ref={listRef}>
          {items.map((it, i) => {
            const meta = KIND[it.kind];
            const Icon = it.kind === 'action' ? it.icon : meta.icon;
            const color = it.kind === 'file' ? fileKind(it.ext).color : undefined;
            return (
              <button key={`${it.kind}-${it.id ?? it.path ?? it.label}`} className={cx('cmd-item', i === sel && 'sel')} onMouseEnter={() => setSel(i)} onClick={() => run(it)}>
                <Icon size={16} style={{ color }} />
                <span className="grow ellipsis">
                  {it.kind === 'action' ? it.label : it.title}
                  {it.sub && <span className="muted small"> · {it.sub}</span>}
                </span>
                <span className="muted small">{it.kind === 'action' ? 'Actie' : meta.label}</span>
              </button>
            );
          })}
          {q && !items.length && <div className="list-empty">Niets gevonden voor “{q}”.</div>}
        </div>
      </div>
    </div>
  );
}
