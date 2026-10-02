import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Folder, FolderPlus, Upload, Search, ChevronRight, Home, LayoutGrid, List, MoreHorizontal, FileText,
  FileSpreadsheet, FileImage, FileVideo, FileAudio, FileArchive, File as FileIcon, Presentation, ExternalLink,
  Pencil, Trash2, Download, FolderOpen, X, ArrowUp,
} from 'lucide-react';
import { api, desktop, fileUrl, openFile, uploadFile } from '../api';
import { useData, useToast } from '../store';
import { colorFor, cx, fileKind, fmtSize, localDateStr, fmtDate } from '../util';
import { Empty, Field, Modal, PageHeader, confirmDialog } from '../components/ui';

const KIND_ICONS = {
  pdf: FileText, word: FileText, excel: FileSpreadsheet, ppt: Presentation, image: FileImage,
  video: FileVideo, audio: FileAudio, archive: FileArchive, text: FileText, other: FileIcon,
};

const join = (a, b) => [a, b].filter(Boolean).join('/');
const parentOf = (p) => p.split('/').slice(0, -1).join('/');

function PromptModal({ title, label, initial = '', okText = 'Opslaan', onSubmit, onClose }) {
  const [v, setV] = useState(initial);
  const ref = useRef(null);
  useEffect(() => {
    // Select the name without the extension, like Windows Explorer does.
    const el = ref.current;
    if (!el) return;
    const dot = initial.lastIndexOf('.');
    el.focus();
    el.setSelectionRange(0, dot > 0 ? dot : initial.length);
  }, [initial]);
  const submit = () => v.trim() && onSubmit(v.trim());
  return (
    <Modal title={title} onClose={onClose} footer={<><span className="grow" /><button className="btn" onClick={onClose}>Annuleren</button><button className="btn btn-primary" onClick={submit}>{okText}</button></>}>
      <Field label={label}><input ref={ref} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} /></Field>
    </Modal>
  );
}

function FileTypeIcon({ ext, size = 22 }) {
  const k = fileKind(ext);
  const Icon = KIND_ICONS[k.kind] || FileIcon;
  return <Icon size={size} style={{ color: k.color }} />;
}

// Reads folders dropped from Windows Explorer, recursively.
async function collectDropped(dataTransfer) {
  const out = []; // { dir, file }
  const items = [...(dataTransfer.items || [])];
  const entries = items.map((i) => i.webkitGetAsEntry?.()).filter(Boolean);
  if (!entries.length) return [...dataTransfer.files].map((file) => ({ dir: '', file }));
  const readAll = (reader) => new Promise((res) => {
    const all = [];
    const next = () => reader.readEntries((batch) => (batch.length ? (all.push(...batch), next()) : res(all)), () => res(all));
    next();
  });
  const walk = async (entry, dir) => {
    if (entry.isFile) {
      const file = await new Promise((res, rej) => entry.file(res, rej));
      out.push({ dir, file });
    } else if (entry.isDirectory) {
      out.push({ dir: join(dir, entry.name), file: null }); // make sure empty folders exist too
      for (const child of await readAll(entry.createReader())) await walk(child, join(dir, entry.name));
    }
  };
  for (const e of entries) await walk(e, '');
  return out;
}

