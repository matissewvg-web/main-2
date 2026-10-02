import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckSquare, FolderKanban, Plus, Activity, Users, Package, Wallet } from 'lucide-react';
import { txOverdue } from './Finance';
import { api } from '../api';
import { useData, useToast } from '../store';
import { PRIORITY_RANK, daysUntil, fmtDate, fmtMoney, fmtNum, timeAgo, todayStr, isAssigned, isUnassigned } from '../util';
import { Avatar, AvatarStack, DeadlineBadge, PriorityBadge } from '../components/ui';
import TaskRow from '../components/TaskRow';

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return 'Goedenacht';
  if (h < 12) return 'Goedemorgen';
  if (h < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

function Stat({ icon: Icon, label, value, tone, onClick }) {
  return (
    <button className={`stat stat-${tone || 'default'}`} onClick={onClick}>
      <Icon size={18} />
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </button>
  );
}

export default function Dashboard({ go, openTask }) {
  const { tasks, projects, users, me, maps, products, transactions, finance } = useData();
  const lowStock = products.filter((p) => !p.archived && p.stock < p.min_stock);
  const overduePay = transactions.filter(txOverdue);
  const monthKey = todayStr().slice(0, 7);
  const monthTx = transactions.filter((t) => t.date.startsWith(monthKey));
  const monthResult = monthTx.reduce((s, t) => s + (t.kind === 'inkomst' ? t.amount_cents : -t.amount_cents), 0);
  const toast = useToast();
  const [quick, setQuick] = useState('');
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    api.get('/activity?limit=15').then(setActivity).catch(() => {});
  }, [tasks, projects]);

  const open = tasks.filter((t) => t.status !== 'klaar');
  const mine = open.filter((t) => isAssigned(t, me.id));
  const overdue = open.filter((t) => t.deadline && daysUntil(t.deadline) < 0);
  const thisWeek = open.filter((t) => t.deadline && daysUntil(t.deadline) >= 0 && daysUntil(t.deadline) <= 7);
  const activeProjects = projects.filter((p) => p.status === 'actief');

  // My focus list: overdue first, then by deadline, then urgent things without a date.
  const focus = [...mine].sort((a, b) => {
    const da = a.deadline ? daysUntil(a.deadline) : 999;
    const db = b.deadline ? daysUntil(b.deadline) : 999;
    return da - db || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  }).slice(0, 12);

  const upcoming = [
    ...open.filter((t) => t.deadline && daysUntil(t.deadline) <= 14).map((t) => ({ kind: 'task', item: t, date: t.deadline })),
    ...projects.filter((p) => p.status !== 'afgerond' && p.deadline && daysUntil(p.deadline) <= 30).map((p) => ({ kind: 'project', item: p, date: p.deadline })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12);

  const addQuick = async (e) => {
    e.preventDefault();
    if (!quick.trim()) return;
    try {
      await api.post('/tasks', { title: quick.trim(), assignees: [me.id] });
      setQuick('');
      toast('Taak toegevoegd aan jouw lijst', 'ok');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const today = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{greeting()}, {me.name.split(' ')[0]}</h1>
          <p className="muted cap">{today}</p>
        </div>
      </header>

      <div className="stats">
        <Stat icon={CheckSquare} label="Mijn open taken" value={mine.length} onClick={() => go('tasks')} />
        <Stat icon={AlertTriangle} label="Te laat (team)" value={overdue.length} tone={overdue.length ? 'danger' : 'ok'} onClick={() => go('tasks')} />
        <Stat icon={CalendarClock} label="Deadline deze week" value={thisWeek.length} tone={thisWeek.length ? 'warn' : 'default'} onClick={() => go('tasks')} />
        <Stat icon={FolderKanban} label="Actieve projecten" value={activeProjects.length} onClick={() => go('projects')} />
      </div>

      <div className="dash-grid">
        <section className="card">
          <div className="row card-title"><strong>Mijn focus</strong><span className="grow" /><button className="btn btn-sm" onClick={() => openTask({ assignees: [me.id] })}><Plus size={14} /> Taak</button></div>
          <form onSubmit={addQuick} className="quick-add">
            <Plus size={16} className="muted" />
            <input placeholder="Snel een taak toevoegen… (Enter)" value={quick} onChange={(e) => setQuick(e.target.value)} />
          </form>
          {focus.length ? focus.map((t) => <TaskRow key={t.id} task={t} onOpen={openTask} />) : <p className="muted small pad">Niets op je bord. Lekker bezig 🎉</p>}
          {mine.length > focus.length && <button className="link small pad" onClick={() => go('tasks')}>Alle {mine.length} taken bekijken →</button>}
        </section>

        <section className="card">
          <div className="row card-title"><CalendarClock size={16} /><strong>Aankomende deadlines</strong></div>
          {upcoming.length ? upcoming.map(({ kind, item, date }) => (
            <button key={kind + item.id} className="list-link" onClick={() => (kind === 'task' ? openTask(item) : go('projects', { id: item.id }))}>
              {kind === 'project' ? <FolderKanban size={14} /> : <PriorityBadge value={item.priority} compact />}
              <span className="grow ellipsis">{kind === 'project' ? <strong>{item.name}</strong> : item.title}</span>
              {kind === 'task' && <AvatarStack ids={item.assignees} size={20} />}
              <DeadlineBadge date={date} />
            </button>
          )) : <p className="muted small">Geen deadlines in de komende 2 weken.</p>}
        </section>

        <section className="card">
          <div className="row card-title"><Users size={16} /><strong>Wie doet wat</strong></div>
          {users.filter((u) => u.active).map((u) => {
            const theirs = open.filter((t) => isAssigned(t, u.id));
            const late = theirs.filter((t) => t.deadline && daysUntil(t.deadline) < 0).length;
            const busy = theirs.filter((t) => t.status === 'bezig');
            return (
              <div key={u.id} className="team-row">
                <Avatar user={u} size={28} />
                <div className="grow ellipsis">
                  <strong>{u.name}</strong>
                  <span className="muted small block ellipsis">{busy.length ? `Bezig met: ${busy.map((t) => t.title).join(', ')}` : 'Niets op “bezig”'}</span>
                </div>
                <span className="pill">{theirs.length} open</span>
                {late > 0 && <span className="pill pill-red">{late} te laat</span>}
              </div>
            );
          })}
          {open.some(isUnassigned) && (
            <p className="muted small pad">{open.filter(isUnassigned).length} open taken zijn nog niet toegewezen.</p>
          )}
        </section>

        {(lowStock.length > 0 || (finance && (overduePay.length > 0 || monthTx.length > 0))) && (
          <section className="card">
            <div className="row card-title"><AlertTriangle size={16} /><strong>Aandacht nodig</strong></div>
            {lowStock.slice(0, 5).map((p) => (
              <button key={'p' + p.id} className="list-link" onClick={() => go('inventory', { id: p.id })}>
                <Package size={14} /><span className="grow ellipsis">{p.name}</span>
                <span className="pill pill-red">{fmtNum(p.stock)} / min {fmtNum(p.min_stock)} {p.unit}</span>
              </button>
            ))}
            {lowStock.length > 5 && <button className="link small pad" onClick={() => go('inventory')}>Nog {lowStock.length - 5} producten onder minimum →</button>}
            {finance && overduePay.slice(0, 5).map((t) => (
              <button key={'t' + t.id} className="list-link" onClick={() => go('finance', { id: t.id })}>
                <Wallet size={14} /><span className="grow ellipsis">{t.kind === 'inkomst' ? 'Nog ontvangen: ' : 'Nog betalen: '}{t.description}</span>
                <span className="pill pill-red">{fmtMoney(t.amount_cents)} · {fmtDate(t.due_date)}</span>
              </button>
            ))}
            {finance && monthTx.length > 0 && (
              <button className="list-link" onClick={() => go('finance')}>
                <Wallet size={14} /><span className="grow">Resultaat deze maand</span>
                <strong className={monthResult < 0 ? 'neg' : 'pos'}>{fmtMoney(monthResult)}</strong>
              </button>
            )}
          </section>
        )}

        <section className="card">
          <div className="row card-title"><Activity size={16} /><strong>Recente activiteit</strong></div>
          {activity.length ? activity.map((a) => (
            <div key={a.id} className="activity-row">
              <Avatar user={maps.users[a.user_id]} size={20} />
              <span className="grow small ellipsis">
                <strong>{maps.users[a.user_id]?.name.split(' ')[0] || 'Iemand'}</strong> heeft {a.entity} <em>{a.label}</em> {a.action}
              </span>
              <span className="muted small nowrap">{timeAgo(a.created_at)}</span>
            </div>
          )) : <p className="muted small">Nog geen activiteit.</p>}
        </section>
      </div>
      {activeProjects.length > 0 && (
        <>
          <h2 className="section-head">Actieve projecten</h2>
          <div className="mini-projects">
            {activeProjects.slice(0, 8).map((p) => {
              const pt = tasks.filter((t) => t.project_id === p.id);
              const pct = pt.length ? Math.round((pt.filter((t) => t.status === 'klaar').length / pt.length) * 100) : 0;
              return (
                <button key={p.id} className="mini-project" onClick={() => go('projects', { id: p.id })}>
                  <div className="row gap-s"><strong className="grow ellipsis">{p.name}</strong><PriorityBadge value={p.priority} compact /></div>
                  <div className="progress"><div style={{ width: `${pct}%` }} /></div>
                  <span className="muted small">{pct}% · {p.deadline ? `deadline ${fmtDate(p.deadline)}` : 'geen deadline'}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
