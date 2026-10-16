import React, { useState } from 'react';
import { Plus, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTasks } from '@/hooks/useTasks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TEAM_MEMBERS,
  TASK_PROJECT_LABELS,
  TASK_PRIORITY_LABELS,
  type TaskFormData,
  type TaskStatus,
  type TaskPriority,
} from '@/types/task';

export const Tasks: React.FC = () => {
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showAddRow, setShowAddRow] = useState(false);
  const [newTask, setNewTask] = useState<Partial<TaskFormData>>({
    text: '',
    assignee: 'Alex',
    project: 'A',
    priority: 'none',
    status: 'pending',
  });

  const filters = {
    assignee: filterAssignee !== 'all' ? filterAssignee : undefined,
    status: filterStatus !== 'all' ? (filterStatus as TaskStatus) : undefined,
  };

  const { tasks, loading, addTask, editTask, removeTask, toggleStatus } = useTasks(
    filters.assignee || filters.status ? filters : undefined
  );

  const handleAddTask = async () => {
    if (!newTask.text?.trim()) {
      toast.error('Task text is required');
      return;
    }

    try {
      await addTask({
        text: newTask.text.trim(),
        assignee: newTask.assignee || 'Alex',
        project: newTask.project || 'A',
        priority: newTask.priority || 'none',
        status: 'pending',
        dueDate: newTask.dueDate,
      });
      setNewTask({
        text: '',
        assignee: 'Alex',
        project: 'A',
        priority: 'none',
        status: 'pending',
      });
      setShowAddRow(false);
      toast.success('Task added');
    } catch {
      toast.error('Failed to add task');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await removeTask(id);
      toast.success('Task deleted');
    } catch {
      toast.error('Failed to delete task');
    }
  };

  const handleToggle = async (id: string, currentStatus: string) => {
    try {
      await toggleStatus(id, currentStatus);
    } catch {
      toast.error('Failed to update task');
    }
  };

  const handleFieldChange = async (id: string, field: string, value: string) => {
    try {
      await editTask(id, { [field]: value });
    } catch {
      toast.error('Failed to update task');
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'P0': return 'destructive';
      case 'P1': return 'default';
      case 'P2': return 'secondary';
      case 'P3': return 'outline';
      default: return 'outline';
    }
  };

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  // Group tasks by assignee for summary
  const tasksByAssignee = tasks.reduce((acc, task) => {
    const assignee = task.assignee || 'Unassigned';
    if (!acc[assignee]) {
      acc[assignee] = { pending: 0, done: 0 };
    }
    if (task.status === 'done') {
      acc[assignee].done++;
    } else {
      acc[assignee].pending++;
    }
    return acc;
  }, {} as Record<string, { pending: number; done: number }>);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team Tasks</h1>
          <p className="text-muted-foreground">
            {tasks.filter(t => t.status !== 'done').length} pending · {tasks.filter(t => t.status === 'done').length} done
          </p>
        </div>
        <Button onClick={() => setShowAddRow(true)} disabled={showAddRow}>
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </div>

      {/* Summary by assignee */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(tasksByAssignee).map(([assignee, counts]) => (
          <Badge key={assignee} variant="outline" className="text-sm">
            {assignee}: {counts.pending} pending
            {counts.done > 0 && `, ${counts.done} done`}
          </Badge>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assignees</SelectItem>
            {TEAM_MEMBERS.map(member => (
              <SelectItem key={member} value={member}>{member}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tasks table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Done</TableHead>
              <TableHead>Task</TableHead>
              <TableHead className="w-32">Assignee</TableHead>
              <TableHead className="w-28">Project</TableHead>
              <TableHead className="w-28">Priority</TableHead>
              <TableHead className="w-32">Due Date</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Add new task row */}
            {showAddRow && (
              <TableRow>
                <TableCell></TableCell>
                <TableCell>
                  <Input
                    placeholder="Task description..."
                    value={newTask.text || ''}
                    onChange={(e) => setNewTask({ ...newTask, text: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                    autoFocus
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={newTask.assignee}
                    onValueChange={(v) => setNewTask({ ...newTask, assignee: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEAM_MEMBERS.map(member => (
                        <SelectItem key={member} value={member}>{member}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={newTask.project}
                    onValueChange={(v) => setNewTask({ ...newTask, project: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TASK_PROJECT_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={newTask.priority}
                    onValueChange={(v) => setNewTask({ ...newTask, priority: v as TaskPriority })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    type="date"
                    value={newTask.dueDate || ''}
                    onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={handleAddTask}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setShowAddRow(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* Existing tasks */}
            {tasks.map((task) => (
              <TableRow
                key={task.id}
                className={task.status === 'done' ? 'opacity-50' : ''}
              >
                <TableCell>
                  <Checkbox
                    checked={task.status === 'done'}
                    onCheckedChange={() => handleToggle(task.id, task.status)}
                  />
                </TableCell>
                <TableCell className={task.status === 'done' ? 'line-through' : ''}>
                  {task.text}
                </TableCell>
                <TableCell>
                  <Select
                    value={task.assignee}
                    onValueChange={(v) => handleFieldChange(task.id, 'assignee', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEAM_MEMBERS.map(member => (
                        <SelectItem key={member} value={member}>{member}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {TASK_PROJECT_LABELS[task.project as keyof typeof TASK_PROJECT_LABELS] || task.project}
                  </Badge>
                </TableCell>
                <TableCell>
                  {task.priority && task.priority !== 'none' && (
                    <Badge variant={getPriorityColor(task.priority)}>
                      {task.priority}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className={isOverdue(task.dueDate) && task.status !== 'done' ? 'text-destructive font-medium' : ''}>
                  {task.dueDate || '-'}
                </TableCell>
                <TableCell>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(task.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}

            {tasks.length === 0 && !showAddRow && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No tasks found. Click "Add Task" to create one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
