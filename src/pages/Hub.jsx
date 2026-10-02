import { useMemo, useState } from 'react';
import {
  LayoutList, CheckSquare, FolderKanban, FileText, NotebookPen, Lightbulb, Rocket, Search, Download, AlertTriangle,
  CalendarClock, Sparkles, Circle, ArrowUpDown,
} from 'lucide-react';
import { useData } from '../store';
import {
  DOC_STATUS, FUNDING_STAGE, PRIORITY, PRIORITY_RANK, PROJECT_STATUS, TASK_STATUS, cx, daysUntil, downloadCsv, fmtDate,
  localDateStr, parseUtc, timeAgo, todayStr,
} from '../util';
import { Avatar, AvatarStack, DeadlineBadge, Empty, PageHeader, PriorityBadge } from '../components/ui';

const TYPES = [
  { id: 'task', label: 'Taken', one: 'Taak', icon: CheckSquare },
  { id: 'project', label: 'Projecten', one: 'Project', icon: FolderKanban },
  { id: 'document', label: 'Documenten', one: 'Document', icon: FileText },
  { id: 'meeting', label: 'Vergaderingen', one: 'Vergadering', icon: NotebookPen },
  { id: 'brainstorm', label: 'Brainstorms', one: 'Brainstorm', icon: Lightbulb },
  { id: 'lead', label: 'Fundraising', one: 'Fundraising', icon: Rocket, finance: true },
];
const TYPE = Object.fromEntries(TYPES.map((t) => [t.id, t]));

const uniq = (a) => [...new Set(a.filter(Boolean))];
const createdDay = (s) => (s ? localDateStr(parseUtc(s)) : '');

// Turns every kind of record into the same row shape.
function useItems() {
  const { tasks, projects, documents, meetings, brainstorms, funding_leads: leads, maps, finance } = useData();
  return useMemo(() => {
    const out = [];
    for (const t of tasks) {
      out.push({
        key: 't' + t.id, type: 'task', id: t.id, raw: t, name: t.title, sub: maps.projects[t.project_id]?.name,
        status: TASK_STATUS[t.status], done: t.status === 'klaar', priority: t.priority, people: t.assignees || [],
        deadline: t.deadline, created: t.created_at, createdBy: t.created_by, updated: t.updated_at,
      });
    }
    for (const p of projects) {
      out.push({
        key: 'p' + p.id, type: 'project', id: p.id, raw: p, name: p.name, sub: maps.contacts[p.contact_id]?.name,
        status: PROJECT_STATUS[p.status], done: p.status === 'afgerond', priority: p.priority, people: uniq([p.owner_id, ...(p.members || [])]),
        deadline: p.deadline, created: p.created_at, createdBy: p.created_by, updated: p.updated_at,
      });
    }
    for (const d of documents) {
      out.push({
        key: 'd' + d.id, type: 'document', id: d.id, raw: d, name: d.title, sub: d.category,
        status: DOC_STATUS[d.status], done: d.status === 'definitief', priority: null, people: d.assignees?.length ? d.assignees : [d.created_by],
        deadline: d.deadline, created: d.created_at, createdBy: d.created_by, updated: d.updated_at,
      });
    }
    for (const m of meetings) {
      const past = m.date && m.date < todayStr();
      out.push({
        key: 'm' + m.id, type: 'meeting', id: m.id, raw: m, name: m.title, sub: maps.projects[m.project_id]?.name,
        status: { label: past ? 'Geweest' : 'Gepland', color: past ? '#94a3b8' : '#0ea5e9' }, done: past, priority: null,
        people: m.attendee_users || [], deadline: m.date, dateIsEvent: true, created: m.created_at, createdBy: m.created_by, updated: m.updated_at,
      });
    }
    for (const b of brainstorms) {
      out.push({
        key: 'b' + b.id, type: 'brainstorm', id: b.id, raw: b, name: b.title, sub: b.question,
        status: { label: b.status === 'open' ? 'Open' : 'Afgerond', color: b.status === 'open' ? '#3b82f6' : '#10b981' }, done: b.status !== 'open',
        priority: null, people: b.participants || [], deadline: b.date, dateIsEvent: true, created: b.created_at, createdBy: b.created_by, updated: b.updated_at,
      });
    }
    if (finance) {
      for (const l of leads) {
        out.push({
          key: 'l' + l.id, type: 'lead', id: l.id, raw: l, name: l.name, sub: l.next_step,
          status: FUNDING_STAGE[l.stage], done: ['binnen', 'afgewezen'].includes(l.stage), priority: null, people: uniq([l.owner_id]),
          deadline: l.next_date, created: l.created_at, createdBy: l.created_by, updated: l.updated_at,
        });
      }
    }
    return out;
  }, [tasks, projects, documents, meetings, brainstorms, leads, maps, finance]);
}

