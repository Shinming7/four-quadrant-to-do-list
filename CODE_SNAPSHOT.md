# 代码快照 (Code Snapshot)

本文件包含 App.tsx 中的关键代码段，便于快速查阅和理解核心逻辑。

**更新日期**: 2026-08-20

---

## 核心数据类型定义

```typescript
type Task = { id: string; title: string; completed: boolean; quadrantId: string }
type Quadrant = { id: string; name: string; tone: string; deletable: boolean }
type Board = { quadrants: Quadrant[]; tasks: Task[] }
type LayoutMode = 'default' | 'flow'
type ArrangementMode = 'grid' | 'stack'
```

---

## 常量定义

```typescript
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
```

---

## 数据持久化 & 迁移

### 数据规范化 & 验证

```typescript
function normalizeBoard(value: unknown): Board {
  const source = value as { quadrants?: Partial<Quadrant>[]; tasks?: Partial<Task>[] } | null
  
  // 规范化象限
  const rawQuadrants = Array.isArray(source?.quadrants) ? source.quadrants : defaultQuadrants
  const quadrants = rawQuadrants.map((item, index) => ({
    id: typeof item.id === 'string' && item.id ? item.id : `quadrant-${index + 1}`,
    name: typeof item.name === 'string' && item.name ? item.name : `象限 ${index + 1}`,
    tone: typeof item.tone === 'string' ? item.tone : ['coral', 'blue', 'gold', 'sage'][index % 4],
    deletable: Boolean(item.deletable),
  })).filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index)
  
  // 规范化任务（验证 quadrantId 有效）
  const validIds = new Set([INBOX_ID, ...quadrants.map((item) => item.id)])
  const tasks = Array.isArray(source?.tasks) ? source.tasks.flatMap((item, index) => {
    if (typeof item.title !== 'string' || !item.title.trim()) return []
    return [{
      id: typeof item.id === 'string' ? item.id : `task-${Date.now()}-${index}`,
      title: item.title.trim(),
      completed: Boolean(item.completed),
      quadrantId: validIds.has(String(item.quadrantId)) ? String(item.quadrantId) : INBOX_ID
    }]
  }) : initialTasks
  
  return {
    quadrants: quadrants.length ? quadrants : defaultQuadrants,
    tasks
  }
}
```

### 读取板数据（支持 v1 → v2 迁移）

```typescript
function readBoard(): Board {
  try {
    const current = localStorage.getItem(STORAGE_KEY)
    if (current) return normalizeBoard(JSON.parse(current))
    
    // 降级：尝试读取旧版本
    const old = localStorage.getItem('quadrant-board-v1')
    return normalizeBoard(old ? JSON.parse(old) : { quadrants: defaultQuadrants, tasks: initialTasks })
  } catch {
    return { quadrants: defaultQuadrants, tasks: initialTasks }
  }
}
```

### 保存板数据

```typescript
function saveBoard(board: Board) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(board))
  } catch {
    // storage may be unavailable (quota exceeded, private mode, etc)
  }
}
```

### 读取用户设置

```typescript
function readMode<T extends string>(key: string, fallback: T, value: T): T {
  try {
    return localStorage.getItem(key) === value ? value : fallback
  } catch {
    return fallback
  }
}
```

---

## 组件：TaskCard（任务卡片）

```typescript
function TaskCard({ task, onToggle, onDelete }: {
  task: Task
  onToggle?: () => void
  onDelete?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...listeners}
      {...attributes}
      className={`task-card ${task.completed ? 'is-complete' : ''} ${isDragging ? 'is-dragging' : ''}`}
      onClick={onToggle}
    >
      <p className="task-title">{task.title}</p>
      {onDelete && (
        <button
          className="delete-button"
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onDelete()
          }}
          aria-label="删除任务"
        >
          ×
        </button>
      )}
    </article>
  )
}
```

**特性**：
- 使用 `useSortable` hook 支持拖拽
- 完成状态显示 `.is-complete` 样式
- 拖拽中显示 `.is-dragging` 样式
- 点击任务切换完成状态
- 删除按钮在右上角

---

## 组件：AreaPanel（象限面板）

