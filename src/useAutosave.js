import { useEffect, useRef, useState } from 'react';
import { api } from './api';

/**
 * Local draft of a record that saves itself 800 ms after the last change.
 * Changes from colleagues are taken over only while there are no unsaved local edits.
 */
export function useAutosave(record, endpoint, onError) {
  const [draft, setDraft] = useState(record);
  const [state, setState] = useState('saved'); // saved | dirty | saving
  const pending = useRef(null);
  const timer = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (stateRef.current === 'saved') setDraft(record);
  }, [record]);

  const flush = async () => {
    clearTimeout(timer.current);
    const patch = pending.current;
    if (!patch) return;
    pending.current = null;
    setState('saving');
    try {
      await api.patch(`${endpoint}/${record.id}`, patch);
      setState(pending.current ? 'dirty' : 'saved');
    } catch (e) {
      onError?.(e);
      pending.current = { ...patch, ...pending.current };
      setState('dirty');
    }
  };

  // Save when leaving the page or switching to another record.
  useEffect(() => () => { flush(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (v) => {
    const value = v?.target ? (v.target.type === 'checkbox' ? v.target.checked : v.target.value) : v;
    setDraft((x) => ({ ...x, [k]: value }));
    pending.current = { ...pending.current, [k]: value };
    setState('dirty');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
  };

  const discard = () => { pending.current = null; clearTimeout(timer.current); };

  return { draft, set, state, flush, discard };
}