const SORTS = [
  { id: 'deadline', label: 'Deadline (eerst)' },
  { id: 'created-new', label: 'Aangemaakt (nieuwste)' },
  { id: 'created-old', label: 'Aangemaakt (oudste)' },
  { id: 'updated', label: 'Laatst gewijzigd' },
  { id: 'priority', label: 'Prioriteit' },
  { id: 'name', label: 'Naam' },
];

export default function Hub({ go, openTask }) {
  const { users, maps, me, finance } = useData();
  const items = useItems();
  const [types, setTypes] = useState(() => { try { return JSON.parse(localStorage.getItem('tb5-hub-types')) || ['task', 'project', 'document', 'lead']; } catch { return ['task', 'project', 'document', 'lead']; } });
  const [who, setWho] = useState('all');
  const [state, setState] = useState('open');
  const [due, setDue] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('deadline');
  const [group, setGroup] = useState('none');

  const toggleType = (id) => {
    const next = types.includes(id) ? types.filter((t) => t !== id) : [...types, id];
    setTypes(next);
    try { localStorage.setItem('tb5-hub-types', JSON.stringify(next)); } catch {}
  };

  const today = todayStr();
  const weekAgo = (() => { const d = new Date(); d.setDate(d.getDate() - 7); return localDateStr(d); })();
  const filtered = useMemo(() => items.filter((it) => {
    if (!types.includes(it.type)) return false;
    if (state === 'open' && it.done) return false;
    if (state === 'done' && !it.done) return false;
    if (who === 'me' && !it.people.includes(me.id)) return false;
    if (who === 'none' && it.people.length) return false;
    if (/^\d+$/.test(who) && !it.people.includes(Number(who))) return false;
    if (due) {
      const n = it.deadline ? daysUntil(it.deadline) : null;
      if (due === 'late' && !(n !== null && n < 0 && !it.done && !it.dateIsEvent)) return false;
      if (due === 'week' && !(n !== null && n >= 0 && n <= 7)) return false;
      if (due === 'month' && !(n !== null && n >= 0 && n <= 31)) return false;
      if (due === 'none' && it.deadline) return false;
      if (due === 'new' && !(createdDay(it.created) >= weekAgo)) return false;
    }
    if (q && !`${it.name} ${it.sub || ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [items, types, state, who, due, q, me.id, weekAgo]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sort === 'deadline') return (a.deadline || '9999').localeCompare(b.deadline || '9999') || (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
    if (sort === 'created-new') return (b.created || '').localeCompare(a.created || '');
    if (sort === 'created-old') return (a.created || '').localeCompare(b.created || '');
    if (sort === 'updated') return (b.updated || '').localeCompare(a.updated || '');
    if (sort === 'priority') return (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) || (a.deadline || '9999').localeCompare(b.deadline || '9999');
    return a.name.localeCompare(b.name, 'nl');
  }), [filtered, sort]);

  const groups = useMemo(() => {
    if (group === 'none') return [['', sorted]];
    const m = new Map();
    const add = (k, it) => { if (!m.has(k)) m.set(k, []); m.get(k).push(it); };
    for (const it of sorted) {
      if (group === 'type') add(TYPE[it.type].label, it);
      else if (group === 'person') {
        if (!it.people.length) add('Niemand toegewezen', it);
        for (const p of it.people) add(maps.users[p]?.name || 'Onbekend', it);
      } else if (group === 'deadline') {
        const n = it.deadline ? daysUntil(it.deadline) : null;
        add(n === null ? '5 · Geen deadline' : n < 0 ? '1 · Te laat / geweest' : n === 0 ? '2 · Vandaag' : n <= 7 ? '3 · Deze week' : '4 · Later', it);
      }
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b, 'nl'));
  }, [sorted, group, maps.users]);

  const open = (it) => {
    if (it.type === 'task') return openTask(it.raw);
    if (it.type === 'project') return go('projects', { id: it.id });
    if (it.type === 'document') return go('files', { tab: 'docs', doc: it.id });
    if (it.type === 'meeting') return go('meetings', { id: it.id });
    if (it.type === 'brainstorm') return go('brainstorm', { id: it.id });
    if (it.type === 'lead') return go('fundraising', { id: it.id });
  };

  const live = items.filter((i) => types.includes(i.type));
  const stats = {
    open: live.filter((i) => !i.done).length,
    late: live.filter((i) => !i.done && !i.dateIsEvent && i.deadline && daysUntil(i.deadline) < 0).length,
    week: live.filter((i) => !i.done && i.deadline && daysUntil(i.deadline) >= 0 && daysUntil(i.deadline) <= 7).length,
    fresh: live.filter((i) => createdDay(i.created) >= weekAgo).length,
  };

  const exportCsv = () => downloadCsv(`overzicht-${today}.csv`, [
    ['Type', 'Naam', 'Status', 'Prioriteit', 'Wie werken eraan', 'Deadline', 'Aangemaakt op', 'Aangemaakt door', 'Laatst gewijzigd'],
    ...sorted.map((it) => [TYPE[it.type].one, it.name, it.status?.label || '', it.priority ? PRIORITY[it.priority]?.label : '', it.people.map((p) => maps.users[p]?.name).filter(Boolean).join(', '), it.deadline || '', createdDay(it.created), maps.users[it.createdBy]?.name || '', createdDay(it.updated)]),
  ]);

  const stat = (icon, value, label, tone, onClick, active) => {
    const Icon = icon;
    return <button className={cx('stat', tone && `stat-${tone}`, active && 'stat-active')} onClick={onClick}><Icon size={18} /><span className="stat-value">{value}</span><span className="stat-label">{label}</span></button>;
  };

  return (
    <div className="page">
      <PageHeader title="Overzicht" subtitle="Alles op één plek: wat er loopt, wanneer het is aangemaakt, de deadline en wie eraan werkt">
        <button className="btn" onClick={exportCsv} disabled={!sorted.length}><Download size={15} /> Excel (CSV)</button>
      </PageHeader>

      <div className="stats">
        {stat(Circle, stats.open, 'Open items', null, () => { setState('open'); setDue(''); }, state === 'open' && !due)}
        {stat(AlertTriangle, stats.late, 'Te laat', stats.late ? 'danger' : 'ok', () => { setState('open'); setDue(due === 'late' ? '' : 'late'); }, due === 'late')}
        {stat(CalendarClock, stats.week, 'Deadline binnen 7 dagen', stats.week ? 'warn' : null, () => setDue(due === 'week' ? '' : 'week'), due === 'week')}
        {stat(Sparkles, stats.fresh, 'Nieuw deze week', null, () => { setState('all'); setDue(due === 'new' ? '' : 'new'); setSort('created-new'); }, due === 'new')}
      </div>

      <div className="hub-types">
        {TYPES.filter((t) => !t.finance || finance).map((t) => (
          <button key={t.id} className={cx('type-chip', types.includes(t.id) && 'on')} onClick={() => toggleType(t.id)}>
            <t.icon size={14} /> {t.label} <span className="count">{items.filter((i) => i.type === t.id && !i.done).length}</span>
          </button>
        ))}
      </div>

      <div className="filters">
        <div className="search-input"><Search size={15} /><input placeholder="Zoek op naam…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="all">Iedereen</option>
          <option value="me">Waar ik aan werk</option>
          <option value="none">Niemand toegewezen</option>
          {users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select value={state} onChange={(e) => setState(e.target.value)}>
          <option value="open">Open</option>
          <option value="done">Afgerond</option>
          <option value="all">Alles</option>
        </select>
        <select value={due} onChange={(e) => setDue(e.target.value)}>
          <option value="">Elke deadline</option>
          <option value="late">Te laat</option>
          <option value="week">Binnen 7 dagen</option>
          <option value="month">Binnen 31 dagen</option>
          <option value="none">Zonder deadline</option>
          <option value="new">Nieuw deze week</option>
        </select>
        <span className="row gap-xs muted small"><ArrowUpDown size={14} />
          <select className="select-sm" value={sort} onChange={(e) => setSort(e.target.value)}>{SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
        </span>
        <select className="select-sm" value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="none">Niet groeperen</option>
          <option value="type">Groepeer per type</option>
          <option value="person">Groepeer per persoon</option>
          <option value="deadline">Groepeer per deadline</option>
        </select>
      </div>

      {!items.length ? (
        <Empty icon={LayoutList} title="Nog niets om te tonen" text="Zodra er taken, projecten of documenten zijn, zie je ze hier allemaal samen." />
      ) : (
        <div className="card table-wrap">
          <table className="table table-hover hub-table">
            <thead>
              <tr><th>Type</th><th>Naam</th><th>Status</th><th>Prio</th><th>Wie werken eraan</th><th>Deadline / datum</th><th>Aangemaakt</th><th>Gewijzigd</th></tr>
            </thead>
            {groups.map(([label, rows]) => (
              <tbody key={label || 'all'}>
                {label && <tr className="group-row"><td colSpan={8}>{label.replace(/^\d · /, '')} <span className="count">{rows.length}</span></td></tr>}
                {rows.map((it) => {
                  const T = TYPE[it.type];
                  return (
                    <tr key={it.key + label} className={cx(it.done && 'archived')} onClick={() => open(it)}>
                      <td className="nowrap muted small"><T.icon size={14} className="inline-icon-l" /> {T.one}</td>
                      <td className="hub-name"><strong>{it.name}</strong>{it.sub && <span className="muted small block ellipsis">{it.sub}</span>}</td>
                      <td className="nowrap">{it.status && <span className="badge" style={{ '--c': it.status.color }}><span className="dot" />{it.status.label}</span>}</td>
                      <td>{it.priority && <PriorityBadge value={it.priority} />}</td>
                      <td>{it.people.length ? <span className="row gap-xs"><AvatarStack ids={it.people} size={22} max={4} /><span className="small muted ellipsis hub-people">{it.people.map((p) => maps.users[p]?.name.split(' ')[0]).filter(Boolean).join(', ')}</span></span> : <span className="muted small">—</span>}</td>
                      <td className="nowrap">{it.deadline ? (it.dateIsEvent ? <span className="small">{fmtDate(it.deadline, true)}</span> : <DeadlineBadge date={it.deadline} done={it.done} />) : <span className="muted small">—</span>}</td>
                      <td className="nowrap small" title={timeAgo(it.created)}><span className="row gap-xs"><Avatar user={maps.users[it.createdBy]} size={18} />{fmtDate(createdDay(it.created))}</span></td>
                      <td className="nowrap muted small">{timeAgo(it.updated)}</td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
            {!sorted.length && <tbody><tr><td colSpan={8} className="list-empty">Niets gevonden met deze filters.</td></tr></tbody>}
          </table>
        </div>
      )}
    </div>
  );
}
