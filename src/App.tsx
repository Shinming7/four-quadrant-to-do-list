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
const MAX_IMAGE_EDGE = 1800
const MIN_IMAGE_EDGE = 1200
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
function TaskCard({ task, onToggle, onDelete }: { task: Task; onToggle?: () => void; onDelete?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} {...listeners} {...attributes} className={`task-card ${task.completed ? 'is-complete' : ''} ${isDragging ? 'is-dragging' : ''}`} onClick={onToggle}>
    <p className="task-title">{task.title}</p>{onDelete && <button className="delete-button" type="button" onClick={(event) => { event.stopPropagation(); onDelete() }} aria-label="删除任务">×</button>}
  </article>
}
function AreaPanel({ area, tasks, onRename, onAdd, onToggle, onDelete, onRemove }: { area: Quadrant; tasks: Task[]; onRename?: (name: string) => void; onAdd: () => void; onToggle: (id: string) => void; onDelete: (id: string) => void; onRemove?: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: area.id }); const [editing, setEditing] = useState(false); const [name, setName] = useState(area.name)
  const saveName = () => { const next = name.trim() || area.name; setName(next); onRename?.(next); setEditing(false) }
  return <section ref={setNodeRef} className={`quadrant-panel quadrant-panel--${area.tone} ${area.id === INBOX_ID ? 'is-inbox' : ''} ${isOver ? 'is-over' : ''}`}>
    <header className="quadrant-header"><div className="quadrant-heading"><span className="quadrant-dot" />{editing ? <input autoFocus value={name} onChange={(event) => setName(event.target.value)} onBlur={saveName} onKeyDown={(event) => event.key === 'Enter' && saveName()} /> : <button className="quadrant-name" type="button" onClick={() => onRename && setEditing(true)}>{area.name}</button>}</div>{onRemove && <button className="remove-quadrant" type="button" onClick={onRemove} aria-label="删除象限">×</button>}</header>
    <SortableContext items={tasks.map((task) => task.id)} strategy={rectSortingStrategy}><div className="task-list">{tasks.map((task) => <TaskCard key={task.id} task={task} onToggle={() => onToggle(task.id)} onDelete={() => onDelete(task.id)} />)}<button className="add-task" type="button" onClick={onAdd}><span>+</span> 添加词条</button></div></SortableContext>
  </section>
}
function App() {
  const [{ quadrants, tasks }, setBoard] = useState(readBoard)
  const [activeId, setActiveId] = useState<string | null>(null); const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => readMode(LAYOUT_STORAGE_KEY, 'default', 'flow')); const [arrangementMode, setArrangementMode] = useState<ArrangementMode>(() => readMode(ARRANGEMENT_STORAGE_KEY, 'grid', 'stack'))
  const [ocrStatus, setOcrStatus] = useState(''); const [ocrError, setOcrError] = useState('')
  const ocrWorkerRef = useRef<Awaited<ReturnType<NonNullable<Window['Tesseract']>['createWorker']>> | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } })); const activeTask = useMemo(() => tasks.find((task) => task.id === activeId), [activeId, tasks])
  useEffect(() => saveBoard({ quadrants, tasks }), [quadrants, tasks]); useEffect(() => { try { localStorage.setItem(LAYOUT_STORAGE_KEY, layoutMode); localStorage.setItem(ARRANGEMENT_STORAGE_KEY, arrangementMode) } catch { /* storage may be unavailable */ } }, [layoutMode, arrangementMode])
  useEffect(() => () => { void ocrWorkerRef.current?.terminate() }, [])
  const updateTask = (id: string, update: Partial<Task>) => setBoard((board) => ({ ...board, tasks: board.tasks.map((task) => task.id === id ? { ...task, ...update } : task) }))
  const addTask = (quadrantId: string) => { const title = window.prompt('任务名称')?.trim(); if (title) setBoard((board) => ({ ...board, tasks: [...board.tasks, { id: `task-${Date.now()}`, title, completed: false, quadrantId }] })) }
  const removeQuadrant = (id: string) => setBoard((board) => ({ quadrants: board.quadrants.filter((quadrant) => quadrant.id !== id), tasks: board.tasks.map((task) => task.quadrantId === id ? { ...task, quadrantId: INBOX_ID } : task) }))
  const addQuadrant = () => { const name = window.prompt('新象限名称')?.trim(); if (!name) return; setBoard((board) => ({ ...board, quadrants: [...board.quadrants, { id: `quadrant-${Date.now()}`, name, tone: 'sage', deletable: true }] })) }
  const handleDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id))
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null); if (!over || active.id === over.id) return
    setBoard((board) => { const activeTask = board.tasks.find((task) => task.id === active.id); if (!activeTask) return board; const targetTask = board.tasks.find((task) => task.id === over.id); const areas = [inbox, ...board.quadrants]; const targetArea = areas.some((area) => area.id === over.id) ? String(over.id) : targetTask?.quadrantId; if (!targetArea) return board; const remaining = board.tasks.filter((task) => task.id !== active.id); const targetIndex = targetTask ? remaining.findIndex((task) => task.id === targetTask.id) : remaining.map((task) => task.quadrantId).lastIndexOf(targetArea) + 1; remaining.splice(Math.max(0, targetIndex), 0, { ...activeTask, quadrantId: targetArea }); return { ...board, tasks: remaining } })
  }
  function medianFilter(gray: Uint8Array, width: number, height: number): Uint8Array {
    const out = new Uint8Array(gray.length); const neighbors = new Uint8Array(9)
    for (let y = 0; y < height; y++) {
      const y0 = Math.max(0, y - 1); const y1 = Math.min(height - 1, y + 1)
      for (let x = 0; x < width; x++) {
        const x0 = Math.max(0, x - 1); const x1 = Math.min(width - 1, x + 1)
        let k = 0
        for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) neighbors[k++] = gray[yy * width + xx]
        for (let i = 1; i < k; i++) { const value = neighbors[i]; let j = i - 1; while (j >= 0 && neighbors[j] > value) { neighbors[j + 1] = neighbors[j]; j-- } neighbors[j + 1] = value }
        out[y * width + x] = neighbors[k >> 1]
      }
    }
    return out
  }
  function stretchContrast(gray: Uint8Array): Uint8Array {
    const hist = new Uint32Array(256); const out = new Uint8Array(gray.length)
    for (let i = 0; i < gray.length; i++) hist[gray[i]]++
    let acc = 0; let low = 0; const p1 = Math.floor(gray.length * 0.01)
    while (low < 255 && acc < p1) { acc += hist[low]; low++ }
    let high = 255; acc = 0; const p99 = Math.floor(gray.length * 0.99)
    while (high > 0 && acc < gray.length - p99) { acc += hist[high]; high-- }
    if (high <= low) return gray
    const scale = 255 / (high - low)
    for (let i = 0; i < gray.length; i++) { const value = (gray[i] - low) * scale; out[i] = value < 0 ? 0 : value > 255 ? 255 : value | 0 }
    return out
  }
  async function preprocessImage(file: File): Promise<Blob> {
    const bitmap = await createImageBitmap(file)
    const originalEdge = Math.max(bitmap.width, bitmap.height)
    const scale = originalEdge < MIN_IMAGE_EDGE ? MIN_IMAGE_EDGE / originalEdge : Math.min(1, MAX_IMAGE_EDGE / originalEdge)
    const width = Math.max(1, Math.round(bitmap.width * scale)); const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('图像处理失败')
    context.drawImage(bitmap, 0, 0, width, height)
    const source = context.getImageData(0, 0, width, height)
    const gray = new Uint8Array(width * height)
    for (let i = 0, j = 0; i < source.data.length; i += 4, j++) gray[j] = (source.data[i] * 0.299 + source.data[i + 1] * 0.587 + source.data[i + 2] * 0.114 + 0.5) | 0
    let processed = medianFilter(gray, width, height)
    let sum = 0; for (let i = 0; i < processed.length; i++) sum += processed[i]
    if (sum / processed.length < 128) for (let i = 0; i < processed.length; i++) processed[i] = 255 - processed[i]
    const grayCanvas = document.createElement('canvas'); grayCanvas.width = width; grayCanvas.height = height
    const grayPixels = new Uint8ClampedArray(width * height * 4)
    for (let i = 0, j = 0; i < grayPixels.length; i += 4, j++) { grayPixels[i] = processed[j]; grayPixels[i + 1] = processed[j]; grayPixels[i + 2] = processed[j]; grayPixels[i + 3] = 255 }
    grayCanvas.getContext('2d')!.putImageData(new ImageData(grayPixels, width, height), 0, 0)
    const bgCanvas = document.createElement('canvas'); bgCanvas.width = 64; bgCanvas.height = 64
    const bgContext = bgCanvas.getContext('2d', { willReadFrequently: true })
    if (!bgContext) throw new Error('图像处理失败')
    bgContext.drawImage(grayCanvas, 0, 0, 64, 64)
    const background = bgContext.getImageData(0, 0, 64, 64).data
    const normalized = new Uint8Array(processed.length)
    for (let y = 0; y < height; y++) {
      const by = Math.min(63, (y * 64 / height) | 0)
      for (let x = 0; x < width; x++) {
        const bx = Math.min(63, (x * 64 / width) | 0)
        const bg = Math.max(16, background[(by * 64 + bx) * 4])
        const value = 255 * processed[y * width + x] / bg
        normalized[y * width + x] = value > 255 ? 255 : value | 0
      }
    }
    processed = stretchContrast(normalized)
    const output = context.createImageData(width, height)
    for (let i = 0, j = 0; i < output.data.length; i += 4, j++) { output.data[i] = processed[j]; output.data[i + 1] = processed[j]; output.data[i + 2] = processed[j]; output.data[i + 3] = 255 }
    context.putImageData(output, 0, 0)
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
      line = line.replace(/\s+/g, ' ')
      line = line.replace(/([\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])/g, '$1')
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
    setOcrStatus('正在处理图片…')
    try {
      const image = await preprocessImage(file)
      let worker = ocrWorkerRef.current
      if (!worker) {
        setOcrStatus('正在准备识别模型…')
        worker = await window.Tesseract.createWorker('chi_sim+eng', 1, { logger: (message) => setOcrStatus(`${message.status} ${Math.round(message.progress * 100)}%`) })
        await worker.setParameters({ user_defined_dpi: '300', preserve_interword_spaces: '1' })
        ocrWorkerRef.current = worker
      }
      setOcrStatus('正在识别…')
      const result = await worker.recognize(image)
      const titles = cleanOcrText(result.data.text)
      if (!titles.length) throw new Error('没有识别到清单文字')
      setBoard((board) => ({ ...board, tasks: [...board.tasks, ...titles.map((title, index) => ({ id: `ocr-${Date.now()}-${index}`, title, completed: false, quadrantId: INBOX_ID }))] }))
      setOcrStatus(`已导入 ${titles.length} 条到待分类`)
      setTimeout(() => setOcrStatus(''), 4000)
    } catch (error) {
      ocrWorkerRef.current = null
      setOcrStatus('')
      setOcrError(error instanceof Error ? error.message : '识别失败，请重试')
    }
  }
  const areas = [inbox, ...quadrants]
  return <main className="app-shell"><div className="board-actions"><label className="upload-button"><span>识别图片</span><input type="file" accept="image/jpeg,image/png" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importImage(file); event.currentTarget.value = '' }} /></label><button className="add-quadrant-button" type="button" onClick={addQuadrant}>+ 新增象限</button><div className="switches"><div className="layout-switch" role="group" aria-label="选择象限排列"><span className="layout-switch__label">排列</span><button className={arrangementMode === 'grid' ? 'is-selected' : ''} type="button" onClick={() => setArrangementMode('grid')}>2×2</button><button className={arrangementMode === 'stack' ? 'is-selected' : ''} type="button" onClick={() => setArrangementMode('stack')}>纵向</button></div><div className="layout-switch" role="group" aria-label="选择象限排版"><span className="layout-switch__label">排版</span><button className={layoutMode === 'default' ? 'is-selected' : ''} type="button" onClick={() => setLayoutMode('default')}>默认</button><button className={layoutMode === 'flow' ? 'is-selected' : ''} type="button" onClick={() => setLayoutMode('flow')}>随任务量移动</button></div></div></div>{(ocrStatus || ocrError) && <p className={`ocr-message ${ocrError ? 'is-error' : ''}`}>{ocrError || ocrStatus}</p>}<DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}><div className={`quadrant-grid quadrant-grid--${arrangementMode} ${layoutMode === 'flow' ? 'quadrant-grid--flow' : ''}`}>{areas.map((area) => <AreaPanel key={area.id} area={area} tasks={tasks.filter((task) => task.quadrantId === area.id)} onRename={area.id === INBOX_ID ? undefined : (name) => setBoard((board) => ({ ...board, quadrants: board.quadrants.map((item) => item.id === area.id ? { ...item, name } : item) }))} onAdd={() => addTask(area.id)} onToggle={(id) => updateTask(id, { completed: !tasks.find((task) => task.id === id)?.completed })} onDelete={(id) => setBoard((board) => ({ ...board, tasks: board.tasks.filter((task) => task.id !== id) }))} onRemove={area.deletable ? () => removeQuadrant(area.id) : undefined} />)}</div><DragOverlay>{activeTask ? <TaskCard task={activeTask} /> : null}</DragOverlay></DndContext></main>
}
export default App
