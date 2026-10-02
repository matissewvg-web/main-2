import { useEffect, useMemo, useState } from 'react';
import { Plus, Download, Search, Wallet, TrendingUp, TrendingDown, Clock, Paperclip, Trash2, BarChart3, Table2, AlertTriangle, ExternalLink, Upload } from 'lucide-react';
import { api, openFile, uploadFile } from '../api';
import { useData, useToast } from '../store';
import { TX_CATEGORIES, centsCsv, cx, daysUntil, downloadCsv, fmtDate, fmtMoney, fmtMoneyShort, localDateStr, todayStr } from '../util';
import { ContactSelect, Empty, Field, Modal, PageHeader, ProjectSelect, TagChips, TagPicker, confirmDialog } from '../components/ui';
import { BarList, ColumnChart, Legend } from '../components/Charts';
import { MoneyInput } from './Inventory';

const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

function periodRange(id) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const d = (yy, mm, dd) => localDateStr(new Date(yy, mm, dd));
  switch (id) {
    case 'month': return [d(y, m, 1), d(y, m + 1, 0)];
    case 'lastmonth': return [d(y, m - 1, 1), d(y, m, 0)];
    case 'quarter': { const q = Math.floor(m / 3) * 3; return [d(y, q, 1), d(y, q + 3, 0)]; }
    case 'year': return [d(y, 0, 1), d(y, 11, 31)];
    case 'lastyear': return [d(y - 1, 0, 1), d(y - 1, 11, 31)];
    default: return [null, null];
  }
}

const PERIODS = [
  ['month', 'Deze maand'], ['lastmonth', 'Vorige maand'], ['quarter', 'Dit kwartaal'],
  ['year', 'Dit jaar'], ['lastyear', 'Vorig jaar'], ['all', 'Alles'],
];

export const txOverdue = (t) => t.status === 'open' && t.due_date && daysUntil(t.due_date) < 0;

