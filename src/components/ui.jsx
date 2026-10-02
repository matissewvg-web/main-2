import { useEffect, useRef, useState } from 'react';
import { X, Check, ChevronDown, Plus } from 'lucide-react';
import { api } from '../api';
import { useData, useToast } from '../store';
import { COLORS, PRIORITY, PRIORITIES, cx, deadlineInfo, initials } from '../util';

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cx('modal', wide && 'modal-wide')} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Sluiten"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint, span }) {
  return (
    <label className={cx('field', span && 'field-span')}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Avatar({ user, size = 24, title }) {
  if (!user) return null;
  return (
    <span
      className="avatar"
      title={title || user.name}
      style={{ width: size, height: size, background: user.color, fontSize: size * 0.42 }}
    >
      {initials(user.name)}
    </span>
  );
}

export function PriorityBadge({ value, compact }) {
  const p = PRIORITY[value] || PRIORITY.normaal;
  return (
    <span className="badge" style={{ '--c': p.color }} title={`Prioriteit: ${p.label}`}>
      <span className="dot" />
      {!compact && p.label}
    </span>
  );
}

export function StatusBadge({ status }) {
  if (!status) return null;
  return (
    <span className="badge" style={{ '--c': status.color }}>
      <span className="dot" />
      {status.label}
    </span>
  );
}

export function DeadlineBadge({ date, done }) {
  const info = deadlineInfo(date, done);
  if (!info) return null;
  return <span className={`deadline deadline-${info.tone}`}>{info.text}</span>;
}

export function TagChips({ ids }) {
  const { maps } = useData();
  if (!ids?.length) return null;
  return (
    <span className="tag-chips">
      {ids.map((id) => maps.tags[id]).filter(Boolean).map((t) => (
        <span key={t.id} className="tag" style={{ '--c': t.color }}>{t.name}</span>
      ))}
    </span>
  );
}

// Generic popover multi/single select used for tags, people and contacts.
function useOutside(ref, onOut) {
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && onOut();
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, onOut]);
}

