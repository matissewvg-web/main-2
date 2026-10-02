import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, X, AlertTriangle, UserPlus, AtSign, MessageSquare } from 'lucide-react';
import { api, desktop } from '../api';
import { useData } from '../store';
import { daysUntil, fmtDate, timeAgo } from '../util';
import { Avatar } from './ui';

const KIND_ICON = { toegewezen: UserPlus, genoemd: AtSign, reactie: MessageSquare };

export function openEntity(entity, id, { go, openTask, maps }) {
  if (entity === 'tasks') return openTask(maps.tasks[id] || { id });
  if (entity === 'projects') return go('projects', { id });
  if (entity === 'documents') return go('files', { tab: 'docs', doc: id });
  if (entity === 'brainstorms') return go('brainstorm', { id });
  if (entity === 'meetings') return go('meetings', { id });
  if (entity === 'contacts') return go('contacts', { id });
}

/** Bell with unread count; also shows your own overdue/today deadlines. */
export default function NotificationBell({ go, openTask }) {
  const { notifications, setNotifications, maps, tasks, documents, me } = useData();
  const [open, setOpen] = useState(false);
  const seen = useRef(null);
  const unread = notifications.filter((n) => !n.read);

  // Pop up a Windows notification for new items while the app is in the background.
  useEffect(() => {
    const maxId = notifications.reduce((m, n) => Math.max(m, n.id), 0);
    if (seen.current !== null && maxId > seen.current && document.hidden && 'Notification' in window) {
      const fresh = notifications.filter((n) => n.id > seen.current && !n.read);
      for (const n of fresh.slice(0, 3)) {
        try { new Notification('The Break 5', { body: n.title, silent: false }); } catch {}
      }
    }
    seen.current = maxId;
  }, [notifications]);

  const due = [
    ...tasks.filter((t) => t.status !== 'klaar' && t.deadline && (t.assignees || []).includes(me.id) && daysUntil(t.deadline) <= 0)
      .map((t) => ({ key: 't' + t.id, label: t.title, date: t.deadline, open: () => openTask(t) })),
    ...documents.filter((d) => d.status !== 'definitief' && d.deadline && (d.assignees || []).includes(me.id) && daysUntil(d.deadline) <= 0)
      .map((d) => ({ key: 'd' + d.id, label: d.title, date: d.deadline, open: () => go('files', { tab: 'docs', doc: d.id }) })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const markAll = () => {
    setNotifications((list) => list.map((n) => ({ ...n, read: 1 })));
    api.post('/notifications/read', {}).catch(() => {});
  };
  const click = (n) => {
    setOpen(false);
    if (!n.read) {
      setNotifications((list) => list.map((x) => (x.id === n.id ? { ...x, read: 1 } : x)));
      api.post('/notifications/read', { ids: [n.id] }).catch(() => {});
    }
    openEntity(n.entity, n.entity_id, { go, openTask, maps });
  };

  const count = unread.length + due.length;
  return (
    <>
      <div className="bell-wrap">
        <button className="icon-btn" title="Meldingen" onClick={() => setOpen(!open)}><Bell size={18} /></button>
        {count > 0 && <span className="bell-badge">{count > 99 ? '99+' : count}</span>}
      </div>
      {open && (
        <>
          <div className="modal-backdrop" style={{ background: 'transparent' }} onMouseDown={() => setOpen(false)} />
          <div className="notif-panel">
            <div className="notif-head">
              <Bell size={16} /><strong className="grow">Meldingen</strong>
              {unread.length > 0 && <button className="btn btn-sm" onClick={markAll}><CheckCheck size={14} /> Alles gelezen</button>}
              <button className="icon-btn" onClick={() => setOpen(false)}><X size={16} /></button>
            </div>
            <div className="notif-list">
              {due.length > 0 && <div className="notif-section">Deadline vandaag of te laat</div>}
              {due.map((d) => (
                <button key={d.key} className="notif unread" onClick={() => { setOpen(false); d.open(); }}>
                  <AlertTriangle size={16} className="neg" />
                  <span className="grow"><strong>{d.label}</strong><span className="muted small block">{daysUntil(d.date) < 0 ? `${-daysUntil(d.date)} dagen te laat (${fmtDate(d.date)})` : 'Vandaag'}</span></span>
                </button>
              ))}
              <div className="notif-section">Voor jou</div>
              {notifications.map((n) => {
                const Icon = KIND_ICON[n.kind] || Bell;
                return (
                  <button key={n.id} className={`notif${n.read ? '' : ' unread'}`} onClick={() => click(n)}>
                    {maps.users[n.actor_id] ? <Avatar user={maps.users[n.actor_id]} size={26} /> : <Icon size={16} />}
                    <span className="grow"><span className="small">{n.title}</span><span className="muted small block"><Icon size={11} /> {timeAgo(n.created_at)}</span></span>
                  </button>
                );
              })}
              {!notifications.length && <p className="muted small pad">Nog geen meldingen. Je krijgt er een als iemand je ergens aan toevoegt, je noemt met @naam, of reageert op iets van jou.</p>}
            </div>
          </div>
        </>
      )}
    </>
  );
}
