import { useState } from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { useToast } from '../store';
import { Modal } from './ui';

// Minimal CSV parser: detects ; , or tab, handles quotes and BOM (Excel exports).
export function parseCsv(text) {
  const clean = text.replace(/^﻿/, '');
  const first = clean.split(/\r?\n/)[0] || '';
  const sep = [';', '\t', ','].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (q) {
      if (c === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * fields: [{ key, label, aliases: [...] , required? }]
 * toRecord(values) -> body for the API (or null to skip); save(body) posts it.
 */
export default function CsvImport({ title, fields, toRecord, save, onClose, example }) {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [map, setMap] = useState({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const load = async (file) => {
    if (!file) return;
    const parsed = parseCsv(await file.text());
    if (parsed.length < 2) return toast('Geen gegevens gevonden. Staat er een kopregel in?', 'error');
    const header = parsed[0];
    const auto = {};
    for (const f of fields) {
      const idx = header.findIndex((h) => [f.label, f.key, ...(f.aliases || [])].some((a) => norm(a) === norm(h)));
      auto[f.key] = idx;
    }
    setMap(auto);
    setRows(parsed);
  };

  const run = async () => {
    setBusy(true);
    let ok = 0, skipped = 0;
    const data = rows.slice(1);
    for (let i = 0; i < data.length; i++) {
      const values = Object.fromEntries(fields.map((f) => [f.key, map[f.key] >= 0 ? (data[i][map[f.key]] ?? '').trim() : '']));
      const body = toRecord(values);
      if (!body) { skipped++; continue; }
      try { await save(body); ok++; } catch { skipped++; }
      setProgress((i + 1) / data.length);
    }
    toast(`${ok} geïmporteerd${skipped ? `, ${skipped} overgeslagen (leeg of fout)` : ''}`, ok ? 'ok' : 'error');
    onClose();
  };

  const header = rows?.[0] || [];
  return (
    <Modal wide title={title} onClose={onClose} footer={rows && <><span className="grow" />{busy && <span className="muted small">{Math.round(progress * 100)}%</span>}<button className="btn" onClick={onClose}>Annuleren</button><button className="btn btn-primary" disabled={busy} onClick={run}>{busy ? 'Bezig…' : `${rows.length - 1} rijen importeren`}</button></>}>
      {!rows ? (
        <div className="import-drop">
          <FileSpreadsheet size={36} />
          <p>Kies een CSV-bestand. In Excel: <strong>Opslaan als → CSV (gescheiden door lijstscheidingsteken)</strong>.</p>
          {example && <p className="muted small">Verwachte kolommen (volgorde maakt niet uit): {example}</p>}
          <label className="btn btn-primary"><Upload size={15} /> Bestand kiezen<input type="file" accept=".csv,text/csv,.txt" hidden onChange={(e) => load(e.target.files[0])} /></label>
        </div>
      ) : (
        <>
          <p className="muted small">Controleer welke kolom bij welk veld hoort. Kolommen met dezelfde naam zijn al gekoppeld.</p>
          <div className="import-map">
            {fields.map((f) => (
              <label key={f.key} className="field">
                <span className="field-label">{f.label}{f.required && ' *'}</span>
                <select value={map[f.key] ?? -1} onChange={(e) => setMap({ ...map, [f.key]: Number(e.target.value) })}>
                  <option value={-1}>— niet importeren —</option>
                  {header.map((h, i) => <option key={i} value={i}>{h || `Kolom ${i + 1}`}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr>{fields.filter((f) => map[f.key] >= 0).map((f) => <th key={f.key}>{f.label}</th>)}</tr></thead>
              <tbody>
                {rows.slice(1, 6).map((r, i) => <tr key={i}>{fields.filter((f) => map[f.key] >= 0).map((f) => <td key={f.key}>{r[map[f.key]]}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
          {rows.length > 6 && <p className="muted small">…en nog {rows.length - 6} rijen.</p>}
        </>
      )}
    </Modal>
  );
}
