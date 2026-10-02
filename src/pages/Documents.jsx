import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, FileText, Pin, PinOff, Trash2, Check, Loader2, Printer, Copy, FolderKanban } from 'lucide-react';
import { api } from '../api';
import { useData, useToast } from '../store';
import { DOC_STATUS, DOC_STATUSES, cx, fmtDate, localDateStr, parseUtc, stripHtml, timeAgo } from '../util';
import { AvatarStack, DeadlineBadge, Empty, Modal, PeoplePicker, ProjectSelect, TagChips, TagPicker, confirmDialog } from '../components/ui';
import Comments from '../components/Comments';
import RichEditor from '../components/RichEditor';
import { DOC_TEMPLATES } from '../docTemplates';
import { useAutosave } from '../useAutosave';

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function TemplatePicker({ onPick, onClose }) {
  return (
    <Modal title="Nieuw document" onClose={onClose}>
      <div className="template-grid">
        {DOC_TEMPLATES.map((t) => (
          <button key={t.id} className="template" onClick={() => onPick(t)}>
            <FileText size={22} />
            <strong>{t.label}</strong>
            <span className="muted small">{t.content ? stripHtml(t.content).slice(0, 70) + '…' : 'Begin met een leeg vel'}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function DocEditor({ doc, go, openTask }) {
  const { documents, maps } = useData();
  const toast = useToast();
  const { draft: d, set, state, discard } = useAutosave(doc, '/documents', (e) => toast(`Opslaan mislukt: ${e.message}`, 'error'));
  const categories = [...new Set(documents.map((x) => x.category).filter(Boolean))];

  const remove = async () => {
    if (!(await confirmDialog(`Document "${d.title}" verwijderen?`))) return;
    discard();
    await api.del(`/documents/${doc.id}`).catch((e) => toast(e.message, 'error'));
    go('files', { tab: 'docs' });
  };

  const duplicate = async () => {
    try {
      const copy = await api.post('/documents', { title: `${d.title} (kopie)`, content: d.content, category: d.category, tags: d.tags, project_id: d.project_id });
      go('files', { tab: 'docs', doc: copy.id });
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const print = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>${escapeHtml(d.title)}</title><style>body{font-family:Segoe UI,Arial,sans-serif;max-width:760px;margin:40px auto;line-height:1.55}h1{margin-bottom:4px}.meta{color:#666;margin-bottom:24px;font-size:13px}ul[data-type=taskList]{list-style:none;padding-left:0}ul[data-type=taskList] li{display:flex;gap:8px}</style></head><body><h1>${escapeHtml(d.title)}</h1><div class="meta">${escapeHtml(d.category || '')} · bijgewerkt ${fmtDate(localDateStr(parseUtc(doc.updated_at)))}</div>${d.content || ''}</body></html>`);
    w.document.close();
    w.print();
  };

  const editor = maps.users[doc.updated_by || doc.created_by];

  return (
    <div className="meeting-editor">
      <div className="row gap-s">
        <input className="title-input" value={d.title} onChange={set('title')} placeholder="Titel" />
        <span className={cx('save-state', state)}>
          {state === 'saving' ? <><Loader2 size={13} className="spin" /> Opslaan…</> : state === 'dirty' ? 'Niet opgeslagen' : <><Check size={13} /> Opgeslagen</>}
        </span>
        <button className="icon-btn" title={d.pinned ? 'Losmaken' : 'Vastpinnen bovenaan'} onClick={() => set('pinned')(d.pinned ? 0 : 1)}>{d.pinned ? <PinOff size={16} /> : <Pin size={16} />}</button>
        <button className="icon-btn" title="Dupliceren" onClick={duplicate}><Copy size={16} /></button>
        <button className="icon-btn" title="Afdrukken / PDF" onClick={print}><Printer size={16} /></button>
        <button className="icon-btn danger" title="Verwijderen" onClick={remove}><Trash2 size={16} /></button>
      </div>
      <div className="doc-meta">
        <input list="tb5-doccats" value={d.category || ''} onChange={set('category')} placeholder="Categorie (bijv. Procedures)" />
        <datalist id="tb5-doccats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        <ProjectSelect value={d.project_id} onChange={set('project_id')} />
        <div className="grow"><TagPicker value={d.tags || []} onChange={set('tags')} /></div>
      </div>
      <div className="doc-meta doc-meta-2">
        <div className="seg">
          {DOC_STATUSES.map((st) => <button key={st.id} className={cx('seg-btn', d.status === st.id && 'on')} style={{ '--c': st.color }} onClick={() => set('status')(st.id)}>{st.label}</button>)}
        </div>
        <label className="row gap-xs muted small">Deadline <input type="date" value={d.deadline || ''} onChange={set('deadline')} /></label>
        <div className="grow"><PeoplePicker value={d.assignees || []} onChange={set('assignees')} placeholder="Wie werkt eraan?" /></div>
      </div>
      <p className="muted small">
        Aangemaakt op {fmtDate(localDateStr(parseUtc(doc.created_at)))} door {maps.users[doc.created_by]?.name || 'onbekend'} · laatst bewerkt door {editor?.name || 'onbekend'} {timeAgo(doc.updated_at)}
        {d.project_id && maps.projects[d.project_id] && <> · <button className="link" onClick={() => go('projects', { id: d.project_id })}><FolderKanban size={12} /> {maps.projects[d.project_id].name}</button></>}
      </p>
      <RichEditor
        key={doc.id}
        value={d.content}
        onChange={set('content')}
        placeholder="Begin met schrijven… Gebruik de knoppen voor koppen, lijsten en checklists."
        onMakeTask={(text) => openTask({ title: text.slice(0, 200), project_id: d.project_id })}
      />
      <div className="card"><Comments entity="documents" id={doc.id} /></div>
    </div>
  );
}

export default function Documents({ params, go, openTask }) {
  const { documents, maps, me } = useData();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [picking, setPicking] = useState(false);
  const creating = useRef(false);
  const selectedId = params?.doc;

  useEffect(() => { if (params?.newDoc) setPicking(true); }, [params]);

  const create = async (tpl) => {
    if (creating.current) return;
    creating.current = true;
    setPicking(false);
    try {
      const doc = await api.post('/documents', { title: tpl.id === 'leeg' ? 'Naamloos document' : tpl.label, content: tpl.content, category: tpl.category || null, project_id: params?.project_id || null, assignees: [me.id] });
      go('files', { tab: 'docs', doc: doc.id });
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      creating.current = false;
    }
  };

  const categories = [...new Set(documents.map((x) => x.category).filter(Boolean))].sort();
  const list = useMemo(() => documents.filter((x) => {
    if (cat === '__mine' && x.created_by !== me.id) return false;
    if (cat && cat !== '__mine' && x.category !== cat) return false;
    if (q && !`${x.title} ${x.category || ''} ${stripHtml(x.content)}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [documents, q, cat, me.id]);

  // Pinned first, then grouped per category.
  const groups = useMemo(() => {
    const m = new Map();
    for (const x of list) {
      const key = x.pinned ? '📌 Vastgepind' : x.category || 'Zonder categorie';
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(x);
    }
    return [...m.entries()].sort(([a], [b]) => (a.startsWith('📌') ? -1 : b.startsWith('📌') ? 1 : a === 'Zonder categorie' ? 1 : b === 'Zonder categorie' ? -1 : a.localeCompare(b, 'nl')));
  }, [list]);

  const selected = documents.find((x) => x.id === selectedId);

  return (
    <div className="page page-split">
      <header className="page-head">
        <div><h1>Documenten</h1><p className="muted">Procedures, voorstellen, plannen en kennis: zelf geschreven in de app</p></div>
        <div className="page-actions"><button className="btn btn-primary" onClick={() => setPicking(true)}><Plus size={16} /> Nieuw document</button></div>
      </header>
      {!documents.length ? (
        <Empty icon={FileText} title="Nog geen documenten" text="Schrijf werkwijzen, offertes, plannen en handleidingen direct in de app. Kies een sjabloon om snel te beginnen." action={<button className="btn btn-primary" onClick={() => setPicking(true)}><Plus size={16} /> Nieuw document</button>} />
      ) : (
        <div className="split">
          <div className="split-list card">
            <div className="search-input"><Search size={15} /><input placeholder="Zoek in titels en tekst…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <select className="select-sm" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Alle categorieën</option>
              <option value="__mine">Door mij gemaakt</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="split-items">
              {groups.map(([group, docs]) => (
                <div key={group}>
                  <div className="doc-group">{group}</div>
                  {docs.map((x) => (
                    <button key={x.id} className={cx('meeting-item', x.id === selectedId && 'active')} onClick={() => go('files', { tab: 'docs', doc: x.id })}>
                      <div className="row gap-s"><FileText size={14} className="muted" /><strong className="grow ellipsis">{x.title}</strong><span className="badge" style={{ '--c': DOC_STATUS[x.status]?.color }}><span className="dot" /></span></div>
                      <div className="row gap-s">
                        <span className="muted small ellipsis grow">{DOC_STATUS[x.status]?.label} · {timeAgo(x.updated_at)}</span>
                        {x.deadline && x.status !== 'definitief' && <DeadlineBadge date={x.deadline} />}
                        <AvatarStack ids={x.assignees} size={16} max={3} />
                      </div>
                      <TagChips ids={x.tags} />
                    </button>
                  ))}
                </div>
              ))}
              {!list.length && <p className="muted small pad">Niets gevonden.</p>}
            </div>
          </div>
          <div className="split-detail">
            {selected
              ? <DocEditor key={selected.id} doc={selected} go={go} openTask={openTask} />
              : <Empty icon={FileText} title="Kies een document" text="Of maak een nieuw document vanuit een sjabloon." />}
          </div>
        </div>
      )}
      {picking && <TemplatePicker onPick={create} onClose={() => setPicking(false)} />}
    </div>
  );
}
