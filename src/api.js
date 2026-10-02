// Talks to the host server. In the desktop app the base URL comes from the
// local config (this PC or the host on the network); in a browser it is the
// page's own origin.
let base = '';
let token = null;
let onUnauthorized = () => {};

const tokenKey = () => `tb5-token:${base || location.origin}`;

export const desktop = typeof window !== 'undefined' ? window.desktop : undefined;

export function setBase(url) {
  base = (url || '').replace(/\/$/, '');
  try { token = localStorage.getItem(tokenKey()); } catch { token = null; }
}

export const getBase = () => base;
export const getToken = () => token;

export function setToken(t) {
  token = t;
  try {
    if (t) localStorage.setItem(tokenKey(), t);
    else localStorage.removeItem(tokenKey());
  } catch {}
}

export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function request(method, path, body) {
  let res;
  try {
    res = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Geen verbinding met de host-pc. Staat die aan en draait The Break 5 daar?', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/auth/login') onUnauthorized();
  if (!res.ok) throw new ApiError(data.error || `Fout ${res.status}`, res.status);
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b = {}) => request('POST', p, b),
  patch: (p, b) => request('PATCH', p, b),
  del: (p) => request('DELETE', p),
};

export function uploadFile(folder, file, onProgress) {
  // XHR instead of fetch so we get upload progress for large files.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `${base}/api/files/upload?path=${encodeURIComponent(folder)}&name=${encodeURIComponent(file.name)}`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new ApiError(data.error || `Upload mislukt (${xhr.status})`, xhr.status));
    };
    xhr.onerror = () => reject(new ApiError('Upload mislukt: geen verbinding met de host.', 0));
    xhr.send(file);
  });
}

export function fileUrl(relPath, inline = false) {
  return `${base}/api/files/download?path=${encodeURIComponent(relPath)}&token=${encodeURIComponent(token || '')}${inline ? '&inline=1' : ''}`;
}

export async function openFile(relPath) {
  if (desktop) {
    const r = await desktop.openFile({ base, token, relPath });
    if (!r.ok) throw new ApiError(`Openen mislukt: ${r.error}`, 0);
    return r;
  }
  window.open(fileUrl(relPath, true), '_blank');
  return { ok: true };
}

export function subscribe(onTopic, onStatus) {
  let es;
  let closed = false;
  const connect = () => {
    es = new EventSource(`${base}/api/events?token=${encodeURIComponent(token || '')}`);
    es.onopen = () => onStatus?.(true);
    es.onmessage = (e) => {
      try { onTopic(JSON.parse(e.data).topic); } catch {}
    };
    es.onerror = () => {
      onStatus?.(false);
      es.close();
      if (!closed) setTimeout(connect, 3000);
    };
  };
  connect();
  return () => {
    closed = true;
    es?.close();
  };
}
