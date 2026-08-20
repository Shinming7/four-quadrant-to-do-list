import { useEffect, useMemo, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import './App.css'

type Priority = 'high' | 'medium' | 'low'
type Task = { id: string; title: string; priority: Priority; dueDate: string; completed: boolean; quadrantId: string }
type Quadrant = { id: string; name: string; hint: string; tone: string }
const STORAGE_KEY = 'quadrant-board-v1'
const defaultQuadrants: Quadrant[] = [
  { id: 'q1', name: '重要且紧急', hint: '现在就做', tone: 'coral' },
  { id: 'q2', name: '重要不紧急', hint: '安排时间', tone: 'blue' },
  { id: 'q3', name: '不重要但紧急', hint: '尽快处理', tone: 'gold' },
  { id: 'q4', name: '不重要不紧急', hint: '暂时搁置', tone: 'sage' },
]
const initialTasks: Task[] = [
  { id: 'task-1', title: '整理本周项目计划', priority: 'high', dueDate: '2026-08-21', completed: false, quadrantId: 'q1' },
  { id: 'task-2', title: '完成产品需求草稿', priority: 'high', dueDate: '2026-08-25', completed: false, quadrantId: 'q2' },
  { id: 'task-3', title: '回复团队消息', priority: 'medium', dueDate: '2026-08-20', completed: false, quadrantId: 'q3' },
]
const priorityLabels: Record<Priority, string> = { high: '高优先级', medium: '中优先级', low: '低优先级' }
function readBoard() {
  try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) return JSON.parse(saved) as { quadrants: Quadrant[]; tasks: Task[] } } catch { /* use defaults */ }
  return { quadrants: defaultQuadrants, tasks: initialTasks }
}
function formatDate(date: string) { if (!date) return '无截止日期'; return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(new Date(`${date}T00:00:00`)) }
function TaskCard({ task, onToggle, onDelete }: { task: Task; onToggle: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return <article ref={setNodeRef} style={style} className={`task-card ${task.completed ? 'is-complete' : ''} ${isDragging ? 'is-dragging' : ''}`}>
    <div className="task-card__topline"><button className="check-button" type="button" onClick={onToggle} aria-label={task.completed ? '标记为未完成' : '标记为完成'}>{task.completed ? '✓' : ''}</button><button className="drag-handle" type="button" {...listeners} {...attributes} aria-label="拖动任务">⋮⋮</button><button className="delete-button" type="button" onClick={onDelete} aria-label="删除任务">×</button></div>
    <p className="task-title">{task.title}</p><div className="task-meta"><span className={`priority priority--${task.priority}`}>{priorityLabels[task.priority]}</span><span className="due-date"><span aria-hidden="true">◷</span>{formatDate(task.dueDate)}</span></div>
  </article>
}
function QuadrantPanel({ quadrant, tasks, onRename, onAdd, onToggle, onDelete }: { quadrant: Quadrant; tasks: Task[]; onRename: (name: string) => void; onAdd: () => void; onToggle: (id: string) => void; onDelete: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: quadrant.id }); const [editing, setEditing] = useState(false); const [name, setName] = useState(quadrant.name)
  const saveName = () => { const nextName = name.trim() || quadrant.name; setName(nextName); onRename(nextName); setEditing(false) }
  return <section ref={setNodeRef} className={`quadrant-panel quadrant-panel--${quadrant.tone} ${isOver ? 'is-over' : ''}`}>
    <header className="quadrant-header"><div className="quadrant-heading"><span className="quadrant-dot" />{editing ? <input autoFocus value={name} onChange={(event) => setName(event.target.value)} onBlur={saveName} onKeyDown={(event) => event.key === 'Enter' && saveName()} /> : <button className="quadrant-name" type="button" onClick={() => setEditing(true)}>{quadrant.name}</button>}<span className="task-count">{tasks.length}</span></div><span className="quadrant-hint">{quadrant.hint}</span></header>
    <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}><div className="task-list">{tasks.map((task) => <TaskCard key={task.id} task={task} onToggle={() => onToggle(task.id)} onDelete={() => onDelete(task.id)} />)}<button className="add-task" type="button" onClick={onAdd}><span>+</span> 添加任务</button></div></SortableContext>
  </section>
}
function App() {
  const [{ quadrants, tasks }, setBoard] = useState(readBoard); const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } })); const activeTask = useMemo(() => tasks.find((task) => task.id === activeId), [activeId, tasks])
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify({ quadrants, tasks })) }, [quadrants, tasks])
  const updateTask = (id: string, update: Partial<Task>) => setBoard((board) => ({ ...board, tasks: board.tasks.map((task) => task.id === id ? { ...task, ...update } : task) }))
  const addTask = (quadrantId: string) => { const title = window.prompt('任务名称')?.trim(); if (!title) return; const dueDate = window.prompt('截止日期（可留空，格式：2026-08-30）')?.trim() ?? ''; setBoard((board) => ({ ...board, tasks: [...board.tasks, { id: `task-${Date.now()}`, title, priority: 'medium', dueDate, completed: false, quadrantId }] })) }
  const handleDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id))
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (!over || active.id === over.id) return
    setBoard((board) => {
      const activeTask = board.tasks.find((task) => task.id === active.id)
      if (!activeTask) return board
      const targetTask = board.tasks.find((task) => task.id === over.id)
      const targetQuadrant = board.quadrants.some((quadrant) => quadrant.id === over.id) ? String(over.id) : targetTask?.quadrantId
      if (!targetQuadrant) return board
      const remaining = board.tasks.filter((task) => task.id !== active.id)
      const targetIndex = targetTask ? remaining.findIndex((task) => task.id === targetTask.id) : remaining.length
      const insertIndex = targetTask && targetIndex >= 0 ? targetIndex : remaining.map((task) => task.quadrantId).lastIndexOf(targetQuadrant) + 1
      remaining.splice(insertIndex, 0, { ...activeTask, quadrantId: targetQuadrant })
      return { ...board, tasks: remaining }
    })
  }
  return <main className="app-shell"><header className="app-header"><div><p className="eyebrow">FOCUS BOARD <span>·</span> 2026</p><h1>四象限待办</h1><p className="subtitle">把注意力放在真正重要的事情上。</p></div><div className="header-status"><span className="status-dot" />本地已保存</div></header>
    <div className="board-toolbar"><span><strong>{tasks.filter((task) => !task.completed).length}</strong> 项待处理</span><span>点击象限标题即可修改</span></div>
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}><div className="quadrant-grid">{quadrants.map((quadrant) => <QuadrantPanel key={quadrant.id} quadrant={quadrant} tasks={tasks.filter((task) => task.quadrantId === quadrant.id)} onRename={(name) => setBoard((board) => ({ ...board, quadrants: board.quadrants.map((item) => item.id === quadrant.id ? { ...item, name } : item) }))} onAdd={() => addTask(quadrant.id)} onToggle={(id) => updateTask(id, { completed: !tasks.find((task) => task.id === id)?.completed })} onDelete={(id) => setBoard((board) => ({ ...board, tasks: board.tasks.filter((task) => task.id !== id) }))} />)}</div><DragOverlay>{activeTask ? <TaskCard task={activeTask} onToggle={() => undefined} onDelete={() => undefined} /> : null}</DragOverlay></DndContext>
    <footer className="app-footer"><span>拖动卡片来重新安排优先级</span><span>共 {tasks.length} 项任务</span></footer></main>
}
export default App
