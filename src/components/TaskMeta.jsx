import { ListChecks, MessageSquare, Repeat } from 'lucide-react';
import { useData } from '../store';

// Small indicators: subtask progress, comment count, repeats.
export default function TaskMeta({ task }) {
  const { commentCounts } = useData();
  const list = task.checklist || [];
  const comments = commentCounts[`tasks:${task.id}`] || 0;
  if (!list.length && !comments && !task.recurrence) return null;
  return (
    <span className="row gap-s">
      {list.length > 0 && <span className="meta-chip" title="Subtaken"><ListChecks size={12} />{list.filter((c) => c.done).length}/{list.length}</span>}
      {comments > 0 && <span className="meta-chip" title="Reacties"><MessageSquare size={12} />{comments}</span>}
      {task.recurrence && <span className="meta-chip" title={`Herhaalt: ${task.recurrence}`}><Repeat size={12} /></span>}
    </span>
  );
}
