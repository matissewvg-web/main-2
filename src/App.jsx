import { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard, CheckSquare, FolderKanban, Users, NotebookPen, FolderOpen, Settings as SettingsIcon,
  Search, LogOut, Package, Wallet, TrendingUp, Loader2,
} from 'lucide-react';
import { api, desktop, setBase, setToken, getToken, setUnauthorizedHandler } from './api';
import { DataProvider, ToastHost, useData } from './store';
import { cx } from './util';
import { Avatar, ConfirmHost } from './components/ui';
import TaskModal from './components/TaskModal';
import CommandPalette from './components/CommandPalette';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Projects from './pages/Projects';
import Contacts from './pages/Contacts';
import Meetings from './pages/Meetings';
import Files from './pages/Files';
import Settings from './pages/Settings';
import { ConnectionSetup, HostError, Login } from './pages/Setup';

const NAV = [
  { id: 'dashboard', label: 'Vandaag', icon: LayoutDashboard },
  { id: 'tasks', label: 'Taken', icon: CheckSquare },
  { id: 'projects', label: 'Projecten', icon: FolderKanban },
  { id: 'contacts', label: 'Contacten', icon: Users },
  { id: 'meetings', label: 'Vergaderingen', icon: NotebookPen },
  { id: 'files', label: 'Bestanden', icon: FolderOpen },
];

// Planned for later phases; shown so the team knows what is coming.
const LATER = [
  { label: 'Voorraad', icon: Package },
  { label: 'Financiën', icon: Wallet },
  { label: 'Investeringen', icon: TrendingUp },
];

function useTheme() {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('tb5-theme') || 'system'; } catch { return 'system'; } });
  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('tb5-theme', theme); } catch {}
  }, [theme]);
  return [theme, setTheme];
}

function Sidebar({ page, go, onSearch, onLogout }) {
  const { me, tasks, online } = useData();
  const myOpen = tasks.filter((t) => t.assignee_id === me.id && t.status !== 'klaar').length;
  return (
    <aside className="sidebar">
      <div className="brand"><img src="./icon.png" alt="" /><span>The Break 5</span></div>
      <button className="side-search" onClick={onSearch}>
        <Search size={15} /> <span className="grow">Zoeken</span> <kbd>Ctrl K</kbd>
      </button>
      <nav>
        {NAV.map((n) => (
          <button key={n.id} className={cx('nav-item', page === n.id && 'active')} onClick={() => go(n.id)}>
            <n.icon size={18} />
            <span className="grow">{n.label}</span>
            {n.id === 'tasks' && myOpen > 0 && <span className="nav-count">{myOpen}</span>}
          </button>
        ))}
        <div className="nav-label">Binnenkort</div>
        {LATER.map((n) => (
          <div key={n.label} className="nav-item disabled" title="Komt in een volgende versie">
            <n.icon size={18} /><span className="grow">{n.label}</span>
          </div>
        ))}
      </nav>
      <div className="side-foot">
        <button className={cx('nav-item', page === 'settings' && 'active')} onClick={() => go('settings')}>
          <SettingsIcon size={18} /><span className="grow">Instellingen</span>
        </button>
        <div className="me">
          <Avatar user={me} size={28} />
          <div className="grow ellipsis">
            <strong className="ellipsis block">{me.name}</strong>
            <span className={cx('conn', online ? 'on' : 'off')}>{online ? 'Verbonden' : 'Geen verbinding'}</span>
          </div>
          <button className="icon-btn" title="Uitloggen" onClick={onLogout}><LogOut size={16} /></button>
        </div>
      </div>
    </aside>
  );
}

function Workspace({ onLogout }) {
  const [route, setRoute] = useState({ page: 'dashboard', params: null });
  const [task, setTask] = useState(null);
  const [palette, setPalette] = useState(false);
  const [theme, setTheme] = useTheme();
  const { loaded, online } = useData();

  const go = useCallback((page, params = null) => setRoute({ page, params }), []);
  const openTask = useCallback((t) => setTask(t || {}), []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const props = { params: route.params, go, openTask };
  let content;
  if (!loaded) content = <div className="page center muted"><Loader2 className="spin" /> Laden…</div>;
  else if (route.page === 'tasks') content = <Tasks {...props} />;
  else if (route.page === 'projects') content = <Projects {...props} />;
  else if (route.page === 'contacts') content = <Contacts {...props} />;
  else if (route.page === 'meetings') content = <Meetings {...props} />;
  else if (route.page === 'files') content = <Files {...props} />;
  else if (route.page === 'settings') content = <Settings theme={theme} setTheme={setTheme} />;
  else content = <Dashboard {...props} />;

  return (
    <div className="layout">
      <Sidebar page={route.page} go={go} onSearch={() => setPalette(true)} onLogout={onLogout} />
      <main className="main">
        {!online && <div className="offline-bar">Verbinding met de host verbroken. Opnieuw verbinden…</div>}
        {content}
      </main>
      {task && <TaskModal key={task.id || 'new'} task={task} onClose={() => setTask(null)} />}
      {palette && <CommandPalette onClose={() => setPalette(false)} go={go} openTask={openTask} />}
      <ConfirmHost />
    </div>
  );
}

export default function App() {
  const [cfg, setCfg] = useState(undefined); // undefined = loading, null = browser
  const [me, setMe] = useState(undefined);

  useEffect(() => {
    (async () => {
      if (!desktop) {
        setBase('');
        setCfg(null);
        return;
      }
      const c = await desktop.getConfig();
      if (c.mode === 'host' && c.hostRunning) setBase(`http://127.0.0.1:${c.hostPort}`);
      else if (c.mode === 'client') setBase(c.hostUrl);
      setCfg(c);
    })();
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    setToken(null);
    setMe(null);
  }, []);

  useEffect(() => {
    if (cfg === undefined) return;
    if (cfg && (!cfg.mode || (cfg.mode === 'host' && !cfg.hostRunning))) return;
    setUnauthorizedHandler(() => { setToken(null); setMe(null); });
    if (!getToken()) { setMe(null); return; }
    api.get('/auth/me').then(setMe).catch(() => setMe(null));
  }, [cfg]);

  let screen;
  if (cfg === undefined) screen = null;
  else if (cfg && !cfg.mode) screen = <ConnectionSetup cfg={cfg} />;
  else if (cfg && cfg.mode === 'host' && !cfg.hostRunning) screen = <HostError cfg={cfg} />;
  else if (me === undefined) screen = <div className="auth-screen muted"><Loader2 className="spin" /></div>;
  else if (!me) screen = <Login cfg={cfg} onLogin={setMe} />;
  else screen = <DataProvider me={me}><Workspace onLogout={logout} /></DataProvider>;

  return <ToastHost>{screen}</ToastHost>;
}
