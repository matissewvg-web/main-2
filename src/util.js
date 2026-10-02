export const PRIORITIES = [
  { id: 'urgent', label: 'Urgent', color: '#ef4444' },
  { id: 'hoog', label: 'Hoog', color: '#f97316' },
  { id: 'normaal', label: 'Normaal', color: '#3b82f6' },
  { id: 'laag', label: 'Laag', color: '#94a3b8' },
];
export const PRIORITY = Object.fromEntries(PRIORITIES.map((p) => [p.id, p]));
export const PRIORITY_RANK = { urgent: 0, hoog: 1, normaal: 2, laag: 3 };

export const TASK_STATUSES = [
  { id: 'todo', label: 'Te doen', color: '#64748b' },
  { id: 'bezig', label: 'Bezig', color: '#3b82f6' },
  { id: 'klaar', label: 'Klaar', color: '#10b981' },
];
export const TASK_STATUS = Object.fromEntries(TASK_STATUSES.map((s) => [s.id, s]));

export const PROJECT_STATUSES = [
  { id: 'idee', label: 'Idee', color: '#a855f7' },
  { id: 'actief', label: 'Actief', color: '#3b82f6' },
  { id: 'on_hold', label: 'On hold', color: '#f59e0b' },
  { id: 'afgerond', label: 'Afgerond', color: '#10b981' },
];
export const PROJECT_STATUS = Object.fromEntries(PROJECT_STATUSES.map((s) => [s.id, s]));

export const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#f59e0b', '#10b981', '#14b8a6', '#0ea5e9', '#3b82f6', '#64748b'];

export const cx = (...a) => a.filter(Boolean).join(' ');

// Dates are stored as "YYYY-MM-DD" (deadlines) or UTC "YYYY-MM-DD HH:MM:SS" (timestamps).
export function parseUtc(s) {
  if (!s) return null;
  return new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
}

export function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return localDateStr(d);
}

export function localDateStr(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const DAYS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];

export function fmtDate(s, withDay = false) {
  if (!s) return '';
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const thisYear = y === new Date().getFullYear();
  return `${withDay ? DAYS[date.getDay()] + ' ' : ''}${d} ${MONTHS[m - 1]}${thisYear ? '' : ' ' + y}`;
}

export function daysUntil(s) {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
}

export function deadlineInfo(s, done = false) {
  const n = daysUntil(s);
  if (n === null) return null;
  if (done) return { text: fmtDate(s), tone: 'muted' };
  if (n < 0) return { text: n === -1 ? 'Gisteren' : `${-n} dagen te laat`, tone: 'danger' };
  if (n === 0) return { text: 'Vandaag', tone: 'warn' };
  if (n === 1) return { text: 'Morgen', tone: 'warn' };
  if (n < 7) return { text: fmtDate(s, true), tone: 'soon' };
  return { text: fmtDate(s), tone: 'muted' };
}

export function timeAgo(s) {
  const d = parseUtc(s);
  if (!d) return '';
  const sec = (Date.now() - d.getTime()) / 1000;
  if (sec < 60) return 'zojuist';
  if (sec < 3600) return `${Math.floor(sec / 60)} min geleden`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} uur geleden`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)} d geleden`;
  return fmtDate(localDateStr(d));
}

export function fmtSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}

// Stable color for a folder name so the same folder always gets the same bubble color.
export function colorFor(name = '') {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

const FILE_KINDS = [
  { kind: 'pdf', label: 'PDF', color: '#ef4444', ext: ['pdf'] },
  { kind: 'word', label: 'Word', color: '#2563eb', ext: ['doc', 'docx', 'odt', 'rtf'] },
  { kind: 'excel', label: 'Excel', color: '#16a34a', ext: ['xls', 'xlsx', 'xlsm', 'csv', 'ods'] },
  { kind: 'ppt', label: 'PowerPoint', color: '#ea580c', ext: ['ppt', 'pptx', 'odp', 'key'] },
  { kind: 'image', label: 'Afbeelding', color: '#a855f7', ext: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'heic', 'tif', 'tiff'] },
  { kind: 'video', label: 'Video', color: '#db2777', ext: ['mp4', 'mov', 'avi', 'mkv', 'webm'] },
  { kind: 'audio', label: 'Audio', color: '#0d9488', ext: ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'] },
  { kind: 'archive', label: 'Archief', color: '#a16207', ext: ['zip', 'rar', '7z', 'tar', 'gz'] },
  { kind: 'text', label: 'Tekst', color: '#64748b', ext: ['txt', 'md', 'json', 'xml', 'log'] },
];

export function fileKind(ext = '') {
  const e = ext.toLowerCase();
  return FILE_KINDS.find((k) => k.ext.includes(e)) || { kind: 'other', label: e ? e.toUpperCase() : 'Bestand', color: '#475569' };
}

export function stripHtml(html = '') {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

export const byId = (list) => Object.fromEntries((list || []).map((x) => [x.id, x]));
