import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Users, User, Building2, Mail, Phone, MapPin, Globe, Pencil, Trash2, Copy, FolderKanban, CalendarDays } from 'lucide-react';
import { api } from '../api';
import { useData, useToast } from '../store';
import { cx, fmtDate, PROJECT_STATUS } from '../util';
import { Empty, Field, Modal, PageHeader, StatusBadge, TagChips, TagPicker, confirmDialog } from '../components/ui';
import TaskRow from '../components/TaskRow';

function ContactModal({ contact, onClose, onSaved }) {
  const toast = useToast();
  const { contacts } = useData();
  const [c, setC] = useState(() => ({
    kind: 'persoon', name: '', company: '', job_title: '', email: '', phone: '', address: '', website: '', notes: '', tags: [], ...contact,
  }));
  const isNew = !c.id;
  const set = (k) => (v) => setC((x) => ({ ...x, [k]: v?.target ? v.target.value : v }));
  const companies = [...new Set(contacts.filter((x) => x.kind === 'bedrijf').map((x) => x.name))];

  const save = async () => {
    if (!c.name.trim()) return toast('Naam is verplicht.', 'error');
    const body = { ...c };
    delete body.id; delete body.created_at; delete body.updated_at; delete body.created_by;
    try {
      const saved = isNew ? await api.post('/contacts', body) : await api.patch(`/contacts/${c.id}`, body);
      toast(isNew ? 'Contact toegevoegd' : 'Contact opgeslagen', 'ok');
      onSaved?.(saved);
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <Modal
      title={isNew ? 'Nieuw contact' : 'Contact bewerken'}
      onClose={onClose}
      footer={<><span className="grow" /><button className="btn" onClick={onClose}>Annuleren</button><button className="btn btn-primary" onClick={save}>{isNew ? 'Toevoegen' : 'Opslaan'}</button></>}
    >
      <div className="form">
        <Field label="Soort" span>
          <div className="seg">
            <button type="button" className={cx('seg-btn', c.kind === 'persoon' && 'on')} onClick={() => set('kind')('persoon')}><User size={14} /> Persoon</button>
            <button type="button" className={cx('seg-btn', c.kind === 'bedrijf' && 'on')} onClick={() => set('kind')('bedrijf')}><Building2 size={14} /> Bedrijf</button>
          </div>
        </Field>
        <Field label={c.kind === 'bedrijf' ? 'Bedrijfsnaam' : 'Naam'}><input autoFocus value={c.name} onChange={set('name')} /></Field>
        {c.kind === 'persoon' ? (
          <>
            <Field label="Bedrijf">
              <input list="tb5-companies" value={c.company || ''} onChange={set('company')} />
              <datalist id="tb5-companies">{companies.map((n) => <option key={n} value={n} />)}</datalist>
            </Field>
            <Field label="Functie"><input value={c.job_title || ''} onChange={set('job_title')} /></Field>
          </>
        ) : (
          <Field label="Website"><input value={c.website || ''} onChange={set('website')} placeholder="www.…" /></Field>
        )}
        <Field label="E-mail"><input type="email" value={c.email || ''} onChange={set('email')} /></Field>
        <Field label="Telefoon"><input value={c.phone || ''} onChange={set('phone')} /></Field>
        <Field label="Adres" span><input value={c.address || ''} onChange={set('address')} placeholder="Straat, postcode, plaats" /></Field>
        <Field label="Tags" span><TagPicker value={c.tags} onChange={set('tags')} /></Field>
        <Field label="Notities" span><textarea rows={4} value={c.notes || ''} onChange={set('notes')} /></Field>
      </div>
    </Modal>
  );
}

function ContactDetail({ contact, onEdit, go, openTask }) {
  const { projects, tasks, meetings, contacts } = useData();
  const toast = useToast();
  const copy = (text) => navigator.clipboard?.writeText(text).then(() => toast('Gekopieerd', 'ok'));
  const linkedProjects = projects.filter((p) => p.contact_id === contact.id);
  const linkedTasks = tasks.filter((t) => t.contact_id === contact.id);
  const linkedMeetings = meetings.filter((m) => (m.attendee_contacts || []).includes(contact.id));
  const employees = contact.kind === 'bedrijf' ? contacts.filter((x) => x.kind === 'persoon' && x.company && x.company.toLowerCase() === contact.name.toLowerCase()) : [];
  const company = contact.kind === 'persoon' && contact.company ? contacts.find((x) => x.kind === 'bedrijf' && x.name.toLowerCase() === contact.company.toLowerCase()) : null;

  const remove = async () => {
    if (!(await confirmDialog(`Contact "${contact.name}" verwijderen?`))) return;
    await api.del(`/contacts/${contact.id}`).catch((e) => toast(e.message, 'error'));
    go('contacts');
  };

  const line = (Icon, value, href) => value && (
    <div className="contact-line">
      <Icon size={15} />
      {href ? <a href={href}>{value}</a> : <span>{value}</span>}
      <button className="icon-btn ghost" title="Kopiëren" onClick={() => copy(value)}><Copy size={13} /></button>
    </div>
  );

  return (
    <div className="contact-detail">
      <div className="row gap-m">
        <div className={cx('contact-avatar', contact.kind)}>{contact.kind === 'bedrijf' ? <Building2 size={26} /> : <User size={26} />}</div>
        <div className="grow">
          <h2>{contact.name}</h2>
          <p className="muted">
            {[contact.job_title, contact.kind === 'persoon' && contact.company].filter(Boolean).join(' bij ')}
            {company && <> · <button className="link" onClick={() => go('contacts', { id: company.id })}>bekijk bedrijf</button></>}
          </p>
        </div>
        <button className="btn" onClick={onEdit}><Pencil size={15} /> Bewerken</button>
        <button className="icon-btn danger" onClick={remove} title="Verwijderen"><Trash2 size={16} /></button>
      </div>
      <TagChips ids={contact.tags} />
      <div className="card">
        {line(Mail, contact.email, contact.email && `mailto:${contact.email}`)}
        {line(Phone, contact.phone, contact.phone && `tel:${contact.phone.replace(/\s/g, '')}`)}
        {line(Globe, contact.website, contact.website && (contact.website.startsWith('http') ? contact.website : `https://${contact.website}`))}
        {line(MapPin, contact.address)}
        {!contact.email && !contact.phone && !contact.address && !contact.website && <p className="muted small">Geen contactgegevens ingevuld.</p>}
      </div>
      {contact.notes && <div className="card pre-wrap">{contact.notes}</div>}
      {employees.length > 0 && (
        <div className="card">
          <strong className="card-title">Mensen bij {contact.name}</strong>
          {employees.map((e) => (
            <button key={e.id} className="list-link" onClick={() => go('contacts', { id: e.id })}><User size={14} /> <span className="grow">{e.name}</span><span className="muted small">{e.job_title}</span></button>
          ))}
        </div>
      )}
      <div className="card">
        <strong className="card-title">Projecten</strong>
        {linkedProjects.length ? linkedProjects.map((p) => (
          <button key={p.id} className="list-link" onClick={() => go('projects', { id: p.id })}><FolderKanban size={14} /> <span className="grow">{p.name}</span><StatusBadge status={PROJECT_STATUS[p.status]} /></button>
        )) : <p className="muted small">Geen gekoppelde projecten.</p>}
      </div>
      <div className="card">
        <div className="row card-title"><strong>Taken</strong><span className="grow" /><button className="btn btn-sm" onClick={() => openTask({ contact_id: contact.id })}><Plus size={14} /> Taak</button></div>
        {linkedTasks.length ? linkedTasks.map((t) => <TaskRow key={t.id} task={t} onOpen={openTask} />) : <p className="muted small">Geen taken.</p>}
      </div>
      <div className="card">
        <strong className="card-title">Vergaderingen</strong>
        {linkedMeetings.length ? linkedMeetings.map((m) => (
          <button key={m.id} className="list-link" onClick={() => go('meetings', { id: m.id })}><CalendarDays size={14} /> <span className="grow">{m.title}</span><span className="muted small">{fmtDate(m.date)}</span></button>
        )) : <p className="muted small">Nog niet bij een vergadering.</p>}
      </div>
    </div>
  );
}

export default function Contacts({ params, go, openTask }) {
  const { contacts, tags } = useData();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [tag, setTag] = useState('');
  const [modal, setModal] = useState(null);
  const selectedId = params?.id;

  useEffect(() => { if (params?.new) setModal({}); }, [params]);

  const list = useMemo(() => contacts.filter((c) => {
    if (kind && c.kind !== kind) return false;
    if (tag && !c.tags.includes(Number(tag))) return false;
    if (q) {
      const hay = `${c.name} ${c.company || ''} ${c.email || ''} ${c.phone || ''} ${c.job_title || ''}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [contacts, q, kind, tag]);

  const selected = contacts.find((c) => c.id === selectedId);

  return (
    <div className="page page-split">
      <PageHeader title="Contacten" subtitle={`${contacts.length} contacten`}>
        <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={16} /> Nieuw contact</button>
      </PageHeader>
      {!contacts.length ? (
        <Empty icon={Users} title="Nog geen contacten" text="Voeg klanten, leveranciers en partners toe." action={<button className="btn btn-primary" onClick={() => setModal({})}><Plus size={16} /> Nieuw contact</button>} />
      ) : (
        <div className="split">
          <div className="split-list card">
            <div className="search-input"><Search size={15} /><input placeholder="Zoek op naam, bedrijf, e-mail…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <div className="row gap-s">
              <select className="select-sm grow" value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="">Alle soorten</option>
                <option value="persoon">Personen</option>
                <option value="bedrijf">Bedrijven</option>
              </select>
              <select className="select-sm grow" value={tag} onChange={(e) => setTag(e.target.value)}>
                <option value="">Alle tags</option>
                {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="split-items">
              {list.map((c) => (
                <button key={c.id} className={cx('contact-item', c.id === selectedId && 'active')} onClick={() => go('contacts', { id: c.id })}>
                  <span className={cx('contact-avatar sm', c.kind)}>{c.kind === 'bedrijf' ? <Building2 size={15} /> : <User size={15} />}</span>
                  <span className="grow ellipsis">
                    <strong>{c.name}</strong>
                    <span className="muted small block ellipsis">{c.kind === 'persoon' ? c.company || c.email || '' : c.email || c.phone || ''}</span>
                  </span>
                </button>
              ))}
              {!list.length && <p className="muted small pad">Niets gevonden.</p>}
            </div>
          </div>
          <div className="split-detail">
            {selected
              ? <ContactDetail contact={selected} onEdit={() => setModal(selected)} go={go} openTask={openTask} />
              : <Empty icon={Users} title="Kies een contact" text="Selecteer links een contact om de details te zien." />}
          </div>
        </div>
      )}
      {modal && <ContactModal contact={modal} onClose={() => setModal(null)} onSaved={(c) => go('contacts', { id: c.id })} />}
    </div>
  );
}
