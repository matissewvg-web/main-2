import { useMemo, useState } from 'react';
import { Plus, LayoutGrid, List, Search, CheckSquare, FolderKanban, Flag, Users } from 'lucide-react';
import { api } from '../api';
import { useData, useToast } from '../store';
import { PRIORITIES, PRIORITY_RANK, TASK_STATUS, TASK_STATUSES, cx, isAssigned, isUnassigned } from '../util';
import { Avatar, AvatarStack, DeadlineBadge, Empty, PageHeader, PriorityBadge, StatusBadge, TagChips } from '../components/ui';
import TaskRow from '../components/TaskRow';
import TaskMeta from '../components/TaskMeta';

function loadPref(key, fallback) {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function savePref(key, v) {
  try { localStorage.setItem(key, v); } catch {}
}

export function useTaskFilters(tasks, me) {
  const [q, setQ] = useState('');
  const [who, setWho] = useState(() => loadPref('tb5-task-who', 'all'));
  const [prio, setPrio] = useState('');
  const [project, setProject] = useState('');
  const [tag, setTag] = useState('');
  const filtered = useMemo(() => tasks.filter((t) => {
    if (q && !`${t.title} ${t.description || ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (who === 'me' && !isAssigned(t, me.id)) return false;
    if (who === 'none' && !isUnassigned(t)) return false;
    if (/^\d+$/.test(who) && !isAssigned(t, Number(who))) return false;
    if (prio && t.priority !== prio) return false;
    if (project && String(t.project_id || '') !== project) return false;
    if (tag && !t.tags.includes(Number(tag))) return false;
    return true;
  }), [tasks, q, who, prio, project, tag, me.id]);
  const setWhoSaved = (v) => { setWho(v); savePref('tb5-task-who', v); };
  return { filtered, q, setQ, who, setWho: setWhoSaved, prio, setPrio, project, setProject, tag, setTag };
}

export function TaskFilters({ f, hideProject }) {
  const { users, projects, tags } = useData();
  return (
    <div className="filters">
      <div className="search-input">
        <Search size={15} />
        <input placeholder="Zoek taken…" value={f.q} onChange={(e) => f.setQ(e.target.value)} />
      </div>
      <select value={f.who} onChange={(e) => f.setWho(e.target.value)}>
        <option value="all">Iedereen</option>
        <option value="me">Mijn taken</option>
        <option value="none">Niet toegewezen</option>
        {users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <select value={f.prio} onChange={(e) => f.setPrio(e.target.value)}>
        <option value="">Alle prioriteiten</option>
        {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      {!hideProject && (
        <select value={f.project} onChange={(e) => f.setProject(e.target.value)}>
          <option value="">Alle projecten</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      <select value={f.tag} onChange={(e) => f.setTag(e.target.value)}>
        <option value="">Alle tags</option>
        {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
    </div>
  );
}

function KanbanCard({ task, onOpen, onDragStart, groupBy = 'status' }) {
  const { maps } = useData();
  const project = maps.projects[task.project_id];
  return (
    <div
      className="kcard"
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onClick={() => onOpen(task)}
    >
      <div className="kcard-top">
        {groupBy === 'priority' ? <StatusBadge status={TASK_STATUS[task.status]} /> : <PriorityBadge value={task.priority} />}
        <DeadlineBadge date={task.deadline} done={task.status === 'klaar'} />
      </div>
      <div className={cx('kcard-title', task.status === 'klaar' && 'strike')}>{task.title}</div>
      <TagChips ids={task.tags} />
      <TaskMeta task={task} />
      <div className="kcard-foot">
        {project ? <span className="muted small row gap-xs"><FolderKanban size={12} />{project.name}</span> : <span />}
        <AvatarStack ids={task.assignees} size={22} />
      </div>
    </div>
  );
}

export function Kanban({ tasks, onOpen, onNew, groupBy = 'status' }) {
  const { patchLocal } = useData();
  const toast = useToast();
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null); // { status, beforeId }

  // The same board groups by status (Bord) or by priority (Prioriteit);
  // dropping a card in a column sets that field.
  const field = groupBy === 'priority' ? 'priority' : 'status';
  const columns = (groupBy === 'priority' ? PRIORITIES : TASK_STATUSES).map((s) => ({
    ...s,
    items: tasks.filter((t) => t[field] === s.id).sort((a, b) =>
      groupBy === 'priority'
        ? (a.status === 'klaar') - (b.status === 'klaar') || (a.deadline || '9').localeCompare(b.deadline || '9')
        : a.sort - b.sort),
  }));

  const onDragStart = (e, task) => {
    setDragId(task.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(task.id));
  };

  const drop = (colId, beforeId) => {
    const task = tasks.find((t) => t.id === dragId);
    setDragId(null);
    setOver(null);
    if (!task) return;
    if (field === 'priority') {
      if (task.priority === colId) return;
      patchLocal('tasks', task.id, { priority: colId });
      api.patch(`/tasks/${task.id}`, { priority: colId }).catch((err) => toast(err.message, 'error'));
      return;
    }
    const status = colId;
    const col = columns.find((c) => c.id === status).items.filter((t) => t.id !== task.id);
    const idx = beforeId ? col.findIndex((t) => t.id === beforeId) : col.length;
    const prev = col[idx - 1]?.sort;
    const next = col[idx]?.sort;
    const sort = prev == null && next == null ? 1 : prev == null ? next - 1 : next == null ? prev + 1 : (prev + next) / 2;
    if (task.status === status && task.sort === sort) return;
    patchLocal('tasks', task.id, { status, sort });
    api.patch(`/tasks/${task.id}`, { status, sort }).catch((err) => toast(err.message, 'error'));
  };

  return (
    <div className="kanban" style={{ '--cols': columns.length }}>
      {columns.map((col) => (
        <div
          key={col.id}
          className={cx('kcol', over?.status === col.id && 'kcol-over')}
          onDragOver={(e) => { e.preventDefault(); if (over?.status !== col.id || over?.beforeId) setOver({ status: col.id }); }}
          onDrop={(e) => { e.preventDefault(); drop(col.id, over?.beforeId); }}
        >
          <div className="kcol-head">
            <span className="dot" style={{ background: col.color }} />
            <strong>{col.label}</strong>
            <span className="count">{col.items.length}</span>
            <span className="grow" />
            <button className="icon-btn" title="Taak toevoegen" onClick={() => onNew({ [field]: col.id })}><Plus size={16} /></button>
          </div>
          <div className="kcol-body">
            {col.items.map((t) => (
              <div
                key={t.id}
                className={cx('kslot', over?.beforeId === t.id && 'kslot-over', dragId === t.id && 'dragging')}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (over?.beforeId !== t.id) setOver({ status: col.id, beforeId: t.id }); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); drop(col.id, t.id); }}
              >
                <KanbanCard task={t} onOpen={onOpen} onDragStart={onDragStart} groupBy={groupBy} />
              </div>
            ))}
            {!col.items.length && <div className="kcol-empty">Sleep taken hierheen</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TaskList({ tasks, onOpen, showProject = true }) {
  const [sortBy, setSortBy] = useState('deadline');
  const sorted = [...tasks].sort((a, b) => {
    if ((a.status === 'klaar') !== (b.status === 'klaar')) return a.status === 'klaar' ? 1 : -1;
    if (sortBy === 'priority') return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.deadline || '9').localeCompare(b.deadline || '9');
    if (sortBy === 'title') return a.title.localeCompare(b.title, 'nl');
    return (a.deadline || '9').localeCompare(b.deadline || '9') || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  });
  return (
    <div className="card">
      <div className="list-head">
        <span className="muted small">{tasks.length} taken</span>
        <span className="grow" />
        <span className="muted small">Sorteer op</span>
        <select className="select-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="deadline">Deadline</option>
          <option value="priority">Prioriteit</option>
          <option value="title">Titel</option>
        </select>
      </div>
      {sorted.map((t) => <TaskRow key={t.id} task={t} onOpen={onOpen} showProject={showProject} />)}
      {!tasks.length && <div className="list-empty">Geen taken gevonden.</div>}
    </div>
  );
}

// One column per team member (a task with two people shows in both columns),
// so you can see at a glance who has too much on their plate.
function PeopleBoard({ tasks, onOpen, onNew }) {
  const { users } = useData();
  const columns = [
    ...users.filter((u) => u.active).map((u) => ({ id: u.id, user: u, items: tasks.filter((t) => isAssigned(t, u.id)) })),
    { id: 'none', user: null, items: tasks.filter(isUnassigned) },
  ];
  const byUrgency = (a, b) => (a.status === 'klaar') - (b.status === 'klaar') || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.deadline || '9').localeCompare(b.deadline || '9');
  return (
    <div className="kanban people-board" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(240px, 1fr))` }}>
      {columns.map((col) => (
        <div key={col.id} className="kcol">
          <div className="kcol-head">
            {col.user ? <Avatar user={col.user} size={22} /> : <Users size={18} className="muted" />}
            <strong className="ellipsis">{col.user ? col.user.name : 'Niet toegewezen'}</strong>
            <span className="count">{col.items.filter((t) => t.status !== 'klaar').length}</span>
            <span className="grow" />
            <button className="icon-btn" title="Taak toevoegen" onClick={() => onNew(col.user ? { assignees: [col.user.id] } : {})}><Plus size={16} /></button>
          </div>
          <div className="kcol-body">
            {[...col.items].sort(byUrgency).map((t) => <KanbanCard key={t.id} task={t} onOpen={onOpen} onDragStart={(e) => e.preventDefault()} />)}
            {!col.items.length && <div className="kcol-empty">Geen taken</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

const VIEWS = [
  { id: 'kanban', label: 'Bord', icon: LayoutGrid, hint: 'Per status, sleep om status te wijzigen' },
  { id: 'priority', label: 'Prioriteit', icon: Flag, hint: 'Per prioriteit, sleep om prioriteit te wijzigen' },
  { id: 'people', label: 'Per persoon', icon: Users, hint: 'Wie doet wat' },
  { id: 'list', label: 'Lijst', icon: List, hint: 'Sorteerbare lijst' },
];

export default function Tasks({ openTask }) {
  const { tasks, me } = useData();
  const [view, setView] = useState(() => loadPref('tb5-task-view', 'kanban'));
  const [showDone, setShowDone] = useState(() => loadPref('tb5-task-done', '0') === '1');
  const f = useTaskFilters(tasks, me);
  const visible = view !== 'kanban' && !showDone ? f.filtered.filter((t) => t.status !== 'klaar') : f.filtered;
  const toggleDone = (v) => { setShowDone(v); savePref('tb5-task-done', v ? '1' : '0'); };
  const switchView = (v) => { setView(v); savePref('tb5-task-view', v); };

  return (
    <div className="page">
      <PageHeader title="Taken" subtitle={`${tasks.filter((t) => t.status !== 'klaar').length} open · ${tasks.filter((t) => t.status === 'klaar').length} klaar`}>
        <div className="seg">
          {VIEWS.map((v) => (
            <button key={v.id} className={cx('seg-btn', view === v.id && 'on')} title={v.hint} onClick={() => switchView(v.id)}><v.icon size={15} /> {v.label}</button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={() => openTask({})}><Plus size={16} /> Nieuwe taak</button>
      </PageHeader>
      <div className="row gap-m wrap">
        <TaskFilters f={f} />
        {view !== 'kanban' && (
          <label className="row gap-xs small"><input type="checkbox" checked={showDone} onChange={(e) => toggleDone(e.target.checked)} /> Toon afgeronde</label>
        )}
      </div>
      {!tasks.length ? (
        <Empty icon={CheckSquare} title="Nog geen taken" text="Maak je eerste taak aan en wijs hem toe aan iemand uit het team." action={<button className="btn btn-primary" onClick={() => openTask({})}><Plus size={16} /> Nieuwe taak</button>} />
      ) : view === 'kanban' ? (
        <Kanban tasks={visible} onOpen={openTask} onNew={openTask} />
      ) : view === 'priority' ? (
        <Kanban tasks={visible} onOpen={openTask} onNew={openTask} groupBy="priority" />
      ) : view === 'people' ? (
        <PeopleBoard tasks={visible} onOpen={openTask} onNew={openTask} />
      ) : (
        <TaskList tasks={visible} onOpen={openTask} />
      )}
    </div>
  );
}
