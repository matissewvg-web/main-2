import { useEffect, useRef, useState } from 'react';
import { X, Check, ChevronDown } from 'lucide-react';
import { useData } from '../store';
import { PRIORITY, PRIORITIES, cx, deadlineInfo, initials } from '../util';

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

export function MultiPicker({ options, value = [], onChange, placeholder = 'Kies…', renderChip }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  useOutside(ref, () => setOpen(false));
  const selected = options.filter((o) => value.includes(o.id));
  const filtered = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
  const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
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
          {options.length > 6 && <input autoFocus className="picker-search" placeholder="Zoeken…" value={q} onChange={(e) => setQ(e.target.value)} />}
          <div className="picker-list">
            {filtered.map((o) => (
              <button type="button" key={o.id} className="picker-item" onClick={() => toggle(o.id)}>
                <span className="check">{value.includes(o.id) && <Check size={14} />}</span>
                {o.color && <span className="dot" style={{ background: o.color }} />}
                {o.label}
              </button>
            ))}
            {!filtered.length && <div className="picker-empty">Niets gevonden</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export function TagPicker({ value, onChange }) {
  const { tags } = useData();
  return (
    <MultiPicker
      options={tags.map((t) => ({ id: t.id, label: t.name, color: t.color }))}
      value={value}
      onChange={onChange}
      placeholder="Geen tags"
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
