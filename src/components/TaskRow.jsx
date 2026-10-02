import { Circle, CheckCircle2, FolderKanban } from 'lucide-react';
import { api } from '../api';
import { useData, useToast } from '../store';
import { cx } from '../util';
import { AvatarStack, DeadlineBadge, PriorityBadge, TagChips } from './ui';

export function toggleDone(task, patchLocal, toast) {
  const status = task.status === 'klaar' ? 'todo' : 'klaar';
  patchLocal('tasks', task.id, { status });
  api.patch(`/tasks/${task.id}`, { status }).catch((e) => toast(e.message, 'error'));
}

// Compact one-line task used on the dashboard, project pages and list view.
export default function TaskRow({ task, onOpen, showProject = true }) {
  const { maps, patchLocal } = useData();
  const toast = useToast();
  const done = task.status === 'klaar';
  const project = maps.projects[task.project_id];
  return (
    <div className={cx('task-row', done && 'done')} onClick={() => onOpen(task)}>
      <button
        className="check-btn"
        title={done ? 'Markeer als niet klaar' : 'Markeer als klaar'}
        onClick={(e) => { e.stopPropagation(); toggleDone(task, patchLocal, toast); }}
      >
        {done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
      </button>
      <PriorityBadge value={task.priority} compact />
      <span className="task-title">{task.title}</span>
      {task.status === 'bezig' && <span className="pill pill-blue">Bezig</span>}
      <TagChips ids={task.tags} />
      <span className="grow" />
      {showProject && project && (
        <span className="muted small row gap-xs"><FolderKanban size={13} />{project.name}</span>
      )}
      <DeadlineBadge date={task.deadline} done={done} />
      <AvatarStack ids={task.assignees} size={22} />
    </div>
  );
}
