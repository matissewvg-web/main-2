import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, subscribe } from './api';
import { byId } from './util';

const COLLECTIONS = ['users', 'tags', 'contacts', 'projects', 'tasks', 'meetings'];

const DataContext = createContext(null);
export const useData = () => useContext(DataContext);

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastHost({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((text, tone = 'info') => {
    const id = Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 3000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>{t.text}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Loads every collection once and keeps it fresh through the host's event
// stream. For a 2–5 person company this is a few thousand rows at most.
export function DataProvider({ me, children }) {
  const [data, setData] = useState(() => Object.fromEntries(COLLECTIONS.map((c) => [c, []])));
  const [loaded, setLoaded] = useState(false);
  const [online, setOnline] = useState(true);
  const [filesVersion, setFilesVersion] = useState(0);
  const wasOffline = useRef(false);

  const reload = useCallback(async (name) => {
    const names = name ? [name] : COLLECTIONS;
    const results = await Promise.all(names.map((n) => api.get(`/${n}`).catch(() => null)));
    setData((d) => {
      const next = { ...d };
      names.forEach((n, i) => { if (results[i]) next[n] = results[i]; });
      return next;
    });
  }, []);

  useEffect(() => {
    reload().then(() => setLoaded(true));
    return subscribe(
      (topic) => {
        if (topic === 'files') setFilesVersion((v) => v + 1);
        else if (COLLECTIONS.includes(topic)) reload(topic);
      },
      (ok) => {
        setOnline(ok);
        if (ok && wasOffline.current) {
          reload();
          setFilesVersion((v) => v + 1);
        }
        wasOffline.current = !ok;
      }
    );
  }, [reload]);

  const value = useMemo(() => {
    const maps = Object.fromEntries(COLLECTIONS.map((c) => [c, byId(data[c])]));
    // Optimistic local update so drag & drop feels instant; the event stream
    // brings the authoritative version a moment later.
    const patchLocal = (coll, id, patch) =>
      setData((d) => ({ ...d, [coll]: d[coll].map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
    return { ...data, maps, me, loaded, online, filesVersion, reload, patchLocal };
  }, [data, me, loaded, online, filesVersion, reload]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
