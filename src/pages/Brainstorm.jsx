import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Lightbulb, ArrowLeft, ThumbsUp, MoreHorizontal, Pencil, Trash2, ListPlus, FolderPlus, Timer, Play, Pause, RotateCcw,
  CheckCircle2, CircleDot, Users,
} from 'lucide-react';
import { api } from '../api';
import { useData, useToast } from '../store';
import { IDEA_COLORS, IDEA_COLUMNS, cx, fmtDate, todayStr } from '../util';
import { Avatar, AvatarStack, Empty, Field, Modal, PageHeader, PeoplePicker, ProjectSelect, TagChips, TagPicker, confirmDialog } from '../components/ui';

function SessionModal({ session, onClose, onSaved }) {
  const { me } = useData();
  const toast = useToast();
  const [s, setS] = useState(() => ({ title: '', question: '', date: todayStr(), project_id: null, participants: [me.id], tags: [], ...session }));
  const isNew = !s.id;
  const set = (k) => (v) => setS((x) => ({ ...x, [k]: v?.target ? v.target.value : v }));
  const save = async () => {
    if (!s.title.trim()) return toast('Geef de sessie een titel.', 'error');
    try {
      const body = { title: s.title, question: s.question, date: s.date, project_id: s.project_id, participants: s.participants, tags: s.tags };
      const saved = isNew ? await api.post('/brainstorms', body) : await api.patch(`/brainstorms/${s.id}`, body);
      onSaved?.(saved);
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  return (
    <Modal title={isNew ? 'Nieuwe brainstorm' : 'Brainstorm bewerken'} onClose={onClose} footer={<><span className="grow" /><button className="btn" onClick={onClose}>Annuleren</button><button className="btn btn-primary" onClick={save}>{isNew ? 'Starten' : 'Opslaan'}</button></>}>
      <div className="form">
        <Field label="Titel" span><input autoFocus value={s.title} onChange={set('title')} placeholder="Bijv. Nieuwe producten 2027" /></Field>
        <Field label="Centrale vraag" span hint="Eén duidelijke vraag levert betere ideeën op dan een vaag onderwerp."><input value={s.question || ''} onChange={set('question')} placeholder="Bijv. Hoe verdubbelen we de omzet in de winter?" /></Field>
        <Field label="Datum"><input type="date" value={s.date || ''} onChange={set('date')} /></Field>
        <Field label="Project"><ProjectSelect value={s.project_id} onChange={set('project_id')} /></Field>
        <Field label="Deelnemers" span><PeoplePicker value={s.participants} onChange={set('participants')} placeholder="Wie doen er mee?" /></Field>
        <Field label="Tags" span><TagPicker value={s.tags} onChange={set('tags')} /></Field>
      </div>
    </Modal>
  );
}

function IdeaModal({ idea, onClose }) {
  const toast = useToast();
  const [i, setI] = useState(idea);
  const set = (k) => (v) => setI((x) => ({ ...x, [k]: v?.target ? v.target.value : v }));
  const save = async () => {
    if (!i.text.trim()) return toast('Een idee heeft tekst nodig.', 'error');
    await api.patch(`/ideas/${i.id}`, { text: i.text, details: i.details, color: i.color }).catch((e) => toast(e.message, 'error'));
    onClose();
  };
  return (
    <Modal title="Idee bewerken" onClose={onClose} footer={<><span className="grow" /><button className="btn" onClick={onClose}>Annuleren</button><button className="btn btn-primary" onClick={save}>Opslaan</button></>}>
      <div className="form">
        <Field label="Idee" span><input autoFocus value={i.text} onChange={set('text')} /></Field>
        <Field label="Uitwerking" span><textarea rows={4} value={i.details || ''} onChange={set('details')} placeholder="Waarom, hoe, wat is er nodig?" /></Field>
        <Field label="Kleur" span>
          <div className="row gap-s">
            {Object.entries(IDEA_COLORS).map(([id, c]) => (
              <button type="button" key={id} className={cx('idea-swatch', i.color === id && 'on')} style={{ '--bg': c.bg }} title={c.label} onClick={() => set('color')(id)} />
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}

function useTimer() {
  const [left, setLeft] = useState(null); // seconds
  const [running, setRunning] = useState(false);
  const toast = useToast();
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setLeft((s) => {
      if (s <= 1) {
        setRunning(false);
        toast('⏰ Tijd is om!', 'ok');
        return 0;
      }
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [running, toast]);
  return { left, running, start: (min) => { setLeft(min * 60); setRunning(true); }, toggle: () => setRunning((r) => !r), reset: () => { setRunning(false); setLeft(null); } };
}

function Board({ session, go, openTask }) {
  const { ideas, maps, me } = useData();
  const toast = useToast();
  const [text, setText] = useState('');
  const [color, setColor] = useState('geel');
  const [sortBy, setSortBy] = useState('votes');
  const [menu, setMenu] = useState(null);
  const [editIdea, setEditIdea] = useState(null);
  const [editSession, setEditSession] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const timer = useTimer();
  const inputRef = useRef(null);

  const mine = useMemo(() => ideas.filter((i) => i.brainstorm_id === session.id), [ideas, session.id]);
  const sorted = (list) => [...list].sort((a, b) => (sortBy === 'votes' ? b.votes.length - a.votes.length || a.id - b.id : b.id - a.id));
  const done = session.status === 'afgerond';

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menu]);

  const add = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await api.post('/ideas', { brainstorm_id: session.id, text: text.trim(), color, column_id: 'idee' });
      // Whoever contributes counts as a participant.
      if (!session.participants.includes(me.id)) api.patch(`/brainstorms/${session.id}`, { participants: [...session.participants, me.id] }).catch(() => {});
      setText('');
      inputRef.current?.focus();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const vote = (idea) => api.post(`/ideas/${idea.id}/vote`).catch((e) => toast(e.message, 'error'));
  const move = (id, column_id) => api.patch(`/ideas/${id}`, { column_id }).catch((e) => toast(e.message, 'error'));
  const remove = async (idea) => {
    if (!(await confirmDialog(`Idee "${idea.text}" verwijderen?`))) return;
    api.del(`/ideas/${idea.id}`).catch((e) => toast(e.message, 'error'));
  };
  const toProject = (idea) => go('projects', { new: true, prefill: { name: idea.text, description: [idea.details, `Uit brainstorm "${session.title}"`].filter(Boolean).join('\n\n'), tags: session.tags } });
  const toTask = (idea) => openTask({ title: idea.text, description: [idea.details, `Uit brainstorm "${session.title}"`].filter(Boolean).join('\n\n'), project_id: session.project_id });

  const chosen = mine.filter((i) => i.column_id === 'gekozen');
  const tasksFromChosen = async () => {
    if (!(await confirmDialog(`Van alle ${chosen.length} gekozen ideeën een taak maken?`, { okText: 'Taken maken', danger: false }))) return;
    for (const i of chosen) {
      await api.post('/tasks', { title: i.text, description: [i.details, `Uit brainstorm "${session.title}"`].filter(Boolean).join('\n\n'), project_id: session.project_id }).catch(() => {});
    }
    toast(`${chosen.length} taken aangemaakt`, 'ok');
  };
  const toggleStatus = () => api.patch(`/brainstorms/${session.id}`, { status: done ? 'open' : 'afgerond' }).catch((e) => toast(e.message, 'error'));
  const removeSession = async () => {
    if (!(await confirmDialog(`Brainstorm "${session.title}" met alle ${mine.length} ideeën verwijderen?`))) return;
    await api.del(`/brainstorms/${session.id}`).catch((e) => toast(e.message, 'error'));
    go('brainstorm');
  };

  const mm = timer.left != null ? `${String(Math.floor(timer.left / 60)).padStart(2, '0')}:${String(timer.left % 60).padStart(2, '0')}` : null;

  return (
    <div className="page">
      <button className="btn btn-ghost back" onClick={() => go('brainstorm')}><ArrowLeft size={16} /> Brainstorms</button>
      <PageHeader title={session.title} subtitle={[fmtDate(session.date), maps.projects[session.project_id]?.name, `${mine.length} ideeën`].filter(Boolean).join(' · ')}>
        <AvatarStack ids={session.participants} size={26} max={6} />
        <div className="bs-timer">
          <Timer size={15} />
          {mm ? (
            <>
              <strong className={cx(timer.left <= 30 && timer.left > 0 && 'neg')}>{mm}</strong>
              <button className="icon-btn ghost" onClick={timer.toggle} title={timer.running ? 'Pauze' : 'Verder'}>{timer.running ? <Pause size={14} /> : <Play size={14} />}</button>
              <button className="icon-btn ghost" onClick={timer.reset} title="Reset"><RotateCcw size={14} /></button>
            </>
          ) : [5, 10, 15].map((m) => <button key={m} className="btn btn-sm" onClick={() => timer.start(m)}>{m} min</button>)}
        </div>
        <button className="btn" onClick={() => setEditSession(true)}><Pencil size={15} /> Bewerken</button>
        <button className={cx('btn', !done && 'btn-primary')} onClick={toggleStatus}>{done ? <><CircleDot size={15} /> Heropenen</> : <><CheckCircle2 size={15} /> Afronden</>}</button>
        <button className="icon-btn danger" title="Verwijderen" onClick={removeSession}><Trash2 size={16} /></button>
      </PageHeader>

      {session.question && <div className="bs-question">💡 {session.question}</div>}
      <TagChips ids={session.tags} />

      <div className="row gap-m wrap">
        <form className="bs-add" onSubmit={add}>
          <Plus size={18} className="muted" />
          <input ref={inputRef} autoFocus placeholder={done ? 'Deze brainstorm is afgerond' : 'Typ een idee en druk op Enter… (kort en krachtig)'} value={text} disabled={done} onChange={(e) => setText(e.target.value)} />
          <div className="row gap-xs">
            {Object.entries(IDEA_COLORS).map(([id, c]) => (
              <button type="button" key={id} className={cx('idea-swatch sm', color === id && 'on')} style={{ '--bg': c.bg }} title={c.label} onClick={() => setColor(id)} />
            ))}
          </div>
        </form>
        <div className="seg">
          <button className={cx('seg-btn', sortBy === 'votes' && 'on')} onClick={() => setSortBy('votes')}><ThumbsUp size={14} /> Meeste stemmen</button>
          <button className={cx('seg-btn', sortBy === 'new' && 'on')} onClick={() => setSortBy('new')}>Nieuwste</button>
        </div>
        {chosen.length > 0 && <button className="btn" onClick={tasksFromChosen}><ListPlus size={15} /> Taken van gekozen ideeën ({chosen.length})</button>}
      </div>

      <div className="kanban bs-board" style={{ '--cols': 4 }}>
        {IDEA_COLUMNS.map((col) => {
          const items = sorted(mine.filter((i) => i.column_id === col.id));
          return (
            <div
              key={col.id}
              className={cx('kcol', overCol === col.id && 'kcol-over')}
              onDragOver={(e) => { e.preventDefault(); setOverCol(col.id); }}
              onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
              onDrop={(e) => { e.preventDefault(); setOverCol(null); if (dragId) move(dragId, col.id); setDragId(null); }}
            >
              <div className="kcol-head" title={col.hint}>
                <strong>{col.label}</strong><span className="count">{items.length}</span>
              </div>
              <div className="kcol-body">
                {items.map((i) => {
                  const voted = i.votes.includes(me.id);
                  return (
                    <div
                      key={i.id}
                      className={cx('idea', dragId === i.id && 'dragging')}
                      style={{ '--bg': IDEA_COLORS[i.color]?.bg, '--bg-dark': IDEA_COLORS[i.color]?.bgDark }}
                      draggable
                      onDragStart={(e) => { setDragId(i.id); e.dataTransfer.effectAllowed = 'move'; }}
                      onDragEnd={() => setDragId(null)}
                      onDoubleClick={() => setEditIdea(i)}
                    >
                      <div className="idea-text">{i.text}</div>
                      {i.details && <div className="idea-details">{i.details}</div>}
                      <div className="idea-foot">
                        <Avatar user={maps.users[i.created_by]} size={18} />
                        <span className="grow" />
                        <button
                          className={cx('vote-btn', voted && 'on')}
                          onClick={() => vote(i)}
                          title={i.votes.length ? `Stemmen: ${i.votes.map((v) => maps.users[v]?.name).filter(Boolean).join(', ')}` : 'Stem op dit idee'}
                        >
                          <ThumbsUp size={13} /> {i.votes.length || ''}
                        </button>
                        <button className="icon-btn ghost" onClick={(e) => { e.stopPropagation(); setMenu({ idea: i, x: Math.min(e.clientX, window.innerWidth - 220), y: Math.min(e.clientY, window.innerHeight - 220) }); }}><MoreHorizontal size={15} /></button>
                      </div>
                    </div>
                  );
                })}
                {!items.length && <div className="kcol-empty">{col.id === 'idee' ? 'Typ hierboven je eerste idee' : 'Sleep ideeën hierheen'}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {menu && (
        <div className="ctx-menu" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => { setEditIdea(menu.idea); setMenu(null); }}><Pencil size={15} /> Bewerken / uitwerken</button>
          <button onClick={() => { toTask(menu.idea); setMenu(null); }}><ListPlus size={15} /> Maak taak</button>
          <button onClick={() => { toProject(menu.idea); setMenu(null); }}><FolderPlus size={15} /> Maak project</button>
          <hr />
          {IDEA_COLUMNS.filter((c) => c.id !== menu.idea.column_id).map((c) => (
            <button key={c.id} onClick={() => { move(menu.idea.id, c.id); setMenu(null); }}>→ {c.label}</button>
          ))}
          <hr />
          <button className="danger" onClick={() => { remove(menu.idea); setMenu(null); }}><Trash2 size={15} /> Verwijderen</button>
        </div>
      )}
      {editIdea && <IdeaModal idea={editIdea} onClose={() => setEditIdea(null)} />}
      {editSession && <SessionModal session={session} onClose={() => setEditSession(false)} />}
    </div>
  );
}

export default function Brainstorm({ params, go, openTask }) {
  const { brainstorms, ideas, maps } = useData();
  const [creating, setCreating] = useState(false);
  useEffect(() => { if (params?.new) setCreating(true); }, [params]);

  const session = params?.id && maps.brainstorms[params.id];
  if (session) return <Board session={session} go={go} openTask={openTask} />;

  return (
    <div className="page">
      <PageHeader title="Brainstorm" subtitle="Samen ideeën verzamelen, stemmen en de beste omzetten in taken of projecten">
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Nieuwe brainstorm</button>
      </PageHeader>
      {!brainstorms.length ? (
        <Empty icon={Lightbulb} title="Nog geen brainstorms" text="Start een sessie met één duidelijke vraag. Iedereen voegt live ideeën toe, stemt, en de beste ideeën worden met één klik een taak of project." action={<button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Nieuwe brainstorm</button>} />
      ) : (
        <div className="pgrid">
          {brainstorms.map((b) => {
            const its = ideas.filter((i) => i.brainstorm_id === b.id);
            const top = [...its].sort((a, c) => c.votes.length - a.votes.length)[0];
            return (
              <button key={b.id} className={cx('pcard', b.status === 'afgerond' && 'pcard-done')} onClick={() => go('brainstorm', { id: b.id })}>
                <div className="row gap-s">
                  <span className={cx('pill', b.status === 'open' && 'pill-blue')}>{b.status === 'open' ? 'Open' : 'Afgerond'}</span>
                  <span className="muted small">{fmtDate(b.date)}</span>
                  <span className="grow" />
                  <span className="muted small row gap-xs"><Lightbulb size={13} /> {its.length}</span>
                </div>
                <h3>{b.title}</h3>
                {b.question && <p className="muted clamp-2">{b.question}</p>}
                {top && top.votes.length > 0 && <p className="small">🏆 <strong>{top.text}</strong> <span className="muted">({top.votes.length} stemmen)</span></p>}
                <div className="pcard-foot"><span className="muted small row gap-xs"><Users size={13} /> {b.participants.length}</span><span className="grow" /><AvatarStack ids={b.participants} size={22} /></div>
              </button>
            );
          })}
        </div>
      )}
      {creating && <SessionModal onClose={() => setCreating(false)} onSaved={(s) => go('brainstorm', { id: s.id })} />}
    </div>
  );
}
