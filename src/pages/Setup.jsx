import { useEffect, useState } from 'react';
import { Server, Laptop, Search, Loader2, ArrowLeft, FolderOpen, Wifi, AlertTriangle } from 'lucide-react';
import { api, desktop, setToken } from '../api';
import { cx } from '../util';

function Shell({ children }) {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo"><img src="./icon.png" alt="" /><span>The Break 5</span></div>
        {children}
      </div>
    </div>
  );
}

// First start of the desktop app: is this the host PC or a colleague's PC?
export function ConnectionSetup({ cfg }) {
  const [step, setStep] = useState('choose');
  const [dataDir, setDataDir] = useState(cfg.defaultDataDir);
  const [hosts, setHosts] = useState(null);
  const [searching, setSearching] = useState(false);
  const [manual, setManual] = useState('');
  const [error, setError] = useState('');

  const search = async () => {
    setSearching(true);
    setError('');
    setHosts(await desktop.discover());
    setSearching(false);
  };

  useEffect(() => { if (step === 'client') search(); }, [step]);

  const becomeHost = async () => {
    await desktop.setConfig({ mode: 'host', dataDir });
    desktop.relaunch();
  };

  const connect = async (url, name) => {
    let u = url.trim();
    if (!/^https?:\/\//.test(u)) u = `http://${u}`;
    if (!/:\d+$/.test(u.replace(/\/$/, ''))) u = `${u.replace(/\/$/, '')}:4750`;
    setError('');
    if (!(await desktop.ping(u))) {
      setError(`Geen The Break 5 host gevonden op ${u}. Staat de host-pc aan, draait de app daar, en heeft Windows Firewall toegang gegeven?`);
      return;
    }
    await desktop.setConfig({ mode: 'client', hostUrl: u, hostName: name || u });
    desktop.relaunch();
  };

  if (step === 'choose') {
    return (
      <Shell>
        <h2>Welkom! Hoe gebruik je deze pc?</h2>
        <p className="muted">Eén pc op kantoor bewaart alle data (de host). Alle anderen verbinden daarmee.</p>
        <div className="choice-grid">
          <button className="choice" onClick={() => setStep('host')}>
            <Server size={28} />
            <strong>Dit is de host-pc</strong>
            <span className="muted small">De kantoor-pc die altijd aan staat. Hier komen de database en alle bestanden.</span>
          </button>
          <button className="choice" onClick={() => setStep('client')}>
            <Laptop size={28} />
            <strong>Verbinden met de host</strong>
            <span className="muted small">Voor de pc's en laptops van collega's.</span>
          </button>
        </div>
      </Shell>
    );
  }

  if (step === 'host') {
    return (
      <Shell>
        <button className="btn btn-ghost back" onClick={() => setStep('choose')}><ArrowLeft size={16} /> Terug</button>
        <h2>Deze pc wordt de host</h2>
        <ul className="checklist">
          <li>Deze pc moet <strong>aan staan</strong> zolang er iemand werkt. Sluit je het venster, dan blijft de app rechtsonder in het systeemvak draaien.</li>
          <li>Windows vraagt straks om <strong>netwerktoegang</strong>. Kies <em>Toestaan</em> voor privénetwerken, anders kunnen collega's niet verbinden.</li>
          <li>Alle data staat in de map hieronder. Stel na de installatie een <strong>back-upmap op een andere schijf</strong> in.</li>
        </ul>
        <label className="field">
          <span className="field-label">Datamap</span>
          <div className="row gap-s">
            <input className="grow" value={dataDir} onChange={(e) => setDataDir(e.target.value)} />
            <button className="btn" onClick={async () => { const p = await desktop.pickFolder('Kies de map voor The Break 5 data'); if (p) setDataDir(p); }}><FolderOpen size={15} /> Bladeren</button>
          </div>
        </label>
        <button className="btn btn-primary btn-lg" onClick={becomeHost}>Host starten</button>
      </Shell>
    );
  }

  return (
    <Shell>
      <button className="btn btn-ghost back" onClick={() => setStep('choose')}><ArrowLeft size={16} /> Terug</button>
      <h2>Verbinden met de host</h2>
      <p className="muted">Zorg dat je op het kantoornetwerk zit en dat The Break 5 op de host-pc draait.</p>
      <div className="host-list">
        {searching && <div className="row gap-s muted"><Loader2 size={16} className="spin" /> Zoeken op het netwerk…</div>}
        {!searching && hosts?.map((h) => (
          <button key={h.url} className="choice choice-row" onClick={() => connect(h.url, h.name)}>
            <Wifi size={20} /> <strong>{h.name}</strong> <span className="muted small">{h.url}</span>
          </button>
        ))}
        {!searching && hosts && !hosts.length && <p className="muted small">Geen host gevonden. Typ het adres hieronder in; dat staat op de host-pc bij Instellingen → Verbinding.</p>}
        {!searching && <button className="btn btn-sm" onClick={search}><Search size={14} /> Opnieuw zoeken</button>}
      </div>
      <form className="row gap-s" onSubmit={(e) => { e.preventDefault(); manual && connect(manual); }}>
        <input className="grow" placeholder="Adres, bijv. 192.168.1.20" value={manual} onChange={(e) => setManual(e.target.value)} />
        <button className="btn btn-primary">Verbinden</button>
      </form>
      {error && <div className="banner banner-error"><AlertTriangle size={15} /> {error}</div>}
    </Shell>
  );
}

export function HostError({ cfg }) {
  return (
    <Shell>
      <h2>De host kon niet starten</h2>
      <div className="banner banner-error">{cfg.hostError}</div>
      <p className="muted small">Sluit andere vensters van The Break 5 (ook rechtsonder in het systeemvak) en probeer het opnieuw.</p>
      <div className="row gap-s">
        <button className="btn btn-primary" onClick={() => desktop.relaunch()}>Opnieuw proberen</button>
        <button className="btn" onClick={async () => { await desktop.setConfig({ mode: null }); desktop.relaunch(); }}>Andere instelling kiezen</button>
      </div>
    </Shell>
  );
}

export function Login({ onLogin, cfg }) {
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState({ name: '', username: '', password: '', password2: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    api.get('/setup/status').then(setStatus).catch((e) => setError(e.message));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (status?.needsSetup && form.password !== form.password2) return setError('Wachtwoorden komen niet overeen.');
    setBusy(true);
    try {
      const r = status?.needsSetup
        ? await api.post('/setup', { name: form.name, username: form.username, password: form.password })
        : await api.post('/auth/login', { username: form.username, password: form.password });
      setToken(r.token);
      onLogin(r.user);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const changeConnection = desktop && cfg?.mode === 'client' && (
    <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { await desktop.setConfig({ mode: null }); desktop.relaunch(); }}>
      Andere host kiezen
    </button>
  );

  if (!status) {
    return (
      <Shell>
        {error ? (
          <>
            <div className="banner banner-error">{error}</div>
            <div className="row gap-s"><button className="btn btn-primary" onClick={() => location.reload()}>Opnieuw proberen</button>{changeConnection}</div>
          </>
        ) : <div className="row gap-s muted"><Loader2 size={16} className="spin" /> Verbinden…</div>}
      </Shell>
    );
  }

  if (status.needsSetup && !status.isLocal) {
    return (
      <Shell>
        <h2>De host is nog niet ingesteld</h2>
        <p className="muted">Maak eerst op de host-pc zelf het beheerdersaccount aan. Daarna kan de beheerder accounts voor collega's maken.</p>
        <div className="row gap-s"><button className="btn btn-primary" onClick={() => location.reload()}>Opnieuw proberen</button>{changeConnection}</div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h2>{status.needsSetup ? 'Maak het beheerdersaccount' : 'Inloggen'}</h2>
      {status.needsSetup && <p className="muted">Dit is jouw account. Daarna voeg je bij Instellingen → Team je collega's toe.</p>}
      {cfg?.mode === 'client' && <p className="muted small">Host: {cfg.hostName || cfg.hostUrl}</p>}
      <form className="auth-form" onSubmit={submit}>
        {status.needsSetup && <input autoFocus placeholder="Je naam" value={form.name} onChange={set('name')} />}
        <input autoFocus={!status.needsSetup} placeholder="Gebruikersnaam" value={form.username} onChange={set('username')} autoComplete="username" />
        <input type="password" placeholder="Wachtwoord" value={form.password} onChange={set('password')} autoComplete={status.needsSetup ? 'new-password' : 'current-password'} />
        {status.needsSetup && <input type="password" placeholder="Herhaal wachtwoord" value={form.password2} onChange={set('password2')} />}
        {error && <div className="banner banner-error">{error}</div>}
        <button className={cx('btn btn-primary btn-lg')} disabled={busy}>{status.needsSetup ? 'Account aanmaken' : 'Inloggen'}</button>
      </form>
      {changeConnection}
    </Shell>
  );
}
