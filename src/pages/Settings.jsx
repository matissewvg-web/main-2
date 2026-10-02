import { useEffect, useState } from 'react';
import { Plus, Save, HardDrive, Users, Tag, KeyRound, Monitor, Trash2, RefreshCw, AlertTriangle, Palette, Info, Download } from 'lucide-react';
import { api, desktop } from '../api';
import { useData, useToast } from '../store';
import { COLORS, cx, parseUtc, timeAgo } from '../util';
import { Avatar, Field, Modal, PageHeader, confirmDialog } from '../components/ui';

function ColorPick({ value, onChange }) {
  return (
    <div className="color-pick">
      {COLORS.map((c) => (
        <button type="button" key={c} className={cx('swatch', value === c && 'on')} style={{ background: c }} onClick={() => onChange(c)} />
      ))}
    </div>
  );
}

function UserModal({ user, onClose }) {
  const toast = useToast();
  const [u, setU] = useState(() => ({ name: '', username: '', password: '', role: 'member', can_finance: 0, color: COLORS[Math.floor(Math.random() * COLORS.length)], ...user, password: '' }));
  const isNew = !u.id;
  const set = (k) => (v) => setU((x) => ({ ...x, [k]: v?.target ? v.target.value : v }));
  const save = async () => {
    try {
      if (isNew) await api.post('/users', u);
      else await api.patch(`/users/${u.id}`, { name: u.name, role: u.role, color: u.color, can_finance: !!u.can_finance, ...(u.password ? { password: u.password } : {}) });
      toast(isNew ? `Account voor ${u.name} aangemaakt` : 'Opgeslagen', 'ok');
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  return (
    <Modal title={isNew ? 'Teamlid toevoegen' : `${user.name} bewerken`} onClose={onClose} footer={<><span className="grow" /><button className="btn" onClick={onClose}>Annuleren</button><button className="btn btn-primary" onClick={save}>{isNew ? 'Toevoegen' : 'Opslaan'}</button></>}>
      <div className="form">
        <Field label="Naam"><input autoFocus value={u.name} onChange={set('name')} /></Field>
        <Field label="Gebruikersnaam" hint={isNew ? 'Hiermee logt de persoon in' : 'Kan niet gewijzigd worden'}><input value={u.username} disabled={!isNew} onChange={set('username')} /></Field>
        <Field label={isNew ? 'Wachtwoord' : 'Nieuw wachtwoord'} hint={isNew ? 'Min. 4 tekens. Laat de persoon het daarna zelf wijzigen.' : 'Leeg laten om niet te wijzigen'}><input type="text" value={u.password} onChange={set('password')} /></Field>
        <Field label="Rol">
          <select value={u.role} onChange={set('role')}>
            <option value="member">Lid: taken, projecten, bestanden</option>
            <option value="admin">Beheerder: ook team, tags en back-ups</option>
          </select>
        </Field>
        <Field label="Financiën & investeringen" span hint="Beheerders zien dit altijd. Leden alleen als je dit aanzet.">
          <label className="row gap-s"><input type="checkbox" disabled={u.role === 'admin'} checked={u.role === 'admin' || !!u.can_finance} onChange={(e) => set('can_finance')(e.target.checked ? 1 : 0)} /> Mag financiën en investeringen zien en bewerken</label>
        </Field>
        <Field label="Kleur" span><ColorPick value={u.color} onChange={set('color')} /></Field>
      </div>
    </Modal>
  );
}

function TeamSection() {
  const { users, me } = useData();
  const toast = useToast();
  const [modal, setModal] = useState(null);
  const toggleActive = async (u) => {
    if (u.active && !(await confirmDialog(`${u.name} deactiveren? De persoon kan dan niet meer inloggen. Taken blijven bewaard.`, { okText: 'Deactiveren' }))) return;
    api.patch(`/users/${u.id}`, { active: !u.active }).catch((e) => toast(e.message, 'error'));
  };
  return (
    <section className="card settings-section">
      <div className="row card-title"><Users size={16} /><strong>Team</strong><span className="grow" /><button className="btn btn-sm btn-primary" onClick={() => setModal({})}><Plus size={14} /> Teamlid</button></div>
      {users.map((u) => (
        <div key={u.id} className={cx('team-row', !u.active && 'inactive')}>
          <Avatar user={u} size={30} />
          <div className="grow">
            <strong>{u.name}</strong> {u.id === me.id && <span className="muted small">(jij)</span>}
            <span className="muted small block">@{u.username} · {u.role === 'admin' ? 'Beheerder' : 'Lid'}{u.role !== 'admin' && u.can_finance ? ' · financiën' : ''}{!u.active && ' · gedeactiveerd'}</span>
          </div>
          <button className="btn btn-sm" onClick={() => setModal(u)}>Bewerken</button>
          {u.id !== me.id && <button className="btn btn-sm" onClick={() => toggleActive(u)}>{u.active ? 'Deactiveren' : 'Activeren'}</button>}
        </div>
      ))}
      {modal && <UserModal user={modal} onClose={() => setModal(null)} />}
    </section>
  );
}

function TagsSection() {
  const { tags } = useData();
  const toast = useToast();
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.post('/tags', { name: name.trim(), color });
      setName('');
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const remove = async (t) => {
    if (!(await confirmDialog(`Tag "${t.name}" verwijderen? Hij verdwijnt van alle taken, projecten en contacten.`))) return;
    api.del(`/tags/${t.id}`).catch((e) => toast(e.message, 'error'));
  };
  return (
    <section className="card settings-section">
      <div className="row card-title"><Tag size={16} /><strong>Tags</strong></div>
      <p className="muted small">Tags werken overal: taken, projecten, contacten, vergaderingen, producten en financiën. Iedereen kan een nieuwe tag maken in het tag-veld zelf (typ een naam en druk op Enter). Alleen beheerders kunnen tags hier hernoemen, kleuren of verwijderen.</p>
      <div className="tag-admin">
        {tags.map((t) => (
          <div key={`${t.id}-${t.name}`} className="tag-admin-row">
            <input
              type="color"
              value={t.color}
              onChange={(e) => api.patch(`/tags/${t.id}`, { color: e.target.value }).catch((er) => toast(er.message, 'error'))}
              title="Kleur wijzigen"
            />
            <input
              className="grow"
              defaultValue={t.name}
              onBlur={(e) => e.target.value.trim() && e.target.value !== t.name && api.patch(`/tags/${t.id}`, { name: e.target.value.trim() }).catch((er) => toast(er.message, 'error'))}
            />
            <button className="icon-btn danger" onClick={() => remove(t)} title="Verwijderen"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
      <form className="row gap-s" onSubmit={add}>
        <input className="grow" placeholder="Nieuwe tag, bijv. 'Offerte'" value={name} onChange={(e) => setName(e.target.value)} />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <button className="btn btn-primary"><Plus size={15} /> Toevoegen</button>
      </form>
    </section>
  );
}

function BackupSection({ isHost }) {
  const toast = useToast();
  const [status, setStatus] = useState(null);
  const [dir, setDir] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => api.get('/backup').then((s) => { setStatus(s); setDir(s.dir); }).catch(() => {});
  useEffect(() => { load(); }, []);

  const run = async () => {
    setBusy(true);
    const r = await api.post('/backup/run').catch((e) => ({ ok: false, error: e.message }));
    setBusy(false);
    toast(r.ok ? 'Back-up gemaakt' : `Back-up mislukt: ${r.error}`, r.ok ? 'ok' : 'error');
    load();
  };
  const saveDir = async (value = dir) => {
    try {
      setStatus(await api.post('/backup/dir', { dir: value }));
      toast('Back-upmap opgeslagen', 'ok');
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const pick = async () => {
    const p = await desktop.pickFolder('Kies een map voor back-ups (bij voorkeur een andere schijf of USB-schijf)');
    if (p) { setDir(p); saveDir(p); }
  };

  if (!status) return null;
  const last = status.lastBackup ? parseUtc(status.lastBackup) : null;
  const stale = !last || Date.now() - last.getTime() > 48 * 3600 * 1000;
  return (
    <section className="card settings-section">
      <div className="row card-title"><HardDrive size={16} /><strong>Back-ups</strong></div>
      <p className="muted small">Elke dag maakt de host automatisch een kopie van de database én alle bestanden. De laatste 14 worden bewaard.</p>
      <div className={cx('banner', stale ? 'banner-error' : 'banner-ok')}>
        {last ? `Laatste back-up: ${last.toLocaleString('nl-NL')} (${timeAgo(status.lastBackup)})` : 'Er is nog geen back-up gemaakt.'}
      </div>
      {status.lastError && <div className="banner banner-error">Laatste fout: {status.lastError}</div>}
      {status.sameDiskAsData && (
        <div className="banner banner-warn"><AlertTriangle size={15} /> De back-ups staan op dezelfde schijf als de data. Als die schijf stukgaat, ben je alles kwijt. Kies een USB-schijf, NAS of OneDrive-map.</div>
      )}
      <Field label="Back-upmap (op de host-pc)">
        <div className="row gap-s">
          <input className="grow" value={dir} onChange={(e) => setDir(e.target.value)} />
          {isHost && <button className="btn" onClick={pick}>Bladeren…</button>}
          <button className="btn" onClick={() => saveDir()}><Save size={15} /> Opslaan</button>
        </div>
      </Field>
      <div className="row gap-s">
        <button className="btn btn-primary" disabled={busy} onClick={run}><RefreshCw size={15} className={busy ? 'spin' : ''} /> Nu back-up maken</button>
        <span className="muted small">{status.backups.length} back-ups aanwezig</span>
      </div>
    </section>
  );
}

function ConnectionSection({ cfg }) {
  const [autostart, setAutostart] = useState(null);
  useEffect(() => { if (cfg?.mode === 'host') desktop.getAutostart().then(setAutostart); }, [cfg]);
  if (!desktop || !cfg) {
    return (
      <section className="card settings-section">
        <div className="row card-title"><Monitor size={16} /><strong>Verbinding</strong></div>
        <p className="muted small">Je gebruikt The Break 5 in de browser, verbonden met {location.host}.</p>
      </section>
    );
  }
  const reset = async () => {
    if (!(await confirmDialog(cfg.mode === 'host'
      ? 'Deze pc stopt dan als host. Collega\'s verliezen de verbinding totdat een andere pc host is. De data blijft gewoon op deze pc staan. Doorgaan?'
      : 'Verbinding wijzigen? De app start opnieuw.', { okText: 'Doorgaan', danger: cfg.mode === 'host' }))) return;
    await desktop.setConfig({ mode: null });
    desktop.relaunch();
  };
  return (
    <section className="card settings-section">
      <div className="row card-title"><Monitor size={16} /><strong>Verbinding</strong></div>
      {cfg.mode === 'host' ? (
        <>
          <p>Deze pc (<strong>{cfg.computerName}</strong>) is de <strong>host</strong>. Alle data staat hier.</p>
          <div className="kv"><span>Datamap</span><code>{cfg.dataDir}</code><button className="btn btn-sm" onClick={() => desktop.openPath(cfg.dataDir)}>Openen</button></div>
          <div className="kv"><span>Adres voor collega's</span><code>{cfg.addresses.map((a) => `http://${a}:${cfg.hostPort}`).join('  of  ') || 'geen netwerk gevonden'}</code></div>
          <p className="muted small">Collega's vinden deze pc normaal automatisch. Lukt dat niet, dan typen ze bovenstaand adres in. Ze kunnen het adres ook gewoon in een browser openen.</p>
          {autostart !== null && (
            <label className="row gap-s"><input type="checkbox" checked={autostart} onChange={async (e) => setAutostart(await desktop.setAutostart(e.target.checked))} /> Start The Break 5 automatisch met Windows (aanbevolen voor de host)</label>
          )}
        </>
      ) : (
        <p>Verbonden met host <code>{cfg.hostUrl}</code>{cfg.hostName && <> ({cfg.hostName})</>}.</p>
      )}
      <div><button className="btn" onClick={reset}>Verbinding wijzigen…</button></div>
    </section>
  );
}

function AccountSection() {
  const toast = useToast();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const save = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/password', { current: cur, next });
      setCur(''); setNext('');
      toast('Wachtwoord gewijzigd', 'ok');
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  return (
    <section className="card settings-section">
      <div className="row card-title"><KeyRound size={16} /><strong>Mijn wachtwoord</strong></div>
      <form className="row gap-s wrap" onSubmit={save}>
        <input type="password" placeholder="Huidig wachtwoord" value={cur} onChange={(e) => setCur(e.target.value)} />
        <input type="password" placeholder="Nieuw wachtwoord" value={next} onChange={(e) => setNext(e.target.value)} />
        <button className="btn btn-primary" disabled={!cur || !next}>Wijzigen</button>
      </form>
    </section>
  );
}

function ThemeSection({ theme, setTheme }) {
  return (
    <section className="card settings-section">
      <div className="row card-title"><Palette size={16} /><strong>Weergave</strong></div>
      <div className="seg">
        {[['system', 'Systeem'], ['light', 'Licht'], ['dark', 'Donker']].map(([id, label]) => (
          <button key={id} className={cx('seg-btn', theme === id && 'on')} onClick={() => setTheme(id)}>{label}</button>
        ))}
      </div>
    </section>
  );
}

const DOWNLOAD_URL = 'https://github.com/matissewvg-web/main-2/releases/latest';

function AboutSection() {
  const [version, setVersion] = useState('');
  useEffect(() => { api.get('/ping').then((r) => setVersion(r.version)).catch(() => {}); }, []);
  const shortcuts = [
    ['Ctrl + K', 'Zoeken en snelle acties'],
    ['Ctrl + Enter', 'Taak opslaan / reactie versturen'],
    ['Esc', 'Venster sluiten'],
    ['@naam', 'Iemand noemen in een reactie (krijgt een melding)'],
    ['Enter in tag-veld', 'Nieuwe tag maken'],
  ];
  return (
    <section className="card settings-section">
      <div className="row card-title"><Info size={16} /><strong>Over The Break 5</strong></div>
      <p>Versie <strong>{version || '…'}</strong></p>
      <div className="download-box">
        <Download size={22} />
        <div className="grow">
          <strong>Nieuwste versie downloaden</strong>
          <span className="muted small block">Voor nieuwe collega's of om bij te werken: installeer de Setup over de oude heen. Gegevens blijven bewaard.</span>
        </div>
        <a className="btn btn-primary" href={DOWNLOAD_URL} target="_blank" rel="noreferrer">Download .exe</a>
      </div>
      <strong className="small">Sneltoetsen</strong>
      <div className="shortcuts">
        {shortcuts.map(([k, v]) => <div key={k} className="row gap-s"><kbd>{k}</kbd><span className="small">{v}</span></div>)}
      </div>
    </section>
  );
}

export default function Settings({ theme, setTheme }) {
  const { me } = useData();
  const [cfg, setCfg] = useState(null);
  useEffect(() => { desktop?.getConfig().then(setCfg); }, []);
  const isAdmin = me.role === 'admin';
  return (
    <div className="page">
      <PageHeader title="Instellingen" subtitle={isAdmin ? 'Je bent beheerder' : 'Sommige instellingen kan alleen een beheerder wijzigen'} />
      <div className="settings-grid">
        <AccountSection />
        <ThemeSection theme={theme} setTheme={setTheme} />
        {isAdmin && <TeamSection />}
        {isAdmin && <TagsSection />}
        {isAdmin && <BackupSection isHost={cfg?.mode === 'host'} />}
        <ConnectionSection cfg={cfg} />
        <AboutSection />
      </div>
    </div>
  );
}
