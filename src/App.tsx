import { useEffect, useMemo, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import './App.css'

type Task = { id: string; title: string; completed: boolean; quadrantId: string }
type Quadrant = { id: string; name: string; tone: string }
type LayoutMode = 'default' | 'flow'
type ArrangementMode = 'grid' | 'stack'
const STORAGE_KEY = 'quadrant-board-v1'
const LAYOUT_STORAGE_KEY = 'quadrant-layout-mode'
const ARRANGEMENT_STORAGE_KEY = 'quadrant-arrangement-mode'
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
function readLayoutMode(): LayoutMode {
  try { return localStorage.getItem(LAYOUT_STORAGE_KEY) === 'flow' ? 'flow' : 'default' } catch { return 'default' }
}
function readArrangementMode(): ArrangementMode {
  try { return localStorage.getItem(ARRANGEMENT_STORAGE_KEY) === 'stack' ? 'stack' : 'grid' } catch { return 'grid' }
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
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(readLayoutMode)
  const [arrangementMode, setArrangementMode] = useState<ArrangementMode>(readArrangementMode)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } })); const activeTask = useMemo(() => tasks.find((task) => task.id === activeId), [activeId, tasks])
  useEffect(() => { saveBoard({ quadrants, tasks }) }, [quadrants, tasks])
  useEffect(() => { try { localStorage.setItem(LAYOUT_STORAGE_KEY, layoutMode) } catch { /* file previews may disable storage */ } }, [layoutMode])
  useEffect(() => { try { localStorage.setItem(ARRANGEMENT_STORAGE_KEY, arrangementMode) } catch { /* file previews may disable storage */ } }, [arrangementMode])
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
  return <main className="app-shell"><div className="switches"><div className="layout-switch" role="group" aria-label="选择象限排列"><span className="layout-switch__label">排列</span><button className={arrangementMode === 'grid' ? 'is-selected' : ''} type="button" onClick={() => setArrangementMode('grid')} aria-pressed={arrangementMode === 'grid'}>2×2</button><button className={arrangementMode === 'stack' ? 'is-selected' : ''} type="button" onClick={() => setArrangementMode('stack')} aria-pressed={arrangementMode === 'stack'}>纵向</button></div><div className="layout-switch" role="group" aria-label="选择象限排版"><span className="layout-switch__label">排版</span><button className={layoutMode === 'default' ? 'is-selected' : ''} type="button" onClick={() => setLayoutMode('default')} aria-pressed={layoutMode === 'default'}>默认</button><button className={layoutMode === 'flow' ? 'is-selected' : ''} type="button" onClick={() => setLayoutMode('flow')} aria-pressed={layoutMode === 'flow'}>随任务量移动</button></div></div><DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}><div className={`quadrant-grid quadrant-grid--${arrangementMode} ${layoutMode === 'flow' ? 'quadrant-grid--flow' : ''}`}>{quadrants.map((quadrant) => <QuadrantPanel key={quadrant.id} quadrant={quadrant} tasks={tasks.filter((task) => task.quadrantId === quadrant.id)} onRename={(name) => setBoard((board) => ({ ...board, quadrants: board.quadrants.map((item) => item.id === quadrant.id ? { ...item, name } : item) }))} onAdd={() => addTask(quadrant.id)} onToggle={(id) => updateTask(id, { completed: !tasks.find((task) => task.id === id)?.completed })} onDelete={(id) => setBoard((board) => ({ ...board, tasks: board.tasks.filter((task) => task.id !== id) }))} />)}</div><DragOverlay>{activeTask ? <TaskCard task={activeTask} onToggle={() => undefined} onDelete={() => undefined} /> : null}</DragOverlay></DndContext></main>
}
export default App