```typescript
function AreaPanel({
  area,
  tasks,
  onRename,
  onAdd,
  onToggle,
  onDelete,
  onRemove
}: {
  area: Quadrant
  tasks: Task[]
  onRename?: (name: string) => void
  onAdd: () => void
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onRemove?: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: area.id })
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(area.name)
  
  const saveName = () => {
    const next = name.trim() || area.name
    setName(next)
    onRename?.(next)
    setEditing(false)
  }
  
  return (
    <section
      ref={setNodeRef}
      className={`
        quadrant-panel
        quadrant-panel--${area.tone}
        ${area.id === INBOX_ID ? 'is-inbox' : ''}
        ${isOver ? 'is-over' : ''}
      `}
    >
      <header className="quadrant-header">
        <div className="quadrant-heading">
          <span className="quadrant-dot" />
          {editing ? (
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={saveName}
              onKeyDown={(event) => event.key === 'Enter' && saveName()}
            />
          ) : (
            <button
              className="quadrant-name"
              type="button"
              onClick={() => onRename && setEditing(true)}
            >
              {area.name}
            </button>
          )}
        </div>
        {onRemove && (
          <button
            className="remove-quadrant"
            type="button"
            onClick={onRemove}
            aria-label="删除象限"
          >
            ×
          </button>
        )}
      </header>
      <SortableContext items={tasks.map((task) => task.id)} strategy={rectSortingStrategy}>
        <div className="task-list">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onToggle={() => onToggle(task.id)}
              onDelete={() => onDelete(task.id)}
            />
          ))}
          <button className="add-task" type="button" onClick={onAdd}>
            <span>+</span> 添加词条
          </button>
        </div>
      </SortableContext>
    </section>
  )
}
```

**特性**：
- 可编辑象限名称（双击进入编辑模式）
- 使用 `useDroppable` 支持拖拽放置目标
- 待分类区域（inbox）不可删除
- 显示 `.is-over` 样式表示拖拽目标
- 排序任务列表（使用 SortableContext）
- "添加词条" 快捷按钮

---

## OCR 文本清理逻辑

```typescript
const cleanOcrText = (text: string): string[] => {
  const lines = text.split(/\r?\n/)
  const cleaned: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim()
    if (!line) continue  // 跳过空行
    
    // 移除前置符号和数字列表标记
    line = line.replace(/^\s*[-*•·\d.、【】\[\]()（）]+\s*/, '').trim()
    if (!line || line.length < 2) continue
    
    // 合并多个空格为单个空格
    line = line.replace(/\s+/g, ' ')
    
    // 如果短行且以标点开头，合并到前一行（解决"袜子 夹"问题）
    if (cleaned.length > 0 && line.length <= 4 && /^[、，。；：？！,.:;?!]/.test(line)) {
      cleaned[cleaned.length - 1] += line
      continue
    }
    
    // 验证包含中文或英文字符
    if (/[\u4e00-\u9fff\w]/.test(line)) {
      cleaned.push(line)
    }
  }
  
  return cleaned.filter((line) => line.length >= 2)
}
```

**改进点**（2026-08-20）：
- ✅ 移除空行和纯符号行
- ✅ 合并被夹空的词组（e.g., "袜子 夹" → "袜子夹"）
- ✅ 扩展符号过滤列表
- ✅ 严格有效性检查（必须包含中文或英文）

---

## 拖拽处理逻辑

### 拖拽开始

```typescript
const handleDragStart = ({ active }: DragStartEvent) => {
  setActiveId(String(active.id))
}
```

### 拖拽结束（跨象限支持）

```typescript
const handleDragEnd = ({ active, over }: DragEndEvent) => {
  setActiveId(null)
  if (!over || active.id === over.id) return
  
  setBoard((board) => {
    const activeTask = board.tasks.find((task) => task.id === active.id)
    if (!activeTask) return board
    
    const targetTask = board.tasks.find((task) => task.id === over.id)
    const areas = [inbox, ...board.quadrants]
    
    // 确定目标象限
    const targetArea = areas.some((area) => area.id === over.id)
      ? String(over.id)
      : targetTask?.quadrantId
    
    if (!targetArea) return board
    
    // 计算新位置
    const remaining = board.tasks.filter((task) => task.id !== active.id)
    const targetIndex = targetTask
      ? remaining.findIndex((task) => task.id === targetTask.id)
      : remaining.map((task) => task.quadrantId).lastIndexOf(targetArea) + 1
    
    // 插入到新位置
    remaining.splice(Math.max(0, targetIndex), 0, {
      ...activeTask,
      quadrantId: targetArea
    })
    
    return { ...board, tasks: remaining }
  })
}
```

**功能**：
- 支持象限内排序
- 支持跨象限拖拽
- 拖拽到象限区域头部添加
- 自动更新 `quadrantId`

---

## 象限管理

### 添加象限

```typescript
const addQuadrant = () => {
  const name = window.prompt('新象限名称')?.trim()
  if (!name) return
  
  setBoard((board) => ({
    ...board,
    quadrants: [
      ...board.quadrants,
      {
        id: `quadrant-${Date.now()}`,
        name,
        tone: 'sage',
        deletable: true
      }
    ]
  }))
}
```

### 删除象限（迁移任务到待分类）

```typescript
const removeQuadrant = (id: string) =>
  setBoard((board) => ({
    quadrants: board.quadrants.filter((quadrant) => quadrant.id !== id),
    tasks: board.tasks.map((task) =>
      task.quadrantId === id ? { ...task, quadrantId: INBOX_ID } : task
    )
  }))
```