function TxModal({ tx, onClose }) {
  const { transactions } = useData();
  const toast = useToast();
  const [t, setT] = useState(() => ({
    kind: 'uitgave', amount_cents: 0, date: todayStr(), description: '', category: '', contact_id: null, project_id: null,
    status: 'betaald', due_date: '', vat_rate: null, file_path: null, tags: [], ...tx,
  }));
  const [uploading, setUploading] = useState(false);
  const isNew = !t.id;
  const set = (k) => (v) => setT((x) => ({ ...x, [k]: v?.target ? v.target.value : v }));
  const cats = [...new Set([...TX_CATEGORIES[t.kind], ...transactions.filter((x) => x.kind === t.kind).map((x) => x.category).filter(Boolean)])];
  const vat = t.vat_rate ? Math.round(t.amount_cents - t.amount_cents / (1 + t.vat_rate / 100)) : 0;

  const attach = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const year = (t.date || todayStr()).slice(0, 4);
      const folder = `Financiën/${year}`;
      await api.post('/files/folder', { path: '', name: 'Financiën' }).catch(() => {});
      await api.post('/files/folder', { path: 'Financiën', name: year }).catch(() => {});
      const r = await uploadFile(folder, file);
      set('file_path')(r.path);
      toast('Bijlage opgeslagen in Bestanden', 'ok');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!t.description.trim()) return toast('Vul een omschrijving in.', 'error');
    if (!t.amount_cents || t.amount_cents <= 0) return toast('Vul een bedrag groter dan 0 in.', 'error');
    const body = {
      kind: t.kind, amount_cents: t.amount_cents, date: t.date, description: t.description, category: t.category,
      contact_id: t.contact_id, project_id: t.project_id, status: t.status, due_date: t.status === 'open' ? t.due_date || null : null,
      vat_rate: t.vat_rate, file_path: t.file_path, tags: t.tags,
    };
    try {
      if (isNew) await api.post('/transactions', body);
      else await api.patch(`/transactions/${t.id}`, body);
      toast('Opgeslagen', 'ok');
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const remove = async () => {
    if (!(await confirmDialog(`"${t.description}" verwijderen?`))) return;
    await api.del(`/transactions/${t.id}`).catch((e) => toast(e.message, 'error'));
    onClose();
  };

  return (
    <Modal
      title={isNew ? (t.kind === 'inkomst' ? 'Nieuwe inkomst' : 'Nieuwe uitgave') : 'Transactie bewerken'}
      onClose={onClose}
      footer={<>{!isNew && <button className="btn btn-ghost-danger" onClick={remove}><Trash2 size={15} /> Verwijderen</button>}<span className="grow" /><button className="btn" onClick={onClose}>Annuleren</button><button className="btn btn-primary" onClick={save}>Opslaan</button></>}
    >
      <div className="form">
        <Field label="Soort" span>
          <div className="seg">
            <button type="button" className={cx('seg-btn', t.kind === 'inkomst' && 'on')} onClick={() => set('kind')('inkomst')}><TrendingUp size={14} /> Inkomst</button>
            <button type="button" className={cx('seg-btn', t.kind === 'uitgave' && 'on')} onClick={() => set('kind')('uitgave')}><TrendingDown size={14} /> Uitgave</button>
          </div>
        </Field>
        <Field label="Bedrag (incl. btw)"><MoneyInput autoFocus value={t.amount_cents} onChange={set('amount_cents')} /></Field>
        <Field label="Datum"><input type="date" value={t.date} onChange={set('date')} /></Field>
        <Field label="Omschrijving" span><input value={t.description} onChange={set('description')} placeholder={t.kind === 'inkomst' ? 'Bijv. Factuur 2026-014 Jansen Bouw' : 'Bijv. Huur oktober'} /></Field>
        <Field label="Categorie">
          <input list="tb5-txcats" value={t.category || ''} onChange={set('category')} placeholder="Kies of typ een nieuwe" />
          <datalist id="tb5-txcats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Btw" hint={t.vat_rate ? `Waarvan btw ${fmtMoney(vat)} · excl. ${fmtMoney(t.amount_cents - vat)}` : 'Alleen ter informatie'}>
          <select value={t.vat_rate ?? ''} onChange={(e) => set('vat_rate')(e.target.value === '' ? null : Number(e.target.value))}>
            <option value="">Niet ingevuld</option>
            <option value="21">21%</option>
            <option value="9">9%</option>
            <option value="0">0% / vrijgesteld</option>
          </select>
        </Field>
        <Field label="Status">
          <div className="seg">
            <button type="button" className={cx('seg-btn', t.status === 'betaald' && 'on')} onClick={() => set('status')('betaald')}>Betaald</button>
            <button type="button" className={cx('seg-btn', t.status === 'open' && 'on')} onClick={() => set('status')('open')}>{t.kind === 'inkomst' ? 'Nog te ontvangen' : 'Nog te betalen'}</button>
          </div>
        </Field>
        {t.status === 'open' ? <Field label="Vervaldatum"><input type="date" value={t.due_date || ''} onChange={set('due_date')} /></Field> : <div />}
        <Field label={t.kind === 'inkomst' ? 'Klant' : 'Leverancier'}><ContactSelect value={t.contact_id} onChange={set('contact_id')} /></Field>
        <Field label="Project"><ProjectSelect value={t.project_id} onChange={set('project_id')} /></Field>
        <Field label="Bijlage (factuur / bon)" span>
          <div className="row gap-s">
            {t.file_path ? (
              <>
                <button type="button" className="link" onClick={() => openFile(t.file_path).catch((e) => toast(e.message, 'error'))}><Paperclip size={14} /> {t.file_path.split('/').pop()} <ExternalLink size={12} /></button>
                <button type="button" className="btn btn-sm" onClick={() => set('file_path')(null)}>Loskoppelen</button>
              </>
            ) : (
              <label className="btn btn-sm">
                <Upload size={14} /> {uploading ? 'Uploaden…' : 'Bestand kiezen'}
                <input type="file" hidden onChange={(e) => attach(e.target.files[0])} />
              </label>
            )}
            <span className="muted small">Wordt opgeslagen in Bestanden/Financiën/{(t.date || todayStr()).slice(0, 4)}</span>
          </div>
        </Field>
        <Field label="Tags" span><TagPicker value={t.tags} onChange={set('tags')} /></Field>
      </div>
    </Modal>
  );
}