export default function Files({ params, go }) {
  const { filesVersion, online } = useData();
  const toast = useToast();
  const [path, setPath] = useState(params?.path || '');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState(() => { try { return localStorage.getItem('tb5-files-view') || 'bubbles'; } catch { return 'bubbles'; } });
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [menu, setMenu] = useState(null); // { item, x, y }
  const [prompt, setPrompt] = useState(null);
  const [uploads, setUploads] = useState([]); // { name, progress }
  const [dropActive, setDropActive] = useState(false);
  const [dragItem, setDragItem] = useState(null);
  const [overFolder, setOverFolder] = useState(null);
  const [highlight, setHighlight] = useState(params?.highlight || null);
  const fileInput = useRef(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    if (params?.path !== undefined) setPath(params.path || '');
    if (params?.highlight) setHighlight(params.highlight);
  }, [params]);

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/files/list?path=${encodeURIComponent(path)}`);
      setItems(r.items);
      setError('');
    } catch (e) {
      if (e.status === 404 && path) {
        toast('Deze map bestaat niet meer.', 'error');
        setPath(parentOf(path));
      } else setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [path, toast]);

  useEffect(() => { load(); }, [load, filesVersion]);

  useEffect(() => {
    if (!highlight) return;
    const t = setTimeout(() => setHighlight(null), 2500);
    return () => clearTimeout(t);
  }, [highlight]);

  // Debounced search across all folders.
  useEffect(() => {
    if (!q.trim()) { setResults(null); return; }
    const t = setTimeout(() => {
      api.get(`/files/search?q=${encodeURIComponent(q.trim())}`).then(setResults).catch((e) => toast(e.message, 'error'));
    }, 250);
    return () => clearTimeout(t);
  }, [q, filesVersion, toast]);

  useEffect(() => {
    if (!desktop) return;
    return desktop.onFileSynced((r) => {
      if (r.ok) toast(`Wijzigingen in "${r.path.split('/').pop()}" opgeslagen op de host`, 'ok');
      else toast(`Kon "${r.path.split('/').pop()}" niet terugzetten op de host: ${r.error}. Je kopie staat in ${r.local}`, 'error');
    });
  }, [toast]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('blur', close);
    return () => { window.removeEventListener('click', close); window.removeEventListener('blur', close); };
  }, [menu]);

  const navigate = (p) => {
    setPath(p);
    setQ('');
    setMenu(null);
  };

  const switchView = (v) => {
    setView(v);
    try { localStorage.setItem('tb5-files-view', v); } catch {}
  };

  const folders = items.filter((i) => i.type === 'folder');
  const files = items.filter((i) => i.type === 'file');
  const crumbs = path ? path.split('/') : [];

  // ---- actions ---------------------------------------------------------------
  const open = async (item, itemPath = join(path, item.name)) => {
    if (item.type === 'folder') return navigate(itemPath);
    try {
      const r = await openFile(itemPath);
      if (r.synced) toast('Bestand geopend. Opslaan in het programma zet het automatisch terug op de host.');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const doUpload = async (list, base = path) => {
    const total = list.filter((x) => x.file).length;
    if (!list.length) return;
    const createdDirs = new Set();
    let done = 0;
    for (const { dir, file } of list) {
      const target = join(base, dir);
      if (dir && !createdDirs.has(dir)) {
        // Create each missing folder level once.
        const parts = dir.split('/');
        for (let i = 0; i < parts.length; i++) {
          const sub = parts.slice(0, i + 1).join('/');
          if (createdDirs.has(sub)) continue;
          await api.post('/files/folder', { path: join(base, parts.slice(0, i).join('/')), name: parts[i] }).catch(() => {});
          createdDirs.add(sub);
        }
      }
      if (!file) continue;
      const id = Math.random();
      setUploads((u) => [...u, { id, name: file.name, progress: 0 }]);
      try {
        await uploadFile(target, file, (p) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress: p } : x))));
        done++;
      } catch (e) {
        toast(`${file.name}: ${e.message}`, 'error');
      } finally {
        setUploads((u) => u.filter((x) => x.id !== id));
      }
    }
    if (total) toast(`${done} van ${total} bestand${total === 1 ? '' : 'en'} toegevoegd`, done === total ? 'ok' : 'error');
    load();
  };

  const move = async (itemPath, toFolder) => {
    if (parentOf(itemPath) === toFolder || itemPath === toFolder) return;
    try {
      await api.post('/files/move', { path: itemPath, to: toFolder });
      toast(`Verplaatst naar /${toFolder || 'Bestanden'}`, 'ok');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const rename = (item, itemPath) => setPrompt({
    title: item.type === 'folder' ? 'Map hernoemen' : 'Bestand hernoemen',
    label: 'Nieuwe naam',
    initial: item.name,
    onSubmit: async (name) => {
      try {
        await api.post('/files/rename', { path: itemPath, name });
        setPrompt(null);
        load();
      } catch (e) { toast(e.message, 'error'); }
    },
  });

  const remove = async (item, itemPath) => {
    const what = item.type === 'folder' ? `de map "${item.name}" en alles erin` : `"${item.name}"`;
    if (!(await confirmDialog(`Weet je zeker dat je ${what} wilt verwijderen? Het gaat naar de prullenbak op de host-pc.`))) return;
    try {
      await api.del(`/files?path=${encodeURIComponent(itemPath)}`);
      toast('Naar prullenbak verplaatst');
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const newFolder = () => setPrompt({
    title: 'Nieuwe map',
    label: `Naam (in /${path || 'Bestanden'})`,
    initial: '',
    okText: 'Aanmaken',
    onSubmit: async (name) => {
      try {
        await api.post('/files/folder', { path, name });
        setPrompt(null);
        load();
      } catch (e) { toast(e.message, 'error'); }
    },
  });

  const openMenu = (e, item, itemPath) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ item, itemPath, x: Math.min(e.clientX, window.innerWidth - 220), y: Math.min(e.clientY, window.innerHeight - 240) });
  };

  // ---- drag & drop -----------------------------------------------------------
  const isExternal = (e) => [...(e.dataTransfer?.types || [])].includes('Files') && !dragItem;

  const onPageDragEnter = (e) => {
    if (!isExternal(e)) return;
    e.preventDefault();
    dragDepth.current++;
    setDropActive(true);
  };
  const onPageDragLeave = (e) => {
    if (!isExternal(e)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (!dragDepth.current) setDropActive(false);
  };
  const onPageDrop = async (e) => {
    if (!isExternal(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDropActive(false);
    doUpload(await collectDropped(e.dataTransfer));
  };

  const itemDragProps = (item, itemPath) => ({
    draggable: true,
    onDragStart: (e) => {
      setDragItem(itemPath);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', itemPath);
    },
    onDragEnd: () => { setDragItem(null); setOverFolder(null); },
  });

  // Folders, breadcrumbs and the "up" target accept dragged items.
  const dropTargetProps = (folderPath) => ({
    onDragOver: (e) => {
      if (dragItem && dragItem !== folderPath && !folderPath.startsWith(dragItem + '/')) {
        e.preventDefault();
        e.stopPropagation();
        setOverFolder(folderPath);
      } else if (isExternal(e)) {
        e.preventDefault();
      }
    },
    onDragLeave: () => setOverFolder((f) => (f === folderPath ? null : f)),
    onDrop: async (e) => {
      e.preventDefault();
      e.stopPropagation();
      setOverFolder(null);
      if (dragItem) {
        const from = dragItem;
        setDragItem(null);
        move(from, folderPath);
      } else if (isExternal(e)) {
        dragDepth.current = 0;
        setDropActive(false);
        // Upload straight into the folder it was dropped on.
        doUpload(await collectDropped(e.dataTransfer), folderPath);
      }
    },
  });

  return (
    <div
      className={cx('page files-page', dropActive && 'drop-active')}
      onDragEnter={onPageDragEnter}
      onDragLeave={onPageDragLeave}
      onDragOver={(e) => isExternal(e) && e.preventDefault()}
      onDrop={onPageDrop}
    >
      <PageHeader title="Bestanden" subtitle="Gedeelde bedrijfsbestanden op de host-pc">
        <div className="search-input">
          <Search size={15} />
          <input placeholder="Zoek in alle mappen…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && <button className="icon-btn ghost" onClick={() => setQ('')}><X size={14} /></button>}
        </div>
        <div className="seg">
          <button className={cx('seg-btn', view === 'bubbles' && 'on')} onClick={() => switchView('bubbles')} title="Bubbels"><LayoutGrid size={15} /></button>
          <button className={cx('seg-btn', view === 'list' && 'on')} onClick={() => switchView('list')} title="Lijst"><List size={15} /></button>
        </div>
        <button className="btn" onClick={newFolder}><FolderPlus size={16} /> Nieuwe map</button>
        <button className="btn btn-primary" onClick={() => fileInput.current?.click()}><Upload size={16} /> Bestanden toevoegen</button>
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => { doUpload([...e.target.files].map((file) => ({ dir: '', file }))); e.target.value = ''; }} />
      </PageHeader>

      <nav className="crumbs">
        <button className={cx('crumb', overFolder === '' && 'drop-over')} onClick={() => navigate('')} {...dropTargetProps('')}>
          <Home size={15} /> Bestanden
        </button>
        {crumbs.map((c, i) => {
          const p = crumbs.slice(0, i + 1).join('/');
          return (
            <span key={p} className="row">
              <ChevronRight size={15} className="muted" />
              <button className={cx('crumb', i === crumbs.length - 1 && 'current', overFolder === p && 'drop-over')} onClick={() => navigate(p)} {...dropTargetProps(p)}>
                {c}
              </button>
            </span>
          );
        })}
        <span className="grow" />
        {desktop && <RevealButton path={path} />}
      </nav>

      {!online && <div className="banner banner-warn">Geen verbinding met de host. Bestanden zijn tijdelijk niet bereikbaar.</div>}
      {error && <div className="banner banner-error">{error}</div>}

      {results ? (
        <div className="card">
          <div className="list-head"><span className="muted small">{results.length} resultaten voor “{q}” in alle mappen</span></div>
          {results.map((r) => (
            <div
              key={r.path}
              className="file-row"
              onClick={() => (r.type === 'folder' ? navigate(r.path) : (navigate(r.parent), setHighlight(r.name)))}
              onDoubleClick={() => r.type === 'file' && open(r, r.path)}
              onContextMenu={(e) => openMenu(e, r, r.path)}
            >
              {r.type === 'folder' ? <Folder size={20} style={{ color: colorFor(r.name) }} fill={colorFor(r.name)} fillOpacity={0.25} /> : <FileTypeIcon ext={r.ext} size={20} />}
              <span className="grow ellipsis"><strong>{r.name}</strong> <span className="muted small">in /{r.parent || 'Bestanden'}</span></span>
              <span className="muted small">{r.type === 'folder' ? 'Map' : fmtSize(r.size)}</span>
            </div>
          ))}
          {!results.length && <div className="list-empty">Niets gevonden.</div>}
        </div>
      ) : loading ? null : !items.length ? (
        <Empty
          icon={FolderOpen}
          title={path ? 'Deze map is leeg' : 'Nog geen bestanden'}
          text="Sleep bestanden of hele mappen vanuit Windows hierheen, of gebruik de knoppen hierboven."
          action={<div className="row gap-s"><button className="btn" onClick={newFolder}><FolderPlus size={16} /> Nieuwe map</button><button className="btn btn-primary" onClick={() => fileInput.current?.click()}><Upload size={16} /> Bestanden toevoegen</button></div>}
        />
      ) : view === 'bubbles' ? (
        <>
          {(folders.length > 0 || path) && (
            <section>
              <h3 className="section-label">Mappen <span className="count">{folders.length}</span></h3>
              <div className="bubbles">
                {path && (
                  <button className={cx('bubble bubble-up', overFolder === parentOf(path) && 'drop-over')} onClick={() => navigate(parentOf(path))} title="Map omhoog" {...dropTargetProps(parentOf(path))}>
                    <span className="bubble-circle"><ArrowUp size={26} /></span>
                    <span className="bubble-name">Omhoog</span>
                  </button>
                )}
                {folders.map((f) => {
                  const p = join(path, f.name);
                  const color = colorFor(f.name);
                  return (
                    <button
                      key={f.name}
                      className={cx('bubble', overFolder === p && 'drop-over', dragItem === p && 'dragging', highlight === f.name && 'flash')}
                      style={{ '--c': color }}
                      onClick={() => open(f)}
                      onContextMenu={(e) => openMenu(e, f, p)}
                      title={`${f.name} · ${f.count} item${f.count === 1 ? '' : 's'}`}
                      {...itemDragProps(f, p)}
                      {...dropTargetProps(p)}
                    >
                      <span className="bubble-circle">
                        <Folder size={30} />
                        <span className="bubble-count">{f.count}</span>
                      </span>
                      <span className="bubble-name">{f.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
          {files.length > 0 && (
            <section>
              <h3 className="section-label">Bestanden <span className="count">{files.length}</span></h3>
              <div className="file-cards">
                {files.map((f) => {
                  const p = join(path, f.name);
                  const k = fileKind(f.ext);
                  return (
                    <div
                      key={f.name}
                      className={cx('file-card', dragItem === p && 'dragging', highlight === f.name && 'flash')}
                      style={{ '--c': k.color }}
                      onClick={() => open(f)}
                      onContextMenu={(e) => openMenu(e, f, p)}
                      title={`${f.name}\nKlik om te openen`}
                      {...itemDragProps(f, p)}
                    >
                      <div className="file-thumb">
                        {k.kind === 'image' && f.size < 8 * 1024 * 1024 ? (
                          <img src={fileUrl(p, true)} alt="" loading="lazy" draggable={false} />
                        ) : (
                          <FileTypeIcon ext={f.ext} size={34} />
                        )}
                        <span className="file-ext">{(f.ext || '?').toUpperCase()}</span>
                      </div>
                      <div className="file-info">
                        <span className="file-name" title={f.name}>{f.name}</span>
                        <span className="muted small">{fmtSize(f.size)} · {fmtDate(localDateStr(new Date(f.mtime)))}</span>
                      </div>
                      <button className="icon-btn ghost file-more" onClick={(e) => openMenu(e, f, p)} title="Meer"><MoreHorizontal size={16} /></button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="card">
          {path && (
            <div className={cx('file-row', overFolder === parentOf(path) && 'drop-over')} onClick={() => navigate(parentOf(path))} {...dropTargetProps(parentOf(path))}>
              <ArrowUp size={20} className="muted" /><span className="grow">..</span>
            </div>
          )}
          {[...folders, ...files].map((f) => {
            const p = join(path, f.name);
            return (
              <div
                key={f.name}
                className={cx('file-row', f.type === 'folder' && 'is-folder', overFolder === p && 'drop-over', highlight === f.name && 'flash')}
                onClick={() => open(f)}
                onContextMenu={(e) => openMenu(e, f, p)}
                {...itemDragProps(f, p)}
                {...(f.type === 'folder' ? dropTargetProps(p) : {})}
              >
                {f.type === 'folder' ? <Folder size={20} style={{ color: colorFor(f.name) }} fill={colorFor(f.name)} fillOpacity={0.25} /> : <FileTypeIcon ext={f.ext} size={20} />}
                <span className="grow ellipsis">{f.type === 'folder' ? <strong>{f.name}</strong> : f.name}</span>
                <span className="muted small w-90">{f.type === 'folder' ? `${f.count} items` : fileKind(f.ext).label}</span>
                <span className="muted small w-90 right">{f.type === 'file' ? fmtSize(f.size) : ''}</span>
                <span className="muted small w-90 right">{fmtDate(localDateStr(new Date(f.mtime)))}</span>
                <button className="icon-btn ghost" onClick={(e) => openMenu(e, f, p)}><MoreHorizontal size={16} /></button>
              </div>
            );
          })}
        </div>
      )}

      {dropActive && (
        <div className="drop-overlay">
          <Upload size={42} />
          <p>Loslaten om toe te voegen aan <strong>/{path || 'Bestanden'}</strong></p>
          <p className="small">Of laat los op een map-bubbel om het daarin te zetten</p>
        </div>
      )}

      {uploads.length > 0 && (
        <div className="upload-panel">
          <strong>Uploaden ({uploads.length})</strong>
          {uploads.slice(0, 5).map((u) => (
            <div key={u.id} className="upload-item">
              <span className="ellipsis small">{u.name}</span>
              <div className="progress"><div style={{ width: `${Math.round(u.progress * 100)}%` }} /></div>
            </div>
          ))}
        </div>
      )}

      {menu && (
        <div className="ctx-menu" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => { setMenu(null); open(menu.item, menu.itemPath); }}>
            {menu.item.type === 'folder' ? <FolderOpen size={15} /> : <ExternalLink size={15} />} Openen
          </button>
          {menu.item.type === 'file' && (
            <a href={fileUrl(menu.itemPath)} download={menu.item.name} onClick={() => setMenu(null)}><Download size={15} /> Downloaden</a>
          )}
          {desktop && <RevealButton path={menu.itemPath} asMenu onDone={() => setMenu(null)} />}
          <button onClick={() => { setMenu(null); rename(menu.item, menu.itemPath); }}><Pencil size={15} /> Hernoemen</button>
          <hr />
          <button className="danger" onClick={() => { setMenu(null); remove(menu.item, menu.itemPath); }}><Trash2 size={15} /> Verwijderen</button>
        </div>
      )}

      {prompt && <PromptModal {...prompt} onClose={() => setPrompt(null)} />}
    </div>
  );
}

// "Show in Explorer" only works on the host PC, where the files actually live.
function RevealButton({ path, asMenu, onDone }) {
  const [isHost, setIsHost] = useState(false);
  useEffect(() => { desktop.getConfig().then((c) => setIsHost(c.mode === 'host')); }, []);
  if (!isHost) return null;
  const click = () => { desktop.revealFile(path); onDone?.(); };
  return asMenu
    ? <button onClick={click}><FolderOpen size={15} /> Toon in Verkenner</button>
    : <button className="btn btn-sm" onClick={click}><FolderOpen size={14} /> Open in Verkenner</button>;
}
