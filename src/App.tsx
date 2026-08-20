import { useEffect, useMemo, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import './App.css'

type Task = { id: string; title: string; completed: boolean; quadrantId: string }
type Quadrant = { id: string; name: string; tone: string }
const STORAGE_KEY = 'quadrant-board-v1'
const defaultQuadrants: Quadrant[] = [
  { id: 'q1', name: '重要且紧急', tone: 'coral' },
  { id: 'q2', name: '重要不紧急', tone: 'blue' },
  { id: 'q3', name: '不重要但紧急', tone: 'gold' },
  { id: 'q4', name: '不重要不紧急', tone: 'sage' },
]
const initialTasks: Task[] = [
  { id: 'task-1', title: '整理本周项目计划', completed: false, quadrantId: 'q1' },
  { id: 'task-2', title: '完成产品需求草稿', completed: false, quadrantId: 'q2' },
  { id: 'task-3', title: '回复团队消息', completed: false, quadrantId: 'q3' },
]
function readBoard() {
  try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) return JSON.parse(saved) as { quadrants: Quadrant[]; tasks: Task[] } } catch { /* use defaults */ }
  return { quadrants: defaultQuadrants, tasks: initialTasks }
}
function saveBoard(board: { quadrants: Quadrant[]; tasks: Task[] }) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(board)) } catch { /* file previews may disable storage */ }
}
function TaskCard({ task, onToggle, onDelete }: { task: Task; onToggle: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return <article ref={setNodeRef} style={style} {...listeners} {...attributes} className={`task-card ${task.completed ? 'is-complete' : ''} ${isDragging ? 'is-dragging' : ''}`} onClick={onToggle}>
    <p className="task-title">{task.title}</p><button className="delete-button" type="button" onClick={(event) => { event.stopPropagation(); onDelete() }} aria-label="删除任务">×</button>
  </article>
}
function QuadrantPanel({ quadrant, tasks, onRename, onAdd, onToggle, onDelete }: { quadrant: Quadrant; tasks: Task[]; onRename: (name: string) => void; onAdd: () => void; onToggle: (id: string) => void; onDelete: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: quadrant.id }); const [editing, setEditing] = useState(false); const [name, setName] = useState(quadrant.name)
  const saveName = () => { const nextName = name.trim() || quadrant.name; setName(nextName); onRename(nextName); setEditing(false) }
  return <section ref={setNodeRef} className={`quadrant-panel quadrant-panel--${quadrant.tone} ${isOver ? 'is-over' : ''}`}>
    <header className="quadrant-header"><div className="quadrant-heading"><span className="quadrant-dot" />{editing ? <input autoFocus value={name} onChange={(event) => setName(event.target.value)} onBlur={saveName} onKeyDown={(event) => event.key === 'Enter' && saveName()} /> : <button className="quadrant-name" type="button" onClick={() => setEditing(true)}>{quadrant.name}</button>}</div></header>
    <SortableContext items={tasks.map((task) => task.id)} strategy={rectSortingStrategy}><div className="task-list">{tasks.map((task) => <TaskCard key={task.id} task={task} onToggle={() => onToggle(task.id)} onDelete={() => onDelete(task.id)} />)}<button className="add-task" type="button" onClick={onAdd}><span>+</span> 添加任务</button></div></SortableContext>
  </section>
}
function App() {
  const [{ quadrants, tasks }, setBoard] = useState(readBoard); const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } })); const activeTask = useMemo(() => tasks.find((task) => task.id === activeId), [activeId, tasks])
  useEffect(() => { saveBoard({ quadrants, tasks }) }, [quadrants, tasks])
  const updateTask = (id: string, update: Partial<Task>) => setBoard((board) => ({ ...board, tasks: board.tasks.map((task) => task.id === id ? { ...task, ...update } : task) }))
  const addTask = (quadrantId: string) => { const title = window.prompt('任务名称')?.trim(); if (!title) return; setBoard((board) => ({ ...board, tasks: [...board.tasks, { id: `task-${Date.now()}`, title, completed: false, quadrantId }] })) }
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
  return <main className="app-shell"><DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}><div className="quadrant-grid">{quadrants.map((quadrant) => <QuadrantPanel key={quadrant.id} quadrant={quadrant} tasks={tasks.filter((task) => task.quadrantId === quadrant.id)} onRename={(name) => setBoard((board) => ({ ...board, quadrants: board.quadrants.map((item) => item.id === quadrant.id ? { ...item, name } : item) }))} onAdd={() => addTask(quadrant.id)} onToggle={(id) => updateTask(id, { completed: !tasks.find((task) => task.id === id)?.completed })} onDelete={(id) => setBoard((board) => ({ ...board, tasks: board.tasks.filter((task) => task.id !== id) }))} />)}</div><DragOverlay>{activeTask ? <TaskCard task={activeTask} onToggle={() => undefined} onDelete={() => undefined} /> : null}</DragOverlay></DndContext></main>
}
export default App