export default function Finance({ params }) {
  const { transactions, maps, tags } = useData();
  const [period, setPeriod] = useState(() => { try { return localStorage.getItem('tb5-fin-period') || 'year'; } catch { return 'year'; } });
  const [kind, setKind] = useState('');
  const [cat, setCat] = useState('');
  const [status, setStatus] = useState('');
  const [tag, setTag] = useState('');
  const [q, setQ] = useState('');
  const [chartView, setChartView] = useState('chart');
  const [edit, setEdit] = useState(null);

  useEffect(() => {
    if (params?.id) setEdit(maps.transactions[params.id] || null);
    if (params?.new) setEdit({ kind: params.new === 'inkomst' ? 'inkomst' : 'uitgave' });
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const choosePeriod = (p) => { setPeriod(p); try { localStorage.setItem('tb5-fin-period', p); } catch {} };
  const [from, to] = periodRange(period);
  const categories = [...new Set(transactions.map((t) => t.category).filter(Boolean))].sort();

  // Every number on this page uses the same filtered slice.
  const filtered = useMemo(() => transactions.filter((t) => {
    if (from && (t.date < from || t.date > to)) return false;
    if (kind && t.kind !== kind) return false;
    if (cat && t.category !== cat) return false;
    if (tag && !t.tags.includes(Number(tag))) return false;
    if (status === 'open' && t.status !== 'open') return false;
    if (status === 'betaald' && t.status !== 'betaald') return false;
    if (status === 'telaat' && !txOverdue(t)) return false;
    if (q && !`${t.description} ${t.category || ''} ${maps.contacts[t.contact_id]?.name || ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [transactions, from, to, kind, cat, tag, status, q, maps.contacts]);

  const income = filtered.filter((t) => t.kind === 'inkomst').reduce((s, t) => s + t.amount_cents, 0);
  const expense = filtered.filter((t) => t.kind === 'uitgave').reduce((s, t) => s + t.amount_cents, 0);
  const openIn = transactions.filter((t) => t.kind === 'inkomst' && t.status === 'open');
  const openOut = transactions.filter((t) => t.kind === 'uitgave' && t.status === 'open');
  const overdue = transactions.filter(txOverdue);

  // 12 monthly columns ending at the period's end (or this month).
  const end = to ? new Date(to + 'T00:00:00') : new Date();
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const dt = new Date(end.getFullYear(), end.getMonth() - i, 1);
    months.push({ key: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`, label: `${MONTHS[dt.getMonth()]}${dt.getMonth() === 0 || i === 11 ? ` '${String(dt.getFullYear()).slice(2)}` : ''}` });
  }
  const monthly = months.map((m) => {
    const inMonth = transactions.filter((t) => t.date.startsWith(m.key) && (!kind || t.kind === kind) && (!cat || t.category === cat) && (!tag || t.tags.includes(Number(tag))));
    return {
      label: m.label,
      values: [
        inMonth.filter((t) => t.kind === 'inkomst').reduce((s, t) => s + t.amount_cents, 0),
        inMonth.filter((t) => t.kind === 'uitgave').reduce((s, t) => s + t.amount_cents, 0),
      ],
    };
  });
  const series = [{ name: 'Inkomsten', color: 'var(--series-1)' }, { name: 'Uitgaven', color: 'var(--series-2)' }];

  const byCat = (k) => {
    const m = new Map();
    for (const t of filtered.filter((x) => x.kind === k)) m.set(t.category || 'Zonder categorie', (m.get(t.category || 'Zonder categorie') || 0) + t.amount_cents);
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  };

  const exportCsv = () => downloadCsv(`financien-${period}-${todayStr()}.csv`, [
    ['Datum', 'Soort', 'Omschrijving', 'Categorie', 'Bedrag', 'Btw %', 'Status', 'Vervaldatum', 'Contact', 'Project', 'Bijlage'],
    ...filtered.map((t) => [t.date, t.kind, t.description, t.category, centsCsv(t.kind === 'uitgave' ? -t.amount_cents : t.amount_cents), t.vat_rate ?? '', t.status, t.due_date || '', maps.contacts[t.contact_id]?.name || '', maps.projects[t.project_id]?.name || '', t.file_path || '']),
  ]);

  return (
    <div className="page">
      <PageHeader title="Financiën" subtitle="Inkomsten, uitgaven en openstaande bedragen. Geen boekhouding: je boekhouder blijft nodig.">
        <button className="btn" onClick={exportCsv} disabled={!filtered.length}><Download size={15} /> Excel (CSV)</button>
        <button className="btn" onClick={() => setEdit({ kind: 'inkomst' })}><Plus size={16} /> Inkomst</button>
        <button className="btn btn-primary" onClick={() => setEdit({ kind: 'uitgave' })}><Plus size={16} /> Uitgave</button>
      </PageHeader>

      <div className="filters">
        <div className="seg">
          {PERIODS.map(([id, label]) => <button key={id} className={cx('seg-btn', period === id && 'on')} onClick={() => choosePeriod(id)}>{label}</button>)}
        </div>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Inkomsten + uitgaven</option>
          <option value="inkomst">Alleen inkomsten</option>
          <option value="uitgave">Alleen uitgaven</option>
        </select>
        <select value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Alle categorieën</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Elke status</option>
          <option value="betaald">Betaald</option>
          <option value="open">Openstaand</option>
          <option value="telaat">Te laat</option>
        </select>
        <select value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">Alle tags</option>
          {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div className="search-input"><Search size={15} /><input placeholder="Zoek…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>

      {!transactions.length ? (
        <Empty icon={Wallet} title="Nog geen transacties" text="Leg inkomsten en uitgaven vast, met factuur of bon als bijlage. Zo zie je per maand waar het geld heen gaat en wat er nog openstaat." action={<button className="btn btn-primary" onClick={() => setEdit({ kind: 'uitgave' })}><Plus size={16} /> Eerste transactie</button>} />
      ) : (
        <>
          <div className="stats">
            <div className="stat"><TrendingUp size={18} /><span className="stat-value">{fmtMoney(income, true)}</span><span className="stat-label">Inkomsten ({PERIODS.find((p) => p[0] === period)[1].toLowerCase()})</span></div>
            <div className="stat"><TrendingDown size={18} /><span className="stat-value">{fmtMoney(expense, true)}</span><span className="stat-label">Uitgaven</span></div>
            <div className={cx('stat', income - expense < 0 ? 'stat-danger' : 'stat-ok')}><Wallet size={18} /><span className="stat-value">{fmtMoney(income - expense, true)}</span><span className="stat-label">Resultaat {income - expense < 0 ? '(verlies)' : '(winst)'}</span></div>
            <button className={cx('stat', overdue.length ? 'stat-danger' : 'stat-default')} onClick={() => setStatus(status === 'open' ? '' : 'open')}>
              <Clock size={18} />
              <span className="stat-value">{fmtMoney(openIn.reduce((s, t) => s + t.amount_cents, 0), true)}</span>
              <span className="stat-label">Te ontvangen · te betalen {fmtMoney(openOut.reduce((s, t) => s + t.amount_cents, 0), true)}{overdue.length ? ` · ${overdue.length} te laat` : ''}</span>
            </button>
          </div>

          {overdue.length > 0 && (
            <div className="banner banner-error"><AlertTriangle size={15} /> {overdue.length} openstaande {overdue.length === 1 ? 'post is' : 'posten zijn'} over de vervaldatum. <button className="link" onClick={() => setStatus('telaat')}>Toon</button></div>
          )}

          <div className="dash-grid fin-grid">
            <section className="card">
              <div className="row card-title">
                <BarChart3 size={16} /><strong>Per maand</strong>
                <span className="grow" />
                <Legend series={series} />
                <div className="seg">
                  <button className={cx('seg-btn', chartView === 'chart' && 'on')} onClick={() => setChartView('chart')} title="Grafiek"><BarChart3 size={14} /></button>
                  <button className={cx('seg-btn', chartView === 'table' && 'on')} onClick={() => setChartView('table')} title="Tabel"><Table2 size={14} /></button>
                </div>
              </div>
              {chartView === 'chart' ? (
                <ColumnChart data={monthly} series={series} format={(v, axis) => (axis ? fmtMoneyShort(v) : fmtMoney(v))} />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Maand</th><th className="num">Inkomsten</th><th className="num">Uitgaven</th><th className="num">Resultaat</th></tr></thead>
                    <tbody>
                      {monthly.map((m) => (
                        <tr key={m.label}><td>{m.label}</td><td className="num">{fmtMoney(m.values[0])}</td><td className="num">{fmtMoney(m.values[1])}</td><td className={cx('num', m.values[0] - m.values[1] < 0 && 'neg')}>{fmtMoney(m.values[0] - m.values[1])}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section className="card">
              <div className="row card-title"><strong>Uitgaven per categorie</strong></div>
              {byCat('uitgave').length ? <BarList rows={byCat('uitgave')} format={(v) => fmtMoney(v, true)} color="var(--series-2)" /> : <p className="muted small">Geen uitgaven in deze periode.</p>}
              <div className="row card-title fin-sub"><strong>Inkomsten per categorie</strong></div>
              {byCat('inkomst').length ? <BarList rows={byCat('inkomst')} format={(v) => fmtMoney(v, true)} color="var(--series-1)" /> : <p className="muted small">Geen inkomsten in deze periode.</p>}
            </section>
          </div>

          <div className="card table-wrap">
            <table className="table table-hover">
              <thead><tr><th>Datum</th><th>Omschrijving</th><th>Categorie</th><th>Status</th><th className="num">Bedrag</th></tr></thead>
              <tbody>
                {filtered.map((t) => {
                  const late = txOverdue(t);
                  return (
                    <tr key={t.id} onClick={() => setEdit(t)}>
                      <td className="nowrap">{fmtDate(t.date)}</td>
                      <td>
                        <strong>{t.description}</strong>
                        {t.file_path && <Paperclip size={12} className="muted inline-icon" />}
                        <span className="muted small block">{[maps.contacts[t.contact_id]?.name, maps.projects[t.project_id]?.name].filter(Boolean).join(' · ')}</span>
                        <TagChips ids={t.tags} />
                      </td>
                      <td className="muted">{t.category}</td>
                      <td>
                        {t.status === 'betaald' ? <span className="pill">Betaald</span>
                          : late ? <span className="pill pill-red"><AlertTriangle size={11} /> Te laat · {fmtDate(t.due_date)}</span>
                            : <span className="pill pill-blue">{t.kind === 'inkomst' ? 'Te ontvangen' : 'Te betalen'}{t.due_date ? ` · ${fmtDate(t.due_date)}` : ''}</span>}
                      </td>
                      <td className="num"><strong>{t.kind === 'uitgave' ? '−' : '+'} {fmtMoney(t.amount_cents)}</strong></td>
                    </tr>
                  );
                })}
                {!filtered.length && <tr><td colSpan={5} className="list-empty">Geen transacties in deze selectie.</td></tr>}
              </tbody>
              {filtered.length > 0 && (
                <tfoot><tr><td colSpan={4} className="muted">Totaal selectie ({filtered.length})</td><td className="num"><strong>{fmtMoney(income - expense)}</strong></td></tr></tfoot>
              )}
            </table>
          </div>
        </>
      )}
      {edit && <TxModal tx={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
