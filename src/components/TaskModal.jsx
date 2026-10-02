import { useState } from 'react';
import { Trash2, Plus, X, Repeat, CalendarPlus } from 'lucide-react';
import Comments from './Comments';
import { api } from '../api';
import { useData, useToast } from '../store';
import { TASK_STATUSES, RECURRENCES, fmtDate, localDateStr, parseUtc, timeAgo } from '../util';
import { Modal, Field, PrioritySelect, PeoplePicker, ProjectSelect, ContactSelect, TagPicker, confirmDialog } from './ui';

export const emptyTask = (defaults = {}) => ({
  title: '',
  description: '',
  status: 'todo',
  priority: 'normaal',
  assignees: [],
  project_id: null,
  contact_id: null,
  meeting_id: null,
  deadline: '',
  tags: [],
  checklist: [],
  recurrence: null,
  ...defaults,
});

export default function TaskModal({ task, onClose }) {
  const { maps } = useData();
  const toast = useToast();
  const [t, setT] = useState(() => ({ ...emptyTask(), ...task }));
  const [busy, setBusy] = useState(false);
  const isNew = !t.id;
  const set = (k) => (v) => setT((x) => ({ ...x, [k]: v?.target ? v.target.value : v }));
  const [newItem, setNewItem] = useState('');
  const checklist = t.checklist || [];
  const setChecklist = (list) => setT((x) => ({ ...x, checklist: list }));
  const addItem = () => {
    if (!newItem.trim()) return;
    setChecklist([...checklist, { id: Math.random().toString(36).slice(2, 9), text: newItem.trim(), done: false }]);
    setNewItem('');
  };
  const doneCount = checklist.filter((c) => c.done).length;

  const save = async () => {
    if (!t.title.trim()) return toast('Geef de taak een titel.', 'error');
    setBusy(true);
    try {
      const body = {
        title: t.title, description: t.description, status: t.status, priority: t.priority,
        assignees: t.assignees || [], project_id: t.project_id, contact_id: t.contact_id,
        meeting_id: t.meeting_id, deadline: t.deadline || null, tags: t.tags,
        checklist, recurrence: t.recurrence || null,
      };
      if (body.recurrence && !body.deadline) return toast('Een terugkerende taak heeft een deadline nodig.', 'error') || setBusy(false);
      if (isNew) await api.post('/tasks', body);
      else await api.patch(`/tasks/${t.id}`, body);
      const repeats = t.recurrence && t.status === 'klaar' && task.status !== 'klaar';
      toast(repeats ? 'Klaar! De volgende keer is alvast ingepland.' : isNew ? 'Taak aangemaakt' : 'Taak opgeslagen', 'ok');
      onClose();
    } catch (e) {
      toast(e.message, 'error');
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await confirmDialog(`Taak "${t.title}" verwijderen?`))) return;
    try {
      await api.del(`/tasks/${t.id}`);
      toast('Taak verwijderd');
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const quickDates = [
    ['Vandaag', 0], ['Morgen', 1], ['Over 1 week', 7],
  ];

  return (
    <Modal
      title={isNew ? 'Nieuwe taak' : 'Taak bewerken'}
      onClose={onClose}
      footer={
        <>
          {!isNew && <button className="btn btn-ghost-danger" onClick={remove}><Trash2 size={15} /> Verwijderen</button>}
          <span className="grow" />
          <button className="btn" onClick={onClose}>Annuleren</button>
          <button className="btn btn-primary" disabled={busy} onClick={save}>{isNew ? 'Aanmaken' : 'Opslaan'}</button>
        </>
      }
    >
      <div className="form">
        <Field label="Titel" span>
          <input
            autoFocus
            value={t.title}
            onChange={set('title')}
            placeholder="Wat moet er gebeuren?"
            onKeyDown={(e) => e.key === 'Enter' && (e.ctrlKey || e.metaKey) && save()}
          />
        </Field>
        <Field label="Status">
          <div className="seg">
            {TASK_STATUSES.map((s) => (
              <button type="button" key={s.id} className={`seg-btn${t.status === s.id ? ' on' : ''}`} style={{ '--c': s.color }} onClick={() => set('status')(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Prioriteit">
          <PrioritySelect value={t.priority} onChange={set('priority')} />
        </Field>
        <Field label="Wie doen het?">
          <PeoplePicker value={t.assignees || []} onChange={set('assignees')} />
        </Field>
        <Field label="Deadline">
          <div className="row gap-s wrap">
            <input type="date" className="date-input" value={t.deadline || ''} onChange={set('deadline')} />
            {quickDates.map(([label, n]) => {
              const d = new Date();
              d.setDate(d.getDate() + n);
              return <button type="button" key={label} className="btn btn-sm" onClick={() => set('deadline')(localDateStr(d))}>{label}</button>;
            })}
          </div>
        </Field>
        <Field label="Herhalen" hint={t.recurrence ? 'Als je hem afvinkt, komt de volgende vanzelf terug met nieuwe deadline.' : undefined}>
          <select value={t.recurrence || ''} onChange={(e) => set('recurrence')(e.target.value || null)}>
            <option value="">Niet herhalen</option>
            {RECURRENCES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </Field>
        <Field label="Project">
          <ProjectSelect value={t.project_id} onChange={set('project_id')} />
        </Field>
        <Field label="Contact">
          <ContactSelect value={t.contact_id} onChange={set('contact_id')} />
        </Field>
        <Field label="Tags" span>
          <TagPicker value={t.tags} onChange={set('tags')} />
        </Field>
        <Field label="Omschrijving" span>
          <textarea rows={4} value={t.description || ''} onChange={set('description')} placeholder="Details, links, afspraken…" />
        </Field>
        <div className="field field-span">
          <span className="field-label">Checklist / subtaken {checklist.length > 0 && `· ${doneCount}/${checklist.length}`}</span>
          {checklist.length > 0 && <div className="progress"><div style={{ width: `${(doneCount / checklist.length) * 100}%` }} /></div>}
          {checklist.map((c, i) => (
            <div key={c.id} className="check-item">
              <input type="checkbox" checked={c.done} onChange={() => setChecklist(checklist.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} />
              <input className={`check-text${c.done ? ' strike' : ''}`} value={c.text} onChange={(e) => setChecklist(checklist.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
              <button type="button" className="icon-btn ghost" onClick={() => setChecklist(checklist.filter((_, j) => j !== i))}><X size={14} /></button>
            </div>
          ))}
          <div className="check-item">
            <Plus size={15} className="muted" />
            <input className="check-text" placeholder="Subtaak toevoegen… (Enter)" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }} />
          </div>
        </div>
        {!isNew && (
          <p className="muted small field-span created-line">
            <CalendarPlus size={13} /> Aangemaakt op {fmtDate(localDateStr(parseUtc(t.created_at)))} door {maps.users[t.created_by]?.name || 'onbekend'} ({timeAgo(t.created_at)})
            {t.recurrence && <> · <Repeat size={12} /> {RECURRENCES.find((r) => r.id === t.recurrence)?.label.toLowerCase()}</>}
            {t.meeting_id && maps.meetings[t.meeting_id] && <> · uit vergadering “{maps.meetings[t.meeting_id].title}”</>}
            {t.done_at && <> · afgerond {timeAgo(t.done_at)}</>}
          </p>
        )}
        {!isNew && <div className="field-span"><Comments entity="tasks" id={t.id} /></div>}
      </div>
    </Modal>
  );
}
