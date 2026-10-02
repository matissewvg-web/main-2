import { useEffect, useMemo, useState } from 'react';
import { Plus, Download, Rocket, Target, HandCoins, Banknote, CalendarClock, Pencil, Trash2, LayoutGrid, Table2, AlertTriangle } from 'lucide-react';
import { api } from '../api';
import { useData, useToast } from '../store';
import { FUNDING_KIND, FUNDING_KINDS, FUNDING_STAGE, FUNDING_STAGES, centsCsv, cx, daysUntil, downloadCsv, fmtMoney, todayStr } from '../util';
import { Avatar, ContactSelect, DeadlineBadge, Empty, Field, Modal, PageHeader, TagChips, TagPicker, UserSelect, confirmDialog } from '../components/ui';
import { MoneyInput } from './Inventory';

const OPEN_STAGES = ['lead', 'contact', 'pitch', 'dd', 'toezegging'];

function RoundModal({ round, onClose, onSaved }) {
  const toast = useToast();
  const [r, setR] = useState(() => ({ name: '', target_cents: 0, deadline: '', status: 'actief', notes: '', ...round }));
  const isNew = !r.id;
  const set = (k) => (v) => setR((x) => ({ ...x, [k]: v?.target ? v.target.value : v }));
  const save = async () => {
    if (!r.name.trim()) return toast('Geef de ronde een naam.', 'error');
    try {
      const body = { name: r.name, target_cents: r.target_cents, deadline: r.deadline || null, status: r.status, notes: r.notes };
      const saved = isNew ? await api.post('/funding_rounds', body) : await api.patch(`/funding_rounds/${r.id}`, body);
      onSaved?.(saved);
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const remove = async () => {
    if (!(await confirmDialog(`Ronde "${r.name}" verwijderen? De investeerders blijven bestaan, maar zonder ronde.`))) return;
    await api.del(`/funding_rounds/${r.id}`).catch((e) => toast(e.message, 'error'));
    onSaved?.(null);
    onClose();
  };
  return (
    <Modal title={isNew ? 'Nieuwe financieringsronde' : 'Ronde bewerken'} onClose={onClose} footer={<>{!isNew && <button className="btn btn-ghost-danger" onClick={remove}><Trash2 size={15} /> Verwijderen</button>}<span className="grow" /><button className="btn" onClick={onClose}>Annuleren</button><button className="btn btn-primary" onClick={save}>Opslaan</button></>}>
      <div className="form">
        <Field label="Naam" span><input autoFocus value={r.name} onChange={set('name')} placeholder="Bijv. Seed 2027, Lening uitbreiding, Subsidie innovatie" /></Field>
        <Field label="Doelbedrag"><MoneyInput value={r.target_cents} onChange={set('target_cents')} /></Field>
        <Field label="Deadline"><input type="date" value={r.deadline || ''} onChange={set('deadline')} /></Field>
        <Field label="Status">
          <select value={r.status} onChange={set('status')}><option value="actief">Actief</option><option value="afgerond">Afgerond</option></select>
        </Field>
        <div />
        <Field label="Notities" span><textarea rows={3} value={r.notes || ''} onChange={set('notes')} placeholder="Waarvoor is het geld, welke voorwaarden, waardering…" /></Field>
      </div>
    </Modal>
  );
}

function LeadModal({ lead, onClose }) {
  const { funding_rounds: rounds, me } = useData();
  const toast = useToast();
  const [l, setL] = useState(() => ({
    name: '', kind: 'angel', round_id: rounds.find((r) => r.status === 'actief')?.id ?? null, contact_id: null, stage: 'lead',
    ask_cents: 0, committed_cents: 0, received_cents: 0, owner_id: me.id, next_step: '', next_date: '', notes: '', tags: [], ...lead,
  }));
  const isNew = !l.id;
  const set = (k) => (v) => setL((x) => ({ ...x, [k]: v?.target ? v.target.value : v }));
  const save = async () => {
    if (!l.name.trim()) return toast('Geef de investeerder een naam.', 'error');
    const body = {
      name: l.name, kind: l.kind, round_id: l.round_id, contact_id: l.contact_id, stage: l.stage, ask_cents: l.ask_cents,
      committed_cents: l.committed_cents, received_cents: l.received_cents, owner_id: l.owner_id, next_step: l.next_step,
      next_date: l.next_date || null, notes: l.notes, tags: l.tags,
    };
    try {
      if (isNew) await api.post('/funding_leads', body);
      else await api.patch(`/funding_leads/${l.id}`, body);
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const remove = async () => {
    if (!(await confirmDialog(`"${l.name}" verwijderen?`))) return;
    await api.del(`/funding_leads/${l.id}`).catch((e) => toast(e.message, 'error'));
    onClose();
  };
  return (
    <Modal title={isNew ? 'Nieuwe investeerder / financier' : l.name} onClose={onClose} footer={<>{!isNew && <button className="btn btn-ghost-danger" onClick={remove}><Trash2 size={15} /> Verwijderen</button>}<span className="grow" /><button className="btn" onClick={onClose}>Annuleren</button><button className="btn btn-primary" onClick={save}>Opslaan</button></>}>
      <div className="form">
        <Field label="Naam" span><input autoFocus value={l.name} onChange={set('name')} placeholder="Bijv. Rabobank, Jan de Vries (angel), RVO Innovatiekrediet" /></Field>
        <Field label="Soort"><select value={l.kind} onChange={set('kind')}>{FUNDING_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select></Field>
        <Field label="Ronde">
          <select value={l.round_id ?? ''} onChange={(e) => set('round_id')(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Geen ronde</option>
            {rounds.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
        <Field label="Fase" span>
          <div className="seg">
            {FUNDING_STAGES.map((s) => <button type="button" key={s.id} className={cx('seg-btn', l.stage === s.id && 'on')} style={{ '--c': s.color }} onClick={() => set('stage')(s.id)}>{s.label}</button>)}
          </div>
        </Field>
        <Field label="Gevraagd bedrag"><MoneyInput value={l.ask_cents} onChange={set('ask_cents')} /></Field>
        <Field label="Toegezegd"><MoneyInput value={l.committed_cents} onChange={set('committed_cents')} /></Field>
        <Field label="Ontvangen (op de rekening)"><MoneyInput value={l.received_cents} onChange={set('received_cents')} /></Field>
        <Field label="Wie trekt dit?"><UserSelect value={l.owner_id} onChange={set('owner_id')} /></Field>
        <Field label="Volgende stap"><input value={l.next_step || ''} onChange={set('next_step')} placeholder="Bijv. pitchdeck sturen, terugbellen" /></Field>
        <Field label="Datum volgende stap"><input type="date" value={l.next_date || ''} onChange={set('next_date')} /></Field>
        <Field label="Contactpersoon" span><ContactSelect value={l.contact_id} onChange={set('contact_id')} /></Field>
        <Field label="Tags" span><TagPicker value={l.tags} onChange={set('tags')} /></Field>
        <Field label="Notities" span><textarea rows={4} value={l.notes || ''} onChange={set('notes')} placeholder="Gespreksverslag, voorwaarden, bezwaren, waardering…" /></Field>
      </div>
    </Modal>
  );
}

// Progress toward the round target: received (dark) + committed but not yet received (light).
function RoundMeter({ target, committed, received }) {
  const base = Math.max(target, committed, 1);
  const pctR = (Math.min(received, base) / base) * 100;
  const pctC = (Math.max(0, Math.min(committed, base) - Math.min(received, base)) / base) * 100;
  return (
    <div>
      <div className="meter" title={`Ontvangen ${fmtMoney(received)} · toegezegd ${fmtMoney(committed)} · doel ${fmtMoney(target)}`}>
        <span className="meter-received" style={{ width: `${pctR}%` }} />
        <span className="meter-committed" style={{ width: `${pctC}%` }} />
      </div>
      <div className="chart-legend meter-legend">
        <span className="row gap-xs"><span className="legend-rect meter-received" />Ontvangen {fmtMoney(received, true)}</span>
        <span className="row gap-xs"><span className="legend-rect meter-committed" />Toegezegd {fmtMoney(committed, true)}</span>
        <span className="grow" />
        <span>{target ? `${Math.round((committed / target) * 100)}% van ${fmtMoney(target, true)} toegezegd` : 'Geen doelbedrag'}</span>
      </div>
    </div>
  );
}

export default function Fundraising({ params }) {
  const { funding_rounds: rounds, funding_leads: leads, maps, patchLocal } = useData();
  const toast = useToast();
  const [roundId, setRoundId] = useState(() => { try { return localStorage.getItem('tb5-fund-round') || 'all'; } catch { return 'all'; } });
  const [view, setView] = useState('board');
  const [showLost, setShowLost] = useState(false);
  const [leadModal, setLeadModal] = useState(null);
  const [roundModal, setRoundModal] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [overStage, setOverStage] = useState(null);

  useEffect(() => {
    if (params?.id) setLeadModal(maps.funding_leads[params.id] || null);
    if (params?.newLead) setLeadModal({});
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps
  const pickRound = (id) => { setRoundId(String(id)); try { localStorage.setItem('tb5-fund-round', String(id)); } catch {} };

  const round = roundId !== 'all' ? maps.funding_rounds[Number(roundId)] : null;
  const scoped = useMemo(() => leads.filter((l) => !round || l.round_id === round.id), [leads, round]);
  const committed = scoped.filter((l) => l.stage !== 'afgewezen').reduce((s, l) => s + l.committed_cents, 0);
  const received = scoped.reduce((s, l) => s + l.received_cents, 0);
  const pipeline = scoped.filter((l) => OPEN_STAGES.includes(l.stage) && l.stage !== 'toezegging').reduce((s, l) => s + l.ask_cents, 0);
  const target = round ? round.target_cents : rounds.filter((r) => r.status === 'actief').reduce((s, r) => s + r.target_cents, 0);
  const nextSteps = scoped.filter((l) => l.next_date && OPEN_STAGES.includes(l.stage)).sort((a, b) => a.next_date.localeCompare(b.next_date));
  const overdue = nextSteps.filter((l) => daysUntil(l.next_date) < 0);

  // Moving a card forward fills in the obvious amounts, which can be corrected afterwards.
  const moveStage = (lead, stage) => {
    if (lead.stage === stage) return;
    const patch = { stage };
    if (stage === 'toezegging' && !lead.committed_cents) patch.committed_cents = lead.ask_cents;
    if (stage === 'binnen') {
      if (!lead.committed_cents) patch.committed_cents = lead.ask_cents;
      if (!lead.received_cents) patch.received_cents = lead.committed_cents || lead.ask_cents;
    }
    patchLocal('funding_leads', lead.id, patch);
    api.patch(`/funding_leads/${lead.id}`, patch).catch((e) => toast(e.message, 'error'));
    if (stage === 'binnen') toast(`🎉 ${lead.name} is binnen! Controleer het ontvangen bedrag.`, 'ok');
  };

  const stages = FUNDING_STAGES.filter((s) => showLost || s.id !== 'afgewezen');

  const exportCsv = () => downloadCsv(`fundraising-${todayStr()}.csv`, [
    ['Naam', 'Soort', 'Ronde', 'Fase', 'Gevraagd', 'Toegezegd', 'Ontvangen', 'Eigenaar', 'Volgende stap', 'Datum', 'Notities'],
    ...scoped.map((l) => [l.name, FUNDING_KIND[l.kind]?.label, maps.funding_rounds[l.round_id]?.name || '', FUNDING_STAGE[l.stage]?.label, centsCsv(l.ask_cents), centsCsv(l.committed_cents), centsCsv(l.received_cents), maps.users[l.owner_id]?.name || '', l.next_step || '', l.next_date || '', l.notes || '']),
  ]);

  return (
    <div className="page">
      <PageHeader title="Fundraising" subtitle="Geld ophalen: investeerders, banken, subsidies en crowdfunding per ronde">
        <button className="btn" onClick={exportCsv} disabled={!scoped.length}><Download size={15} /> Excel (CSV)</button>
        <button className="btn" onClick={() => setRoundModal({})}><Target size={15} /> Nieuwe ronde</button>
        <button className="btn btn-primary" onClick={() => setLeadModal({ round_id: round?.id ?? undefined })}><Plus size={16} /> Investeerder</button>
      </PageHeader>

      {!rounds.length && !leads.length ? (
        <Empty icon={Rocket} title="Nog geen fundraising" text="Maak eerst een ronde met een doelbedrag (bijv. 'Seed 2027 · € 250.000'). Voeg daarna iedereen toe die je benadert en verplaats ze door de pipeline tot het geld binnen is." action={<button className="btn btn-primary" onClick={() => setRoundModal({})}><Target size={16} /> Eerste ronde</button>} />
      ) : (
        <>
          <div className="filters">
            <div className="seg">
              <button className={cx('seg-btn', roundId === 'all' && 'on')} onClick={() => pickRound('all')}>Alle rondes</button>
              {rounds.map((r) => (
                <button key={r.id} className={cx('seg-btn', roundId === String(r.id) && 'on')} onClick={() => pickRound(r.id)}>{r.name}{r.status === 'afgerond' && ' ✓'}</button>
              ))}
            </div>
            {round && <button className="btn btn-sm" onClick={() => setRoundModal(round)}><Pencil size={13} /> Ronde bewerken</button>}
            <span className="grow" />
            <label className="row gap-xs small"><input type="checkbox" checked={showLost} onChange={(e) => setShowLost(e.target.checked)} /> Toon afgewezen</label>
            <div className="seg">
              <button className={cx('seg-btn', view === 'board' && 'on')} onClick={() => setView('board')}><LayoutGrid size={14} /> Pipeline</button>
              <button className={cx('seg-btn', view === 'table' && 'on')} onClick={() => setView('table')}><Table2 size={14} /> Tabel</button>
            </div>
          </div>

          <div className="stats">
            <div className="stat"><Target size={18} /><span className="stat-value">{fmtMoney(target, true)}</span><span className="stat-label">Doel{round?.deadline ? ` · deadline ${round.deadline.split('-').reverse().join('-')}` : round ? '' : ' (actieve rondes)'}</span></div>
            <div className="stat"><HandCoins size={18} /><span className="stat-value">{fmtMoney(committed, true)}</span><span className="stat-label">Toegezegd</span></div>
            <div className={cx('stat', received >= target && target > 0 && 'stat-ok')}><Banknote size={18} /><span className="stat-value">{fmtMoney(received, true)}</span><span className="stat-label">Ontvangen</span></div>
            <div className="stat"><Rocket size={18} /><span className="stat-value">{fmtMoney(pipeline, true)}</span><span className="stat-label">Nog in gesprek ({scoped.filter((l) => OPEN_STAGES.includes(l.stage) && l.stage !== 'toezegging').length})</span></div>
          </div>

          <div className="dash-grid fin-grid">
            <section className="card">
              <div className="row card-title"><Target size={16} /><strong>{round ? round.name : 'Voortgang actieve rondes'}</strong><span className="grow" />{round?.deadline && <DeadlineBadge date={round.deadline} done={round.status === 'afgerond'} />}</div>
              <RoundMeter target={target} committed={committed} received={received} />
              {target > 0 && committed < target && <p className="muted small">Nog {fmtMoney(target - committed, true)} toezegging nodig. In gesprek: {fmtMoney(pipeline, true)}{pipeline < target - committed && ' (niet genoeg in de pijplijn, zoek meer leads)'}.</p>}
              {round?.notes && <p className="pre-wrap muted small">{round.notes}</p>}
            </section>
            <section className="card">
              <div className="row card-title"><CalendarClock size={16} /><strong>Volgende stappen</strong></div>
              {overdue.length > 0 && <div className="banner banner-error"><AlertTriangle size={14} /> {overdue.length} achterstallig</div>}
              {nextSteps.slice(0, 7).map((l) => (
                <button key={l.id} className="list-link" onClick={() => setLeadModal(l)}>
                  <Avatar user={maps.users[l.owner_id]} size={20} />
                  <span className="grow ellipsis"><strong>{l.name}</strong> <span className="muted">{l.next_step}</span></span>
                  <DeadlineBadge date={l.next_date} />
                </button>
              ))}
              {!nextSteps.length && <p className="muted small">Geen geplande stappen. Geef elke lopende investeerder een volgende stap met een datum, anders verwatert het.</p>}
            </section>
          </div>

          {view === 'board' ? (
            <div className="kanban fund-board" style={{ '--cols': stages.length }}>
              {stages.map((s) => {
                const items = scoped.filter((l) => l.stage === s.id);
                const sum = items.reduce((a, l) => a + (s.id === 'binnen' ? l.received_cents : ['toezegging'].includes(s.id) ? l.committed_cents : l.ask_cents), 0);
                return (
                  <div
                    key={s.id}
                    className={cx('kcol', overStage === s.id && 'kcol-over')}
                    onDragOver={(e) => { e.preventDefault(); setOverStage(s.id); }}
                    onDragLeave={() => setOverStage((x) => (x === s.id ? null : x))}
                    onDrop={(e) => { e.preventDefault(); setOverStage(null); const l = scoped.find((x) => x.id === dragId); if (l) moveStage(l, s.id); setDragId(null); }}
                  >
                    <div className="kcol-head">
                      <span className="dot" style={{ background: s.color }} /><strong className="ellipsis">{s.label}</strong><span className="count">{items.length}</span>
                    </div>
                    <div className="muted small fund-sum">{fmtMoney(sum, true)}</div>
                    <div className="kcol-body">
                      {items.map((l) => (
                        <div key={l.id} className={cx('kcard', dragId === l.id && 'dragging')} draggable onDragStart={() => setDragId(l.id)} onDragEnd={() => setDragId(null)} onClick={() => setLeadModal(l)}>
                          <div className="kcard-title">{l.name}</div>
                          <span className="muted small">{FUNDING_KIND[l.kind]?.label}{!round && maps.funding_rounds[l.round_id] ? ` · ${maps.funding_rounds[l.round_id].name}` : ''}</span>
                          <strong className="num left">{fmtMoney(s.id === 'binnen' ? l.received_cents : l.committed_cents || l.ask_cents, true)}</strong>
                          {l.next_step && <span className="small ellipsis">→ {l.next_step}</span>}
                          <TagChips ids={l.tags} />
                          <div className="kcard-foot">{l.next_date ? <DeadlineBadge date={l.next_date} /> : <span />}<Avatar user={maps.users[l.owner_id]} size={20} /></div>
                        </div>
                      ))}
                      {!items.length && <div className="kcol-empty">Leeg</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card table-wrap">
              <table className="table table-hover">
                <thead><tr><th>Naam</th><th>Soort</th><th>Fase</th><th className="num">Gevraagd</th><th className="num">Toegezegd</th><th className="num">Ontvangen</th><th>Volgende stap</th><th>Wie</th></tr></thead>
                <tbody>
                  {scoped.filter((l) => showLost || l.stage !== 'afgewezen').map((l) => (
                    <tr key={l.id} onClick={() => setLeadModal(l)}>
                      <td><strong>{l.name}</strong>{!round && maps.funding_rounds[l.round_id] && <span className="muted small block">{maps.funding_rounds[l.round_id].name}</span>}</td>
                      <td className="muted">{FUNDING_KIND[l.kind]?.label}</td>
                      <td><span className="badge" style={{ '--c': FUNDING_STAGE[l.stage]?.color }}><span className="dot" />{FUNDING_STAGE[l.stage]?.label}</span></td>
                      <td className="num">{fmtMoney(l.ask_cents)}</td>
                      <td className="num">{fmtMoney(l.committed_cents)}</td>
                      <td className="num">{fmtMoney(l.received_cents)}</td>
                      <td>{l.next_step} {l.next_date && <DeadlineBadge date={l.next_date} />}</td>
                      <td><Avatar user={maps.users[l.owner_id]} size={22} /></td>
                    </tr>
                  ))}
                  {!scoped.length && <tr><td colSpan={8} className="list-empty">Nog niemand in deze ronde.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {leadModal && <LeadModal lead={leadModal} onClose={() => setLeadModal(null)} />}
      {roundModal && <RoundModal round={roundModal} onClose={() => setRoundModal(null)} onSaved={(r) => { if (r && !roundModal.id) pickRound(r.id); if (r === null) pickRound('all'); }} />}
    </div>
  );
}
