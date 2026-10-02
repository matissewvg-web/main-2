import { useEffect, useState } from 'react';
import { FileText, FolderOpen } from 'lucide-react';
import { useData } from '../store';
import { cx } from '../util';
import Documents from './Documents';
import Files from './Files';

// One place for everything written: documents made in the app and the shared files.
export default function DocumentHub(props) {
  const { params } = props;
  const { documents } = useData();
  const pick = () => {
    if (params?.tab) return params.tab;
    if (params?.doc || params?.newDoc) return 'docs';
    if (params?.path !== undefined || params?.highlight) return 'files';
    try { return localStorage.getItem('tb5-hub-tab') || 'docs'; } catch { return 'docs'; }
  };
  const [tab, setTab] = useState(pick);
  useEffect(() => { setTab(pick()); }, [params]); // eslint-disable-line react-hooks/exhaustive-deps
  const choose = (t) => {
    setTab(t);
    try { localStorage.setItem('tb5-hub-tab', t); } catch {}
  };
  return (
    <>
      <div className="hub-tabs">
        <button className={cx('hub-tab', tab === 'docs' && 'on')} onClick={() => choose('docs')}><FileText size={16} /> Documenten <span className="count">{documents.length}</span></button>
        <button className={cx('hub-tab', tab === 'files' && 'on')} onClick={() => choose('files')}><FolderOpen size={16} /> Bestanden</button>
      </div>
      {tab === 'docs' ? <Documents {...props} /> : <Files {...props} />}
    </>
  );
}
