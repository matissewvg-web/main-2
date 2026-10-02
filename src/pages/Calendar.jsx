import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, FolderKanban, NotebookPen, Wallet, Lightbulb, Rocket } from 'lucide-react';
import { useData } from '../store';
import { PRIORITY, cx, isAssigned, localDateStr, todayStr } from '../util';
import { AvatarStack, PageHeader } from '../components/ui';

const DAYS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

const TYPES = [
  { id: 'task', label: 'Taken' },
  { id: 'project', label: 'Projectdeadlines' },
  { id: 'meeting', label: 'Vergaderingen' },
  { id: 'money', label: 'Betalingen & fundraising' },
];

export default function Calendar({ go, openTask }) {
  const { tasks, projects, meetings, transactions, brainstorms, funding_leads: leads, me, finance } = useData();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [mine, setMine] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [types, setTypes] = useState(['task', 'project', 'meeting', 'money']);

  // 6 weeks starting on the Monday on/before the 1st.
  const start = new Date(cursor);
  start.setDate(1 - ((cursor.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const today = todayStr();

  const byDay = useMemo(() => {
    const m = {};
    const add = (date, item) => { if (date) (m[date.slice(0, 10)] ||= []).push(item); };
    if (types.includes('task')) {
      for (const t of tasks) {
        if (!t.deadline || (!showDone && t.status === 'klaar') || (mine && !isAssigned(t, me.id))) continue;
        add(t.deadline, { kind: 'task', id: t.id, title: t.title, color: PRIORITY[t.priority]?.color, done: t.status === 'klaar', task: t });
      }
    }
    if (types.includes('project')) {
      for (const p of projects) {
        if (!p.deadline || p.status === 'afgerond' || (mine && p.owner_id !== me.id)) continue;
        add(p.deadline, { kind: 'project', id: p.id, title: p.name });
      }
    }
    if (types.includes('meeting')) {
      for (const mt of meetings) {
        if (mine && !(mt.attendee_users || []).includes(me.id)) continue;
        add(mt.date, { kind: 'meeting', id: mt.id, title: mt.title });
      }
      for (const b of brainstorms) {
        if (mine && !(b.participants || []).includes(me.id)) continue;
        add(b.date, { kind: 'brainstorm', id: b.id, title: `Brainstorm: ${b.title}` });
      }
    }
    if (finance && types.includes('money')) {
      for (const l of leads) {
        if (!l.next_date || ['binnen', 'afgewezen'].includes(l.stage) || (mine && l.owner_id !== me.id)) continue;
        add(l.next_date, { kind: 'lead', id: l.id, title: `${l.name}: ${l.next_step || 'volgende stap'}` });
      }
    }
    if (finance && types.includes('money')) {
      for (const tx of transactions) {
        if (tx.status !== 'open' || !tx.due_date) continue;
        add(tx.due_date, { kind: 'money', id: tx.id, title: `${tx.kind === 'inkomst' ? 'Ontvangen' : 'Betalen'}: ${tx.description}` });
      }
    }
    return m;
  }, [tasks, projects, meetings, transactions, brainstorms, leads, types, mine, showDone, me.id, finance]);

  const open = (it) => {
    if (it.kind === 'task') openTask(it.task);
    else if (it.kind === 'project') go('projects', { id: it.id });
    else if (it.kind === 'meeting') go('meetings', { id: it.id });
    else if (it.kind === 'brainstorm') go('brainstorm', { id: it.id });
    else if (it.kind === 'lead') go('fundraising', { id: it.id });
    else go('finance', { id: it.id });
  };

  const shift = (n) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));
  const toggleType = (id) => setTypes((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));

  return (
    <div className="page">
      <PageHeader title="Kalender" subtitle="Deadlines, vergaderingen en betalingen in één overzicht">
        <button className="btn" onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Vandaag</button>
        <div className="seg">
          <button className="seg-btn" onClick={() => shift(-1)} title="Vorige maand"><ChevronLeft size={16} /></button>
          <span className="cal-month">{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</span>
          <button className="seg-btn" onClick={() => shift(1)} title="Volgende maand"><ChevronRight size={16} /></button>
        </div>
      </PageHeader>
      <div className="filters">
        {TYPES.filter((t) => t.id !== 'money' || finance).map((t) => (
          <label key={t.id} className="row gap-xs small"><input type="checkbox" checked={types.includes(t.id)} onChange={() => toggleType(t.id)} /> {t.label}</label>
        ))}
        <span className="tb-sep" />
        <label className="row gap-xs small"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Alleen van mij</label>
        <label className="row gap-xs small"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Toon afgeronde taken</label>
      </div>
      <div className="cal">
        {DAYS.map((d) => <div key={d} className="cal-dow">{d}</div>)}
        {days.map((d) => {
          const key = localDateStr(d);
          const items = byDay[key] || [];
          const other = d.getMonth() !== cursor.getMonth();
          return (
            <div key={key} className={cx('cal-day', other && 'other', key === today && 'today', key < today && 'past')}>
              <div className="cal-day-head">
                <span className="cal-num">{d.getDate()}</span>
                <button className="icon-btn ghost cal-add" title="Taak met deze deadline" onClick={() => openTask({ deadline: key, assignees: [me.id] })}><Plus size={13} /></button>
              </div>
              {items.slice(0, 4).map((it) => (
                <button key={it.kind + it.id} className={cx('cal-item', `cal-${it.kind}`, it.done && 'strike')} onClick={() => open(it)} title={it.title}>
                  {it.kind === 'task' && <span className="dot" style={{ background: it.color }} />}
                  {it.kind === 'project' && <FolderKanban size={12} />}
                  {it.kind === 'meeting' && <NotebookPen size={12} />}
                  {it.kind === 'money' && <Wallet size={12} />}
                  {it.kind === 'brainstorm' && <Lightbulb size={12} />}
                  {it.kind === 'lead' && <Rocket size={12} />}
                  <span className="ellipsis">{it.title}</span>
                  {it.kind === 'task' && <AvatarStack ids={it.task.assignees} size={14} max={2} />}
                </button>
              ))}
              {items.length > 4 && <span className="muted small cal-more" title={items.slice(4).map((i) => i.title).join('\n')}>+{items.length - 4} meer</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
