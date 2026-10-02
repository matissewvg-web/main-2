import { useEffect, useMemo, useState } from 'react';
import { Plus, Minus, Package, Search, Download, AlertTriangle, Pencil, Trash2, Undo2, Archive, ArrowDownToLine, ArrowUpFromLine, ClipboardCheck } from 'lucide-react';
import { api } from '../api';
import { useData, useToast } from '../store';
import { centsCsv, centsToInput, cx, downloadCsv, fmtDate, fmtMoney, fmtNum, parseMoney, timeAgo, todayStr } from '../util';
import { ContactSelect, Empty, Field, Modal, PageHeader, TagChips, TagPicker, confirmDialog } from '../components/ui';

const MOVE_KINDS = [
  { id: 'in', label: 'Inkomend', icon: ArrowDownToLine, hint: 'Levering, retour van klant' },
  { id: 'uit', label: 'Uitgaand', icon: ArrowUpFromLine, hint: 'Verkoop, verbruik, kapot' },
  { id: 'correctie', label: 'Telling', icon: ClipboardCheck, hint: 'Vul het getelde aantal in' },
];

function MoneyInput({ value, onChange, ...rest }) {
  const [text, setText] = useState(centsToInput(value));
  useEffect(() => { if (parseMoney(text) !== value) setText(centsToInput(value)); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="money-input">
      <span>€</span>
      <input
        inputMode="decimal"
        value={text}
        onChange={(e) => { setText(e.target.value); const c = parseMoney(e.target.value); onChange(c ?? 0); }}
        onBlur={() => setText(centsToInput(parseMoney(text) ?? 0))}
        {...rest}
      />
    </div>
  );
}
export { MoneyInput };

function ProductModal({ product, onClose }) {
  const { products } = useData();
  const toast = useToast();
  const [p, setP] = useState(() => ({
    name: '', sku: '', category: '', location: '', unit: 'stuks', min_stock: 0, cost_cents: 0, price_cents: 0,
    supplier_id: null, notes: '', tags: [], initial: '', ...product,
  }));
  const isNew = !p.id;
  const set = (k) => (v) => setP((x) => ({ ...x, [k]: v?.target ? v.target.value : v }));
  const categories = [...new Set(products.map((x) => x.category).filter(Boolean))];

  const save = async () => {
    if (!p.name.trim()) return toast('Geef het product een naam.', 'error');
    const body = {
      name: p.name, sku: p.sku, category: p.category, location: p.location, unit: p.unit || 'stuks',
      min_stock: Number(String(p.min_stock).replace(',', '.')) || 0, cost_cents: p.cost_cents, price_cents: p.price_cents,
      supplier_id: p.supplier_id, notes: p.notes, tags: p.tags,
    };
    try {
      const saved = isNew ? await api.post('/products', body) : await api.patch(`/products/${p.id}`, body);
      const initial = Number(String(p.initial).replace(',', '.'));
      if (isNew && initial > 0) await api.post('/stock_moves', { product_id: saved.id, kind: 'in', qty: initial, note: 'Beginvoorraad' });
      toast(isNew ? 'Product toegevoegd' : 'Product opgeslagen', 'ok');
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const margin = p.price_cents && p.cost_cents ? (p.price_cents - p.cost_cents) / p.price_cents : null;

  return (
    <Modal title={isNew ? 'Nieuw product' : 'Product bewerken'} onClose={onClose} footer={<><span className="grow" /><button className="btn" onClick={onClose}>Annuleren</button><button className="btn btn-primary" onClick={save}>{isNew ? 'Toevoegen' : 'Opslaan'}</button></>}>
      <div className="form">
        <Field label="Naam" span><input autoFocus value={p.name} onChange={set('name')} placeholder="Bijv. Koffiebonen 1 kg" /></Field>
        <Field label="Artikelnummer / SKU"><input value={p.sku || ''} onChange={set('sku')} /></Field>
        <Field label="Categorie">
          <input list="tb5-cats" value={p.category || ''} onChange={set('category')} />
          <datalist id="tb5-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Locatie"><input value={p.location || ''} onChange={set('location')} placeholder="Bijv. Magazijn A, schap 3" /></Field>
        <Field label="Eenheid"><input value={p.unit || ''} onChange={set('unit')} placeholder="stuks, kg, doos…" /></Field>
        {isNew && <Field label="Beginvoorraad"><input inputMode="decimal" value={p.initial} onChange={set('initial')} placeholder="0" /></Field>}
        <Field label="Minimale voorraad" hint="Daaronder krijg je een waarschuwing"><input inputMode="decimal" value={p.min_stock} onChange={set('min_stock')} /></Field>
        <Field label="Inkoopprijs (per eenheid)"><MoneyInput value={p.cost_cents} onChange={set('cost_cents')} /></Field>
        <Field label="Verkoopprijs (per eenheid)" hint={margin != null ? `Marge ${fmtNum(margin * 100, 1)}%` : undefined}><MoneyInput value={p.price_cents} onChange={set('price_cents')} /></Field>
        <Field label="Leverancier" span><ContactSelect value={p.supplier_id} onChange={set('supplier_id')} /></Field>
        <Field label="Tags" span><TagPicker value={p.tags} onChange={set('tags')} /></Field>
        <Field label="Notities" span><textarea rows={3} value={p.notes || ''} onChange={set('notes')} /></Field>
      </div>
    </Modal>
  );
}

function MoveModal({ product, kind: initialKind, onClose }) {
  const toast = useToast();
  const [kind, setKind] = useState(initialKind || 'in');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayStr());
  const n = Number(String(qty).replace(',', '.'));
  const result = !Number.isFinite(n) || qty === '' ? null : kind === 'in' ? product.stock + n : kind === 'uit' ? product.stock - n : n;

  const save = async () => {
    try {
      await api.post('/stock_moves', { product_id: product.id, kind, qty: n, note, date });
      toast('Voorraad bijgewerkt', 'ok');
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <Modal title={`Voorraad: ${product.name}`} onClose={onClose} footer={<><span className="grow" /><button className="btn" onClick={onClose}>Annuleren</button><button className="btn btn-primary" disabled={result === null} onClick={save}>Opslaan</button></>}>
      <div className="form">
        <Field label="Soort" span>
          <div className="seg">
            {MOVE_KINDS.map((k) => (
              <button type="button" key={k.id} title={k.hint} className={cx('seg-btn', kind === k.id && 'on')} onClick={() => setKind(k.id)}><k.icon size={14} /> {k.label}</button>
            ))}
          </div>
        </Field>
        <Field label={kind === 'correctie' ? 'Geteld aantal' : 'Aantal'}>
          <input autoFocus inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && result !== null && save()} placeholder={product.unit} />
        </Field>
        <Field label="Datum"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Opmerking" span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === 'in' ? 'Bijv. levering Groothandel Noord' : kind === 'uit' ? 'Bijv. bestelling #1042' : 'Bijv. kwartaaltelling'} /></Field>
        <div className="field-span stock-preview">
          Nu <strong>{fmtNum(product.stock)} {product.unit}</strong>
          {result !== null && <> → wordt <strong className={cx(result < product.min_stock && 'neg')}>{fmtNum(result)} {product.unit}</strong></>}
          {result !== null && result < 0 && <span className="neg"> (negatief, klopt dat?)</span>}
        </div>
      </div>
    </Modal>
  );
}

function ProductDetail({ product, onClose, onEdit, onMove }) {
  const { maps, stockVersion } = useData();
  const toast = useToast();
  const [moves, setMoves] = useState(null);
  useEffect(() => {
    api.get(`/stock_moves?product_id=${product.id}`).then(setMoves).catch(() => setMoves([]));
  }, [product.id, stockVersion]);

  const undo = async (m) => {
    if (!(await confirmDialog(`Deze mutatie (${m.qty > 0 ? '+' : ''}${fmtNum(m.qty)}) ongedaan maken? De voorraad wordt teruggezet.`, { okText: 'Ongedaan maken' }))) return;
    api.del(`/stock_moves/${m.id}`).catch((e) => toast(e.message, 'error'));
  };
  const archive = async () => {
    await api.patch(`/products/${product.id}`, { archived: product.archived ? 0 : 1 }).catch((e) => toast(e.message, 'error'));
    toast(product.archived ? 'Product teruggezet' : 'Product gearchiveerd');
    onClose();
  };
  const remove = async () => {
    if (!(await confirmDialog(`"${product.name}" en de hele voorraadgeschiedenis definitief verwijderen? Archiveren bewaart de geschiedenis.`))) return;
    await api.del(`/products/${product.id}`).catch((e) => toast(e.message, 'error'));
    onClose();
  };

  const supplier = maps.contacts[product.supplier_id];
  return (
    <Modal wide title={product.name} onClose={onClose} footer={
      <>
        <button className="btn btn-ghost-danger" onClick={remove}><Trash2 size={15} /> Verwijderen</button>
        <button className="btn" onClick={archive}><Archive size={15} /> {product.archived ? 'Terugzetten' : 'Archiveren'}</button>
        <span className="grow" />
        <button className="btn" onClick={onEdit}><Pencil size={15} /> Bewerken</button>
        <button className="btn btn-primary" onClick={() => onMove('in')}><Plus size={15} /> Mutatie</button>
      </>
    }>
      <div className="product-meta">
        <div><span className="muted small block">Voorraad</span><strong className={cx('big', product.stock < product.min_stock && 'neg')}>{fmtNum(product.stock)} {product.unit}</strong></div>
        <div><span className="muted small block">Minimum</span>{fmtNum(product.min_stock)}</div>
        <div><span className="muted small block">Inkoop / verkoop</span>{fmtMoney(product.cost_cents)} / {fmtMoney(product.price_cents)}</div>
        <div><span className="muted small block">Waarde (inkoop)</span>{fmtMoney(product.stock * product.cost_cents)}</div>
        <div><span className="muted small block">SKU · locatie</span>{[product.sku, product.location].filter(Boolean).join(' · ') || '—'}</div>
        <div><span className="muted small block">Leverancier</span>{supplier?.name || '—'}</div>
      </div>
      <TagChips ids={product.tags} />
      {product.notes && <p className="pre-wrap muted">{product.notes}</p>}
      <h3 className="section-label">Geschiedenis</h3>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Datum</th><th>Soort</th><th className="num">Mutatie</th><th>Opmerking</th><th>Door</th><th /></tr></thead>
          <tbody>
            {(moves || []).map((m) => (
              <tr key={m.id}>
                <td>{fmtDate(m.date)}</td>
                <td>{MOVE_KINDS.find((k) => k.id === m.kind)?.label}</td>
                <td className={cx('num', m.qty > 0 ? 'pos' : 'neg')}>{m.qty > 0 ? '+' : ''}{fmtNum(m.qty)}</td>
                <td className="muted">{m.note}</td>
                <td className="muted small">{maps.users[m.created_by]?.name.split(' ')[0]} · {timeAgo(m.created_at)}</td>
                <td><button className="icon-btn ghost" title="Ongedaan maken" onClick={() => undo(m)}><Undo2 size={14} /></button></td>
              </tr>
            ))}
            {moves && !moves.length && <tr><td colSpan={6} className="muted">Nog geen mutaties.</td></tr>}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

export default function Inventory({ params }) {
  const { products, tags } = useData();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [tag, setTag] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [edit, setEdit] = useState(null);
  const [detailId, setDetailId] = useState(params?.id || null);
  const [move, setMove] = useState(null);

  useEffect(() => { if (params?.id) setDetailId(params.id); if (params?.new) setEdit({}); }, [params]);

  const active = products.filter((p) => !p.archived);
  const low = active.filter((p) => p.stock < p.min_stock || (p.min_stock > 0 && p.stock <= 0));
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
  const list = useMemo(() => products.filter((p) => {
    if (!showArchived && p.archived) return false;
    if (onlyLow && !(p.stock < p.min_stock)) return false;
    if (cat && p.category !== cat) return false;
    if (tag && !p.tags.includes(Number(tag))) return false;
    if (q && !`${p.name} ${p.sku || ''} ${p.location || ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [products, q, cat, tag, onlyLow, showArchived]);

  const costValue = active.reduce((s, p) => s + Math.max(0, p.stock) * p.cost_cents, 0);
  const saleValue = active.reduce((s, p) => s + Math.max(0, p.stock) * p.price_cents, 0);
  const detail = products.find((p) => p.id === detailId);

  const exportCsv = () => downloadCsv(`voorraad-${todayStr()}.csv`, [
    ['Naam', 'SKU', 'Categorie', 'Locatie', 'Voorraad', 'Eenheid', 'Minimum', 'Inkoopprijs', 'Verkoopprijs', 'Waarde inkoop'],
    ...list.map((p) => [p.name, p.sku, p.category, p.location, String(p.stock).replace('.', ','), p.unit, String(p.min_stock).replace('.', ','), centsCsv(p.cost_cents), centsCsv(p.price_cents), centsCsv(p.stock * p.cost_cents)]),
  ]);

  return (
    <div className="page">
      <PageHeader title="Voorraad" subtitle={`${active.length} producten`}>
        <button className="btn" onClick={exportCsv} disabled={!list.length}><Download size={15} /> Excel (CSV)</button>
        <button className="btn btn-primary" onClick={() => setEdit({})}><Plus size={16} /> Nieuw product</button>
      </PageHeader>

      {!products.length ? (
        <Empty icon={Package} title="Nog geen producten" text="Voeg je producten toe met beginvoorraad, minimum en prijzen. Elke wijziging wordt vastgelegd met wie, wanneer en waarom." action={<button className="btn btn-primary" onClick={() => setEdit({})}><Plus size={16} /> Nieuw product</button>} />
      ) : (
        <>
          <div className="stats">
            <div className="stat"><Package size={18} /><span className="stat-value">{active.length}</span><span className="stat-label">Actieve producten</span></div>
            <div className="stat"><Package size={18} /><span className="stat-value">{fmtMoney(costValue, true)}</span><span className="stat-label">Voorraadwaarde (inkoop)</span></div>
            <div className="stat"><Package size={18} /><span className="stat-value">{fmtMoney(saleValue, true)}</span><span className="stat-label">Verkoopwaarde</span></div>
            <button className={cx('stat', low.length ? 'stat-danger' : 'stat-ok')} onClick={() => setOnlyLow(!onlyLow)}>
              <AlertTriangle size={18} /><span className="stat-value">{low.length}</span><span className="stat-label">Onder minimum {onlyLow && '(filter aan)'}</span>
            </button>
          </div>

          <div className="filters">
            <div className="search-input"><Search size={15} /><input placeholder="Zoek op naam, SKU, locatie…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <select value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Alle categorieën</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="">Alle tags</option>
              {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <label className="row gap-xs small"><input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} /> Alleen onder minimum</label>
            <label className="row gap-xs small"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Toon gearchiveerd</label>
          </div>

          <div className="card table-wrap">
            <table className="table table-hover">
              <thead>
                <tr><th>Product</th><th>Categorie</th><th>Locatie</th><th className="num">Voorraad</th><th className="num">Min.</th><th className="num">Inkoop</th><th className="num">Verkoop</th><th className="num">Waarde</th><th /></tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const isLow = p.stock < p.min_stock;
                  return (
                    <tr key={p.id} className={cx(p.archived && 'archived')} onClick={() => setDetailId(p.id)}>
                      <td><strong>{p.name}</strong>{p.sku && <span className="muted small"> · {p.sku}</span>} <TagChips ids={p.tags} /></td>
                      <td className="muted">{p.category}</td>
                      <td className="muted">{p.location}</td>
                      <td className="num">
                        {isLow && <span className="low-flag" title="Onder minimum"><AlertTriangle size={13} /> laag</span>}
                        <strong>{fmtNum(p.stock)}</strong> <span className="muted small">{p.unit}</span>
                      </td>
                      <td className="num muted">{fmtNum(p.min_stock)}</td>
                      <td className="num">{fmtMoney(p.cost_cents)}</td>
                      <td className="num">{fmtMoney(p.price_cents)}</td>
                      <td className="num">{fmtMoney(Math.max(0, p.stock) * p.cost_cents)}</td>
                      <td className="nowrap" onClick={(e) => e.stopPropagation()}>
                        <button className="icon-btn" title="Afboeken" onClick={() => setMove({ product: p, kind: 'uit' })}><Minus size={15} /></button>
                        <button className="icon-btn" title="Aanvullen" onClick={() => setMove({ product: p, kind: 'in' })}><Plus size={15} /></button>
                      </td>
                    </tr>
                  );
                })}
                {!list.length && <tr><td colSpan={9} className="list-empty">Geen producten in deze selectie.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {detail && !edit && !move && (
        <ProductDetail product={detail} onClose={() => setDetailId(null)} onEdit={() => setEdit(detail)} onMove={(kind) => setMove({ product: detail, kind })} />
      )}
      {edit && <ProductModal product={edit} onClose={() => setEdit(null)} />}
      {move && <MoveModal product={products.find((p) => p.id === move.product.id) || move.product} kind={move.kind} onClose={() => setMove(null)} />}
    </div>
  );
}
