import { useEffect, useMemo, useState } from 'react';
import { Plus, FolderKanban, ArrowLeft, Pencil, Trash2, Folder, User, Building2, CalendarDays, NotebookPen } from 'lucide-react';
import { api } from '../api';
import { useData, useToast } from '../store';
import { PROJECT_STATUS, PROJECT_STATUSES, PRIORITY_RANK, cx, fmtDate } from '../util';
import {
  Avatar, ContactSelect, DeadlineBadge, Empty, Field, Modal, PageHeader, PriorityBadge, PrioritySelect,
  StatusBadge, TagChips, TagPicker, UserSelect, confirmDialog,
} from '../components/ui';
import { Kanban, TaskList } from './Tasks';

function Progress({ tasks }) {
  const done = tasks.filter((t) => t.status === 'klaar').length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  return (
    <div className="progress-wrap" title={`${done} van ${tasks.length} taken klaar`}>
      <div className="progress"><div style={{ width: `${pct}%` }} /></div>
      <span className="small muted">{tasks.length ? `${done}/${tasks.length}` : 'Geen taken'}</span>
    </div>
  );
}

function ProjectModal({ project, onClose, onSaved }) {
  const toast = useToast();
  const [p, setP] = useState(() => ({
    name: '', description: '', status: 'actief', priority: 'normaal', owner_id: null, contact_id: null,
    start_date: '', deadline: '', folder: '', tags: [], ...project,
  }));
  const [folders, setFolders] = useState([]);
  const [makeFolder, setMakeFolder] = useState(!project?.id);
  const isNew = !p.id;
  const set = (k) => (v) => setP((x) => ({ ...x, [k]: v?.target ? v.target.value : v }));

  useEffect(() => { api.get('/files/folders').then(setFolders).catch(() => {}); }, []);

  const save = async () => {
    if (!p.name.trim()) return toast('Geef het project een naam.', 'error');
    try {
      let folder = p.folder || null;
      if (isNew && makeFolder && !folder) {
        // Each new project gets its own folder under "Projecten".
        if (!folders.includes('Projecten')) await api.post('/files/folder', { path: '', name: 'Projecten' }).catch(() => {});
        const name = p.name.trim().replace(/[<>:"/\\|?*]/g, '-');
        try {
          folder = (await api.post('/files/folder', { path: 'Projecten', name })).path;
        } catch {
          folder = `Projecten/${name}`; // already exists: link to it
        }
      }
      const body = {
        name: p.name, description: p.description, status: p.status, priority: p.priority, owner_id: p.owner_id,
        contact_id: p.contact_id, start_date: p.start_date || null, deadline: p.deadline || null, folder, tags: p.tags,
      };
      const saved = isNew ? await api.post('/projects', body) : await api.patch(`/projects/${p.id}`, body);
      toast(isNew ? 'Project aangemaakt' : 'Project opgeslagen', 'ok');
      onSaved?.(saved);
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <Modal
      title={isNew ? 'Nieuw project' : 'Project bewerken'}
      onClose={onClose}
      footer={<><span className="grow" /><button className="btn" onClick={onClose}>Annuleren</button><button className="btn btn-primary" onClick={save}>{isNew ? 'Aanmaken' : 'Opslaan'}</button></>}
    >
      <div className="form">
        <Field label="Naam" span><input autoFocus value={p.name} onChange={set('name')} placeholder="Bijv. Nieuwe webshop" /></Field>
        <Field label="Status">
          <select value={p.status} onChange={set('status')}>
            {PROJECT_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Prioriteit"><PrioritySelect value={p.priority} onChange={set('priority')} /></Field>
        <Field label="Eigenaar"><UserSelect value={p.owner_id} onChange={set('owner_id')} /></Field>
        <Field label="Klant / contact"><ContactSelect value={p.contact_id} onChange={set('contact_id')} /></Field>
        <Field label="Startdatum"><input type="date" value={p.start_date || ''} onChange={set('start_date')} /></Field>
        <Field label="Deadline"><input type="date" value={p.deadline || ''} onChange={set('deadline')} /></Field>
        <Field label="Map in Bestanden" span>
          {isNew && !p.folder ? (
            <label className="row gap-xs small">
              <input type="checkbox" checked={makeFolder} onChange={(e) => setMakeFolder(e.target.checked)} />
              Maak automatisch een map aan: Projecten/{p.name || '…'}
            </label>
          ) : null}
          <select value={p.folder || ''} onChange={set('folder')}>
            <option value="">{isNew && makeFolder ? '— of kies een bestaande map —' : 'Geen map gekoppeld'}</option>
            {folders.filter(Boolean).map((f) => <option key={f} value={f}>/{f}</option>)}
          </select>
        </Field>
        <Field label="Tags" span><TagPicker value={p.tags} onChange={set('tags')} /></Field>
        <Field label="Omschrijving" span><textarea rows={4} value={p.description || ''} onChange={set('description')} placeholder="Doel, scope, afspraken…" /></Field>
      </div>
    </Modal>
  );
}

function ProjectCard({ project, onOpen }) {
  const { tasks, maps } = useData();
  const ptasks = tasks.filter((t) => t.project_id === project.id);
  return (
    <button className="pcard" onClick={() => onOpen(project.id)}>
      <div className="row gap-s">
        <StatusBadge status={PROJECT_STATUS[project.status]} />
        <PriorityBadge value={project.priority} />
        <span className="grow" />
        <DeadlineBadge date={project.deadline} done={project.status === 'afgerond'} />
      </div>
      <h3>{project.name}</h3>
      {project.description && <p className="muted clamp-2">{project.description}</p>}
      <TagChips ids={project.tags} />
      <div className="pcard-foot">
        <Progress tasks={ptasks} />
        <Avatar user={maps.users[project.owner_id]} size={24} />
      </div>
    </button>
  );
}

function ProjectDetail({ id, onBack, openTask, go }) {
  const { projects, tasks, meetings, maps } = useData();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [view, setView] = useState('kanban');
  const project = projects.find((p) => p.id === id);
  const ptasks = useMemo(() => tasks.filter((t) => t.project_id === id), [tasks, id]);
  const pmeetings = meetings.filter((m) => m.project_id === id);

  if (!project) return <div className="page"><button className="btn" onClick={onBack}><ArrowLeft size={16} /> Terug</button><p>Project niet gevonden.</p></div>;

  const remove = async () => {
    if (!(await confirmDialog(`Project "${project.name}" verwijderen? Taken blijven bestaan maar zijn dan niet meer gekoppeld. De map in Bestanden blijft staan.`))) return;
    await api.del(`/projects/${id}`).catch((e) => toast(e.message, 'error'));
    onBack();
  };

  const owner = maps.users[project.owner_id];
  const contact = maps.contacts[project.contact_id];

  return (
    <div className="page">
      <button className="btn btn-ghost back" onClick={onBack}><ArrowLeft size={16} /> Projecten</button>
      <PageHeader title={project.name}>
        <button className="btn" onClick={() => setEditing(true)}><Pencil size={15} /> Bewerken</button>
        <button className="icon-btn danger" title="Verwijderen" onClick={remove}><Trash2 size={16} /></button>
      </PageHeader>
      <div className="detail-grid">
        <div className="card meta-card">
          <div className="meta"><span>Status</span><StatusBadge status={PROJECT_STATUS[project.status]} /></div>
          <div className="meta"><span>Prioriteit</span><PriorityBadge value={project.priority} /></div>
          <div className="meta"><span>Eigenaar</span>{owner ? <span className="row gap-xs"><Avatar user={owner} size={20} />{owner.name}</span> : <span className="muted">—</span>}</div>
          <div className="meta"><span>Klant</span>{contact ? <button className="link" onClick={() => go('contacts', { id: contact.id })}>{contact.kind === 'bedrijf' ? <Building2 size={14} /> : <User size={14} />} {contact.name}</button> : <span className="muted">—</span>}</div>
          <div className="meta"><span>Periode</span><span>{project.start_date ? fmtDate(project.start_date) : '—'} → {project.deadline ? <DeadlineBadge date={project.deadline} done={project.status === 'afgerond'} /> : '—'}</span></div>
          <div className="meta"><span>Voortgang</span><Progress tasks={ptasks} /></div>
          <div className="meta"><span>Map</span>{project.folder ? <button className="link" onClick={() => go('files', { path: project.folder })}><Folder size={14} /> /{project.folder}</button> : <span className="muted">Geen</span>}</div>
          <TagChips ids={project.tags} />
          {project.description && <p className="pre-wrap">{project.description}</p>}
        </div>
        <div className="card">
          <div className="row gap-s card-title"><NotebookPen size={16} /><strong>Vergaderingen</strong><span className="grow" /><button className="btn btn-sm" onClick={() => go('meetings', { new: true, project_id: id })}><Plus size={14} /> Nieuw</button></div>
          {pmeetings.length ? pmeetings.map((m) => (
            <button key={m.id} className="list-link" onClick={() => go('meetings', { id: m.id })}>
              <CalendarDays size={14} /> <span className="grow">{m.title}</span> <span className="muted small">{fmtDate(m.date)}</span>
            </button>
          )) : <p className="muted small">Nog geen vergaderingen voor dit project.</p>}
        </div>
      </div>
      <div className="row gap-s section-head">
        <h2>Taken</h2>
        <span className="grow" />
        <div className="seg">
          <button className={cx('seg-btn', view === 'kanban' && 'on')} onClick={() => setView('kanban')}>Bord</button>
          <button className={cx('seg-btn', view === 'list' && 'on')} onClick={() => setView('list')}>Lijst</button>
        </div>
        <button className="btn btn-primary" onClick={() => openTask({ project_id: id })}><Plus size={16} /> Taak</button>
      </div>
      {view === 'kanban'
        ? <Kanban tasks={ptasks} onOpen={openTask} onNew={(d) => openTask({ ...d, project_id: id })} />
        : <TaskList tasks={ptasks} onOpen={openTask} showProject={false} />}
      {editing && <ProjectModal project={project} onClose={() => setEditing(false)} />}
    </div>
  );
}

export default function Projects({ params, go, openTask }) {
  const { projects } = useData();
  const [filter, setFilter] = useState('open');
  const [creating, setCreating] = useState(false);

  useEffect(() => { if (params?.new) setCreating(true); }, [params]);

  if (params?.id) return <ProjectDetail id={params.id} onBack={() => go('projects')} openTask={openTask} go={go} />;

  const list = projects
    .filter((p) => (filter === 'open' ? p.status !== 'afgerond' : filter === 'all' ? true : p.status === filter))
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.deadline || '9').localeCompare(b.deadline || '9'));

  return (
    <div className="page">
      <PageHeader title="Projecten" subtitle={`${projects.filter((p) => p.status === 'actief').length} actief`}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="open">Lopend</option>
          {PROJECT_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          <option value="all">Alles</option>
        </select>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Nieuw project</button>
      </PageHeader>
      {list.length ? (
        <div className="pgrid">
          {list.map((p) => <ProjectCard key={p.id} project={p} onOpen={(id) => go('projects', { id })} />)}
        </div>
      ) : (
        <Empty icon={FolderKanban} title={projects.length ? 'Geen projecten in deze weergave' : 'Nog geen projecten'} text="Een project bundelt taken, vergaderingen en een map met bestanden." action={<button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Nieuw project</button>} />
      )}
      {creating && <ProjectModal onClose={() => setCreating(false)} onSaved={(p) => go('projects', { id: p.id })} />}
    </div>
  );
}