---

## 图片 OCR 识别

```typescript
const importImage = async (file: File) => {
  setOcrError('')
  
  // 检查 Tesseract.js 是否加载
  if (!window.Tesseract) {
    setOcrError('OCR 模块加载失败，请刷新后重试')
    return
  }
  
  setOcrStatus('正在准备识别模型…')
  
  try {
    // 创建 Worker
    const worker = await window.Tesseract.createWorker('chi_sim+eng', 1, {
      logger: (message) =>
        setOcrStatus(`${message.status} ${Math.round(message.progress * 100)}%`)
    })
    
    // 识别图片
    const result = await worker.recognize(file)
    await worker.terminate()
    
    // 清理 OCR 文本
    const titles = cleanOcrText(result.data.text)
    
    if (!titles.length) throw new Error('没有识别到清单文字')
    
    // 导入任务到待分类
    setBoard((board) => ({
      ...board,
      tasks: [
        ...board.tasks,
        ...titles.map((title, index) => ({
          id: `ocr-${Date.now()}-${index}`,
          title,
          completed: false,
          quadrantId: INBOX_ID
        }))
      ]
    }))
    
    setOcrStatus(`已导入 ${titles.length} 条到待分类`)
    setTimeout(() => setOcrStatus(''), 4000)
  } catch (error) {
    setOcrStatus('')
    setOcrError(
      error instanceof Error ? error.message : '识别失败，请重试'
    )
  }
}
```

**流程**：
1. 验证 Tesseract.js 加载
2. 创建 Worker（chi_sim 中文 + eng 英文）
3. 识别图片，显示进度
4. 使用 `cleanOcrText()` 清理识别结果
5. 批量导入任务到待分类
6. 显示成功/失败消息

---

## 状态管理概览

**主要状态**：
```typescript
const [{ quadrants, tasks }, setBoard] = useState(readBoard)
const [activeId, setActiveId] = useState<string | null>(null)
const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => 
  readMode(LAYOUT_STORAGE_KEY, 'default', 'flow')
)
const [arrangementMode, setArrangementMode] = useState<ArrangementMode>(() => 
  readMode(ARRANGEMENT_STORAGE_KEY, 'grid', 'stack')
)
const [ocrStatus, setOcrStatus] = useState('')
const [ocrError, setOcrError] = useState('')
```

**自动保存**：
```typescript
useEffect(() => saveBoard({ quadrants, tasks }), [quadrants, tasks])
useEffect(() => {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, layoutMode)
    localStorage.setItem(ARRANGEMENT_STORAGE_KEY, arrangementMode)
  } catch {
    // storage may be unavailable
  }
}, [layoutMode, arrangementMode])
```

---

## 常用编辑操作

### 更新任务

```typescript
const updateTask = (id: string, update: Partial<Task>) =>
  setBoard((board) => ({
    ...board,
    tasks: board.tasks.map((task) =>
      task.id === id ? { ...task, ...update } : task
    )
  }))
```

### 添加任务

```typescript
const addTask = (quadrantId: string) => {
  const title = window.prompt('任务名称')?.trim()
  if (title)
    setBoard((board) => ({
      ...board,
      tasks: [
        ...board.tasks,
        {
          id: `task-${Date.now()}`,
          title,
          completed: false,
          quadrantId
        }
      ]
    }))
}
```

### 切换任务完成状态

```typescript
onToggle={(id) =>
  updateTask(id, { completed: !tasks.find((task) => task.id === id)?.completed })
}
```

### 删除任务

```typescript
onDelete={(id) =>
  setBoard((board) => ({
    ...board,
    tasks: board.tasks.filter((task) => task.id !== id)
  }))
}
```

---

## dnd-kit 传感器配置

```typescript
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: { distance: 8 }
  })
)
```

**说明**：
- 使用 PointerSensor（支持鼠标和触摸）
- 拖拽距离阈值：8px（防止误触发）

---

## 快速参考：修改清单

| 需求 | 代码位置 | 方法 |
|------|--------|------|
| 改变象限色彩 | `defaultQuadrants.tone` | 修改 CSS 类名 |
| 初始任务 | `initialTasks` | 直接编辑数组 |
| 修改 OCR 语言 | `createWorker('chi_sim+eng', ...)` | 更换参数 |
| 调整拖拽灵敏度 | `activationConstraint: { distance: 8 }` | 增减距离值 |
| 存储键名 | `STORAGE_KEY` | 改变后需清除旧数据 |
| 象限名称编辑权限 | `onRename={area.id === INBOX_ID ? undefined : ...}` | 修改条件 |

---

**版本**: v2.0.0  
**最后修改**: 2026-08-20
