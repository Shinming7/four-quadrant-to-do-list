import { useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import './App.css'

type Task = { id: string; title: string; completed: boolean; quadrantId: string }
type Quadrant = { id: string; name: string; tone: string; deletable: boolean }
type Board = { quadrants: Quadrant[]; tasks: Task[] }
type LayoutMode = 'default' | 'flow'
type ArrangementMode = 'grid' | 'stack'
const INBOX_ID = 'inbox'
const STORAGE_KEY = 'quadrant-board-v2'
const LAYOUT_STORAGE_KEY = 'quadrant-layout-mode'
const ARRANGEMENT_STORAGE_KEY = 'quadrant-arrangement-mode'
const defaultQuadrants: Quadrant[] = [
  { id: 'q1', name: '重要且紧急', tone: 'coral', deletable: true },
  { id: 'q2', name: '重要不紧急', tone: 'blue', deletable: true },
  { id: 'q3', name: '不重要但紧急', tone: 'gold', deletable: true },
  { id: 'q4', name: '不重要不紧急', tone: 'sage', deletable: true },
]
const inbox: Quadrant = { id: INBOX_ID, name: '待分类', tone: 'inbox', deletable: false }
const initialTasks: Task[] = [
  { id: 'task-1', title: '整理本周项目计划', completed: false, quadrantId: 'q1' },
  { id: 'task-2', title: '完成产品需求草稿', completed: false, quadrantId: 'q2' },
  { id: 'task-3', title: '回复团队消息', completed: false, quadrantId: 'q3' },
]
function normalizeBoard(value: unknown): Board {
  const source = value as { quadrants?: Partial<Quadrant>[]; tasks?: Partial<Task>[] } | null
  const rawQuadrants = Array.isArray(source?.quadrants) ? source.quadrants : defaultQuadrants
  const quadrants = rawQuadrants.map((item, index) => ({
    id: typeof item.id === 'string' && item.id ? item.id : `quadrant-${index + 1}`,
    name: typeof item.name === 'string' && item.name ? item.name : `象限 ${index + 1}`,
    tone: typeof item.tone === 'string' ? item.tone : ['coral', 'blue', 'gold', 'sage'][index % 4],
    deletable: Boolean(item.deletable),
  })).filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index)
  const validIds = new Set([INBOX_ID, ...quadrants.map((item) => item.id)])
  const tasks = Array.isArray(source?.tasks) ? source.tasks.flatMap((item, index) => {
    if (typeof item.title !== 'string' || !item.title.trim()) return []
    return [{ id: typeof item.id === 'string' ? item.id : `task-${Date.now()}-${index}`, title: item.title.trim(), completed: Boolean(item.completed), quadrantId: validIds.has(String(item.quadrantId)) ? String(item.quadrantId) : INBOX_ID }]
  }) : initialTasks
  return { quadrants: quadrants.length ? quadrants : defaultQuadrants, tasks }
}
function readBoard(): Board {
  try {
    const current = localStorage.getItem(STORAGE_KEY)
    if (current) return normalizeBoard(JSON.parse(current))
    const old = localStorage.getItem('quadrant-board-v1')
    return normalizeBoard(old ? JSON.parse(old) : { quadrants: defaultQuadrants, tasks: initialTasks })
  } catch { return { quadrants: defaultQuadrants, tasks: initialTasks } }
}
function saveBoard(board: Board) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(board)) } catch { /* storage may be unavailable */ } }
function readMode<T extends string>(key: string, fallback: T, value: T): T { try { return localStorage.getItem(key) === value ? value : fallback } catch { return fallback } }
function TaskCard({ task, onToggle, onDelete, selecting, selected }: { task: Task; onToggle?: () => void; onDelete?: () => void; selecting?: boolean; selected?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} {...listeners} {...attributes} className={`task-card ${task.completed ? 'is-complete' : ''} ${isDragging ? 'is-dragging' : ''} ${selecting ? 'is-selecting' : ''} ${selected ? 'is-selected' : ''}`} onClick={onToggle}>
    {selecting && <span className="task-check">{selected ? '✓' : ''}</span>}<p className="task-title">{task.title}</p>{!selecting && onDelete && <button className="delete-button" type="button" onClick={(event) => { event.stopPropagation(); onDelete() }} aria-label="删除任务">×</button>}
  </article>
}
function AreaPanel({ area, tasks, onRename, onAdd, onToggle, onDelete, onRemove, selecting, selectedIds, onSelectArea }: { area: Quadrant; tasks: Task[]; onRename?: (name: string) => void; onAdd: () => void; onToggle: (id: string) => void; onDelete: (id: string) => void; onRemove?: () => void; selecting?: boolean; selectedIds: Set<string>; onSelectArea: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: area.id }); const [editing, setEditing] = useState(false); const [name, setName] = useState(area.name)
  const saveName = () => { const next = name.trim() || area.name; setName(next); onRename?.(next); setEditing(false) }
  const allSelected = tasks.length > 0 && tasks.every((task) => selectedIds.has(task.id))
  return <section ref={setNodeRef} className={`quadrant-panel quadrant-panel--${area.tone} ${area.id === INBOX_ID ? 'is-inbox' : ''} ${isOver ? 'is-over' : ''} ${selecting ? 'is-selecting-area' : ''}`}>
    <header className="quadrant-header"><div className="quadrant-heading"><span className="quadrant-dot" />{editing ? <input autoFocus value={name} onChange={(event) => setName(event.target.value)} onBlur={saveName} onKeyDown={(event) => event.key === 'Enter' && saveName()} /> : <button className="quadrant-name" type="button" onClick={() => onRename && setEditing(true)}>{area.name}</button>}</div>{selecting && <button className="select-area" type="button" onClick={onSelectArea}>{allSelected ? '取消全选' : '全选'}</button>}{onRemove && <button className="remove-quadrant" type="button" onClick={onRemove} aria-label="删除象限">×</button>}</header>
    <SortableContext items={tasks.map((task) => task.id)} strategy={rectSortingStrategy}><div className="task-list">{tasks.map((task) => <TaskCard key={task.id} task={task} onToggle={() => onToggle(task.id)} onDelete={() => onDelete(task.id)} selecting={selecting} selected={selectedIds.has(task.id)} />)}{!selecting && <button className="add-task" type="button" onClick={onAdd}><span>+</span> 添加词条</button>}</div></SortableContext>
  </section>
}
function App() {
  const [{ quadrants, tasks }, setBoard] = useState(readBoard)
  const [activeId, setActiveId] = useState<string | null>(null); const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => readMode(LAYOUT_STORAGE_KEY, 'default', 'flow')); const [arrangementMode, setArrangementMode] = useState<ArrangementMode>(() => readMode(ARRANGEMENT_STORAGE_KEY, 'grid', 'stack'))
  const [ocrStatus, setOcrStatus] = useState(''); const [ocrError, setOcrError] = useState('')
  const [pendingTitles, setPendingTitles] = useState<string[] | null>(null)
  const [deleting, setDeleting] = useState(false); const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const ocrWorkerRef = useRef<Awaited<ReturnType<NonNullable<Window['Tesseract']>['createWorker']>> | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } })); const activeTask = useMemo(() => tasks.find((task) => task.id === activeId), [activeId, tasks])
  useEffect(() => saveBoard({ quadrants, tasks }), [quadrants, tasks]); useEffect(() => { try { localStorage.setItem(LAYOUT_STORAGE_KEY, layoutMode); localStorage.setItem(ARRANGEMENT_STORAGE_KEY, arrangementMode) } catch { /* storage may be unavailable */ } }, [layoutMode, arrangementMode])
  useEffect(() => () => { void ocrWorkerRef.current?.terminate() }, [])
  const updateTask = (id: string, update: Partial<Task>) => setBoard((board) => ({ ...board, tasks: board.tasks.map((task) => task.id === id ? { ...task, ...update } : task) }))
  const addTask = (quadrantId: string) => { const title = window.prompt('任务名称')?.trim(); if (title) setBoard((board) => ({ ...board, tasks: [...board.tasks, { id: `task-${Date.now()}`, title, completed: false, quadrantId }] })) }
  const removeQuadrant = (id: string) => setBoard((board) => ({ quadrants: board.quadrants.filter((quadrant) => quadrant.id !== id), tasks: board.tasks.map((task) => task.quadrantId === id ? { ...task, quadrantId: INBOX_ID } : task) }))
  const addQuadrant = () => { const name = window.prompt('新象限名称')?.trim(); if (!name) return; setBoard((board) => ({ ...board, quadrants: [...board.quadrants, { id: `quadrant-${Date.now()}`, name, tone: 'sage', deletable: true }] })) }
  const toggleDeleting = () => { if (deleting) setSelectedIds(new Set()); setDeleting(!deleting) }
  const handleTaskClick = (id: string) => {
    if (deleting) { setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next }) }
    else updateTask(id, { completed: !tasks.find((task) => task.id === id)?.completed })
  }
  const toggleSelectArea = (areaTasks: Task[]) => {
    const ids = areaTasks.map((task) => task.id)
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id))
    setSelectedIds((prev) => { const next = new Set(prev); if (allSelected) ids.forEach((id) => next.delete(id)); else ids.forEach((id) => next.add(id)); return next })
  }
  const deleteSelected = () => {
    if (!selectedIds.size) return
    if (!window.confirm(`确定删除选中的 ${selectedIds.size} 个词条吗？`)) return
    setBoard((board) => ({ ...board, tasks: board.tasks.filter((task) => !selectedIds.has(task.id)) }))
    setSelectedIds(new Set())
  }
  const clearAllTasks = () => {
    if (!tasks.length) return
    if (!window.confirm('确定清除所有象限的全部词条吗？此操作不可撤销。')) return
    setBoard((board) => ({ ...board, tasks: [] }))
    setSelectedIds(new Set())
  }
  const updatePendingTitle = (index: number, title: string) => setPendingTitles((prev) => prev ? prev.map((item, i) => i === index ? title : item) : prev)
  const removePendingTitle = (index: number) => setPendingTitles((prev) => prev ? prev.filter((_, i) => i !== index) : prev)
  const confirmImport = () => {
    if (!pendingTitles) return
    const titles = pendingTitles.map((title) => title.trim()).filter(Boolean)
    if (!titles.length) { setPendingTitles(null); return }
    setBoard((board) => ({ ...board, tasks: [...board.tasks, ...titles.map((title, index) => ({ id: `ocr-${Date.now()}-${index}`, title, completed: false, quadrantId: INBOX_ID }))] }))
    setPendingTitles(null)
    setOcrStatus(`已导入 ${titles.length} 条到待分类`)
    setTimeout(() => setOcrStatus(''), 4000)
  }
  const handleDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id))
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null); if (!over || active.id === over.id) return
    setBoard((board) => { const activeTask = board.tasks.find((task) => task.id === active.id); if (!activeTask) return board; const targetTask = board.tasks.find((task) => task.id === over.id); const areas = [inbox, ...board.quadrants]; const targetArea = areas.some((area) => area.id === over.id) ? String(over.id) : targetTask?.quadrantId; if (!targetArea) return board; const remaining = board.tasks.filter((task) => task.id !== active.id); const targetIndex = targetTask ? remaining.findIndex((task) => task.id === targetTask.id) : remaining.map((task) => task.quadrantId).lastIndexOf(targetArea) + 1; remaining.splice(Math.max(0, targetIndex), 0, { ...activeTask, quadrantId: targetArea }); return { ...board, tasks: remaining } })
  }
  async function upscaleImage(file: File): Promise<Blob | File> {
    let bitmap: ImageBitmap
    try { bitmap = await createImageBitmap(file) } catch { return file }
    const maxEdge = Math.max(bitmap.width, bitmap.height)
    if (maxEdge >= 2000) { bitmap.close(); return file }
    const scale = 2000 / maxEdge
    const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext('2d')
    if (!context) { bitmap.close(); return file }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('图像处理失败'))))
  }
  const cleanOcrText = (text: string): string[] => {
    const lines = text.split(/\r?\n/)
    const cleaned: string[] = []
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim()
      if (!line) continue
      line = line.replace(/^\s*[-*•·\d.、【】[\]()（）]+\s*/, '').trim()
      if (!line || line.length < 2) continue
      let previous = ''
      while (previous !== line) {
        previous = line
        line = line.replace(/([\u4e00-\u9fff])(?:[\s\-_·•*|/\\])+(?=[\u4e00-\u9fff])/g, '$1')
      }
      if (cleaned.length > 0 && line.length <= 4 && /^[、，。；：？！,.:;?!]/.test(line)) {
        cleaned[cleaned.length - 1] += line
        continue
      }
      if (/[\u4e00-\u9fff\w]/.test(line)) {
        cleaned.push(line)
      }
    }
    return cleaned.filter((line) => line.length >= 2)
  }
  const importImage = async (file: File) => {
    setOcrError('')
    if (!window.Tesseract) { setOcrError('OCR 模块加载失败，请刷新后重试'); return }
    setOcrStatus('正在准备识别…')
    try {
      const image = await upscaleImage(file)
      let worker = ocrWorkerRef.current
      if (!worker) {
        setOcrStatus('正在准备识别模型…')
        worker = await window.Tesseract.createWorker('chi_sim+eng', 1, { logger: (message) => setOcrStatus(`${message.status} ${Math.round(message.progress * 100)}%`) })
        await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' })
        ocrWorkerRef.current = worker
      }
      setOcrStatus('正在识别…')
      const result = await worker.recognize(image)
      const titles = cleanOcrText(result.data.text)
      if (!titles.length) throw new Error('没有识别到清单文字')
      setPendingTitles(titles)
      setOcrStatus(`识别到 ${titles.length} 条，请确认后导入`)
    } catch (error) {
      ocrWorkerRef.current = null
      setOcrStatus('')
      setOcrError(error instanceof Error ? error.message : '识别失败，请重试')
    }
  }
  const areas = [inbox, ...quadrants]
  return <main className="app-shell"><div className="board-actions"><label className="upload-button"><span>识别图片</span><input type="file" accept="image/jpeg,image/png" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importImage(file); event.currentTarget.value = '' }} /></label><button className={`delete-mode-button ${deleting ? 'is-active' : ''}`} type="button" onClick={toggleDeleting}>{deleting ? '完成' : '删除'}</button>{deleting && <button className="delete-selected-button" type="button" onClick={deleteSelected} disabled={selectedIds.size === 0}>删除选中 ({selectedIds.size})</button>}{deleting && <button className="clear-all-button" type="button" onClick={clearAllTasks}>全部清除</button>}<button className="add-quadrant-button" type="button" onClick={addQuadrant}>+ 新增象限</button><div className="switches"><div className="layout-switch" role="group" aria-label="选择象限排列"><span className="layout-switch__label">排列</span><button className={arrangementMode === 'grid' ? 'is-selected' : ''} type="button" onClick={() => setArrangementMode('grid')}>2×2</button><button className={arrangementMode === 'stack' ? 'is-selected' : ''} type="button" onClick={() => setArrangementMode('stack')}>纵向</button></div><div className="layout-switch" role="group" aria-label="选择象限排版"><span className="layout-switch__label">排版</span><button className={layoutMode === 'default' ? 'is-selected' : ''} type="button" onClick={() => setLayoutMode('default')}>默认</button><button className={layoutMode === 'flow' ? 'is-selected' : ''} type="button" onClick={() => setLayoutMode('flow')}>随任务量移动</button></div></div></div>{(ocrStatus || ocrError) && <p className={`ocr-message ${ocrError ? 'is-error' : ''}`}>{ocrError || ocrStatus}</p>}{pendingTitles && <div className="ocr-preview"><p className="ocr-preview__title">识别到 {pendingTitles.length} 条，可修改后导入：</p><div className="ocr-preview__list">{pendingTitles.map((title, index) => <div className="ocr-preview__row" key={index}><input value={title} onChange={(event) => updatePendingTitle(index, event.target.value)} /><button type="button" onClick={() => removePendingTitle(index)} aria-label="删除此行">×</button></div>)}</div><div className="ocr-preview__actions"><button type="button" onClick={confirmImport}>导入 ({pendingTitles.filter((title) => title.trim()).length})</button><button type="button" onClick={() => setPendingTitles(null)}>放弃</button></div></div>}<DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}><div className={`quadrant-grid quadrant-grid--${arrangementMode} ${layoutMode === 'flow' ? 'quadrant-grid--flow' : ''}`}>{areas.map((area) => { const areaTasks = tasks.filter((task) => task.quadrantId === area.id); return <AreaPanel key={area.id} area={area} tasks={areaTasks} onRename={area.id === INBOX_ID ? undefined : (name) => setBoard((board) => ({ ...board, quadrants: board.quadrants.map((item) => item.id === area.id ? { ...item, name } : item) }))} onAdd={() => addTask(area.id)} onToggle={handleTaskClick} onDelete={(id) => setBoard((board) => ({ ...board, tasks: board.tasks.filter((task) => task.id !== id) }))} onRemove={area.deletable ? () => removeQuadrant(area.id) : undefined} selecting={deleting} selectedIds={selectedIds} onSelectArea={() => toggleSelectArea(areaTasks)} /> })}</div><DragOverlay>{activeTask ? <TaskCard task={activeTask} /> : null}</DragOverlay></DndContext></main>
}
export default App
