import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../api';
import { useData, useToast } from '../store';
import { TASK_STATUSES, timeAgo, localDateStr } from '../util';
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
  ...defaults,
});

export default function TaskModal({ task, onClose }) {
  const { maps } = useData();
  const toast = useToast();
  const [t, setT] = useState(() => ({ ...emptyTask(), ...task }));
  const [busy, setBusy] = useState(false);
  const isNew = !t.id;
  const set = (k) => (v) => setT((x) => ({ ...x, [k]: v?.target ? v.target.value : v }));

  const save = async () => {
    if (!t.title.trim()) return toast('Geef de taak een titel.', 'error');
    setBusy(true);
    try {
      const body = {
        title: t.title, description: t.description, status: t.status, priority: t.priority,
        assignees: t.assignees || [], project_id: t.project_id, contact_id: t.contact_id,
        meeting_id: t.meeting_id, deadline: t.deadline || null, tags: t.tags,
      };
      if (isNew) await api.post('/tasks', body);
      else await api.patch(`/tasks/${t.id}`, body);
      toast(isNew ? 'Taak aangemaakt' : 'Taak opgeslagen', 'ok');
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
          <textarea rows={5} value={t.description || ''} onChange={set('description')} placeholder="Details, links, afspraken…" />
        </Field>
        {!isNew && (
          <p className="muted small field-span">
            Aangemaakt door {maps.users[t.created_by]?.name || 'onbekend'} · {timeAgo(t.created_at)}
            {t.meeting_id && maps.meetings[t.meeting_id] && <> · uit vergadering “{maps.meetings[t.meeting_id].title}”</>}
            {t.done_at && <> · afgerond {timeAgo(t.done_at)}</>}
          </p>
        )}
      </div>
    </Modal>
  );
}
