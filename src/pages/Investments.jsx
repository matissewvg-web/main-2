import { useEffect, useMemo, useState } from 'react';
import { Plus, Download, TrendingUp, PiggyBank, Coins, Pencil, Trash2, Archive, AlertTriangle, Scale } from 'lucide-react';
import { api } from '../api';
import { useData, useToast } from '../store';
import {
  ENTRY_KIND, ENTRY_KINDS, INVESTMENT_KIND, INVESTMENT_KINDS, centsCsv, cx, daysUntil, downloadCsv, fmtDate, fmtMoney,
  fmtMoneyShort, fmtNum, fmtPct, investmentSummary, todayStr,
} from '../util';
import { Empty, Field, Modal, PageHeader, TagChips, TagPicker, confirmDialog } from '../components/ui';
import { BarList, LineChart } from '../components/Charts';
import { MoneyInput } from './Inventory';

const STALE_DAYS = 90;

function InvestmentModal({ inv, onClose, onSaved }) {
  const toast = useToast();
  const [v, setV] = useState(() => ({ name: '', kind: 'aandelen', ticker: '', notes: '', tags: [], amount: 0, date: todayStr(), quantity: '', ...inv }));
  const isNew = !v.id;
  const set = (k) => (x) => setV((s) => ({ ...s, [k]: x?.target ? x.target.value : x }));
  const save = async () => {
    if (!v.name.trim()) return toast('Geef de investering een naam.', 'error');
    try {
      const body = { name: v.name, kind: v.kind, ticker: v.ticker, notes: v.notes, tags: v.tags };
      const saved = isNew ? await api.post('/investments', body) : await api.patch(`/investments/${v.id}`, body);
      if (isNew && v.amount > 0) {
        await api.post('/investment_entries', { investment_id: saved.id, kind: 'aankoop', date: v.date, amount_cents: v.amount, quantity: Number(String(v.quantity).replace(',', '.')) || null, note: 'Eerste inleg' });
      }
      toast('Opgeslagen', 'ok');
      onSaved?.(saved);
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  return (
    <Modal title={isNew ? 'Nieuwe investering' : 'Investering bewerken'} onClose={onClose} footer={<><span className="grow" /><button className="btn" onClick={onClose}>Annuleren</button><button className="btn btn-primary" onClick={save}>Opslaan</button></>}>
      <div className="form">
        <Field label="Naam" span><input autoFocus value={v.name} onChange={set('name')} placeholder="Bijv. Vanguard FTSE All-World" /></Field>
        <Field label="Soort">
          <select value={v.kind} onChange={set('kind')}>{INVESTMENT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select>
        </Field>
        <Field label="Ticker / kenmerk"><input value={v.ticker || ''} onChange={set('ticker')} placeholder="Bijv. VWRL, BTC, Pand Kerkstraat" /></Field>
        {isNew && (
          <>
            <Field label="Eerste inleg"><MoneyInput value={v.amount} onChange={set('amount')} /></Field>
            <Field label="Datum inleg"><input type="date" value={v.date} onChange={set('date')} /></Field>
            <Field label="Aantal (optioneel)" hint="Stuks, coins, aandelen"><input inputMode="decimal" value={v.quantity} onChange={set('quantity')} /></Field>
          </>
        )}
        <Field label="Tags" span><TagPicker value={v.tags} onChange={set('tags')} /></Field>
        <Field label="Notities" span><textarea rows={3} value={v.notes || ''} onChange={set('notes')} placeholder="Strategie, broker, afspraken…" /></Field>
      </div>
    </Modal>
  );
}

function EntryModal({ inv, kind: initialKind, entry, onClose }) {
  const toast = useToast();
  const [e, setE] = useState(() => ({ kind: initialKind || 'waarde', date: todayStr(), amount_cents: 0, quantity: '', note: '', ...entry }));
  const set = (k) => (x) => setE((s) => ({ ...s, [k]: x?.target ? x.target.value : x }));
  const hint = {
    aankoop: 'Wat je erin hebt gestoken (incl. kosten).',
    verkoop: 'Wat je eruit hebt gehaald.',
    dividend: 'Ontvangen dividend, rente of huur.',
    waarde: 'Wat de hele positie nu waard is. Kijk dit na bij je broker of bank.',
  }[e.kind];
  const save = async () => {
    if (!e.amount_cents || e.amount_cents < 0) return toast('Vul een bedrag in.', 'error');
    const body = { investment_id: inv.id, kind: e.kind, date: e.date, amount_cents: e.amount_cents, quantity: Number(String(e.quantity ?? '').replace(',', '.')) || null, note: e.note };
    try {
      if (e.id) await api.patch(`/investment_entries/${e.id}`, body);
      else await api.post('/investment_entries', body);
      toast('Opgeslagen', 'ok');
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  return (
    <Modal title={`${inv.name}: ${ENTRY_KIND[e.kind].label.toLowerCase()}`} onClose={onClose} footer={<><span className="grow" /><button className="btn" onClick={onClose}>Annuleren</button><button className="btn btn-primary" onClick={save}>Opslaan</button></>}>
      <div className="form">
        <Field label="Soort" span>
          <div className="seg">
            {ENTRY_KINDS.map((k) => <button type="button" key={k.id} className={cx('seg-btn', e.kind === k.id && 'on')} onClick={() => set('kind')(k.id)}>{k.label.split(' ')[0]}</button>)}
          </div>
        </Field>
        <Field label={e.kind === 'waarde' ? 'Huidige totale waarde' : 'Bedrag'} hint={hint}><MoneyInput autoFocus value={e.amount_cents} onChange={set('amount_cents')} /></Field>
        <Field label="Datum"><input type="date" value={e.date} onChange={set('date')} /></Field>
        {(e.kind === 'aankoop' || e.kind === 'verkoop') && <Field label="Aantal (optioneel)"><input inputMode="decimal" value={e.quantity ?? ''} onChange={set('quantity')} /></Field>}
        <Field label="Notitie" span><input value={e.note || ''} onChange={set('note')} /></Field>
      </div>
    </Modal>
  );
}

function InvestmentDetail({ inv, entries, onClose, onEdit }) {
  const toast = useToast();
  const [entryModal, setEntryModal] = useState(null);
  const s = investmentSummary(entries);
  const stale = s.valueDate && -daysUntil(s.valueDate) > STALE_DAYS;

  const removeEntry = async (en) => {
    if (!(await confirmDialog(`Deze regel (${ENTRY_KIND[en.kind].label.toLowerCase()} ${fmtMoney(en.amount_cents)}) verwijderen?`))) return;
    api.del(`/investment_entries/${en.id}`).catch((e) => toast(e.message, 'error'));
  };
  const archive = async () => {
    await api.patch(`/investments/${inv.id}`, { archived: inv.archived ? 0 : 1 }).catch((e) => toast(e.message, 'error'));
    onClose();
  };
  const remove = async () => {
    if (!(await confirmDialog(`"${inv.name}" met alle regels definitief verwijderen? Archiveren bewaart de historie.`))) return;
    await api.del(`/investments/${inv.id}`).catch((e) => toast(e.message, 'error'));
    onClose();
  };

  return (
    <>
      <Modal wide title={inv.name} onClose={onClose} footer={
        <>
          <button className="btn btn-ghost-danger" onClick={remove}><Trash2 size={15} /> Verwijderen</button>
          <button className="btn" onClick={archive}><Archive size={15} /> {inv.archived ? 'Terugzetten' : 'Archiveren (verkocht)'}</button>
          <span className="grow" />
          <button className="btn" onClick={onEdit}><Pencil size={15} /> Bewerken</button>
        </>
      }>
        <p className="muted small">{INVESTMENT_KIND[inv.kind]?.label}{inv.ticker && ` · ${inv.ticker}`}{s.units ? ` · ${fmtNum(s.units, 6)} stuks` : ''}</p>
        <div className="product-meta">
          <div><span className="muted small block">Ingelegd</span><strong className="big">{fmtMoney(s.invested)}</strong></div>
          <div><span className="muted small block">Huidige waarde</span><strong className="big">{fmtMoney(s.current)}</strong><span className="muted small block">{s.valueDate ? `gewaardeerd ${fmtDate(s.valueDate)}` : 'nog geen waardering'}</span></div>
          <div><span className="muted small block">Resultaat (incl. ontvangen {fmtMoney(s.received)})</span><strong className={cx('big', s.result < 0 ? 'neg' : 'pos')}>{fmtMoney(s.result)}</strong> <span className={s.result < 0 ? 'neg' : 'pos'}>{fmtPct(s.pct)}</span></div>
        </div>
        {(stale || !s.valueDate) && (
          <div className="banner banner-warn"><AlertTriangle size={15} /> {s.valueDate ? `De laatste waardering is ${-daysUntil(s.valueDate)} dagen oud.` : 'Er is nog geen waardering, dus de waarde staat gelijk aan je inleg.'} Voeg een actuele waardering toe voor een eerlijk beeld.</div>
        )}
        <div className="row gap-s">
          <button className="btn btn-primary btn-sm" onClick={() => setEntryModal({ kind: 'waarde' })}><Scale size={14} /> Nieuwe waardering</button>
          <button className="btn btn-sm" onClick={() => setEntryModal({ kind: 'aankoop' })}><Plus size={14} /> Aankoop</button>
          <button className="btn btn-sm" onClick={() => setEntryModal({ kind: 'verkoop' })}>Verkoop</button>
          <button className="btn btn-sm" onClick={() => setEntryModal({ kind: 'dividend' })}><Coins size={14} /> Dividend / rente</button>
        </div>
        <LineChart points={s.history} format={(v, axis) => (axis ? fmtMoneyShort(v) : fmtMoney(v))} fmtX={(d) => fmtDate(d)} name="Waarde" />
        <div className="table-wrap">
          <table className="table table-hover">
            <thead><tr><th>Datum</th><th>Soort</th><th className="num">Bedrag</th><th className="num">Aantal</th><th>Notitie</th><th /></tr></thead>
            <tbody>
              {[...entries].reverse().map((en) => (
                <tr key={en.id} onClick={() => setEntryModal({ entry: en })}>
                  <td>{fmtDate(en.date)}</td>
                  <td>{ENTRY_KIND[en.kind]?.label}</td>
                  <td className="num">{fmtMoney(en.amount_cents)}</td>
                  <td className="num muted">{en.quantity ? fmtNum(en.quantity, 6) : ''}</td>
                  <td className="muted">{en.note}</td>
                  <td onClick={(ev) => ev.stopPropagation()}><button className="icon-btn ghost" onClick={() => removeEntry(en)}><Trash2 size={14} /></button></td>
                </tr>
              ))}
              {!entries.length && <tr><td colSpan={6} className="muted">Nog geen regels.</td></tr>}
            </tbody>
          </table>
        </div>
      </Modal>
      {entryModal && <EntryModal inv={inv} kind={entryModal.kind} entry={entryModal.entry} onClose={() => setEntryModal(null)} />}
    </>
  );
}

// Portfolio total over time: at every date, each investment counts at its latest known value.
function portfolioHistory(investments, entriesByInv) {
  const dates = [...new Set(investments.flatMap((i) => (entriesByInv[i.id] || []).map((e) => e.date)))].sort();
  const hist = Object.fromEntries(investments.map((i) => [i.id, investmentSummary(entriesByInv[i.id] || []).history]));
  return dates.map((date) => ({
    date,
    value: investments.reduce((sum, i) => {
      const h = hist[i.id].filter((p) => p.date <= date);
      return sum + (h.length ? h[h.length - 1].value : 0);
    }, 0),
  }));
}

export default function Investments({ params }) {
  const { investments, investment_entries: entries, maps } = useData();
  const [showArchived, setShowArchived] = useState(false);
  const [edit, setEdit] = useState(null);
  const [detailId, setDetailId] = useState(params?.id || null);

  useEffect(() => { if (params?.id) setDetailId(params.id); if (params?.new) setEdit({}); }, [params]);

  const entriesByInv = useMemo(() => {
    const m = {};
    for (const e of entries) (m[e.investment_id] ||= []).push(e);
    for (const k in m) m[k].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    return m;
  }, [entries]);

  const active = investments.filter((i) => !i.archived);
  const visible = investments.filter((i) => showArchived || !i.archived);
  const summaries = Object.fromEntries(investments.map((i) => [i.id, investmentSummary(entriesByInv[i.id] || [])]));
  const tot = active.reduce((a, i) => {
    const s = summaries[i.id];
    return { invested: a.invested + s.invested, current: a.current + s.current, received: a.received + s.received, result: a.result + s.result };
  }, { invested: 0, current: 0, received: 0, result: 0 });
  const stale = active.filter((i) => { const s = summaries[i.id]; return !s.valueDate || -daysUntil(s.valueDate) > STALE_DAYS; });

  const byKind = INVESTMENT_KINDS.map((k) => ({ label: k.label, value: active.filter((i) => i.kind === k.id).reduce((s, i) => s + summaries[i.id].current, 0) })).filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  const history = portfolioHistory(active, entriesByInv);
  const detail = maps.investments[detailId];

  const exportCsv = () => downloadCsv(`investeringen-${todayStr()}.csv`, [
    ['Naam', 'Soort', 'Ticker', 'Ingelegd', 'Ontvangen', 'Huidige waarde', 'Gewaardeerd op', 'Resultaat', 'Rendement %'],
    ...visible.map((i) => { const s = summaries[i.id]; return [i.name, INVESTMENT_KIND[i.kind]?.label, i.ticker, centsCsv(s.invested), centsCsv(s.received), centsCsv(s.current), s.valueDate || '', centsCsv(s.result), (s.pct * 100).toFixed(1).replace('.', ',')]; }),
  ]);

  return (
    <div className="page">
      <PageHeader title="Investeringen" subtitle="Je vult zelf waarderingen in, er zijn geen live koersen. De cijfers zijn zo actueel als je laatste waardering.">
        <button className="btn" onClick={exportCsv} disabled={!visible.length}><Download size={15} /> Excel (CSV)</button>
        <button className="btn btn-primary" onClick={() => setEdit({})}><Plus size={16} /> Nieuwe investering</button>
      </PageHeader>

      {!investments.length ? (
        <Empty icon={TrendingUp} title="Nog geen investeringen" text="Voeg een investering toe met je inleg. Werk daarna af en toe de waarde bij, en de app rekent resultaat en rendement uit." action={<button className="btn btn-primary" onClick={() => setEdit({})}><Plus size={16} /> Nieuwe investering</button>} />
      ) : (
        <>
          <div className="stats">
            <div className="stat"><PiggyBank size={18} /><span className="stat-value">{fmtMoney(tot.invested, true)}</span><span className="stat-label">Totaal ingelegd</span></div>
            <div className="stat"><TrendingUp size={18} /><span className="stat-value">{fmtMoney(tot.current, true)}</span><span className="stat-label">Huidige waarde</span></div>
            <div className={cx('stat', tot.result < 0 ? 'stat-danger' : 'stat-ok')}><Scale size={18} /><span className="stat-value">{fmtMoney(tot.result, true)}</span><span className="stat-label">Resultaat {tot.invested ? fmtPct(tot.result / tot.invested) : ''}</span></div>
            <div className="stat"><Coins size={18} /><span className="stat-value">{fmtMoney(tot.received, true)}</span><span className="stat-label">Ontvangen (verkoop + dividend)</span></div>
          </div>

          {stale.length > 0 && (
            <div className="banner banner-warn"><AlertTriangle size={15} /> {stale.length} {stale.length === 1 ? 'investering heeft' : 'investeringen hebben'} geen waardering van de laatste {STALE_DAYS} dagen: {stale.map((i) => i.name).join(', ')}. De totale waarde kan daardoor niet kloppen.</div>
          )}

          <div className="dash-grid fin-grid">
            <section className="card">
              <div className="row card-title"><TrendingUp size={16} /><strong>Waarde portefeuille</strong></div>
              <LineChart points={history} format={(v, axis) => (axis ? fmtMoneyShort(v) : fmtMoney(v))} fmtX={(d) => fmtDate(d)} name="Totale waarde" />
            </section>
            <section className="card">
              <div className="row card-title"><strong>Verdeling naar soort</strong></div>
              {byKind.length ? <BarList rows={byKind} format={(v) => `${fmtMoney(v, true)} · ${Math.round((v / tot.current) * 100)}%`} /> : <p className="muted small">Nog geen waarde.</p>}
            </section>
          </div>

          <div className="row gap-s"><span className="grow" /><label className="row gap-xs small"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Toon gearchiveerd</label></div>
          <div className="card table-wrap">
            <table className="table table-hover">
              <thead><tr><th>Investering</th><th>Soort</th><th className="num">Ingelegd</th><th className="num">Waarde</th><th className="num">Resultaat</th><th className="num">Rendement</th></tr></thead>
              <tbody>
                {visible.map((i) => {
                  const s = summaries[i.id];
                  const old = !s.valueDate || -daysUntil(s.valueDate) > STALE_DAYS;
                  return (
                    <tr key={i.id} className={cx(i.archived && 'archived')} onClick={() => setDetailId(i.id)}>
                      <td><strong>{i.name}</strong>{i.ticker && <span className="muted small"> · {i.ticker}</span>} <TagChips ids={i.tags} /></td>
                      <td className="muted">{INVESTMENT_KIND[i.kind]?.label}</td>
                      <td className="num">{fmtMoney(s.invested)}</td>
                      <td className="num">
                        {fmtMoney(s.current)}
                        <span className={cx('muted small block', old && 'warn-text')}>{s.valueDate ? fmtDate(s.valueDate) : 'geen waardering'}{old && ' ⚠'}</span>
                      </td>
                      <td className={cx('num', s.result < 0 ? 'neg' : 'pos')}>{fmtMoney(s.result)}</td>
                      <td className={cx('num', s.result < 0 ? 'neg' : 'pos')}>{fmtPct(s.pct)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {detail && !edit && <InvestmentDetail inv={detail} entries={entriesByInv[detail.id] || []} onClose={() => setDetailId(null)} onEdit={() => setEdit(detail)} />}
      {edit && <InvestmentModal inv={edit} onClose={() => setEdit(null)} onSaved={(s) => !edit.id && setDetailId(s.id)} />}
    </div>
  );
}