export function MultiPicker({ options, value = [], onChange, placeholder = 'Kies…', renderChip, onCreate, createLabel = 'Nieuw' }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  useOutside(ref, () => setOpen(false));
  const selected = options.filter((o) => value.includes(o.id));
  const filtered = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
  const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  const exact = options.some((o) => o.label.toLowerCase() === q.trim().toLowerCase());
  const create = async () => {
    const id = await onCreate(q.trim());
    if (id != null) {
      onChange([...value, id]);
      setQ('');
    }
  };
  return (
    <div className="picker" ref={ref}>
      <button type="button" className="picker-btn" onClick={() => setOpen(!open)}>
        {selected.length ? (
          <span className="picker-chips">
            {selected.map((o) => (renderChip ? renderChip(o) : <span key={o.id} className="tag" style={{ '--c': o.color || '#64748b' }}>{o.label}</span>))}
          </span>
        ) : (
          <span className="muted">{placeholder}</span>
        )}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="picker-pop">
          {(options.length > 6 || onCreate) && (
            <input
              autoFocus
              className="picker-search"
              placeholder={onCreate ? 'Zoek of maak nieuw…' : 'Zoeken…'}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                if (filtered.length === 1 && !value.includes(filtered[0].id)) toggle(filtered[0].id);
                else if (onCreate && q.trim() && !exact) create();
              }}
            />
          )}
          <div className="picker-list">
            {filtered.map((o) => (
              <button type="button" key={o.id} className="picker-item" onClick={() => toggle(o.id)}>
                <span className="check">{value.includes(o.id) && <Check size={14} />}</span>
                {o.color && <span className="dot" style={{ background: o.color }} />}
                {o.label}
              </button>
            ))}
            {!filtered.length && !onCreate && <div className="picker-empty">Niets gevonden</div>}
            {onCreate && q.trim() && !exact && (
              <button type="button" className="picker-item picker-create" onClick={create}>
                <span className="check"><Plus size={14} /></span>{createLabel} “{q.trim()}”
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Anyone can create a tag right here; admins rename/recolor/delete them in Settings.
export function TagPicker({ value, onChange }) {
  const { tags, reload } = useData();
  const toast = useToast();
  const onCreate = async (name) => {
    try {
      const color = COLORS[tags.length % COLORS.length];
      const tag = await api.post('/tags', { name, color });
      await reload('tags');
      return tag.id;
    } catch (e) {
      toast(e.message, 'error');
      return null;
    }
  };
  return (
    <MultiPicker
      options={tags.map((t) => ({ id: t.id, label: t.name, color: t.color }))}
      value={value}
      onChange={onChange}
      placeholder="Geen tags"
      onCreate={onCreate}
      createLabel="Nieuwe tag"
    />
  );
}

export function AvatarStack({ ids = [], size = 22, max = 4 }) {
  const { maps } = useData();
  const users = ids.map((id) => maps.users[id]).filter(Boolean);
  if (!users.length) return null;
  return (
    <span className="avatar-stack" title={users.map((u) => u.name).join(', ')}>
      {users.slice(0, max).map((u) => <Avatar key={u.id} user={u} size={size} title={users.map((x) => x.name).join(', ')} />)}
      {users.length > max && <span className="avatar avatar-more" style={{ width: size, height: size, fontSize: size * 0.4 }}>+{users.length - max}</span>}
    </span>
  );
}

export function PeoplePicker({ value = [], onChange, placeholder = 'Niemand toegewezen' }) {
  const { users, maps } = useData();
  return (
    <MultiPicker
      options={users.filter((u) => u.active || value.includes(u.id)).map((u) => ({ id: u.id, label: u.name, color: u.color }))}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      renderChip={(o) => (
        <span key={o.id} className="person-chip"><Avatar user={maps.users[o.id]} size={18} />{o.label.split(' ')[0]}</span>
      )}
    />
  );
}

export function UserSelect({ value, onChange, placeholder = 'Niemand', allowEmpty = true }) {
  const { users } = useData();
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      {allowEmpty && <option value="">{placeholder}</option>}
      {users.filter((u) => u.active || u.id === value).map((u) => (
        <option key={u.id} value={u.id}>{u.name}</option>
      ))}
    </select>
  );
}

export function ProjectSelect({ value, onChange }) {
  const { projects } = useData();
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">Geen project</option>
      {projects.filter((p) => p.status !== 'afgerond' || p.id === value).map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );
}

export function ContactSelect({ value, onChange }) {
  const { contacts } = useData();
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">Geen contact</option>
      {contacts.map((c) => (
        <option key={c.id} value={c.id}>{c.name}{c.company && c.kind === 'persoon' ? ` (${c.company})` : ''}</option>
      ))}
    </select>
  );
}

export function PrioritySelect({ value, onChange }) {
  return (
    <div className="seg">
      {PRIORITIES.map((p) => (
        <button
          type="button"
          key={p.id}
          className={cx('seg-btn', value === p.id && 'on')}
          style={{ '--c': p.color }}
          onClick={() => onChange(p.id)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="empty">
      {Icon && <Icon size={36} strokeWidth={1.5} />}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      <div className="page-actions">{children}</div>
    </header>
  );
}

// Promise-based confirm dialog that matches the app instead of the OS popup.
let confirmHandler = null;
export function confirmDialog(text, { okText = 'Verwijderen', danger = true } = {}) {
  return new Promise((resolve) => confirmHandler?.({ text, okText, danger, resolve }));
}

export function ConfirmHost() {
  const [req, setReq] = useState(null);
  useEffect(() => {
    confirmHandler = setReq;
    return () => { confirmHandler = null; };
  }, []);
  if (!req) return null;
  const done = (v) => { req.resolve(v); setReq(null); };
  return (
    <Modal
      title="Weet je het zeker?"
      onClose={() => done(false)}
      footer={
        <>
          <button className="btn" onClick={() => done(false)}>Annuleren</button>
          <button autoFocus className={cx('btn', req.danger ? 'btn-danger' : 'btn-primary')} onClick={() => done(true)}>{req.okText}</button>
        </>
      }
    >
      <p>{req.text}</p>
    </Modal>
  );
}
