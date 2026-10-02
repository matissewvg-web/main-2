import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, NotebookPen, Trash2, CalendarDays, MapPin, Check, Loader2, Printer } from 'lucide-react';
import { api } from '../api';
import { useData, useToast } from '../store';
import { cx, fmtDate, stripHtml, todayStr } from '../util';
import { Empty, MultiPicker, PageHeader, ProjectSelect, TagPicker, Avatar, confirmDialog } from '../components/ui';
import RichEditor from '../components/RichEditor';
import TaskRow from '../components/TaskRow';

const FIELDS = ['title', 'date', 'location', 'content', 'attendee_users', 'attendee_contacts', 'project_id', 'tags'];

function MeetingEditor({ meeting, openTask, go }) {
  const { users, contacts, tasks, maps } = useData();
  const toast = useToast();
  const [m, setM] = useState(meeting);
  const [state, setState] = useState('saved'); // saved | dirty | saving
  const pending = useRef(null);
  const timer = useRef(null);

  // Take in changes from colleagues, unless we have unsaved edits ourselves.
  useEffect(() => {
    if (state === 'saved') setM(meeting);
  }, [meeting]); // eslint-disable-line react-hooks/exhaustive-deps

  const flush = async () => {
    clearTimeout(timer.current);
    const patch = pending.current;
    if (!patch) return;
    pending.current = null;
    setState('saving');
    try {
      await api.patch(`/meetings/${meeting.id}`, patch);
      setState(pending.current ? 'dirty' : 'saved');
    } catch (e) {
      toast(`Opslaan mislukt: ${e.message}`, 'error');
      pending.current = { ...patch, ...pending.current };
      setState('dirty');
    }
  };

  useEffect(() => () => { flush(); }, []); // save when switching meeting / leaving the page

  const set = (k) => (v) => {
    const value = v?.target ? v.target.value : v;
    setM((x) => ({ ...x, [k]: value }));
    pending.current = { ...pending.current, [k]: value };
    setState('dirty');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
  };

  const remove = async () => {
    if (!(await confirmDialog(`Vergadering "${m.title}" verwijderen?`))) return;
    pending.current = null;
    await api.del(`/meetings/${meeting.id}`).catch((e) => toast(e.message, 'error'));
    go('meetings');
  };

  const meetingTasks = tasks.filter((t) => t.meeting_id === meeting.id);

  const print = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const people = [...(m.attendee_users || []).map((id) => maps.users[id]?.name), ...(m.attendee_contacts || []).map((id) => maps.contacts[id]?.name)].filter(Boolean);
    w.document.write(`<html><head><title>${m.title}</title><style>body{font-family:Segoe UI,Arial,sans-serif;max-width:760px;margin:40px auto;line-height:1.5}h1{margin-bottom:4px}.meta{color:#555;margin-bottom:24px}</style></head><body><h1>${m.title}</h1><div class="meta">${fmtDate(m.date)}${m.location ? ' · ' + m.location : ''}${people.length ? '<br>Aanwezig: ' + people.join(', ') : ''}</div>${m.content || ''}</body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <div className="meeting-editor">
      <div className="row gap-s">
        <input className="title-input" value={m.title} onChange={set('title')} placeholder="Titel van de vergadering" />
        <span className={cx('save-state', state)}>
          {state === 'saving' ? <><Loader2 size={13} className="spin" /> Opslaan…</> : state === 'dirty' ? 'Niet opgeslagen' : <><Check size={13} /> Opgeslagen</>}
        </span>
        <button className="icon-btn" title="Afdrukken / PDF" onClick={print}><Printer size={16} /></button>
        <button className="icon-btn danger" title="Verwijderen" onClick={remove}><Trash2 size={16} /></button>
      </div>
      <div className="meeting-meta">
        <label className="row gap-xs"><CalendarDays size={15} /><input type="date" value={m.date || ''} onChange={set('date')} /></label>
        <label className="row gap-xs"><MapPin size={15} /><input value={m.location || ''} onChange={set('location')} placeholder="Locatie / Teams" /></label>
        <ProjectSelect value={m.project_id} onChange={set('project_id')} />
        <div className="meeting-people">
          <MultiPicker
            options={users.filter((u) => u.active || (m.attendee_users || []).includes(u.id)).map((u) => ({ id: u.id, label: u.name, color: u.color }))}
            value={m.attendee_users || []}
            onChange={set('attendee_users')}
            placeholder="Team aanwezig"
            renderChip={(o) => <Avatar key={o.id} user={maps.users[o.id]} size={20} />}
          />
          <MultiPicker
            options={contacts.map((c) => ({ id: c.id, label: c.name + (c.company && c.kind === 'persoon' ? ` (${c.company})` : '') }))}
            value={m.attendee_contacts || []}
            onChange={set('attendee_contacts')}
            placeholder="Externe contacten"
          />
        </div>
        <div className="meeting-tags"><TagPicker value={m.tags || []} onChange={set('tags')} /></div>
      </div>
      <RichEditor
        key={meeting.id}
        value={m.content}
        onChange={set('content')}
        placeholder="Agenda, besproken punten, besluiten… Selecteer een regel en klik op 'Maak taak' voor actiepunten."
        onMakeTask={(text) => openTask({ title: text.slice(0, 200), meeting_id: meeting.id, project_id: m.project_id })}
      />
      <div className="card">
        <div className="row card-title"><strong>Actiepunten uit deze vergadering</strong><span className="grow" /><button className="btn btn-sm" onClick={() => openTask({ meeting_id: meeting.id, project_id: m.project_id })}><Plus size={14} /> Taak</button></div>
        {meetingTasks.length ? meetingTasks.map((t) => <TaskRow key={t.id} task={t} onOpen={openTask} />) : <p className="muted small">Nog geen actiepunten.</p>}
      </div>
    </div>
  );
}

export default function Meetings({ params, go, openTask }) {
  const { meetings, maps } = useData();
  const toast = useToast();
  const [q, setQ] = useState('');
  const selectedId = params?.id;
  const creating = useRef(false);

  const create = async (extra = {}) => {
    if (creating.current) return;
    creating.current = true;
    try {
      const m = await api.post('/meetings', { title: 'Nieuwe vergadering', date: todayStr(), ...extra });
      go('meetings', { id: m.id });
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      creating.current = false;
    }
  };

  useEffect(() => {
    if (params?.new) create(params.project_id ? { project_id: params.project_id } : {});
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => meetings.filter((m) => !q || `${m.title} ${stripHtml(m.content)}`.toLowerCase().includes(q.toLowerCase())), [meetings, q]);
  const selected = meetings.find((m) => m.id === selectedId);

  return (
    <div className="page page-split">
      <PageHeader title="Vergaderingen" subtitle="Notities, besluiten en actiepunten">
        <button className="btn btn-primary" onClick={() => create()}><Plus size={16} /> Nieuwe vergadering</button>
      </PageHeader>
      {!meetings.length ? (
        <Empty icon={NotebookPen} title="Nog geen vergaderingen" text="Leg vast wat er besproken is en maak direct taken van actiepunten." action={<button className="btn btn-primary" onClick={() => create()}><Plus size={16} /> Nieuwe vergadering</button>} />
      ) : (
        <div className="split">
          <div className="split-list card">
            <div className="search-input"><Search size={15} /><input placeholder="Zoek in titels en notities…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <div className="split-items">
              {list.map((m) => (
                <button key={m.id} className={cx('meeting-item', m.id === selectedId && 'active')} onClick={() => go('meetings', { id: m.id })}>
                  <div className="row gap-s"><strong className="grow ellipsis">{m.title}</strong><span className="muted small">{fmtDate(m.date)}</span></div>
                  <span className="muted small ellipsis block">{maps.projects[m.project_id]?.name || stripHtml(m.content).slice(0, 80) || 'Geen notities'}</span>
                </button>
              ))}
              {!list.length && <p className="muted small pad">Niets gevonden.</p>}
            </div>
          </div>
          <div className="split-detail">
            {selected
              ? <MeetingEditor key={selected.id} meeting={selected} openTask={openTask} go={go} />
              : <Empty icon={NotebookPen} title="Kies een vergadering" text="Of maak een nieuwe aan." />}
          </div>
        </div>
      )}
    </div>
  );
}
